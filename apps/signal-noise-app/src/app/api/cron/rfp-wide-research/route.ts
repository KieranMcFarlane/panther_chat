import { NextRequest, NextResponse } from 'next/server'

const DISABLED_REASON = 'RFP wide research automation is webhook-only. Configure Manus Scheduled to call /api/rfp-wide-research/manus-webhook when a run completes.'

export async function GET(request: NextRequest) {
  return NextResponse.json({
    ok: true,
    disabled: true,
    reason: DISABLED_REASON,
    webhook_path: '/api/rfp-wide-research/manus-webhook',
  })
}

export async function POST(request: NextRequest) {
  return GET(request)
}
