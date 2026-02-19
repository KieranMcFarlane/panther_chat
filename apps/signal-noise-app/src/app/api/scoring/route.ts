/**
 * Hypothesis Scoring API Routes
 *
 * Proxy to backend FastAPI scoring service (port 8002)
 *
 * Part of Temporal Sports Procurement Prediction Engine MVP.
 */

import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8002';

/**
 * GET /api/scoring/[entityId]
 *
 * Get all hypothesis states for an entity
 *
 * Example: GET /api/scoring/arsenal-fc
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { entityId: string } }
) {
  try {
    const { entityId } = params;
    const url = new URL(request.url);
    const category = url.searchParams.get('category');

    // Build backend URL
    let backendUrl = `${BACKEND_URL}/scoring/${encodeURIComponent(entityId)}`;

    // Add category if specified
    if (category) {
      backendUrl += `/category/${encodeURIComponent(category)}`;
    }

    // Proxy to backend
    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Backend request failed', status: response.status },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Scoring API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/scoring/[entityId]/recalculate
 *
 * Force recalculation of hypothesis states
 *
 * Example: POST /api/scoring/arsenal-fc/recalculate
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { entityId: string } }
) {
  try {
    const { entityId } = params;
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Check if this is a recalculate request
    if (pathname.endsWith('/recalculate')) {
      const backendUrl = `${BACKEND_URL}/scoring/${encodeURIComponent(entityId)}/recalculate`;

      const response = await fetch(backendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        return NextResponse.json(
          { error: 'Backend request failed', status: response.status },
          { status: response.status }
        );
      }

      const data = await response.json();
      return NextResponse.json(data);
    }

    return NextResponse.json(
      { error: 'Unknown POST endpoint' },
      { status: 404 }
    );
  } catch (error) {
    console.error('Scoring API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
