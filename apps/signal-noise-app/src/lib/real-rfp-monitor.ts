/**
 * 🚀 Real-Time RFP Monitoring Service
 * 
 * Continuously monitors real procurement sources and publishes RFP opportunities
 * to replace mock data with actual tender announcements.
 */

import { realRFPDataSource, RealRFPOpportunity } from './real-rfp-data-sources';
import { EventEmitter } from 'events';
import { supabase } from './supabase-client';

export interface RFPAlert {
  id: string;
  type: 'rfp_detected' | 'tender_published' | 'procurement_deadline' | 'contract_awarded';
  urgency: 'high' | 'medium' | 'low';
  title: string;
  organization: string;
  value?: string;
  deadline?: string;
  category: string;
  source: string;
  source_url: string;
  description: string;
  yellow_panther_fit: number;
  confidence: number;
  published: string;
  detected_at: string;
  location?: string;
  requirements?: string[];
  contact_info?: any;
}

export class RealRFPMonitor extends EventEmitter {
  private isMonitoring = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private lastScanTime = new Date();
  private processedOpportunities = new Set<string>();
  private readonly MONITORING_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_OPPORTUNITIES_PER_SCAN = 50;

  constructor() {
    super();
  }

  /**
   * 🚀 Start real-time RFP monitoring
   */
  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      console.log('⚠️ RFP monitoring is already running');
      return;
    }

    console.log('🚀 Starting real-time RFP monitoring...');
    this.isMonitoring = true;

    // Perform initial scan
    await this.performRFPScan();

    // Set up continuous monitoring
    this.monitoringInterval = setInterval(async () => {
      if (this.isMonitoring) {
        await this.performRFPScan();
      }
    }, this.MONITORING_INTERVAL);

    console.log(`✅ RFP monitoring started - scanning every ${this.MONITORING_INTERVAL / 1000} seconds`);
  }

  /**
   * ⏹️ Stop real-time RFP monitoring
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      console.log('⚠️ RFP monitoring is not running');
      return;
    }

    console.log('⏹️ Stopping real-time RFP monitoring...');
    this.isMonitoring = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    console.log('✅ RFP monitoring stopped');
  }

  /**
   * 🔍 Perform comprehensive RFP scan
   */
  private async performRFPScan(): Promise<void> {
    try {
      console.log(`🔍 Performing RFP scan at ${new Date().toISOString()}`);
      
      // Get current opportunities from real sources
      const opportunities = await realRFPDataSource.searchRealOpportunities(
        ['sports technology', 'digital transformation', 'fan engagement'],
        this.MAX_OPPORTUNITIES_PER_SCAN
      );

      console.log(`📊 Found ${opportunities.length} opportunities from real sources`);

      // Process each opportunity
      for (const opportunity of opportunities) {
        await this.processOpportunity(opportunity);
      }

      this.lastScanTime = new Date();
      
      // Emit scan completion event
      this.emit('scan_completed', {
        scan_time: this.lastScanTime,
        opportunities_found: opportunities.length,
        new_alerts: opportunities.filter(opp => !this.processedOpportunities.has(opp.id)).length
      });

    } catch (error) {
      console.error('❌ Error during RFP scan:', error);
      this.emit('scan_error', { error: error.message, timestamp: new Date() });
    }
  }

  /**
   * 📋 Process individual RFP opportunity
   */
  private async processOpportunity(opportunity: RealRFPOpportunity): Promise<void> {
    try {
      // Skip if already processed
      if (this.processedOpportunities.has(opportunity.id)) {
        return;
      }

      // Calculate Yellow Panther fit score
      const fitScore = this.calculateYellowPantherFit(opportunity);
      
      // Calculate confidence score
      const confidence = this.calculateConfidenceScore(opportunity);

      // Determine alert type and urgency
      const alertType = this.determineAlertType(opportunity);
      const urgency = this.determineUrgency(opportunity);

      // Create RFP alert
      const alert: RFPAlert = {
        id: `alert_${opportunity.id}`,
        type: alertType,
        urgency,
        title: opportunity.title,
        organization: opportunity.organization,
        value: opportunity.value,
        deadline: opportunity.deadline,
        category: opportunity.category,
        source: opportunity.source,
        source_url: opportunity.source_url,
        description: opportunity.description,
        yellow_panther_fit: fitScore,
        confidence,
        published: opportunity.published,
        detected_at: new Date().toISOString(),
        location: opportunity.location,
        requirements: opportunity.requirements,
        contact_info: opportunity.contact_info
      };

      // Only emit high-quality opportunities
      if (fitScore >= 70 && confidence >= 75) {
        console.log(`🎯 High-quality RFP detected: ${opportunity.title} (Fit: ${fitScore}%, Confidence: ${confidence}%)`);
        
        this.emit('rfp_detected', alert);
        this.processedOpportunities.add(opportunity.id);

        // Also send to webhook for processing
        await this.sendToWebhook(alert);
        
        // Persist to Supabase
        await this.persistOpportunity(alert, opportunity);
      } else {
        console.log(`📊 Lower-priority RFP: ${opportunity.title} (Fit: ${fitScore}%, Confidence: ${confidence}%)`);
        this.processedOpportunities.add(opportunity.id);
        
        // Still persist lower-priority opportunities for historical tracking
        await this.persistOpportunity(alert, opportunity);
      }

    } catch (error) {
      console.error(`❌ Error processing opportunity ${opportunity.id}:`, error);
    }
  }

  /**
   * 🎯 Calculate Yellow Panther fit score
   */
  private calculateYellowPantherFit(opportunity: RealRFPOpportunity): number {
    let score = 50; // Base score

    // Sports industry relevance (highest weight)
    if (this.isSportsRelated(opportunity)) {
      score += 30;
    }

    // Technology focus
    if (this.isTechnologyFocused(opportunity)) {
      score += 20;
    }

    // Value range
    if (opportunity.value) {
      const value = this.parseValue(opportunity.value);
      if (value >= 1000000) { // $1M+
        score += 10;
      } else if (value >= 500000) { // $500k+
        score += 5;
      }
    }

    // Location preference
    if (opportunity.location && this.isPreferredLocation(opportunity.location)) {
      score += 5;
    }

    // Category relevance
    if (this.isRelevantCategory(opportunity.category)) {
      score += 10;
    }

    // Deadline urgency
    if (opportunity.deadline) {
      const daysUntilDeadline = this.getDaysUntilDeadline(opportunity.deadline);
      if (daysUntilDeadline > 30 && daysUntilDeadline < 90) {
        score += 5; // Sweet spot for response time
      }
    }

    return Math.min(100, Math.max(0, score));
  }

  /**
   * 🎯 Calculate confidence score
   */
  private calculateConfidenceScore(opportunity: RealRFPOpportunity): number {
    let score = 60; // Base confidence

    // Source reliability
    if (this.isReliableSource(opportunity.source)) {
      score += 20;
    }

    // Information completeness
    if (opportunity.title && opportunity.description && opportunity.organization) {
      score += 10;
    }

    // Contact information available
    if (opportunity.contact_info && (opportunity.contact_info.email || opportunity.contact_info.phone)) {
      score += 10;
    }

    // Recent publication
    const daysSincePublished = this.getDaysSincePublished(opportunity.published);
    if (daysSincePublished < 30) {
      score += 10;
    }

    // Clear requirements
    if (opportunity.requirements && opportunity.requirements.length > 0) {
      score += 10;
    }

    return Math.min(100, Math.max(0, score));
  }

  /**
   * 📋 Determine alert type
   */
  private determineAlertType(opportunity: RealRFPOpportunity): RFPAlert['type'] {
    if (opportunity.deadline && this.getDaysUntilDeadline(opportunity.deadline) < 14) {
      return 'procurement_deadline';
    }
    return 'rfp_detected';
  }

  /**
   * ⚡ Determine urgency
   */
  private determineUrgency(opportunity: RealRFPOpportunity): RFPAlert['urgency'] {
    if (opportunity.deadline) {
      const daysUntilDeadline = this.getDaysUntilDeadline(opportunity.deadline);
      if (daysUntilDeadline < 14) return 'high';
      if (daysUntilDeadline < 30) return 'medium';
    }
    return 'low';
  }

  /**
   * 🏆 Check if sports-related
   */
  private isSportsRelated(opportunity: RealRFPOpportunity): boolean {
    const sportsKeywords = [
      'sports', 'sport', 'football', 'soccer', 'basketball', 'tennis',
      'olympic', 'olympics', 'fifa', 'uefa', 'nba', 'nfl', 'mlb',
      'athlete', 'stadium', 'arena', 'league', 'club', 'team',
      'fan', 'spectator', 'match', 'game', 'tournament', 'championship'
    ];

    const text = `${opportunity.title} ${opportunity.description} ${opportunity.category}`.toLowerCase();
    return sportsKeywords.some(keyword => text.includes(keyword));
  }

  /**
   * 💻 Check if technology-focused
   */
  private isTechnologyFocused(opportunity: RealRFPOpportunity): boolean {
    const techKeywords = [
      'software', 'platform', 'application', 'app', 'mobile', 'web',
      'digital', 'technology', 'data', 'analytics', 'ai', 'machine learning',
      'cloud', 'saas', 'api', 'integration', 'automation', 'system',
      'development', 'programming', 'database', 'infrastructure', 'cybersecurity'
    ];

    const text = `${opportunity.title} ${opportunity.description} ${opportunity.category}`.toLowerCase();
    return techKeywords.some(keyword => text.includes(keyword));
  }

  /**
   * 🔍 Check if reliable source
   */
  private isReliableSource(source: string): boolean {
    const reliableSources = [
      'FIFA', 'Olympics', 'Premier League', 'UEFA', 'NBA', 'NFL',
      'Contracts Finder', 'SAM.gov', 'EU TED', 'UNGM',
      'Official', 'Government', 'Federal'
    ];

    return reliableSources.some(relSource => source.includes(relSource));
  }

  /**
   * 🌍 Check if preferred location
   */
  private isPreferredLocation(location: string): boolean {
    const preferredLocations = [
      'United Kingdom', 'UK', 'London', 'Manchester',
      'United States', 'USA', 'New York', 'Los Angeles',
      'European Union', 'EU', 'Germany', 'France', 'Spain',
      'Switzerland', 'Geneva', 'Zurich'
    ];

    return preferredLocations.some(prefLoc => location.toLowerCase().includes(prefLoc.toLowerCase()));
  }

  /**
   * 📂 Check if relevant category
   */
  private isRelevantCategory(category: string): boolean {
    const relevantCategories = [
      'Sports Technology', 'Digital Transformation', 'Software Development',
      'Mobile Applications', 'Data Analytics', 'AI Platform', 'Cloud Services',
      'Web Development', 'Technology Solutions', 'Information Technology'
    ];

    return relevantCategories.some(relCat => category.toLowerCase().includes(relCat.toLowerCase()));
  }

  /**
   * 💰 Parse monetary value
   */
  private parseValue(value: string): number {
    // Remove currency symbols and extract numeric value
    const cleanValue = value.replace(/[^0-9.]/g, '');
    const parsed = parseFloat(cleanValue);
    
    if (value.toLowerCase().includes('m') || value.toLowerCase().includes('million')) {
      return parsed * 1000000;
    } else if (value.toLowerCase().includes('k') || value.toLowerCase().includes('thousand')) {
      return parsed * 1000;
    }
    
    return parsed;
  }

  /**
   * 📅 Get days until deadline
   */
  private getDaysUntilDeadline(deadline: string): number {
    try {
      const deadlineDate = new Date(deadline);
      const now = new Date();
      const diffTime = deadlineDate.getTime() - now.getTime();
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    } catch {
      return 999; // Far future if can't parse
    }
  }

  /**
   * 📅 Get days since published
   */
  private getDaysSincePublished(published: string): number {
    try {
      const publishedDate = new Date(published);
      const now = new Date();
      const diffTime = now.getTime() - publishedDate.getTime();
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    } catch {
      return 0; // Today if can't parse
    }
  }

  /**
   * 💾 Persist opportunity to Supabase
   */
  private async persistOpportunity(alert: RFPAlert, opportunity: RealRFPOpportunity): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('rfp_opportunities')
        .upsert({
          id: opportunity.id,
          title: opportunity.title,
          organization: opportunity.organization,
          description: opportunity.description,
          value: opportunity.value,
          deadline: opportunity.deadline ? new Date(opportunity.deadline).toISOString() : null,
          category: opportunity.category,
          source: opportunity.source,
          source_url: opportunity.source_url,
          published: opportunity.published ? new Date(opportunity.published).toISOString() : null,
          location: opportunity.location,
          requirements: opportunity.requirements || [],
          yellow_panther_fit: alert.yellow_panther_fit,
          confidence: alert.confidence,
          urgency: alert.urgency,
          entity_id: `entity_${opportunity.organization.replace(/\s+/g, '_').toLowerCase()}`,
          entity_name: opportunity.organization,
          status: alert.yellow_panther_fit >= 70 ? 'qualified' : 'new',
          metadata: {
            contact_info: opportunity.contact_info || {},
            detection_source: 'real_rfp_monitor',
            original_alert_type: alert.type,
            processing_time: Date.now()
          }
        }, {
          onConflict: 'id'
        })
        .select()
        .single();

      if (error) {
        console.error(`❌ Error persisting opportunity ${opportunity.id} to Supabase:`, error);
      } else {
        console.log(`✅ Opportunity persisted to Supabase: ${opportunity.title}`);
      }

    } catch (error) {
      console.error(`❌ Error persisting opportunity ${opportunity.id}:`, error);
    }
  }

  /**
   * 📤 Send alert to webhook
   */
  private async sendToWebhook(alert: RFPAlert): Promise<void> {
    try {
      const webhookPayload = {
        type: 'rfp_alert',
        data: {
          rfp: {
            id: alert.id.replace('alert_', ''),
            title: alert.title,
            organization: alert.organization,
            description: alert.description,
            value: alert.value,
            deadline: alert.deadline,
            category: alert.category,
            source: alert.source,
            source_url: alert.source_url,
            published: alert.published,
            location: alert.location,
            requirements: alert.requirements
          },
          entity: {
            id: `entity_${alert.organization.replace(/\s+/g, '_').toLowerCase()}`,
            name: alert.organization,
            type: 'company',
            industry: 'Sports',
            size: 'large',
            location: alert.location || 'Unknown'
          }
        },
        priority: alert.urgency === 'high' ? 'high' : 'medium',
        timestamp: alert.detected_at,
        source: 'real_rfp_monitor'
      };

      const response = await fetch('http://localhost:3006/api/webhook/claude-agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(webhookPayload)
      });

      if (response.ok) {
        console.log(`✅ Webhook sent for ${alert.title}`);
      } else {
        console.warn(`⚠️ Webhook failed for ${alert.title}: ${response.status}`);
      }

    } catch (error) {
      console.error(`❌ Error sending webhook for ${alert.title}:`, error);
    }
  }

  /**
   * 📊 Get monitoring statistics
   */
  getMonitoringStats(): {
    is_monitoring: boolean;
    last_scan: string;
    processed_opportunities: number;
    scan_interval: number;
  } {
    return {
      is_monitoring: this.isMonitoring,
      last_scan: this.lastScanTime.toISOString(),
      processed_opportunities: this.processedOpportunities.size,
      scan_interval: this.MONITORING_INTERVAL
    };
  }

  /**
   * 🔄 Reset processed opportunities
   */
  resetProcessedOpportunities(): void {
    this.processedOpportunities.clear();
    console.log('🔄 Reset processed opportunities cache');
  }
}

// Export singleton instance
export const realRFPMonitor = new RealRFPMonitor();