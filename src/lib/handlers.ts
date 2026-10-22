import { checkPassword, dummyPasswordHash, hashPassword, type User } from './auth'
import { openSession, sealSession } from './crypto'
import { addDays, nowIso, sql, todayIso, tx } from './db'
import { deleteStored, detectMime, isSafeBlobPath, mimeAllowed, readStored, storeBytes } from './files'
import { cents, computeTotals, eur, parseLines } from './money'
import { buildUpn, renderPdf, upnPng } from './pdf'
import { audit, countTable, getRow, listRows, nextNumber, rawField, saveRow, saveSettings, setting, settings, shapeRow, type Row } from './repo'
import { childTables, lockedInvoiceFields, parentKey, resources, type Resource } from './resources'
import { invoiceReference } from './upn'

export class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

const COOKIE = 'portal_session'

function json(status: number, body: unknown, extra?: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...extra },
  })
}

function fail(status: number, error: string) {
  return json(status, { error })
}

function binaryBody(data: Uint8Array): BodyInit {
  const copy = new Uint8Array(data.byteLength)
  copy.set(data)
  return copy
}

function cookieValue(req: Request) {
  const raw = req.headers.get('cookie') ?? ''
  const m = raw.match(/(?:^|;\s*)portal_session=([^;]+)/)
  return m ? decodeURIComponent(m[1]) : ''
}

function sessionCookie(token: string, req: Request, maxAge: number) {
  const value = token ? sealSession(token) : ''
  const proto = req.headers.get('x-forwarded-proto') ?? new URL(req.url).protocol.replace(':', '')
  const parts = [`${COOKIE}=${value}`, 'Path=/', 'HttpOnly', 'SameSite=Strict', `Max-Age=${maxAge}`]
  if (proto === 'https' && token) parts.push('Secure')
  return parts.join('; ')
}

function clientIp(req: Request) {
  const xf = req.headers.get('x-forwarded-for')
  if (xf) return xf.split(',')[0]!.trim().slice(0, 64) || 'local'
  return 'local'
}

function numId(v: string | undefined) {
  const n = Number(v)
  return Number.isFinite(n) ? Math.trunc(n) : 0
}

async function readJson(req: Request): Promise<Record<string, unknown>> {
  const len = Number(req.headers.get('content-length') ?? 0)
  if (len > 20 * 1024 * 1024) throw new HttpError(413, 'body too large')
  const text = await req.text()
  if (!text || text === 'null') return {}
  let v: unknown
  try { v = JSON.parse(text) } catch { throw new HttpError(400, 'invalid json') }
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {}
  return v as Record<string, unknown>
}

let booted = false
export function resetBoot() { booted = false }

export async function ensureAdmin() {
  if (await countTable('users') === 0) {
    const hash = await hashPassword('admin')
    try {
      await sql().exec(
        "INSERT INTO users (username, name, hash, role, must_change, created_at) VALUES ('admin','Administrator',?,'admin',1,?)",
        hash, nowIso(),
      )
    } catch { /* vzporedni zagon */ }
  }
  booted = true
}

async function boot() {
  if (!booted) await ensureAdmin()
}

function toUser(r: { id: number; username: string; name?: string | null; role: string; must_change: number }): User {
  return {
    id: Number(r.id),
    username: r.username,
    name: r.name ?? '',
    role: r.role,
    must_change: Number(r.must_change) !== 0,
  }
}

async function currentUser(req: Request): Promise<User | null> {
  const raw = cookieValue(req)
  if (!raw) return null
  const token = openSession(raw)
  if (!token) return null
  const rows = await sql().q<{ id: number; username: string; name: string | null; role: string; must_change: number; expires: string }>(
    `SELECT u.id, u.username, COALESCE(u.name,'') AS name, u.role, u.must_change, s.expires
     FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?`,
    token,
  )
  const row = rows[0]
  if (!row) return null
  if (new Date(row.expires).getTime() < Date.now()) return null
  return toUser(row)
}

async function requireUser(req: Request, admin = false): Promise<User> {
  const u = await currentUser(req)
  if (!u) throw new HttpError(401, 'unauthorized')
  const path = new URL(req.url).pathname
  if (u.must_change && path !== '/api/password' && path !== '/api/me') throw new HttpError(403, 'password change required')
  if (req.method !== 'GET' && req.method !== 'HEAD' && u.role === 'viewer' && path !== '/api/password') throw new HttpError(403, 'read-only user')
  if (admin && u.role !== 'admin') throw new HttpError(403, 'admin only')
  return u
}

function resOf(name: string): Resource {
  const r = resources[name]
  if (!r) throw new HttpError(404, 'unknown resource')
  return r
}

