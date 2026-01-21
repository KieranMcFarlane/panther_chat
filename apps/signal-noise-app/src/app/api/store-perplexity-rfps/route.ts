/**
 * 🎯 Store Perplexity RFP Results API
 * 
 * This endpoint stores Perplexity-detected RFP opportunities
 * to the rfp_opportunities table with detection_strategy='perplexity'
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-client';

// Top RFP opportunities detected by Perplexity
const rfpOpportunities = [
  {
    organization: 'Manchester United FC',
    src_link: 'https://procurement.manutd.com/digital-platform-rfp-2025',
    title: 'Fan Engagement Mobile App Development',
    confidence: 95,
    urgency: 'HIGH',
    fit_score: 95,
    rfp_type: 'ACTIVE_RFP',
    description: 'Development of a comprehensive fan engagement mobile application to enhance supporter experience and digital interaction.',
    category: 'digital-transformation',
    estimated_value: '£2,500,000',
    currency: 'GBP',
    deadline: '2025-12-15'
  },
  {
    organization: 'Golden State Warriors',
    src_link: 'https://warriors.com/procurement/chase-center-digital-rfp',
    title: 'Chase Center Digital Infrastructure Upgrade',
    confidence: 85,
    urgency: 'MEDIUM',
    fit_score: 85,
    rfp_type: 'ACTIVE_RFP',
    description: 'Comprehensive upgrade of digital infrastructure at Chase Center including fan experience systems and venue technology.',
    category: 'digital-infrastructure',
    estimated_value: '$1,800,000',
    currency: 'USD',
    deadline: '2026-01-31'
  },
  {
    organization: 'Toronto Blue Jays',
    src_link: 'https://www.bluejays.com/procurement/digital-modernization-rfp',
    title: 'Rogers Centre Digital Modernization',
    confidence: 85,
    urgency: 'MEDIUM',
    fit_score: 85,
    rfp_type: 'ACTIVE_RFP',
    description: 'Digital modernization of Rogers Centre including fan engagement systems, digital signage, and venue technology upgrades.',
    category: 'digital-transformation',
    estimated_value: 'CAD 3,200,000',
    currency: 'CAD',
    deadline: '2026-02-28'
  },
  {
    organization: 'NBA',
    src_link: 'https://nba.nba.com/technology-rfp-2025',
    title: 'AI-Powered Analytics Platform',
    confidence: 85,
    urgency: 'MEDIUM',
    fit_score: 85,
    rfp_type: 'ACTIVE_RFP',
    description: 'Development and implementation of an AI-powered analytics platform for league-wide performance and fan engagement insights.',
    category: 'ai-analytics',
    estimated_value: '$5,000,000',
    currency: 'USD',
    deadline: '2026-03-15'
  },
  {
    organization: 'IPL',
    src_link: 'https://www.iplt20.com/digital-innovation-rfp-2025',
    title: 'AI Content Creation Platform',
    confidence: 85,
    urgency: 'MEDIUM',
    fit_score: 85,
    rfp_type: 'ACTIVE_RFP',
    description: 'AI-powered content creation platform for generating engaging digital content across IPL franchises and tournaments.',
    category: 'ai-content',
    estimated_value: '$2,200,000',
    currency: 'USD',
    deadline: '2026-01-20'
  },
  {
    organization: 'FIBA World Cup',
    src_link: 'https://fiba.basketball/procurement/world-cup-digital-platform',
    title: '2027 Digital Platform Development',
    confidence: 85,
    urgency: 'LOW',
    fit_score: 85,
    rfp_type: 'ACTIVE_RFP',
    description: 'Comprehensive digital platform development for the 2027 FIBA World Cup including fan engagement and tournament management systems.',
    category: 'digital-platform',
    estimated_value: '€4,500,000',
    currency: 'EUR',
    deadline: '2026-06-30'
  },
  {
    organization: 'LaLiga',
    src_link: 'https://procurement.laliga.com/digital-services-tender-2025',
    title: 'Digital Services Platform Overhaul',
    confidence: 75,
    urgency: 'MEDIUM',
    fit_score: 75,
    rfp_type: 'ACTIVE_RFP',
    description: 'Complete overhaul of LaLiga digital services platform including streaming, fan engagement, and content delivery systems.',
    category: 'digital-platform',
    estimated_value: '€8,000,000',
    currency: 'EUR',
    deadline: '2025-12-31'
  },
  {
    organization: 'Bundesliga',
    src_link: 'https://bundesliga.com/digital-innovation-rfp',
    title: 'Blockchain Ticketing & AR Fan Experience',
    confidence: 70,
    urgency: 'LOW',
    fit_score: 70,
    rfp_type: 'ACTIVE_RFP',
    description: 'Implementation of blockchain-based ticketing system and augmented reality fan experience technologies across Bundesliga stadiums.',
    category: 'blockchain-ar',
    estimated_value: '€6,500,000',
    currency: 'EUR',
    deadline: '2026-04-30'
  }
];

/**
 * Extract keywords from RFP data
 */
function extractKeywords(rfp: any) {
  const keywords: string[] = [];
  
  // Add organization keywords
  keywords.push(...rfp.organization.toLowerCase().split(' '));
  
  // Add title keywords
  const titleWords = rfp.title.toLowerCase().split(' ');
  keywords.push(...titleWords.filter((word: string) => word.length > 3));
  
  // Add category keywords
  keywords.push(rfp.category.toLowerCase());
  
  // Add technology keywords
  const techKeywords = ['ai', 'digital', 'mobile', 'platform', 'analytics', 'blockchain', 'ar', 'fan engagement'];
  keywords.push(...techKeywords.filter((keyword: string) => 
    rfp.title.toLowerCase().includes(keyword) || 
    rfp.description.toLowerCase().includes(keyword)
  ));
  
  // Remove duplicates and return unique keywords
  return [...new Set(keywords)].slice(0, 10);
}

