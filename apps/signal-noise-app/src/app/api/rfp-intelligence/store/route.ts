import { NextRequest, NextResponse } from 'next/server';
// import { getServerSession } from '@/lib/auth-client';

interface RFPIntelligenceData {
  sessionId: string;
  entitiesProcessed: number;
  processingTime: number;
  results: Array<{
    chunk: number;
    entities: string;
    analysis: string;
    processedAt: string;
  }>;
  sessionSummary: any;
  timestamp: string;
  metadata?: {
    service: string;
    analysisType: string;
    entityLimit: number;
  };
}

export async function POST(request: NextRequest) {
  try {
    // const session = await getServerSession();
    // if (!session?.user) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    const data: RFPIntelligenceData = await request.json();

    // Validate required fields
    if (!data.sessionId || !data.results) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Store in Supabase (or your preferred database)
    const storedData = {
      id: `rfp_${data.sessionId}`,
      user_id: 'demo_user', // session.user.id,
      session_id: data.sessionId,
      entities_processed: data.entitiesProcessed,
      processing_time: data.processingTime,
      results: data.results,
      session_summary: data.sessionSummary,
      timestamp: data.timestamp,
      metadata: data.metadata,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // For now, return success (you would actually save to your database)
    console.log('Storing RFP intelligence data:', storedData);

    // TODO: Implement actual database storage
    // await supabase.from('rfp_intelligence').insert([storedData]);

    return NextResponse.json({ 
      success: true, 
      id: storedData.id,
      message: 'RFP intelligence stored successfully'
    });

  } catch (error) {
    console.error('Error storing RFP intelligence:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // const session = await getServerSession();
    // if (!session?.user) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');

    // TODO: Implement actual database retrieval
    // const { data, error } = await supabase
    //   .from('rfp_intelligence')
    //   .select('*')
    //   .eq('user_id', 'demo_user') // session.user.id
    //   .order('created_at', { ascending: false })
    //   .range(offset, offset + limit - 1);

    // For now, return mock data
    const mockData = [
      {
        id: 'rfp_mock_1',
        session_id: 'a2a_1761274881322_1ub637eil',
        entities_processed: 10,
        processing_time: 151887,
        timestamp: '2025-10-24T03:03:53.187Z',
        metadata: {
          service: 'claude-code-reliable-a2a-system',
          analysisType: 'comprehensive_rfp_intelligence'
        },
        created_at: '2025-10-24T03:03:53.187Z'
      }
    ];

    return NextResponse.json({
      data: mockData,
      total: mockData.length,
      limit,
      offset
    });

  } catch (error) {
    console.error('Error retrieving RFP intelligence:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}