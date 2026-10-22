import { randomBytes } from 'node:crypto'
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'

const allowed = ['image/', 'application/pdf', 'text/', 'application/zip', 'application/vnd', 'application/msword', 'application/octet-stream', 'video/']

export function dataDir() {
  return process.env.PORTAL_DATA || path.join(process.cwd(), '.data')
}

export function detectMime(buf: Buffer, filename: string): string {
  const lower = filename.toLowerCase()
  if (lower.endsWith('.svg')) return 'application/octet-stream'
  if (buf.length >= 5 && buf.subarray(0, 5).toString('latin1') === '%PDF-') return 'application/pdf'
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png'
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg'
  if (buf.length >= 6 && (buf.subarray(0, 6).toString('latin1') === 'GIF87a' || buf.subarray(0, 6).toString('latin1') === 'GIF89a')) return 'image/gif'
  if (buf.length >= 12 && buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp'
  if (buf.length >= 2 && buf[0] === 0x50 && buf[1] === 0x4b) return 'application/zip'
  const sample = buf.subarray(0, Math.min(buf.length, 512))
  if (sample.length && !sample.includes(0)) {
    const text = sample.toString('utf8')
    if (!text.includes('\uFFFD')) return 'text/plain'
  }
  return 'application/octet-stream'
}

export function mimeAllowed(mime: string) {
  return allowed.some((p) => mime.startsWith(p))
}

function safeExt(filename: string) {
  const ext = path.extname(filename).toLowerCase().replace(/[^a-z0-9.]/g, '')
  return ext.length > 1 && ext.length <= 8 ? ext : ''
}

export async function storeBytes(buf: Buffer, filename: string, mime: string): Promise<{ path: string; size: number }> {
  const name = randomBytes(16).toString('hex') + safeExt(filename)
  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (token) {
    const { put } = await import('@vercel/blob')
    const blob = await put(`files/${name}`, buf, { access: 'private', token, contentType: mime, addRandomSuffix: false })
    return { path: 'blob:' + blob.pathname, size: buf.length }
  }
  const dir = path.join(dataDir(), 'files')
  await mkdir(dir, { recursive: true })
  await writeFile(path.join(dir, name), buf)
  return { path: name, size: buf.length }
}

export function isSafeBlobPath(pathname: string) {
  return !!pathname && !pathname.includes('..') && !pathname.startsWith('/') && /^[a-zA-Z0-9._/-]+$/.test(pathname)
}

export async function readStored(stored: string): Promise<Buffer | null> {
  if (!stored) return null
  if (stored.startsWith('blob:')) {
    const token = process.env.BLOB_READ_WRITE_TOKEN
    if (!token) return null
    const pathname = stored.slice(5)
    if (!isSafeBlobPath(pathname)) return null
    const { get } = await import('@vercel/blob')
    const result = await get(pathname, { access: 'private', token })
    if (!result || result.statusCode !== 200 || !result.stream) return null
    const chunks: Buffer[] = []
    const reader = result.stream.getReader()
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(Buffer.from(value))
    }
    return Buffer.concat(chunks)
  }
  const base = path.basename(stored)
  if (!base || base !== stored) return null
  try {
    return await readFile(path.join(dataDir(), 'files', base))
  } catch {
    return null
  }
}

export async function deleteStored(stored: string) {
  if (!stored) return
  if (stored.startsWith('blob:')) {
    const token = process.env.BLOB_READ_WRITE_TOKEN
    const pathname = stored.slice(5)
    if (!token || !isSafeBlobPath(pathname)) return
    const { del } = await import('@vercel/blob')
    await del(pathname, { token }).catch(() => {})
    return
  }
  const base = path.basename(stored)
  if (base !== stored) return
  await unlink(path.join(dataDir(), 'files', base)).catch(() => {})
}
