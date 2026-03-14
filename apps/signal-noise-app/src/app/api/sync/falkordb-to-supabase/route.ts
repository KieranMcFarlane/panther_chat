import { NextResponse } from 'next/server';
import { RealtimeSyncService } from '@/services/RealtimeSyncService';
import { randomUUID } from 'node:crypto'

type PostSyncReconciliationResult = {
  attempted: boolean
  ok: boolean
  status?: number
  payload?: unknown
  error?: string
}

async function runPostSyncEntityReconciliation(): Promise<PostSyncReconciliationResult> {
  const baseUrl =
    process.env.INTERNAL_APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    'http://localhost:3005'

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10 * 60 * 1000)

  try {
    const response = await fetch(`${baseUrl}/api/admin/entity-reconciliation/remediate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        strategy: 'semantic_merge',
        dry_run: false,
        limit: 5000,
      }),
      signal: controller.signal,
      cache: 'no-store',
    })
    const payload = await response.json().catch(() => ({}))
    return {
      attempted: true,
      ok: response.ok && Boolean(payload?.success ?? true),
      status: response.status,
      payload,
    }
  } catch (error) {
    return {
      attempted: true,
      ok: false,
      error: error instanceof Error ? error.message : 'post-sync reconciliation failed',
    }
  } finally {
    clearTimeout(timeout)
  }
}

export async function POST() {
  try {
    console.log('🚀 Triggering FalkorDB to Supabase full sync...');

    const syncService = new RealtimeSyncService();
    await syncService.initialize();

    const result = await syncService.performFullSync();

    const syncRunId = randomUUID()
    const canonicalMaintenance = null

    const postSyncReconciliation = result.success
      ? await runPostSyncEntityReconciliation()
      : { attempted: false, ok: false } satisfies PostSyncReconciliationResult
    return NextResponse.json({
      success: result.success,
      syncRunId,
      message: result.success ? 'Sync completed successfully' : 'Sync failed',
      data: {
        entitiesProcessed: result.entitiesProcessed,
        entitiesAdded: result.entitiesAdded,
        entitiesUpdated: result.entitiesUpdated,
        entitiesRemoved: result.entitiesRemoved,
        duration: result.duration,
        durationFormatted: `${Math.round(result.duration / 1000)}s`
      },
      error: result.error,
      canonicalMaintenance,
      postSyncReconciliation,
    });

  } catch (error) {
    console.error('❌ Sync API error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}

export async function GET() {
  try {
    const syncService = new RealtimeSyncService();
    const status = await syncService.getSyncStatus();

    return NextResponse.json({
      success: true,
      status
    });

  } catch (error) {
    console.error('❌ Sync status error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
