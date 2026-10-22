import { describe, it, expect } from 'vitest'
import { totals } from './api'

describe('totals', () => {
  it('matches backend rounding with mixed VAT', () => {
    const t = totals([{ description: '', qty: 2, price: 149, vat_rate: 22, discount_pct: 0, unit: '' }, { description: '', qty: 3, price: 10, vat_rate: 9.5, discount_pct: 10, unit: '' }, { description: '', qty: 1, price: 0.333, vat_rate: 22, discount_pct: 0, unit: '' }])
    expect(t.net).toBe(325.33); expect(t.vat).toBe(68.2); expect(t.total).toBe(393.53)
    expect(t.breakdown.map((b) => b.rate)).toEqual([22, 9.5])
  })
  it('applies document discount', () => {
    const t = totals([{ description: '', qty: 1, price: 100, vat_rate: 22, discount_pct: 0, unit: '' }], 10)
    expect(t).toMatchObject({ net: 90, vat: 19.8, total: 109.8, discount: 10 })
  })
})
