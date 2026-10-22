import { useState } from 'react'
import { api, list, fmtDate, fmtMoney, custName, today, type Row } from '../api'
import { t } from '../i18n'
import { useLoad, Table, EditModal } from '../ui'
import { contractFields } from '../specs'
import { go } from '../main'

export function Contracts() {
  const [rows, reload] = useLoad(() => list('contracts'), [])
  const [custs] = useLoad(() => list('customers'), [])
  const [edit, setEdit] = useState<Partial<Row> | null>(null)
  const soon = new Date(Date.now() + 30 * 86400000).toLocaleDateString('sv-SE')
  return <div>
    <div className="topbar"><h2>{t('Vzdrževalne pogodbe')}</h2><button className="primary" onClick={() => setEdit({ interval_months: 12, active: 1, start_date: today(), next_date: today() })}>+ {t('Dodaj')}</button></div>
    <div className="card"><Table rows={rows} onRow={setEdit} cols={[{ k: 'customer_id', label: 'Stranka', render: (r) => custName(custs?.find((c) => c.id === r.customer_id)) }, { k: 'title', label: 'Naziv', render: (r) => <b>{r.title}</b> },
      { k: 'interval_months', label: 'Interval (mesecev)', cls: 'num' }, { k: 'next_date', label: 'Naslednji servis', render: (r) => <span className={r.next_date < today() ? 'bad' : r.next_date <= soon ? 'warn' : ''}>{fmtDate(r.next_date)}{r.next_date <= soon ? ' ⏰' : ''}</span> },
      { k: 'price', label: 'Cena servisa', cls: 'num', render: (r) => fmtMoney(r.price) }, { k: 'sla', label: 'SLA' }, { k: 'active', label: 'Aktivna', render: (r) => (r.active ? '✔' : '—') },
      { k: 'act', label: '', render: (r) => <button className="sm" onClick={async (e) => { e.stopPropagation(); const w = await api(`/contracts/${r.id}/workorder`, { body: {} }); go('/workorders/' + w.id) }}>🛠 {t('Ustvari nalog')}</button> }]} /></div>
    <p className="muted small">„{t('Ustvari nalog')}“ ustvari delovni nalog s kontrolnim seznamom pogodbe in premakne datum naslednjega servisa za interval naprej. Opomniki se prikažejo na nadzorni plošči 30 dni prej.</p>
    {edit && <EditModal title={t('Vzdrževalne pogodbe')} res="contracts" fields={contractFields} row={edit} onClose={() => setEdit(null)} onSaved={reload} />}
  </div>
}
