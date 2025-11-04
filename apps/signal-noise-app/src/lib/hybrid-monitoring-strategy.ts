/**
 * 🎯 Hybrid Monitoring Strategy
 * 
 * Combines BrightData API for scalable data collection with Claude Agent SDK
 * for intelligent analysis and signal detection
 */

interface MonitoringTarget {
  id: string;
  name: string;
  type: 'person' | 'organization';
  tier: 'golden' | 'standard' | 'economy';
  priority: number;
  monitoringFrequency: number; // minutes
  triggers: string[];
}

interface SignalDetection {
  type: 'job_change' | 'promotion' | 'departure' | 'post' | 'hiring' | 'traffic';
  confidence: number;
  impact: 'high' | 'medium' | 'low';
  timestamp: string;
  details: Record<string, any>;
}

class HybridMonitoringService {
  private brightDataClient: any;
  private claudeAgent: any;
  private targets: Map<string, MonitoringTarget> = new Map();
  private signalQueue: SignalDetection[] = [];

  async initializeTargets(targets: MonitoringTarget[]) {
    // Categorize targets by monitoring approach
    const goldenTargets = targets.filter(t => t.tier === 'golden');
    const standardTargets = targets.filter(t => t.tier === 'standard');
    
    // Set up real-time monitoring for golden zone
    await this.setupGoldenZoneMonitoring(goldenTargets);
    
    // Set up batch processing for standard tier
    await this.setupBatchMonitoring(standardTargets);
  }

  private async setupGoldenZoneMonitoring(targets: MonitoringTarget[]) {
    // Real-time monitoring using BrightData Web Unlocker
    const monitoringPromises = targets.map(target => 
      this.startRealTimeMonitoring(target)
    );
    
    await Promise.all(monitoringPromises);
  }

  private async setupBatchMonitoring(targets: MonitoringTarget[]) {
    // Batch processing using BrightData Scraping Browser
    const batchSize = 50;
    for (let i = 0; i < targets.length; i += batchSize) {
      const batch = targets.slice(i, i + batchSize);
      await this.processBatch(batch);
      
      // Wait between batches to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 60000)); // 1 minute
    }
  }

  private async startRealTimeMonitoring(target: MonitoringTarget) {
    const monitoringInterval = setInterval(async () => {
      try {
        // Collect data using BrightData
        const rawData = await this.brightDataClient.collectData(target);
        
        // Analyze with Claude Agent SDK
        const analysis = await this.claudeAgent.analyze(rawData, {
          context: 'professional_monitoring',
          target: target,
          previousData: this.getPreviousData(target.id)
        });

        // Detect signals
        const signals = this.detectSignals(analysis, target);
        
        // Queue important signals
        this.signalQueue.push(...signals);
        
        // Trigger immediate alerts for high-impact signals
        const highImpactSignals = signals.filter(s => s.impact === 'high');
        if (highImpactSignals.length > 0) {
          await this.triggerImmediateAlerts(highImpactSignals, target);
        }

      } catch (error) {
        console.error(`Monitoring failed for ${target.name}:`, error);
      }
    }, target.monitoringFrequency * 60 * 1000); // Convert to milliseconds

    // Store interval reference for cleanup
    this.targets.set(target.id, { ...target, monitoringInterval });
  }

  private detectSignals(analysis: any, target: MonitoringTarget): SignalDetection[] {
    const signals: SignalDetection[] = [];
    
    // Job change detection
    if (analysis.jobChange) {
      signals.push({
        type: 'job_change',
        confidence: analysis.jobChange.confidence,
        impact: 'high',
        timestamp: new Date().toISOString(),
        details: analysis.jobChange
      });
    }

    // Promotion detection
    if (analysis.promotion) {
      signals.push({
        type: 'promotion',
        confidence: analysis.promotion.confidence,
        impact: 'medium',
        timestamp: new Date().toISOString(),
        details: analysis.promotion
      });
    }

    // New post detection
    if (analysis.newPost) {
      signals.push({
        type: 'post',
        confidence: 0.9,
        impact: analysis.newPost.important ? 'medium' : 'low',
        timestamp: new Date().toISOString(),
        details: analysis.newPost
      });
    }

    // Hiring activity
    if (analysis.hiringActivity) {
      signals.push({
        type: 'hiring',
        confidence: 0.8,
        impact: 'medium',
        timestamp: new Date().toISOString(),
        details: analysis.hiringActivity
      });
    }

    // Web traffic changes
    if (analysis.webTrafficChange) {
      signals.push({
        type: 'traffic',
        confidence: 0.95,
        impact: Math.abs(analysis.webTrafficChange.percentChange) > 50 ? 'high' : 'medium',
        timestamp: new Date().toISOString(),
        details: analysis.webTrafficChange
      });
    }

    return signals;
  }

  private async triggerImmediateAlerts(signals: SignalDetection[], target: MonitoringTarget) {
    for (const signal of signals) {
      // Send webhook to your existing system
      await fetch('/api/webhook/signal-detected', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signal,
          target,
          timestamp: new Date().toISOString(),
          urgency: 'immediate'
        })
      });

      // Log to activity system
      await this.logSignalDetection(signal, target);
    }
  }

  async getSignalDigest(targetId?: string) {
    const filteredSignals = targetId 
      ? this.signalQueue.filter(s => s.details.targetId === targetId)
      : this.signalQueue;

    return {
      totalSignals: filteredSignals.length,
      highImpact: filteredSignals.filter(s => s.impact === 'high').length,
      mediumImpact: filteredSignals.filter(s => s.impact === 'medium').length,
      recentSignals: filteredSignals.slice(0, 10),
      categories: this.categorizeSignals(filteredSignals)
    };
  }

  private categorizeSignals(signals: SignalDetection[]) {
    return signals.reduce((acc, signal) => {
      acc[signal.type] = (acc[signal.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private async logSignalDetection(signal: SignalDetection, target: MonitoringTarget) {
    // Integrate with your existing activity logger
    const { activityLogger } = await import('@/lib/activity-logger');
    
    await activityLogger.logActivity('signal_detected', {
      opportunityId: `signal-${target.id}`,
      opportunityTitle: `${signal.type}: ${target.name}`,
      organization: target.type === 'organization' ? target.name : target.details?.organization,
      category: 'analysis',
      impact: signal.impact,
      details: {
        signalType: signal.type,
        confidence: signal.confidence,
        targetTier: target.tier,
        signalDetails: signal.details
      }
    });
  }
}

export { HybridMonitoringService, MonitoringTarget, SignalDetection };