import { NextRequest, NextResponse } from 'next/server';

import { readLaneSnapshot, writeLaneRequestFile, buildDefaultScoutRequest } from '@/lib/discovery-lanes/lane-status';

export async function GET(request: NextRequest) {
  const outputDir = request.nextUrl.searchParams.get('outputDir') ?? undefined;
  const snapshot = await readLaneSnapshot({ lane: 'scout', outputDir });

  return NextResponse.json({
    success: true,
    data: snapshot,
  });
}

export async function POST(request: NextRequest) {
  const outputDir = request.nextUrl.searchParams.get('outputDir') ?? undefined;
  const payload = await request.json().catch(() => ({}));
  const artifact = buildDefaultScoutRequest(payload);
  const queued = await writeLaneRequestFile({
    lane: 'scout',
    outputDir,
    payload: {
      objective: payload.objective ?? artifact.objective.objective,
      seed_query: payload.seed_query ?? artifact.objective.seed_query,
      source_priority: payload.source_priority ?? artifact.objective.source_priority,
    },
  });

  return NextResponse.json({
    success: true,
    data: {
      status: 'queued',
      request: queued,
      preview: artifact,
    },
  });
}
