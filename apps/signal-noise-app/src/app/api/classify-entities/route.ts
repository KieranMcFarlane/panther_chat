import { NextResponse } from 'next/server'

/**
 * DEPRECATED: Entity classification is now handled by the canonical_entities normalization pipeline.
 * This route is kept as a no-op to avoid breaking any callers.
 */

export async function POST() {
  return NextResponse.json({
    success: true,
    message: 'Deprecated: entity classification is now handled by canonical_entities normalization',
    deprecated: true,
    timestamp: new Date().toISOString(),
  })
}

export async function GET() {
  return NextResponse.json({
    message: 'Deprecated: entity classification is now handled by canonical_entities normalization',
    deprecated: true,
    timestamp: new Date().toISOString(),
  })
}
