/**
 * File storage abstraction.
 *
 * Phase 1 (local dev): saves to /tmp and returns a local path
 * Phase 2 (production): uploads to Cloudflare R2 or AWS S3
 *
 * Set STORAGE_PROVIDER=r2 and R2_* env vars for production.
 */
import fs from 'fs/promises'
import path from 'path'

export async function uploadToStorage(
  fileName: string,
  data: Buffer,
  contentType: string
): Promise<string> {
  if (process.env.STORAGE_PROVIDER === 'r2') {
    return uploadToR2(fileName, data, contentType)
  }

  // Local dev: save to temp directory
  const tmpDir = path.join(process.cwd(), 'tmp', 'uploads')
  await fs.mkdir(tmpDir, { recursive: true })

  const safeName = fileName.replace(/\//g, '_')
  const filePath = path.join(tmpDir, safeName)
  await fs.writeFile(filePath, data)

  const apiUrl = process.env.API_URL || 'http://localhost:3001'
  return `${apiUrl}/uploads/${safeName}`
}

async function uploadToR2(fileName: string, data: Buffer, contentType: string): Promise<string> {
  if (!process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY || !process.env.R2_BUCKET_NAME) {
    throw new Error('R2 credentials not configured')
  }

  const endpoint = `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
  const url = `${endpoint}/${process.env.R2_BUCKET_NAME}/${fileName}`

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(data.length),
      'Authorization': `Bearer ${process.env.R2_ACCESS_KEY_ID}`,
    },
    body: data,
  })

  if (!response.ok) {
    throw new Error(`R2 upload failed: ${response.status}`)
  }

  const publicUrl = process.env.R2_PUBLIC_URL
  return publicUrl ? `${publicUrl}/${fileName}` : url
}
