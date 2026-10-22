// UPN QR (Združenje bank Slovenije). Polja in kontrolna vsota po specifikaciji ZBS,
// kodiranje ISO-8859-2. ECI oznaka in fiksna verzija QR 15 NISTA nastavljeni
// (knjižnica izbere velikost sama) — PREVERITI z bančno aplikacijo, preden se koda pošlje stranki.
// Sklic SI00 je brez kontrolne številke. To ni potrdilo skladnosti.

const latin2: Record<string, number> = {
  Č: 0xc8, č: 0xe8, Š: 0xa9, š: 0xb9, Ž: 0xae, ž: 0xbe, Ć: 0xc6, ć: 0xe6, Đ: 0xd0, đ: 0xf0,
}

export function toLatin2(s: string): Uint8Array {
  const out: number[] = []
  for (const r of s) {
    const cp = r.codePointAt(0) ?? 0
    if (cp < 128) out.push(cp)
    else if (latin2[r] != null) out.push(latin2[r])
    else if (cp < 256) out.push(cp)
    else out.push(0x3f)
  }
  return Uint8Array.from(out)
}

export function trunc(s: string, n: number): string {
  const clean = s.trim().replaceAll('\n', ' ')
  const chars = Array.from(clean)
  return chars.length <= n ? clean : chars.slice(0, n).join('')
}

export type UPN = {
  payerName: string
  payerStreet: string
  payerCity: string
  amount: number
  purpose: string
  purposeCode: string
  dueDate: string
  iban: string
  reference: string
  name: string
  street: string
  city: string
}

export function upnPayload(u: UPN): Uint8Array {
  const amt = u.amount > 0 ? String(Math.round(u.amount * 100 + Number.EPSILON)).padStart(11, '0') : ''
  const code = u.purposeCode || 'OTHR'
  const fields = [
    'UPNQR', '', '', '', '',
    trunc(u.payerName, 33), trunc(u.payerStreet, 33), trunc(u.payerCity, 33),
    amt, '', '', code, trunc(u.purpose, 42), u.dueDate,
    u.iban.replaceAll(' ', ''), u.reference.replaceAll(' ', ''),
    trunc(u.name, 33), trunc(u.street, 33), trunc(u.city, 33),
  ]
  const body = toLatin2(fields.join('\n') + '\n')
  const len = String(body.length).padStart(3, '0') + '\n'
  const tail = toLatin2(len)
  const out = new Uint8Array(body.length + tail.length)
  out.set(body, 0)
  out.set(tail, body.length)
  return out
}

export function invoiceReference(number: string): string {
  const d = number.replace(/[^0-9-]/g, '')
  return 'SI00' + d
}

export function payloadText(p: Uint8Array): string {
  return Buffer.from(p).toString('latin1')
}
