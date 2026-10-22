// Zaokroževanje zneskov na cente (polovica stran od ničle), enako kot izvirni portal.
// DDV 22 / 9,5 / 5 / 0 % se obračuna po skupinah stopenj. To NI davčno potrjevanje (FURS) in NI e-SLOG.

export type Line = {
  product_id?: number
  description: string
  qty: number
  unit: string
  price: number
  discount_pct: number
  vat_rate: number
  net?: number
}

export type VatRow = { rate: number; base: number; vat: number }

export type Totals = {
  lines: Line[]
  gross: number
  discount: number
  net: number
  vat: number
  total: number
  breakdown: VatRow[]
}

export function cents(x: number): number {
  return Math.round(x * 100 + Number.EPSILON * Math.sign(x))
}

export function eur(c: number): number {
  return c / 100
}

export function computeTotals(lines: Line[], docDiscount = 0): Totals {
  const groups = new Map<number, number>()
  let gross = 0
  const out = lines.map((l) => {
    const n = cents((+l.qty || 0) * (+l.price || 0) * (1 - (+l.discount_pct || 0) / 100))
    gross += n
    const rate = +l.vat_rate || 0
    groups.set(rate, (groups.get(rate) ?? 0) + n)
    return { ...l, net: eur(n) }
  })
  let net = 0
  let vat = 0
  const breakdown = [...groups.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([rate, base]) => {
      const b = base - cents(eur(base) * docDiscount / 100)
      const v = cents(eur(b) * rate / 100)
      net += b
      vat += v
      return { rate, base: eur(b), vat: eur(v) }
    })
  return {
    lines: out,
    gross: eur(gross),
    discount: eur(gross - net),
    net: eur(net),
    vat: eur(vat),
    total: eur(net + vat),
    breakdown,
  }
}

export function parseLines(v: unknown): Line[] {
  let data: unknown = v
  if (typeof v === 'string') {
    if (!v) return []
    try { data = JSON.parse(v) } catch { return [] }
  }
  if (!Array.isArray(data)) return []
  return data.map((raw) => {
    const l = (raw ?? {}) as Partial<Line>
    return {
      product_id: l.product_id ? Number(l.product_id) : undefined,
      description: l.description ?? '',
      qty: Number(l.qty) || 0,
      unit: l.unit ?? '',
      price: Number(l.price) || 0,
      discount_pct: Number(l.discount_pct) || 0,
      vat_rate: Number(l.vat_rate) || 0,
      net: l.net,
    }
  })
}

export function money(x: number): string {
  const neg = x < 0
  const s = Math.abs(x).toFixed(2)
  const ip = s.slice(0, -3)
  const dp = s.slice(-2)
  let grouped = ''
  for (let i = 0; i < ip.length; i++) {
    if (i > 0 && (ip.length - i) % 3 === 0) grouped += '.'
    grouped += ip[i]
  }
  return (neg ? '-' : '') + grouped + ',' + dp + ' €'
}

export function numSl(x: number): string {
  const s = x.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')
  return s.replace('.', ',')
}
