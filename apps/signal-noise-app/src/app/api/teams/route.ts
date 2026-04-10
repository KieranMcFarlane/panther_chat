import { NextRequest, NextResponse } from 'next/server'

import { getSportsDirectorySnapshot } from '@/lib/sports-directory'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const leagueId = searchParams.get('leagueId')?.trim()
    const sport = searchParams.get('sport')?.trim()
    const country = searchParams.get('country')?.trim()
    const limit = Number.parseInt(searchParams.get('limit') || '50', 10)
    const offset = Number.parseInt(searchParams.get('offset') || '0', 10)
    const letter = searchParams.get('letter')
    const search = searchParams.get('search')?.trim().toLowerCase()

    const { teams } = await getSportsDirectorySnapshot()
    const filteredTeams = teams.filter((team) => {
      if (leagueId && team.league_id !== leagueId) return false
      if (sport && team.sport !== sport) return false
      if (country && team.country !== country) return false
      if (letter && letter !== 'all' && team.name.charAt(0).toUpperCase() !== letter.toUpperCase()) return false
      if (search && !team.name.toLowerCase().includes(search)) return false
      return true
    })

    const total = filteredTeams.length
    const paginatedTeams = filteredTeams.slice(offset, offset + limit)

    return NextResponse.json({
      teams: paginatedTeams,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
        currentPage: Math.floor(offset / limit) + 1,
        totalPages: Math.ceil(total / limit),
      },
    }, {
      headers: createCacheHeaders(),
    })
  } catch (error) {
    console.error('Error fetching teams:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch teams' },
      { status: 500 }
    )
  }
}

function createCacheHeaders(maxAge = 300, staleWhileRevalidate = 600) {
  return new Headers({
    'Cache-Control': `public, s-maxage=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`,
    'Content-Type': 'application/json',
  })
}
