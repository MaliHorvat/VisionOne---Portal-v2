import { readFileSync } from 'node:fs'
import path from 'node:path'
import fontkit from '@pdf-lib/fontkit'
import { PDFDocument, PDFFont, PDFPage, rgb, type RGB } from 'pdf-lib'
import QRCode from 'qrcode'
import { money, numSl, parseLines, computeTotals } from './money'
import { invoiceReference, payloadText, upnPayload, type UPN } from './upn'
import type { Row } from './repo'

// PDF računa / ponudbe. Sestavine po ZDDV-1 so izpisane; ustreznost naj potrdi računovodja.
// Aplikacija NE izvaja davčnega potrjevanja FURS (ni ZOI/EOR) in NE ustvarja e-SLOG.

const black = rgb(0, 0, 0)
const muted = rgb(0.43, 0.43, 0.43)
const white = rgb(1, 1, 1)
const head = rgb(30 / 255, 41 / 255, 70 / 255)
const zebra = rgb(0.94, 0.95, 0.97)

let fonts: { regular: Buffer; bold: Buffer } | null = null
function fontBytes() {
  if (!fonts) {
    const dir = path.join(process.cwd(), 'fonts')
    fonts = {
      regular: readFileSync(path.join(dir, 'DejaVuSans.ttf')),
      bold: readFileSync(path.join(dir, 'DejaVuSans-Bold.ttf')),
    }
  }
  return fonts
}

function sdate(v: unknown) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v == null ? '' : String(v))
  return m ? `${m[3]}.${m[2]}.${m[1]}` : ''
}

function str(v: unknown) {
  return v == null ? '' : String(v)
}

function nonEmpty(...xs: string[]) {
  return xs.map((x) => x.trim()).filter(Boolean)
}

export async function upnPng(u: UPN): Promise<Buffer> {
  return QRCode.toBuffer(payloadText(upnPayload(u)), { errorCorrectionLevel: 'M', width: 400, margin: 1, type: 'png' })
}

export function buildUpn(inv: Row, customer: Row | null, s: Record<string, string>): UPN | null {
  if (!s.iban) return null
  const total = Number(inv.total) || 0
  const paid = Number(inv.paid_amount) || 0
  const due = sdate(inv.due_date)
  return {
    payerName: str(customer?.company || customer?.name),
    payerStreet: str(customer?.address),
    payerCity: [customer?.post, customer?.city].filter(Boolean).join(' '),
    amount: Math.round((total - paid) * 100) / 100,
    purpose: `Račun ${str(inv.number)}`,
    purposeCode: 'OTHR',
    dueDate: due,
    iban: s.iban,
    reference: str(inv.reference) || invoiceReference(str(inv.number)),
    name: s.company_name ?? '',
    street: s.company_address ?? '',
    city: [s.company_post, s.company_city].filter(Boolean).join(' '),
  }
}

type Ctx = {
  doc: PDFDocument
  font: PDFFont
  bold: PDFFont
  page: PDFPage
  y: number
}

const W = 595.28
const H = 841.89
const L = 42
const R = W - 42

function newPage(ctx: Ctx) {
  ctx.page = ctx.doc.addPage([W, H])
  ctx.y = H - 48
}

function need(ctx: Ctx, h: number) {
  if (ctx.y - h < 64) newPage(ctx)
}

function wrap(font: PDFFont, text: string, size: number, maxW: number) {
  const lines: string[] = []
  for (const para of (text || '').split('\n')) {
    const words = para.split(/\s+/).filter(Boolean)
    let cur = ''
    const push = (s: string) => { if (s) lines.push(s) }
    if (!words.length) { lines.push(''); continue }
    for (const w of words) {
      const next = cur ? cur + ' ' + w : w
      if (font.widthOfTextAtSize(next, size) > maxW && cur) {
        push(cur)
        cur = w
      } else cur = next
    }
    push(cur)
  }
  return lines.length ? lines : ['']
}

