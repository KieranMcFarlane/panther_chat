/**
 * Start Predictive Intelligence Agent for 60-90 Day RFP Forecasting
 */

import { NextRequest, NextResponse } from 'next/server';
import { PredictiveIntelligenceAgent } from '@/services/PredictiveIntelligenceAgent';

// Global instance for persistence
let predictiveAgent: PredictiveIntelligenceAgent | null = null;

export async function POST(request: NextRequest) {
  try {
    if (predictiveAgent && predictiveAgent.getPredictiveStatus().isActive) {
      return NextResponse.json({
        success: false,
        error: 'Predictive Intelligence Agent is already active',
        status: 'running'
      }, { status: 400 });
    }

    // Initialize or get existing agent
    if (!predictiveAgent) {
      predictiveAgent = new PredictiveIntelligenceAgent();
    }

    // Start predictive intelligence analysis
    await predictiveAgent.startPredictiveAnalysis();
    
    const status = predictiveAgent.getPredictiveStatus();

    return NextResponse.json({
      success: true,
      message: '🔮 Predictive Intelligence Agent started successfully',
      status: 'active',
      systemInfo: {
        activePatterns: status.activePatterns,
        modelAccuracy: status.modelAccuracy,
        currentPredictions: status.currentPredictions,
        highConfidencePredictions: status.highConfidencePredictions
      },
      strategicAdvantage: {
        competitiveLead: '60-90 days before RFP announcement',
        predictionAccuracy: `${status.modelAccuracy}% historical accuracy`,
        pipelineValue: status.estimatedPipelineValue,
        businessImpact: 'First-mover advantage with pre-existing relationships'
      },
      operationalDetails: {
        dailyAnalysis: '08:00 UTC',
        workflowPhases: [
          'Pattern Recognition (08:00-08:15)',
          'Theory Generation (08:15-08:30)', 
          'Evidence Validation (08:30-08:45)',
          'Strategic Intelligence Output (08:45-09:00)'
        ],
        predictionWindow: 'Next 90 days',
        confidenceThreshold: '80% for strategic notifications'
      },
      startedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Failed to start Predictive Intelligence Agent:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to start predictive intelligence analysis',
      message: error instanceof Error ? error.message : 'Unknown error',
      details: {
        timestamp: new Date().toISOString(),
        system: 'PredictiveIntelligenceAgent'
      }
    }, { status: 500 });
  }
}

export async function GET() {
  // Get current predictive intelligence status
  if (!predictiveAgent) {
    return NextResponse.json({
      success: true,
      status: 'inactive',
      message: 'Predictive Intelligence Agent is not initialized',
      canStart: true,
      systemInfo: {
        activePatterns: 0,
        modelAccuracy: 0,
        currentPredictions: 0,
        highConfidencePredictions: 0
      }
    });
  }

  const systemStatus = predictiveAgent.getPredictiveStatus();
  
  return NextResponse.json({
    success: true,
    status: systemStatus.isActive ? 'active' : 'inactive',
    systemInfo: systemStatus,
    uptime: systemStatus.isActive ? 'Active' : 'Inactive',
    lastChecked: new Date().toISOString()
  });
}