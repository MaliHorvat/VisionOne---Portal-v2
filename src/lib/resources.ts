export type ColType = 'text' | 'int' | 'real' | 'json' | 'secret'

export type Col = { name: string; type: ColType }

export type Resource = {
  table: string
  cols: Col[]
  search: string[]
  parents: string[]
  order: string
}

const c = (name: string, type: ColType): Col => ({ name, type })

export const resources: Record<string, Resource> = {
  customers: {
    table: 'customers', order: 'name', parents: [],
    search: ['name', 'company', 'vat_id', 'email', 'phone', 'city', 'address'],
    cols: [c('kind', 'text'), c('name', 'text'), c('company', 'text'), c('vat_id', 'text'), c('vat_payer', 'int'), c('reg_no', 'text'),
      c('address', 'text'), c('post', 'text'), c('city', 'text'), c('country', 'text'), c('email', 'text'), c('phone', 'text'),
      c('contacts', 'json'), c('lat', 'real'), c('lng', 'real'), c('notes', 'text'), c('tags', 'text'), c('payment_days', 'int')],
  },
  sites: {
    table: 'sites', order: 'name', parents: ['customer_id'], search: ['name', 'address', 'city', 'notes'],
    cols: [c('customer_id', 'int'), c('name', 'text'), c('address', 'text'), c('post', 'text'), c('city', 'text'), c('lat', 'real'), c('lng', 'real'),
      c('access_info', 'text'), c('alarm_code', 'secret'), c('wifi', 'secret'), c('internet', 'text'), c('notes', 'text')],
  },
  equipment: {
    table: 'equipment', order: 'type, name', parents: ['customer_id', 'site_id'],
    search: ['name', 'brand', 'model', 'serial', 'ip', 'mac', 'location'],
    cols: [c('customer_id', 'int'), c('site_id', 'int'), c('type', 'text'), c('name', 'text'), c('brand', 'text'), c('model', 'text'), c('serial', 'text'),
      c('ip', 'text'), c('mac', 'text'), c('vlan', 'text'), c('port', 'text'), c('firmware', 'text'), c('username', 'text'), c('password', 'secret'),
      c('location', 'text'), c('install_date', 'text'), c('warranty_until', 'text'), c('status', 'text'), c('product_id', 'int'), c('notes', 'text')],
  },
  networks: {
    table: 'networks', order: 'name', parents: ['site_id', 'customer_id'], search: ['name', 'subnet'],
    cols: [c('customer_id', 'int'), c('site_id', 'int'), c('name', 'text'), c('vlan', 'text'), c('subnet', 'text'), c('gateway', 'text'), c('dns', 'text'),
      c('dhcp_range', 'text'), c('public_ip', 'text'), c('ddns', 'text'), c('port_forwards', 'text'), c('notes', 'text')],
  },
  documents: {
    table: 'documents', order: 'created_at DESC', parents: ['customer_id', 'site_id', 'workorder_id'], search: ['title', 'filename'],
    cols: [c('customer_id', 'int'), c('site_id', 'int'), c('workorder_id', 'int'), c('kind', 'text'), c('title', 'text'), c('filename', 'text'),
      c('mime', 'text'), c('size', 'int'), c('path', 'text')],
  },
  diagrams: {
    table: 'diagrams', order: 'name', parents: ['site_id', 'customer_id'], search: ['name'],
    cols: [c('customer_id', 'int'), c('site_id', 'int'), c('name', 'text'), c('background_id', 'int'), c('items', 'json')],
  },
  workorders: {
    table: 'workorders', order: 'start DESC', parents: ['customer_id', 'site_id', 'contract_id'], search: ['title', 'description', 'report'],
    cols: [c('customer_id', 'int'), c('site_id', 'int'), c('contract_id', 'int'), c('title', 'text'), c('type', 'text'), c('status', 'text'), c('priority', 'text'),
      c('start', 'text'), c('end', 'text'), c('technician', 'text'), c('description', 'text'), c('report', 'text'), c('checklist', 'json'),
      c('time_entries', 'json'), c('materials', 'json'), c('signature', 'text'), c('signed_by', 'text'), c('signed_at', 'text')],
  },
  products: {
    table: 'products', order: 'name', parents: [], search: ['name', 'sku', 'brand', 'category'],
    cols: [c('kind', 'text'), c('sku', 'text'), c('name', 'text'), c('brand', 'text'), c('category', 'text'), c('unit', 'text'),
      c('price', 'real'), c('cost', 'real'), c('vat_rate', 'real'), c('stock', 'real'), c('min_stock', 'real'), c('location', 'text'), c('notes', 'text')],
  },
  stock_moves: {
    table: 'stock_moves', order: 'created_at DESC', parents: ['product_id'], search: [],
    cols: [c('product_id', 'int'), c('qty', 'real'), c('reason', 'text'), c('ref', 'text')],
  },
  quotes: {
    table: 'quotes', order: 'id DESC', parents: ['customer_id', 'site_id'], search: ['number', 'title'],
    cols: [c('customer_id', 'int'), c('site_id', 'int'), c('number', 'text'), c('title', 'text'), c('date', 'text'), c('valid_until', 'text'),
      c('status', 'text'), c('lines', 'json'), c('discount_pct', 'real'), c('notes', 'text'), c('net', 'real'), c('vat', 'real'), c('total', 'real'), c('invoice_id', 'int')],
  },
  invoices: {
    table: 'invoices', order: 'id DESC', parents: ['customer_id', 'site_id', 'quote_id'], search: ['number', 'title', 'reference'],
    cols: [c('customer_id', 'int'), c('site_id', 'int'), c('quote_id', 'int'), c('number', 'text'), c('title', 'text'), c('date', 'text'),
      c('service_date', 'text'), c('due_date', 'text'), c('status', 'text'), c('lines', 'json'), c('discount_pct', 'real'), c('notes', 'text'),
      c('net', 'real'), c('vat', 'real'), c('total', 'real'), c('paid_amount', 'real'), c('paid_date', 'text'), c('payment_method', 'text'),
      c('reference', 'text'), c('issued_at', 'text')],
  },
  contracts: {
    table: 'contracts', order: 'next_date', parents: ['customer_id', 'site_id'], search: ['title', 'notes'],
    cols: [c('customer_id', 'int'), c('site_id', 'int'), c('title', 'text'), c('start_date', 'text'), c('end_date', 'text'), c('interval_months', 'int'),
      c('next_date', 'text'), c('price', 'real'), c('sla', 'text'), c('active', 'int'), c('checklist', 'json'), c('notes', 'text')],
  },
}

export const lockedInvoiceFields = new Set(['number', 'lines', 'discount_pct', 'date', 'customer_id', 'net', 'vat', 'total', 'issued_at'])

export const childTables: Record<string, string[]> = {
  customers: ['sites', 'equipment', 'networks', 'diagrams', 'documents', 'contracts', 'workorders', 'quotes'],
  sites: ['equipment', 'networks', 'diagrams'],
}

export const parentKey: Record<string, string> = { customers: 'customer_id', sites: 'site_id' }

const ident = /^[a-z_]+$/

export function assertOrder(order: string) {
  if (!/^[a-z0-9_, ]+$/i.test(order)) throw new Error('bad order')
}

export function assertIdent(name: string) {
  if (!ident.test(name)) throw new Error('bad identifier')
}
