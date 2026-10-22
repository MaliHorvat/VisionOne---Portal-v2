import { decrypt, encrypt } from './crypto'
import { sql, tx, nowIso, type Sql } from './db'
import { assertIdent, assertOrder, type Col, type Resource } from './resources'

export type Row = Record<string, unknown> & { id: number }

function num(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

export function shapeRow(res: Resource, row: Record<string, unknown>): Row {
  const types: Record<string, string> = {}
  for (const c of res.cols) types[c.name] = c.type
  const out: Row = { id: Number(row.id) }
  for (const [k, v] of Object.entries(row)) {
    if (k === 'id') continue
    const t = types[k]
    if (t === 'json') {
      if (v == null || v === '') out[k] = null
      else if (typeof v === 'string') {
        try { out[k] = JSON.parse(v) } catch { out[k] = v }
      } else out[k] = v
    } else if (t === 'secret') {
      const s = v == null ? '' : String(v)
      out[k] = ''
      out['has_' + k] = s !== ''
    } else if (t === 'int' || t === 'real') {
      out[k] = num(v)
    } else if (typeof v === 'bigint') {
      out[k] = Number(v)
    } else {
      out[k] = v ?? null
    }
  }
  return out
}

function colValue(c: Col, v: unknown): unknown {
  if (c.type === 'json') {
    if (v == null) return null
    if (typeof v === 'string' && (v.startsWith('[') || v.startsWith('{'))) return v
    return JSON.stringify(v)
  }
  if (c.type === 'secret') {
    if (v == null) return encrypt('')
    return encrypt(String(v))
  }
  if (c.type === 'int') {
    if (typeof v === 'boolean') return v ? 1 : 0
    if (v == null || v === '') return null
    const n = Number(v)
    return Number.isFinite(n) ? Math.trunc(n) : null
  }
  if (c.type === 'real') {
    if (v == null || v === '') return null
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  if (v == null) return null
  return v
}

function quoteOrder(order: string) {
  assertOrder(order)
  return order.split(',').map((part) => {
    const bits = part.trim().split(/\s+/)
    const col = bits[0] ?? ''
    assertIdent(col)
    const dir = (bits[1] ?? '').toUpperCase()
    return '`' + col + '`' + (dir === 'DESC' || dir === 'ASC' ? ' ' + dir : '')
  }).join(', ')
}

export async function listRows(res: Resource, filters: Record<string, unknown>, q: string, limit: number, db: Sql = sql()): Promise<Row[]> {
  assertIdent(res.table)
  const order = quoteOrder(res.order)
  const where = ['1=1']
  const args: unknown[] = []
  for (const [k, v] of Object.entries(filters)) {
    assertIdent(k)
    where.push('`' + k + '` = ?')
    args.push(v)
  }
  if (q && res.search.length) {
    const ors = res.search.map((s) => {
      assertIdent(s)
      args.push('%' + q.toLowerCase() + '%')
      return `LOWER(COALESCE(\`${s}\`,'')) LIKE ?`
    })
    where.push('(' + ors.join(' OR ') + ')')
  }
  const lim = Math.min(Math.max(limit || 1000, 1), 1000000)
  const rows = await db.q<Record<string, unknown>>(
    `SELECT * FROM \`${res.table}\` WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT ${lim}`,
    ...args,
  )
  return rows.map((r) => shapeRow(res, r))
}

export async function getRow(res: Resource, id: number, db: Sql = sql()): Promise<Row | null> {
  assertIdent(res.table)
  const rows = await db.q<Record<string, unknown>>(`SELECT * FROM \`${res.table}\` WHERE id = ?`, id)
  if (!rows.length) return null
  return shapeRow(res, rows[0])
}

export async function rawField(table: string, field: string, id: number, db: Sql = sql()): Promise<string> {
  assertIdent(table)
  assertIdent(field)
  const rows = await db.q<Record<string, unknown>>(`SELECT \`${field}\` AS v FROM \`${table}\` WHERE id = ?`, id)
  const v = rows[0]?.v
  return v == null ? '' : String(v)
}

export async function saveRow(res: Resource, id: number, data: Record<string, unknown>, db: Sql = sql()): Promise<number> {
  assertIdent(res.table)
  const names: string[] = []
  const vals: unknown[] = []
  for (const c of res.cols) {
    if (!(c.name in data)) continue
    if (c.type === 'secret') {
      const s = data[c.name] == null ? '' : String(data[c.name])
      if (s === '' && data['clear_' + c.name] !== true) continue
    }
    assertIdent(c.name)
    names.push(c.name)
    vals.push(colValue(c, data[c.name]))
  }
  const ts = nowIso()
  if (!id) {
    names.push('created_at', 'updated_at')
    vals.push(ts, ts)
    const ph = names.map(() => '?').join(',')
    const cols = names.map((n) => '`' + n + '`').join(',')
    const insert = async (runner: Sql) => {
      await runner.exec(`INSERT INTO \`${res.table}\` (${cols}) VALUES (${ph})`, ...vals)
      const idRows = await runner.q<{ id: number }>('SELECT LAST_INSERT_ID() AS id')
      return Number(idRows[0]?.id ?? 0)
    }
    if (db.inTx) return insert(db)
    return tx(insert)
  }
  const sets = ['`updated_at` = ?']
  const args: unknown[] = [ts]
  names.forEach((n, i) => {
    sets.push('`' + n + '` = ?')
    args.push(vals[i])
  })
  args.push(id)
  await db.exec(`UPDATE \`${res.table}\` SET ${sets.join(', ')} WHERE id = ?`, ...args)
  return id
}

export async function nextNumber(db: Sql, series: string): Promise<number> {
  await db.exec('INSERT INTO counters (name, n) VALUES (?, 0) ON DUPLICATE KEY UPDATE name = name', series)
  const locked = await db.q<{ n: number }>('SELECT n FROM counters WHERE name = ? FOR UPDATE', series)
  const n = Number(locked[0]?.n ?? 0) + 1
  await db.exec('UPDATE counters SET n = ? WHERE name = ?', n, series)
  return n
}

export async function setting(k: string, db: Sql = sql()): Promise<string> {
  const rows = await db.q<{ v: string | null }>('SELECT v FROM settings WHERE k = ?', k)
  return rows[0]?.v ?? ''
}

export async function settings(db: Sql = sql()): Promise<Record<string, string>> {
  const rows = await db.q<{ k: string; v: string | null }>('SELECT k, v FROM settings')
  const out: Record<string, string> = {}
  for (const r of rows) out[r.k] = r.v ?? ''
  return out
}

export async function saveSettings(m: Record<string, string>, db: Sql = sql()) {
  for (const [k, v] of Object.entries(m)) {
    if (typeof k !== 'string' || k.length > 191) continue
    await db.exec('INSERT INTO settings (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)', k, v ?? '')
  }
}

export async function audit(user: string, action: string, ref: string, db: Sql = sql()) {
  await db.exec('INSERT INTO audit (at, user, action, ref) VALUES (?, ?, ?, ?)', nowIso(), user, action, ref)
}

export async function countTable(table: string, db: Sql = sql()): Promise<number> {
  assertIdent(table)
  const rows = await db.q<{ n: number }>(`SELECT COUNT(*) AS n FROM \`${table}\``)
  return Number(rows[0]?.n ?? 0)
}

export { decrypt }
