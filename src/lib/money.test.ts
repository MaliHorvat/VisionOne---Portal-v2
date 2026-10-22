import { describe, expect, it } from 'vitest'
import { computeTotals } from './money'

describe('totals', () => {
  it('matches mixed VAT rounding', () => {
    const tt = computeTotals([
      { description: '', qty: 2, price: 149, vat_rate: 22, discount_pct: 0, unit: '' },
      { description: '', qty: 3, price: 10, vat_rate: 9.5, discount_pct: 10, unit: '' },
      { description: '', qty: 1, price: 0.333, vat_rate: 22, discount_pct: 0, unit: '' },
    ], 0)
    expect(tt.net).toBe(298.33 + 27)
    expect(tt.lines[1].net).toBe(27)
    expect(tt.vat).toBe(68.2)
    expect(tt.total).toBe(393.53)
    expect(tt.breakdown.map((b) => b.rate)).toEqual([22, 9.5])
  })
  it('applies document discount', () => {
    const d = computeTotals([{ description: '', qty: 1, price: 100, vat_rate: 22, discount_pct: 0, unit: '' }], 10)
    expect(d.net).toBe(90)
    expect(d.vat).toBe(19.8)
    expect(d.total).toBe(109.8)
    expect(d.discount).toBe(10)
  })
})
