import { useEffect, useState, useCallback, type ReactNode } from 'react'
import { api, list, saveRow, delRow, type Row, custName } from './api'
import { t } from './i18n'

export function useLoad<T>(fn: () => Promise<T>, deps: any[] = []): [T | undefined, () => void, string] {
  const [v, setV] = useState<T>()
  const [err, setErr] = useState('')
  const load = useCallback(() => { fn().then((x) => { setV(x); setErr('') }).catch((e) => setErr(e.message)) }, deps) // eslint-disable-line
  useEffect(() => { load() }, [load])
  return [v, load, err]
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => { const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h) }, [onClose])
  return <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
    <div className={'modal' + (wide ? ' wide' : '')} role="dialog"><div className="topbar"><h2>{title}</h2><button className="sm" onClick={onClose}>✕</button></div>{children}</div>
  </div>
}

export type Field = { k: string; label: string; type?: 'text' | 'number' | 'date' | 'datetime' | 'select' | 'textarea' | 'checkbox' | 'secret' | 'customer' | 'site' | 'email' | 'tel'; opts?: [string, string][]; full?: boolean; step?: string; res?: string }

function Lookup({ res, value, onChange, filter }: { res: string; value: any; onChange: (v: any) => void; filter?: Record<string, any> }) {
  const [rows] = useLoad(() => list(res, filter ?? {}), [res, JSON.stringify(filter)])
  return <select value={value ?? ''} onChange={(e) => onChange(e.target.value ? +e.target.value : null)}>
    <option value="">—</option>{rows?.map((r) => <option key={r.id} value={r.id}>{res === 'customers' ? custName(r) : r.name}</option>)}
  </select>
}

function SecretInput({ res, row, k, value, onChange }: { res: string; row: Row; k: string; value: any; onChange: (v: any) => void }) {
  const [shown, setShown] = useState(false)
  const reveal = async () => { const r = await api(`/r/${res}/${row.id}/secret/${k}`); onChange(r.value); setShown(true) }
  return <div className="row nowrap">
    <input type={shown ? 'text' : 'password'} value={value ?? ''} autoComplete="new-password" placeholder={row['has_' + k] ? '•••••••• (' + t('shranjeno šifrirano') + ')' : ''} onChange={(e) => onChange(e.target.value)} style={{ flex: 1 }} />
    {row.id && row['has_' + k] && !shown ? <button type="button" className="sm" onClick={reveal}>👁 {t('Pokaži')}</button> : null}
  </div>
}

export function Fields({ fields, row, set, res }: { fields: Field[]; row: Row; set: (k: string, v: any) => void; res: string }) {
  return <div className="form">{fields.map((f) => {
    const v = row[f.k]
    let input: ReactNode
    switch (f.type) {
      case 'textarea': input = <textarea rows={3} value={v ?? ''} onChange={(e) => set(f.k, e.target.value)} />; break
      case 'select': input = <select value={v ?? ''} onChange={(e) => set(f.k, e.target.value)}>{f.opts!.map(([o, l]) => <option key={o} value={o}>{t(l)}</option>)}</select>; break
      case 'checkbox': input = <input type="checkbox" checked={!!v} onChange={(e) => set(f.k, e.target.checked ? 1 : 0)} />; break
      case 'number': input = <input type="number" step={f.step ?? 'any'} value={v ?? ''} onChange={(e) => set(f.k, e.target.value === '' ? null : +e.target.value)} />; break
      case 'date': input = <input type="date" value={v ?? ''} onChange={(e) => set(f.k, e.target.value)} />; break
      case 'datetime': input = <input type="datetime-local" value={v ?? ''} onChange={(e) => set(f.k, e.target.value)} />; break
      case 'secret': input = <SecretInput res={res} row={row} k={f.k} value={v} onChange={(x) => set(f.k, x)} />; break
      case 'customer': input = <Lookup res="customers" value={v} onChange={(x) => set(f.k, x)} />; break
      case 'site': input = <Lookup res="sites" value={v} onChange={(x) => set(f.k, x)} filter={row.customer_id ? { customer_id: row.customer_id } : {}} />; break
      default: input = <input type={f.type ?? 'text'} value={v ?? ''} onChange={(e) => set(f.k, e.target.value)} />
    }
    return <label key={f.k} className={(f.full ? 'full ' : '') + (f.type === 'checkbox' ? 'chk' : '')} data-k={f.k}>{t(f.label)}{input}</label>
  })}</div>
}

