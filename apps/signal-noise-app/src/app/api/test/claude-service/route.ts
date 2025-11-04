import { NextRequest, NextResponse } from 'next/server';
import { intelligentEntityEnrichmentService } from '@/services/IntelligentEntityEnrichmentService';

export async function GET(request: NextRequest) {
  try {
    // Test if service methods exist
    const methods = {
      hasIsEnrichmentRunning: typeof intelligentEntityEnrichmentService.isEnrichmentRunning === 'function',
      hasGetCurrentBatch: typeof intelligentEntityEnrichmentService.getCurrentBatch === 'function',
      hasStartIntelligentEnrichment: typeof intelligentEntityEnrichmentService.startIntelligentEnrichment === 'function',
      currentBatch: intelligentEntityEnrichmentService.getCurrentBatch(),
      isRunning: intelligentEntityEnrichmentService.isEnrichmentRunning()
    };

    return NextResponse.json({
      success: true,
      data: methods,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}