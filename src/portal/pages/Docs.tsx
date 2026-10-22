import { useEffect, useState } from 'react'
import { api, list, getOne, saveRow, delRow, fmtMoney, fmtDate, totals, today, custName, type Row, type Line } from '../api'
import { t } from '../i18n'
import { useLoad, Table, Badge, Modal, Toast } from '../ui'
import { go } from '../main'

const qStatus: [string, string][] = [['draft', 'Osnutek'], ['sent', 'Poslano'], ['accepted', 'Sprejeto'], ['rejected', 'Zavrnjeno']]

export function DocList({ kind }: { kind: 'quotes' | 'invoices' | string }) {
  const [status, setStatus] = useState('')
  const [q, setQ] = useState('')
  const [rows] = useLoad(() => list(kind, { status, q }), [kind, status, q])
  const [custs] = useLoad(() => list('customers'), [])
  const cn = (id: number) => custName(custs?.find((c) => c.id === id))
  const st = kind === 'quotes' ? qStatus : [['draft', 'Osnutek'], ['issued', 'Izdan'], ['partial', 'Delno plačan'], ['paid', 'Plačan'], ['cancelled', 'Storniran']]
  const sum = (rows ?? []).reduce((s, r) => s + (r.total || 0), 0)
  return <div>
    <div className="topbar"><h2>{t(kind === 'quotes' ? 'Ponudbe' : 'Računi')}</h2><div className="row">
      <input placeholder={t('Išči…')} value={q} onChange={(e) => setQ(e.target.value)} />
      <select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">{t('Vse')}</option>{st.map(([k, l]) => <option key={k} value={k}>{t(l)}</option>)}</select>
      <a className="btn" href={`/api/export/${kind}.csv`}>⬇ CSV</a>
      <button className="primary" onClick={() => go(`/${kind}/new`)}>+ {t(kind === 'quotes' ? 'Nova ponudba' : 'Nov račun')}</button></div></div>
    <div className="card"><Table rows={rows} onRow={(r) => go(`/${kind}/${r.id}`)} cols={[
      { k: 'number', label: 'Številka', render: (r) => r.number ? <b>{r.number}</b> : <i className="muted">{t('Osnutek')}</i> }, { k: 'date', label: 'Datum', render: (r) => fmtDate(r.date) },
      { k: 'customer_id', label: 'Stranka', render: (r) => cn(r.customer_id) }, { k: 'title', label: 'Naziv' },
      ...(kind === 'invoices' ? [{ k: 'due_date', label: 'Rok plačila', render: (r: Row) => fmtDate(r.due_date) }] : [{ k: 'valid_until', label: 'Veljavnost do', render: (r: Row) => fmtDate(r.valid_until) }]),
      { k: 'net', label: 'Osnova', cls: 'num', render: (r) => fmtMoney(r.net) }, { k: 'total', label: 'Znesek', cls: 'num', render: (r) => fmtMoney(r.total) },
      { k: 'status', label: 'Status', render: (r) => <Badge s={r.status} overdue={kind === 'invoices' && ['issued', 'partial'].includes(r.status) && r.due_date < today()} /> }]} />
      <div className="row end muted small">{t('Skupaj')}: {fmtMoney(sum)}</div></div>
  </div>
}

const emptyLine = (): Line => ({ description: '', qty: 1, unit: 'kos', price: 0, discount_pct: 0, vat_rate: 22 })

