// Unified RFP Signal Processor Webhook Handler
// Handles incoming signals from LinkedIn, iSportConnect, news, and other sources

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Neo4jClient } from '@/lib/neo4j';

interface RFPWebhookPayload {
  webhook_id: string;
  timestamp: string;
  source_platform: 'linkedin' | 'isportconnect' | 'news' | 'job_board' | 'company_announcement';
  signal_confidence: number;
  
  entity_analysis: {
    organization_name: string;
    neo4j_entity_id?: string;
    entity_type: 'Club' | 'League' | 'Federation' | 'Tournament';
    sport: string;
    country: string;
  };
  
  rfp_signals: {
    content_analysis: {
      raw_text: string;
      keyword_matches: Array<{
        category: string;
        keywords: string[];
        frequency: number;
        weight: number;
      }>;
      semantic_score: number;
      urgency_level: 'low' | 'medium' | 'high' | 'critical';
    };
    
    opportunity_assessment: {
      project_type: string;
      scope_overview: string;
      estimated_budget: string;
      submission_deadline?: string;
      decision_timeline?: string;
    };
  };
  
  source_metadata: {
    url?: string;
    author?: string;
    published_at?: string;
    engagement_metrics?: {
      likes?: number;
      comments?: number;
      shares?: number;
      views?: number;
    };
  };
}

const neo4j = new Neo4jClient();
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

// RFP Detection Keywords with weights
const RFP_KEYWORDS = {
  direct_rfp: {
    weight: 1.0,
    keywords: [
      'request for proposal', 'RFP', 'request for tender', 'RFT',
      'invitation to tender', 'ITT', 'soliciting proposals', 'EOI',
      'expression of interest', 'call for proposals', 'CFP',
      'vendor selection', 'procurement process', 'bidding process'
    ]
  },
  
  digital_projects: {
    weight: 0.95,
    keywords: [
      'digital transformation', 'website development', 'mobile app',
      'application development', 'web development', 'software development',
      'digital platform', 'online platform', 'digital solution',
      'technology implementation', 'system integration', 'digital overhaul'
    ]
  },
  
  sports_digital: {
    weight: 0.9,
    keywords: [
      'fan engagement platform', 'ticketing system', 'sports app',
      'fan experience', 'digital stadium', 'mobile ticketing',
      'sports technology', 'digital sports', 'athlete management',
      'competition management', 'league management', 'federation platform'
    ]
  },
  
  urgency_signals: {
    weight: 0.85,
    keywords: [
      'immediate opportunity', 'seeking partners', 'urgent requirement',
      'fast-track', 'expedited process', 'immediate start', 'priority project',
      'deadline approaching', 'submission deadline', 'closing date'
    ]
  }
};

// Yellow Panther Service Alignment Matrix
const YELLOW_PANTHER_SERVICES = {
  'mobile app development': { fit_score: 1.0, budget_range: '£80K-£300K' },
  'digital transformation': { fit_score: 1.0, budget_range: '£200K-£500K' },
  'web development': { fit_score: 0.95, budget_range: '£80K-£200K' },
  'integrated systems': { fit_score: 0.85, budget_range: '£150K-£400K' },
  'fan engagement': { fit_score: 0.9, budget_range: '£100K-£250K' },
  'ticketing system': { fit_score: 0.85, budget_range: '£150K-£350K' }
};

function extractKeywords(text: string): Array<{category: string, keywords: string[], frequency: number, weight: number}> {
  const results: Array<{category: string, keywords: string[], frequency: number, weight: number}> = [];
  const lowerText = text.toLowerCase();
  
  for (const [category, config] of Object.entries(RFP_KEYWORDS)) {
    const matchedKeywords: string[] = [];
    
    for (const keyword of config.keywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        matchedKeywords.push(keyword);
      }
    }
    
    if (matchedKeywords.length > 0) {
      results.push({
        category,
        keywords: matchedKeywords,
        frequency: matchedKeywords.length,
        weight: config.weight
      });
    }
  }
  
  return results;
}

function calculateYellowPantherFit(projectType: string, scope: string): number {
  const combinedText = `${projectType} ${scope}`.toLowerCase();
  
  let maxFit = 0;
  for (const [service, config] of Object.entries(YELLOW_PANTHER_SERVICES)) {
    if (combinedText.includes(service.toLowerCase())) {
      maxFit = Math.max(maxFit, config.fit_score);
    }
  }
  
  // Additional scoring based on Yellow Panther strengths
  if (combinedText.includes('sports') || combinedText.includes('federation') || combinedText.includes('league')) {
    maxFit = Math.min(1.0, maxFit + 0.1);
  }
  
  if (combinedText.includes('award') || combinedText.includes('olympic') || combinedText.includes('premier')) {
    maxFit = Math.min(1.0, maxFit + 0.05);
  }
  
  return maxFit;
}

function estimateBudget(projectType: string, scope: string, orgType: string): string {
  const combinedText = `${projectType} ${scope}`.toLowerCase();
  
  // Budget estimation based on project complexity and organization type
  if (combinedText.includes('digital transformation') || combinedText.includes('comprehensive')) {
    if (orgType.includes('International') || orgType.includes('Premier League')) {
      return '£400K-£800K';
    }
    return '£200K-£500K';
  }
  
  if (combinedText.includes('mobile app') || combinedText.includes('application')) {
    if (orgType.includes('International') || orgType.includes('Premier League')) {
      return '£200K-£400K';
    }
    return '£100K-£250K';
  }
  
  if (combinedText.includes('website') || combinedText.includes('web development')) {
    if (orgType.includes('International') || orgType.includes('Premier League')) {
      return '£150K-£300K';
    }
    return '£80K-£180K';
  }
  
  if (combinedText.includes('integrated') || combinedText.includes('system')) {
    return '£150K-£400K';
  }
  
  return '£100K-£300K';
}

