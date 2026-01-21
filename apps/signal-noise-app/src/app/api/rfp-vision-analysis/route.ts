/**
 * Enhanced RFP Vision Analysis API
 * 
 * Combines GLM-4.5V visual reasoning with Claude's analytical capabilities
 * for comprehensive RFP document and opportunity analysis
 */

import { NextRequest, NextResponse } from 'next/server';
import { claudeGLM4V } from '@/lib/claude-glm4v-integration';
import { supabase } from '@/lib/supabase-client';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      action, 
      documentUrl, 
      screenshotUrls, 
      analysisType, 
      organizationInfo,
      context 
    } = body;

    console.log(`🔍 Enhanced RFP Vision Analysis: ${action}`);

    switch (action) {
      case 'analyze_rfp_document':
        return await handleRFPDocumentAnalysis(documentUrl, analysisType, context);
      
      case 'extract_webpage_intelligence':
        return await handleWebpageIntelligence(screenshotUrls, organizationInfo);
      
      case 'validate_opportunity_authenticity':
        return await handleOpportunityValidation(screenshotUrls, organizationInfo);
      
      case 'analyze_competitor_landscape':
        return await handleCompetitorAnalysis(screenshotUrls, analysisType);
      
      case 'process_stadium_opportunities':
        return await handleStadiumOpportunities(screenshotUrls, analysisType);
      
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('❌ Enhanced RFP Vision Analysis error:', error);
    return NextResponse.json({ 
      error: 'Analysis failed', 
      details: error.message 
    }, { status: 500 });
  }
}

/**
 * Analyze RFP documents using visual reasoning
 */
