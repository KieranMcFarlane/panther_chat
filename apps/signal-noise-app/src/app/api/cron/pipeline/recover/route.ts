import { NextRequest, NextResponse } from 'next/server'

import { requireCronSecret } from '@/lib/cron-auth'
import { readPipelineControlState } from '@/lib/pipeline-control-state'
import { maybeAutoRecoverPipelineWorker } from '@/lib/pipeline-worker-auto-recovery'
import { readPipelineWorkerSupervisorState } from '@/lib/pipeline-worker-supervisor'
import { UnauthorizedError } from '@/lib/server-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function handlePipelineWorkerRecovery(request: NextRequest) {
  try {
    requireCronSecret(request)
    const control = await readPipelineControlState()
    const worker = await readPipelineWorkerSupervisorState()
    const workerAutoRecovery = await maybeAutoRecoverPipelineWorker({ control, worker })

    return NextResponse.json({
      ok: true,
      worker_auto_recovery: workerAutoRecovery,
      recovered: workerAutoRecovery.recovered,
      reason: workerAutoRecovery.reason,
      worker_process_state: workerAutoRecovery.worker?.worker_process_state ?? worker.worker_process_state,
      worker_pid: workerAutoRecovery.worker?.worker_pid ?? worker.worker_pid,
      last_updated_at: new Date().toISOString(),
    })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to recover pipeline worker' },
      { status: 500 },
    )
  }
}

export async function GET(request: NextRequest) {
  return handlePipelineWorkerRecovery(request)
}

export async function POST(request: NextRequest) {
  return handlePipelineWorkerRecovery(request)
}
