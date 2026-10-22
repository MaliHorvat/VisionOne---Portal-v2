'use client'

import { StrictMode, useEffect, useState } from 'react'
import { api } from './api'
import { t, getLang, setLang } from './i18n'
import { Dashboard } from './pages/Dashboard'
import { CustomerList, CustomerDetail } from './pages/Customers'
import { Calendar, WorkOrderList, WorkOrderDetail } from './pages/WorkOrders'
import { DocList, DocEditor } from './pages/Docs'
import { Catalog, Stock } from './pages/Catalog'
import { Contracts } from './pages/Contracts'
import { Search } from './pages/Search'
import { Settings } from './pages/Settings'
import { DiagramEditor } from './pages/Diagram'

export type User = { id: number; username: string; name: string; role: string; must_change: boolean }

export function useRoute() {
  const [h, setH] = useState('/')
  useEffect(() => {
    const f = () => { setH(location.hash.slice(1) || '/'); document.querySelector('.main')?.scrollTo(0, 0) }
    f()
    window.addEventListener('hashchange', f)
    return () => window.removeEventListener('hashchange', f)
  }, [])
  return h
}
export const go = (p: string) => { location.hash = p }

function Login({ onLogin }: { onLogin: (u: User) => void }) {
  const [u, setU] = useState(''), [p, setP] = useState(''), [err, setErr] = useState('')
  const submit = async (e: React.FormEvent) => { e.preventDefault(); try { onLogin(await api('/login', { body: { username: u, password: p } })) } catch (x: any) { setErr(x.status === 429 ? x.message : t('Napačno uporabniško ime ali geslo')) } }
  return <div className="login"><form className="card" onSubmit={submit}>
    <div className="brand"><div className="dot" /><div>VisionOne<small>Portal</small></div></div>
    <label>{t('Uporabniško ime')}<input value={u} onChange={(e) => setU(e.target.value)} autoFocus autoComplete="username" /></label>
    <label>{t('Geslo')}<input type="password" value={p} onChange={(e) => setP(e.target.value)} autoComplete="current-password" /></label>
    {err && <div className="err">{err}</div>}
    <button className="primary">{t('Prijavi')}</button>
    <LangSwitch />
  </form></div>
}

export function ChangePassword({ onDone, forced }: { onDone: (u: User) => void; forced?: boolean }) {
  const [o, setO] = useState(''), [n, setN] = useState(''), [n2, setN2] = useState(''), [err, setErr] = useState('')
  const submit = async (e: React.FormEvent) => { e.preventDefault(); if (n !== n2) return setErr(t('Gesli se ne ujemata')); try { onDone(await api('/password', { body: { old: o, new: n } })) } catch (x: any) { setErr(x.message) } }
  return <div className={forced ? 'login' : ''}><form className="card" onSubmit={submit} style={{ maxWidth: 380 }}>
    <h2>{t('Spremeni geslo')}</h2>{forced && <p className="muted">{t('Pred nadaljevanjem morate spremeniti privzeto geslo.')}</p>}
    <label>{t('Staro geslo')}<input type="password" value={o} onChange={(e) => setO(e.target.value)} /></label>
    <label>{t('Novo geslo')}<input type="password" value={n} onChange={(e) => setN(e.target.value)} /></label>
    <label>{t('Ponovi novo geslo')}<input type="password" value={n2} onChange={(e) => setN2(e.target.value)} /></label>
    {err && <div className="err">{err}</div>}<button className="primary">{t('Shrani')}</button>
  </form></div>
}

export function LangSwitch() {
  const [, force] = useState(0)
  return <div className="seg lang">{(['sl', 'en'] as const).map((l) => <button type="button" key={l} className={getLang() === l ? 'on' : ''} onClick={() => { setLang(l); force((x) => x + 1); window.dispatchEvent(new Event('portal-lang')) }}>{l.toUpperCase()}</button>)}</div>
}

