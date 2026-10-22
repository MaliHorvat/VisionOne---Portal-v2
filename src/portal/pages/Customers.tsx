import { useState } from 'react'
import { list, getOne, saveRow, upload, delRow, fmtDate, fmtDT, fmtMoney, custName, type Row } from '../api'
import { t } from '../i18n'
import { useLoad, Table, Tabs, EditModal, Badge, Modal } from '../ui'
import { customerFields, siteFields, equipmentFields, networkFields, equipTypes, equipIcon, contractFields, workorderFields } from '../specs'
import { go } from '../main'

export function CustomerList() {
  const [q, setQ] = useState('')
  const [rows, reload] = useLoad(() => list('customers', { q }), [q])
  const [edit, setEdit] = useState<Partial<Row> | null>(null)
  return <div>
    <div className="topbar"><h2>{t('Stranke')}</h2><div className="row"><input placeholder={t('Išči…')} value={q} onChange={(e) => setQ(e.target.value)} />
      <button className="primary" onClick={() => setEdit({ kind: 'person', country: 'Slovenija' })}>+ {t('Nova stranka')}</button></div></div>
    <div className="card"><Table rows={rows} onRow={(r) => go('/customers/' + r.id)} cols={[
      { k: 'name', label: 'Ime', render: (r) => <><b>{custName(r)}</b>{r.company && <div className="muted small">{r.name}</div>}</> },
      { k: 'kind', label: 'Vrsta', render: (r) => t(r.kind === 'company' ? 'Podjetje' : 'Oseba') }, { k: 'city', label: 'Kraj' },
      { k: 'phone', label: 'Telefon', render: (r) => r.phone && <a href={'tel:' + r.phone} onClick={(e) => e.stopPropagation()}>{r.phone}</a> }, { k: 'email', label: 'E-pošta' }, { k: 'vat_id', label: 'Davčna / ID za DDV' }]} /></div>
    {edit && <EditModal title={t('Nova stranka')} res="customers" fields={customerFields} row={edit} onClose={() => setEdit(null)} onSaved={(r) => { reload(); if (!r._deleted) go('/customers/' + r.id) }} />}
  </div>
}

const tabs: [string, string][] = [['overview', 'Pregled'], ['sites', 'Objekti'], ['equipment', 'Oprema'], ['network', 'Omrežje'], ['documents', 'Dokumenti'], ['diagrams', 'Sheme'],
  ['workorders', 'Delovni nalogi'], ['quotes', 'Ponudbe'], ['invoices', 'Računi'], ['contracts', 'Pogodbe']]

export function Map({ lat, lng, h = 260 }: { lat?: number; lng?: number; h?: number }) {
  if (!lat || !lng) return <div className="mapph muted">{t('Zemljevid')}: GPS —</div>
  const d = 0.004
  return <div><iframe className="map" style={{ height: h }} title="map" loading="lazy" src={`https://www.openstreetmap.org/export/embed.html?bbox=${lng - d},${lat - d / 2},${lng + d},${lat + d / 2}&layer=mapnik&marker=${lat},${lng}`} />
    <div className="row small"><a href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`} target="_blank" rel="noreferrer">🧭 {t('Navigacija')}</a>
      <a href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=18/${lat}/${lng}`} target="_blank" rel="noreferrer">OSM</a><span className="muted">{lat.toFixed(5)}, {lng.toFixed(5)}</span></div></div>
}

export function gps(): Promise<{ lat: number; lng: number }> {
  return new Promise((res, rej) => navigator.geolocation ? navigator.geolocation.getCurrentPosition((p) => res({ lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6) }), (e) => rej(e), { enableHighAccuracy: true, timeout: 15000 }) : rej(new Error('no geolocation')))
}

