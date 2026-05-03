import { NextRequest, NextResponse } from 'next/server'

import { readPipelineControlState, writePipelineControlState } from '@/lib/pipeline-control-state'
import {
  readPipelineWorkerSupervisorState,
  startPipelineWorker,
} from '@/lib/pipeline-worker-supervisor'
import { requireApiSession, UnauthorizedError } from '@/lib/server-auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    await requireApiSession(request)
    const control = await readPipelineControlState()
    const worker = await readPipelineWorkerSupervisorState()
    return NextResponse.json({
      control,
      worker,
      worker_process_state: worker.worker_process_state,
      worker_pid: worker.worker_pid,
    })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to read pipeline control state' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireApiSession(request)
    await request.json().catch(() => ({}))
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
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update pipeline control state' },
      { status: 500 },
    )
  }
}
