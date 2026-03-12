import { NextRequest, NextResponse } from 'next/server';

export async function POST(_request: NextRequest) {
  return NextResponse.json(
    {
      status: 'retired',
      error: 'The legacy direct RFP execution route has been retired.',
      replacement: 'Use /api/run-agent or the newer RFP monitoring flows.',
      suggested_endpoints: [
        '/api/run-agent',
        '/api/rfp-monitoring',
        '/api/rfp-scan-control',
      ],
    },
    { status: 410 },
  );
}