function Contacts({ c, reload }: { c: Row; reload: () => void }) {
  const [rows, setRows] = useState<any[]>(c.contacts ?? [])
  const [dirty, setDirty] = useState(false)
  const upd = (i: number, k: string, v: string) => { setRows(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r))); setDirty(true) }
  return <div className="card"><div className="topbar"><h3>{t('Kontakti')}</h3><div className="row"><button className="sm" onClick={() => { setRows([...rows, {}]); setDirty(true) }}>+ {t('Dodaj')}</button>
    {dirty && <button className="sm primary" onClick={async () => { await saveRow('customers', { id: c.id, contacts: rows.filter((r) => r.name || r.phone) }); setDirty(false); reload() }}>{t('Shrani')}</button>}</div></div>
    {rows.length === 0 && <div className="muted">{t('Ni podatkov')}</div>}
    {rows.map((r, i) => <div className="row contact" key={i}>
      <input placeholder={t('Ime')} value={r.name ?? ''} onChange={(e) => upd(i, 'name', e.target.value)} />
      <input placeholder={t('Vloga')} value={r.role ?? ''} onChange={(e) => upd(i, 'role', e.target.value)} />
      <input placeholder={t('Telefon')} value={r.phone ?? ''} onChange={(e) => upd(i, 'phone', e.target.value)} />
      <input placeholder={t('E-pošta')} value={r.email ?? ''} onChange={(e) => upd(i, 'email', e.target.value)} />
      {r.phone && <a className="btn sm" href={'tel:' + r.phone}>📞</a>}
      <button className="sm danger" onClick={() => { setRows(rows.filter((_, j) => j !== i)); setDirty(true) }}>✕</button>
    </div>)}
  </div>
}

