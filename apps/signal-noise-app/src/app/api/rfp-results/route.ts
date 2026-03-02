import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';

// Mark route as dynamic to prevent static generation
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'opportunities';
    
    if (action === 'latest-rfps') {
      if (supabase) {
        const { data, error } = await supabase
          .from('rfp_opportunities_unified')
          .select('*')
          .order('detected_at', { ascending: false })
          .limit(50)

        if (!error && data) {
          const opportunities = data.map((rfp) => ({
            ...rfp,
            deadline: rfp.deadline || null,
            published: rfp.published || rfp.detected_at,
            type: 'RFP',
            confidence: rfp.confidence_score ?? (typeof rfp.confidence === 'number' ? rfp.confidence / 100 : null),
          }))

          return NextResponse.json({
            success: true,
            opportunities,
            metadata: { source: 'supabase-unified', totalFound: opportunities.length },
            total: opportunities.length
          })
        }
      }

      // Load RFP results from our analysis
      const rfpResultsPath = join(process.cwd(), 'rfp-results.json');
      
      try {
        const rfpData = await readFile(rfpResultsPath, 'utf-8');
        const parsed = JSON.parse(rfpData);
        
        // Transform RFP data to match tender card structure
        const opportunities = parsed.rfpOpportunities.map(rfp => ({
          ...rfp,
          // Map RFP fields to tender card expected fields
          deadline: rfp.deadline || null,
          published: rfp.extractedAt,
          source: rfp.source,
          type: rfp.type || 'RFP',
          description: rfp.description,
          confidence: rfp.confidence === 'HIGH' ? 0.85 : 0.75,
          priority_score: rfp.priority_score || 7
        }));
        
        return NextResponse.json({
          success: true,
          opportunities,
          metadata: parsed.analysisMetadata,
          total: opportunities.length
        });
        
      } catch (fileError) {
        console.error('❌ Error reading RFP results:', fileError);
        
        // Return mock data if file doesn't exist
        const mockOpportunities = [
          {
            id: "rfp_001",
            title: "Broadcast Rights Tender 2025-2028",
            organization: "Bangladesh Cricket Board",
            location: "Bangladesh",
            value: "$15-25M",
            deadline: "2025-09-30",
            category: "Media Rights",
            status: "emerging",
            type: "Tender",
            description: "BPL typically issues media rights tenders every 3-4 years for broadcasting partnerships",
            url: "https://www.tigers.com.bd/bpl-tenders",
            yellow_panther_fit: 88,
            priority_score: 9,
            confidence: 0.85,
            source: "Claude Code Analysis",
            published: "2025-10-24T12:41:41.775Z"
          }
        ];
        
        return NextResponse.json({
          success: true,
          opportunities: mockOpportunities,
          metadata: { totalFound: 1, source: 'mock-data' },
          total: mockOpportunities.length
        });
      }
    }
    
    return NextResponse.json({
      success: false,
      error: 'Invalid action parameter'
    }, { status: 400 });
    
  } catch (error) {
    console.error('❌ Error in RFP results API:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch RFP results',
      opportunities: []
    }, { status: 500 });
  }
}
