import { NextResponse } from 'next/server'

import { loadPipelineRuntimeSnapshot } from '@/lib/pipeline-runtime'

export const dynamic = 'force-dynamic'

export async function GET() {
  const runtime = await loadPipelineRuntimeSnapshot()
  return NextResponse.json({
    ...runtime,
    worker_process_state: runtime.worker.worker_process_state,
    worker_pid: runtime.worker.worker_pid,
    fastmcp_health: runtime.fastmcp.reachable ? 'reachable' : 'unreachable',
    current_run: runtime.current_run,
    recent_failures: runtime.recent_failures,
  })
}

