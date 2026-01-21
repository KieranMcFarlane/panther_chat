/**
 * RFP Verification API
 * 
 * Headless browser verification for RFP authenticity
 * Integrates with MCP headless-verifier server
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-client';
import { realHeadlessVerifier } from '@/lib/real-headless-verifier';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, rfpId, rfpUrl, businessInfo, organizationInfo, batchConfigs } = body;

    console.log(`🤖 RFP Verification API: ${action}`);

    switch (action) {
      case 'verify_single_rfp':
        return await handleSingleRFPVerification(rfpId, rfpUrl, organizationInfo, businessInfo);
      
      case 'batch_verify_rfps':
        return await handleBatchVerification(batchConfigs, businessInfo);
      
      case 'click_contact_form':
        return await handleContactFormClick(rfpUrl, organizationInfo);
      
      case 'monitor_response':
        return await handleResponseMonitoring(rfpUrl, organizationInfo);
      
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('❌ RFP Verification API error:', error);
    return NextResponse.json({ 
      error: 'Verification failed', 
      details: error.message 
    }, { status: 500 });
  }
}

/**
 * Verify single RFP with headless browser
 */
async function handleSingleRFPVerification(
  rfpId: string,
  rfpUrl: string,
  organizationInfo: any,
  businessInfo: any
) {
  try {
    console.log(`🔍 Verifying RFP: ${rfpUrl} (ID: ${rfpId})`);
    
    // Use real headless verifier to perform browser verification
    const verification = await realHeadlessVerifier.verifyRFPWithBrowser({
      rfp_url: rfpUrl,
      organization_info: organizationInfo,
      business_info: businessInfo
    });

    const verificationResult = verification.verification_result;
    
    // Update RFP in database with verification results
    await updateRFPVerification(rfpId, {
      verification_result: verificationResult,
      authenticity_score: verificationResult.authenticity_score,
      verification_screenshots: verificationResult.screenshots,
      verification_interactions: verificationResult.interactions,
      verified_at: new Date().toISOString(),
      verification_status: verificationResult.success ? 'verified' : 'failed'
    });

    return NextResponse.json({
      success: true,
      rfp_id: rfpId,
      verification_result: { verification_result: verificationResult },
      updated_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('Single RFP verification failed:', error);
    
    // Mark as failed in database
    if (rfpId) {
      await updateRFPVerification(rfpId, {
        verification_status: 'failed',
        verification_error: error.message,
        verified_at: new Date().toISOString()
      });
    }
    
    return NextResponse.json({
      success: false,
      rfp_id: rfpId,
      error: error.message
    }, { status: 500 });
  }
}

/**
 * Verify multiple RFPs in batch
 */
async function handleBatchVerification(batchConfigs: any[], businessInfo: any) {
  try {
    console.log(`📦 Batch verifying ${batchConfigs.length} RFPs`);
    
    // Use real headless verifier for batch processing
    console.log('🔄 Calling batch_verify_rfps with configs:', batchConfigs);
    const batchVerification = await realHeadlessVerifier.batchVerifyRFPs({
      rfp_configs: batchConfigs,
      business_info: businessInfo
    });

    console.log('📋 Batch verification complete:', batchVerification);
    const batchResult = batchVerification;
    
    // Update database with batch results
    const updatePromises = batchResult.batch_results.map(async (result) => {
      if (result.organization_name) {
        // Find matching RFP in database
        const { data: rfps } = await supabase
          .from('rfp_opportunities')
          .select('id')
          .ilike('organization', `%${result.organization_name}%`)
          .limit(1);

        if (rfps && rfps.length > 0) {
          return await updateRFPVerification(rfps[0].id, {
            verification_result: result.result,
            authenticity_score: result.result.authenticity_score,
            verification_status: result.result.success ? 'verified' : 'failed',
            verified_at: new Date().toISOString()
          });
        }
      }
      return null;
    });

    await Promise.all(updatePromises);

    return NextResponse.json({
      success: true,
      batch_result: batchResult,
      summary: batchResult.summary,
      total_verified: batchResult.summary.total_verified,
      successful: batchResult.summary.successful,
      verified_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('Batch verification failed:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      verified_at: new Date().toISOString()
    }, { status: 500 });
  }
}

/**
 * Handle contact form click action
 */
async function handleContactFormClick(rfpUrl: string, organizationInfo: any) {
  try {
    console.log(`👆 Clicking contact form on: ${rfpUrl}`);
    
    // Use direct MCP client to click contact form
    const clickResult = await directMCPClient.callTool('click_rfp_contact_form', {
      rfp_url: rfpUrl,
      click_target: 'contact'
    });

    const result = JSON.parse(clickResult.content[0].text);

    return NextResponse.json({
      success: true,
      click_result: result.click_result,
      next_steps: result.next_steps,
      clicked_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('Contact form click failed:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

/**
 * Handle response monitoring
 */
async function handleResponseMonitoring(rfpUrl: string, organizationInfo: any) {
  try {
    console.log(`👀 Monitoring response for: ${rfpUrl}`);
    
    // Use direct MCP client to monitor responses
    const monitoringResult = await directMCPClient.callTool('monitor_rfp_response', {
      rfp_url: rfpUrl,
      submission_time: new Date().toISOString(),
      monitor_duration: 30
    });

    const result = JSON.parse(monitoringResult.content[0].text);

    return NextResponse.json({
      success: true,
      monitoring_result: result.monitoring_result,
      verification_status: result.verification_status,
      monitored_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('Response monitoring failed:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

/**
 * Update RFP verification results in database
 */
async function updateRFPVerification(rfpId: string, verificationData: any) {
  try {
    const { error } = await supabase
      .from('rfp_opportunities')
      .update({
        ...verificationData,
        updated_at: new Date().toISOString()
      })
      .eq('id', rfpId);

    if (error) {
      console.warn('Failed to update RFP verification:', error);
    }
  } catch (error) {
    console.warn('Error updating RFP verification:', error);
  }
}

// GET endpoint for verification status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rfpId = searchParams.get('id');
    const status = searchParams.get('status');

    if (rfpId) {
      // Get specific RFP verification status
      const { data, error } = await supabase
        .from('rfp_opportunities')
        .select('*')
        .eq('id', rfpId)
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        rfp_verification: data,
        retrieved_at: new Date().toISOString()
      });
    }

    // Get verification statistics
    let query = supabase
      .from('rfp_opportunities')
      .select('verification_status, authenticity_score, verification_result')
      .not('verification_status', 'is', null);

    if (status) {
      query = query.eq('verification_status', status);
    }

    const { data: verifications } = await query.order('verified_at', { ascending: false }).limit(100);

    const stats = verifications?.reduce((acc, item) => {
      const status = item.verification_status || 'not_verified';
      acc[status] = (acc[status] || 0) + 1;
      
      if (item.authenticity_score) {
        acc.totalAuthenticityScore = (acc.totalAuthenticityScore || 0) + item.authenticity_score;
        acc.authenticityCount = (acc.authenticityCount || 0) + 1;
      }
      
      return acc;
    }, {}) || {};

    const averageAuthenticity = stats.authenticityCount > 0 
      ? Math.round(stats.totalAuthenticityScore / stats.authenticityCount)
      : 0;

    return NextResponse.json({
      success: true,
      verification_statistics: {
        ...stats,
        average_authenticity: averageAuthenticity,
        total_verified: verifications?.length || 0
      },
      recent_verifications: verifications?.slice(0, 10) || [],
      retrieved_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('Failed to retrieve verification status:', error);
    return NextResponse.json({ 
      error: 'Retrieval failed', 
      details: error.message 
    }, { status: 500 });
  }
}