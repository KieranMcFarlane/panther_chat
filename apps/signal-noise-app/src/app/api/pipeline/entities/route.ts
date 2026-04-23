import { NextRequest, NextResponse } from 'next/server'
import { getCanonicalEntitiesSnapshot } from '@/lib/canonical-entities-snapshot'
import { getEntityDossierIndexRecord, type DossierStatus } from '@/lib/dossier-index'
import { matchesCanonicalSearch, buildCanonicalEntitySearchText } from '@/lib/canonical-search'

export const dynamic = 'force-dynamic'

type EntityRow = {
  id: string
  name: string
  type: string
  sport: string
  league: string
  country: string
  dossier_status: DossierStatus
  dossier_summary: string | null
  latest_generated_at: string | null
  review_status: string
  rerun_reason: string | null
}

type LightStatus = 'ready' | 'stale' | 'pending' | 'rerun_needed' | 'missing'

const STATUS_ORDER: Record<LightStatus, number> = {
  missing: 0,
  pending: 1,
  rerun_needed: 2,
  stale: 3,
  ready: 4,
}

function toText(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

// Fast heuristic from entity properties — no file I/O
function getLightweightStatus(entity: { properties?: Record<string, any> | null }): LightStatus {
  const props = entity.properties || {}
  const generatedAt = toText(props.latest_generated_at || props.generated_at)
  const enrichmentStatus = toText(props.enrichment_status).toLowerCase()
  const pipelineStatus = toText(props.last_pipeline_status).toLowerCase()

  if (enrichmentStatus === 'failed' || enrichmentStatus === 'incomplete') return 'rerun_needed'
  if (['queued', 'running', 'pending'].includes(pipelineStatus)) return 'pending'
  if (generatedAt) return 'ready'
  return 'missing'
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50')))
    const sortBy = searchParams.get('sortBy') || 'pipeline'
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc'
    const statusFilter = searchParams.get('status') || ''
    const search = (searchParams.get('search') || '').trim().toLowerCase()
    const entityType = (searchParams.get('entityType') || '').trim().toLowerCase()

    const canonicalEntities = await getCanonicalEntitiesSnapshot()

    // Attach lightweight status for sort/filter — no file I/O
    // Internal types to exclude from the audit view
    const EXCLUDED_TYPES = new Set(['hypothesis', 'hypothesisstate', 'signal', 'evidence', 'question'])

    const withLightStatus = canonicalEntities
      .filter((entity) => {
        const labels = (entity.labels || []).map((l: string) => String(l).toLowerCase())
        const propType = String(entity.properties?.type || '').toLowerCase()
        const name = String(entity.properties?.name || '')
        // Exclude internal types
        if (labels.some((l) => EXCLUDED_TYPES.has(l)) || EXCLUDED_TYPES.has(propType)) return false
        // Exclude entities with no real name (UUID fallback)
        if (!name || name === entity.id) return false
        return true
      })
      .map((entity) => ({
        entity,
        lightStatus: getLightweightStatus(entity),
      }))

    // Filter by type
    let filtered = withLightStatus
    if (entityType && entityType !== 'all') {
      filtered = filtered.filter(({ entity }) => {
        const labels = (entity.labels || []).map((l: string) => String(l).toLowerCase())
        const propType = String(entity.properties?.type || '').toLowerCase()
        return labels.includes(entityType) || propType === entityType
      })
    }

    // Filter by search
    if (search) {
      filtered = filtered.filter(({ entity }) =>
        matchesCanonicalSearch(search, buildCanonicalEntitySearchText(entity))
      )
    }

    // Filter by status (using lightweight heuristic)
    if (statusFilter && statusFilter !== 'all') {
      filtered = filtered.filter(({ lightStatus }) => lightStatus === statusFilter)
    }

    // Sort (using lightweight status)
    filtered.sort((a, b) => {
      let cmp = 0
      const aName = String(a.entity.properties?.name || a.entity.id).toLowerCase()
      const bName = String(b.entity.properties?.name || b.entity.id).toLowerCase()
      const aType = String(a.entity.properties?.type || a.entity.labels?.[0] || '').toLowerCase()
      const bType = String(b.entity.properties?.type || b.entity.labels?.[0] || '').toLowerCase()
      const aSport = String(a.entity.properties?.sport || '').toLowerCase()
      const bSport = String(b.entity.properties?.sport || '').toLowerCase()

      switch (sortBy) {
        case 'pipeline':
          cmp = (Number(b.entity.properties?.priority_score || 0) - Number(a.entity.properties?.priority_score || 0))
            || aType.localeCompare(bType)
            || aName.localeCompare(bName)
          break
        case 'name':
          cmp = aName.localeCompare(bName)
          break
        case 'type':
          cmp = aType.localeCompare(bType) || aName.localeCompare(bName)
          break
        case 'sport':
          cmp = aSport.localeCompare(bSport) || aName.localeCompare(bName)
          break
        case 'status':
          cmp = (STATUS_ORDER[a.lightStatus] ?? 0) - (STATUS_ORDER[b.lightStatus] ?? 0) || aName.localeCompare(bName)
          break
        case 'lastGenerated':
          cmp = String(a.entity.properties?.latest_generated_at || '').localeCompare(String(b.entity.properties?.latest_generated_at || '')) || aName.localeCompare(bName)
          break
        default:
          cmp = aName.localeCompare(bName)
      }
      return sortOrder === 'desc' ? -cmp : cmp
    })

    // Paginate
    const total = filtered.length
    const totalPages = Math.max(1, Math.ceil(total / limit))
    const start = (page - 1) * limit
    const pageItems = filtered.slice(start, start + limit)

    // Resolve full dossier status ONLY for the current page
    const entities: EntityRow[] = await Promise.all(
      pageItems.map(async ({ entity, lightStatus }) => {
        let dossierStatus: DossierStatus = lightStatus
        let dossierSummary: string | null = null
        let latestGeneratedAt: string | null = toText(entity.properties?.latest_generated_at || entity.properties?.generated_at) || null
        let reviewStatus: string = 'needs_review'
        let rerunReason: string | null = null

        try {
          const full = await getEntityDossierIndexRecord(entity.id, entity)
          dossierStatus = full.dossier_status
          dossierSummary = full.dossier_summary
          latestGeneratedAt = full.latest_generated_at
          reviewStatus = full.review_status
          rerunReason = full.rerun_reason
        } catch {
          // Fall back to lightweight status
        }

        return {
          id: entity.id,
          name: String(entity.properties?.name || entity.id),
          type: String(entity.properties?.type || entity.labels?.[0] || 'ENTITY'),
          sport: String(entity.properties?.sport || ''),
          league: String(entity.properties?.league || ''),
          country: String(entity.properties?.country || ''),
          dossier_status: dossierStatus,
          dossier_summary: dossierSummary,
          latest_generated_at: latestGeneratedAt,
          review_status: reviewStatus,
          rerun_reason: rerunReason,
        }
      })
    )

    return NextResponse.json({
      entities,
      page,
      totalPages,
      total,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    })
  } catch (error) {
    console.error('Failed to fetch pipeline entities:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch pipeline entities' },
      { status: 500 }
    )
  }
}