export function DocEditor({ kind, id }: { kind: 'quotes' | 'invoices' | string; id: number }) {
  const isInv = kind === 'invoices'
  const [d, setD] = useState<Row>()
  const [custs] = useLoad(() => list('customers'), [])
  const [products] = useLoad(() => list('products'), [])
  const [settings] = useLoad<Record<string, string>>(() => api('/settings'), [])
  const [sites, setSites] = useState<Row[]>([])
  const [err, setErr] = useState(''), [toast, setToast] = useState('')
  const [pay, setPay] = useState<{ amount: number; date: string; method: string } | null>(null)
  const [pick, setPick] = useState(false)
  useEffect(() => {
    if (id) getOne(kind, id).then(setD)
    else {
      const cust = +(location.hash.split('customer=')[1] ?? 0) || undefined
      const days = 15
      setD({ id: 0, customer_id: cust, date: today(), status: 'draft', lines: [emptyLine()], discount_pct: 0,
        ...(isInv ? { service_date: today(), due_date: new Date(Date.now() + days * 86400000).toLocaleDateString('sv-SE'), paid_amount: 0 } : { valid_until: new Date(Date.now() + 30 * 86400000).toLocaleDateString('sv-SE') }) } as Row)
    }
  }, [kind, id])
  useEffect(() => { if (d?.customer_id) list('sites', { customer_id: d.customer_id }).then(setSites) }, [d?.customer_id])
  if (!d) return <div className="muted">{t('Nalaganje…')}</div>
  const locked = isInv && !!d.issued_at
  const lines: Line[] = d.lines ?? []
  const tt = totals(lines, d.discount_pct || 0)
  const set = (k: string, v: any) => setD({ ...d, [k]: v })
  const setLine = (i: number, k: keyof Line, v: any) => set('lines', lines.map((l, j) => (j === i ? { ...l, [k]: v } : l)))
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2000) }
  const save = async () => {
    setErr('')
    try {
      const body: any = { ...d, lines: tt.lines }
      if (!d.id) delete body.id
      const r = await saveRow(kind, body); setD(r); flash(t('Shranjeno'))
      if (!id) history.replaceState(null, '', `#/${kind}/${r.id}`)
      return r
    } catch (x: any) { setErr(x.message) }
  }
  const act = async (path: string, body: any = {}) => { setErr(''); try { const r = await api(path, { body }); return r } catch (x: any) { setErr(x.message) } }
  const cust = custs?.find((c) => c.id === d.customer_id)
  const vatPayer = settings?.vat_payer !== '0'
  return <div className="doc">
    <div className="topbar"><div><a href={'#/' + kind} className="muted small">← {t(isInv ? 'Računi' : 'Ponudbe')}</a>
      <h2>{t(isInv ? 'Račun' : 'Ponudba')} {d.number || <span className="muted">({t('Osnutek')})</span>} <Badge s={d.status} /></h2></div>
      <div className="row">
        {!locked && <button className="primary" onClick={save}>💾 {t('Shrani')}</button>}
        {d.id ? <a className="btn" href={`/api/${kind}/${d.id}/pdf`} target="_blank" rel="noreferrer">📄 {t('PDF')}</a> : null}
        {!isInv && d.id && !d.invoice_id ? <button onClick={async () => { await save(); const r = await act(`/quotes/${d.id}/to-invoice`); if (r) go('/invoices/' + r.id) }}>🧾 {t('Pretvori v račun')}</button> : null}
        {!isInv && d.invoice_id ? <a className="btn" href={'#/invoices/' + d.invoice_id}>→ {t('Račun')}</a> : null}
        {isInv && d.id && !locked ? <button className="primary" onClick={async () => { if (!confirm(t('Po izdaji dobi račun zaporedno številko in ga ni več mogoče spreminjati ali brisati. Nadaljujem?'))) return; const s = await save(); if (!s) return; const r = await act(`/invoices/${d.id}/issue`); if (r) setD(r) }}>✅ {t('Izdaj račun')}</button> : null}
        {locked && ['issued', 'partial'].includes(d.status) ? <button onClick={() => setPay({ amount: +(d.total - (d.paid_amount || 0)).toFixed(2), date: today(), method: 'transfer' })}>💶 {t('Zabeleži plačilo')}</button> : null}
        {locked && d.status !== 'cancelled' && d.total > 0 ? <button className="danger" onClick={async () => { if (!confirm(t('Storno') + '?')) return; const r = await act(`/invoices/${d.id}/storno`); if (r) go('/invoices/' + r.id) }}>↩ {t('Storno')}</button> : null}
        {d.id && !locked ? <button className="danger" onClick={async () => { if (confirm(t('Res želite izbrisati?'))) { await delRow(kind, d.id); go('/' + kind) } }}>🗑</button> : null}
      </div></div>
    {locked && <div className="note">🔒 {t('Izdan račun se ne more več urejati.')} {t('Sklic')}: <code>{d.reference}</code></div>}
    {err && <div className="err">{err}</div>}
    <div className="grid2">
      <div className="card"><div className="form">
        <label>{t('Stranka')}<select disabled={locked} value={d.customer_id ?? ''} onChange={(e) => set('customer_id', +e.target.value || null)}><option value="">—</option>{custs?.map((c) => <option key={c.id} value={c.id}>{custName(c)}</option>)}</select></label>
        <label>{t('Objekt')}<select value={d.site_id ?? ''} onChange={(e) => set('site_id', +e.target.value || null)}><option value="">—</option>{sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label className="full">{t('Naziv')}<input value={d.title ?? ''} onChange={(e) => set('title', e.target.value)} /></label>
        <label>{t('Datum')}<input type="date" disabled={locked} value={d.date ?? ''} onChange={(e) => set('date', e.target.value)} /></label>
        {isInv ? <>
          <label>{t('Datum storitve')}<input type="date" value={d.service_date ?? ''} onChange={(e) => set('service_date', e.target.value)} /></label>
          <label>{t('Rok plačila')}<input type="date" value={d.due_date ?? ''} onChange={(e) => set('due_date', e.target.value)} /></label>
        </> : <>
          <label>{t('Veljavnost do')}<input type="date" value={d.valid_until ?? ''} onChange={(e) => set('valid_until', e.target.value)} /></label>
          <label>{t('Status')}<select value={d.status} onChange={(e) => set('status', e.target.value)}>{qStatus.map(([k, l]) => <option key={k} value={k}>{t(l)}</option>)}</select></label>
        </>}
      </div></div>
      <div className="card">{cust ? <div><b>{custName(cust)}</b><div className="muted small">{cust.address}, {cust.post} {cust.city}<br />{cust.vat_id && (cust.vat_payer ? 'ID za DDV: ' : 'Davčna: ') + cust.vat_id}</div></div> : <div className="muted">{t('Stranka')}: —</div>}
        {isInv && locked && settings?.iban && d.total > 0 && <div className="upn"><img src={`/api/invoices/${d.id}/upn.png`} alt="UPN QR" /><div className="small">{t('UPN QR')}<br />TRR {settings.iban}<br />{t('Sklic')} {d.reference}</div></div>}
        {isInv && locked && <div className="small" style={{ marginTop: 8 }}>{t('Plačano')}: <b>{fmtMoney(d.paid_amount)}</b> {d.paid_date && '· ' + fmtDate(d.paid_date)} · {t('Odprto')}: <b>{fmtMoney(d.total - (d.paid_amount || 0))}</b></div>}
      </div>
    </div>
    <div className="card"><div className="topbar"><h3>{t('Postavke')}</h3>{!locked && <div className="row"><button className="sm" onClick={() => setPick(true)}>📦 {t('Iz kataloga')}</button><button className="sm" onClick={() => set('lines', [...lines, emptyLine()])}>+ {t('Dodaj postavko')}</button></div>}</div>
      <div className="tablewrap"><table className="lines"><thead><tr><th>#</th><th>{t('Opis')}</th><th className="num">{t('Kol.')}</th><th>{t('EM')}</th><th className="num">{t('Cena')}</th><th className="num">{t('Pop. %')}</th><th className="num">{t('DDV %')}</th><th className="num">{t('Znesek')}</th><th /></tr></thead>
        <tbody>{tt.lines.map((l, i) => <tr key={i}>
          <td>{i + 1}</td>
          <td><input className="wide" disabled={locked} value={l.description} onChange={(e) => setLine(i, 'description', e.target.value)} /></td>
          <td><input className="n" type="number" step="any" disabled={locked} value={l.qty} onChange={(e) => setLine(i, 'qty', +e.target.value)} /></td>
          <td><input className="u" disabled={locked} value={l.unit} onChange={(e) => setLine(i, 'unit', e.target.value)} /></td>
          <td><input className="n" type="number" step="0.01" disabled={locked} value={l.price} onChange={(e) => setLine(i, 'price', +e.target.value)} /></td>
          <td><input className="n s" type="number" step="any" disabled={locked} value={l.discount_pct} onChange={(e) => setLine(i, 'discount_pct', +e.target.value)} /></td>
          <td><select disabled={locked} value={l.vat_rate} onChange={(e) => setLine(i, 'vat_rate', +e.target.value)}>{[22, 9.5, 5, 0].map((v) => <option key={v} value={v}>{String(v).replace('.', ',')} %</option>)}</select></td>
          <td className="num">{fmtMoney(l.net)}</td>
          <td>{!locked && <button className="sm danger" onClick={() => set('lines', lines.filter((_, j) => j !== i))}>✕</button>}</td></tr>)}</tbody></table></div>
      <div className="totals">
        <label className="row">{t('Popust na dokument %')}<input className="n s" type="number" disabled={locked} value={d.discount_pct ?? 0} onChange={(e) => set('discount_pct', +e.target.value)} /></label>
        <table><tbody>
          {tt.discount !== 0 && <tr><td>{t('Skupaj')}</td><td className="num">{fmtMoney(tt.gross)}</td></tr>}
          {tt.discount !== 0 && <tr><td>Popust</td><td className="num">-{fmtMoney(tt.discount)}</td></tr>}
          {vatPayer && tt.breakdown.map((b) => <tr key={b.rate} className="muted"><td>{t('Osnova')} {String(b.rate).replace('.', ',')} % / {t('DDV')}</td><td className="num">{fmtMoney(b.base)} / {fmtMoney(b.vat)}</td></tr>)}
          <tr><td>{t('Osnova')}</td><td className="num">{fmtMoney(tt.net)}</td></tr>
          {vatPayer && <tr><td>{t('DDV')}</td><td className="num">{fmtMoney(tt.vat)}</td></tr>}
          <tr className="grand"><td>{t('Za plačilo')}</td><td className="num">{fmtMoney(tt.total)}</td></tr>
        </tbody></table>
      </div>
      <label className="full">{t('Opombe')}<textarea rows={3} value={d.notes ?? ''} onChange={(e) => set('notes', e.target.value)} /></label>
      {locked && <div className="row end"><button className="sm" onClick={async () => { const r = await saveRow(kind, { id: d.id, notes: d.notes, title: d.title, due_date: d.due_date, service_date: d.service_date, site_id: d.site_id }); setD(r); flash(t('Shranjeno')) }}>{t('Shrani')} ({t('Opombe')})</button></div>}
    </div>
    {pick && <Modal title={t('Iz kataloga')} onClose={() => setPick(false)}><CatalogPicker products={products ?? []} onPick={(p) => { set('lines', [...lines.filter((l) => l.description || l.price), { product_id: p.id, description: p.name + (p.sku && p.kind === 'product' ? ` (${p.brand ?? ''} ${p.sku})` : ''), qty: 1, unit: p.unit || 'kos', price: p.price || 0, discount_pct: 0, vat_rate: p.vat_rate ?? 22 }]); setPick(false) }} /></Modal>}
    {pay && <Modal title={t('Zabeleži plačilo')} onClose={() => setPay(null)}><div className="form">
      <label>{t('Znesek')}<input type="number" step="0.01" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: +e.target.value })} /></label>
      <label>{t('Datum')}<input type="date" value={pay.date} onChange={(e) => setPay({ ...pay, date: e.target.value })} /></label>
      <label>{t('Način plačila')}<select value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })}><option value="transfer">{t('Nakazilo (TRR)')}</option><option value="cash">{t('Gotovina')}</option><option value="card">{t('Kartica')}</option></select></label></div>
      {pay.method !== 'transfer' && <div className="note small">⚠️ Gotovinska/kartična plačila v Sloveniji praviloma zahtevajo davčno potrjevanje računa (FURS, ZDavPR). Ta aplikacija tega <b>ne izvaja</b> – preverite z računovodjo.</div>}
      <div className="row end" style={{ marginTop: 12 }}><button className="primary" onClick={async () => { const r = await act(`/invoices/${d.id}/pay`, pay); if (r) { setD(r); setPay(null) } }}>{t('Shrani')}</button></div></Modal>}
    <Toast msg={toast} />
  </div>
}

function CatalogPicker({ products, onPick }: { products: Row[]; onPick: (p: Row) => void }) {
  const [q, setQ] = useState('')
  const rows = products.filter((p) => !q || `${p.name} ${p.sku} ${p.brand} ${p.category}`.toLowerCase().includes(q.toLowerCase()))
  return <div><input autoFocus placeholder={t('Išči…')} value={q} onChange={(e) => setQ(e.target.value)} style={{ width: '100%', marginBottom: 10 }} />
    <Table rows={rows} onRow={onPick} cols={[{ k: 'sku', label: 'Šifra' }, { k: 'name', label: 'Naziv' }, { k: 'category', label: 'Kategorija' }, { k: 'price', label: 'Cena', cls: 'num', render: (r) => fmtMoney(r.price) }, { k: 'stock', label: 'Zaloga', cls: 'num', render: (r) => (r.kind === 'product' ? r.stock : '') }]} /></div>
}