function draw(ctx: Ctx, text: string, x: number, size: number, opts: { bold?: boolean; color?: RGB; align?: 'left' | 'right'; width?: number } = {}) {
  const font = opts.bold ? ctx.bold : ctx.font
  const color = opts.color ?? black
  let dx = x
  if (opts.align === 'right' && opts.width) dx = x + opts.width - font.widthOfTextAtSize(text, size)
  ctx.page.drawText(text || '', { x: dx, y: ctx.y, size, font, color })
}

function textBlock(ctx: Ctx, text: string, x: number, width: number, size: number, opts: { bold?: boolean; color?: RGB; align?: 'left' | 'right'; line?: number } = {}) {
  const font = opts.bold ? ctx.bold : ctx.font
  const lh = opts.line ?? size + 3
  for (const line of wrap(font, text, size, width)) {
    need(ctx, lh)
    draw(ctx, line, x, size, { ...opts, width })
    ctx.y -= lh
  }
}

export async function renderPdf(opts: {
  kind: 'quotes' | 'invoices'
  docRow: Row
  settings: Record<string, string>
  customer: Row | null
  logo?: { bytes: Uint8Array; mime: string } | null
}): Promise<Uint8Array> {
  const { kind, docRow, settings: s, customer: cust } = opts
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  const fb = fontBytes()
  const font = await doc.embedFont(fb.regular, { subset: true })
  const bold = await doc.embedFont(fb.bold, { subset: true })
  const ctx: Ctx = { doc, font, bold, page: doc.addPage([W, H]), y: H - 48 }
  const vatPayer = s.vat_payer !== '0'
  const disc = Number(docRow.discount_pct) || 0
  const totals = computeTotals(parseLines(docRow.lines), disc)

  if (opts.logo && (opts.logo.mime === 'image/png' || opts.logo.mime === 'image/jpeg')) {
    try {
      const img = opts.logo.mime === 'image/png' ? await doc.embedPng(opts.logo.bytes) : await doc.embedJpg(opts.logo.bytes)
      const h = 40
      const w = img.width * (h / img.height)
      ctx.page.drawImage(img, { x: L, y: H - 58, width: Math.min(w, 160), height: h })
    } catch { /* logotip preskočen, če datoteka ni veljavna slika */ }
  }

  ctx.y = H - 48
  textBlock(ctx, s.company_name ?? '', 300, 250, 11, { bold: true, align: 'right' })
  textBlock(ctx, nonEmpty(s.company_address, [s.company_post, s.company_city].filter(Boolean).join(' '), s.company_vat ? 'ID za DDV: ' + s.company_vat : '', s.company_phone ? 'Tel: ' + s.company_phone : '', s.company_email ?? '').join('\n'), 300, 250, 8.5, { align: 'right' })

  ctx.y = Math.min(ctx.y, H - 150)
  const custTop = ctx.y
  draw(ctx, kind === 'quotes' ? 'Naročnik' : 'Kupec', L, 8, { color: muted })
  ctx.y -= 14
  const cname = str(cust?.company) || str(cust?.name)
  textBlock(ctx, cname, L, 250, 10.5, { bold: true })
  const lines = nonEmpty(str(cust?.address), [cust?.post, cust?.city].filter(Boolean).join(' '), str(cust?.country))
  if (str(cust?.vat_id)) lines.push(Number(cust?.vat_payer) === 1 ? 'ID za DDV: ' + str(cust?.vat_id) : 'Davčna št.: ' + str(cust?.vat_id))
  textBlock(ctx, lines.join('\n'), L, 250, 9)
  const afterCust = ctx.y

  ctx.y = custTop
  let title = 'PONUDBA'
  if (kind === 'invoices') {
    title = Number(docRow.total) < 0 ? 'DOBROPIS' : 'RAČUN'
    if (!str(docRow.issued_at)) title = 'OSNUTEK RAČUNA (ni izdan)'
  }
  draw(ctx, title, 300, 15, { bold: true, align: 'right', width: 250 })
  ctx.y -= 18
  draw(ctx, 'št. ' + str(docRow.number), 300, 10, { bold: true, align: 'right', width: 250 })
  ctx.y -= 16
  const meta: [string, string][] = [['Datum izdaje', sdate(docRow.date)]]
  if (kind === 'quotes') meta.push(['Veljavnost do', sdate(docRow.valid_until)])
  else {
    meta.push(['Datum storitve', sdate(docRow.service_date)], ['Rok plačila', sdate(docRow.due_date)])
    if (s.place_of_issue) meta.push(['Kraj izdaje', s.place_of_issue])
  }
  for (const [k, v] of meta) {
    if (!v) continue
    draw(ctx, k + ':', 300, 9, { align: 'right', width: 160 })
    draw(ctx, v, 470, 9, { align: 'right', width: 80 })
    ctx.y -= 13
  }
  ctx.y = Math.min(afterCust, ctx.y) - 10
  if (str(docRow.title)) textBlock(ctx, str(docRow.title), L, R - L, 10, { bold: true })

  const cols = [22, 210, 40, 32, 58, 36, 36, 58]
  const heads = ['#', 'Opis', 'Kol.', 'EM', 'Cena', 'Pop.', 'DDV', 'Znesek']
  need(ctx, 18)
  ctx.page.drawRectangle({ x: L, y: ctx.y - 4, width: R - L, height: 16, color: head })
  let x = L
  heads.forEach((h, i) => {
    const align = i === 1 || i === 3 ? 'left' : 'right'
    draw(ctx, h, x + (align === 'left' ? 2 : 0), 8, { bold: true, color: white, align, width: cols[i] - 2 })
    x += cols[i]
  })
  ctx.y -= 18

  for (let i = 0; i < totals.lines.length; i++) {
    const l = totals.lines[i]
    const desc = wrap(font, l.description || '', 8.5, cols[1] - 4)
    const rh = Math.max(1, desc.length) * 12
    need(ctx, rh + 2)
    if (i % 2 === 1) ctx.page.drawRectangle({ x: L, y: ctx.y - rh + 10, width: R - L, height: rh, color: zebra })
    const top = ctx.y
    draw(ctx, String(i + 1), L, 8.5, { align: 'right', width: cols[0] - 2 })
    desc.forEach((line, li) => {
      ctx.page.drawText(line, { x: L + cols[0] + 2, y: top - li * 12, size: 8.5, font, color: black })
    })
    const dp = l.discount_pct ? numSl(l.discount_pct) + ' %' : ''
    const vals = [numSl(l.qty), l.unit || '', money(l.price), dp, numSl(l.vat_rate) + ' %', money(l.net ?? 0)]
    x = L + cols[0] + cols[1]
    vals.forEach((v, j) => {
      const align = j === 1 ? 'left' : 'right'
      draw(ctx, v, x + (align === 'left' ? 2 : 0), 8.5, { align, width: cols[j + 2] - 2 })
      x += cols[j + 2]
    })
    ctx.y = top - rh
  }
  need(ctx, 8)
  ctx.page.drawLine({ start: { x: L, y: ctx.y + 8 }, end: { x: R, y: ctx.y + 8 }, thickness: 0.4, color: muted })
  ctx.y -= 8

  const totalsTop = ctx.y
  if (vatPayer) {
    draw(ctx, 'Rekapitulacija DDV', L, 8, { bold: true })
    ctx.y -= 14
    draw(ctx, 'Stopnja', L, 8)
    draw(ctx, 'Osnova', L + 70, 8, { align: 'right', width: 70 })
    draw(ctx, 'DDV', L + 150, 8, { align: 'right', width: 60 })
    ctx.y -= 4
    ctx.page.drawLine({ start: { x: L, y: ctx.y }, end: { x: L + 210, y: ctx.y }, thickness: 0.4, color: muted })
    ctx.y -= 12
    for (const b of totals.breakdown) {
      need(ctx, 12)
      draw(ctx, numSl(b.rate) + ' %', L, 8)
      draw(ctx, money(b.base), L + 70, 8, { align: 'right', width: 70 })
      draw(ctx, money(b.vat), L + 150, 8, { align: 'right', width: 60 })
      ctx.y -= 12
    }
  }
  const afterBreak = ctx.y
  ctx.y = totalsTop
  const row = (label: string, value: string, boldText = false) => {
    need(ctx, 14)
    draw(ctx, label, 320, boldText ? 11 : 9, { bold: boldText, align: 'right', width: 150 })
    draw(ctx, value, 470, boldText ? 11 : 9, { bold: boldText, align: 'right', width: 80 })
    ctx.y -= boldText ? 16 : 13
  }
  if (totals.discount) {
    row('Skupaj brez popusta', money(totals.gross))
    row(`Popust ${numSl(disc)} %`, '-' + money(totals.discount))
  }
  row('Osnova brez DDV', money(totals.net))
  if (vatPayer) row('DDV', money(totals.vat))
  row('ZA PLAČILO', money(totals.total), true)
  if (kind === 'invoices' && Number(docRow.paid_amount)) {
    row('Plačano', money(Number(docRow.paid_amount)))
    row('Odprto', money(totals.total - Number(docRow.paid_amount)))
  }
  ctx.y = Math.min(afterBreak, ctx.y) - 8

  if (!vatPayer) textBlock(ctx, 'DDV ni obračunan na podlagi 1. odstavka 94. člena ZDDV-1.', L, R - L, 8.5)
  if (str(docRow.notes)) textBlock(ctx, str(docRow.notes), L, R - L, 8.5)
  if (kind === 'quotes' && s.quote_footer) textBlock(ctx, s.quote_footer, L, R - L, 8.5)
  if (kind === 'invoices') {
    if (s.invoice_footer) textBlock(ctx, s.invoice_footer, L, R - L, 8.5)
    if (s.iban && str(docRow.issued_at) && totals.total > 0) {
      need(ctx, 110)
      const block = `Plačilo na TRR: ${s.iban}\nSklic: ${str(docRow.reference)}\nNamen: Račun ${str(docRow.number)}\nRok plačila: ${sdate(docRow.due_date)}`
      const yBefore = ctx.y
      textBlock(ctx, block, L, 360, 9)
      const upn = buildUpn(docRow, cust, s)
      if (upn && upn.amount > 0) {
        try {
          const png = await upnPng({ ...upn, amount: upn.amount })
          const img = await doc.embedPng(png)
          ctx.page.drawImage(img, { x: R - 90, y: yBefore - 90, width: 80, height: 80 })
          ctx.page.drawText('UPN QR', { x: R - 78, y: yBefore - 102, size: 7, font, color: muted })
        } catch { /* QR je pomožen; plačilni podatki so v besedilu */ }
      }
      ctx.y = Math.min(ctx.y, yBefore - 110)
    }
    if (str(docRow.issued_at)) textBlock(ctx, 'Odgovorna oseba / izdal: ' + (s.issuer_name || s.company_name || ''), L, R - L, 8)
  }

  const pages = doc.getPages()
  const foot = nonEmpty(s.company_name, s.company_address, [s.company_post, s.company_city].filter(Boolean).join(' '), s.company_vat ? 'ID za DDV: ' + s.company_vat : '', s.company_reg ? 'Mat. št.: ' + s.company_reg : '', s.iban ? 'TRR: ' + s.iban : '', s.bank ?? '').join(' · ')
  pages.forEach((p, i) => {
    const f = wrap(font, foot, 7, R - L).slice(0, 2)
    f.forEach((line, li) => p.drawText(line, { x: L, y: 36 - li * 9, size: 7, font, color: muted }))
    if (s.company_register_note) p.drawText(s.company_register_note.slice(0, 140), { x: L, y: 16, size: 7, font, color: muted })
    const label = `Stran ${i + 1}/${pages.length}`
    p.drawText(label, { x: R - font.widthOfTextAtSize(label, 7), y: 16, size: 7, font, color: muted })
  })
  return doc.save()
}