async function userById(id: number): Promise<User> {
  const rows = await sql().q<{ id: number; username: string; name: string | null; role: string; must_change: number }>(
    'SELECT id, username, name, role, must_change FROM users WHERE id = ?', id,
  )
  if (!rows[0]) throw new HttpError(404, 'not found')
  return toUser(rows[0])
}

async function login(req: Request) {
  const ip = clientIp(req)
  const cutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString()
  await sql().exec('DELETE FROM login_attempts WHERE at < ?', new Date(Date.now() - 24 * 3600 * 1000).toISOString())
  const recent = await sql().q('SELECT id FROM login_attempts WHERE ip = ? AND at > ?', ip, cutoff)
  if (recent.length >= 10) return fail(429, 'too many attempts')
  const body = await readJson(req)
  const username = String(body.username ?? '').trim()
  const password = String(body.password ?? '')
  const rows = await sql().q<{ id: number; hash: string }>('SELECT id, hash FROM users WHERE username = ?', username)
  const hash = rows[0]?.hash ?? await dummyPasswordHash()
  const ok = rows[0] ? await checkPassword(password, hash) : false
  if (!rows[0] || !ok) {
    await sql().exec('INSERT INTO login_attempts (ip, at) VALUES (?, ?)', ip, nowIso())
    return fail(401, 'invalid credentials')
  }
  const token = (await import('node:crypto')).randomBytes(32).toString('hex')
  const exp = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString()
  await sql().exec('INSERT INTO sessions (token, user_id, expires) VALUES (?, ?, ?)', token, rows[0].id, exp)
  const user = await userById(rows[0].id)
  return json(200, user, { 'Set-Cookie': sessionCookie(token, req, 30 * 24 * 3600) })
}

async function changePassword(req: Request, u: User) {
  const body = await readJson(req)
  const old = String(body.old ?? body.Old ?? '')
  const next = String(body.new ?? body.New ?? '')
  const rows = await sql().q<{ hash: string }>('SELECT hash FROM users WHERE id = ?', u.id)
  if (!rows[0] || !(await checkPassword(old, rows[0].hash))) return fail(400, 'wrong password')
  if (next.length < 8 || next === 'admin') return fail(400, 'password too short (min 8)')
  const hash = await hashPassword(next)
  await sql().exec('UPDATE users SET hash = ?, must_change = 0 WHERE id = ?', hash, u.id)
  return json(200, await userById(u.id))
}

async function listUsers() {
  const rows = await sql().q<{ id: number; username: string; name: string | null; role: string; must_change: number }>(
    'SELECT id, username, COALESCE(name,\'\') AS name, role, must_change FROM users ORDER BY username',
  )
  return json(200, rows.map(toUser))
}

async function saveUser(req: Request) {
  const body = await readJson(req)
  let role = String(body.role ?? 'tech')
  if (role !== 'admin' && role !== 'tech' && role !== 'viewer') role = 'tech'
  const name = String(body.name ?? '')
  const id = Number(body.id ?? 0) || 0
  if (!id) {
    const username = String(body.username ?? '')
    const password = String(body.password ?? '')
    if (!username || password.length < 8) return fail(400, 'username and password (min 8) required')
    const hash = await hashPassword(password)
    try {
      await sql().exec(
        'INSERT INTO users (username, name, hash, role, must_change, created_at) VALUES (?, ?, ?, ?, 1, ?)',
        username, name, hash, role, nowIso(),
      )
    } catch (e) {
      return fail(400, e instanceof Error ? e.message : 'error')
    }
  } else {
    await sql().exec('UPDATE users SET name = ?, role = ? WHERE id = ?', name, role, id)
    const password = String(body.password ?? '')
    if (password) {
      const hash = await hashPassword(password)
      await sql().exec('UPDATE users SET hash = ?, must_change = 1 WHERE id = ?', hash, id)
    }
  }
  return listUsers()
}

function filtersOf(res: Resource, url: URL) {
  const f: Record<string, unknown> = {}
  for (const p of res.parents) {
    const v = url.searchParams.get(p)
    if (v) f[p] = v
  }
  for (const k of ['status', 'kind', 'type']) {
    const v = url.searchParams.get(k)
    if (v && res.cols.some((c) => c.name === k)) f[k] = v
  }
  return f
}

