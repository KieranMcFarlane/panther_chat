import { NextRequest, NextResponse } from 'next/server'
import { syncGraphitiDossierIngestionMemory } from '@/lib/graphiti-dossier-memory-bridge'
import { requireApiSession, UnauthorizedError } from '@/lib/server-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    await requireApiSession(request)
    const body = await request.json().catch(() => ({}))
    const limit = Number(body?.limit || 100)
    const concurrency = Number(body?.concurrency || 2)
    const dryRun = body?.dry_run === true || body?.dryRun === true

    const result = await syncGraphitiDossierIngestionMemory({
      limit: Number.isFinite(limit) && limit > 0 ? limit : 100,
      concurrency: Number.isFinite(concurrency) && concurrency > 0 ? concurrency : 2,
      dryRun,
    })

    return NextResponse.json({
      ok: true,
      dry_run: dryRun,
      graphiti_memory_sync: result,
      last_updated_at: new Date().toISOString(),
    })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to sync Graphiti dossier memories' },
      { status: 500 },
    )
  }
}
