/**
 * Keyword Mines System - Continuous Entity Monitoring
 * 
 * This system creates "mines" (webhooks and reasoning agents) that continuously monitor
 * for keyword triggers across all entities and provide intelligent alerts with multi-channel
 * notifications and detailed logging.
 */

import { Neo4jService } from '@/lib/neo4j';
import { supabase } from '@/lib/supabase-client';
import { Anthropic } from '@anthropic-ai/sdk';
import { z } from 'zod';
import { OptimizedPrompts, OptimizedPromptConfig } from '@/lib/optimized-prompts';
import { RFPOpportunityDetector, RFPKeywordGenerator } from '@/lib/rfp-opportunity-detector';
import { continuousReasoningService } from './ContinuousReasoningService';

interface KeywordMine {
  id: string;
  entity_id: string;
  entity_name: string;
  entity_type: string;
  sport?: string;
  keywords: string[];
  monitoring_sources: MonitoringSource[];
  notification_channels: NotificationChannel[];
  alert_threshold: number;
  reasoning_context: string;
  is_active: boolean;
  created_at: string;
  last_triggered?: string;
}

interface MonitoringSource {
  type: 'linkedin' | 'news' | 'web' | 'social' | 'procurement' | 'job_postings';
  keywords: string[];
  frequency: 'realtime' | 'hourly' | 'daily';
  weight: number; // 1-10 importance weighting
}

interface NotificationChannel {
  type: 'pwa' | 'teams' | 'slack' | 'email' | 'webhook';
  config: Record<string, any>;
  enabled: boolean;
}

interface AlertDetection {
  id: string;
  mine_id: string;
  entity_id: string;
  entity_name: string;
  detection_type: string;
  keywords_matched: string[];
  content_snippet: string;
  source_url: string;
  confidence_score: number;
  reasoning_analysis: string;
  detected_at: string;
  notification_sent: boolean;
}

interface ReasoningResult {
  relevance_score: number; // 0-100
  urgency_level: 'low' | 'medium' | 'high' | 'critical';
  business_impact: string;
  recommended_actions: string[];
  similar_opportunities: string[];
  competitive_threats: string[];
  rfp_opportunities?: {
    detected: boolean;
    opportunities: Array<{
      type: string;
      confidence: number;
      urgency: string;
      estimated_value?: string;
      timeline?: string;
    }>;
    summary: string;
  };
  yellow_panther_intelligence?: {
    entity_score: number;
    entity_tier: string;
    target_value: string;
    is_high_value: boolean;
    recommended_approach: 'premium partnership' | 'strategic collaboration' | 'standard engagement';
    priority_keywords: string[];
  };
}

// Validation schemas using Zod
const KeywordMineSchema = z.object({
  entity_name: z.string().min(1).max(200),
  entity_type: z.enum(['Entity', 'Organization', 'Person', 'RFP']),
  sport: z.string().optional(),
  country: z.string().optional(),
  priority_score: z.number().min(0).max(10).optional(),
  keywords: z.array(z.string().min(1)).max(50),
  monitoring_sources: z.array(z.object({
    type: z.enum(['linkedin', 'news', 'web', 'social', 'procurement', 'job_postings']),
    keywords: z.array(z.string()).max(20),
    frequency: z.enum(['realtime', 'hourly', 'daily']),
    weight: z.number().min(1).max(10)
  })).max(10),
  alert_threshold: z.number().min(0).max(100),
  notification_channels: z.array(z.object({
    type: z.enum(['pwa', 'teams', 'slack', 'email', 'webhook']),
    config: z.record(z.any()),
    enabled: z.boolean()
  })).max(10)
});

const WebhookDetectionSchema = z.object({
  source: z.enum(['linkedin', 'news', 'procurement', 'web', 'api']),
  content: z.string().min(1).max(5000),
  url: z.string().url().optional(),
  keywords: z.array(z.string().min(1)).max(50),
  timestamp: z.string().datetime(),
  confidence: z.number().min(0).max(1).optional(),
  entity_id: z.string().optional(),
  metadata: z.record(z.any()).optional()
});

export class KeywordMinesService {
  private neo4jService: Neo4jService;
  private anthropic: Anthropic;
  private monitoringIntervals: Map<string, NodeJS.Timeout> = new Map();
  private totalEntities = 4422; // Updated from 3,311 to 4,422

