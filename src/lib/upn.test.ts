import { describe, expect, it } from 'vitest'
import { payloadText, upnPayload } from './upn'

describe('UPN', () => {
  it('builds the 19-field payload and latin-2 checksum', () => {
    const p = upnPayload({
      payerName: 'Janez Novak', payerStreet: '', payerCity: '',
      amount: 123.45, purpose: 'Račun 2026-0001', purposeCode: 'OTHR', dueDate: '01.11.2026',
      iban: 'SI56 0201 0001 2345 678', reference: 'SI00 2026-0001',
      name: 'Varnost Horvat s.p.', street: 'Tržaška 12', city: '1000 Ljubljana',
    })
    const parts = payloadText(p).split('\n')
    expect(parts[0]).toBe('UPNQR')
    expect(parts[8]).toBe('00000012345')
    expect(parts[14]).toBe('SI56020100012345678')
    expect(parts.length).toBe(21)
    const body = p.subarray(0, p.length - 4)
    const len = String(body.length).padStart(3, '0')
    expect(payloadText(p).slice(-4, -1)).toBe(len)
    expect(p.includes(0xe8)).toBe(true)
  })
})