async function handleRFPDocumentAnalysis(
  documentUrl: string, 
  analysisType: string, 
  context?: string
) {
  try {
    console.log(`📄 Analyzing RFP document: ${analysisType}`);
    
    const analysis = await claudeGLM4V.analyzeRFPWithVision(
      documentUrl,
      analysisType as any,
      context
    );

    // Store analysis results in Supabase for tracking
    await storeAnalysisResults('rfp_document', {
      document_url: documentUrl,
      analysis_type: analysisType,
      results: analysis,
      created_at: new Date().toISOString()
    });

    return NextResponse.json({
      success: true,
      analysis_type: analysisType,
      results: analysis,
      processed_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('RFP document analysis failed:', error);
    return NextResponse.json({
      success: false,
      error: 'RFP document analysis failed',
      details: error.message
    }, { status: 500 });
  }
}

/**
 * Extract business intelligence from sports organization websites
 */
async function handleWebpageIntelligence(
  screenshotUrls: string[], 
  organizationInfo: any
) {
  try {
    console.log(`🌐 Extracting webpage intelligence for: ${organizationInfo.name}`);
    
    const intelligenceResults = [];
    
    for (const screenshotUrl of screenshotUrls) {
      const intelligence = await claudeGLM4V.extractWebpageIntelligence(
        screenshotUrl,
        organizationInfo.type,
        organizationInfo.focusArea || 'partnerships'
      );
      
      intelligenceResults.push({
        screenshot_url: screenshotUrl,
        intelligence
      });
    }

    // Store intelligence in Supabase
    await storeAnalysisResults('webpage_intelligence', {
      organization_name: organizationInfo.name,
      organization_type: organizationInfo.type,
      results: intelligenceResults,
      created_at: new Date().toISOString()
    });

    return NextResponse.json({
      success: true,
      organization: organizationInfo.name,
      intelligence_results: intelligenceResults,
      processed_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('Webpage intelligence extraction failed:', error);
    return NextResponse.json({
      success: false,
      error: 'Webpage intelligence extraction failed',
      details: error.message
    }, { status: 500 });
  }
}

/**
 * Validate RFP opportunity authenticity
 */
async function handleOpportunityValidation(
  screenshotUrls: string[], 
  organizationInfo: any
) {
  try {
    console.log(`🔍 Validating opportunity authenticity: ${organizationInfo.name}`);
    
    const validation = await claudeGLM4V.validateOpportunityAuthenticity(
      screenshotUrls,
      organizationInfo
    );

    // Update RFP opportunities table with validation results
    await updateRFPValidation(organizationInfo.id, validation);

    return NextResponse.json({
      success: true,
      organization: organizationInfo.name,
      validation_results: validation,
      processed_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('Opportunity validation failed:', error);
    return NextResponse.json({
      success: false,
      error: 'Opportunity validation failed',
      details: error.message
    }, { status: 500 });
  }
}

/**
 * Analyze competitor landscape
 */
async function handleCompetitorAnalysis(
  screenshotUrls: string[], 
  analysisFramework: string
) {
  try {
    console.log(`🏆 Analyzing competitor landscape: ${analysisFramework}`);
    
    const analysis = await claudeGLM4V.analyzeCompetitorLandscape(
      screenshotUrls,
      analysisFramework as any
    );

    return NextResponse.json({
      success: true,
      analysis_framework: analysisFramework,
      competitor_analysis: analysis,
      processed_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('Competitor analysis failed:', error);
    return NextResponse.json({
      success: false,
      error: 'Competitor analysis failed',
      details: error.message
    }, { status: 500 });
  }
}

/**
 * Process stadium visuals for infrastructure opportunities
 */
async function handleStadiumOpportunities(
  screenshotUrls: string[], 
  opportunityFocus: string
) {
  try {
    console.log(`🏟️ Processing stadium opportunities: ${opportunityFocus}`);
    
    const opportunities = await claudeGLM4V.processStadiumOpportunities(
      screenshotUrls,
      opportunityFocus as any
    );

    return NextResponse.json({
      success: true,
      opportunity_focus: opportunityFocus,
      stadium_opportunities: opportunities,
      processed_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('Stadium opportunity analysis failed:', error);
    return NextResponse.json({
      success: false,
      error: 'Stadium opportunity analysis failed',
      details: error.message
    }, { status: 500 });
  }
}

/**
 * Store analysis results in Supabase
 */
async function storeAnalysisResults(analysisType: string, data: any) {
  try {
    const { error } = await supabase
      .from('vision_analysis_results')
      .insert({
        analysis_type: analysisType,
        analysis_data: data,
        created_at: new Date().toISOString()
      });

    if (error) {
      console.warn('Failed to store analysis results:', error);
    }
  } catch (error) {
    console.warn('Error storing analysis results:', error);
  }
}

/**
 * Update RFP opportunities with validation results
 */
async function updateRFPValidation(rfpId: string, validation: any) {
  try {
    const { error } = await supabase
      .from('rfp_opportunities')
      .update({
        authenticity_score: validation.authenticityScore,
        risk_level: validation.riskLevel,
        validation_recommendation: validation.recommendation,
        validation_confidence: validation.confidence,
        updated_at: new Date().toISOString()
      })
      .eq('id', rfpId);

    if (error) {
      console.warn('Failed to update RFP validation:', error);
    }
  } catch (error) {
    console.warn('Error updating RFP validation:', error);
  }
}

// GET endpoint for analysis status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const analysisId = searchParams.get('id');
    const analysisType = searchParams.get('type');

    if (analysisId && analysisType) {
      // Retrieve specific analysis results
      const { data, error } = await supabase
        .from('vision_analysis_results')
        .select('*')
        .eq('analysis_type', analysisType)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        analysis_results: data,
        retrieved_at: new Date().toISOString()
      });
    }

    // Get analysis statistics
    const { data: stats } = await supabase
      .from('vision_analysis_results')
      .select('analysis_type')
      .order('created_at', { ascending: false })
      .limit(100);

    const analysisCounts = stats?.reduce((acc, item) => {
      acc[item.analysis_type] = (acc[item.analysis_type] || 0) + 1;
      return acc;
    }, {}) || {};

    return NextResponse.json({
      success: true,
      analysis_statistics: analysisCounts,
      total_analyses: stats?.length || 0,
      retrieved_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('Failed to retrieve analysis results:', error);
    return NextResponse.json({ 
      error: 'Retrieval failed', 
      details: error.message 
    }, { status: 500 });
  }
}