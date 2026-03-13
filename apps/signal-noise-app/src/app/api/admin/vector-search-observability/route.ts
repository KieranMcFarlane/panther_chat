import { NextResponse } from 'next/server'
import { getVectorSearchObservabilitySnapshot } from '@/lib/vector-search-observability'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  return NextResponse.json({
    ok: true,
    snapshot: getVectorSearchObservabilitySnapshot(),
  })
}
