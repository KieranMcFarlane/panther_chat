/**
 * 🎯 RFP Storage Service - Supabase-backed storage
 *
 * Canonical storage lives in Supabase. Graph enrichment is optional and should
 * not be required for core RFP ingestion, listing, and analytics.
 */

import { supabase } from '@/lib/supabase-client';
import { buildGraphEntityLookupFilter } from '@/lib/graph-id';

export interface RFPData {
  title: string;
  organization: string;
  entityId: string;
  description?: string;
  estimatedValue?: string;
  deadline?: string;
  source?: string;
  confidence?: number;
  category?: string;
  agentNotes?: any;
  batchId?: string;
  contactInfo?: any;
  competitionInfo?: any;
}

export interface StoredRFP {
  supabaseId: string;
  filePath: string;
  cardData: RFPCardData;
}

export interface RFPCardData {
  id: string;
  title: string;
  organization: string;
  value: string;
  deadline?: string;
  confidence: number;
  status: string;
  priority: string;
  category: string;
  detectedAt: string;
  source: string;
  entityName?: string;
}

export interface RFPDetection {
  rfpId: string;
  entityName: string;
  entityType: string;
  title: string;
  description: string;
  estimatedValue: string;
  submissionDeadline: string;
  keywords: string[];
  priorityLevel: string;
  confidenceScore: number;
  yellowPantherFit: number;
  competitiveAdvantage: string;
  recommendedActions: string[];
  detectedAt: string;
}

export interface RFPStorageResult {
  success: boolean;
  rfpId: string;
  entityId?: string;
  relationshipsCreated?: number;
  error?: string;
}

export class RFPStorageService {
  private isInitialized: boolean = false;

