/**
 * Start Autonomous 24/7 RFP Monitoring System
 */

import { NextRequest, NextResponse } from 'next/server';
import { AutonomousRFPManager } from '@/services/AutonomousRFPManager';

// Global instance for persistence
let autonomousManager: AutonomousRFPManager | null = null;

export async function POST(request: NextRequest) {
  try {
    if (autonomousManager && autonomousManager.getSystemStatus().isActive) {
      return NextResponse.json({
        success: false,
        error: 'Autonomous RFP monitoring is already active',
        status: 'running'
      }, { status: 400 });
    }

    // Initialize or get existing manager
    if (!autonomousManager) {
      autonomousManager = new AutonomousRFPManager();
    }

    // Start autonomous monitoring
    await autonomousManager.startAutonomousMonitoring();
    
    const status = autonomousManager.getSystemStatus();

    return NextResponse.json({
      success: true,
      message: 'Autonomous 24/7 RFP monitoring started successfully',
      status: 'active',
      systemConfig: {
        priorityEntities: status.config.priorityEntities,
        standardEntities: status.config.standardEntities,
        schedules: status.config.schedules,
        thresholds: status.config.thresholds
      },
      monitoringDetails: {
        totalEntities: status.config.priorityEntities + status.config.standardEntities,
        monitoringFrequency: {
          priority: 'Every 4 hours',
          standard: 'Daily at 2 AM UTC',
          weekend: 'Saturday 10 AM UTC',
          monthly: 'First Monday 9 AM UTC'
        },
        escalationThresholds: {
          immediateAlert: `£${(status.config.thresholds.immediateAlert / 1000)}K`,
          executiveAlert: `£${(status.config.thresholds.executiveAlert / 1000000)}M`,
          criticalFit: `${status.config.thresholds.criticalOpportunity}%`
        }
      },
      startedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Failed to start autonomous RFP monitoring:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to start autonomous monitoring',
      message: error instanceof Error ? error.message : 'Unknown error',
      details: {
        timestamp: new Date().toISOString(),
        system: 'AutonomousRFPManager'
      }
    }, { status: 500 });
  }
}

export async function GET() {
  // Get current status
  if (!autonomousManager) {
    return NextResponse.json({
      success: true,
      status: 'inactive',
      message: 'Autonomous RFP monitoring system is not initialized',
      canStart: true
    });
  }

  const systemStatus = autonomousManager.getSystemStatus();
  
  return NextResponse.json({
    success: true,
    status: systemStatus.isActive ? 'active' : 'inactive',
    metrics: systemStatus.metrics,
    config: systemStatus.config,
    uptime: systemStatus.isActive ? 'Active' : 'Inactive',
    lastChecked: new Date().toISOString()
  });
}