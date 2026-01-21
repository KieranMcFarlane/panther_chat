/**
 * Test verification API without MCP integration
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-client';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    console.log(`🧪 Test Verification API: ${action}`);

    if (action === 'test_batch_verification') {
      // Simulate batch verification with mock data
      const mockResults = [
        {
          url: 'https://example.com/rfp1',
          organization_name: 'Test Organization 1',
          result: {
            success: true,
            authenticity_score: 85,
            screenshots: ['screenshot1.png'],
            interactions: ['Navigated to page', 'Found contact form', 'Form submitted'],
            response_captured: 'Thank you for your inquiry',
            duration: 15000
          }
        },
        {
          url: 'https://example.com/rfp2',
          organization_name: 'Test Organization 2',
          result: {
            success: false,
            authenticity_score: 0,
            error: '404 - Page not found',
            duration: 5000
          }
        }
      ];

      // Update some test RFPs in database
      const { data: rfps } = await supabase
        .from('rfp_opportunities')
        .select('id')
        .limit(2);

      if (rfps && rfps.length > 0) {
        await Promise.all(
          rfps.map((rfp, index) => 
            supabase
              .from('rfp_opportunities')
              .update({
                verification_status: mockResults[index].result.success ? 'verified' : 'failed',
                authenticity_score: mockResults[index].result.authenticity_score,
                verification_interactions: mockResults[index].result.interactions || [],
                verified_at: new Date().toISOString(),
                verification_result: mockResults[index].result
              })
              .eq('id', rfp.id)
          )
        );
      }

      return NextResponse.json({
        success: true,
        batch_result: {
          batch_results: mockResults,
          summary: {
            total_verified: 2,
            successful: 1,
            failed: 1,
            average_authenticity: 42
          }
        },
        message: 'Test verification completed successfully'
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Unknown action'
    });

  } catch (error) {
    console.error('Test verification failed:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}