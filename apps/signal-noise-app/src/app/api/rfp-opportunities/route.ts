import { NextRequest, NextResponse } from 'next/server'

import { loadUnifiedRfpOpportunities } from '@/lib/rfp-unified-store'

export const dynamic = 'force-dynamic'

function toInt(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value || '', 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || 'list'
    const limit = Math.max(1, Math.min(toInt(searchParams.get('limit'), 50), 200))
    const offset = Math.max(0, toInt(searchParams.get('offset'), 0))
    const id = searchParams.get('id')
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

    if (action === 'detail') {
      if (!id) {
        return NextResponse.json({ success: false, error: 'Missing opportunity ID' }, { status: 400 })
      }

      const opportunity = canonical.opportunities.find((candidate) => candidate.id === id)
      if (!opportunity) {
        return NextResponse.json({ success: false, error: 'Opportunity not found' }, { status: 404 })
      }

      return NextResponse.json({
        success: true,
        data: {
          opportunity,
          source: 'rfp_opportunities_unified',
          last_updated: canonical.latestDetectedAt,
        },
      })
    }

    if (action === 'stats') {
      const total = filtered.length
      const highFit = filtered.filter((opportunity) => (opportunity.yellow_panther_fit || 0) >= 80).length
      const avgFit = total > 0
        ? filtered.reduce((sum, opportunity) => sum + (opportunity.yellow_panther_fit || 0), 0) / total
        : 0

      return NextResponse.json({
        success: true,
        data: {
          total_opportunities: total,
          high_fit_opportunities: highFit,
          average_fit_score: Number(avgFit.toFixed(1)),
          latest_detected_at: canonical.latestDetectedAt,
          source: 'rfp_opportunities_unified',
        },
      })
    }

    const opportunities = filtered.slice(offset, offset + limit)

    return NextResponse.json({
      success: true,
      data: {
        opportunities,
        total_count: filtered.length,
        limit,
        offset,
        source: 'rfp_opportunities_unified',
        last_updated: canonical.latestDetectedAt,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load canonical RFP opportunities',
      },
      { status: 500 },
    )
  }
}
