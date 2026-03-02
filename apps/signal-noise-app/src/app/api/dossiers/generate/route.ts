/**
 * Proxy to Python Backend Dossier Generation
 *
 * This endpoint proxies dossier generation requests to the Python backend
 * which has real leadership data collection capabilities.
 */

import { NextRequest, NextResponse } from 'next/server';

const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL || 'http://localhost:8000';
const DOSSIER_PROXY_TIMEOUT_MS = Number(process.env.DOSSIER_PROXY_TIMEOUT_MS || 15000);

interface GenerateDossierRequest {
  entity_id: string;
  entity_name: string;
  priority_score?: number;
  tier?: 'BASIC' | 'STANDARD' | 'PREMIUM';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as GenerateDossierRequest;

    console.log(`📋 Proxying dossier generation to Python backend for: ${body.entity_id}`);

    // Forward request to Python backend
    const pythonResponse = await fetch(`${PYTHON_BACKEND_URL}/api/dossiers/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(DOSSIER_PROXY_TIMEOUT_MS),
    });

    if (!pythonResponse.ok) {
      const errorText = await pythonResponse.text();
      console.error(`❌ Python backend error: ${pythonResponse.status} ${errorText}`);
      return NextResponse.json(
        {
          error: 'Python backend error',
          status: pythonResponse.status,
          message: errorText
        },
        { status: pythonResponse.status }
      );
    }

    const data = await pythonResponse.json();
    console.log(`✅ Successfully generated dossier for: ${body.entity_id}`);

    return NextResponse.json(data);

  } catch (error) {
    console.error('Error proxying dossier generation:', error);

    if (
      error instanceof Error &&
      (
        error.name === 'TimeoutError' ||
        error.name === 'AbortError' ||
        /timeout/i.test(error.message)
      )
    ) {
      return NextResponse.json(
        {
          error: 'Python backend timeout',
          message: `Dossier generation did not respond within ${DOSSIER_PROXY_TIMEOUT_MS}ms`
        },
        { status: 504 }
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to generate dossier',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
