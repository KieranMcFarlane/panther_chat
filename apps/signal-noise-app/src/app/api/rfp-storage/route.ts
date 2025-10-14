import { NextRequest, NextResponse } from 'next/server';
import { getRFPStorageService } from '@/services/RFPStorageService';
import { Neo4jService } from '@/lib/neo4j';

interface RFPDetectionRequest {
  rfpData: {
    rfpId: string;
    entityName: string;
    entityType: string;
    title: string;
    description: string;
    estimatedValue: string;
    submissionDeadline: string;
    keywords: string[];
    priorityLevel: string;
    confidenceScore: number;
    yellowPantherFit: number;
    competitiveAdvantage: string;
    recommendedActions: string[];
    detectedAt: string;
  }[];
}

export async function POST(request: NextRequest) {
  try {
    const body: RFPDetectionRequest = await request.json();
    const { rfpData } = body;

    if (!rfpData || !Array.isArray(rfpData)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid request body. Expected rfpData array.'
      }, { status: 400 });
    }

    // Initialize Neo4j service
    const neo4j = new Neo4jService();
    await neo4j.initialize();

    // Get RFP storage service
    const rfpStorage = getRFPStorageService(neo4j);

    // Store RFPs in Neo4j
    const results = await rfpStorage.storeMultipleRFPs(rfpData);

    // Generate summary
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    return NextResponse.json({
      success: true,
      summary: {
        totalProcessed: results.length,
        successful,
        failed,
        successRate: Math.round((successful / results.length) * 100)
      },
      results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in RFP storage API:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    // Initialize Neo4j service
    const neo4j = new Neo4jService();
    await neo4j.initialize();

    const rfpStorage = getRFPStorageService(neo4j);

    switch (action) {
      case 'active':
        // Get all active RFPs
        const activeRFPs = await rfpStorage.getActiveRFPs();
        return NextResponse.json({
          success: true,
          data: activeRFPs,
          count: activeRFPs.length,
          timestamp: new Date().toISOString()
        });

      case 'analytics':
        // Get RFP analytics
        const analytics = await rfpStorage.getRFPAnalytics();
        return NextResponse.json({
          success: true,
          data: analytics,
          timestamp: new Date().toISOString()
        });

      case 'actions':
        // Get recommended actions for a specific RFP
        const rfpId = searchParams.get('rfpId');
        if (!rfpId) {
          return NextResponse.json({
            success: false,
            error: 'rfpId parameter is required for actions endpoint'
          }, { status: 400 });
        }

        const actions = await rfpStorage.getRFPActions(rfpId);
        return NextResponse.json({
          success: true,
          rfpId,
          actions,
          count: actions.length,
          timestamp: new Date().toISOString()
        });

      default:
        // Default: return active RFPs
        const defaultRFPs = await rfpStorage.getActiveRFPs();
        return NextResponse.json({
          success: true,
          data: defaultRFPs,
          count: defaultRFPs.length,
          timestamp: new Date().toISOString()
        });
    }

  } catch (error) {
    console.error('Error in RFP storage GET API:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { rfpId, status, notes } = body;

    if (!rfpId || !status) {
      return NextResponse.json({
        success: false,
        error: 'rfpId and status are required'
      }, { status: 400 });
    }

    // Initialize Neo4j service
    const neo4j = new Neo4jService();
    await neo4j.initialize();

    const rfpStorage = getRFPStorageService(neo4j);

    const success = await rfpStorage.updateRFPStatus(rfpId, status, notes);

    return NextResponse.json({
      success,
      rfpId,
      status,
      notes,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error updating RFP status:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}