/**
 * Store a single RFP opportunity to Supabase
 */
async function storeRFPOpportunity(rfp: any) {
  try {
    // Parse numeric value from estimated value
    const valueNumeric = parseFloat(rfp.estimated_value.replace(/[^0-9.]/g, ''));
    
    // Calculate priority based on confidence, fit score, and value
    let priority = 'medium';
    let priorityScore = 5;
    
    if (rfp.confidence >= 90 && rfp.fit_score >= 90 && valueNumeric > 2000000) {
      priority = 'critical';
      priorityScore = 10;
    } else if (rfp.confidence >= 80 && rfp.fit_score >= 80 && valueNumeric > 1000000) {
      priority = 'high';
      priorityScore = 8;
    } else if (rfp.confidence >= 70 || rfp.fit_score >= 70) {
      priority = 'medium';
      priorityScore = 6;
    } else {
      priority = 'low';
      priorityScore = 3;
    }

    // Determine urgency boost to priority
    if (rfp.urgency === 'HIGH' && rfp.confidence >= 80) {
      priority = 'critical';
      priorityScore = Math.min(10, priorityScore + 2);
    } else if (rfp.urgency === 'MEDIUM' && rfp.confidence >= 70) {
      priority = 'high';
      priorityScore = Math.min(9, priorityScore + 1);
    }

    // Prepare summary_json structure
    const summaryJson = {
      title: rfp.title,
      confidence: rfp.confidence,
      urgency: rfp.urgency,
      fit_score: rfp.fit_score,
      rfp_type: rfp.rfp_type,
      description: rfp.description,
      detection_method: 'perplexity-hybrid-analysis',
      detected_at: new Date().toISOString()
    };

    // Prepare the data for insertion based on actual table structure
    const rfpData = {
      // Core fields
      id: `perplexity-${rfp.organization.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
      title: rfp.title,
      organization: rfp.organization,
      description: rfp.description,
      location: null,
      
      // Financial information  
      value: rfp.estimated_value,
      // Note: currency, value_numeric fields not present in current table
      
      // Timing
      deadline: rfp.deadline ? new Date(rfp.deadline).toISOString().split('T')[0] : null,
      published: null,
      detected_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      
      // Source and classification
      source: 'Perplexity AI Detection',
      source_url: rfp.src_link,
      category: rfp.category.charAt(0).toUpperCase() + rfp.category.slice(1).replace('-', ' '),
      
      // Status and scoring
      status: 'new',
      yellow_panther_fit: rfp.fit_score,
      confidence: rfp.confidence,
      urgency: rfp.urgency.toLowerCase(),
      
      // Entity information
      entity_id: null,
      entity_name: null,
      
      // System fields - detection_strategy stored in metadata
      
      // JSON fields
      requirements: null,
      metadata: {
        original_source: 'perplexity-hybrid-rfp-monitor',
        detection_confidence: rfp.confidence,
        market_sector: 'sports',
        digital_transformation: true,
        urgency_level: rfp.urgency,
        detection_strategy: 'perplexity',
        summary_json: summaryJson,
        detected_keywords: extractKeywords(rfp)
      },
      
      // Link verification
      link_status: 'unverified',
      link_verified_at: null,
      link_error: null,
      link_redirect_url: null
    };

    // Insert into rfp_opportunities table
    const { data, error } = await supabase
      .from('rfp_opportunities')
      .insert(rfpData)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message, organization: rfp.organization };
    }

    return { 
      success: true, 
      data, 
      organization: rfp.organization,
      priority,
      id: data.id
    };

  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error', 
      organization: rfp.organization 
    };
  }
}

/**
 * GET endpoint to store all Perplexity RFP results
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🚀 Starting to store Perplexity RFP results to Supabase...');
    console.log(`📊 Processing ${rfpOpportunities.length} RFP opportunities`);

    const results = [];
    
    for (const rfp of rfpOpportunities) {
      const result = await storeRFPOpportunity(rfp);
      results.push(result);
      
      // Small delay between insertions to avoid overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Summary
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    const successfulResults = results.filter(r => r.success);
    const failedResults = results.filter(r => !r.success);

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          total_processed: rfpOpportunities.length,
          successfully_stored: successful,
          failed_to_store: failed,
          success_rate: `${((successful / rfpOpportunities.length) * 100).toFixed(1)}%`
        },
        successful_opportunities: successfulResults.map(result => ({
          organization: result.organization,
          id: result.id,
          priority: result.priority
        })),
        failed_opportunities: failedResults.map(result => ({
          organization: result.organization,
          error: result.error
        })),
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('💥 Fatal error during RFP storage:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to store RFP opportunities',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * POST endpoint to store a specific RFP or custom RFP data
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // If the request contains custom RFP data, store it
    if (body.rfp) {
      const result = await storeRFPOpportunity(body.rfp);
      
      if (result.success) {
        return NextResponse.json({
          success: true,
          data: {
            message: 'RFP stored successfully',
            rfp: result.data,
            organization: result.organization,
            priority: result.priority,
            id: result.id
          }
        });
      } else {
        return NextResponse.json({
          success: false,
          error: 'Failed to store RFP',
          details: result.error,
          organization: result.organization
        }, { status: 500 });
      }
    }

    // Otherwise, store all predefined RFPs
    return NextResponse.json({
      success: false,
      error: 'Missing rfp data in request body'
    }, { status: 400 });

  } catch (error) {
    console.error('💥 Error in POST request:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to process request',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}