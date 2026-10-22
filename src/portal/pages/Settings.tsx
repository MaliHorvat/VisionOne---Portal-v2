import { useEffect, useState } from 'react'
import { api, upload } from '../api'
import { t } from '../i18n'
import { useLoad, Table, Modal, Toast } from '../ui'
import { ChangePassword, LangSwitch, type User } from '../main'

const company: [string, string][] = [['company_name', 'Podjetje (izdajatelj)'], ['company_address', 'Naslov'], ['company_post', 'Pošta'], ['company_city', 'Kraj'],
  ['company_vat', 'Davčna / ID za DDV'], ['company_reg', 'Matična številka'], ['company_phone', 'Telefon'], ['company_email', 'E-pošta'], ['iban', 'Bančni račun (IBAN)'], ['bank', 'Banka'],
  ['invoice_prefix', 'Predpona računov'], ['payment_days', 'Rok plačila (dni)'], ['place_of_issue', 'Kraj izdaje'], ['issuer_name', 'Odgovorna oseba']]
const resources = ['customers', 'sites', 'equipment', 'networks', 'workorders', 'products', 'stock_moves', 'quotes', 'invoices', 'contracts', 'documents']

export function Settings({ user, onUser }: { user: User; onUser: (u: User) => void }) {
  const [s, setS] = useState<Record<string, string>>()
  const [toast, setToast] = useState('')
  const [pw, setPw] = useState(false)
  useEffect(() => { api('/settings').then(setS) }, [])
  const isAdmin = user.role === 'admin'
  if (!s) return null
  const save = async () => { setS(await api('/settings', { method: 'PUT', body: s })); setToast(t('Shranjeno')); setTimeout(() => setToast(''), 2000) }
  return <div>
    <div className="topbar"><h2>{t('Nastavitve')}</h2><div className="row"><span className="muted">{t('Jezik')}</span><LangSwitch /><button onClick={() => setPw(true)}>🔑 {t('Spremeni geslo')}</button>
      <button onClick={async () => { await api('/logout', { body: {} }).catch(() => {}); location.reload() }}>{t('Odjava')}</button></div></div>
    <div className="card"><h3>{t('Podjetje (izdajatelj)')}</h3>
      <div className="form">{company.map(([k, l]) => <label key={k}>{t(l)}<input disabled={!isAdmin} value={s[k] ?? ''} onChange={(e) => setS({ ...s, [k]: e.target.value })} /></label>)}
        <label className="chk"><input type="checkbox" disabled={!isAdmin} checked={s.vat_payer !== '0'} onChange={(e) => setS({ ...s, vat_payer: e.target.checked ? '1' : '0' })} /> {t('Zavezanec za DDV')}</label>
        <label>{t('Logotip')} (PNG/JPG)<div className="row">{s.logo_id && <img src={`/api/files/${s.logo_id}`} className="logo-prev" alt="logo" />}
          {isAdmin && <input type="file" accept="image/png,image/jpeg" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { const d = await upload(f, { kind: 'logo', title: 'Logotip' }); setS({ ...s, logo_id: String(d.id) }) } }} />}</div></label>
        <label className="full">{t('Vpis v register (noga)')}<input disabled={!isAdmin} value={s.company_register_note ?? ''} onChange={(e) => setS({ ...s, company_register_note: e.target.value })} placeholder="npr. Vpisano v Poslovni register Slovenije pri AJPES, osnovni kapital …" /></label>
        <label className="full">{t('Noga ponudbe')}<textarea disabled={!isAdmin} value={s.quote_footer ?? ''} onChange={(e) => setS({ ...s, quote_footer: e.target.value })} /></label>
        <label className="full">{t('Noga računa')}<textarea disabled={!isAdmin} value={s.invoice_footer ?? ''} onChange={(e) => setS({ ...s, invoice_footer: e.target.value })} /></label>
      </div>
      {isAdmin && <div className="row end" style={{ marginTop: 12 }}><button className="primary" onClick={save}>{t('Shrani')}</button></div>}</div>
    {isAdmin && <Users me={user} />}
    <div className="card"><h3>{t('Varnostna kopija')} / {t('Izvoz CSV')}</h3>
      {isAdmin && <p><a className="btn primary" href="/api/backup">💾 {t('Prenesi varnostno kopijo (ZIP)')}</a> <span className="muted small">data.json (šifrirana gesla ostanejo šifrirana) + lokalne datoteke. Ključ ENCRYPTION_KEY je v okoljskih spremenljivkah Vercel, ne v ZIP-u — shranite ga posebej.</span></p>}
      <div className="row">{resources.map((r) => <a key={r} className="btn sm" href={`/api/export/${r}.csv`}>⬇ {r}.csv</a>)}</div>
      <p className="muted small">Gesla naprav se v CSV ne izvažajo. Obnova: ista baza MySQL, isti ENCRYPTION_KEY in datoteke v Vercel Blob. ZIP ne vsebuje ključa.</p></div>
    <div className="card legal"><h3>⚖️ {t('Pravna opozorila')} – za preverjanje</h3>
      <ul className="small">
        <li><b>Davčno potrjevanje računov (FURS, ZDavPR):</b> pri plačilu z gotovino ali kartico mora biti račun davčno potrjen (ZOI/EOR, certifikat FURS, prijava poslovnega prostora). Ta aplikacija tega <b>ne izvaja</b>. Za takšna plačila uporabite certificirano davčno blagajno ali dodajte integracijo – <b>preveriti</b>.</li>
        <li><b>Obvezne sestavine računa (ZDDV-1, 82. člen):</b> zaporedna številka, datum izdaje, datum opravljene storitve, podatki izdajatelja in kupca (ID za DDV), opis, količina, osnova in DDV po stopnjah. Aplikacija jih izpiše; ustreznost obrazca naj potrdi računovodja.</li>
        <li><b>Zaporedno številčenje:</b> številka se dodeli šele ob izdaji (LETO-NNNN, brez lukenj); izdanega računa ni mogoče urejati ali brisati, popravek = storno/dobropis.</li>
        <li><b>e-Račun / e-SLOG</b> (obvezen za javni sektor, za B2B predviden po novi zakonodaji) – <b>ni podprt</b>.</li>
        <li><b>UPN QR:</b> polja in kontrolna vsota po specifikaciji ZBS, vsebina v ISO-8859-2. Oznaka ECI in fiksna verzija QR 15 nista nastavljeni (knjižnica izbere velikost sama) – <b>preverite</b> z bančno aplikacijo, preden jo pošljete strankam. To ni potrdilo skladnosti.</li>
        <li><b>Hramba:</b> račune je treba hraniti 10 let – redno delajte varnostne kopije.</li>
        <li><b>GDPR:</b> podatki strank, fotografije in gesla naprav so osebni/občutljivi podatki; dostop omejite, gesla so šifrirana (AES-GCM).</li>
        <li>Nedavčni zavezanec: na računu se izpiše „DDV ni obračunan na podlagi 1. odstavka 94. člena ZDDV-1“.</li>
      </ul></div>
    {pw && <Modal title={t('Spremeni geslo')} onClose={() => setPw(false)}><ChangePassword onDone={(u) => { onUser(u); setPw(false) }} /></Modal>}
    <Toast msg={toast} />
  </div>
}

