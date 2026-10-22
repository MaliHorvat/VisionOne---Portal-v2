import { api, fmtMoney, fmtDate, fmtDT, today } from '../api'
import { t } from '../i18n'
import { useLoad, Table, Badge } from '../ui'
import { go } from '../main'

export function Dashboard() {
  const [d] = useLoad<any>(() => api('/dashboard'))
  if (!d) return <div className="muted">{t('Nalaganje…')}</div>
  const s = d.stats
  return <div>
    <div className="topbar"><h2>{t('Nadzorna plošča')}</h2><div className="row"><button className="primary" onClick={() => go('/workorders?new')}>+ {t('Nov nalog')}</button><button onClick={() => go('/quotes/new')}>+ {t('Nova ponudba')}</button></div></div>
    <div className="stats">
      <div className="stat"><span>{t('Neplačano')}</span><b>{fmtMoney(s.unpaid)}</b></div>
      <div className="stat bad"><span>{t('Zapadlo')}</span><b>{fmtMoney(s.overdue)}</b></div>
      <div className="stat"><span>{t('Prihodek ta mesec (neto)')}</span><b>{fmtMoney(s.revenue_month)}</b></div>
      <div className="stat"><span>{t('Stranke')}</span><b>{s.customers}</b></div>
    </div>
    <div className="grid2">
      <div className="card"><h3>{t('Prihajajoči obiski')}</h3>
        <Table rows={d.upcoming_visits} onRow={(r) => go('/workorders/' + r.id)} cols={[{ k: 'start', label: 'Začetek', render: (r) => fmtDT(r.start) }, { k: 'customer_name', label: 'Stranka' }, { k: 'title', label: 'Naziv' }, { k: 'status', label: 'Status', render: (r) => <Badge s={r.status} /> }]} /></div>
      <div className="card"><h3>{t('Neplačani računi')}</h3>
        <Table rows={d.unpaid_invoices} onRow={(r) => go('/invoices/' + r.id)} cols={[{ k: 'number', label: 'Številka' }, { k: 'customer_name', label: 'Stranka' }, { k: 'due_date', label: 'Rok plačila', render: (r) => fmtDate(r.due_date) },
          { k: 'total', label: 'Odprto', cls: 'num', render: (r) => fmtMoney(r.total - (r.paid_amount || 0)) }, { k: 'status', label: 'Status', render: (r) => <Badge s={r.status} overdue={r.due_date < today()} /> }]} /></div>
      <div className="card"><h3>{t('Odprte ponudbe')}</h3>
        <Table rows={d.open_quotes} onRow={(r) => go('/quotes/' + r.id)} cols={[{ k: 'number', label: 'Številka' }, { k: 'customer_name', label: 'Stranka' }, { k: 'title', label: 'Naziv' }, { k: 'total', label: 'Znesek', cls: 'num', render: (r) => fmtMoney(r.total) }, { k: 'status', label: 'Status', render: (r) => <Badge s={r.status} /> }]} /></div>
      <div className="card"><h3>{t('Servisi v 30 dneh')}</h3>
        <Table rows={d.due_contracts} onRow={() => go('/contracts')} cols={[{ k: 'next_date', label: 'Naslednji servis', render: (r) => fmtDate(r.next_date) }, { k: 'customer_name', label: 'Stranka' }, { k: 'title', label: 'Naziv' }]} /></div>
      {d.low_stock.length > 0 && <div className="card"><h3>{t('Nizka zaloga')}</h3>
        <Table rows={d.low_stock} onRow={() => go('/stock')} cols={[{ k: 'name', label: 'Naziv' }, { k: 'stock', label: 'Zaloga', cls: 'num' }, { k: 'min_stock', label: 'Min. zaloga', cls: 'num' }]} /></div>}
      {d.warranty_expiring.length > 0 && <div className="card"><h3>{t('Garancija poteče')}</h3>
        <Table rows={d.warranty_expiring} onRow={(r) => go('/customers/' + r.customer_id + '/equipment')} cols={[{ k: 'name', label: 'Ime' }, { k: 'model', label: 'Model' }, { k: 'warranty_until', label: 'Garancija do', render: (r) => fmtDate(r.warranty_until) }]} /></div>}
    </div>
  </div>
}
