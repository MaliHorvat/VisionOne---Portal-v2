export type Row = Record<string, any> & { id: number }
export class ApiError extends Error { status: number; constructor(s: number, m: string) { super(m); this.status = s } }

export async function api<T = any>(path: string, opts: { method?: string; body?: any } = {}): Promise<T> {
  const isForm = opts.body instanceof FormData
  const res = await fetch('/api' + path, {
    method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'),
    headers: { 'X-Portal': '1', ...(isForm || opts.body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: opts.body === undefined ? undefined : isForm ? opts.body : JSON.stringify(opts.body),
    credentials: 'same-origin',
  })
  const txt = await res.text()
  let data: any = null
  try { data = txt ? JSON.parse(txt) : null } catch { data = txt }
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/login')) window.dispatchEvent(new Event('portal-logout'))
    throw new ApiError(res.status, data?.error ?? res.statusText)
  }
  return data as T
}

export const list = (res: string, q: Record<string, any> = {}) => {
  const p = new URLSearchParams(Object.entries(q).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => [k, String(v)]))
  return api<Row[]>(`/r/${res}${p.toString() ? '?' + p : ''}`)
}
export const getOne = (res: string, id: number | string) => api<Row>(`/r/${res}/${id}`)
export const saveRow = (res: string, row: Partial<Row>) => api<Row>(row.id ? `/r/${res}/${row.id}` : `/r/${res}`, { method: row.id ? 'PUT' : 'POST', body: row })
export const delRow = (res: string, id: number) => api(`/r/${res}/${id}`, { method: 'DELETE' })

export async function upload(file: File, meta: Record<string, any>) {
  if (file.size > 3_500_000) {
    const mode = await api<{ mode: string }>('/upload/mode').catch(() => ({ mode: 'local' as const }))
    if (mode.mode === 'blob') {
      const { upload: blobUpload } = await import('@vercel/blob/client')
      const blob = await blobUpload(file.name, file, {
        access: 'private',
        handleUploadUrl: '/api/blob',
        clientPayload: JSON.stringify(meta),
      })
      return api<Row>('/upload', { body: { ...meta, blobPath: blob.pathname, filename: file.name, mime: blob.contentType || file.type || 'application/octet-stream', size: file.size, title: meta.title || file.name } })
    }
  }
  const fd = new FormData()
  fd.append('file', file)
  for (const [k, v] of Object.entries(meta)) if (v !== undefined && v !== null) fd.append(k, String(v))
  return api<Row>('/upload', { body: fd })
}

export type { Line } from '@/lib/money'
export { computeTotals as totals } from '@/lib/money'

export const fmtMoney = (x: any) => (typeof x === 'number' ? x : +x || 0).toLocaleString('sl-SI', { style: 'currency', currency: 'EUR' })
export const fmtDate = (s: any) => { if (!s) return ''; const d = new Date(String(s).length <= 10 ? s + 'T00:00' : s); return isNaN(+d) ? String(s) : d.toLocaleDateString('sl-SI') }
export const fmtDT = (s: any) => { if (!s) return ''; const d = new Date(s); return isNaN(+d) ? String(s) : d.toLocaleString('sl-SI', { dateStyle: 'short', timeStyle: 'short' }) }
export const today = () => new Date().toLocaleDateString('sv-SE')
export const custName = (c?: Row | null) => (c ? c.company || c.name : '')