async function prepareDoc(res: Resource, id: number, data: Record<string, unknown>) {
  if (res.table === 'invoices' && id) {
    const old = await getRow(res, id)
    if (old && old.issued_at) {
      for (const k of Object.keys(data)) if (lockedInvoiceFields.has(k)) delete data[k]
      return
    }
  }
  if (res.table === 'quotes' || res.table === 'invoices') {
    delete data.number
    delete data.issued_at
    if (!id) {
      if (!('status' in data)) data.status = 'draft'
      if (!('date' in data)) data.date = todayIso()
    }
    if ('lines' in data) {
      let disc = Number(data.discount_pct) || 0
      if (!('discount_pct' in data) && id) {
        const old = await getRow(res, id)
        disc = Number(old?.discount_pct) || 0
      }
      const t = computeTotals(parseLines(data.lines), disc)
      data.lines = t.lines
      data.net = t.net
      data.vat = t.vat
      data.total = t.total
    }
    if (res.table === 'quotes' && !id) {
      const y = new Date().getFullYear()
      const n = await tx((t) => nextNumber(t, `quote-${y}`))
      data.number = `P-${y}-${String(n).padStart(4, '0')}`
    }
  }
  if (res.table === 'workorders') {
    if (!id && !('status' in data)) data.status = 'planned'
    if (typeof data.signature === 'string' && data.signature) data.signed_at = nowIso()
  }
}

async function removeDocumentFiles(whereSql: string, arg: number) {
  const rows = await sql().q<{ path: string | null }>(`SELECT path FROM documents WHERE ${whereSql}`, arg)
  for (const r of rows) if (r.path) await deleteStored(r.path)
}

async function quoteToInvoice(id: number) {
  const q = await getRow(resources.quotes, id)
  if (!q) return fail(404, 'not found')
  if (q.invoice_id) return fail(409, 'quote already converted')
  let days = 15
  const configured = Number(await setting('payment_days'))
  if (configured > 0) days = configured
  const cust = await sql().q<{ payment_days: number | null }>('SELECT payment_days FROM customers WHERE id = ?', q.customer_id)
  if (cust[0]?.payment_days && Number(cust[0].payment_days) > 0) days = Number(cust[0].payment_days)
  const today = todayIso()
  const disc = Number(q.discount_pct) || 0
  const t = computeTotals(parseLines(q.lines), disc)
  const newId = await saveRow(resources.invoices, 0, {
    customer_id: q.customer_id, site_id: q.site_id, quote_id: q.id, title: q.title,
    date: today, service_date: today, due_date: addDays(today, days), status: 'draft',
    lines: t.lines, discount_pct: disc, net: t.net, vat: t.vat, total: t.total, notes: q.notes, paid_amount: 0,
  })
  const n = await sql().exec(
    'UPDATE quotes SET invoice_id = ?, status = \'accepted\', updated_at = ? WHERE id = ? AND (invoice_id IS NULL OR invoice_id = 0)',
    newId, nowIso(), id,
  )
  if (!n) {
    await sql().exec('DELETE FROM invoices WHERE id = ?', newId)
    return fail(409, 'quote already converted')
  }
  return json(200, await getRow(resources.invoices, newId))
}

async function issueInvoice(id: number, user: User) {
  const prefix = await setting('invoice_prefix')
  const result = await tx(async (t) => {
    const rows = await t.q<{ issued_at: string | null; date: string | null; lines: string | null }>(
      'SELECT issued_at, `date`, `lines` FROM invoices WHERE id = ? FOR UPDATE', id,
    )
    if (!rows[0]) throw new HttpError(404, 'not found')
    if (rows[0].issued_at) throw new HttpError(409, 'already issued')
    if (!parseLines(rows[0].lines).length) throw new HttpError(400, 'invoice has no lines')
    const m = /^(\d{4})-/.exec(rows[0].date ?? '')
    const year = m ? Number(m[1]) : new Date().getFullYear()
    const n = await nextNumber(t, `invoice-${year}`)
    const num = `${prefix}${year}-${String(n).padStart(4, '0')}`
    await t.exec(
      'UPDATE invoices SET number = ?, issued_at = ?, status = \'issued\', reference = ?, updated_at = ? WHERE id = ?',
      num, nowIso(), invoiceReference(num), nowIso(), id,
    )
    return num
  })
  await audit(user.username, 'issue', result)
  return json(200, await getRow(resources.invoices, id))
}

async function payInvoice(req: Request, id: number, user: User) {
  const body = await readJson(req)
  const inv = await getRow(resources.invoices, id)
  if (!inv) return fail(404, 'not found')
  if (!inv.issued_at) return fail(400, 'issue the invoice first')
  const total = Number(inv.total) || 0
  const already = Number(inv.paid_amount) || 0
  let amount = Number(body.amount ?? body.Amount)
  if (!(amount > 0)) amount = eur(cents(total - already))
  let date = String(body.date ?? body.Date ?? '')
  if (!date) date = todayIso()
  const method = String(body.method ?? body.Method ?? '')
  const paid = eur(cents(already + amount))
  const st = cents(paid) >= cents(total) ? 'paid' : 'partial'
  await sql().exec(
    'UPDATE invoices SET paid_amount = ?, paid_date = ?, payment_method = ?, status = ?, updated_at = ? WHERE id = ?',
    paid, date, method, st, nowIso(), id,
  )
  await audit(user.username, 'pay', String(inv.number ?? ''))
  return json(200, await getRow(resources.invoices, id))
}

