import bcrypt from 'bcryptjs'

export type User = {
  id: number
  username: string
  name: string
  role: string
  must_change: boolean
}

export function hashPassword(password: string) {
  return bcrypt.hash(password, 10)
}

export function checkPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash)
}

let dummyHash: Promise<string> | null = null
export function dummyPasswordHash() {
  dummyHash ??= hashPassword('invalid-password-placeholder')
  return dummyHash
}
