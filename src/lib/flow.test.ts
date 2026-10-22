import { describe, expect, it, beforeAll } from 'vitest'
import { dispatch, ensureAdmin, wipeAll } from './handlers'
import { sql } from './db'
import { seedDemo } from './seed'

let cookie = ''

async function call(method: string, path: string, body?: unknown) {
  const headers: Record<string, string> = {}
  if (cookie) headers.Cookie = cookie
  let payload: string | undefined
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    headers['X-Portal'] = '1'
    payload = JSON.stringify(body)
  } else if (method !== 'GET' && method !== 'HEAD') {
    headers['X-Portal'] = '1'
  }
  const res = await dispatch(new Request('http://localhost' + path, { method, headers, body: payload }))
  const set = res.headers.get('set-cookie')
  if (set) {
    const m = set.match(/portal_session=([^;]*)/)
    cookie = m && m[1] ? `portal_session=${m[1]}` : ''
  }
  const buf = Buffer.from(await res.arrayBuffer())
  const ct = res.headers.get('content-type') ?? ''
  let data: any = null
  if (ct.includes('json')) {
    const text = buf.toString('utf8')
    data = text ? JSON.parse(text) : null
  }
  return { status: res.status, ct, data, buf }
}

beforeAll(async () => {
  await wipeAll()
  await ensureAdmin()
  await seedDemo()
  cookie = ''
})

describe('portal flow', () => {
  it('covers auth, secrets, invoices, stock, search and backup', async () => {
    expect((await call('GET', '/api/r/customers')).status).toBe(401)
    expect((await call('POST', '/api/login', { username: 'admin', password: 'x' })).status).toBe(401)
    expect((await call('POST', '/api/login', { username: 'admin', password: 'admin' })).status).toBe(200)
    expect((await call('GET', '/api/r/customers')).status).toBe(403)
    expect((await call('POST', '/api/password', { old: 'admin', new: 'Portal-Test1' })).status).toBe(200)

    const csrf = await dispatch(new Request('http://localhost/api/r/customers', {
      method: 'POST',
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'x' }),
    }))
    expect(csrf.status).toBe(403)

    const cust = await call('POST', '/api/r/customers', { name: 'Test d.o.o.', kind: 'company', contacts: [{ name: 'A' }] })
    const cid = cust.data.id as number
    const eq = await call('POST', '/api/r/equipment', { customer_id: cid, name: 'Cam', password: 's3cret' })
    expect(eq.data.password).toBe('')
    expect(eq.data.has_password).toBe(true)
    const raw = await sql().q<{ password: string }>('SELECT password FROM equipment WHERE id = ?', eq.data.id)
    expect(String(raw[0].password).startsWith('enc:')).toBe(true)
    const sec = await call('GET', `/api/r/equipment/${eq.data.id}/secret/password`)
    expect(sec.data.value).toBe('s3cret')
    await call('PUT', `/api/r/equipment/${eq.data.id}`, { name: 'Cam2', password: '' })
    const sec2 = await call('GET', `/api/r/equipment/${eq.data.id}/secret/password`)
    expect(sec2.data.value).toBe('s3cret')

    const q = await call('POST', '/api/r/quotes', {
      customer_id: cid,
      lines: [{ description: 'Kamera', qty: 2, price: 100, vat_rate: 22 }, { description: 'Delo', qty: 1, price: 50, vat_rate: 9.5 }],
    })
    expect(q.data.total).toBe(244 + 54.75)
    expect(String(q.data.number).startsWith('P-')).toBe(true)
    const inv = await call('POST', `/api/quotes/${q.data.id}/to-invoice`, {})
    expect(inv.status).toBe(200)
    expect(inv.data.total).toBe(298.75)
    expect((await call('POST', `/api/quotes/${q.data.id}/to-invoice`, {})).status).toBe(409)
    const iid = inv.data.id
    expect((await call('POST', `/api/invoices/${iid}/pay`, {})).status).toBe(400)
    const issued = await call('POST', `/api/invoices/${iid}/issue`, {})
    const num1 = issued.data.number as string
    expect(issued.data.status).toBe('issued')
    expect(num1.endsWith('-0001')).toBe(true)
    expect(issued.data.reference).toBe('SI00' + num1)
    expect((await call('POST', `/api/invoices/${iid}/issue`, {})).status).toBe(409)
    const inv2 = await call('POST', '/api/r/invoices', { customer_id: cid, lines: [{ description: 'x', qty: 1, price: 10, vat_rate: 22 }] })
    const issued2 = await call('POST', `/api/invoices/${inv2.data.id}/issue`, {})
    expect(String(issued2.data.number).endsWith('-0002')).toBe(true)
    const locked = await call('PUT', `/api/r/invoices/${iid}`, { lines: [{ qty: 1, price: 1, vat_rate: 22 }], number: 'HACK', notes: 'ok' })
    expect(locked.data.number).toBe(num1)
    expect(locked.data.total).toBe(298.75)
    expect(locked.data.notes).toBe('ok')
    expect((await call('DELETE', `/api/r/invoices/${iid}`)).status).toBe(409)
    const partial = await call('POST', `/api/invoices/${iid}/pay`, { amount: 100 })
    expect(partial.data.status).toBe('partial')
    const paid = await call('POST', `/api/invoices/${iid}/pay`, {})
    expect(paid.data.status).toBe('paid')
    expect(paid.data.paid_amount).toBe(298.75)

    const pdf = await call('GET', `/api/invoices/${iid}/pdf`)
    expect(pdf.status).toBe(200)
    expect(pdf.buf.subarray(0, 4).toString()).toBe('%PDF')
    const listQ = await call('GET', '/api/r/quotes')
    expect(listQ.status).toBe(200)
    const qpdf = await call('GET', `/api/quotes/${q.data.id}/pdf`)
    expect(qpdf.buf.subarray(0, 4).toString()).toBe('%PDF')
    const upn = await call('GET', `/api/invoices/${iid}/upn.png`)
    expect(upn.status).toBe(200)
    expect(upn.ct).toBe('image/png')
    expect((await call('DELETE', `/api/r/customers/${cid}`)).status).toBe(409)
    const st = await call('POST', `/api/invoices/${iid}/storno`, {})
    expect(st.data.total).toBe(-298.75)

    const prods = await call('GET', '/api/r/products?q=WD40')
    const pr = await call('POST', '/api/stock/move', { product_id: prods.data[0].id, qty: -1, reason: 'test' })
    expect(pr.data.stock).toBe(0)
    const cts = await call('GET', '/api/r/contracts')
    const wo = await call('POST', `/api/contracts/${cts.data[0].id}/workorder`, {})
    expect(wo.data.contract_id).toBeTruthy()
    expect(wo.data.status).toBe('planned')
    const dash = await call('GET', '/api/dashboard')
    expect(dash.data.open_quotes.length).toBeGreaterThanOrEqual(2)
    const sr = await call('GET', '/api/search?q=192.168.20.21')
    expect(sr.data.equipment.length).toBe(1)
    const csv = await call('GET', '/api/export/equipment.csv')
    const text = csv.buf.toString('utf8')
    expect(text).toContain('DS-2CD1643G0-IZ')
    expect(text).not.toContain('Cam!2024')
    expect(text).not.toContain('enc:')
    const bk = await call('GET', '/api/backup')
    expect(bk.status).toBe(200)
    expect(bk.ct).toBe('application/zip')
    expect(bk.buf.subarray(0, 2).toString()).toBe('PK')
  })
})
