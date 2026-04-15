import { NextRequest, NextResponse } from 'next/server'

import { loadUnifiedRfpOpportunities } from '@/lib/rfp-unified-store'

export const dynamic = 'force-dynamic'

function toInt(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value || '', 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

function mapLegacyTenderShape(opportunity: Awaited<ReturnType<typeof loadUnifiedRfpOpportunities>>['opportunities'][number]) {
  return {
    id: opportunity.id,
    title: opportunity.title,
    organization: opportunity.organization,
    description: opportunity.description,
    category: opportunity.category,
    deadline: opportunity.deadline,
    source_url: opportunity.source_url,
    entity_id: opportunity.entity_id,
    entity_name: opportunity.entity_name,
    canonical_entity_id: opportunity.canonical_entity_id,
    canonical_entity_name: opportunity.canonical_entity_name,
    yellow_panther_fit: opportunity.yellow_panther_fit,
    status: opportunity.status,
    source: opportunity.source || 'rfp_opportunities_unified',
    detected_at: opportunity.detected_at,
    published: opportunity.published,
    location: opportunity.location,
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = (searchParams.get('action') || 'list').trim().toLowerCase()
    const limit = Math.max(1, Math.min(toInt(searchParams.get('limit'), 100), 250))
    const offset = Math.max(0, toInt(searchParams.get('offset'), 0))
    const status = (searchParams.get('status') || '').trim().toLowerCase()
    const category = (searchParams.get('category') || '').trim().toLowerCase()
    const minFit = toInt(searchParams.get('min_fit'), 0)

    const canonical = await loadUnifiedRfpOpportunities()
    const filtered = canonical.opportunities.filter((opportunity) => {
      const statusMatches = !status || String(opportunity.status || '').toLowerCase() === status
      const categoryMatches = !category || String(opportunity.category || '').toLowerCase().includes(category)
      const fitMatches = typeof opportunity.yellow_panther_fit === 'number'
        ? opportunity.yellow_panther_fit >= minFit
        : minFit <= 0
      return statusMatches && categoryMatches && fitMatches
    })

    if (action === 'stats') {
      const totalOpportunities = filtered.length
      const averageFit = totalOpportunities > 0
        ? filtered.reduce((sum, item) => sum + (item.yellow_panther_fit || 0), 0) / totalOpportunities
        : 0

      return NextResponse.json({
        total_opportunities: totalOpportunities,
        high_fit_score: filtered.filter((item) => (item.yellow_panther_fit || 0) >= 80).length,
        average_fit_score: Number(averageFit.toFixed(1)),
        source: 'rfp_opportunities_unified',
        deprecated: true,
      })
    }

    const windowed = filtered.slice(offset, offset + limit).map(mapLegacyTenderShape)

    return NextResponse.json({
      opportunities: windowed,
      total: filtered.length,
      offset,
      limit,
      source: 'rfp_opportunities_unified',
      deprecated: true,
      message: 'Use /api/rfp-opportunities for the canonical RFP API.',
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to load canonical tenders alias',
        source: 'rfp_opportunities_unified',
        deprecated: true,
      },
      { status: 500 },
    )
  }
}

export async function POST() {
  return NextResponse.json(
    {
      error: 'Legacy tenders mutations removed',
      message: 'Use canonical RFP maintenance flows instead of /api/tenders mutations.',
      source: 'rfp_opportunities_unified',
      deprecated: true,
    },
    { status: 410 },
  )
}
