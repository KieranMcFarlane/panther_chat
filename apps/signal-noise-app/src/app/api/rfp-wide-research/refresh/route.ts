import { NextRequest, NextResponse } from 'next/server'

import { requireApiSession, UnauthorizedError } from '@/lib/server-auth'
import { loadLatestWideRfpResearchBatch } from '@/lib/rfp-wide-research-store'
import { getDefaultWideRfpSeedQuery } from '@/lib/rfp-wide-research.mjs'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function refreshWideResearch(request: NextRequest) {
  await requireApiSession(request)
  const body = await request.json().catch(() => ({} as { targetYear?: number | string | null; prompt?: string | null; excludeTitles?: string[] }))

  const latest = await loadLatestWideRfpResearchBatch({})
  if (!latest?.batch?.prompt) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: 'No non-empty wide research batch is available to seed from',
    })
  }

  const excludeTitles = normalizeNameList(
    body?.excludeTitles?.length
      ? body.excludeTitles
      : body?.excludeNames?.length
        ? body.excludeNames
        : collectOpportunityTitles(latest.batch),
  )
  const targetYear = normalizeTargetYear(body?.targetYear ?? latest.batch.target_year ?? new Date().getFullYear())

  const response = await fetch(new URL('/api/rfp-wide-research', request.url), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: body?.prompt || latest.batch.prompt,
      focusArea: latest.batch.focus_area,
      seedQuery: latest.batch.seed_query || getDefaultWideRfpSeedQuery(latest.batch.focus_area),
      currentRfpPage: '/rfps',
      currentIntakePage: '/tenders',
      targetYear,
      excludeNames: excludeTitles,
      excludeTitles,
    }),
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    return NextResponse.json(
      {
        ok: false,
        reason: payload?.error || payload?.message || `Wide research refresh failed with ${response.status}`,
      },
      { status: response.status },
    )
  }

  return NextResponse.json({
    ok: true,
    seeded_from_run_id: latest.batch.run_id || null,
    seeded_from_focus_area: latest.batch.focus_area || null,
    latest_successful_generated_at: latest.batch.generated_at || null,
    result: payload,
  })
}

export async function POST(request: NextRequest) {
  try {
    return await refreshWideResearch(request)
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    console.error('Wide research refresh failed', { error })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to refresh wide research' },
      { status: 500 },
    )
  }
}

export async function GET(request: NextRequest) {
  return POST(request)
}

function collectOpportunityTitles(batch: any): string[] {
  const names = new Set<string>()
  for (const opportunity of batch?.opportunities || []) {
    const raw = [
      opportunity?.title,
      opportunity?.organization,
      opportunity?.entity_name,
      opportunity?.canonical_entity_name,
    ]
      .map((value) => toText(value))
      .find(Boolean)

    if (raw) {
      names.add(raw)
    }
  }
  return Array.from(names)
}

function normalizeNameList(values: unknown[]): string[] {
  const names = new Set<string>()
  for (const value of values || []) {
    const text = toText(value)
    if (!text) continue
    names.add(text)
  }
  return Array.from(names)
}

function normalizeTargetYear(value: unknown): number | null {
  const text = toText(value)
  if (!text) return null
  const parsed = Number.parseInt(text, 10)
  if (!Number.isInteger(parsed) || parsed < 1900 || parsed > 2100) return null
  return parsed
}

function toText(value: unknown): string {
  return value === null || value === undefined ? '' : String(value).trim()
}
