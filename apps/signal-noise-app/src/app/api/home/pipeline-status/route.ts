import { NextRequest, NextResponse } from 'next/server'
import { loadCanonicalPipelineStatus } from '@/lib/pipeline-status'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const limitParam = Number(request.nextUrl.searchParams.get('limit') || 100)
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 500) : 100
  const payload = await loadCanonicalPipelineStatus(limit)

  return NextResponse.json(payload)
}
