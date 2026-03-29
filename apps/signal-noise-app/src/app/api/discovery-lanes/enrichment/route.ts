import { NextRequest, NextResponse } from 'next/server';

import { readLaneSnapshot, writeLaneRequestFile } from '@/lib/discovery-lanes/lane-status';

export async function GET(request: NextRequest) {
  const outputDir = request.nextUrl.searchParams.get('outputDir') ?? undefined;
  const snapshot = await readLaneSnapshot({ lane: 'enrichment', outputDir });

  return NextResponse.json({
    success: true,
    data: snapshot,
  });
}

export async function POST(request: NextRequest) {
  const outputDir = request.nextUrl.searchParams.get('outputDir') ?? undefined;
  const payload = await request.json().catch(() => ({}));
  const queued = await writeLaneRequestFile({
    lane: 'enrichment',
    outputDir,
    payload,
  });

  return NextResponse.json({
    success: true,
    data: {
      status: 'queued',
      request: queued,
    },
  });
}
