import { useEffect, useRef, useState } from 'react'
import { api, list, getOne, saveRow, fmtDT, custName, type Row, type Line, totals } from '../api'
import { t } from '../i18n'
import { useLoad, Table, EditModal, Badge, Fields, Toast } from '../ui'
import { workorderFields, woStatus } from '../specs'
import { go } from '../main'
import { DocumentsPanel, Map } from './Customers'

const pad = (n: number) => String(n).padStart(2, '0')
const localISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
const dayKey = (d: Date) => localISO(d).slice(0, 10)

function useCustomers() { const [c] = useLoad(() => list('customers'), []); return (id: number) => custName(c?.find((x) => x.id === id)) }

export function WorkOrderList() {
  const [status, setStatus] = useState('')
  const [q, setQ] = useState('')
  const [rows, reload] = useLoad(() => list('workorders', { status, q }), [status, q])
  const cn = useCustomers()
  const [edit, setEdit] = useState<Partial<Row> | null>(location.hash.includes('?new') ? newWO() : null)
  return <div>
    <div className="topbar"><h2>{t('Delovni nalogi')}</h2><div className="row"><input placeholder={t('Išči…')} value={q} onChange={(e) => setQ(e.target.value)} />
      <select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">{t('Vse')}</option>{woStatus.map(([k, l]) => <option key={k} value={k}>{t(l)}</option>)}</select>
      <button className="primary" onClick={() => setEdit(newWO())}>+ {t('Nov nalog')}</button></div></div>
    <div className="card"><Table rows={rows} onRow={(r) => go('/workorders/' + r.id)} cols={[{ k: 'start', label: 'Začetek', render: (r) => fmtDT(r.start) }, { k: 'customer_id', label: 'Stranka', render: (r) => cn(r.customer_id) },
      { k: 'title', label: 'Naziv', render: (r) => <b>{r.title}</b> }, { k: 'type', label: 'Tip' }, { k: 'priority', label: 'Prioriteta' }, { k: 'technician', label: 'Tehnik' }, { k: 'status', label: 'Status', render: (r) => <Badge s={r.status} /> }]} /></div>
    {edit && <EditModal title={t('Nov nalog')} res="workorders" fields={workorderFields} row={edit} onClose={() => setEdit(null)} onSaved={(r) => { reload(); if (!r._deleted) go('/workorders/' + r.id) }} />}
  </div>
}

function newWO(start?: Date): Partial<Row> {
  const s = start ?? new Date(Date.now() + 86400000); s.setMinutes(0, 0, 0); if (!start) s.setHours(9)
  return { status: 'planned', type: 'repair', priority: 'normal', start: localISO(s), end: localISO(new Date(+s + 2 * 3600000)) }
}

