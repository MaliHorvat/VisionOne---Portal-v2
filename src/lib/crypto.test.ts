import { describe, expect, it } from 'vitest'
import { decrypt, encrypt } from './crypto'

describe('crypto', () => {
  it('roundtrips AES-GCM without leaking plaintext', () => {
    const e = encrypt('tajno')
    expect(e.startsWith('enc:')).toBe(true)
    expect(e.includes('tajno')).toBe(false)
    expect(decrypt(e)).toBe('tajno')
  })
})
