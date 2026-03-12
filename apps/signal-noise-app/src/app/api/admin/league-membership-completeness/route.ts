import { NextResponse } from 'next/server'
import { cachedEntitiesSupabase as supabase } from '@/lib/cached-entities-supabase'

type CountMap = Record<string, number>

export async function GET() {
  try {
    const { data: cachedEntities, error: cachedError } = await supabase
      .from('cached_entities')
      .select('id, labels, properties')
      .limit(20000)

    if (cachedError) {
      throw cachedError
    }

    const leagueClubCountsActual: CountMap = {}
    const clubsMissingLeague: Array<{ id: string; name: string }> = []

    for (const entity of cachedEntities || []) {
      const properties = entity?.properties || {}
      const labels = Array.isArray(entity?.labels) ? entity.labels : []
      const entityType = String(properties.type || labels[0] || '').toLowerCase()
      const isClub = labels.includes('Club') || entityType.includes('club')
      if (!isClub) continue

      const clubName = String(properties.name || entity?.id || 'Unknown Club')
      const leagueRaw = properties.league || properties.league_name || properties.division || ''
      const league = String(leagueRaw).trim()

      if (!league) {
        clubsMissingLeague.push({ id: String(entity?.id || ''), name: clubName })
        continue
      }

      leagueClubCountsActual[league] = (leagueClubCountsActual[league] || 0) + 1
    }

    const leagueClubCountsExpected: CountMap = {}
    let expectedSource = 'teams_table'

    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select('league_name, league_id, name')
      .limit(50000)

    if (!teamsError && teams) {
      for (const team of teams) {
        const leagueName = String(team.league_name || team.league_id || '').trim()
        if (!leagueName) continue
        leagueClubCountsExpected[leagueName] = (leagueClubCountsExpected[leagueName] || 0) + 1
      }
    } else {
      expectedSource = 'cached_entities_heuristic'
      for (const [leagueName, count] of Object.entries(leagueClubCountsActual)) {
        leagueClubCountsExpected[leagueName] = Math.max(count, 0)
      }
    }

    const allLeagues = new Set([
      ...Object.keys(leagueClubCountsExpected),
      ...Object.keys(leagueClubCountsActual)
    ])

    const discrepancies = Array.from(allLeagues).map((leagueName) => {
      const expected = leagueClubCountsExpected[leagueName] || 0
      const actual = leagueClubCountsActual[leagueName] || 0
      const missing = Math.max(expected - actual, 0)
      return {
        league: leagueName,
        expected_count: expected,
        actual_count: actual,
        missing_count: missing,
        status: missing > 0 ? 'incomplete' : 'complete'
      }
    })
      .filter((entry) => entry.expected_count > 0 || entry.actual_count > 0)
      .sort((a, b) => b.missing_count - a.missing_count || a.league.localeCompare(b.league))

    const summary = {
      leagues_total: discrepancies.length,
      leagues_incomplete: discrepancies.filter((d) => d.status === 'incomplete').length,
      clubs_missing_league_count: clubsMissingLeague.length,
      expected_source: expectedSource
    }

    return NextResponse.json({
      summary,
      discrepancies,
      clubs_missing_league: clubsMissingLeague.slice(0, 100),
      generated_at: new Date().toISOString()
    })
  } catch (error) {
    console.error('❌ Failed to generate league completeness diagnostics:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to generate diagnostics',
        summary: {
          leagues_total: 0,
          leagues_incomplete: 0,
          clubs_missing_league_count: 0,
          expected_source: 'unavailable'
        },
        discrepancies: [],
        clubs_missing_league: []
      },
      { status: 500 }
    )
  }
}
