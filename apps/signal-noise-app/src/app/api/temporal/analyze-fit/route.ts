/**
 * Temporal API: Analyze Fit Route
 *
 * Proxies temporal fit analysis requests to the FastAPI backend.
 * Analyzes entity-RFP fit based on historical temporal patterns.
 */

import { NextRequest, NextResponse } from 'next/server'

const FASTAPI_URL =
  process.env.FASTAPI_URL ||
  process.env.NEXT_PUBLIC_FASTAPI_URL ||
  'http://localhost:8000'

/**
 * POST /api/temporal/analyze-fit
 *
 * Analyze the fit between an entity and an RFP based on temporal patterns.
 *
 * Request body:
 * {
 *   "entity_id": string,
 *   "rfp_id": string,
 *   "rfp_category": string (optional),
 *   "rfp_value": number (optional),
 *   "time_horizon": number (optional, default: 90, days to look back)
 * }
 *
 * Returns:
 * {
 *   "entity_id": string,
 *   "rfp_id": string,
 *   "fit_score": number (0-1),
 *   "confidence": number (0-1),
 *   "trend_analysis": {
 *     "rfp_count_last_90_days": number,
 *     "time_horizon_days": number,
 *     "trend": "increasing" | "stable" | "decreasing"
 *   },
 *   "key_factors": [
 *     {
 *       "factor": string,
 *       "value": any,
 *       "impact": "positive" | "neutral" | "negative"
 *     }
 *   ],
 *   "recommendations": string[],
 *   "analyzed_at": string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate required fields
    if (!body.entity_id) {
      return NextResponse.json(
        { error: 'Missing required field: entity_id' },
        { status: 400 }
      )
    }

    if (!body.rfp_id) {
      return NextResponse.json(
        { error: 'Missing required field: rfp_id' },
        { status: 400 }
      )
    }

    // Proxy to FastAPI backend
    const response = await fetch(`${FASTAPI_URL}/api/temporal/analyze-fit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        entity_id: body.entity_id,
        rfp_id: body.rfp_id,
        rfp_category: body.rfp_category,
        rfp_value: body.rfp_value,
        time_horizon: body.time_horizon || 90,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return NextResponse.json(
        {
          error: errorData.error || 'Failed to analyze fit',
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
    console.error('Error in analyze fit API:', error)
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
 * GET /api/temporal/analyze-fit
 *
 * Get information about the analyze-fit endpoint.
 */
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/temporal/analyze-fit',
    method: 'POST',
    description: 'Analyze RFP fit based on temporal patterns',
    backend: FASTAPI_URL,
    fields: {
      entity_id: { type: 'string', required: true, description: 'Entity to analyze' },
      rfp_id: { type: 'string', required: true, description: 'RFP identifier' },
      rfp_category: {
        type: 'string',
        required: false,
        description: 'RFP category for matching',
      },
      rfp_value: {
        type: 'number',
        required: false,
        description: 'RFP estimated value',
      },
      time_horizon: {
        type: 'number',
        required: false,
        default: 90,
        min: 1,
        max: 365,
        description: 'Days to look back for analysis',
      },
    },
  })
}
