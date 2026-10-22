import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

function keyBytes(): Buffer {
  const raw = process.env.ENCRYPTION_KEY ?? ''
  if (!raw) throw new Error('ENCRYPTION_KEY missing')
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex')
  const buf = Buffer.from(raw, 'base64')
  if (buf.length === 32) return buf
  throw new Error('ENCRYPTION_KEY must be 32 bytes (64 hex chars or base64)')
}

export function encrypt(s: string): string {
  if (!s) return ''
  const key = keyBytes()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const enc = Buffer.concat([cipher.update(s, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return 'enc:' + Buffer.concat([iv, enc, tag]).toString('base64')
}

export function decrypt(s: string): string {
  if (!s) return ''
  if (!s.startsWith('enc:')) return s
  const raw = Buffer.from(s.slice(4), 'base64')
  if (raw.length < 12 + 16) throw new Error('short')
  const key = keyBytes()
  const iv = raw.subarray(0, 12)
  const tag = raw.subarray(raw.length - 16)
  const data = raw.subarray(12, raw.length - 16)
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}

function authSecret(): string {
  const s = process.env.AUTH_SECRET ?? ''
  if (!s) throw new Error('AUTH_SECRET missing')
  return s
}

export function signToken(token: string): string {
  return createHmac('sha256', authSecret()).update(token).digest('hex')
}

export function sealSession(token: string): string {
  return `${token}.${signToken(token)}`
}

export function openSession(cookieValue: string): string | null {
  const i = cookieValue.lastIndexOf('.')
  if (i <= 0) return null
  const token = cookieValue.slice(0, i)
  const sig = cookieValue.slice(i + 1)
  const expect = signToken(token)
  const a = Buffer.from(sig)
  const b = Buffer.from(expect)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  return token
}
