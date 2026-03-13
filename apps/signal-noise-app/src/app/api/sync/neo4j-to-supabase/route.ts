import { NextResponse } from 'next/server';
import { RealtimeSyncService } from '@/services/RealtimeSyncService';
import { runPostImportCanonicalMaintenance } from '@/lib/post-import-canonical-maintenance'

export async function POST() {
  try {
    console.log('🚀 Triggering Neo4j to Supabase full sync...');
    
    const syncService = new RealtimeSyncService();
    await syncService.initialize();
    
    const result = await syncService.performFullSync();
    
    const canonicalMaintenance = result.success
      ? await runPostImportCanonicalMaintenance('sync-neo4j-to-supabase')
      : null

    return NextResponse.json({
      success: result.success,
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
