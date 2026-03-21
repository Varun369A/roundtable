/**
 * File storage abstraction.
 *
 * Phase 1 (local dev): saves to /tmp and returns a local path
 * Phase 2 (production): uploads to Cloudflare R2 via AWS Signature V4
 *
 * Set STORAGE_PROVIDER=r2 and R2_* env vars for production.
 */
import fs from 'fs/promises'
import path from 'path'
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

function getS3Client(): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    },
  })
}

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

  const s3 = getS3Client()

  await s3.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: fileName,
    Body: data,
    ContentType: contentType,
    ContentLength: data.length,
  }))

  const publicUrl = process.env.R2_PUBLIC_URL
  const endpoint = `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
  const url = `${endpoint}/${process.env.R2_BUCKET_NAME}/${fileName}`
  return publicUrl ? `${publicUrl}/${fileName}` : url
}

export async function getFileUrl(fileName: string, expiresInSeconds = 3600): Promise<string> {
  if (process.env.STORAGE_PROVIDER !== 'r2') {
    const apiUrl = process.env.API_URL || 'http://localhost:3001'
    const safeName = fileName.replace(/\//g, '_')
    return `${apiUrl}/uploads/${safeName}`
  }

  if (!process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY || !process.env.R2_BUCKET_NAME) {
    throw new Error('R2 credentials not configured')
  }

  // If public URL is configured, return it directly without signing
  if (process.env.R2_PUBLIC_URL) {
    return `${process.env.R2_PUBLIC_URL}/${fileName}`
  }

  const s3 = getS3Client()
  const command = new GetObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: fileName,
  })

  return getSignedUrl(s3, command, { expiresIn: expiresInSeconds })
}

export async function deleteFile(fileName: string): Promise<void> {
  if (process.env.STORAGE_PROVIDER !== 'r2') {
    const safeName = fileName.replace(/\//g, '_')
    const filePath = path.join(process.cwd(), 'tmp', 'uploads', safeName)
    await fs.unlink(filePath).catch(() => {})
    return
  }

  if (!process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY || !process.env.R2_BUCKET_NAME) {
    throw new Error('R2 credentials not configured')
  }

  const s3 = getS3Client()
  await s3.send(new DeleteObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: fileName,
  }))
}