async function stornoInvoice(id: number, user: User) {
  const inv = await getRow(resources.invoices, id)
  if (!inv || !inv.issued_at) return fail(400, 'only issued invoices can be cancelled')
  if (inv.status === 'cancelled') return fail(409, 'already cancelled')
  const lines = parseLines(inv.lines).map((l) => ({ ...l, qty: -l.qty }))
  const disc = Number(inv.discount_pct) || 0
  const t = computeTotals(lines, disc)
  const today = todayIso()
  const newId = await saveRow(resources.invoices, 0, {
    customer_id: inv.customer_id, site_id: inv.site_id,
    title: `Storno računa ${inv.number}`,
    date: today, service_date: inv.service_date, due_date: today, status: 'draft',
    lines: t.lines, discount_pct: disc, net: t.net, vat: t.vat, total: t.total,
    notes: `Dobropis / storno računa št. ${inv.number} z dne ${inv.date}.`,
    paid_amount: 0,
  })
  await sql().exec("UPDATE invoices SET status = 'cancelled', updated_at = ? WHERE id = ?", nowIso(), id)
  await audit(user.username, 'storno', String(inv.number ?? ''))
  return json(200, await getRow(resources.invoices, newId))
}

async function customerOf(id: unknown) {
  const n = Number(id)
  if (!n) return null
  return getRow(resources.customers, n)
}

async function pdfResponse(kind: 'quotes' | 'invoices', id: number) {
  const res = resources[kind]
  const docRow = await getRow(res, id)
  if (!docRow) return fail(404, 'not found')
  const s = await settings()
  const customer = await customerOf(docRow.customer_id)
  let logo: { bytes: Uint8Array; mime: string } | null = null
  const logoId = Number(s.logo_id)
  if (logoId) {
    const d = await getRow(resources.documents, logoId)
    if (d?.path) {
      const bytes = await readStored(String(d.path))
      if (bytes) logo = { bytes, mime: String(d.mime ?? '') }
    }
  }
  const bytes = await renderPdf({ kind, docRow, settings: s, customer, logo })
  const name = (kind === 'quotes' ? 'ponudba' : 'racun') + '-' + String(docRow.number || 'osnutek').replaceAll('/', '-') + '.pdf'
  return new Response(binaryBody(bytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${name}"`,
    },
  })
}

async function upload(req: Request) {
  const ctype = req.headers.get('content-type') ?? ''
  if (ctype.includes('application/json')) {
    const body = await readJson(req)
    const blobPath = String(body.blobPath ?? '')
    if (!isSafeBlobPath(blobPath)) return fail(400, 'invalid blob')
    const data: Record<string, unknown> = {
      filename: String(body.filename ?? 'file'),
      mime: String(body.mime ?? 'application/octet-stream'),
      size: Number(body.size) || 0,
      path: 'blob:' + blobPath,
      kind: String(body.kind ?? ''),
      title: String(body.title ?? body.filename ?? 'file'),
    }
    for (const k of ['customer_id', 'site_id', 'workorder_id']) if (body[k]) data[k] = body[k]
    const id = await saveRow(resources.documents, 0, data)
    return json(200, await getRow(resources.documents, id))
  }
  const len = Number(req.headers.get('content-length') ?? 0)
  if (len > 100 * 1024 * 1024) return fail(413, 'file too large')
  const form = await req.formData()
  const file = form.get('file')
  if (!(file instanceof File)) return fail(400, 'file required')
  const buf = Buffer.from(await file.arrayBuffer())
  if (buf.length > 100 * 1024 * 1024) return fail(413, 'file too large')
  const mime = detectMime(buf, file.name)
  if (!mimeAllowed(mime)) return fail(400, 'file type not allowed: ' + mime)
  const stored = await storeBytes(buf, file.name, mime)
  const data: Record<string, unknown> = {
    filename: file.name.split(/[/\\]/).pop(),
    mime, size: stored.size, path: stored.path,
    kind: String(form.get('kind') ?? ''),
    title: String(form.get('title') || file.name),
  }
  for (const k of ['customer_id', 'site_id', 'workorder_id']) {
    const v = form.get(k)
    if (typeof v === 'string' && v) data[k] = v
  }
  const id = await saveRow(resources.documents, 0, data)
  return json(200, await getRow(resources.documents, id))
}