export function Calendar() {
  const [mode, setMode] = useState<'week' | 'month'>(window.innerWidth < 760 ? 'week' : 'month')
  const [anchor, setAnchor] = useState(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d })
  let from: Date, to: Date
  if (mode === 'week') { from = new Date(anchor); from.setDate(from.getDate() - ((from.getDay() + 6) % 7)); to = new Date(from); to.setDate(to.getDate() + 7) }
  else { const f = new Date(anchor.getFullYear(), anchor.getMonth(), 1); from = new Date(f); from.setDate(from.getDate() - ((f.getDay() + 6) % 7)); to = new Date(from); to.setDate(to.getDate() + 42) }
  const [rows, reload] = useLoad(() => api<Row[]>(`/calendar?from=${dayKey(from)}&to=${dayKey(to)}`), [dayKey(from), dayKey(to)])
  const [edit, setEdit] = useState<Partial<Row> | null>(null)
  const days: Date[] = []; for (let d = new Date(from); d < to; d.setDate(d.getDate() + 1)) days.push(new Date(d))
  const shift = (n: number) => { const d = new Date(anchor); if (mode === 'week') d.setDate(d.getDate() + 7 * n); else d.setMonth(d.getMonth() + n); setAnchor(d) }
  const tk = dayKey(new Date())
  const wd = ['pon', 'tor', 'sre', 'čet', 'pet', 'sob', 'ned']
  return <div>
    <div className="topbar"><h2>{t('Koledar')} – {anchor.toLocaleDateString('sl-SI', { month: 'long', year: 'numeric' })}</h2>
      <div className="row"><button onClick={() => shift(-1)}>◀</button><button onClick={() => { const d = new Date(); d.setHours(0, 0, 0, 0); setAnchor(d) }}>{t('Danes')}</button><button onClick={() => shift(1)}>▶</button>
        <div className="seg"><button className={mode === 'week' ? 'on' : ''} onClick={() => setMode('week')}>{t('Teden')}</button><button className={mode === 'month' ? 'on' : ''} onClick={() => setMode('month')}>{t('Mesec')}</button></div>
        <button className="primary" onClick={() => setEdit(newWO())}>+ {t('Nov nalog')}</button></div></div>
    <div className={'cal ' + mode}>
      {wd.map((w) => <div key={w} className="cal-h">{w}</div>)}
      {days.map((d) => { const k = dayKey(d); const ev = (rows ?? []).filter((r) => (r.start ?? '').slice(0, 10) === k)
        return <div key={k} className={'cal-d' + (k === tk ? ' today' : '') + (mode === 'month' && d.getMonth() !== anchor.getMonth() ? ' other' : '')}
          onDoubleClick={() => { const s = new Date(d); s.setHours(9); setEdit(newWO(s)) }}>
          <div className="cal-n">{d.getDate()}.{mode === 'week' ? ` ${d.getMonth() + 1}.` : ''}</div>
          {ev.map((e) => <a key={e.id} href={'#/workorders/' + e.id} className={'cal-e st-' + e.status + ' pr-' + e.priority}><b>{(e.start ?? '').slice(11, 16)}</b> {e.customer_name}<br /><span>{e.title}</span></a>)}
        </div> })}
    </div>
    <p className="muted small">Dvoklik na dan = {t('Nov nalog')}</p>
    {edit && <EditModal title={t('Nov nalog')} res="workorders" fields={workorderFields} row={edit} onClose={() => setEdit(null)} onSaved={reload} />}
  </div>
}

function Signature({ value, onSave }: { value?: string; onSave: (dataUrl: string, name: string) => void }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [name, setName] = useState('')
  const drawing = useRef(false), dirty = useRef(false)
  useEffect(() => { const c = ref.current; if (!c) return; const ctx = c.getContext('2d')!; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.strokeStyle = '#0b1020' }, [value])
  const pos = (e: React.PointerEvent) => { const c = ref.current!, r = c.getBoundingClientRect(); return [(e.clientX - r.left) * c.width / r.width, (e.clientY - r.top) * c.height / r.height] }
  const down = (e: React.PointerEvent) => { drawing.current = true; dirty.current = true; const ctx = ref.current!.getContext('2d')!; const [x, y] = pos(e); ctx.beginPath(); ctx.moveTo(x, y); (e.target as Element).setPointerCapture(e.pointerId) }
  const move = (e: React.PointerEvent) => { if (!drawing.current) return; const ctx = ref.current!.getContext('2d')!; const [x, y] = pos(e); ctx.lineTo(x, y); ctx.stroke() }
  const clear = () => { const c = ref.current!, ctx = c.getContext('2d')!; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); dirty.current = false }
  if (value) return <div><img src={value} className="sig-img" alt="signature" /></div>
  return <div>
    <canvas ref={ref} width={600} height={200} className="sig" onPointerDown={down} onPointerMove={move} onPointerUp={() => (drawing.current = false)} />
    <div className="row"><input placeholder={t('Podpisal')} value={name} onChange={(e) => setName(e.target.value)} /><button className="sm" onClick={clear}>{t('Počisti')}</button>
      <button className="primary sm" disabled={!name} onClick={() => dirty.current && onSave(ref.current!.toDataURL('image/png'), name)}>✍️ {t('Podpiši')}</button></div>
  </div>
}

const hrs = (te: any[]) => te.reduce((s, e) => s + (e.end ? (new Date(e.end).getTime() - new Date(e.start).getTime()) / 3600000 : 0), 0)

