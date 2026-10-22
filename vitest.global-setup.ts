import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'

export default function setup() {
  const args = ['--protocol=TCP', '-h127.0.0.1', '-P3306', '-uportal', '-pportal']
  execFileSync('mysql', [
    ...args,
    '-e',
    'DROP DATABASE IF EXISTS portal_test; CREATE DATABASE portal_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;',
  ], { stdio: 'inherit' })
  const sql = readFileSync(path.join(process.cwd(), 'sql/schema.sql'), 'utf8')
  execFileSync('mysql', [...args, 'portal_test'], { input: sql, stdio: ['pipe', 'inherit', 'inherit'] })
}
