import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const GONE_PAYLOAD = {
  error: 'Legacy dossier API removed',
  message: 'Use /api/entities/[entityId]/dossier as the canonical dossier API backed by entity_dossiers and entity_pipeline_runs.',
  canonical_route: '/api/entities/[entityId]/dossier',
  status: 'gone',
}

export async function GET(_request: NextRequest) {
  return NextResponse.json(GONE_PAYLOAD, { status: 410 })
}

export async function POST(_request: NextRequest) {
  return NextResponse.json(GONE_PAYLOAD, { status: 410 })
}
