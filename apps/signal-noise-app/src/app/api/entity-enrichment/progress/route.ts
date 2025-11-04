import { NextRequest, NextResponse } from 'next/server';
import { entityDossierEnrichmentService } from '@/services/EntityDossierEnrichmentService';

/**
 * Get detailed progress of current entity enrichment batch
 */
export async function GET(request: NextRequest) {
  try {
    const currentBatch = entityDossierEnrichmentService.getCurrentBatch();
    const isRunning = entityDossierEnrichmentService.isEnrichmentRunning();

    // Calculate additional statistics
    let successRate = 0;
    let averageTimePerEntity = 0;
    let recentResults = [];

    if (currentBatch && currentBatch.results.length > 0) {
      successRate = Math.round((currentBatch.successfulEnrichments / currentBatch.processedEntities) * 100);
      
      const totalTime = currentBatch.results.reduce((sum, result) => sum + result.duration, 0);
      averageTimePerEntity = Math.round(totalTime / currentBatch.results.length);

      // Get last 5 results
      recentResults = currentBatch.results.slice(-5).map(result => ({
        entityName: result.entityName,
        success: result.success,
        duration: Math.round(result.duration / 1000),
        error: result.error
      }));
    }

    return NextResponse.json({
      success: true,
      data: {
        isRunning,
        batch: currentBatch,
        statistics: {
          successRate,
          averageTimePerEntity: Math.round(averageTimePerEntity / 1000), // seconds
          totalProcessed: currentBatch?.processedEntities || 0,
          totalSuccessful: currentBatch?.successfulEnrichments || 0,
          totalFailed: currentBatch?.failedEnrichments || 0
        },
        recentResults,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Failed to get enrichment progress:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}