  /**
   * Initialize the storage service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.isInitialized = true;
      console.log('✅ RFPStorageService initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize RFPStorageService:', error);
      throw error;
    }
  }

  /**
   * Save RFP to canonical Supabase storage.
   */
  async saveRFP(rfpData: RFPData): Promise<StoredRFP> {
    await this.initialize();

    try {
      console.log(`💾 Saving RFP: "${rfpData.title}" for ${rfpData.organization}`);

      // 1. Save to Supabase (primary UI storage)
      const supabaseResult = await this.saveToSupabase(rfpData);
      
      // 2. Format for card display
      const cardData = this.formatForCard(supabaseResult, rfpData);
      
      const result: StoredRFP = {
        supabaseId: supabaseResult.id,
        filePath: `/tenders#${supabaseResult.id}`,
        cardData
      };

      console.log(`✅ RFP Saved Successfully:`, {
        supabaseId: result.supabaseId,
        filePath: result.filePath,
        priority: cardData.priority
      });

      return result;

    } catch (error) {
      console.error('❌ Failed to save RFP:', error);
      throw new Error(`RFP storage failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Save RFP to Unified Supabase Table for UI display
   */
  private async saveToSupabase(rfpData: RFPData) {
    // Parse numeric value for sorting
    const valueNumeric = this.parseValue(rfpData.estimatedValue);
    const currency = this.extractCurrency(rfpData.estimatedValue);
    
    const supabaseData = {
      title: rfpData.title,
      organization: rfpData.organization,
      description: rfpData.description || null,
      location: null, // Will be populated if available
      estimated_value: rfpData.estimatedValue || null,
      currency: currency,
      value_numeric: valueNumeric,
      deadline: rfpData.deadline ? new Date(rfpData.deadline).toISOString().split('T')[0] : null,
      detected_at: new Date().toISOString(),
      source: rfpData.source || 'ai-detected', // AI-detected for A2A system
      source_url: null, // Will be populated if available
      category: rfpData.category || 'general',
      subcategory: null, // Will be populated if available
      status: 'detected',
      priority: 'medium', // Will be calculated below
      priority_score: 5, // Will be calculated below
      confidence_score: rfpData.confidence || 0.5,
      confidence: Math.round((rfpData.confidence || 0.5) * 100), // Convert to percentage
      yellow_panther_fit: Math.round((rfpData.confidence || 0.5) * 100), // Map confidence to fit score
      entity_id: rfpData.entityId,
      entity_name: null, // Will be populated from cached_entities
      entity_type: null, // Will be populated from cached_entities
      graph_id: null,
      batch_id: rfpData.batchId || null,
      requirements: null, // Will be populated if available
      agent_notes: rfpData.agentNotes || {},
      contact_info: rfpData.contactInfo || {},
      competition_info: rfpData.competitionInfo || {},
      metadata: {
        original_source: rfpData.source || 'a2a-automation',
        detection_method: 'ai-analysis'
      },
      tags: [], // Will be populated if available
      keywords: [], // Will be extracted from description
      link_status: 'unverified',
      assigned_to: null,
      follow_up_date: null,
      next_steps: null,
      notes: null,
      conversion_stage: 'opportunity'
    };

    const { data, error } = await supabase
      .from('rfp_opportunities_unified')
      .insert(supabaseData)
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      throw new Error(`Supabase storage failed: ${error.message}`);
    }

    // Update entity information from cached_entities if available
    await this.updateEntityInfo(data.id, rfpData.entityId);

    // Calculate and update priority and priority score
    const priority = await this.calculateAndSetUnifiedPriority(data.id, valueNumeric, rfpData.confidence || 0.5, rfpData.deadline);
    data.priority = priority;

    return data;
  }

  /**
   * Calculate and set Unified RFP priority and priority score
   */
  private async calculateAndSetUnifiedPriority(rfpId: string, value: number, confidence: number, deadline?: string): Promise<string> {
    const fitScore = Math.round(confidence * 100); // Map confidence to fit score
    let priority = 'medium';
    let priorityScore = 5;

    // Calculate priority based on multiple factors
    if (confidence > 0.8 && value > 1000000 && fitScore > 80) {
      priority = 'critical';
      priorityScore = 10;
    } else if (confidence > 0.7 && value > 500000 && fitScore > 70) {
      priority = 'high';
      priorityScore = 8;
    } else if (confidence > 0.6 || fitScore > 60) {
      priority = 'medium';
      priorityScore = 6;
    } else {
      priority = 'low';
      priorityScore = 3;
    }

    // Urgency factor - boost priority if deadline is soon
    if (deadline) {
      const daysUntilDeadline = Math.ceil((new Date(deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntilDeadline < 30 && confidence > 0.7) {
        priority = 'critical';
        priorityScore = Math.min(10, priorityScore + 2);
      } else if (daysUntilDeadline < 60 && confidence > 0.6) {
        priority = 'high';
        priorityScore = Math.min(9, priorityScore + 1);
      }
    }

    // Update Supabase with calculated priority and priority score
    try {
      await supabase
        .from('rfp_opportunities_unified')
        .update({ 
          priority, 
          priority_score: priorityScore,
          yellow_panther_fit: fitScore
        })
        .eq('id', rfpId);
    } catch (error) {
      console.warn('Failed to update unified priority:', error);
    }

    return priority;
  }

  /**
   * Update entity information from cached_entities table
   */
  private async updateEntityInfo(rfpId: string, entityId: string) {
    if (!entityId) return;

    try {
      const { data: entityData, error } = await supabase
        .from('cached_entities')
        .select('properties, labels')
        .or(buildGraphEntityLookupFilter(entityId))
        .single();

      if (error || !entityData) {
        console.warn(`Entity ${entityId} not found in cached_entities`);
        return;
      }

      const entityName = entityData.properties?.name || 'Unknown';
      const entityType = entityData.properties?.type || 
                       entityData.properties?.entityType || 
                       (entityData.labels?.includes('Entity') ? 'Entity' : 'Unknown');

      await supabase
        .from('rfp_opportunities_unified')
        .update({
          entity_name: entityName,
          entity_type: entityType
        })
        .eq('id', rfpId);

      console.log(`Updated entity info for RFP ${rfpId}: ${entityName} (${entityType})`);
    } catch (error) {
      console.warn('Failed to update entity info:', error);
    }
  }

  /**
   * Format RFP data for card display
   */
  private formatForCard(supabaseData: any, originalData: RFPData): RFPCardData {
    return {
      id: supabaseData.id,
      title: supabaseData.title,
      organization: supabaseData.organization,
      value: supabaseData.estimated_value || 'Value not specified',
      deadline: supabaseData.deadline,
      confidence: Math.round((supabaseData.confidence_score || 0) * 100),
      status: supabaseData.status || 'detected',
      priority: supabaseData.priority || 'medium',
      category: supabaseData.category || 'general',
      detectedAt: supabaseData.detected_at,
      source: supabaseData.source || 'a2a-automation'
    };
  }

  /**
   * Get RFPs for display in /tenders - UNIFIED TABLE METHOD
   */
  async getRFPs(options: {
    limit?: number;
    status?: string;
    priority?: string;
    category?: string;
    source?: string; // New: filter by source (ai-detected, comprehensive, static)
    orderBy?: 'detected_at' | 'confidence_score' | 'value_numeric' | 'deadline' | 'yellow_panther_fit' | 'priority_score';
    orderDirection?: 'asc' | 'desc';
  } = {}) {
    const {
      limit = 50,
      status,
      priority,
      category,
      source,
      orderBy = 'detected_at',
      orderDirection = 'desc'
    } = options;

    try {
      let query = supabase
        .from('rfp_opportunities_unified')
        .select('*')
        .order(orderBy, { ascending: orderDirection === 'asc' })
        .limit(limit);

      // Apply filters
      if (status) {
        query = query.eq('status', status);
      }
      if (priority) {
        query = query.eq('priority', priority);
      }
      if (category) {
        query = query.eq('category', category);
      }
      if (source) {
        query = query.eq('source', source);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch unified RFPs: ${error.message}`);
      }

      return data || [];

    } catch (error) {
      console.error('Error fetching unified RFPs:', error);
      return [];
    }
  }

  /**
   * Get RFP statistics for dashboard - UNIFIED TABLE METHOD
   */
  async getRFPStatistics() {
    try {
      const { data, error } = await supabase
        .from('rfp_opportunities_unified')
        .select('status, priority, source, confidence_score, yellow_panther_fit, value_numeric, detected_at');

      if (error) throw error;

      const rfps = data || [];
      
      return {
        total: rfps.length,
        byStatus: this.groupBy(rfps, 'status'),
        byPriority: this.groupBy(rfps, 'priority'),
        bySource: this.groupBy(rfps, 'source'), // New: breakdown by source
        avgConfidence: rfps.length > 0 ? rfps.reduce((sum, rfp) => sum + (rfp.confidence_score || 0), 0) / rfps.length : 0,
        avgFitScore: rfps.length > 0 ? rfps.reduce((sum, rfp) => sum + (rfp.yellow_panther_fit || 0), 0) / rfps.length : 0,
        totalValue: rfps.reduce((sum, rfp) => sum + (rfp.value_numeric || 0), 0),
        recentCount: rfps.filter(rfp => {
          const detected = new Date(rfp.detected_at);
          const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          return detected > weekAgo;
        }).length,
        aiDetectedCount: rfps.filter(rfp => rfp.source === 'ai-detected').length,
        comprehensiveCount: rfps.filter(rfp => rfp.source === 'comprehensive').length,
        staticCount: rfps.filter(rfp => rfp.source === 'static').length
      };

    } catch (error) {
      console.error('Error getting unified RFP statistics:', error);
      return {
        total: 0,
        byStatus: {},
        byPriority: {},
        bySource: {},
        avgConfidence: 0,
        avgFitScore: 0,
        totalValue: 0,
        recentCount: 0,
        aiDetectedCount: 0,
        comprehensiveCount: 0,
        staticCount: 0
      };
    }
  }

  /**
   * Update RFP status - UNIFIED TABLE METHOD
   */
  async updateRFPStatus(rfpId: string, status: string, notes?: any) {
    try {
      const updateData: any = { 
        status, 
        updated_at: new Date().toISOString(),
        conversion_stage: this.mapStatusToConversionStage(status)
      };
      
      if (notes) {
        updateData.agent_notes = notes;
      }

      // Update Unified Supabase Table
      const { data, error } = await supabase
        .from('rfp_opportunities_unified')
        .update(updateData)
        .eq('id', rfpId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update unified RFP status: ${error.message}`);
      }

      return data;

    } catch (error) {
      console.error('Error updating unified RFP status:', error);
      throw error;
    }
  }

  /**
   * Map status to conversion stage
   */
  private mapStatusToConversionStage(status: string): string {
    switch (status) {
      case 'new':
      case 'detected':
      case 'analyzing':
        return 'opportunity';
      case 'qualified':
        return 'qualified';
      case 'pursuing':
        return 'pursued';
      case 'won':
        return 'won';
      case 'lost':
        return 'lost';
      default:
        return 'opportunity';
    }
  }

  // Helper methods
  private parseValue(valueStr?: string): number {
    if (!valueStr) return 0;
    const numeric = parseFloat(valueStr.replace(/[^0-9.]/g, ''));
    return isNaN(numeric) ? 0 : numeric;
  }

  private extractCurrency(valueStr?: string): string {
    if (!valueStr) return 'GBP';
    if (valueStr.includes('£')) return 'GBP';
    if (valueStr.includes('$')) return 'USD';
    if (valueStr.includes('€')) return 'EUR';
    return 'GBP';
  }

  private groupBy(array: any[], key: string): Record<string, number> {
    return array.reduce((groups, item) => {
      const value = item[key] || 'unknown';
      groups[value] = (groups[value] || 0) + 1;
      return groups;
    }, {});
  }

  /**
   * Store a detected RFP opportunity in canonical Supabase storage.
   */
  async storeRFP(detection: RFPDetection): Promise<RFPStorageResult> {
    try {
      const actionItems = Array.isArray(detection.recommendedActions)
        ? detection.recommendedActions.filter(Boolean)
        : [];

      const { data, error } = await supabase
        .from('rfp_opportunities_unified')
        .upsert({
          id: detection.rfpId,
          title: detection.title,
          organization: detection.entityName,
          description: detection.description,
          estimated_value: detection.estimatedValue || null,
          currency: this.extractCurrency(detection.estimatedValue),
          value_numeric: this.parseValue(detection.estimatedValue),
          deadline: detection.submissionDeadline ? new Date(detection.submissionDeadline).toISOString().split('T')[0] : null,
          detected_at: detection.detectedAt || new Date().toISOString(),
          source: 'rfp-detection',
          category: detection.entityType || 'general',
          status: 'ACTIVE',
          priority: detection.priorityLevel?.toLowerCase() || 'medium',
          priority_score: this.mapPriorityLevelToScore(detection.priorityLevel),
          confidence_score: detection.confidenceScore || 0,
          confidence: Math.round((detection.confidenceScore || 0) * 100),
          yellow_panther_fit: detection.yellowPantherFit || 0,
          entity_id: detection.rfpId,
          entity_name: detection.entityName,
          entity_type: detection.entityType,
          requirements: actionItems,
          metadata: {
            keywords: detection.keywords || [],
            competitive_advantage: detection.competitiveAdvantage || '',
            recommended_actions: actionItems
          },
          notes: detection.competitiveAdvantage || null,
          conversion_stage: 'opportunity'
        }, { onConflict: 'id' })
        .select('id')
        .single();

      if (error) {
        throw error;
      }

      return {
        success: true,
        rfpId: detection.rfpId,
        entityId: data.id,
        relationshipsCreated: actionItems.length
      };

    } catch (error) {
      console.error('Error storing RFP:', error);
      return {
        success: false,
        rfpId: detection.rfpId,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Store multiple RFPs in batch
   */
  async storeMultipleRFPs(detections: RFPDetection[]): Promise<RFPStorageResult[]> {
    const results = await Promise.allSettled(
      detections.map(detection => this.storeRFP(detection))
    );

    return results.map(result => 
      result.status === 'fulfilled' ? result.value : {
        success: false,
        rfpId: 'unknown',
        error: 'Failed to store RFP'
      }
    );
  }

  /**
   * Get all active RFPs with entity information
   */
  async getActiveRFPs(): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('rfp_opportunities_unified')
        .select('id, title, description, estimated_value, deadline, priority, confidence_score, yellow_panther_fit, metadata, entity_name, entity_type, detected_at')
        .in('status', ['ACTIVE', 'active', 'detected', 'qualified', 'pursuing'])
        .order('priority_score', { ascending: false })
        .order('value_numeric', { ascending: false })
        .order('detected_at', { ascending: false });

      if (error) {
        throw error;
      }

      return (data || []).map((row: any) => ({
        rfpId: row.id,
        title: row.title,
        description: row.description,
        estimatedValue: row.estimated_value,
        submissionDeadline: row.deadline,
        priorityLevel: String(row.priority || 'medium').toUpperCase(),
        confidenceScore: row.confidence_score,
        yellowPantherFit: row.yellow_panther_fit,
        keywords: row.metadata?.keywords || [],
        entityName: row.entity_name,
        entityType: row.entity_type,
        sport: row.entity_type,
        detectedAt: row.detected_at
      }));

    } catch (error) {
      console.error('Error fetching active RFPs:', error);
      return [];
    }
  }

  /**
   * Get recommended actions for a specific RFP
   */
  async getRFPActions(rfpId: string): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('rfp_opportunities_unified')
        .select('metadata')
        .eq('id', rfpId)
        .single();

      if (error) {
        throw error;
      }

      const actions = data?.metadata?.recommended_actions || data?.metadata?.actions || [];
      return actions.map((action: string, index: number) => ({
        actionId: `${rfpId}_action_${index + 1}`,
        action
      }));

    } catch (error) {
      console.error('Error fetching RFP actions:', error);
      return [];
    }
  }

  /**
   * Update RFP status (e.g., when pursued, won, or lost)
   */
  async updateRFPStatus(rfpId: string, status: string, notes?: string): Promise<boolean> {
    try {
      const updateData: Record<string, any> = {
        status,
        updated_at: new Date().toISOString(),
        conversion_stage: this.mapStatusToConversionStage(status)
      };

      if (notes) {
        updateData.notes = notes;
      }

      const { error } = await supabase
        .from('rfp_opportunities_unified')
        .update(updateData)
        .eq('id', rfpId);

      return !error;

    } catch (error) {
      console.error('Error updating RFP status:', error);
      return false;
    }
  }

  /**
   * Get RFP analytics and metrics
   */
  async getRFPAnalytics(): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('rfp_opportunities_unified')
        .select('status, priority, confidence_score, yellow_panther_fit, entity_type');

      if (error) {
        throw error;
      }

      const rows = data || [];
      return {
        totalRFPs: rows.length,
        activeRFPs: rows.filter((row: any) => ['ACTIVE', 'active', 'detected', 'qualified', 'pursuing'].includes(row.status)).length,
        entityTypes: new Set(rows.map((row: any) => row.entity_type).filter(Boolean)).size,
        sportsCovered: new Set(rows.map((row: any) => row.entity_type).filter(Boolean)).size,
        priorityBreakdown: {
          critical: rows.filter((row: any) => String(row.priority || '').toLowerCase() === 'critical').length,
          medium: rows.filter((row: any) => String(row.priority || '').toLowerCase() === 'medium').length,
          low: rows.filter((row: any) => String(row.priority || '').toLowerCase() === 'low').length
        },
        avgConfidence: rows.length > 0 ? rows.reduce((sum: number, row: any) => sum + (row.confidence_score || 0), 0) / rows.length : 0,
        avgFitScore: rows.length > 0 ? rows.reduce((sum: number, row: any) => sum + (row.yellow_panther_fit || 0), 0) / rows.length : 0
      };

    } catch (error) {
      console.error('Error getting RFP analytics:', error);
      return {
        totalRFPs: 0,
        activeRFPs: 0,
        entityTypes: 0,
        sportsCovered: 0,
        priorityBreakdown: { critical: 0, medium: 0, low: 0 },
        avgConfidence: 0,
        avgFitScore: 0
      };
    }
  }

  private mapPriorityLevelToScore(priorityLevel?: string): number {
    switch (String(priorityLevel || '').toUpperCase()) {
      case 'CRITICAL':
        return 10;
      case 'HIGH':
        return 8;
      case 'MEDIUM':
        return 6;
      case 'LOW':
        return 3;
      default:
        return 5;
    }
  }
}

// Singleton instances for easy import
let rfpStorageInstance: RFPStorageService | null = null;

export function getRFPStorageService(): RFPStorageService {
  if (!rfpStorageInstance) {
    rfpStorageInstance = new RFPStorageService();
  }
  return rfpStorageInstance;
}

// Export singleton instance for hybrid storage
export const rfpStorageService = new RFPStorageService();
