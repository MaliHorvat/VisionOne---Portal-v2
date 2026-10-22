import { readFileSync, existsSync } from 'node:fs'
import { ensureAdmin } from '../src/lib/handlers'
import { seedDemo } from '../src/lib/seed'

function loadEnv() {
  if (!existsSync('.env')) return
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i < 1) continue
    const k = t.slice(0, i)
    if (process.env[k]) continue
    let v = t.slice(i + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    process.env[k] = v
  }
}

loadEnv()

async function main() {
  const demo = process.argv.includes('--demo') || process.env.SEED_DEMO === '1'
  await ensureAdmin()
  if (demo) await seedDemo()
  console.log(demo ? 'Admin in demo podatki so pripravljeni (če je bila baza prazna).' : 'Admin uporabnik je pripravljen (admin / admin, obvezna menjava gesla).')
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e)
  process.exit(1)
})
