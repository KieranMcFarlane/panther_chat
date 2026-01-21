/**
 * Temporal API: Entity Timeline Route
 *
 * Proxies entity timeline requests to the FastAPI backend.
 * Returns temporal history of an entity including RFPs, partnerships, etc.
 */

import { NextRequest, NextResponse } from 'next/server'

const FASTAPI_URL =
  process.env.FASTAPI_URL ||
  process.env.NEXT_PUBLIC_FASTAPI_URL ||
  'http://localhost:8000'

/**
 * GET /api/temporal/entity/[entityId]/timeline
 *
 * Get the temporal timeline for a specific entity.
 *
 * Query parameters:
 * - limit: number of events to return (default: 50)
 *
 * Returns:
 * {
 *   "entity_id": string,
 *   "event_count": number,
 *   "events": [
 *     {
 *       "timestamp": string,
 *       "event_type": string,
 *       "description": string,
 *       "source": string,
 *       "metadata": object
 *     }
 *   ],
 *   "timestamp": string
 * }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { entityId: string } }
) {
  try {
    const entityId = decodeURIComponent(params.entityId)

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    // Proxy to FastAPI backend
    const response = await fetch(
      `${FASTAPI_URL}/api/temporal/entity/${encodeURIComponent(entityId)}/timeline?limit=${limit}`,
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
          error: errorData.error || 'Failed to get entity timeline',
          entityId,
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
    console.error('Error in entity timeline API:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
