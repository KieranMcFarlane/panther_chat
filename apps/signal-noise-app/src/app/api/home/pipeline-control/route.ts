import { NextRequest, NextResponse } from 'next/server'

import { readPipelineControlState, writePipelineControlState } from '@/lib/pipeline-control-state'
import {
  readPipelineWorkerSupervisorState,
  startPipelineWorker,
  stopPipelineWorker,
} from '@/lib/pipeline-worker-supervisor'

export const dynamic = 'force-dynamic'

export async function GET() {
  const control = await readPipelineControlState()
  const worker = await readPipelineWorkerSupervisorState()
  return NextResponse.json({
    control,
    worker,
    worker_process_state: worker.worker_process_state,
    worker_pid: worker.worker_pid,
  })
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  // pipeline control transition record
  const action = typeof body?.action === 'string' ? body.action.trim().toLowerCase() : null
  const requestedState = action === 'stop' || body?.is_paused === true || body?.requested_state === 'paused'
    ? 'paused'
    : 'running'

  if (requestedState === 'running') {
    const worker = await startPipelineWorker()
    const control = await writePipelineControlState({
      is_paused: false,
      pause_reason: null,
      stop_reason: null,
      stop_details: null,
      desired_state: 'running',
      requested_state: 'running',
      observed_state: 'starting',
      transition_state: 'starting',
    })
    return NextResponse.json({
      control,
      worker,
      worker_process_state: worker.worker_process_state,
      worker_pid: worker.worker_pid,
    })
  }

  await writePipelineControlState({
    is_paused: true,
    pause_reason: typeof body?.pause_reason === 'string' ? body.pause_reason : null,
    stop_reason: typeof body?.stop_reason === 'string' ? body.stop_reason : 'manual_stop',
    stop_details: body?.stop_details && typeof body.stop_details === 'object'
      ? body.stop_details
      : null,
    desired_state: 'paused',
    requested_state: 'paused',
    observed_state: 'stopping',
    transition_state: 'stopping',
  })
  const worker = await stopPipelineWorker(typeof body?.stop_reason === 'string' ? body.stop_reason : 'manual_stop')
  const control = await writePipelineControlState({
    is_paused: true,
    pause_reason: typeof body?.pause_reason === 'string' ? body.pause_reason : null,
    stop_reason: typeof body?.stop_reason === 'string' ? body.stop_reason : 'manual_stop',
    stop_details: body?.stop_details && typeof body.stop_details === 'object'
      ? body.stop_details
      : null,
    desired_state: 'paused',
    requested_state: 'paused',
    observed_state: 'paused',
    transition_state: 'paused',
  })

  return NextResponse.json({
    control,
    worker,
    worker_process_state: worker.worker_process_state,
    worker_pid: worker.worker_pid,
  })
}
