import { NextRequest, NextResponse } from 'next/server'

import { readPipelineControlState, writePipelineControlState } from '@/lib/pipeline-control-state'

export const dynamic = 'force-dynamic'

export async function GET() {
  const control = await readPipelineControlState()
  return NextResponse.json({ control })
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  // pipeline control transition record
  const action = typeof body?.action === 'string' ? body.action.trim().toLowerCase() : null
  const requestedState = action === 'stop' || body?.is_paused === true || body?.requested_state === 'paused'
    ? 'paused'
    : 'running'
  const transitionState = requestedState === 'paused' ? 'stopping' : 'starting'
  const control = await writePipelineControlState({
    is_paused: requestedState === 'paused',
    pause_reason: requestedState === 'paused' && typeof body?.pause_reason === 'string' ? body.pause_reason : null,
    desired_state: requestedState,
    requested_state: requestedState,
    observed_state: transitionState,
    transition_state: transitionState,
  })

  return NextResponse.json({ control })
}
