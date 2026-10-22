import type { Field } from './ui'

export const equipTypes: [string, string][] = [['camera', 'Kamera'], ['nvr', 'Snemalnik (NVR)'], ['switch', 'Stikalo'], ['router', 'Usmerjevalnik'], ['alarm', 'Alarmna centrala'], ['sensor', 'Senzor'], ['intercom', 'Domofon'], ['access', 'Dostopna kontrola'], ['disk', 'Disk'], ['ups', 'UPS'], ['other', 'Drugo']]
export const equipIcon: Record<string, string> = { camera: '📷', nvr: '🗄', switch: '🔀', router: '🌐', alarm: '🚨', sensor: '📡', intercom: '🔔', access: '🔑', disk: '💽', ups: '🔋', other: '⚙' }
export const brands = ['Hikvision', 'Dahua', 'Uniview', 'Ubiquiti', 'Axis', 'Provision-ISR', 'Policetech', 'Ajax', 'Paradox', 'Satel', 'Netgear', 'TP-Link', 'Mikrotik']

export const customerFields: Field[] = [
  { k: 'kind', label: 'Vrsta', type: 'select', opts: [['person', 'Oseba'], ['company', 'Podjetje']] },
  { k: 'name', label: 'Ime in priimek' }, { k: 'company', label: 'Naziv podjetja' }, { k: 'vat_id', label: 'Davčna / ID za DDV' },
  { k: 'vat_payer', label: 'Zavezanec za DDV', type: 'checkbox' }, { k: 'reg_no', label: 'Matična številka' },
  { k: 'address', label: 'Naslov' }, { k: 'post', label: 'Pošta' }, { k: 'city', label: 'Kraj' }, { k: 'country', label: 'Država' },
  { k: 'email', label: 'E-pošta', type: 'email' }, { k: 'phone', label: 'Telefon', type: 'tel' }, { k: 'payment_days', label: 'Rok plačila (dni)', type: 'number' },
  { k: 'lat', label: 'GPS lat', type: 'number' }, { k: 'lng', label: 'GPS lng', type: 'number' }, { k: 'tags', label: 'Oznake' },
  { k: 'notes', label: 'Opombe', type: 'textarea', full: true },
]
export const siteFields: Field[] = [
  { k: 'name', label: 'Ime' }, { k: 'address', label: 'Naslov' }, { k: 'post', label: 'Pošta' }, { k: 'city', label: 'Kraj' },
  { k: 'lat', label: 'GPS lat', type: 'number' }, { k: 'lng', label: 'GPS lng', type: 'number' }, { k: 'internet', label: 'Internet' },
  { k: 'alarm_code', label: 'Alarmna koda', type: 'secret' }, { k: 'wifi', label: 'WiFi', type: 'secret' },
  { k: 'access_info', label: 'Dostop / ključi', type: 'textarea', full: true }, { k: 'notes', label: 'Opombe', type: 'textarea', full: true },
]
export const equipmentFields: Field[] = [
  { k: 'site_id', label: 'Objekt', type: 'site' }, { k: 'type', label: 'Tip', type: 'select', opts: equipTypes }, { k: 'name', label: 'Ime' },
  { k: 'brand', label: 'Znamka' }, { k: 'model', label: 'Model' }, { k: 'serial', label: 'Serijska št.' }, { k: 'ip', label: 'IP' }, { k: 'mac', label: 'MAC' },
  { k: 'vlan', label: 'VLAN' }, { k: 'port', label: 'Vrata stikala' }, { k: 'firmware', label: 'Firmware' }, { k: 'username', label: 'Uporabnik' },
  { k: 'password', label: 'Geslo', type: 'secret' }, { k: 'location', label: 'Lokacija' }, { k: 'install_date', label: 'Datum montaže', type: 'date' },
  { k: 'warranty_until', label: 'Garancija do', type: 'date' }, { k: 'status', label: 'Stanje', type: 'select', opts: [['ok', 'Deluje'], ['fault', 'Napaka'], ['removed', 'Odstranjeno']] },
  { k: 'notes', label: 'Opombe', type: 'textarea', full: true },
]
export const networkFields: Field[] = [
  { k: 'site_id', label: 'Objekt', type: 'site' }, { k: 'name', label: 'Ime' }, { k: 'vlan', label: 'VLAN' }, { k: 'subnet', label: 'Podomrežje' }, { k: 'gateway', label: 'Prehod' },
  { k: 'dns', label: 'DNS' }, { k: 'dhcp_range', label: 'DHCP obseg' }, { k: 'public_ip', label: 'Javni IP' }, { k: 'ddns', label: 'DDNS' },
  { k: 'port_forwards', label: 'Posredovanje vrat', type: 'textarea', full: true }, { k: 'notes', label: 'Opombe', type: 'textarea', full: true },
]
export const productFields: Field[] = [
  { k: 'kind', label: 'Vrsta', type: 'select', opts: [['product', 'Izdelek'], ['service', 'Storitev']] }, { k: 'sku', label: 'Šifra' }, { k: 'name', label: 'Naziv' },
  { k: 'brand', label: 'Znamka' }, { k: 'category', label: 'Kategorija' }, { k: 'unit', label: 'EM' }, { k: 'price', label: 'Cena (brez DDV)', type: 'number' },
  { k: 'cost', label: 'Nabavna cena', type: 'number' }, { k: 'vat_rate', label: 'DDV %', type: 'select', opts: [['22', '22 %'], ['9.5', '9,5 %'], ['5', '5 %'], ['0', '0 %']] },
  { k: 'min_stock', label: 'Min. zaloga', type: 'number' }, { k: 'location', label: 'Lokacija' }, { k: 'notes', label: 'Opombe', type: 'textarea', full: true },
]
export const contractFields: Field[] = [
  { k: 'customer_id', label: 'Stranka', type: 'customer' }, { k: 'site_id', label: 'Objekt', type: 'site' }, { k: 'title', label: 'Naziv' },
  { k: 'start_date', label: 'Od', type: 'date' }, { k: 'end_date', label: 'Do', type: 'date' }, { k: 'interval_months', label: 'Interval (mesecev)', type: 'number' },
  { k: 'next_date', label: 'Naslednji servis', type: 'date' }, { k: 'price', label: 'Cena servisa', type: 'number' }, { k: 'sla', label: 'SLA' },
  { k: 'active', label: 'Aktivna', type: 'checkbox' }, { k: 'notes', label: 'Opombe', type: 'textarea', full: true },
]
export const woStatus: [string, string][] = [['planned', 'Planirano'], ['in_progress', 'V teku'], ['on_hold', 'Čaka'], ['done', 'Zaključeno'], ['cancelled', 'Preklicano']]
export const woTypes: [string, string][] = [['install', 'Montaža'], ['repair', 'Popravilo'], ['maintenance', 'Servis'], ['survey', 'Ogled'], ['other', 'Drugo']]
export const woPriority: [string, string][] = [['low', 'Nizka'], ['normal', 'Normalna'], ['high', 'Visoka'], ['urgent', 'Nujno']]
export const workorderFields: Field[] = [
  { k: 'customer_id', label: 'Stranka', type: 'customer' }, { k: 'site_id', label: 'Objekt', type: 'site' }, { k: 'title', label: 'Naziv' },
  { k: 'type', label: 'Tip', type: 'select', opts: woTypes }, { k: 'status', label: 'Status', type: 'select', opts: woStatus }, { k: 'priority', label: 'Prioriteta', type: 'select', opts: woPriority },
  { k: 'start', label: 'Začetek', type: 'datetime' }, { k: 'end', label: 'Konec', type: 'datetime' }, { k: 'technician', label: 'Tehnik' },
  { k: 'description', label: 'Opis', type: 'textarea', full: true },
]
