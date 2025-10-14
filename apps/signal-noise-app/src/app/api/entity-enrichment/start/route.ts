import { NextRequest, NextResponse } from 'next/server';
import { entityDossierEnrichmentService } from '@/services/EntityDossierEnrichmentService';

/**
 * Start systematic entity dossier enrichment
 */
export async function POST(request: NextRequest) {
  try {
    // Configure from environment if not already configured
    try {
      entityDossierEnrichmentService.configureFromEnvironment();
    } catch (error) {
      // Service might already be configured
    }

    // Check if enrichment is already running
    if (entityDossierEnrichmentService.isEnrichmentRunning()) {
      return NextResponse.json({
        success: false,
        error: 'Entity enrichment is already running',
        data: entityDossierEnrichmentService.getCurrentBatch()
      }, { status: 409 });
    }

    // Start systematic enrichment
    const batchProgress = await entityDossierEnrichmentService.startSystematicEnrichment();

    return NextResponse.json({
      success: true,
      message: 'Entity dossier enrichment started',
      data: batchProgress
    });

  } catch (error) {
    console.error('❌ Failed to start entity enrichment:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      details: {
        timestamp: new Date().toISOString()
      }
    }, { status: 500 });
  }
}

/**
 * Get current enrichment status
 */
export async function GET(request: NextRequest) {
  try {
    const currentBatch = entityDossierEnrichmentService.getCurrentBatch();
    const isRunning = entityDossierEnrichmentService.isEnrichmentRunning();

    return NextResponse.json({
      success: true,
      data: {
        isRunning,
        currentBatch,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Failed to get enrichment status:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}