function calculateOverallScore(keywordMatches: Array<any>, semanticScore: number, yellowPantherFit: number): number {
  const keywordScore = keywordMatches.reduce((total, match) => {
    return total + (match.weight * Math.min(match.frequency / 2, 1));
  }, 0) / Math.max(keywordMatches.length, 1);
  
  return (
    (keywordScore * 0.4) +      // 40% keyword matching
    (semanticScore * 0.3) +     // 30% semantic analysis
    (yellowPantherFit * 0.3)    // 30% Yellow Panther fit
  );
}

export async function POST(request: NextRequest) {
  try {
    const payload: RFPWebhookPayload = await request.json();
    
    // Validate webhook signature (implement based on your security requirements)
    const signature = request.headers.get('x-webhook-signature');
    if (!signature) {
      return NextResponse.json({ error: 'Missing webhook signature' }, { status: 401 });
    }
    
    // Extract keywords and calculate scores
    const keywordMatches = extractKeywords(payload.rfp_signals.content_analysis.raw_text);
    const yellowPantherFit = calculateYellowPantherFit(
      payload.rfp_signals.opportunity_assessment.project_type,
      payload.rfp_signals.opportunity_assessment.scope_overview
    );
    
    const overallScore = calculateOverallScore(
      keywordMatches,
      payload.rfp_signals.content_analysis.semantic_score,
      yellowPantherFit
    );
    
    // Enhance payload with analysis
    const enhancedPayload = {
      ...payload,
      analysis: {
        keyword_matches: keywordMatches,
        yellow_panther_fit: yellowPantherFit,
        overall_score: overallScore,
        estimated_budget: estimateBudget(
          payload.rfp_signals.opportunity_assessment.project_type,
          payload.rfp_signals.opportunity_assessment.scope_overview,
          payload.entity_analysis.entity_type
        ),
        detected_at: new Date().toISOString()
      }
    };
    
    // Store in Supabase for historical analysis
    const { data, error } = await supabase
      .from('rfp_signals')
      .insert([{
        webhook_id: enhancedPayload.webhook_id,
        source_platform: enhancedPayload.source_platform,
        entity_name: enhancedPayload.entity_analysis.organization_name,
        entity_type: enhancedPayload.entity_analysis.entity_type,
        confidence: enhancedPayload.signal_confidence,
        overall_score: overallScore,
        yellow_panther_fit: yellowPantherFit,
        raw_content: enhancedPayload.rfp_signals.content_analysis.raw_text,
        keyword_matches: keywordMatches,
        project_type: enhancedPayload.rfp_signals.opportunity_assessment.project_type,
        scope_overview: enhancedPayload.rfp_signals.opportunity_assessment.scope_overview,
        estimated_budget: enhancedPayload.analysis.estimated_budget,
        source_url: enhancedPayload.source_metadata.url,
        published_at: enhancedPayload.source_metadata.published_at,
        detected_at: enhancedPayload.analysis.detected_at
      }]);
    
    if (error) {
      console.error('Error storing RFP signal:', error);
      // Continue processing even if storage fails
    }
    
    // Check if this meets criteria for immediate alert
    const shouldAlert = 
      overallScore >= 0.8 || 
      yellowPantherFit >= 0.9 || 
      payload.rfp_signals.content_analysis.urgency_level === 'critical';
    
    if (shouldAlert) {
      // Trigger immediate alert system
      await triggerImmediateAlert(enhancedPayload);
    }
    
    return NextResponse.json({
      success: true,
      webhook_id: payload.webhook_id,
      analysis: {
        overall_score: overallScore,
        yellow_panther_fit: yellowPantherFit,
        keyword_matches_found: keywordMatches.length,
        should_alert: shouldAlert,
        estimated_budget: enhancedPayload.analysis.estimated_budget
      },
      processed_at: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error processing RFP webhook:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

async function triggerImmediateAlert(payload: any): Promise<void> {
  try {
    // Store high-priority alert
    const { error: alertError } = await supabase
      .from('rfp_alerts')
      .insert([{
        webhook_id: payload.webhook_id,
        organization_name: payload.entity_analysis.organization_name,
        project_type: payload.rfp_signals.opportunity_assessment.project_type,
        yellow_panther_fit: payload.analysis.yellow_panther_fit,
        overall_score: payload.analysis.overall_score,
        urgency_level: payload.rfp_signals.content_analysis.urgency_level,
        estimated_budget: payload.analysis.estimated_budget,
        source_url: payload.source_metadata.url,
        alert_type: 'IMMEDIATE_OPPORTUNITY',
        status: 'ACTIVE',
        created_at: new Date().toISOString()
      }]);
    
    if (alertError) {
      console.error('Error creating alert:', alertError);
    }
    
    // TODO: Implement additional notification channels
    // - Email notifications
    // - Slack alerts  
    // - Dashboard real-time updates
    
    console.log(`🚨 IMMEDIATE RFP ALERT: ${payload.entity_analysis.organization_name} - ${payload.rfp_signals.opportunity_assessment.project_type}`);
    
  } catch (error) {
    console.error('Error triggering immediate alert:', error);
  }
}

// GET endpoint for retrieving recent RFP signals
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const minScore = parseFloat(searchParams.get('min_score') || '0.7');
    
    const { data, error } = await supabase
      .from('rfp_signals')
      .select('*')
      .gte('overall_score', minScore)
      .order('detected_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      throw error;
    }
    
    return NextResponse.json({
      success: true,
      count: data?.length || 0,
      signals: data || []
    });
    
  } catch (error) {
    console.error('Error retrieving RFP signals:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}