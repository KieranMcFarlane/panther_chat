import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const GONE_PAYLOAD = {
  error: 'Legacy dossier file API removed',
  message: 'Filesystem dossier reads are no longer allowed on UI-serving paths. Use /api/entities/[entityId]/dossier instead.',
  canonical_route: '/api/entities/[entityId]/dossier',
  status: 'gone',
}

export async function GET(_request: NextRequest) {
  return NextResponse.json(GONE_PAYLOAD, { status: 410 })
}
