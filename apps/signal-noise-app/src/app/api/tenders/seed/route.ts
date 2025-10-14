import { NextRequest, NextResponse } from 'next/server';
import { cacheService } from '@/lib/supabase-cache';

/**
 * Test endpoint to manually seed RFP data from Neo4j entities
 */
export async function POST() {
  try {
    await cacheService.initialize();
    
    // Sample RFPs based on the actual Neo4j data I found
    const manualRFPs = [
      {
        id: 'manual_1_fc_koeln_1',
        title: 'RFP/Tender Opportunity - 1. FC Köln',
        organization: '1. FC Köln',
        location: 'Germany',
        value: 'TBD',
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        published: new Date().toISOString(),
        source: 'LinkedIn RFP Monitor',
        category: 'Football',
        status: 'Open',
        type: 'RFP',
        description: 'Detected LinkedIn post mentioning RFP/Tender with digital/app keywords - mobile app and website redesign opportunity',
        url: 'https://www.linkedin.com/posts/example_org_rfp-mobile-app-website-redesign-activity-1234567890',
        yellow_panther_fit: 92,
        confidence: 0.89,
        priority_score: 9,
        entity_tier: 1,
        procurement_signals: ['digital_transformation', 'mobile_app', 'website_redesign'],
        ai_analysis: {
          detected_signals: ['linkedin_monitoring', 'digital_keywords'],
          source: 'neo4j_entity_enrichment',
          analysis_date: new Date().toISOString()
        },
        detected_at: new Date().toISOString(),
        last_updated: new Date().toISOString()
      },
      {
        id: 'manual_1_fc_nuernberg_1', 
        title: 'RFP/Tender Opportunity - 1. FC Nürnberg',
        organization: '1. FC Nürnberg',
        location: 'Germany',
        value: 'TBD',
        deadline: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
        published: new Date().toISOString(),
        source: 'LinkedIn RFP Monitor',
        category: 'Football',
        status: 'Open',
        type: 'RFP',
        description: 'Detected LinkedIn post mentioning RFP/Tender with digital/app keywords - iOS/Android CMS development opportunity',
        url: 'https://www.linkedin.com/posts/example_org_rfq-ios-android-cms-activity-1234567892',
        yellow_panther_fit: 88,
        confidence: 0.86,
        priority_score: 8,
        entity_tier: 2,
        procurement_signals: ['mobile_development', 'cms', 'ios_android'],
        ai_analysis: {
          detected_signals: ['linkedin_monitoring', 'mobile_keywords'],
          source: 'neo4j_entity_enrichment',
          analysis_date: new Date().toISOString()
        },
        detected_at: new Date().toISOString(),
        last_updated: new Date().toISOString()
      },
      {
        id: 'manual_2_bundesliga_1',
        title: 'Strategic Partnership - 2. Bundesliga',
        organization: '2. Bundesliga',
        location: 'Germany',
        value: '£500K-£2M',
        deadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
        published: new Date().toISOString(),
        source: 'Retroactive Entity Analysis',
        category: 'Football',
        status: 'Open',
        type: 'Strategic Partnership',
        description: 'Potential partnership opportunity with 2. Bundesliga based on digital transformation needs and streaming platform expansion',
        url: 'https://bundesliga.com',
        yellow_panther_fit: 85,
        confidence: 0.8,
        priority_score: 8,
        entity_tier: 1,
        procurement_signals: ['streaming_platform', 'digital_transformation', 'league_partnership'],
        ai_analysis: {
          detected_signals: ['strategic_analysis', 'market_opportunity'],
          source: 'retroactive_analysis',
          analysis_date: new Date().toISOString()
        },
        detected_at: new Date().toISOString(),
        last_updated: new Date().toISOString()
      }
    ];

    let cachedCount = 0;
    for (const rfp of manualRFPs) {
      try {
        await cacheService.cacheEntity(rfp, rfp.entity_tier);
        cachedCount++;
        console.log(`✅ Cached RFP: ${rfp.title}`);
      } catch (error) {
        console.error(`❌ Failed to cache RFP ${rfp.title}:`, error);
      }
    }

    // Get cache stats
    const stats = await cacheService.getCacheStats();

    return NextResponse.json({
      success: true,
      cached_count: cachedCount,
      total_rfps: manualRFPs.length,
      cache_stats: stats,
      message: `Successfully cached ${cachedCount} RFP opportunities`
    });

  } catch (error) {
    console.error('Manual RFP seeding failed:', error);
    return NextResponse.json({ error: 'Manual seeding failed' }, { status: 500 });
  }
}