  constructor() {
    this.neo4jService = new Neo4jService();
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || ''
    });
  }

  /**
   * Validate keyword mine data
   */
  validateKeywordMineData(data: any): any {
    try {
      return KeywordMineSchema.parse(data);
    } catch (error) {
      console.error('❌ Invalid keyword mine data:', error);
      throw new Error(`Invalid keyword mine data: ${error.message}`);
    }
  }

  /**
   * Validate webhook detection data
   */
  validateWebhookDetection(data: any): any {
    try {
      return WebhookDetectionSchema.parse(data);
    } catch (error) {
      console.error('❌ Invalid webhook detection:', error);
      throw new Error(`Invalid webhook detection: ${error.message}`);
    }
  }

  /**
   * Initialize keyword mines for all entities in the system
   */
  async initializeMinesForAllEntities(): Promise<{ created: number; updated: number; failed: number }> {
    const results = { created: 0, updated: 0, failed: 0 };

    try {
      await this.neo4jService.initialize();
      const session = this.neo4jService.getDriver().session();

      try {
        // Get all entities that should be monitored
        const result = await session.run(`
          MATCH (n)
          WHERE n.name IS NOT NULL 
            AND (n:Entity OR n:Organization OR n:Person OR n:RFP OR n:DecisionMaker)
          RETURN n, labels(n) as labels
          ORDER BY n.priorityScore DESC, n.name ASC
        `);

        for (const record of result.records) {
          const node = record.get('n');
          const labels = record.get('labels');
          
          try {
            const mine = await this.createOrUpdateMine(node, labels);
            if (mine.isNew) {
              results.created++;
            } else {
              results.updated++;
            }
          } catch (error) {
            console.error(`Failed to create mine for ${node.properties.name}:`, error);
            results.failed++;
          }
        }

        console.log(`🚀 Mines initialization complete for ${this.totalEntities} entities: ${results.created} created, ${results.updated} updated, ${results.failed} failed`);
        return results;

      } finally {
        await session.close();
      }
    } catch (error) {
      console.error('❌ Failed to initialize mines:', error);
      throw error;
    }
  }

  /**
   * Create or update a keyword mine for a specific entity
   */
  private async createOrUpdateMine(node: any, labels: string[]): Promise<{ mine: KeywordMine; isNew: boolean }> {
    const entity = node.properties;
    const entityId = node.identity.toString();
    const entityName = entity.name || 'Unknown';
    const entityType = this.determineEntityType(labels, entity);
    const sport = entity.sport || null;

    // Generate contextual keywords for this entity
    const keywords = await this.generateEntityKeywords(entity, labels, sport);
    
    // Create monitoring sources configuration
    const monitoringSources = this.createMonitoringSources(entity, keywords);
    
    // Configure notification channels based on entity importance
    const notificationChannels = await this.createNotificationChannels(entity);
    
    // Determine alert threshold based on entity priority
    const alertThreshold = this.determineAlertThreshold(entity, labels);
    
    // Generate reasoning context
    const reasoningContext = await this.generateReasoningContext(entity, keywords, labels);

    const mine: KeywordMine = {
      id: `mine_${entityId}`,
      entity_id: entityId,
      entity_name: entityName,
      entity_type: entityType,
      sport: sport || undefined,
      keywords,
      monitoring_sources: monitoringSources,
      notification_channels: notificationChannels,
      alert_threshold: alertThreshold,
      reasoning_context: reasoningContext,
      is_active: true,
      created_at: new Date().toISOString()
    };

    // Store in Supabase
    const { data: existingMine } = await supabase
      .from('keyword_mines')
      .select('*')
      .eq('entity_id', entityId)
      .single();

    if (existingMine) {
      // Update existing mine
      const { error } = await supabase
        .from('keyword_mines')
        .update({
          keywords,
          monitoring_sources: monitoringSources,
          notification_channels: notificationChannels,
          alert_threshold: alertThreshold,
          reasoning_context: reasoningContext,
          updated_at: new Date().toISOString()
        })
        .eq('entity_id', entityId);

      if (error) throw error;
      return { mine: { ...existingMine, ...mine }, isNew: false };
    } else {
      // Create new mine
      const { error } = await supabase
        .from('keyword_mines')
        .insert(mine);

      if (error) throw error;
      return { mine, isNew: true };
    }
  }

  /**
   * Generate intelligent keywords for entity monitoring
   */
  private async generateEntityKeywords(entity: any, labels: string[], sport?: string | null): Promise<string[]> {
    const baseKeywords = new Set<string>();
    
    // Entity name variations
    const name = entity.name || '';
    baseKeywords.add(name.toLowerCase());
    baseKeywords.add(name.replace(/\s+/g, ''));
    
    // Type-based keywords
    const entityType = this.determineEntityType(labels, entity);
    baseKeywords.add(entityType.toLowerCase());
    
    // Sport-specific keywords
    if (sport && sport !== '') {
      baseKeywords.add(sport.toLowerCase());
      baseKeywords.add(`${sport} ${entityType}`.toLowerCase());
    }
    
    // Business keywords
    const businessKeywords = [
      'digital transformation', 'fan engagement', 'ticketing', 'crm', 
      'analytics', 'mobile app', 'cloud', 'infrastructure', 'partnership',
      'sponsorship', 'broadcasting', 'streaming', 'e-commerce', 'merchandising'
    ];
    businessKeywords.forEach(keyword => baseKeywords.add(keyword));
    
    // Technology keywords
    const techKeywords = [
      'ai', 'machine learning', 'data analytics', 'cloud migration', 'api',
      'integration', 'platform', 'software', 'technology', 'innovation'
    ];
    techKeywords.forEach(keyword => baseKeywords.add(keyword));
    
    // Add comprehensive RFP/tender detection keywords with Yellow Panther scoring
    const entityScore = RFPOpportunityDetector.getYellowPantherEntityScore(name, entityType);
    const rfpKeywords = RFPKeywordGenerator.generateRFPKeywords(
      name, 
      entityType, 
      sport || 'sports'
    );
    
    // Add Yellow Panther priority keywords based on entity score
    entityScore.priority_keywords.forEach(keyword => baseKeywords.add(keyword.toLowerCase()));
    rfpKeywords.forEach(keyword => baseKeywords.add(keyword.toLowerCase()));

    // Generate contextual keywords using Claude
    try {
      const contextualPrompt = OptimizedPrompts.getEntityContextualKeywordsPrompt(
        name,
        entityType,
        sport || 'N/A',
        Array.from(baseKeywords)
      );

      const response = await this.anthropic.messages.create({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 500,
        messages: [
          {
            role: 'user',
            content: contextualPrompt
          }
        ]
      });

      const responseText = response.content[0].type === 'text' ? response.content[0].text : '[]';
      // Clean response text - remove markdown code blocks if present
      const cleanText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const contextualKeywords = JSON.parse(cleanText);
      contextualKeywords.forEach((keyword: string) => baseKeywords.add(keyword.toLowerCase()));
      
    } catch (error) {
      console.warn('Failed to generate contextual keywords:', error);
    }

    // Return comprehensive keyword set for all 4,422 entities
    return Array.from(baseKeywords).slice(0, 100); // Increased limit for RFP coverage
  }

  /**
   * Create monitoring sources configuration
   */
  private createMonitoringSources(entity: any, keywords: string[]): MonitoringSource[] {
    const sources: MonitoringSource[] = [
      {
        type: 'linkedin',
        keywords: keywords.slice(0, 10), // Top 10 keywords for LinkedIn
        frequency: 'realtime',
        weight: 10
      },
      {
        type: 'news',
        keywords: keywords.slice(0, 15),
        frequency: 'hourly',
        weight: 8
      },
      {
        type: 'procurement',
        keywords: [
          'tender', 'rfp', 'procurement', 'contract', 'bidding', 'proposal', 'quotation',
          'request for proposal', 'request for tender', 'invitation to tender', 'itt',
          'request for quotation', 'rfq', 'expression of interest', 'eoi',
          'pre-qualification', 'vendor registration', 'supplier portal',
          ...keywords.filter(k => 
            RFPOpportunityDetector.RFPTERMINOLOGY.some(term => 
              term.terms.some(t => k.includes(t.toLowerCase()))
            )
          ).slice(0, 15),
          ...keywords.slice(0, 8)
        ],
        frequency: 'daily',
        weight: 9
      },
      {
        type: 'job_postings',
        keywords: ['hiring', 'job', 'vacancy', 'role', 'position', ...keywords.slice(0, 5)],
        frequency: 'daily',
        weight: 6
      }
    ];

    // Add web monitoring for high-value entities
    if (entity.priorityScore && entity.priorityScore > 7) {
      sources.push({
        type: 'web',
        keywords: keywords.slice(0, 20),
        frequency: 'hourly',
        weight: 7
      });
    }

    return sources;
  }

  /**
   * Create notification channels based on entity importance
   */
  private async createNotificationChannels(entity: any): Promise<NotificationChannel[]> {
    const channels: NotificationChannel[] = [
      {
        type: 'pwa',
        config: {
          enabled: true,
          priority: 'realtime'
        },
        enabled: true
      }
    ];

    // High priority entities get all channels
    const isHighPriority = entity.priorityScore && entity.priorityScore > 7;
    const isMediumPriority = entity.priorityScore && entity.priorityScore > 4;

    if (isHighPriority) {
      channels.push(
        {
          type: 'teams',
          config: {
            webhook_url: process.env.TEAMS_WEBHOOK_URL,
            channel: '#alerts'
          },
          enabled: true
        },
        {
          type: 'slack',
          config: {
            webhook_url: process.env.SLACK_WEBHOOK_URL,
            channel: '#alerts'
          },
          enabled: true
        }
      );
    } else if (isMediumPriority) {
      channels.push({
        type: 'email',
        config: {
          recipients: ['alerts@company.com'],
          template: 'entity_alert'
        },
        enabled: true
      });
    }

    return channels;
  }

  /**
   * Process detected content and trigger alerts
   */
  async processDetection(mineId: string, detectionData: {
    content: string;
    source_url: string;
    source_type: string;
    keywords_matched: string[];
  }): Promise<AlertDetection | null> {
    try {
      // Get mine configuration
      const { data: mine } = await supabase
        .from('keyword_mines')
        .select('*')
        .eq('id', mineId)
        .single();

      if (!mine || !mine.is_active) {
        return null;
      }

      // Perform reasoning analysis
      const reasoningResult = await this.performReasoningAnalysis(
        detectionData.content,
        mine.keywords,
        mine.reasoning_context
      );

      // Check if detection meets threshold
      if (reasoningResult.relevance_score < mine.alert_threshold) {
        return null;
      }

      // Create alert detection record
      const alertDetection: AlertDetection = {
        id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        mine_id: mineId,
        entity_id: mine.entity_id,
        entity_name: mine.entity_name,
        detection_type: detectionData.source_type,
        keywords_matched: detectionData.keywords_matched,
        content_snippet: detectionData.content.substring(0, 500),
        source_url: detectionData.source_url,
        confidence_score: reasoningResult.relevance_score,
        reasoning_analysis: JSON.stringify(reasoningResult),
        detected_at: new Date().toISOString(),
        notification_sent: false
      };

      // Store in database
      const { error } = await supabase
        .from('alert_detections')
        .insert(alertDetection);

      if (error) throw error;

      // Send notifications
      await this.sendNotifications(alertDetection, mine, reasoningResult);

      return alertDetection;

    } catch (error) {
      console.error('❌ Failed to process detection:', error);
      return null;
    }
  }

  /**
   * Perform AI-powered reasoning analysis on detected content
   */
  private async performReasoningAnalysis(
    content: string,
    keywords: string[],
    reasoningContext: string
  ): Promise<ReasoningResult> {
    try {
      // Enhanced analysis with RFP opportunity detection
      const entityName = reasoningContext.split('\n')[0] || 'unknown entity';
      const entityScore = RFPOpportunityDetector.getYellowPantherEntityScore(entityName, 'sports organization');
      const opportunityAnalysis = RFPOpportunityDetector.generateOpportunityAnalysis(content, entityName);

      // Use optimized webhook analysis prompt with RFP context
      const promptConfig: Partial<OptimizedPromptConfig> = {
        temperature: 0.1,
        maxTokens: 800,
        verbosity: 'concise'
      };

      const optimizedPrompt = OptimizedPrompts.getOptimizedWebhookAnalysisPrompt(
        content + '\n\nOpportunity Analysis: ' + JSON.stringify(opportunityAnalysis.summary),
        keywords,
        reasoningContext,
        promptConfig
      );

      const response = await this.anthropic.messages.create({
        model: 'claude-3-sonnet-20240229',
        max_tokens: promptConfig.maxTokens || 800,
        temperature: promptConfig.temperature || 0.1,
        messages: [
          {
            role: 'user',
            content: optimizedPrompt
          }
        ]
      });

      const responseText = response.content[0].type === 'text' ? response.content[0].text : '{}';
      // Clean response text - remove markdown code blocks if present
      const cleanText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const analysis = JSON.parse(cleanText);
      
      // Enhance analysis with Yellow Panther RFP intelligence
      const enhancedAnalysis: ReasoningResult = {
        ...analysis,
        rfp_opportunities: {
          detected: opportunityAnalysis.opportunities.length > 0,
          opportunities: opportunityAnalysis.opportunities.map(opp => ({
            type: opp.type,
            confidence: opp.confidence,
            urgency: opp.urgency,
            estimated_value: opp.estimatedValue || 'To be determined',
            timeline: opp.timeline || 'To be determined'
          })),
          summary: opportunityAnalysis.summary
        },
        yellow_panther_intelligence: {
          entity_score: entityScore.score,
          entity_tier: entityScore.tier,
          target_value: entityScore.target_value,
          is_high_value: entityScore.score >= 85,
          recommended_approach: entityScore.score >= 90 ? 'premium partnership' : 
                              entityScore.score >= 80 ? 'strategic collaboration' : 'standard engagement',
          priority_keywords: entityScore.priority_keywords
        }
      };

      return enhancedAnalysis;

    } catch (error) {
      console.error('❌ Reasoning analysis failed:', error);
      return {
        relevance_score: 50,
        urgency_level: 'medium',
        business_impact: 'Analysis failed - manual review required',
        recommended_actions: ['Review content manually'],
        similar_opportunities: [],
        competitive_threats: []
      };
    }
  }

  /**
   * Send notifications through configured channels
   */
  private async sendNotifications(
    detection: AlertDetection,
    mine: KeywordMine,
    reasoning: ReasoningResult
  ): Promise<void> {
    for (const channel of mine.notification_channels) {
      if (!channel.enabled) continue;

      try {
        switch (channel.type) {
          case 'pwa':
            await this.sendPWANotification(detection, reasoning);
            break;
          case 'teams':
            await this.sendTeamsNotification(detection, reasoning, channel.config);
            break;
          case 'slack':
            await this.sendSlackNotification(detection, reasoning, channel.config);
            break;
          case 'email':
            await this.sendEmailNotification(detection, reasoning, channel.config);
            break;
          case 'webhook':
            await this.sendWebhookNotification(detection, reasoning, channel.config);
            break;
        }
      } catch (error) {
        console.error(`❌ Failed to send ${channel.type} notification:`, error);
      }
    }

    // Update detection record
    await supabase
      .from('alert_detections')
      .update({ notification_sent: true })
      .eq('id', detection.id);
  }

  /**
   * Send PWA notification (stored in database for frontend polling)
   */
  private async sendPWANotification(detection: AlertDetection, reasoning: ReasoningResult): Promise<void> {
    const notification = {
      id: `pwa_${detection.id}`,
      title: `🚨 ${detection.entity_name} Alert`,
      body: `${reasoning.business_impact.substring(0, 100)}...`,
      data: {
        detection_id: detection.id,
        entity_id: detection.entity_id,
        urgency: reasoning.urgency_level,
        score: reasoning.relevance_score,
        source_url: detection.source_url
      },
      icon: '/notification-icon.png',
      timestamp: new Date().toISOString(),
      read: false
    };

    await supabase
      .from('pwa_notifications')
      .insert(notification);
  }

  /**
   * Send Teams notification
   */
  private async sendTeamsNotification(
    detection: AlertDetection,
    reasoning: ReasoningResult,
    config: any
  ): Promise<void> {
    const message = {
      "@type": "MessageCard",
      "@context": "http://schema.org/extensions",
      "themeColor": this.getUrgencyColor(reasoning.urgency_level),
      "summary": `Alert: ${detection.entity_name}`,
      "sections": [{
        "activityTitle": `🚨 ${detection.entity_name} - ${reasoning.urgency_level.toUpperCase()}`,
        "activitySubtitle": `Relevance Score: ${reasoning.relevance_score}/100`,
        "facts": [
          { "name": "Entity", "value": detection.entity_name },
          { "name": "Detection Type", "value": detection.detection_type },
          { "name": "Business Impact", "value": reasoning.business_impact },
          { "name": "Keywords Matched", "value": detection.keywords_matched.join(', ') }
        ],
        "markdown": true
      }],
      "potentialAction": [{
        "@type": "OpenUri",
        "name": "View Details",
        "targets": [{ "os": "default", "uri": detection.source_url }]
      }]
    };

    // Send to Teams webhook
    await fetch(config.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    });
  }

  /**
   * Send Slack notification
   */
  private async sendSlackNotification(
    detection: AlertDetection,
    reasoning: ReasoningResult,
    config: any
  ): Promise<void> {
    const message = {
      channel: config.channel,
      text: `🚨 *${detection.entity_name}* - ${reasoning.urgency_level.toUpperCase()}`,
      attachments: [{
        color: this.getUrgencyColor(reasoning.urgency_level),
        fields: [
          { title: "Relevance Score", value: `${reasoning.relevance_score}/100`, short: true },
          { title: "Detection Type", value: detection.detection_type, short: true },
          { title: "Business Impact", value: reasoning.business_impact, short: false },
          { title: "Keywords Matched", value: detection.keywords_matched.join(', '), short: false }
        ],
        actions: [{
          type: "button",
          text: "View Source",
          url: detection.source_url
        }]
      }]
    };

    // Send to Slack webhook
    await fetch(config.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    });
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(
    detection: AlertDetection,
    reasoning: ReasoningResult,
    config: any
  ): Promise<void> {
    // Implementation would depend on your email service (SendGrid, etc.)
    console.log(`📧 Email notification sent to ${config.recipients.join(', ')}`);
  }

  /**
   * Send webhook notification
   */
  private async sendWebhookNotification(
    detection: AlertDetection,
    reasoning: ReasoningResult,
    config: any
  ): Promise<void> {
    const payload = {
      detection,
      reasoning,
      timestamp: new Date().toISOString()
    };

    await fetch(config.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  }

  /**
   * Get recent detections for live monitoring
   */
  async getRecentDetections(filters: {
    limit?: number;
    entity_id?: string;
    urgency_level?: string;
    hours?: number;
  } = {}): Promise<AlertDetection[]> {
    let query = supabase
      .from('alert_detections')
      .select(`
        *,
        keyword_mines!inner(
          entity_name,
          entity_type,
          sport
        )
      `)
      .order('detected_at', { ascending: false })
      .limit(filters.limit || 50);

    if (filters.entity_id) {
      query = query.eq('entity_id', filters.entity_id);
    }

    if (filters.hours) {
      const cutoff = new Date();
      cutoff.setHours(cutoff.getHours() - filters.hours);
      query = query.gte('detected_at', cutoff.toISOString());
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  }

  /**
   * Helper methods
   */
  private determineEntityType(labels: string[], entity: any): string {
    if (labels.includes('RFP') || labels.includes('OpportunityRFP')) return 'RFP';
    if (labels.includes('Person')) return 'Person';
    if (labels.includes('Country')) return 'Country';
    if (labels.includes('Sport')) return 'Sport';
    if (entity.type) return entity.type;
    return 'Entity';
  }

  private determineAlertThreshold(entity: any, labels: string[]): number {
    const baseThreshold = 60;
    const priorityBonus = entity.priorityScore ? entity.priorityScore * 3 : 0;
    const typeBonus = labels.includes('RFP') ? 15 : 0;
    const sportBonus = entity.sport ? 5 : 0;
    
    return Math.min(95, baseThreshold + priorityBonus + typeBonus + sportBonus);
  }

  private async generateReasoningContext(entity: any, keywords: string[], labels: string[]): Promise<string> {
    return `Entity: ${entity.name} (${this.determineEntityType(labels, entity)})
    Sport: ${entity.sport || 'N/A'}
    Type: ${entity.type || 'N/A'}
    Priority Score: ${entity.priorityScore || 'N/A'}
    Monitoring Keywords: ${keywords.slice(0, 10).join(', ')}
    
    Business Context: Sports organization monitoring for technology partnerships, 
    procurement opportunities, and market intelligence. Focus on digital transformation,
    fan engagement, ticketing systems, and data analytics opportunities.`;
  }

  private getUrgencyColor(urgency: string): string {
    switch (urgency) {
      case 'critical': return 'FF0000';
      case 'high': return 'FF6600';
      case 'medium': return 'FFAA00';
      case 'low': return '00AA00';
      default: return '888888';
    }
  }
}

// Export singleton
export const keywordMinesService = new KeywordMinesService();