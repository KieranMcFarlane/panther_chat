import { NextRequest, NextResponse } from 'next/server'

import { requireCronSecret } from '@/lib/cron-auth'
import { loadLatestWideRfpResearchBatch } from '@/lib/rfp-wide-research-store'
import { getDefaultWideRfpSeedQuery } from '@/lib/rfp-wide-research.mjs'
import { UnauthorizedError } from '@/lib/server-auth'

async function runWideResearchSeed(request: NextRequest) {
  requireCronSecret(request)

  const latest = await loadLatestWideRfpResearchBatch({})
  if (!latest?.batch?.prompt) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'No non-empty wide research batch is available to seed from' })
  }

  const response = await fetch(new URL('/api/rfp-wide-research', request.url), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      focusArea: latest.batch.focus_area,
      seedQuery: latest.batch.seed_query || getDefaultWideRfpSeedQuery(latest.batch.focus_area),
      currentRfpPage: '/rfps',
      currentIntakePage: '/tenders',
      targetYear: normalizeTargetYear(latest.batch.target_year || new Date().getFullYear()),
      excludeNames: collectOpportunityNames(latest.batch),
    }),
  })

  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    return NextResponse.json(
      {
        ok: false,
        reason: payload?.error || payload?.message || `Wide research seed failed with ${response.status}`,
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

export async function GET(request: NextRequest) {
  try {
    return await runWideResearchSeed(request)
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    console.error('Wide research seed cron failed', { error })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to seed wide research' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}

function collectOpportunityNames(batch: any): string[] {
  const names = new Set<string>()
  for (const opportunity of batch?.opportunities || []) {
    const raw = [
      opportunity?.canonical_entity_name,
      opportunity?.organization,
      opportunity?.entity_name,
    ]
      .map((value) => toText(value))
      .find(Boolean)

    if (raw) {
      names.add(raw)
    }
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
