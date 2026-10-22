import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export function prisma() {
  if (!globalForPrisma.prisma) {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL missing')
    globalForPrisma.prisma = new PrismaClient({ log: process.env.PRISMA_LOG ? ['query', 'error'] : ['error'] })
  }
  return globalForPrisma.prisma
}

export type Sql = {
  inTx: boolean
  q<T = Record<string, unknown>>(sql: string, ...params: unknown[]): Promise<T[]>
  exec(sql: string, ...params: unknown[]): Promise<number>
}

function normalizeValue(v: unknown): unknown {
  if (typeof v === 'bigint') return Number(v)
  if (v instanceof Uint8Array) return Buffer.from(v).toString('utf8')
  if (v && typeof v === 'object' && typeof (v as { toNumber?: () => number }).toNumber === 'function') {
    return (v as { toNumber: () => number }).toNumber()
  }
  return v
}

export function normalizeRow<T>(row: Record<string, unknown>): T {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(row)) out[k] = normalizeValue(v)
  return out as T
}

function clientSql(client: { $queryRawUnsafe: PrismaClient['$queryRawUnsafe']; $executeRawUnsafe: PrismaClient['$executeRawUnsafe'] }, inTx: boolean): Sql {
  return {
    inTx,
    async q<T>(sql: string, ...params: unknown[]) {
      const rows = await client.$queryRawUnsafe<Record<string, unknown>[]>(sql, ...params)
      return rows.map((r) => normalizeRow<T>(r))
    },
    exec(sql: string, ...params: unknown[]) {
      return client.$executeRawUnsafe(sql, ...params)
    },
  }
}

export function sql(): Sql {
  return clientSql(prisma(), false)
}

export async function tx<T>(fn: (t: Sql) => Promise<T>): Promise<T> {
  return prisma().$transaction(async (client) => fn(clientSql(client, true)), { timeout: 20000 })
}

export function nowIso() {
  return new Date().toISOString()
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

export function addDays(isoDate: string, days: number) {
  const [y, m, d] = isoDate.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + days))
  return dt.toISOString().slice(0, 10)
}

export function addMonths(isoDate: string, months: number) {
  const [y, m, d] = isoDate.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1 + months, d))
  return dt.toISOString().slice(0, 10)
}
