import { useEffect, useRef, useState } from 'react'
import { list, getOne, saveRow, upload, type Row } from '../api'
import { t } from '../i18n'
import { Toast } from '../ui'
import { equipIcon } from '../specs'

type Item = { id: string; kind: 'equipment' | 'label' | 'room' | 'cable'; equipment_id?: number; x: number; y: number; x2?: number; y2?: number; w?: number; h?: number; rot?: number; text?: string }
const uid = () => Math.random().toString(36).slice(2, 9)
const W = 1000

export function DiagramEditor({ id }: { id: number }) {
  const [d, setD] = useState<Row>()
  const [items, setItems] = useState<Item[]>([])
  const [eq, setEq] = useState<Row[]>([])
  const [imgs, setImgs] = useState<Row[]>([])
  const [sel, setSel] = useState<string | null>(null)
  const [ratio, setRatio] = useState(0.65)
  const [toast, setToast] = useState('')
  const [dirty, setDirty] = useState(false)
  const svg = useRef<SVGSVGElement>(null)
  const drag = useRef<{ id: string; part: 'm' | 'p2' | 'size'; ox: number; oy: number } | null>(null)
  useEffect(() => { getOne('diagrams', id).then((x) => { setD(x); setItems(x.items ?? []) }) }, [id])
  useEffect(() => { if (!d) return
    list('equipment', d.site_id ? { site_id: d.site_id } : { customer_id: d.customer_id }).then(setEq)
    list('documents', { customer_id: d.customer_id }).then((x) => setImgs(x.filter((r) => r.mime?.startsWith('image/')))) }, [d?.id])
  useEffect(() => { if (!d?.background_id) { setRatio(0.65); return } const im = new Image(); im.onload = () => setRatio(im.naturalHeight / im.naturalWidth); im.src = `/api/files/${d.background_id}` }, [d?.background_id])
  useEffect(() => { const k = (e: KeyboardEvent) => { if ((e.key === 'Delete' || e.key === 'Backspace') && sel && !(e.target instanceof HTMLInputElement)) { setItems((it) => it.filter((i) => i.id !== sel)); setSel(null); setDirty(true) } }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [sel])
  if (!d) return <div className="muted">{t('Nalaganje…')}</div>
  const H = W * ratio
  const upd = (iid: string, p: Partial<Item>) => { setItems((it) => it.map((i) => (i.id === iid ? { ...i, ...p } : i))); setDirty(true) }
  const pt = (e: React.PointerEvent) => { const r = svg.current!.getBoundingClientRect(); return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) } }
  const start = (e: React.PointerEvent, it: Item, part: 'm' | 'p2' | 'size' = 'm') => { e.stopPropagation(); setSel(it.id); const p = pt(e); drag.current = { id: it.id, part, ox: p.x - (part === 'p2' ? it.x2! : it.x), oy: p.y - (part === 'p2' ? it.y2! : it.y) }; svg.current!.setPointerCapture(e.pointerId) }
  const move = (e: React.PointerEvent) => {
    const g = drag.current; if (!g) return; const p = pt(e); const it = items.find((i) => i.id === g.id)!
    if (g.part === 'm') { const nx = p.x - g.ox, ny = p.y - g.oy; const dx = nx - it.x, dy = ny - it.y; upd(g.id, it.kind === 'cable' ? { x: nx, y: ny, x2: it.x2! + dx, y2: it.y2! + dy } : { x: nx, y: ny }) }
    else if (g.part === 'p2') upd(g.id, { x2: p.x, y2: p.y })
    else upd(g.id, { w: Math.max(0.03, p.x - it.x), h: Math.max(0.03, p.y - it.y) })
  }
  const add = (it: Omit<Item, 'id'>) => { const n = { ...it, id: uid() } as Item; setItems([...items, n]); setSel(n.id); setDirty(true) }
  const save = async () => { const r = await saveRow('diagrams', { id, items, background_id: d.background_id ?? null, name: d.name }); setD(r); setDirty(false); setToast(t('Shranjeno')); setTimeout(() => setToast(''), 1500) }
  const placed = new Set(items.filter((i) => i.kind === 'equipment').map((i) => i.equipment_id))
  const s = items.find((i) => i.id === sel)
  const eqOf = (i: Item) => eq.find((e) => e.id === i.equipment_id)
  return <div className="diagram">
    <div className="topbar noprint"><div><a href={`#/customers/${d.customer_id}/diagrams`} className="muted small">← {t('Sheme')}</a>
      <h2><input className="title-in" value={d.name} onChange={(e) => { setD({ ...d, name: e.target.value }); setDirty(true) }} /></h2></div>
      <div className="row"><button onClick={() => window.print()}>🖨 {t('Natisni')}</button><button className="primary" disabled={!dirty} onClick={save}>💾 {t('Shrani')}</button></div></div>
    <div className="dg-wrap">
      <div className="dg-tools noprint card">
        <label>{t('Ozadje (tloris)')}<select value={d.background_id ?? ''} onChange={(e) => { setD({ ...d, background_id: +e.target.value || null }); setDirty(true) }}>
          <option value="">{t('Brez ozadja (mreža)')}</option>{imgs.map((i) => <option key={i.id} value={i.id}>{i.title}</option>)}</select></label>
        <label className="btn-file sm">📤 {t('Naloži')} {t('Tloris').toLowerCase()}<input type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; const doc = await upload(f, { customer_id: d.customer_id, site_id: d.site_id, kind: 'schematic', title: f.name }); setImgs([doc, ...imgs]); setD({ ...d, background_id: doc.id }); setDirty(true) }} /></label>
        <h3>{t('Postavi napravo')}</h3>
        <div className="dg-eq">{eq.map((e) => <button key={e.id} className="sm" disabled={placed.has(e.id)} onClick={() => add({ kind: 'equipment', equipment_id: e.id, x: 0.5, y: 0.5, rot: 0 })}>{equipIcon[e.type] ?? '⚙'} {e.name}</button>)}</div>
        <div className="row"><button className="sm" onClick={() => add({ kind: 'label', x: 0.5, y: 0.5, text: t('Napis') })}>🔤 {t('Napis')}</button>
          <button className="sm" onClick={() => add({ kind: 'room', x: 0.3, y: 0.3, w: 0.25, h: 0.2, text: t('Prostor') })}>⬜ {t('Prostor')}</button>
          <button className="sm" onClick={() => add({ kind: 'cable', x: 0.4, y: 0.4, x2: 0.6, y2: 0.4 })}>〰 {t('Kabel')}</button></div>
        {s && <div className="dg-sel">
          <h3>{s.kind === 'equipment' ? eqOf(s)?.name : t(s.kind === 'label' ? 'Napis' : s.kind === 'room' ? 'Prostor' : 'Kabel')}</h3>
          {s.kind === 'equipment' && eqOf(s) && <div className="small muted">{eqOf(s)!.brand} {eqOf(s)!.model}<br />{eqOf(s)!.ip}</div>}
          {(s.kind === 'label' || s.kind === 'room' || s.kind === 'cable') && <label>{t('Napis')}<input value={s.text ?? ''} onChange={(e) => upd(s.id, { text: e.target.value })} /></label>}
          {s.kind === 'equipment' && <label>{t('Zasuk')} {s.rot ?? 0}°<input type="range" min={0} max={359} value={s.rot ?? 0} onChange={(e) => upd(s.id, { rot: +e.target.value })} /></label>}
          <button className="sm danger" onClick={() => { setItems(items.filter((i) => i.id !== s.id)); setSel(null); setDirty(true) }}>{t('Izbriši')}</button></div>}
        <p className="muted small">{t('Povleci elemente. Dvoklik za brisanje.')}</p>
      </div>
      <div className="dg-canvas">
        <svg ref={svg} viewBox={`0 0 ${W} ${H}`} onPointerMove={move} onPointerUp={() => (drag.current = null)} onPointerDown={() => setSel(null)} className="dg-svg">
          <defs><pattern id="grid" width="25" height="25" patternUnits="userSpaceOnUse"><path d="M25 0H0V25" fill="none" stroke="#24314f" strokeWidth="1" /></pattern></defs>
          <rect width={W} height={H} fill="url(#grid)" />
          {d.background_id && <image href={`/api/files/${d.background_id}`} width={W} height={H} preserveAspectRatio="none" opacity={0.9} />}
          {items.filter((i) => i.kind === 'room').map((i) => <g key={i.id} onPointerDown={(e) => start(e, i)} onDoubleClick={() => { setItems(items.filter((x) => x.id !== i.id)); setDirty(true) }}>
            <rect x={i.x * W} y={i.y * H} width={(i.w ?? 0.2) * W} height={(i.h ?? 0.2) * H} fill="#3b82f612" stroke={sel === i.id ? '#22d3ee' : '#8a9bb8'} strokeWidth={3} />
            <text x={i.x * W + 8} y={i.y * H + 22} fill="#e5ecf6" fontSize="18">{i.text}</text>
            <rect x={(i.x + (i.w ?? 0.2)) * W - 8} y={(i.y + (i.h ?? 0.2)) * H - 8} width={16} height={16} fill="#22d3ee" style={{ cursor: 'nwse-resize' }} onPointerDown={(e) => start(e, i, 'size')} /></g>)}
          {items.filter((i) => i.kind === 'cable').map((i) => <g key={i.id} onDoubleClick={() => { setItems(items.filter((x) => x.id !== i.id)); setDirty(true) }}>
            <line x1={i.x * W} y1={i.y * H} x2={i.x2! * W} y2={i.y2! * H} stroke={sel === i.id ? '#22d3ee' : '#f59e0b'} strokeWidth={4} strokeDasharray="10 6" onPointerDown={(e) => start(e, i)} />
            {i.text && <text x={(i.x + i.x2!) / 2 * W} y={(i.y + i.y2!) / 2 * H - 8} fill="#f59e0b" fontSize="14" textAnchor="middle">{i.text}</text>}
            <circle cx={i.x2! * W} cy={i.y2! * H} r={9} fill="#f59e0b" onPointerDown={(e) => start(e, i, 'p2')} /></g>)}
          {items.filter((i) => i.kind === 'equipment').map((i) => { const e = eqOf(i); const cam = e?.type === 'camera'
            return <g key={i.id} transform={`translate(${i.x * W} ${i.y * H})`} onPointerDown={(ev) => start(ev, i)} onDoubleClick={() => { setItems(items.filter((x) => x.id !== i.id)); setDirty(true) }} style={{ cursor: 'move' }}>
              {cam && <path d="M0 0 L120 -45 A128 128 0 0 1 120 45 Z" fill="#22d3ee30" stroke="#22d3ee80" transform={`rotate(${i.rot ?? 0})`} />}
              <circle r={22} fill="#121a2e" stroke={sel === i.id ? '#22d3ee' : e?.status === 'fault' ? '#ef4444' : '#3b82f6'} strokeWidth={3} />
              <text y={8} fontSize="22" textAnchor="middle">{equipIcon[e?.type ?? 'other']}</text>
              <text y={42} fontSize="15" textAnchor="middle" fill="#e5ecf6" stroke="#0b1020" strokeWidth={4} paintOrder="stroke">{e?.name ?? '?'}</text>
              {e?.ip && <text y={58} fontSize="12" textAnchor="middle" fill="#8a9bb8" stroke="#0b1020" strokeWidth={3} paintOrder="stroke">{e.ip}</text>}</g> })}
          {items.filter((i) => i.kind === 'label').map((i) => <text key={i.id} x={i.x * W} y={i.y * H} fontSize="20" fontWeight="600" fill={sel === i.id ? '#22d3ee' : '#e5ecf6'} stroke="#0b1020" strokeWidth={4} paintOrder="stroke" textAnchor="middle"
            onPointerDown={(e) => start(e, i)} onDoubleClick={() => { setItems(items.filter((x) => x.id !== i.id)); setDirty(true) }} style={{ cursor: 'move' }}>{i.text}</text>)}
        </svg>
        <div className="dg-legend">{items.filter((i) => i.kind === 'equipment').map((i) => { const e = eqOf(i); return e ? <span key={i.id}>{equipIcon[e.type]} {e.name} – {e.brand} {e.model} {e.ip}</span> : null })}</div>
      </div>
    </div>
    <Toast msg={toast} />
  </div>
}
