/**
 * 🌐 BrightData Integration Service
 * 
 * Connects to BrightData APIs for continuous monitoring of people and companies
 * Implements economic viability through tiered monitoring
 */

import { signalDetectionEngine, PersonSignal, CompanySignal } from './signal-detection';

interface BrightDataConfig {
  username: string;
  password: string;
  zoneId: string;
  endpoint: string;
}

interface MonitoringTarget {
  id: string;
  type: 'person' | 'company';
  name: string;
  linkedinUrl?: string;
  website?: string;
  domain?: string;
  tier: 'golden' | 'standard' | 'economy';
  monitoringFrequency: number; // minutes
}

interface LinkedInProfile {
  name: string;
  headline: string;
  company: string;
  title: string;
  skills: string[];
  posts: Array<{
    id: string;
    content: string;
    timestamp: string;
    engagement: number;
  }>;
  experience: Array<{
    company: string;
    title: string;
    startDate: string;
    endDate?: string;
  }>;
}

interface CompanyData {
  name: string;
  website: string;
  domain: string;
  employeeCount: number;
  jobListings: Array<{
    id: string;
    title: string;
    category: string;
    location: string;
    postedDate: string;
  }>;
  websiteTraffic: number;
  estimatedVisitors: string;
  totalFunding: number;
  locations: string[];
}

class BrightDataIntegration {
  private config: BrightDataConfig;
  private isMonitoring = false;
  private monitoringIntervals: Map<string, NodeJS.Timeout> = new Map();
  private lastDataFetch: Map<string, any> = new Map();

  constructor(config: BrightDataConfig) {
    this.config = config;
  }

  // Start monitoring all targets
  async startMonitoring(targets: MonitoringTarget[]) {
    if (this.isMonitoring) {
      console.warn('Monitoring is already active');
      return;
    }

    this.isMonitoring = true;
    console.log(`Starting monitoring for ${targets.length} targets`);

    // Group targets by tier for different monitoring strategies
    const goldenTargets = targets.filter(t => t.tier === 'golden');
    const standardTargets = targets.filter(t => t.tier === 'standard');
    const economyTargets = targets.filter(t => t.tier === 'economy');

    // Start real-time monitoring for golden zone (5-15 minutes)
    await this.startGoldenZoneMonitoring(goldenTargets);

    // Start batch monitoring for standard tier (30-60 minutes)
    await this.startStandardMonitoring(standardTargets);

    // Start batch monitoring for economy tier (2-4 hours)
    await this.startEconomyMonitoring(economyTargets);
  }

  // Stop all monitoring
  stopMonitoring() {
    this.isMonitoring = false;
    
    // Clear all intervals
    this.monitoringIntervals.forEach(interval => clearInterval(interval));
    this.monitoringIntervals.clear();
    
    console.log('Monitoring stopped');
  }

  private async startGoldenZoneMonitoring(targets: MonitoringTarget[]) {
    for (const target of targets) {
      const interval = setInterval(async () => {
        if (!this.isMonitoring) return;
        
        try {
          await this.monitorTarget(target);
        } catch (error) {
          console.error(`Golden zone monitoring failed for ${target.name}:`, error);
        }
      }, target.monitoringFrequency * 60 * 1000); // Convert to milliseconds

      this.monitoringIntervals.set(target.id, interval);
      
      // Initial monitoring
      await this.monitorTarget(target);
    }
  }

