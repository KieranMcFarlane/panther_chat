/**
 * API endpoint for scalable retroactive RFP discovery
 */

import { NextRequest, NextResponse } from 'next/server';
import { scalableRetroactiveDiscovery } from '@/lib/scalable-retroactive-discovery';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, config } = body;

    switch (action) {
      case 'start-discovery':
        return await handleStartDiscovery(config);
      
      case 'get-stats':
        return await handleGetStats();
      
      case 'stop-discovery':
        return await handleStopDiscovery();
      
      case 'get-potential':
        return await handleGetPotential();
      
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('❌ Retroactive discovery API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'stats';

    switch (action) {
      case 'stats':
        return await handleGetStats();
      
      case 'potential':
        return await handleGetPotential();
      
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('❌ Retroactive discovery GET API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Start full-scale discovery process
 */
async function handleStartDiscovery(config: any = {}) {
  try {
    console.log('🚀 Starting scalable retroactive discovery...');
    
    const result = await scalableRetroactiveDiscovery.startFullScaleDiscovery();
    
    return NextResponse.json({
      success: true,
      message: 'Scalable retroactive discovery started',
      ...result,
      started_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Failed to start discovery:', error);
    return NextResponse.json({ 
      error: 'Failed to start retroactive discovery',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Get current processing statistics
 */
async function handleGetStats() {
  try {
    const stats = scalableRetroactiveDiscovery.getProcessingStats();
    
    return NextResponse.json({
      success: true,
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Failed to get stats:', error);
    return NextResponse.json({ error: 'Failed to get processing stats' }, { status: 500 });
  }
}

/**
 * Stop discovery process
 */
async function handleStopDiscovery() {
  try {
    await scalableRetroactiveDiscovery.stopProcessing();
    
    return NextResponse.json({
      success: true,
      message: 'Retroactive discovery stopped',
      stopped_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Failed to stop discovery:', error);
    return NextResponse.json({ error: 'Failed to stop discovery' }, { status: 500 });
  }
}

/**
 * Get discovery potential analysis
 */
async function handleGetPotential() {
  try {
    const potential = await scalableRetroactiveDiscovery.getDiscoveryPotential();
    
    return NextResponse.json({
      success: true,
      potential,
      analysis: {
        scalability: `Can process ${potential.totalEntities} entities in ${potential.processingTime}`,
        opportunity_coverage: `Estimated ${potential.estimatedDiscoveries.total} RFP opportunities (${((potential.estimatedDiscoveries.total / potential.totalEntities) * 100).toFixed(1)}% hit rate)`,
        value_distribution: `${potential.valueBreakdown.highValueEntities} high-value, ${potential.valueBreakdown.mediumValueEntities} medium-value, ${potential.valueBreakdown.lowValueEntities} low-value entities`,
        business_impact: `Potential ${potential.estimatedDiscoveries.high} high-value and ${potential.estimatedDiscoveries.medium} medium-value opportunities worth pursuing`
      }
    });
  } catch (error) {
    console.error('❌ Failed to get potential:', error);
    return NextResponse.json({ error: 'Failed to get discovery potential' }, { status: 500 });
  }
}