const nav: [string, string, string][] = [['/', '📊', 'Nadzorna plošča'], ['/customers', '👥', 'Stranke'], ['/calendar', '📅', 'Koledar'], ['/workorders', '🛠', 'Delovni nalogi'],
  ['/quotes', '📝', 'Ponudbe'], ['/invoices', '🧾', 'Računi'], ['/contracts', '🔁', 'Pogodbe'], ['/catalog', '📦', 'Katalog'], ['/stock', '🏬', 'Skladišče'], ['/search', '🔎', 'Iskanje'], ['/settings', '⚙️', 'Nastavitve']]

function Shell({ user, setUser }: { user: User; setUser: (u: User | null) => void }) {
  const r = useRoute()
  const [, force] = useState(0)
  const [q, setQ] = useState('')
  useEffect(() => { const f = () => force((x) => x + 1); window.addEventListener('portal-lang', f); return () => window.removeEventListener('portal-lang', f) }, [])
  const parts = r.split('?')[0].split('/').filter(Boolean)
  const logout = async () => { await api('/logout', { method: 'POST', body: {} }).catch(() => {}); if ('caches' in window) (await caches.keys()).forEach((k) => caches.delete(k)); setUser(null) }
  let page
  switch (parts[0]) {
    case undefined: page = <Dashboard />; break
    case 'customers': page = parts[1] ? <CustomerDetail id={+parts[1]} tab={parts[2] ?? 'overview'} /> : <CustomerList />; break
    case 'calendar': page = <Calendar />; break
    case 'workorders': page = parts[1] ? <WorkOrderDetail id={+parts[1]} /> : <WorkOrderList />; break
    case 'quotes': case 'invoices': page = parts[1] ? <DocEditor kind={parts[0]} id={parts[1] === 'new' ? 0 : +parts[1]} key={r} /> : <DocList kind={parts[0]} />; break
    case 'catalog': page = <Catalog />; break
    case 'stock': page = <Stock />; break
    case 'contracts': page = <Contracts />; break
    case 'search': page = <Search q={decodeURIComponent(r.split('?q=')[1] ?? '')} />; break
    case 'settings': page = <Settings user={user} onUser={setUser} />; break
    case 'diagram': page = <DiagramEditor id={+parts[1]} />; break
    default: page = <div>404</div>
  }
  const cur = '/' + (parts[0] ?? '')
  return <div className="app">
    <aside className="side">
      <div className="brand"><div className="dot" /><div>VisionOne<small>Portal</small></div></div>
      {nav.map(([p, i, l]) => <a key={p} href={'#' + p} className={'nav' + (cur === p || (p === '/' && cur === '/') ? ' active' : '')}><span>{i}</span>{t(l)}</a>)}
      <div className="spacer" />
      <div className="muted userbox">{user.name || user.username}<LangSwitch /><button className="sm" onClick={logout}>{t('Odjava')}</button></div>
    </aside>
    <main className="main">
      <form className="globalsearch" onSubmit={(e) => { e.preventDefault(); go('/search?q=' + encodeURIComponent(q)) }}><input placeholder={'🔎 ' + t('Išči…') + ' (IP, serijska, stranka, račun)'} value={q} onChange={(e) => setQ(e.target.value)} /></form>
      {page}
    </main>
  </div>
}

export function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined)
  useEffect(() => { api<User>('/me').then(setUser).catch(() => setUser(null)); const f = () => setUser(null); window.addEventListener('portal-logout', f); return () => window.removeEventListener('portal-logout', f) }, [])
  useEffect(() => {
    setLang(getLang())
    if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('/sw.js').catch(() => {})
  }, [])
  if (user === undefined) return null
  if (!user) return <Login onLogin={setUser} />
  if (user.must_change) return <ChangePassword forced onDone={setUser} />
  return <StrictMode><Shell user={user} setUser={setUser} /></StrictMode>
}