async function serveFile(id: number, url: URL) {
  const d = await getRow(resources.documents, id)
  if (!d) return fail(404, 'not found')
  const bytes = await readStored(String(d.path ?? ''))
  if (!bytes) return fail(404, 'not found')
  const mime = String(d.mime ?? 'application/octet-stream')
  const inline = (mime.startsWith('image/') || mime === 'application/pdf' || mime.startsWith('video/')) && url.searchParams.get('dl') !== '1'
  const disp = inline ? 'inline' : 'attachment'
  return new Response(binaryBody(bytes), {
    status: 200,
    headers: {
      'Content-Type': mime,
      'Content-Disposition': `${disp}; filename="${String(d.filename ?? 'file').replaceAll('"', '')}"`,
      'Content-Security-Policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; plugin-types application/pdf",
    },
  })
}

async function stockMove(req: Request) {
  const body = await readJson(req)
  const productId = Number(body.product_id) || 0
  const qty = Number(body.qty)
  if (!productId || !qty) return fail(400, 'product_id and qty required')
  const reason = String(body.reason ?? '')
  const ref = String(body.ref ?? '')
  try {
    await tx(async (t) => {
      const n = await t.exec('UPDATE products SET stock = COALESCE(stock,0) + ?, updated_at = ? WHERE id = ?', qty, nowIso(), productId)
      if (!n) throw new HttpError(404, 'product not found')
      await t.exec(
        'INSERT INTO stock_moves (product_id, qty, reason, ref, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        productId, qty, reason, ref, nowIso(), nowIso(),
      )
    })
  } catch (e) {
    if (e instanceof HttpError) return fail(e.status, e.message)
    throw e
  }
  return json(200, await getRow(resources.products, productId))
}

async function contractWorkorder(id: number, user: User) {
  const ct = await getRow(resources.contracts, id)
  if (!ct) return fail(404, 'not found')
  const next = /^\d{4}-\d{2}-\d{2}$/.test(String(ct.next_date ?? '')) ? String(ct.next_date) : todayIso()
  const start = `${next}T09:00`
  const end = `${next}T11:00`
  const newId = await saveRow(resources.workorders, 0, {
    customer_id: ct.customer_id, site_id: ct.site_id, contract_id: ct.id,
    title: `Redni servis: ${ct.title ?? ''}`, type: 'maintenance', status: 'planned', priority: 'normal',
    start, end, checklist: ct.checklist, technician: user.name,
  })
  let iv = 12
  const months = Number(ct.interval_months)
  if (months > 0) iv = months
  const [y, m, d] = next.split('-').map(Number)
  const shifted = new Date(Date.UTC(y, m - 1 + iv, d))
  await sql().exec('UPDATE contracts SET next_date = ?, updated_at = ? WHERE id = ?', shifted.toISOString().slice(0, 10), nowIso(), id)
  return json(200, await getRow(resources.workorders, newId))
}

async function queryShaped(res: Resource, query: string, ...args: unknown[]) {
  const rows = await sql().q<Record<string, unknown>>(query, ...args)
  return rows.map((r) => shapeRow(res, r))
}

async function dashboard() {
  const today = todayIso()
  const cn = "COALESCE(NULLIF(c.company,''), c.name, '') AS customer_name"
  const open_quotes = await queryShaped(resources.quotes, `SELECT q.*, ${cn} FROM quotes q LEFT JOIN customers c ON c.id=q.customer_id WHERE q.status IN ('draft','sent') ORDER BY q.id DESC LIMIT 10`)
  const unpaid_invoices = await queryShaped(resources.invoices, `SELECT i.*, ${cn} FROM invoices i LEFT JOIN customers c ON c.id=i.customer_id WHERE i.status IN ('issued','partial') ORDER BY i.due_date LIMIT 20`)
  const upcoming_visits = await queryShaped(resources.workorders, `SELECT w.*, ${cn} FROM workorders w LEFT JOIN customers c ON c.id=w.customer_id WHERE w.status NOT IN ('done','cancelled') ORDER BY w.start LIMIT 10`)
  const due_contracts = await queryShaped(resources.contracts, `SELECT k.*, ${cn} FROM contracts k LEFT JOIN customers c ON c.id=k.customer_id WHERE COALESCE(k.active,1)=1 AND k.next_date <= ? ORDER BY k.next_date LIMIT 10`, addDays(today, 30))
  const low_stock = await queryShaped(resources.products, "SELECT * FROM products WHERE kind='product' AND COALESCE(min_stock,0) > 0 AND COALESCE(stock,0) < min_stock ORDER BY name LIMIT 10")
  const warranty_expiring = await queryShaped(resources.equipment, 'SELECT * FROM equipment WHERE warranty_until BETWEEN ? AND ? ORDER BY warranty_until LIMIT 10', today, addDays(today, 60))
  const unpaid = await sql().q<{ n: number }>("SELECT COALESCE(SUM(total - COALESCE(paid_amount,0)),0) AS n FROM invoices WHERE status IN ('issued','partial')")
  const overdue = await sql().q<{ n: number }>("SELECT COALESCE(SUM(total - COALESCE(paid_amount,0)),0) AS n FROM invoices WHERE status IN ('issued','partial') AND due_date < ?", today)
  const revenue = await sql().q<{ n: number }>("SELECT COALESCE(SUM(net),0) AS n FROM invoices WHERE COALESCE(issued_at,'')<>'' AND status<>'cancelled' AND SUBSTRING(`date`,1,7)=?", today.slice(0, 7))
  const customers = await countTable('customers')
  return json(200, {
    open_quotes, unpaid_invoices, upcoming_visits, due_contracts, low_stock, warranty_expiring,
    stats: { unpaid: Number(unpaid[0]?.n ?? 0), overdue: Number(overdue[0]?.n ?? 0), revenue_month: Number(revenue[0]?.n ?? 0), customers },
  })
}

