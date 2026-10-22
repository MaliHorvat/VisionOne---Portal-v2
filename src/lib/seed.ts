import { sql, todayIso, tx } from './db'
import { computeTotals, type Line } from './money'
import { nextNumber, saveRow, countTable } from './repo'

function shift(days = 0, months = 0) {
  const d = new Date()
  d.setUTCMonth(d.getUTCMonth() + months)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function day(offset: number, hour: number) {
  return `${shift(offset)}T${String(hour).padStart(2, '0')}:00`
}

async function sv(res: string, data: Record<string, unknown>) {
  const { resources } = await import('./resources')
  const id = await saveRow(resources[res], 0, data)
  return id
}

async function assignQuoteNumber(data: Record<string, unknown>) {
  const y = new Date().getUTCFullYear()
  const n = await tx((t) => nextNumber(t, `quote-${y}`))
  data.number = `P-${y}-${String(n).padStart(4, '0')}`
}

export async function seedDemo() {
  if (await countTable('customers') > 0) return
  const set: Record<string, string> = {
    company_name: 'Varnost Horvat s.p.', company_address: 'Tržaška cesta 12', company_post: '1000', company_city: 'Ljubljana',
    company_vat: 'SI12345678', company_reg: '1234567000', company_phone: '+386 40 123 456', company_email: 'info@varnost-horvat.si',
    iban: 'SI56 0201 0001 2345 678', bank: 'NLB d.d.', vat_payer: '1', payment_days: '15', place_of_issue: 'Ljubljana',
    issuer_name: 'Marsel Horvat', quote_footer: 'Ponudba velja 30 dni. Garancija na opremo 24 mesecev, na izvedena dela 12 mesecev.',
    invoice_footer: 'Hvala za zaupanje. Pri plačilu navedite sklic.',
  }
  for (const [k, v] of Object.entries(set)) {
    await sql().exec('INSERT IGNORE INTO settings (k, v) VALUES (?, ?)', k, v)
  }
  const p: Record<string, number> = {}
  const products: [string, string, string, string, string, string, number, number, number, number, number][] = [
    ['product', 'DS-2CD1643G0-IZ', 'IP kamera 4MP varifocal bullet', 'Hikvision', 'Kamere', 'kos', 189, 120, 22, 6, 2],
    ['product', 'IPC-HDW2441T-S', 'IP kamera 4MP dome WizSense', 'Dahua', 'Kamere', 'kos', 149, 92, 22, 8, 3],
    ['product', 'DS-7608NXI-K2', 'NVR 8 kanalov AcuSense', 'Hikvision', 'Snemalniki', 'kos', 329, 230, 22, 2, 1],
    ['product', 'WD40PURZ', 'Disk WD Purple 4TB', 'WD', 'Diski', 'kos', 119, 88, 22, 1, 2],
    ['product', 'GS308P', 'PoE stikalo 8 port', 'Netgear', 'Mreža', 'kos', 99, 64, 22, 3, 1],
    ['product', 'CAT6-305', 'Kabel UTP Cat6 (m)', '', 'Material', 'm', 0.85, 0.42, 22, 600, 100],
    ['product', 'AX-HUB', 'Alarmna centrala Ajax Hub 2', 'Ajax', 'Alarmi', 'kos', 259, 180, 22, 1, 1],
    ['product', 'DS-KV6113', 'Video domofon zunanja enota', 'Hikvision', 'Domofonija', 'kos', 179, 115, 22, 2, 1],
    ['service', 'DELO', 'Montažno delo (ura)', '', 'Storitve', 'h', 35, 0, 22, 0, 0],
    ['service', 'KONF', 'Konfiguracija sistema in aplikacije', '', 'Storitve', 'kos', 60, 0, 22, 0, 0],
    ['service', 'POT', 'Potni stroški (km)', '', 'Storitve', 'km', 0.43, 0, 22, 0, 0],
    ['service', 'SERVIS', 'Redni letni servis videonadzora', '', 'Storitve', 'kos', 89, 0, 22, 0, 0],
  ]
  for (const [kind, sku, name, brand, category, unit, price, cost, vat, stock, min] of products) {
    p[sku] = await sv('products', { kind, sku, name, brand, category, unit, price, cost, vat_rate: vat, stock, min_stock: min })
  }
  const c1 = await sv('customers', { kind: 'person', name: 'Janez Novak', address: 'Cesta na Brdo 45', post: '1000', city: 'Ljubljana', country: 'Slovenija', email: 'janez.novak@example.si', phone: '041 555 123', lat: 46.0469, lng: 14.4706, vat_id: '87654321', notes: 'Pes na dvorišču – pokliči pred prihodom.', contacts: [{ name: 'Marija Novak', role: 'žena', phone: '031 222 333' }] })
  const c2 = await sv('customers', { kind: 'company', name: 'Petra Kos', company: 'Gostilna Pri Lipi d.o.o.', address: 'Glavni trg 3', post: '4000', city: 'Kranj', country: 'Slovenija', email: 'info@prilipi.si', phone: '04 201 11 22', vat_id: 'SI99887766', vat_payer: 1, reg_no: '6543210000', lat: 46.2389, lng: 14.3555, payment_days: 30, contacts: [{ name: 'Petra Kos', role: 'direktorica', phone: '041 777 888', email: 'petra@prilipi.si' }, { name: 'Luka', role: 'vodja strežbe', phone: '040 111 222' }] })
  const c3 = await sv('customers', { kind: 'person', name: 'Ana Zupan', address: 'Pod gozdom 7', post: '1230', city: 'Domžale', country: 'Slovenija', phone: '051 999 000', lat: 46.1377, lng: 14.5939 })
  const s1 = await sv('sites', { customer_id: c1, name: 'Hiša Brdo', address: 'Cesta na Brdo 45', post: '1000', city: 'Ljubljana', lat: 46.0469, lng: 14.4706, access_info: 'Ključ v nabiralniku, alarm ob vhodu levo', alarm_code: '4711', wifi: 'NovakNet / geslo123', internet: 'Telemach optika 300/100' })
  const s2 = await sv('sites', { customer_id: c2, name: 'Gostilna – glavni objekt', address: 'Glavni trg 3', post: '4000', city: 'Kranj', lat: 46.2389, lng: 14.3555, internet: 'Telekom FTTH, statični IP' })
  const s3 = await sv('sites', { customer_id: c2, name: 'Skladišče', address: 'Industrijska 8', post: '4000', city: 'Kranj' })
  await sv('sites', { customer_id: c3, name: 'Stanovanje', address: 'Pod gozdom 7', city: 'Domžale' })
  await sv('networks', { customer_id: c1, site_id: s1, name: 'LAN kamere', vlan: '20', subnet: '192.168.20.0/24', gateway: '192.168.20.1', dns: '192.168.20.1', dhcp_range: '192.168.20.100-200', ddns: 'novak.ddns.net', port_forwards: '443 → NVR 192.168.20.10' })
  await sv('networks', { customer_id: c2, site_id: s2, name: 'Video VLAN', vlan: '30', subnet: '10.0.30.0/24', gateway: '10.0.30.1', public_ip: '193.77.10.20' })
  const inst = shift(0, -22)
  const war = shift(40)
  const eq: Record<string, unknown>[] = [
    { customer_id: c1, site_id: s1, type: 'nvr', name: 'NVR', brand: 'Hikvision', model: 'DS-7608NXI-K2', serial: 'J12345678', ip: '192.168.20.10', mac: 'BC:AD:28:11:22:33', firmware: 'V4.62.210', username: 'admin', password: 'Nvr!2024', location: 'Tehnični prostor', install_date: inst, warranty_until: war, status: 'ok' },
    { customer_id: c1, site_id: s1, type: 'camera', name: 'Vhod', brand: 'Hikvision', model: 'DS-2CD1643G0-IZ', serial: 'K55501', ip: '192.168.20.21', mac: 'BC:AD:28:44:55:01', firmware: 'V5.7.23', username: 'admin', password: 'Cam!2024', location: 'Nad vhodnimi vrati', install_date: inst, warranty_until: war, status: 'ok' },
    { customer_id: c1, site_id: s1, type: 'camera', name: 'Dvorišče', brand: 'Dahua', model: 'IPC-HDW2441T-S', serial: '7G0A1234', ip: '192.168.20.22', mac: 'E0:50:8B:01:02:03', firmware: '2.840.0000', username: 'admin', password: 'Cam!2024', location: 'Garaža, JV vogal', install_date: inst, status: 'ok' },
    { customer_id: c1, site_id: s1, type: 'camera', name: 'Vrt', brand: 'Uniview', model: 'IPC2124LE', serial: 'UNV9988', ip: '192.168.20.23', location: 'Terasa', install_date: inst, status: 'fault', notes: 'Občasno izgubi povezavo – preveriti PoE' },
    { customer_id: c1, site_id: s1, type: 'switch', name: 'PoE stikalo', brand: 'Netgear', model: 'GS308P', serial: '5AB1234', ip: '192.168.20.2', location: 'Tehnični prostor', install_date: inst, status: 'ok' },
    { customer_id: c1, site_id: s1, type: 'alarm', name: 'Alarmna centrala', brand: 'Ajax', model: 'Hub 2', serial: '00A1B2', location: 'Hodnik', install_date: inst, status: 'ok' },
    { customer_id: c2, site_id: s2, type: 'nvr', name: 'NVR gostilna', brand: 'Dahua', model: 'NVR4108HS-8P', serial: 'DH8P001', ip: '10.0.30.10', username: 'admin', password: 'Lipa#2025', location: 'Pisarna', install_date: '2025-03-14', warranty_until: '2027-03-14', status: 'ok' },
    { customer_id: c2, site_id: s2, type: 'camera', name: 'Blagajna', brand: 'Axis', model: 'M3086-V', serial: 'ACCC8E01', ip: '10.0.30.21', location: 'Šank', install_date: '2025-03-14', status: 'ok' },
    { customer_id: c2, site_id: s2, type: 'camera', name: 'Parkirišče', brand: 'Ubiquiti', model: 'G5 Bullet', serial: 'UBNT77', ip: '10.0.30.22', location: 'Fasada sever', install_date: '2025-03-14', status: 'ok' },
    { customer_id: c2, site_id: s2, type: 'intercom', name: 'Domofon dostava', brand: 'Hikvision', model: 'DS-KV6113', serial: 'HKDV01', ip: '10.0.30.30', location: 'Zadnji vhod', install_date: '2025-03-14', status: 'ok' },
    { customer_id: c2, site_id: s3, type: 'camera', name: 'Skladišče vhod', brand: 'Provision-ISR', model: 'I4-340IPE', ip: '10.0.31.21', install_date: '2025-06-02', status: 'ok' },
  ]
  const eqIDs: number[] = []
  for (const e of eq) eqIDs.push(await sv('equipment', e))
  await sv('diagrams', { customer_id: c1, site_id: s1, name: 'Pritličje', items: [
    { id: 'a', kind: 'equipment', equipment_id: eqIDs[1], x: 0.18, y: 0.22, rot: 45 },
    { id: 'b', kind: 'equipment', equipment_id: eqIDs[2], x: 0.78, y: 0.2, rot: 135 },
    { id: 'c', kind: 'equipment', equipment_id: eqIDs[3], x: 0.7, y: 0.8, rot: 270 },
    { id: 'd', kind: 'equipment', equipment_id: eqIDs[0], x: 0.45, y: 0.5 },
    { id: 'e', kind: 'label', text: 'Garaža', x: 0.8, y: 0.4 },
    { id: 'f', kind: 'room', x: 0.05, y: 0.08, w: 0.6, h: 0.55, text: 'Hiša' },
    { id: 'g', kind: 'room', x: 0.68, y: 0.08, w: 0.27, h: 0.42, text: '' },
    { id: 'h', kind: 'cable', x: 0.45, y: 0.5, x2: 0.18, y2: 0.22 },
    { id: 'i', kind: 'cable', x: 0.45, y: 0.5, x2: 0.78, y2: 0.2 },
  ] })
  const cl = [
    { text: 'Pregled slike vseh kamer', done: false },
    { text: 'Čiščenje ohišij in objektivov', done: false },
    { text: 'Preverjanje snemanja in diskov (S.M.A.R.T.)', done: false },
    { text: 'Posodobitev firmware', done: false },
    { text: 'Test oddaljenega dostopa (aplikacija)', done: false },
  ]
  await sv('workorders', { customer_id: c1, site_id: s1, title: 'Kamera Vrt izgublja povezavo', type: 'repair', status: 'planned', priority: 'high', start: day(1, 9), end: day(1, 11), technician: 'Marsel Horvat', description: 'Stranka javlja, da kamera na terasi občasno ne deluje.', checklist: cl.slice(0, 3) })
  await sv('workorders', { customer_id: c2, site_id: s2, title: 'Montaža dodatne kamere – terasa', type: 'install', status: 'planned', priority: 'normal', start: day(3, 8), end: day(3, 14), technician: 'Marsel Horvat', checklist: cl })
  await sv('workorders', { customer_id: c3, title: 'Ogled za ponudbo – alarm + kamere', type: 'survey', status: 'planned', priority: 'normal', start: day(0, 15), end: day(0, 16), technician: 'Marsel Horvat' })
  await sv('workorders', { customer_id: c1, site_id: s1, title: 'Montaža videonadzora', type: 'install', status: 'done', start: inst + 'T08:00', end: inst + 'T16:00', technician: 'Marsel Horvat', report: 'Montirane 3 kamere, NVR in PoE stikalo. Stranka poučena o uporabi aplikacije.', time_entries: [{ start: inst + 'T08:00', end: inst + 'T12:00', note: 'montaža' }, { start: inst + 'T12:30', end: inst + 'T16:00', note: 'konfiguracija' }], signed_by: 'Janez Novak' })
  await sv('contracts', { customer_id: c2, site_id: s2, title: 'Vzdrževanje videonadzora – Gostilna', start_date: '2025-04-01', interval_months: 6, next_date: shift(12), price: 89, sla: 'Odziv v 24 h', active: 1, checklist: cl })
  await sv('contracts', { customer_id: c1, site_id: s1, title: 'Letni servis – Novak', start_date: inst, interval_months: 12, next_date: shift(0, 2), price: 89, active: 1, checklist: cl })
  const ql: Line[] = [
    { description: 'IP kamera 4MP dome WizSense (Dahua IPC-HDW2441T-S)', qty: 2, unit: 'kos', price: 149, vat_rate: 22, discount_pct: 0, product_id: p['IPC-HDW2441T-S'] },
    { description: 'Disk WD Purple 4TB', qty: 1, unit: 'kos', price: 119, vat_rate: 22, discount_pct: 0 },
    { description: 'Kabel UTP Cat6', qty: 60, unit: 'm', price: 0.85, vat_rate: 22, discount_pct: 0 },
    { description: 'Montažno delo', qty: 5, unit: 'h', price: 35, vat_rate: 22, discount_pct: 10 },
  ]
  let t = computeTotals(ql, 0)
  const quote1: Record<string, unknown> = { customer_id: c2, site_id: s2, title: 'Razširitev videonadzora – terasa in skladišče', date: todayIso(), valid_until: shift(30), status: 'sent', lines: t.lines, net: t.net, vat: t.vat, total: t.total }
  await assignQuoteNumber(quote1)
  await sv('quotes', quote1)
  const ql2: Line[] = [
    { description: 'Alarmna centrala Ajax Hub 2', qty: 1, unit: 'kos', price: 259, vat_rate: 22, discount_pct: 0 },
    { description: 'Konfiguracija sistema in aplikacije', qty: 1, unit: 'kos', price: 60, vat_rate: 22, discount_pct: 0 },
  ]
  t = computeTotals(ql2, 5)
  const quote2: Record<string, unknown> = { customer_id: c3, title: 'Alarmni sistem – stanovanje', date: todayIso(), valid_until: shift(30), status: 'draft', lines: t.lines, discount_pct: 5, net: t.net, vat: t.vat, total: t.total }
  await assignQuoteNumber(quote2)
  await sv('quotes', quote2)
}
