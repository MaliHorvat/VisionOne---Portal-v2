import { dispatch } from '@/lib/handlers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function handle(req: Request) {
  return dispatch(req)
}

export const GET = handle
export const POST = handle
export const PUT = handle
export const DELETE = handle