async function search(q: string) {
  const out: Record<string, Row[]> = {}
  if (q.trim().length < 2) return json(200, out)
  for (const name of ['customers', 'sites', 'equipment', 'workorders', 'quotes', 'invoices', 'products', 'documents']) {
    const rows = await listRows(resources[name], {}, q.trim(), 15)
    if (rows.length) out[name] = rows
  }
  return json(200, out)
}

function csvCell(v: unknown) {
  if (v == null) return ''
  if (typeof v === 'number') return String(v).replace('.', ',')
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

async function exportCsv(name: string) {
  const res = resources[name]
  if (!res) return fail(404, 'unknown resource')
  const rows = await listRows(res, {}, '', 1000000)
  const header = ['id', 'created_at', ...res.cols.filter((c) => c.type !== 'secret').map((c) => c.name)]
  const lines = [header.join(';')]
  for (const row of rows) lines.push(header.map((h) => csvEscape(csvCell(row[h]))).join(';'))
  const body = '\uFEFF' + lines.join('\r\n')
  const filename = `${name}-${todayIso().replaceAll('-', '')}.csv`
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

function csvEscape(s: string) {
  if (/[;"\n\r]/.test(s)) return '"' + s.replaceAll('"', '""') + '"'
  return s
}

async function backup(user: User) {
  const JSZip = (await import('jszip')).default
  const zip = new JSZip()
  const data: Record<string, unknown> = {}
  for (const table of ['users', 'settings', 'counters', 'customers', 'sites', 'equipment', 'networks', 'documents', 'diagrams', 'workorders', 'products', 'stock_moves', 'quotes', 'invoices', 'contracts', 'audit']) {
    data[table] = await sql().q(`SELECT * FROM \`${table}\``)
  }
  zip.file('data.json', JSON.stringify(data))
  zip.file('README.txt', [
    'VisionOne Portal — varnostna kopija (JSON).',
    'Šifrirana gesla naprav so v data.json (predpona enc:).',
    'Ključ ENCRYPTION_KEY je v okoljskih spremenljivkah (Vercel), ne v tem ZIP-u.',
    'Brez istega ključa skrivnosti ni mogoče odkleniti. Shranite ga ločeno.',
    'Datoteke na Vercel Blob ostanejo v shrambi; lokalne datoteke so v mapi files/.',
    'Obnova: uvozite sql/schema.sql, vstavite JSON in nastavite isti ENCRYPTION_KEY.',
    'FURS / e-SLOG nista del te kopije in v aplikaciji nista izvedena.',
  ].join('\n'))
  const docs = await sql().q<{ path: string | null; filename: string | null }>('SELECT path, filename FROM documents')
  for (const d of docs) {
    if (!d.path || d.path.startsWith('blob:')) continue
    const bytes = await readStored(d.path)
    if (bytes) zip.file('files/' + d.path, bytes)
  }
  const buf = await zip.generateAsync({ type: 'nodebuffer' })
  await audit(user.username, 'backup', '')
  const stamp = nowIso().replace(/[-:]/g, '').replace('T', '-').slice(0, 13)
  return new Response(binaryBody(buf), {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="portal-backup-${stamp}.zip"`,
    },
  })
}

async function blobHandshake(req: Request, user: User | null) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return fail(400, 'blob not configured')
  const raw = await req.text()
  let body: unknown = {}
  try { body = raw ? JSON.parse(raw) : {} } catch { return fail(400, 'invalid json') }
  const callback = !!body && typeof body === 'object' && (body as { type?: string }).type === 'blob.upload-completed'
  if (!callback) {
    if (!user) return fail(401, 'unauthorized')
    if (user.must_change) return fail(403, 'password change required')
    if (user.role === 'viewer') return fail(403, 'read-only user')
  }
  const { handleUpload } = await import('@vercel/blob/client')
  const request = new Request(req.url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: raw })
  const result = await handleUpload({
    body: body as never,
    request,
    onBeforeGenerateToken: async () => ({
      allowedContentTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'application/pdf', 'text/plain', 'application/zip', 'application/octet-stream'],
      addRandomSuffix: true,
      tokenPayload: user ? String(user.id) : '',
    }),
    onUploadCompleted: async () => {},
  })
  return json(200, result)
}

function csrfOk(req: Request) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return true
  const path = new URL(req.url).pathname.replace(/\/+$/, '')
  if (path === '/api/blob') return true
  return req.headers.get('x-portal') === '1'
}

export async function dispatch(req: Request): Promise<Response> {
  try {
    if (!csrfOk(req)) return fail(403, 'missing X-Portal header')
    const url = new URL(req.url)
    const parts = url.pathname.replace(/\/+$/, '').split('/').filter(Boolean)
    if (parts[0] !== 'api') return fail(404, 'not found')
    const p = parts.slice(1)
    const method = req.method
    if (p[0] === 'health' && method === 'GET') return json(200, { ok: true })
    await boot()
    if (p[0] === 'login' && method === 'POST') return await login(req)
    if (p[0] === 'blob' && method === 'POST') return await blobHandshake(req, await currentUser(req))
    if (p[0] === 'logout' && method === 'POST') {
      const raw = cookieValue(req)
      const token = raw ? openSession(raw) : null
      if (token) await sql().exec('DELETE FROM sessions WHERE token = ?', token)
      return json(200, { ok: true }, { 'Set-Cookie': sessionCookie('', req, 0) })
    }
    const user = await requireUser(req, false)
    if (p[0] === 'me' && method === 'GET') return json(200, user)
    if (p[0] === 'password' && method === 'POST') return await changePassword(req, user)
    if (p[0] === 'users' && !p[1] && method === 'GET') { await requireUser(req, true); return await listUsers() }
    if (p[0] === 'users' && !p[1] && method === 'POST') { await requireUser(req, true); return await saveUser(req) }
    if (p[0] === 'users' && p[1] && method === 'DELETE') {
      const admin = await requireUser(req, true)
      const id = numId(p[1])
      if (id === admin.id) return fail(400, 'cannot delete yourself')
      await sql().exec('DELETE FROM sessions WHERE user_id = ?', id)
      await sql().exec('DELETE FROM users WHERE id = ?', id)
      return json(200, { ok: true })
    }
    if (p[0] === 'settings' && method === 'GET') return json(200, await settings())
    if (p[0] === 'settings' && method === 'PUT') {
      await requireUser(req, true)
      const body = await readJson(req)
      const m: Record<string, string> = {}
      for (const [k, v] of Object.entries(body)) m[k] = v == null ? '' : String(v)
      await saveSettings(m)
      return json(200, await settings())
    }
    if (p[0] === 'r' && p[1] && !p[2] && method === 'GET') {
      const res = resOf(p[1])
      const lim = Number(url.searchParams.get('limit') ?? 0)
      return json(200, await listRows(res, filtersOf(res, url), url.searchParams.get('q') ?? '', lim))
    }
    if (p[0] === 'r' && p[1] && !p[2] && method === 'POST') {
      const res = resOf(p[1])
      const data = await readJson(req)
      await prepareDoc(res, 0, data)
      const id = await saveRow(res, 0, data)
      return json(200, await getRow(res, id))
    }
    if (p[0] === 'r' && p[1] && p[2] && !p[3] && method === 'GET') {
      const res = resOf(p[1])
      const row = await getRow(res, numId(p[2]))
      if (!row) return fail(404, 'not found')
      return json(200, row)
    }
    if (p[0] === 'r' && p[1] && p[2] && !p[3] && method === 'PUT') {
      const res = resOf(p[1])
      const id = numId(p[2])
      const data = await readJson(req)
      await prepareDoc(res, id, data)
      await saveRow(res, id, data)
      const row = await getRow(res, id)
      if (!row) return fail(404, 'not found')
      return json(200, row)
    }
    if (p[0] === 'r' && p[1] && p[2] && !p[3] && method === 'DELETE') {
      const res = resOf(p[1])
      const id = numId(p[2])
      if (res.table === 'invoices') {
        const issued = await rawField('invoices', 'issued_at', id)
        if (issued) return fail(409, 'issued invoices cannot be deleted (use storno)')
      }
      if (res.table === 'customers') {
        const n = await sql().q<{ n: number }>("SELECT COUNT(*) AS n FROM invoices WHERE customer_id = ? AND COALESCE(issued_at,'') <> ''", id)
        if (Number(n[0]?.n ?? 0) > 0) return fail(409, 'customer has issued invoices')
        await sql().exec('DELETE FROM invoices WHERE customer_id = ?', id)
      }
      const key = parentKey[res.table]
      if (key) {
        for (const ch of childTables[res.table] ?? []) {
          if (ch === 'documents') await removeDocumentFiles(`\`${key}\` = ?`, id)
          await sql().exec(`DELETE FROM \`${ch}\` WHERE \`${key}\` = ?`, id)
        }
      }
      if (res.table === 'documents') {
        const d = await getRow(res, id)
        if (d?.path) await deleteStored(String(d.path))
      }
      await sql().exec(`DELETE FROM \`${res.table}\` WHERE id = ?`, id)
      await audit(user.username, 'delete', `${res.table}/${id}`)
      return json(200, { ok: true })
    }
    if (p[0] === 'r' && p[1] && p[2] && p[3] === 'secret' && p[4] && method === 'GET') {
      const res = resOf(p[1])
      const field = p[4]
      if (!res.cols.some((c) => c.name === field && c.type === 'secret')) return fail(400, 'not a secret field')
      let value = ''
      try { value = (await import('./crypto')).decrypt(await rawField(res.table, field, numId(p[2]))) }
      catch { return fail(500, 'decrypt failed') }
      await audit(user.username, 'reveal', `${res.table}/${p[2]}/${field}`)
      return json(200, { value })
    }
    if (p[0] === 'quotes' && p[2] === 'to-invoice' && method === 'POST') return await quoteToInvoice(numId(p[1]))
    if (p[0] === 'quotes' && p[2] === 'pdf' && method === 'GET') return await pdfResponse('quotes', numId(p[1]))
    if (p[0] === 'invoices' && p[2] === 'issue' && method === 'POST') return await issueInvoice(numId(p[1]), user)
    if (p[0] === 'invoices' && p[2] === 'pay' && method === 'POST') return await payInvoice(req, numId(p[1]), user)
    if (p[0] === 'invoices' && p[2] === 'storno' && method === 'POST') return await stornoInvoice(numId(p[1]), user)
    if (p[0] === 'invoices' && p[2] === 'pdf' && method === 'GET') return await pdfResponse('invoices', numId(p[1]))
    if (p[0] === 'invoices' && (p[2] === 'upn.png' || p[2] === 'upn') && method === 'GET') {
      const inv = await getRow(resources.invoices, numId(p[1]))
      if (!inv) return fail(404, 'not found')
      const upn = buildUpn(inv, await customerOf(inv.customer_id), await settings())
      if (!upn) return fail(400, 'IBAN not set in settings')
      const png = await upnPng(upn)
      return new Response(binaryBody(png), { status: 200, headers: { 'Content-Type': 'image/png' } })
    }
    if (p[0] === 'upload' && p[1] === 'mode' && method === 'GET') {
      return json(200, { mode: process.env.BLOB_READ_WRITE_TOKEN ? 'blob' : 'local' })
    }
    if (p[0] === 'upload' && method === 'POST') return await upload(req)
    if (p[0] === 'files' && p[1] && method === 'GET') return await serveFile(numId(p[1]), url)
    if (p[0] === 'stock' && p[1] === 'move' && method === 'POST') return await stockMove(req)
    if (p[0] === 'contracts' && p[2] === 'workorder' && method === 'POST') return await contractWorkorder(numId(p[1]), user)
    if (p[0] === 'calendar' && method === 'GET') {
      const rows = await queryShaped(
        resources.workorders,
        `SELECT w.*, COALESCE(NULLIF(c.company,''), c.name, '') AS customer_name FROM workorders w LEFT JOIN customers c ON c.id = w.customer_id WHERE w.start >= ? AND w.start < ? ORDER BY w.start`,
        url.searchParams.get('from') ?? '', url.searchParams.get('to') ?? '',
      )
      return json(200, rows)
    }
    if (p[0] === 'dashboard' && method === 'GET') return await dashboard()
    if (p[0] === 'search' && method === 'GET') return await search(url.searchParams.get('q') ?? '')
    if (p[0] === 'export' && p[1] && method === 'GET') return await exportCsv(p[1].replace(/\.csv$/, ''))
    if (p[0] === 'backup' && method === 'GET') {
      await requireUser(req, true)
      return await backup(user)
    }
    return fail(404, 'not found')
  } catch (e) {
    if (e instanceof HttpError) return fail(e.status, e.message)
    console.error(e)
    const msg = e instanceof Error ? e.message : 'error'
    if (/mysql:\/\/|DATABASE_URL|ENCRYPTION_KEY|AUTH_SECRET/i.test(msg)) return fail(500, 'database error')
    return fail(500, msg.slice(0, 500))
  }
}

export async function wipeAll() {
  for (const table of ['login_attempts', 'audit', 'sessions', 'users', 'settings', 'counters', 'stock_moves', 'documents', 'diagrams', 'equipment', 'networks', 'workorders', 'quotes', 'invoices', 'contracts', 'sites', 'products', 'customers']) {
    await sql().exec(`TRUNCATE TABLE \`${table}\``)
  }
  resetBoot()
}