function Users({ me }: { me: User }) {
  const [rows, reload] = useLoad<any[]>(() => api('/users'), [])
  const [edit, setEdit] = useState<any>(null)
  const [err, setErr] = useState('')
  const roles: Record<string, string> = { admin: 'Skrbnik', tech: 'Serviser', viewer: 'Samo branje' }
  return <div className="card"><div className="topbar"><h3>{t('Uporabniki')}</h3><button className="sm" onClick={() => setEdit({ role: 'tech' })}>+ {t('Dodaj')}</button></div>
    <Table rows={rows} onRow={setEdit} cols={[{ k: 'username', label: 'Uporabniško ime' }, { k: 'name', label: 'Ime' }, { k: 'role', label: 'Vloga uporabnika', render: (r) => t(roles[r.role]) }]} />
    {edit && <Modal title={t('Uporabniki')} onClose={() => setEdit(null)}><div className="form">
      <label>{t('Uporabniško ime')}<input disabled={!!edit.id} value={edit.username ?? ''} onChange={(e) => setEdit({ ...edit, username: e.target.value })} /></label>
      <label>{t('Ime')}<input value={edit.name ?? ''} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></label>
      <label>{t('Vloga uporabnika')}<select value={edit.role} onChange={(e) => setEdit({ ...edit, role: e.target.value })}>{Object.entries(roles).map(([k, l]) => <option key={k} value={k}>{t(l)}</option>)}</select></label>
      <label>{t('Geslo')}<input type="password" value={edit.password ?? ''} onChange={(e) => setEdit({ ...edit, password: e.target.value })} placeholder={edit.id ? '(nespremenjeno)' : 'min. 8'} /></label></div>
      {err && <div className="err">{err}</div>}
      <div className="row end" style={{ marginTop: 12 }}>{edit.id && edit.id !== me.id && <button className="danger" onClick={async () => { await api('/users/' + edit.id, { method: 'DELETE' }); setEdit(null); reload() }}>{t('Izbriši')}</button>}
        <button className="primary" onClick={async () => { try { await api('/users', { body: edit }); setEdit(null); setErr(''); reload() } catch (x: any) { setErr(x.message) } }}>{t('Shrani')}</button></div></Modal>}
  </div>
}
