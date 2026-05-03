import { NextResponse } from 'next/server'

import { loadPipelineRuntimeSnapshot } from '@/lib/pipeline-runtime'

export const dynamic = 'force-dynamic'

export async function GET() {
  const runtime = await loadPipelineRuntimeSnapshot()
  return NextResponse.json({
    ...runtime,
    state: runtime.state,
    health_class: runtime.health_class,
    last_self_heal_action: runtime.last_self_heal_action,
    last_self_heal_reason: runtime.last_self_heal_reason,
    last_self_heal_at: runtime.last_self_heal_at,
    worker_process_state: runtime.worker.worker_process_state,
    worker_pid: runtime.worker.worker_pid,
    fastmcp_health: runtime.fastmcp.reachable ? 'reachable' : 'unreachable',
    execution_backend: runtime.current_live_run?.execution_backend ?? runtime.current_run?.execution_backend ?? null,
    execution_model: runtime.current_live_run?.execution_model ?? runtime.current_run?.execution_model ?? null,
    execution_provider: runtime.current_live_run?.execution_provider ?? runtime.current_run?.execution_provider ?? null,
    brightdata_transport: runtime.current_live_run?.brightdata_transport ?? runtime.current_run?.brightdata_transport ?? null,
    current_run: runtime.current_run,
    current_live_run: runtime.current_live_run,
    latest_noteworthy_run: runtime.latest_noteworthy_run,
    recent_failures: runtime.recent_failures,
  })
}
