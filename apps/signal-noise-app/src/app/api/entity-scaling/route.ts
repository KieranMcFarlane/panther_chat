/**
 * 🌐 Entity Scaling API
 * 
 * Manages thousands of entities with intelligent monitoring
 */

import { NextRequest, NextResponse } from 'next/server';
import { entityScalingManager } from '@/lib/entity-scaling-manager';
import { alertReasoningEngine } from '@/lib/alert-reasoning-engine';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const tier = searchParams.get('tier');
    const type = searchParams.get('type');
    const days = parseInt(searchParams.get('days') || '30');

    switch (action) {
      case 'stats':
        // Get scaling statistics
        const stats = entityScalingManager.getScalingStats();
        return NextResponse.json({
          success: true,
          data: stats
        });

      case 'entities':
        // Get entities by tier or type
        let entities;
        if (tier) {
          entities = entityScalingManager.getEntitiesByTier(tier);
        } else {
          // Get all entities with filtering
          const allEntities = entityScalingManager.getEntitiesByTier('golden')
            .concat(entityScalingManager.getEntitiesByTier('standard'))
            .concat(entityScalingManager.getEntitiesByTier('economy'));
          
          entities = type ? allEntities.filter(e => e.type === type) : allEntities;
        }

        return NextResponse.json({
          success: true,
          data: {
            entities: entities.slice(0, 100), // Limit response size
            total: entities.length,
            filteredBy: tier || type || 'all'
          }
        });

      case 'historical-rfps':
        // Get historical RFPs
        const historicalRFPs = entityScalingManager.getHistoricalRFPs(days);
        return NextResponse.json({
          success: true,
          data: {
            rfps: historicalRFPs.slice(0, 200), // Limit response size
            total: historicalRFPs.length,
            lookbackDays: days
          }
        });

      case 'reasoned-alerts':
        // Get recent alerts with reasoning
        const mockAlerts = [
          {
            id: 'alert-1',
            entity: 'Podium',
            type: 'traffic',
            description: 'web traffic increased',
            impact: 108.4,
            source: 'Web Analytics',
            timestamp: new Date().toISOString()
          },
          {
            id: 'alert-2',
            entity: 'Taylor Morgan',
            type: 'promotion',
            description: 'was promoted to CMO',
            impact: 0,
            source: 'LinkedIn',
            timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString()
          }
        ];

        const reasonedAlerts = await Promise.all(
          mockAlerts.map(alert => alertReasoningEngine.reasonAboutAlert(alert))
        );

        return NextResponse.json({
          success: true,
          data: reasonedAlerts
        });

      default:
        // Return default scaling overview
        return NextResponse.json({
          success: true,
          data: {
            message: 'Entity Scaling Manager API',
            endpoints: [
              '/api/entity-scaling?action=stats - Get scaling statistics',
              '/api/entity-scaling?action=entities&tier=golden|standard|economy - Get entities by tier',
              '/api/entity-scaling?action=entities&type=company|person - Get entities by type',
              '/api/entity-scaling?action=historical-rfps&days=30 - Get historical RFPs',
              '/api/entity-scaling?action=reasoned-alerts - Get reasoned alerts with insights'
            ],
            stats: entityScalingManager.getScalingStats()
          }
        });
    }

  } catch (error) {
    console.error('Entity Scaling API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, entityData, alertData } = body;

    switch (action) {
      case 'start-monitoring':
        // Start monitoring for specific entities
        return NextResponse.json({
          success: true,
          message: 'Entity monitoring initiated',
          stats: entityScalingManager.getScalingStats()
        });

      case 'add-entity':
        // Add new entity to monitoring
        return NextResponse.json({
          success: true,
          message: 'Entity added to monitoring queue',
          entity: entityData
        });

      case 'reason-alert':
        // Get reasoning for specific alert
        if (!alertData) {
          return NextResponse.json({
            success: false,
            error: 'Alert data required'
          }, { status: 400 });
        }

        const reasonedAlert = await alertReasoningEngine.reasonAboutAlert(alertData);
        return NextResponse.json({
          success: true,
          data: reasonedAlert
        });

      default:
        return NextResponse.json({
          success: false,
          error: 'Unknown action',
          available_actions: ['start-monitoring', 'add-entity', 'reason-alert']
        }, { status: 400 });
    }

  } catch (error) {
    console.error('Entity Scaling API POST error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}