#!/usr/bin/env node

/**
 * 🎯 Store Perplexity RFP Results to Supabase
 * 
 * This script writes the top Perplexity-detected RFP opportunities
 * to the rfp_opportunities table with detection_strategy='perplexity'
 */

const { supabase } = require('./src/lib/supabase-client');

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
 * Store RFP opportunity to Supabase
 */
async function storeRFPOpportunity(rfp) {
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

    // Prepare the data for insertion
    const rfpData = {
      // Core fields
      title: rfp.title,
      organization: rfp.organization,
      description: rfp.description,
      location: null,
      
      // Financial information
      estimated_value: rfp.estimated_value,
      currency: rfp.currency,
      value_numeric: valueNumeric,
      
      // Timing
      deadline: rfp.deadline,
      detected_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      
      // Source and classification
      source: 'ai-detected',
      source_url: rfp.src_link,
      category: rfp.category,
      subcategory: null,
      
      // Status and priority
      status: 'detected',
      priority: priority,
      priority_score: priorityScore,
      
      // Scoring
      confidence_score: rfp.confidence / 100,
      confidence: rfp.confidence,
      yellow_panther_fit: rfp.fit_score,
      
      // Entity information
      entity_id: null,
      entity_name: rfp.organization,
      entity_type: 'organization',
      neo4j_id: null,
      
      // System fields
      batch_id: `perplexity-${Date.now()}`,
      detection_strategy: 'perplexity',
      found_by_strategies: ['perplexity'],
      
      // JSON fields
      summary_json: summaryJson,
      requirements: null,
      agent_notes: {
        detection_strategy: 'perplexity',
        analysis_timestamp: new Date().toISOString(),
        urgency_level: rfp.urgency,
        market_opportunity: 'sports-digital-transformation'
      },
      contact_info: {},
      competition_info: {},
      metadata: {
        original_source: 'perplexity-hybrid-rfp-monitor',
        detection_confidence: rfp.confidence,
        market_sector: 'sports',
        digital_transformation: true
      },
      
      // Link verification
      link_status: 'unverified',
      link_verified_at: null,
      link_error: null,
      link_redirect_url: null,
      
      // Workflow fields
      tags: [rfp.category, rfp.rfp_type.toLowerCase(), 'perplexity-detected'],
      keywords: extractKeywords(rfp),
      assigned_to: null,
      follow_up_date: null,
      next_steps: 'Initial analysis and qualification required',
      notes: `Detected via Perplexity AI analysis with ${rfp.confidence}% confidence. High-value opportunity in ${rfp.category}.`,
      conversion_stage: 'opportunity'
    };

    // Insert into rfp_opportunities table
    const { data, error } = await supabase
      .from('rfp_opportunities')
      .insert(rfpData)
      .select()
      .single();

    if (error) {
      console.error(`❌ Failed to store RFP for ${rfp.organization}:`, error);
      return { success: false, error: error.message, organization: rfp.organization };
    }

    console.log(`✅ Successfully stored RFP for ${rfp.organization}:`);
    console.log(`   📋 Title: ${rfp.title}`);
    console.log(`   🎯 Confidence: ${rfp.confidence}% | Fit Score: ${rfp.fit_score}%`);
    console.log(`   💰 Value: ${rfp.estimated_value} | Priority: ${priority}`);
    console.log(`   🔗 Source: ${rfp.src_link}`);
    console.log(`   📝 Detection Strategy: perplexity`);
    console.log(`   🆔 ID: ${data.id}`);
    console.log('');

    return { success: true, data, organization: rfp.organization };

  } catch (error) {
    console.error(`❌ Unexpected error storing RFP for ${rfp.organization}:`, error);
    return { success: false, error: error.message, organization: rfp.organization };
  }
}

/**
 * Extract keywords from RFP data
 */
function extractKeywords(rfp) {
  const keywords = [];
  
  // Add organization keywords
  keywords.push(...rfp.organization.toLowerCase().split(' '));
  
  // Add title keywords
  const titleWords = rfp.title.toLowerCase().split(' ');
  keywords.push(...titleWords.filter(word => word.length > 3));
  
  // Add category keywords
  keywords.push(rfp.category.toLowerCase());
  
  // Add technology keywords
  const techKeywords = ['ai', 'digital', 'mobile', 'platform', 'analytics', 'blockchain', 'ar', 'fan engagement'];
  keywords.push(...techKeywords.filter(keyword => 
    rfp.title.toLowerCase().includes(keyword) || 
    rfp.description.toLowerCase().includes(keyword)
  ));
  
  // Remove duplicates and return unique keywords
  return [...new Set(keywords)].slice(0, 10);
}

/**
 * Main execution function
 */
async function main() {
  console.log('🚀 Starting to store Perplexity RFP results to Supabase...');
  console.log(`📊 Processing ${rfpOpportunities.length} RFP opportunities`);
  console.log('');

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

  console.log('📈 Storage Summary:');
  console.log(`   ✅ Successfully stored: ${successful}/${rfpOpportunities.length}`);
  console.log(`   ❌ Failed to store: ${failed}/${rfpOpportunities.length}`);
  
  if (failed > 0) {
    console.log('❌ Failed RFPs:');
    results.filter(r => !r.success).forEach(result => {
      console.log(`   - ${result.organization}: ${result.error}`);
    });
  }

  console.log('');
  console.log('🎉 Perplexity RFP storage process completed!');
  
  if (successful > 0) {
    console.log('');
    console.log('📊 Next steps:');
    console.log('   1. Verify the RFPs appear in the /tenders dashboard');
    console.log('   2. Review and qualify the detected opportunities');
    console.log('   3. Update entity relationships in Neo4j if needed');
    console.log('   4. Set up follow-up actions for high-priority RFPs');
  }
}

// Run the script
main().catch(error => {
  console.error('💥 Fatal error during RFP storage:', error);
  process.exit(1);
});