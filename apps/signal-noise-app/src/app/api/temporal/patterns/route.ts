/**
 * Temporal API: Patterns Route
 *
 * Proxies temporal patterns requests to the FastAPI backend.
 * Returns aggregate temporal patterns across all entities.
 */

import { NextRequest, NextResponse } from 'next/server'

const FASTAPI_URL =
  process.env.FASTAPI_URL ||
  process.env.NEXT_PUBLIC_FASTAPI_URL ||
  'http://localhost:8000'

/**
 * GET /api/temporal/patterns
 *
 * Get aggregate temporal patterns across all entities.
 *
 * Query parameters:
 * - entity_type: Filter by entity type (optional)
 * - time_horizon: Days to look back (default: 365)
 *
 * Returns:
 * {
 *   "time_horizon_days": number,
 *   "episode_types": { [type: string]: count },
 *   "top_entities": [
 *     { "name": string, "count": number }
 *   ],
 *   "total_episodes": number
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const { searchParams } = new URL(request.url)
    const entityType = searchParams.get('entity_type')
    const timeHorizon = parseInt(searchParams.get('time_horizon') || '365', 10)

    // Build query string
    const queryParams = new URLSearchParams({
      time_horizon: timeHorizon.toString(),
    })
    if (entityType) {
      queryParams.set('entity_type', entityType)
    }

    // Proxy to FastAPI backend
    const response = await fetch(
      `${FASTAPI_URL}/api/temporal/patterns?${queryParams.toString()}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return NextResponse.json(
        {
          error: errorData.error || 'Failed to get patterns',
          backend: FASTAPI_URL,
        },
        { status: response.status }
      )
    }

    const data = await response.json()

    return NextResponse.json({
      ...data,
      _proxy: {
        backend: FASTAPI_URL,
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('Error in patterns API:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