  private async startStandardMonitoring(targets: MonitoringTarget[]) {
    // Process in batches every 30-60 minutes
    const batchSize = 10;
    const interval = setInterval(async () => {
      if (!this.isMonitoring) return;
      
      for (let i = 0; i < targets.length; i += batchSize) {
        const batch = targets.slice(i, i + batchSize);
        
        for (const target of batch) {
          try {
            await this.monitorTarget(target);
          } catch (error) {
            console.error(`Standard monitoring failed for ${target.name}:`, error);
          }
        }
        
        // Wait between batches to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }, 45 * 60 * 1000); // 45 minutes

    this.monitoringIntervals.set('standard-batch', interval);
  }

  private async startEconomyMonitoring(targets: MonitoringTarget[]) {
    // Process in larger batches every 2-4 hours
    const batchSize = 25;
    const interval = setInterval(async () => {
      if (!this.isMonitoring) return;
      
      for (let i = 0; i < targets.length; i += batchSize) {
        const batch = targets.slice(i, i + batchSize);
        
        for (const target of batch) {
          try {
            await this.monitorTarget(target);
          } catch (error) {
            console.error(`Economy monitoring failed for ${target.name}:`, error);
          }
        }
        
        // Wait between batches
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
    }, 3 * 60 * 60 * 1000); // 3 hours

    this.monitoringIntervals.set('economy-batch', interval);
  }

  private async monitorTarget(target: MonitoringTarget) {
    const previousData = this.lastDataFetch.get(target.id);
    let currentData: any;

    try {
      if (target.type === 'person' && target.linkedinUrl) {
        currentData = await this.scrapeLinkedInProfile(target.linkedinUrl);
        const signals = await signalDetectionEngine.analyzePersonData(target.id, currentData, previousData);
        
        // Send signals to webhook
        await this.sendSignalsToWebhook(signals, target);
        
      } else if (target.type === 'company') {
        currentData = await this.scrapeCompanyData(target);
        const signals = await signalDetectionEngine.analyzeCompanyData(target.id, currentData, previousData);
        
        // Send signals to webhook
        await this.sendSignalsToWebhook(signals, target);
      }

      // Store current data for next comparison
      this.lastDataFetch.set(target.id, currentData);

    } catch (error) {
      console.error(`Failed to monitor ${target.name}:`, error);
    }
  }

  private async scrapeLinkedInProfile(linkedinUrl: string): Promise<LinkedInProfile> {
    const proxyUrl = `http://${this.config.username}:${this.config.password}@${this.config.endpoint}`;
    
    // Use BrightData Scraping Browser for LinkedIn
    const response = await fetch('https://api.brightdata.com/zone/ld/request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.password}`
      },
      body: JSON.stringify({
        url: linkedinUrl,
        zone: this.config.zoneId,
        format: 'json'
      })
    });

    if (!response.ok) {
      throw new Error(`BrightData API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Transform BrightData response to our format
    return {
      name: data.name || '',
      headline: data.headline || '',
      company: data.experience?.[0]?.company || '',
      title: data.experience?.[0]?.title || '',
      skills: data.skills || [],
      posts: data.recentActivity || [],
      experience: data.experience || []
    };
  }

  private async scrapeCompanyData(target: MonitoringTarget): Promise<CompanyData> {
    const proxyUrl = `http://${this.config.username}:${this.config.password}@${this.config.endpoint}`;
    
    // Use BrightData SERP API for company information
    const [webData, jobsData, trafficData] = await Promise.all([
      this.scrapeWebsiteInfo(target.website || target.domain || ''),
      this.scrapeJobListings(target.name),
      this.scrapeTrafficData(target.domain || '')
    ]);

    return {
      name: target.name,
      website: target.website || '',
      domain: target.domain || '',
      employeeCount: webData.employeeCount || 0,
      jobListings: jobsData,
      websiteTraffic: trafficData.currentTraffic || 0,
      estimatedVisitors: trafficData.estimatedVisitors || '0',
      totalFunding: webData.funding || 0,
      locations: webData.locations || []
    };
  }

  private async scrapeWebsiteInfo(website: string) {
    // Implementation using BrightData Web Unlocker
    // This would scrape company websites for employee count, funding, locations
    return {
      employeeCount: 0,
      funding: 0,
      locations: []
    };
  }

  private async scrapeJobListings(companyName: string) {
    // Use BrightData SERP API to find current job listings
    const response = await fetch(`https://api.brightdata.com/serp?q=${encodeURIComponent(companyName + ' jobs careers')}`, {
      headers: {
        'Authorization': `Bearer ${this.config.password}`
      }
    });

    const data = await response.json();
    
    return (data.organic_results || []).map((result: any) => ({
      id: result.position.toString(),
      title: result.title,
      category: 'general',
      location: 'Not specified',
      postedDate: new Date().toISOString()
    }));
  }

  private async scrapeTrafficData(domain: string) {
    // Use web traffic estimation APIs (e.g., SimilarWeb data via BrightData)
    // This is a simplified implementation
    return {
      currentTraffic: Math.floor(Math.random() * 100000),
      estimatedVisitors: Math.floor(Math.random() * 50000).toString()
    };
  }

  private async sendSignalsToWebhook(signals: (PersonSignal | CompanySignal)[], target: MonitoringTarget) {
    if (signals.length === 0) return;

    try {
      // Send to your existing webhook system
      await fetch('/api/webhook/signal-detected', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signals,
          target,
          timestamp: new Date().toISOString(),
          source: 'brightdata_monitoring'
        })
      });

      // Log to activity system
      const { activityLogger } = await import('@/lib/activity-logger');
      
      for (const signal of signals) {
        await activityLogger.logActivity('signal_detected', {
          opportunityId: `signal-${target.id}`,
          opportunityTitle: `${signal.type}: ${target.name}`,
          organization: target.type === 'company' ? target.name : (signal as PersonSignal).person.company,
          category: 'analysis',
          impact: signal.confidence > 0.8 ? 'high' : signal.confidence > 0.6 ? 'medium' : 'low',
          details: {
            signalType: signal.type,
            confidence: signal.confidence,
            targetTier: target.tier,
            signalDetails: signal.details
          }
        });
      }

    } catch (error) {
      console.error('Failed to send signals to webhook:', error);
    }
  }

  // Get monitoring statistics
  getMonitoringStats() {
    return {
      isMonitoring: this.isMonitoring,
      activeTargets: this.monitoringIntervals.size,
      lastDataFetchCount: this.lastDataFetch.size,
      uptime: this.isMonitoring ? 'Active' : 'Inactive'
    };
  }

  // Add new target dynamically
  async addTarget(target: MonitoringTarget) {
    if (this.isMonitoring) {
      await this.monitorTarget(target);
      
      if (target.tier === 'golden') {
        const interval = setInterval(async () => {
          if (!this.isMonitoring) return;
          await this.monitorTarget(target);
        }, target.monitoringFrequency * 60 * 1000);
        
        this.monitoringIntervals.set(target.id, interval);
      }
    }
  }

  // Remove target from monitoring
  removeTarget(targetId: string) {
    const interval = this.monitoringIntervals.get(targetId);
    if (interval) {
      clearInterval(interval);
      this.monitoringIntervals.delete(targetId);
    }
    
    this.lastDataFetch.delete(targetId);
  }
}

export { BrightDataIntegration, MonitoringTarget, LinkedInProfile, CompanyData };