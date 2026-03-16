/**
 * Pure Node.js ZIP builder — no external dependencies.
 * Uses DEFLATE compression via built-in zlib.
 */

import { deflateRawSync } from 'node:zlib'

export interface ZipEntry {
  path: string
  content: string
}

// ─── CRC-32 ───────────────────────────────────────────────────────────────────

const CRC_TABLE = ((): Uint32Array => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()

function crc32(data: Buffer): number {
  let crc = 0xffffffff
  for (let i = 0; i < data.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ data[i]) & 0xff]
  }
  return (crc ^ 0xffffffff) >>> 0
}

// ─── Write helpers ────────────────────────────────────────────────────────────

function u16(buf: Buffer, val: number, off: number) {
  buf[off]     = val & 0xff
  buf[off + 1] = (val >> 8) & 0xff
}

function u32(buf: Buffer, val: number, off: number) {
  buf[off]     =  val        & 0xff
  buf[off + 1] = (val >>  8) & 0xff
  buf[off + 2] = (val >> 16) & 0xff
  buf[off + 3] = (val >> 24) & 0xff
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function buildZip(entries: ZipEntry[]): Buffer {
  const localParts:   Buffer[] = []
  const centralParts: Buffer[] = []
  const offsets:      number[] = []
  let   offset = 0

  for (const entry of entries) {
    const name         = Buffer.from(entry.path, 'utf8')
    const uncompressed = Buffer.from(entry.content, 'utf8')
    const compressed   = deflateRawSync(uncompressed, { level: 6 })
    const crc          = crc32(uncompressed)

    // Local file header (30 bytes + filename)
    const local = Buffer.alloc(30 + name.length)
    u32(local, 0x04034b50, 0)          // signature
    u16(local, 20,         4)          // version needed
    u16(local, 0,          6)          // flags
    u16(local, 8,          8)          // compression: DEFLATE
    u32(local, 0,          10)         // mod time/date (zero)
    u32(local, crc,        14)         // CRC-32
    u32(local, compressed.length,   18) // compressed size
    u32(local, uncompressed.length, 22) // uncompressed size
    u16(local, name.length, 26)        // filename length
    u16(local, 0,          28)         // extra field length
    name.copy(local, 30)

    offsets.push(offset)
    localParts.push(local, compressed)
    offset += local.length + compressed.length

    // Central directory entry (46 bytes + filename)
    const cd = Buffer.alloc(46 + name.length)
    u32(cd, 0x02014b50, 0)          // signature
    u16(cd, 20,         4)          // version made by
    u16(cd, 20,         6)          // version needed
    u16(cd, 0,          8)          // flags
    u16(cd, 8,          10)         // compression: DEFLATE
    u32(cd, 0,          12)         // mod time/date
    u32(cd, crc,        16)         // CRC-32
    u32(cd, compressed.length,   20) // compressed size
    u32(cd, uncompressed.length, 24) // uncompressed size
    u16(cd, name.length, 28)        // filename length
    u16(cd, 0,          30)         // extra field length
    u16(cd, 0,          32)         // comment length
    u16(cd, 0,          34)         // disk number start
    u16(cd, 0,          36)         // internal attrs
    u32(cd, 0,          38)         // external attrs
    u32(cd, offsets[offsets.length - 1], 42) // local header offset
    name.copy(cd, 46)
    centralParts.push(cd)
  }

  const cdBuffer = Buffer.concat(centralParts)
  const cdOffset = offset

  // End of central directory (22 bytes)
  const eocd = Buffer.alloc(22)
  u32(eocd, 0x06054b50,        0)  // signature
  u16(eocd, 0,                 4)  // disk number
  u16(eocd, 0,                 6)  // disk with cd start
  u16(eocd, entries.length,    8)  // entries on disk
  u16(eocd, entries.length,   10)  // total entries
  u32(eocd, cdBuffer.length,  12)  // central dir size
  u32(eocd, cdOffset,         16)  // central dir offset
  u16(eocd, 0,                20)  // comment length

  return Buffer.concat([...localParts, cdBuffer, eocd])
}
