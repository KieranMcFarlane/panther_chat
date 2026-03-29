import { NextRequest, NextResponse } from 'next/server';

import { readDiscoveryPipelineSnapshot } from '@/lib/discovery-lanes/lane-status';

export async function GET(request: NextRequest) {
  const outputDir = request.nextUrl.searchParams.get('outputDir') ?? undefined;
  const snapshot = await readDiscoveryPipelineSnapshot({ outputDir });

  return NextResponse.json({
    success: true,
    data: snapshot,
  });
}