export function EditModal({ title, res, fields, row, onClose, onSaved, extra }: { title: string; res: string; fields: Field[]; row: Partial<Row>; onClose: () => void; onSaved: (r: Row) => void; extra?: (r: Row, set: (k: string, v: any) => void) => ReactNode }) {
  const [r, setR] = useState<Row>({ ...(row as Row) })
  const [err, setErr] = useState('')
  const set = (k: string, v: any) => setR((o) => ({ ...o, [k]: v }))
  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    try { const out = await saveRow(res, r); onSaved(out); onClose() } catch (x: any) { setErr(x.message) }
  }
  const del = async () => { if (!confirm(t('Res želite izbrisati?'))) return; try { await delRow(res, r.id); onSaved({ ...r, _deleted: true }); onClose() } catch (x: any) { setErr(x.message) } }
  return <Modal title={title} onClose={onClose}><form onSubmit={save}>
    <Fields fields={fields} row={r} set={set} res={res} />
    {extra?.(r, set)}
    {err && <div className="err">{err}</div>}
    <div className="row end" style={{ marginTop: 16 }}>
      {r.id ? <button type="button" className="danger" onClick={del}>{t('Izbriši')}</button> : null}
      <span className="spacer" /><button type="button" onClick={onClose}>{t('Prekliči')}</button><button className="primary" type="submit">{t('Shrani')}</button>
    </div>
  </form></Modal>
}

export type ColDef = { k: string; label: string; render?: (r: Row) => ReactNode; cls?: string }
export function Table({ rows, cols, onRow, empty }: { rows?: Row[]; cols: ColDef[]; onRow?: (r: Row) => void; empty?: string }) {
  if (!rows) return <div className="muted">{t('Nalaganje…')}</div>
  if (!rows.length) return <div className="muted pad">{empty ?? t('Ni podatkov')}</div>
  return <div className="tablewrap"><table><thead><tr>{cols.map((c) => <th key={c.k} className={c.cls}>{t(c.label)}</th>)}</tr></thead>
    <tbody>{rows.map((r) => <tr key={r.id} onClick={() => onRow?.(r)} className={onRow ? 'click' : ''}>{cols.map((c) => <td key={c.k} className={c.cls}>{c.render ? c.render(r) : r[c.k]}</td>)}</tr>)}</tbody></table></div>
}

export function Tabs({ tabs, cur, set }: { tabs: [string, string][]; cur: string; set: (k: string) => void }) {
  return <div className="tabs">{tabs.map(([k, l]) => <button key={k} className={cur === k ? 'on' : ''} onClick={() => set(k)}>{t(l)}</button>)}</div>
}

export const statusLabels: Record<string, string> = {
  draft: 'Osnutek', sent: 'Poslano', accepted: 'Sprejeto', rejected: 'Zavrnjeno', issued: 'Izdan', partial: 'Delno plačan', paid: 'Plačan', cancelled: 'Storniran',
  planned: 'Planirano', in_progress: 'V teku', on_hold: 'Čaka', done: 'Zaključeno', ok: 'Deluje', fault: 'Napaka', removed: 'Odstranjeno',
}
const statusCls: Record<string, string> = { paid: 'ok', done: 'ok', accepted: 'ok', ok: 'ok', issued: 'warning', partial: 'warning', sent: 'info', in_progress: 'info', planned: 'info', fault: 'critical', rejected: 'critical', cancelled: 'off', removed: 'off' }
export const Badge = ({ s, overdue }: { s?: string; overdue?: boolean }) => s ? <span className={'badge ' + (overdue ? 'critical' : statusCls[s] ?? '')}>{t(overdue ? 'Zapadlo' : statusLabels[s] ?? s)}</span> : null

export function Toast({ msg }: { msg: string }) { return msg ? <div className="toast ok">{msg}</div> : null }