export function CustomerDetail({ id, tab }: { id: number; tab: string }) {
  const [c, reload] = useLoad(() => getOne('customers', id), [id])
  const [edit, setEdit] = useState(false)
  const [sites, reloadSites] = useLoad(() => list('sites', { customer_id: id }), [id])
  if (!c) return <div className="muted">{t('Nalaganje…')}</div>
  const setTab = (k: string) => go(`/customers/${id}/${k}`)
  const ctx = { c, sites: sites ?? [], reloadSites }
  return <div>
    <div className="topbar"><div><a href="#/customers" className="muted small">← {t('Stranke')}</a><h2>{custName(c)}</h2>
      <div className="muted small">{[c.address, [c.post, c.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')} {c.vat_id && '· ' + c.vat_id}</div></div>
      <div className="row">{c.phone && <a className="btn" href={'tel:' + c.phone}>📞 {c.phone}</a>}{c.email && <a className="btn" href={'mailto:' + c.email}>✉️</a>}<button onClick={() => setEdit(true)}>✏️ {t('Uredi')}</button></div></div>
    <Tabs tabs={tabs} cur={tab} set={setTab} />
    {tab === 'overview' && <Overview {...ctx} reload={reload} />}
    {tab === 'sites' && <Sites {...ctx} />}
    {tab === 'equipment' && <Equipment {...ctx} />}
    {tab === 'network' && <Network {...ctx} />}
    {tab === 'documents' && <DocumentsPanel filter={{ customer_id: id }} sites={sites} />}
    {tab === 'diagrams' && <Diagrams {...ctx} />}
    {tab === 'workorders' && <CustWorkorders c={c} />}
    {tab === 'quotes' && <CustDocs kind="quotes" c={c} />}
    {tab === 'invoices' && <CustDocs kind="invoices" c={c} />}
    {tab === 'contracts' && <CustContracts c={c} />}
    {edit && <EditModal title={custName(c)} res="customers" fields={customerFields} row={c} onClose={() => setEdit(false)} onSaved={(r) => (r._deleted ? go('/customers') : reload())}
      extra={(r, set) => <button type="button" className="sm" style={{ marginTop: 10 }} onClick={async () => { const p = await gps(); set('lat', p.lat); set('lng', p.lng) }}>📍 {t('Moja lokacija')}</button>} />}
  </div>
}

type Ctx = { c: Row; sites: Row[]; reloadSites: () => void }

function Overview({ c, sites, reload }: Ctx & { reload: () => void }) {
  return <div className="grid2">
    <div className="card"><h3>{t('Pregled')}</h3>
      <dl className="dl">
        <dt>{t('Vrsta')}</dt><dd>{t(c.kind === 'company' ? 'Podjetje' : 'Oseba')}{c.vat_payer ? ' · ' + t('Zavezanec za DDV') : ''}</dd>
        <dt>{t('Davčna / ID za DDV')}</dt><dd>{c.vat_id}</dd><dt>{t('Matična številka')}</dt><dd>{c.reg_no}</dd>
        <dt>{t('Telefon')}</dt><dd>{c.phone}</dd><dt>{t('E-pošta')}</dt><dd>{c.email}</dd>
        <dt>{t('Rok plačila (dni)')}</dt><dd>{c.payment_days}</dd><dt>{t('Oznake')}</dt><dd>{c.tags}</dd>
      </dl>
      {c.notes && <div className="note">📝 {c.notes}</div>}
    </div>
    <div className="card"><h3>{t('Zemljevid')}</h3><Map lat={c.lat} lng={c.lng} /></div>
    <Contacts c={c} reload={reload} />
    <div className="card"><h3>{t('Objekti')}</h3><Table rows={sites} onRow={() => go(`/customers/${c.id}/sites`)} cols={[{ k: 'name', label: 'Ime' }, { k: 'address', label: 'Naslov' }, { k: 'city', label: 'Kraj' }]} /></div>
  </div>
}

function Sites({ c, sites, reloadSites }: Ctx) {
  const [edit, setEdit] = useState<Partial<Row> | null>(null)
  return <div>
    <div className="row end"><button className="primary" onClick={() => setEdit({ customer_id: c.id, address: c.address, post: c.post, city: c.city, lat: c.lat, lng: c.lng })}>+ {t('Dodaj')} {t('Objekt').toLowerCase()}</button></div>
    <div className="grid2">{sites.map((s) => <div className="card" key={s.id}>
      <div className="topbar"><h3>🏠 {s.name}</h3><button className="sm" onClick={() => setEdit(s)}>✏️</button></div>
      <div className="muted small">{[s.address, s.post, s.city].filter(Boolean).join(', ')}</div>
      {s.internet && <div className="small">🌐 {s.internet}</div>}
      {s.access_info && <div className="note small">🔑 {s.access_info}</div>}
      <div className="small muted">{s.has_alarm_code ? '🚨 ' + t('Alarmna koda') + ' · ' + t('shranjeno šifrirano') : ''}</div>
      <Map lat={s.lat} lng={s.lng} h={160} />
    </div>)}</div>
    {sites.length === 0 && <div className="muted">{t('Ni podatkov')}</div>}
    {edit && <EditModal title={t('Objekt')} res="sites" fields={siteFields} row={edit} onClose={() => setEdit(null)} onSaved={reloadSites}
      extra={(r, set) => <button type="button" className="sm" style={{ marginTop: 10 }} onClick={async () => { const p = await gps(); set('lat', p.lat); set('lng', p.lng) }}>📍 {t('Moja lokacija')}</button>} />}
  </div>
}

const typeLabel = (k: string) => t(equipTypes.find((x) => x[0] === k)?.[1] ?? k ?? '')

function Equipment({ c, sites }: Ctx) {
  const [site, setSite] = useState('')
  const [type, setType] = useState('')
  const [rows, reload] = useLoad(() => list('equipment', { customer_id: c.id, site_id: site, type }), [c.id, site, type])
  const [edit, setEdit] = useState<Partial<Row> | null>(null)
  const sname = (id: number) => sites.find((s) => s.id === id)?.name ?? ''
  return <div>
    <div className="topbar"><div className="row">
      <select value={site} onChange={(e) => setSite(e.target.value)}><option value="">{t('Objekti')}: {t('Vse')}</option>{sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
      <select value={type} onChange={(e) => setType(e.target.value)}><option value="">{t('Tip')}: {t('Vse')}</option>{equipTypes.map(([k, l]) => <option key={k} value={k}>{t(l)}</option>)}</select>
      <span className="muted">{rows?.length ?? 0} ×</span></div>
      <button className="primary" onClick={() => setEdit({ customer_id: c.id, site_id: site ? +site : sites[0]?.id, type: 'camera', status: 'ok', install_date: new Date().toLocaleDateString('sv-SE') })}>+ {t('Dodaj')}</button></div>
    <div className="card"><Table rows={rows} onRow={setEdit} cols={[
      { k: 'type', label: 'Tip', render: (r) => <span title={typeLabel(r.type)}>{equipIcon[r.type] ?? '⚙'} {typeLabel(r.type)}</span> }, { k: 'name', label: 'Ime', render: (r) => <b>{r.name}</b> },
      { k: 'brand', label: 'Znamka', render: (r) => `${r.brand ?? ''} ${r.model ?? ''}` }, { k: 'serial', label: 'Serijska št.' },
      { k: 'ip', label: 'IP', render: (r) => r.ip && <code>{r.ip}</code> }, { k: 'mac', label: 'MAC' }, { k: 'firmware', label: 'Firmware' },
      { k: 'site_id', label: 'Objekt', render: (r) => sname(r.site_id) }, { k: 'warranty_until', label: 'Garancija do', render: (r) => fmtDate(r.warranty_until) },
      { k: 'pw', label: 'Geslo', render: (r) => (r.has_password ? '🔒' : '') }, { k: 'status', label: 'Stanje', render: (r) => <Badge s={r.status} /> }]} /></div>
    {edit && <EditModal title={t('Oprema')} res="equipment" fields={equipmentFields} row={edit} onClose={() => setEdit(null)} onSaved={reload}
      extra={(r) => r.ip ? <div className="row small" style={{ marginTop: 10 }}><a href={'http://' + r.ip} target="_blank" rel="noreferrer">🌐 http://{r.ip}</a></div> : null} />}
  </div>
}

function ipNum(ip: string) { const p = (ip ?? '').split('.').map(Number); return p.length === 4 && p.every((x) => x >= 0 && x < 256) ? ((p[0] << 24) >>> 0) + (p[1] << 16) + (p[2] << 8) + p[3] : NaN }
export function inSubnet(ip: string, cidr: string) { const [n, b] = (cidr ?? '').split('/'); const bits = +b; if (!n || isNaN(bits)) return false; const m = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0; return ((ipNum(ip) & m) >>> 0) === ((ipNum(n) & m) >>> 0) }

function Network({ c, sites }: Ctx) {
  const [nets, reload] = useLoad(() => list('networks', { customer_id: c.id }), [c.id])
  const [eq] = useLoad(() => list('equipment', { customer_id: c.id }), [c.id])
  const [edit, setEdit] = useState<Partial<Row> | null>(null)
  const withIp = (eq ?? []).filter((e) => e.ip).sort((a, b) => ipNum(a.ip) - ipNum(b.ip))
  const dup = new Set(withIp.filter((e, i) => withIp.findIndex((x) => x.ip === e.ip) !== i).map((e) => e.ip))
  return <div>
    <div className="row end"><button className="primary" onClick={() => setEdit({ customer_id: c.id, site_id: sites[0]?.id })}>+ {t('Dodaj')}</button></div>
    <div className="card"><h3>{t('Omrežje')}</h3><Table rows={nets} onRow={setEdit} cols={[{ k: 'name', label: 'Ime' }, { k: 'vlan', label: 'VLAN' }, { k: 'subnet', label: 'Podomrežje', render: (r) => <code>{r.subnet}</code> },
      { k: 'gateway', label: 'Prehod' }, { k: 'dhcp_range', label: 'DHCP obseg' }, { k: 'public_ip', label: 'Javni IP' }, { k: 'ddns', label: 'DDNS' }, { k: 'port_forwards', label: 'Posredovanje vrat' }]} /></div>
    <div className="card"><h3>{t('IP načrt')} – {t('Naslovi naprav')}</h3>
      <Table rows={withIp} cols={[{ k: 'ip', label: 'IP', render: (r) => <><code>{r.ip}</code> {dup.has(r.ip) && <span className="badge critical">{t('Podvojen IP!')}</span>}</> },
        { k: 'net', label: 'Omrežje', render: (r) => nets?.find((n) => inSubnet(r.ip, n.subnet))?.name ?? '—' }, { k: 'name', label: 'Ime', render: (r) => `${equipIcon[r.type] ?? ''} ${r.name}` },
        { k: 'mac', label: 'MAC' }, { k: 'vlan', label: 'VLAN' }, { k: 'port', label: 'Vrata stikala' }, { k: 'model', label: 'Model' }]} /></div>
    {edit && <EditModal title={t('Omrežje')} res="networks" fields={networkFields} row={edit} onClose={() => setEdit(null)} onSaved={reload} />}
  </div>
}

const docKinds: [string, string][] = [['photo', 'Fotografije'], ['schematic', 'Sheme'], ['document', 'Dokumenti']]
export function DocumentsPanel({ filter, sites, compact }: { filter: Record<string, any>; sites?: Row[]; compact?: boolean }) {
  const [rows, reload] = useLoad(() => list('documents', filter), [JSON.stringify(filter)])
  const [kind, setKind] = useState('photo')
  const [site, setSite] = useState('')
  const [busy, setBusy] = useState(false)
  const [view, setView] = useState<Row | null>(null)
  const onFiles = async (files: FileList | null) => {
    if (!files) return
    setBusy(true)
    try { for (const f of Array.from(files)) await upload(f, { ...filter, kind, site_id: site || filter.site_id, title: f.name }) } finally { setBusy(false); reload() }
  }
  const photos = (rows ?? []).filter((d) => d.mime?.startsWith('image/'))
  const other = (rows ?? []).filter((d) => !d.mime?.startsWith('image/'))
  return <div className={compact ? '' : 'card'}>
    <div className="row">
      <select value={kind} onChange={(e) => setKind(e.target.value)}>{docKinds.map(([k, l]) => <option key={k} value={k}>{t(l)}</option>)}</select>
      {sites && <select value={site} onChange={(e) => setSite(e.target.value)}><option value="">{t('Objekt')}: —</option>{sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>}
      <label className="btn-file">📤 {t('Naloži')}<input type="file" multiple hidden onChange={(e) => onFiles(e.target.files)} /></label>
      <label className="btn-file">📷 {t('Fotografiraj')}<input type="file" accept="image/*" capture="environment" hidden onChange={(e) => onFiles(e.target.files)} /></label>
      {busy && <span className="muted">{t('Nalaganje…')}</span>}
    </div>
    {photos.length > 0 && <div className="gallery">{photos.map((p) => <figure key={p.id} onClick={() => setView(p)}><img src={`/api/files/${p.id}`} loading="lazy" alt={p.title} /><figcaption>{p.title}<br /><span className="muted">{fmtDT(p.created_at)}</span></figcaption></figure>)}</div>}
    {other.length > 0 && <Table rows={other} cols={[{ k: 'title', label: 'Naslov dokumenta', render: (r) => <a href={`/api/files/${r.id}`} target="_blank" rel="noreferrer">📄 {r.title}</a> },
      { k: 'kind', label: 'Vrsta', render: (r) => t(docKinds.find((x) => x[0] === r.kind)?.[1] ?? '') }, { k: 'size', label: 'Velikost', render: (r) => (r.size / 1024).toFixed(0) + ' KB' },
      { k: 'created_at', label: 'Datum', render: (r) => fmtDT(r.created_at) }, { k: 'x', label: '', render: (r) => <button className="sm danger" onClick={async () => { if (confirm(t('Res želite izbrisati?'))) { await delRow('documents', r.id); reload() } }}>✕</button> }]} />}
    {rows && rows.length === 0 && <div className="muted pad">{t('Ni podatkov')}</div>}
    {view && <Modal title={view.title} onClose={() => setView(null)} wide><img src={`/api/files/${view.id}`} style={{ width: '100%' }} alt="" />
      <div className="row end"><a className="btn" href={`/api/files/${view.id}?dl=1`}>{t('Prenesi')}</a><button className="danger" onClick={async () => { if (confirm(t('Res želite izbrisati?'))) { await delRow('documents', view.id); setView(null); reload() } }}>{t('Izbriši')}</button></div></Modal>}
  </div>
}

function Diagrams({ c, sites }: Ctx) {
  const [rows, reload] = useLoad(() => list('diagrams', { customer_id: c.id }), [c.id])
  const add = async () => { const name = prompt(t('Nova shema'), t('Tloris')); if (!name) return; const r = await saveRow('diagrams', { customer_id: c.id, site_id: sites[0]?.id, name, items: [] }); reload(); go('/diagram/' + r.id) }
  return <div>
    <div className="row end"><button className="primary" onClick={add}>+ {t('Nova shema')}</button></div>
    <div className="card"><Table rows={rows} onRow={(r) => go('/diagram/' + r.id)} cols={[{ k: 'name', label: 'Ime', render: (r) => '🗺 ' + r.name }, { k: 'site_id', label: 'Objekt', render: (r) => sites.find((s) => s.id === r.site_id)?.name },
      { k: 'items', label: 'Oprema', render: (r) => (r.items ?? []).filter((i: any) => i.kind === 'equipment').length }, { k: 'updated_at', label: 'Datum', render: (r) => fmtDT(r.updated_at) }]} /></div>
    <p className="muted small">{t('Sheme')}: PDF/{t('Dokumenti')} → {t('Dokumenti')} ({t('Sheme')}).</p>
  </div>
}

function CustWorkorders({ c }: { c: Row }) {
  const [rows, reload] = useLoad(() => list('workorders', { customer_id: c.id }), [c.id])
  const [edit, setEdit] = useState<Partial<Row> | null>(null)
  return <div><div className="row end"><button className="primary" onClick={() => setEdit({ customer_id: c.id, status: 'planned', type: 'repair', priority: 'normal' })}>+ {t('Nov nalog')}</button></div>
    <div className="card"><Table rows={rows} onRow={(r) => go('/workorders/' + r.id)} cols={[{ k: 'start', label: 'Začetek', render: (r) => fmtDT(r.start) }, { k: 'title', label: 'Naziv' }, { k: 'technician', label: 'Tehnik' }, { k: 'status', label: 'Status', render: (r) => <Badge s={r.status} /> }]} /></div>
    {edit && <EditModal title={t('Nov nalog')} res="workorders" fields={workorderFields} row={edit} onClose={() => setEdit(null)} onSaved={(r) => { reload(); if (!r._deleted) go('/workorders/' + r.id) }} />}</div>
}

function CustDocs({ kind, c }: { kind: 'quotes' | 'invoices'; c: Row }) {
  const [rows] = useLoad(() => list(kind, { customer_id: c.id }), [c.id, kind])
  return <div><div className="row end"><button className="primary" onClick={() => go(`/${kind}/new?customer=${c.id}`)}>+ {t(kind === 'quotes' ? 'Nova ponudba' : 'Nov račun')}</button></div>
    <div className="card"><Table rows={rows} onRow={(r) => go(`/${kind}/${r.id}`)} cols={[{ k: 'number', label: 'Številka', render: (r) => r.number || <i className="muted">{t('Osnutek')}</i> }, { k: 'date', label: 'Datum', render: (r) => fmtDate(r.date) },
      { k: 'title', label: 'Naziv' }, { k: 'total', label: 'Znesek', cls: 'num', render: (r) => fmtMoney(r.total) }, { k: 'status', label: 'Status', render: (r) => <Badge s={r.status} /> }]} /></div></div>
}

function CustContracts({ c }: { c: Row }) {
  const [rows, reload] = useLoad(() => list('contracts', { customer_id: c.id }), [c.id])
  const [edit, setEdit] = useState<Partial<Row> | null>(null)
  return <div><div className="row end"><button className="primary" onClick={() => setEdit({ customer_id: c.id, interval_months: 12, active: 1 })}>+ {t('Dodaj')}</button></div>
    <div className="card"><Table rows={rows} onRow={setEdit} cols={[{ k: 'title', label: 'Naziv' }, { k: 'interval_months', label: 'Interval (mesecev)' }, { k: 'next_date', label: 'Naslednji servis', render: (r) => fmtDate(r.next_date) }, { k: 'price', label: 'Cena servisa', render: (r) => fmtMoney(r.price) }]} /></div>
    {edit && <EditModal title={t('Vzdrževalne pogodbe')} res="contracts" fields={contractFields} row={edit} onClose={() => setEdit(null)} onSaved={reload} />}</div>
}
