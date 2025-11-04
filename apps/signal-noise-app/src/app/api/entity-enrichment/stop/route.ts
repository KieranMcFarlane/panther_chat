import { NextRequest, NextResponse } from 'next/server';
import { entityDossierEnrichmentService } from '@/services/EntityDossierEnrichmentService';

/**
 * Cancel entity enrichment batch
 */
export async function POST(request: NextRequest) {
  try {
    // Check if enrichment is running
    if (!entityDossierEnrichmentService.isEnrichmentRunning()) {
      return NextResponse.json({
        success: false,
        error: 'No entity enrichment is currently running'
      }, { status: 400 });
    }

    // Get current batch before cancelling
    const currentBatch = entityDossierEnrichmentService.getCurrentBatch();

    // Cancel enrichment
    entityDossierEnrichmentService.cancelEnrichment();

    return NextResponse.json({
      success: true,
      message: 'Entity enrichment cancelled successfully',
      data: {
        cancelledAt: new Date().toISOString(),
        lastBatch: currentBatch
      }
    });

  } catch (error) {
    console.error('❌ Failed to cancel entity enrichment:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}