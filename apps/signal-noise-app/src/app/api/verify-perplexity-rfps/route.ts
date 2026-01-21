/**
 * 🔍 Verify Perplexity RFP Storage API
 * 
 * This endpoint verifies that the Perplexity RFP opportunities
 * were successfully stored in Supabase
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-client';

/**
 * GET endpoint to verify Perplexity RFP storage
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Verifying Perplexity RFP storage...');

    // Query for RFPs with detection_strategy in metadata
    const { data: perplexityRFPs, error } = await supabase
      .from('rfp_opportunities')
      .select('*')
      .eq('source', 'Perplexity AI Detection')
      .order('detected_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('❌ Error querying Perplexity RFPs:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to query Perplexity RFPs',
        details: error.message
      }, { status: 500 });
    }

    if (!perplexityRFPs || perplexityRFPs.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          message: 'No Perplexity RFPs found in database',
          total_found: 0,
          rfps: []
        }
      });
    }

    // Verify the expected organizations
    const expectedOrgs = [
      'Manchester United FC',
      'Golden State Warriors', 
      'Toronto Blue Jays',
      'NBA',
      'IPL',
      'FIBA World Cup',
      'LaLiga',
      'Bundesliga'
    ];

    const foundOrgs = perplexityRFPs.map(rfp => rfp.organization);
    const missingOrgs = expectedOrgs.filter(org => !foundOrgs.includes(org));

    // Format RFP data for response
    const formattedRFPs = perplexityRFPs.map((rfp, index) => ({
      rank: index + 1,
      organization: rfp.organization,
      title: rfp.title,
      fit_score: rfp.yellow_panther_fit,
      confidence: rfp.confidence,
      value: rfp.value,
      deadline: rfp.deadline,
      category: rfp.category,
      id: rfp.id,
      source_url: rfp.source_url,
      detected_at: rfp.detected_at,
      metadata: rfp.metadata
    }));

    return NextResponse.json({
      success: true,
      data: {
        message: `Successfully stored and verified ${perplexityRFPs.length} Perplexity RFPs`,
        total_found: perplexityRFPs.length,
        expected_organizations: expectedOrgs.length,
        found_organizations: foundOrgs.length,
        missing_organizations: missingOrgs,
        storage_verification: {
          all_expected_found: missingOrgs.length === 0,
          detection_strategy_present: perplexityRFPs.every(rfp => 
            rfp.metadata && rfp.metadata.detection_strategy === 'perplexity'
          ),
          summary_json_present: perplexityRFPs.every(rfp => 
            rfp.metadata && rfp.metadata.summary_json
          ),
          source_correct: perplexityRFPs.every(rfp => 
            rfp.source === 'Perplexity AI Detection'
          )
        },
        rfps: formattedRFPs,
        verification_timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('💥 Error during verification:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Verification failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}