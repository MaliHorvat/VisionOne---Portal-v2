import { api, fmtDate, fmtMoney, custName } from '../api'
import { t } from '../i18n'
import { useLoad } from '../ui'
import { equipIcon } from '../specs'

const groups: [string, string, (r: any) => string, (r: any) => string][] = [
  ['customers', 'Stranke', (r) => `#/customers/${r.id}`, (r) => `${custName(r)} · ${r.city ?? ''} ${r.phone ?? ''}`],
  ['sites', 'Objekti', (r) => `#/customers/${r.customer_id}/sites`, (r) => `🏠 ${r.name} · ${r.address ?? ''}`],
  ['equipment', 'Oprema', (r) => `#/customers/${r.customer_id}/equipment`, (r) => `${equipIcon[r.type] ?? ''} ${r.name} · ${r.brand ?? ''} ${r.model ?? ''} · ${r.ip ?? ''} · SN ${r.serial ?? ''}`],
  ['workorders', 'Delovni nalogi', (r) => `#/workorders/${r.id}`, (r) => `🛠 ${r.title} · ${fmtDate(r.start)}`],
  ['quotes', 'Ponudbe', (r) => `#/quotes/${r.id}`, (r) => `📝 ${r.number} · ${r.title ?? ''} · ${fmtMoney(r.total)}`],
  ['invoices', 'Računi', (r) => `#/invoices/${r.id}`, (r) => `🧾 ${r.number || t('Osnutek')} · ${r.title ?? ''} · ${fmtMoney(r.total)}`],
  ['products', 'Katalog', () => `#/catalog`, (r) => `📦 ${r.sku} · ${r.name}`],
  ['documents', 'Dokumenti', (r) => `/api/files/${r.id}`, (r) => `📄 ${r.title}`],
]

export function Search({ q }: { q: string }) {
  const [res] = useLoad<Record<string, any[]>>(() => api('/search?q=' + encodeURIComponent(q)), [q])
  const empty = res && Object.keys(res).length === 0
  return <div><div className="topbar"><h2>{t('Iskanje')}: „{q}“</h2></div>
    {empty && <div className="muted">{t('Ni zadetkov')}</div>}
    {res && groups.filter(([k]) => res[k]).map(([k, l, href, label]) => <div className="card" key={k}><h3>{t(l)} ({res[k].length})</h3>
      <div className="results">{res[k].map((r) => <a key={r.id} href={href(r)}>{label(r)}</a>)}</div></div>)}
  </div>
}
