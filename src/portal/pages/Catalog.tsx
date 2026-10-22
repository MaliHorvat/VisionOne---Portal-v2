import { useState } from 'react'
import { api, list, fmtMoney, fmtDT, type Row } from '../api'
import { t } from '../i18n'
import { useLoad, Table, EditModal, Modal } from '../ui'
import { productFields } from '../specs'

export function Catalog() {
  const [q, setQ] = useState(''), [kind, setKind] = useState('')
  const [rows, reload] = useLoad(() => list('products', { q, kind }), [q, kind])
  const [edit, setEdit] = useState<Partial<Row> | null>(null)
  return <div>
    <div className="topbar"><h2>{t('Katalog')}</h2><div className="row"><input placeholder={t('Išči…')} value={q} onChange={(e) => setQ(e.target.value)} />
      <select value={kind} onChange={(e) => setKind(e.target.value)}><option value="">{t('Vse')}</option><option value="product">{t('Izdelek')}</option><option value="service">{t('Storitev')}</option></select>
      <a className="btn" href="/api/export/products.csv">⬇ CSV</a><button className="primary" onClick={() => setEdit({ kind: 'product', unit: 'kos', vat_rate: 22 })}>+ {t('Dodaj')}</button></div></div>
    <div className="card"><Table rows={rows} onRow={(r) => setEdit({ ...r, vat_rate: String(r.vat_rate) })} cols={[{ k: 'sku', label: 'Šifra', render: (r) => <code>{r.sku}</code> }, { k: 'name', label: 'Naziv', render: (r) => <b>{r.name}</b> },
      { k: 'brand', label: 'Znamka' }, { k: 'category', label: 'Kategorija' }, { k: 'unit', label: 'EM' }, { k: 'price', label: 'Cena (brez DDV)', cls: 'num', render: (r) => fmtMoney(r.price) },
      { k: 'margin', label: 'Marža', cls: 'num', render: (r) => (r.cost ? Math.round((1 - r.cost / r.price) * 100) + ' %' : '') }, { k: 'vat_rate', label: 'DDV %', cls: 'num' },
      { k: 'stock', label: 'Zaloga', cls: 'num', render: (r) => (r.kind === 'product' ? r.stock ?? 0 : '—') }]} /></div>
    {edit && <EditModal title={t('Katalog')} res="products" fields={productFields} row={edit} onClose={() => setEdit(null)} onSaved={reload} />}
  </div>
}

export function Stock() {
  const [rows, reload] = useLoad(() => list('products', { kind: 'product' }), [])
  const [moves, reloadMoves] = useLoad(() => list('stock_moves'), [])
  const [mv, setMv] = useState<{ p: Row; qty: number; dir: 1 | -1; reason: string } | null>(null)
  const low = (rows ?? []).filter((r) => (r.min_stock ?? 0) > 0 && (r.stock ?? 0) < r.min_stock)
  const value = (rows ?? []).reduce((s, r) => s + (r.stock ?? 0) * (r.cost ?? 0), 0)
  const pn = (id: number) => rows?.find((r) => r.id === id)?.name
  return <div>
    <div className="topbar"><h2>{t('Skladišče')}</h2><div className="row muted">{t('Pod minimumom')}: <b>{low.length}</b> · Vrednost zaloge (nabavno): <b>{fmtMoney(value)}</b></div></div>
    <div className="card"><Table rows={rows} cols={[{ k: 'sku', label: 'Šifra', render: (r) => <code>{r.sku}</code> }, { k: 'name', label: 'Naziv' }, { k: 'location', label: 'Lokacija' },
      { k: 'stock', label: 'Zaloga', cls: 'num', render: (r) => <b className={(r.min_stock ?? 0) > 0 && (r.stock ?? 0) < r.min_stock ? 'bad' : ''}>{r.stock ?? 0} {r.unit}</b> }, { k: 'min_stock', label: 'Min. zaloga', cls: 'num' },
      { k: 'act', label: '', render: (r) => <div className="row nowrap"><button className="sm" onClick={() => setMv({ p: r, qty: 1, dir: 1, reason: 'Prevzem' })}>＋ {t('Prevzem')}</button><button className="sm" onClick={() => setMv({ p: r, qty: 1, dir: -1, reason: 'Izdaja' })}>－ {t('Izdaja')}</button></div> }]} /></div>
    <div className="card"><h3>{t('Gibanje zaloge')}</h3><Table rows={moves?.slice(0, 50)} cols={[{ k: 'created_at', label: 'Datum', render: (r) => fmtDT(r.created_at) }, { k: 'product_id', label: 'Izdelek', render: (r) => pn(r.product_id) },
      { k: 'qty', label: 'Količina', cls: 'num', render: (r) => <b className={r.qty < 0 ? 'bad' : 'good'}>{r.qty > 0 ? '+' : ''}{r.qty}</b> }, { k: 'reason', label: 'Razlog' }, { k: 'ref', label: 'Sklic' }]} /></div>
    {mv && <Modal title={`${t(mv.dir > 0 ? 'Prevzem' : 'Izdaja')}: ${mv.p.name}`} onClose={() => setMv(null)}><div className="form">
      <label>{t('Količina')}<input type="number" autoFocus value={mv.qty} onChange={(e) => setMv({ ...mv, qty: +e.target.value })} /></label>
      <label>{t('Razlog')}<input value={mv.reason} onChange={(e) => setMv({ ...mv, reason: e.target.value })} /></label></div>
      <div className="row end" style={{ marginTop: 12 }}><button className="primary" onClick={async () => { await api('/stock/move', { body: { product_id: mv.p.id, qty: mv.dir * mv.qty, reason: mv.reason } }); setMv(null); reload(); reloadMoves() }}>{t('Shrani')}</button></div></Modal>}
  </div>
}