export function WorkOrderDetail({ id }: { id: number }) {
  const [w, setW] = useState<Row>()
  const [cust, setCust] = useState<Row>()
  const [site, setSite] = useState<Row>()
  const [toast, setToast] = useState('')
  const [products] = useLoad(() => list('products'), [])
  const [newItem, setNewItem] = useState('')
  const [, tick] = useState(0)
  const load = async () => { const x = await getOne('workorders', id); setW(x); if (x.customer_id) setCust(await getOne('customers', x.customer_id)); if (x.site_id) getOne('sites', x.site_id).then(setSite).catch(() => {}) }
  useEffect(() => { load() }, [id])
  useEffect(() => { const i = setInterval(() => tick((x) => x + 1), 30000); return () => clearInterval(i) }, [])
  if (!w) return <div className="muted">{t('Nalaganje…')}</div>
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2000) }
  const patch = async (p: Partial<Row>) => { const r = await saveRow('workorders', { id, ...p }); setW(r); flash(t('Shranjeno')) }
  const cl: any[] = w.checklist ?? [], te: any[] = w.time_entries ?? [], mats: any[] = w.materials ?? []
  const running = te.find((e) => !e.end)
  const set = (k: string, v: any) => setW({ ...w, [k]: v })
  const toInvoice = async () => {
    const delo = products?.find((p) => p.sku === 'DELO')
    const lines: Line[] = []
    const h = Math.round(hrs(te) * 4) / 4
    if (h > 0) lines.push({ description: `${delo?.name ?? 'Delo'} – ${w.title}`, qty: h, unit: 'h', price: delo?.price ?? 35, vat_rate: delo?.vat_rate ?? 22, discount_pct: 0, product_id: delo?.id })
    for (const m of mats) lines.push({ description: m.name, qty: m.qty, unit: m.unit, price: m.price, vat_rate: m.vat_rate ?? 22, discount_pct: 0, product_id: m.product_id })
    const tt = totals(lines)
    const due = new Date(Date.now() + 15 * 86400000).toLocaleDateString('sv-SE')
    const inv = await saveRow('invoices', { customer_id: w.customer_id, site_id: w.site_id, title: w.title, lines: tt.lines, service_date: (w.end ?? w.start ?? '').slice(0, 10) || undefined, due_date: due, notes: `Delovni nalog #${w.id}` })
    go('/invoices/' + inv.id)
  }
  return <div>
    <div className="topbar"><div><a href="#/workorders" className="muted small">← {t('Delovni nalogi')}</a><h2>#{w.id} {w.title}</h2>
      <div className="row"><Badge s={w.status} />{cust && <a href={'#/customers/' + cust.id}>{custName(cust)}</a>}<span className="muted">{fmtDT(w.start)} – {fmtDT(w.end)}</span></div></div>
      <div className="row">{cust?.phone && <a className="btn" href={'tel:' + cust.phone}>📞</a>}
        {w.status !== 'in_progress' && w.status !== 'done' && <button onClick={() => patch({ status: 'in_progress', time_entries: [...te, { start: localISO(new Date()) }] })}>▶ {t('Start')}</button>}
        {w.status !== 'done' && <button className="primary" onClick={() => patch({ status: 'done', time_entries: te.map((e) => (e.end ? e : { ...e, end: localISO(new Date()) })) })}>✔ {t('Zaključeno')}</button>}
        <button onClick={toInvoice}>🧾 {t('Ustvari račun')}</button></div></div>
    <div className="grid2">
      <div className="card"><Fields fields={workorderFields} row={w} set={set} res="workorders" />
        <label className="full" style={{ marginTop: 12 }}>{t('Poročilo')}<textarea rows={4} value={w.report ?? ''} onChange={(e) => set('report', e.target.value)} /></label>
        <div className="row end" style={{ marginTop: 10 }}><button className="primary" onClick={() => patch({ ...w, checklist: undefined, time_entries: undefined, materials: undefined, signature: undefined })}>{t('Shrani')}</button></div></div>
      <div>
        {(site ?? cust) && <div className="card"><h3>📍 {site?.name ?? custName(cust)}</h3><div className="small">{[(site ?? cust)?.address, (site ?? cust)?.city].filter(Boolean).join(', ')}</div>
          {site?.access_info && <div className="note small">🔑 {site.access_info}</div>}<Map lat={(site ?? cust)?.lat} lng={(site ?? cust)?.lng} h={180} />
          {cust && <a href={`#/customers/${cust.id}/equipment`} className="small">→ {t('Oprema')}</a>}</div>}
        <div className="card"><h3>{t('Kontrolni seznam')} ({cl.filter((c) => c.done).length}/{cl.length})</h3>
          {cl.map((c, i) => <label key={i} className="chk"><input type="checkbox" checked={!!c.done} onChange={(e) => patch({ checklist: cl.map((x, j) => (j === i ? { ...x, done: e.target.checked } : x)) })} /> {c.text}</label>)}
          <form className="row" onSubmit={(e) => { e.preventDefault(); if (newItem) { patch({ checklist: [...cl, { text: newItem, done: false }] }); setNewItem('') } }}><input value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder="+" /><button className="sm">{t('Dodaj')}</button></form></div>
      </div>
      <div className="card"><div className="topbar"><h3>⏱ {t('Evidenca časa')} – {t('Skupaj')}: {hrs(te.map((e) => (e.end ? e : { ...e, end: localISO(new Date()) }))).toFixed(2)} {t('ur')}</h3>
        {running ? <button className="danger" onClick={() => patch({ time_entries: te.map((e) => (e === running ? { ...e, end: localISO(new Date()) } : e)) })}>⏹ {t('Stop')}</button>
          : <button onClick={() => patch({ time_entries: [...te, { start: localISO(new Date()) }] })}>▶ {t('Start')}</button>}</div>
        {te.map((e, i) => <div className="row" key={i}><input type="datetime-local" value={e.start ?? ''} onChange={(x) => set('time_entries', te.map((y, j) => (j === i ? { ...y, start: x.target.value } : y)))} />
          <input type="datetime-local" value={e.end ?? ''} onChange={(x) => set('time_entries', te.map((y, j) => (j === i ? { ...y, end: x.target.value } : y)))} />
          <input placeholder={t('Opis')} value={e.note ?? ''} onChange={(x) => set('time_entries', te.map((y, j) => (j === i ? { ...y, note: x.target.value } : y)))} />
          <button className="sm danger" onClick={() => patch({ time_entries: te.filter((_, j) => j !== i) })}>✕</button></div>)}
        {te.length > 0 && <button className="sm" onClick={() => patch({ time_entries: te })}>{t('Shrani')}</button>}
      </div>
      <div className="card"><h3>📦 {t('Material')}</h3>
        <select value="" onChange={(e) => { const p = products?.find((x) => x.id === +e.target.value); if (p) patch({ materials: [...mats, { product_id: p.id, name: p.name, qty: 1, unit: p.unit, price: p.price, vat_rate: p.vat_rate }] }) }}>
          <option value="">+ {t('Iz kataloga')}</option>{products?.filter((p) => p.kind === 'product').map((p) => <option key={p.id} value={p.id}>{p.name} ({t('Zaloga')}: {p.stock ?? 0})</option>)}</select>
        {mats.map((m, i) => <div className="row" key={i}><span style={{ flex: 1 }}>{m.name}</span><input type="number" style={{ width: 80 }} value={m.qty} onChange={(e) => set('materials', mats.map((x, j) => (j === i ? { ...x, qty: +e.target.value } : x)))} onBlur={() => patch({ materials: mats })} />{m.unit}
          {m.consumed ? <span className="badge ok">✔</span> : <button className="sm" onClick={async () => { await api('/stock/move', { body: { product_id: m.product_id, qty: -m.qty, reason: 'Delovni nalog', ref: 'WO#' + w.id } }); patch({ materials: mats.map((x, j) => (j === i ? { ...x, consumed: true } : x)) }) }}>{t('Porabi iz skladišča')}</button>}
          <button className="sm danger" onClick={() => patch({ materials: mats.filter((_, j) => j !== i) })}>✕</button></div>)}
      </div>
      <div className="card"><h3>📷 {t('Fotografije')}</h3><DocumentsPanel filter={{ workorder_id: id, customer_id: w.customer_id }} compact /></div>
      <div className="card"><h3>✍️ {t('Podpis stranke')}</h3>
        <Signature value={w.signature} onSave={(sig, name) => patch({ signature: sig, signed_by: name })} />
        {w.signed_by && <div className="small muted">{t('Podpisal')}: {w.signed_by} · {fmtDT(w.signed_at)}</div>}</div>
    </div>
    <Toast msg={toast} />
  </div>
}
