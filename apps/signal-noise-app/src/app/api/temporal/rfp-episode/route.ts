/**
 * Temporal API: RFP Episode Route
 *
 * Proxies RFP episode creation requests to the FastAPI backend.
 * This enables tracking RFPs as temporal episodes in the knowledge graph.
 */

import { NextRequest, NextResponse } from 'next/server'

// FastAPI backend URL (configurable via environment)
const FASTAPI_URL =
  process.env.FASTAPI_URL ||
  process.env.NEXT_PUBLIC_FASTAPI_URL ||
  'http://localhost:8000'

/**
 * POST /api/temporal/rfp-episode
 *
 * Create a new RFP episode in the temporal knowledge graph.
 *
 * Request body:
 * {
 *   "rfp_id": string,
 *   "organization": string,
 *   "entity_type": string (optional, default "Entity"),
 *   "detected_at": string (ISO timestamp),
 *   "title": string (optional),
 *   "description": string (optional),
 *   "source": string (optional),
 *   "url": string (optional),
 *   "estimated_value": number (optional),
 *   "category": string (optional),
 *   "confidence_score": number (optional),
 *   "metadata": object (optional)
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate required fields
    if (!body.rfp_id) {
      return NextResponse.json(
        { error: 'Missing required field: rfp_id' },
        { status: 400 }
      )
    }

    if (!body.organization) {
      return NextResponse.json(
        { error: 'Missing required field: organization' },
        { status: 400 }
      )
    }

    // Proxy to FastAPI backend
    const response = await fetch(`${FASTAPI_URL}/api/temporal/rfp-episode`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return NextResponse.json(
        {
          error: errorData.error || 'Failed to create RFP episode',
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
    console.error('Error in RFP episode API:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/temporal/rfp-episode
 *
 * Get information about the RFP episode endpoint.
 */
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/temporal/rfp-episode',
    method: 'POST',
    description: 'Create a new RFP episode in the temporal knowledge graph',
    backend: FASTAPI_URL,
    fields: {
      rfp_id: { type: 'string', required: true, description: 'Unique RFP identifier' },
      organization: { type: 'string', required: true, description: 'Organization name' },
      entity_type: { type: 'string', required: false, default: 'Entity' },
      detected_at: { type: 'string', required: false, description: 'ISO timestamp' },
      title: { type: 'string', required: false },
      description: { type: 'string', required: false },
      source: { type: 'string', required: false },
      url: { type: 'string', required: false },
      estimated_value: { type: 'number', required: false },
      category: { type: 'string', required: false },
      confidence_score: { type: 'number', required: false, min: 0, max: 1 },
      metadata: { type: 'object', required: false },
    },
  })
}
