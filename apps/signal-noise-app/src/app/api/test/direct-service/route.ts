import { NextRequest, NextResponse } from 'next/server';

// Simple direct test
const service = require('@/services/IntelligentEntityEnrichmentService');

export async function GET(request: NextRequest) {
  try {
    const result = {
      serviceLoaded: !!service.intelligentEntityEnrichmentService,
      hasMethod: typeof service.intelligentEntityEnrichmentService?.isEnrichmentRunning === 'function',
      methods: Object.getOwnPropertyNames(Object.getPrototypeOf(service.intelligentEntityEnrichmentService))
    };

    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}