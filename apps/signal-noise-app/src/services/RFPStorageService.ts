/**
 * 🎯 RFP Storage Service - Hybrid Supabase + Neo4j Storage
 * 
 * This service provides intelligent RFP storage across multiple systems:
 * - Supabase: Primary storage for UI cards and real-time display in /tenders
 * - Neo4j: Relationship mapping and knowledge graph integration
 * - MCP Integration: Both storage systems accessible via MCP tools
 */

import { supabase } from '@/lib/supabase-client';

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
  neo4jId?: string;
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
  private neo4j: any;
  private isInitialized: boolean = false;

  constructor(neo4jService?: any) {
    this.neo4j = neo4jService;
  }

  /**
   * Initialize the storage service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      if (this.neo4j) {
        await this.neo4j.initialize();
      }
      this.isInitialized = true;
      console.log('✅ RFPStorageService initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize RFPStorageService:', error);
      throw error;
    }
  }

  /**
   * Save RFP to both Supabase (UI) and Neo4j (relationships) - NEW HYBRID METHOD
   */
  async saveRFP(rfpData: RFPData): Promise<StoredRFP> {
    await this.initialize();

    try {
      console.log(`💾 Saving RFP: "${rfpData.title}" for ${rfpData.organization}`);

      // 1. Save to Supabase (primary UI storage)
      const supabaseResult = await this.saveToSupabase(rfpData);
      
      // 2. Save to Neo4j (relationship mapping) - if available
      let neo4jResult = null;
      if (this.neo4j) {
        neo4jResult = await this.saveToNeo4j(rfpData, supabaseResult.id);
      }
      
      // 3. Format for card display
      const cardData = this.formatForCard(supabaseResult, rfpData);
      
      const result: StoredRFP = {
        supabaseId: supabaseResult.id,
        neo4jId: neo4jResult?.rfpId,
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
      neo4j_id: null, // Will be set after Neo4j creation
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
   * Save RFP to Neo4j for relationship mapping (Updated for Unified System)
   */
  private async saveToNeo4j(rfpData: RFPData, supabaseId: string) {
    try {
      const session = this.neo4j.getDriver().session();
      const rfpId = `rfp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      try {
        // Create or update the entity if it doesn't exist
        const entityResult = await session.run(`
          MATCH (e:Entity {id: $entityId})
          RETURN e
        `, {
          entityId: rfpData.entityId
        });

        if (entityResult.records.length === 0) {
          console.warn(`Entity ${rfpData.entityId} not found in Neo4j, skipping relationship creation`);
          return null;
        }

        // Create the RFP node with unified structure
        const rfpResult = await session.run(`
          CREATE (rfp:RFP {
            id: $rfpId,
            title: $title,
            organization: $organization,
            description: $description,
            estimatedValue: $estimatedValue,
            deadline: $deadline,
            confidence: $confidence,
            source: $source,
            supabaseId: $supabaseId,
            detectedAt: datetime(),
            status: 'detected',
            category: $category,
            subcategory: $subcategory,
            priority: $priority,
            priorityScore: $priorityScore,
            yellowPantherFit: $yellowPantherFit,
            batchId: $batchId,
            agentNotes: $agentNotes,
            contactInfo: $contactInfo,
            competitionInfo: $competitionInfo,
            conversionStage: $conversionStage
          })
          RETURN rfp
        `, {
          rfpId: rfpId,
          title: rfpData.title,
          organization: rfpData.organization,
          description: rfpData.description || '',
          estimatedValue: rfpData.estimatedValue || '',
          deadline: rfpData.deadline || null,
          confidence: rfpData.confidence || 0.5,
          source: rfpData.source || 'ai-detected',
          supabaseId: supabaseId,
          category: rfpData.category || 'general',
          subcategory: null, // Will be populated if available
          priority: 'medium', // Will be calculated
          priorityScore: 5, // Will be calculated
          yellowPantherFit: Math.round((rfpData.confidence || 0.5) * 100),
          batchId: rfpData.batchId || null,
          agentNotes: rfpData.agentNotes || {},
          contactInfo: rfpData.contactInfo || {},
          competitionInfo: rfpData.competitionInfo || {},
          conversionStage: 'opportunity'
        });

        // Create relationship between entity and RFP
        await session.run(`
          MATCH (e:Entity {id: $entityId})
          MATCH (rfp:RFP {id: $rfpId})
          MERGE (e)-[:HAS_RFP {detectedAt: datetime()}]->(rfp)
        `, {
          entityId: rfpData.entityId,
          rfpId: rfpId
        });

        // Update Supabase record with Neo4j ID
        await supabase
          .from('rfp_opportunities_unified')
          .update({ neo4j_id: rfpId })
          .eq('id', supabaseId);

        console.log(`🔗 Neo4j relationship created: ${rfpData.entityId} -> HAS_RFP -> ${rfpId}`);
        return { rfpId };

      } finally {
        await session.close();
      }

    } catch (neo4jError) {
      console.warn('⚠️ Neo4j storage failed (continuing with Supabase only):', neo4jError);
      return null; // Continue without failing the entire operation
    }
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
        .eq('neo4j_id', entityId)
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

      // Also update Neo4j if available
      if (this.neo4j) {
        try {
          const session = this.neo4j.getDriver().session();
          try {
            await session.run(
              'MATCH (rfp:RFP {supabaseId: $rfpId}) SET rfp.status = $status, rfp.conversionStage = $conversionStage RETURN rfp',
              { rfpId, status, conversionStage: this.mapStatusToConversionStage(status) }
            );
          } finally {
            await session.close();
          }
        } catch (neo4jError) {
          console.warn('Failed to update Neo4j status:', neo4jError);
        }
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
   * Store a detected RFP opportunity in Neo4j
   */
  async storeRFP(detection: RFPDetection): Promise<RFPStorageResult> {
    const session = this.neo4j.getDriver().session();
    try {
      // Create or update the entity if it doesn't exist
      const entityResult = await session.run(`
        MERGE (e:Entity {name: $entityName})
        ON CREATE SET 
          e.type = $entityType,
          e.last_updated = datetime(),
          e.created_at = COALESCE(e.created_at, datetime()),
          e.enrichmentStatus = 'RFP_DETECTED'
        ON MATCH SET 
          e.last_updated = datetime(),
          e.enrichmentStatus = 'RFP_DETECTED'
        RETURN e
      `, {
        entityName: detection.entityName,
        entityType: detection.entityType
      });

      const entity = entityResult.records[0].get('e');

      // Create the RFP node
      const rfpResult = await session.run(`
        MERGE (r:RFP {id: $rfpId})
        SET 
          r.title = $title,
          r.description = $description,
          r.estimatedValue = $estimatedValue,
          r.submissionDeadline = $submissionDeadline,
          r.priorityLevel = $priorityLevel,
          r.confidenceScore = $confidenceScore,
          r.yellowPantherFit = $yellowPantherFit,
          r.competitiveAdvantage = $competitiveAdvantage,
          r.detectedAt = datetime($detectedAt),
          r.status = 'ACTIVE',
          r.keywords = $keywords,
          r.last_updated = datetime(),
          r.created_at = COALESCE(r.created_at, datetime())
        RETURN r
      `, {
        rfpId: detection.rfpId,
        title: detection.title,
        description: detection.description,
        estimatedValue: detection.estimatedValue,
        submissionDeadline: detection.submissionDeadline,
        priorityLevel: detection.priorityLevel,
        confidenceScore: detection.confidenceScore,
        yellowPantherFit: detection.yellowPantherFit,
        competitiveAdvantage: detection.competitiveAdvantage,
        detectedAt: detection.detectedAt,
        keywords: detection.keywords
      });

      const rfp = rfpResult.records[0].get('r');

      // Create relationship between entity and RFP
      await session.run(`
        MATCH (e:Entity {name: $entityName})
        MATCH (r:RFP {id: $rfpId})
        MERGE (e)-[:ISSUED_RFP {detectedAt: datetime($detectedAt)}]->(r)
      `, {
        entityName: detection.entityName,
        rfpId: detection.rfpId,
        detectedAt: detection.detectedAt
      });

      // Create recommended actions
      let relationshipsCreated = 1; // Entity-RFP relationship
      for (let i = 0; i < detection.recommendedActions.length; i++) {
        await session.run(`
          MERGE (a:RecommendedAction {id: $actionId})
          SET a.action = $actionText,
              a.created_at = COALESCE(a.created_at, datetime())
        `, {
          actionId: `${detection.rfpId}_action_${i + 1}`,
          actionText: detection.recommendedActions[i]
        });

        await session.run(`
          MATCH (r:RFP {id: $rfpId})
          MATCH (a:RecommendedAction {id: $actionId})
          MERGE (r)-[:REQUIRES_ACTION]->(a)
        `, {
          rfpId: detection.rfpId,
          actionId: `${detection.rfpId}_action_${i + 1}`
        });

        relationshipsCreated++;
      }

      // Add RFP to appropriate sport/domain categories
      await session.run(`
        MATCH (r:RFP {id: $rfpId})
        MATCH (e:Entity {name: $entityName})
        WITH r, e, e.sport as sport
        CALL apoc.create.addLabels(r, [CASE WHEN sport IS NOT NULL THEN 'RFP_' + sport ELSE 'RFP_General' END]) YIELD node
        RETURN node
      `, {
        rfpId: detection.rfpId,
        entityName: detection.entityName
      });

      return {
        success: true,
        rfpId: detection.rfpId,
        entityId: entity.identity.toString(),
        relationshipsCreated: relationshipsCreated + 1
      };

    } catch (error) {
      console.error('Error storing RFP:', error);
      return {
        success: false,
        rfpId: detection.rfpId,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    } finally {
      await session.close();
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
    const session = this.neo4j.getDriver().session();
    try {
      const result = await session.run(`
        MATCH (e:Entity)-[:ISSUED_RFP]->(r:RFP {status: 'ACTIVE'})
        RETURN 
          r.id as rfpId,
          r.title as title,
          r.description as description,
          r.estimatedValue as estimatedValue,
          r.submissionDeadline as submissionDeadline,
          r.priorityLevel as priorityLevel,
          r.confidenceScore as confidenceScore,
          r.yellowPantherFit as yellowPantherFit,
          r.keywords as keywords,
          e.name as entityName,
          e.type as entityType,
          e.sport as sport,
          r.detectedAt as detectedAt
        ORDER BY 
          r.priorityLevel DESC,
          r.estimatedValue DESC,
          r.detectedAt DESC
      `);

      return result.records.map(record => ({
        rfpId: record.get('rfpId'),
        title: record.get('title'),
        description: record.get('description'),
        estimatedValue: record.get('estimatedValue'),
        submissionDeadline: record.get('submissionDeadline'),
        priorityLevel: record.get('priorityLevel'),
        confidenceScore: record.get('confidenceScore'),
        yellowPantherFit: record.get('yellowPantherFit'),
        keywords: record.get('keywords'),
        entityName: record.get('entityName'),
        entityType: record.get('entityType'),
        sport: record.get('sport'),
        detectedAt: record.get('detectedAt')
      }));

    } finally {
      await session.close();
    }
  }

  /**
   * Get recommended actions for a specific RFP
   */
  async getRFPActions(rfpId: string): Promise<any[]> {
    const session = this.neo4j.getDriver().session();
    try {
      const result = await session.run(`
        MATCH (r:RFP {id: $rfpId})-[:REQUIRES_ACTION]->(a:RecommendedAction)
        RETURN a.action as action, a.id as actionId
        ORDER BY a.id
      `, { rfpId });

      return result.records.map(record => ({
        actionId: record.get('actionId'),
        action: record.get('action')
      }));

    } finally {
      await session.close();
    }
  }

  /**
   * Update RFP status (e.g., when pursued, won, or lost)
   */
  async updateRFPStatus(rfpId: string, status: string, notes?: string): Promise<boolean> {
    const session = this.neo4j.getDriver().session();
    try {
      const updateQuery = `
        MATCH (r:RFP {id: $rfpId})
        SET r.status = $status,
            r.last_updated = datetime()
      `;

      const params = { rfpId, status };

      if (notes) {
        await session.run(`
          ${updateQuery}
          SET r.notes = COALESCE(r.notes, '') + '\\n' + $notes
        `, { ...params, notes });
      } else {
        await session.run(updateQuery, params);
      }

      return true;

    } catch (error) {
      console.error('Error updating RFP status:', error);
      return false;
    } finally {
      await session.close();
    }
  }

  /**
   * Get RFP analytics and metrics
   */
  async getRFPAnalytics(): Promise<any> {
    const session = this.neo4j.getDriver().session();
    try {
      const result = await session.run(`
        MATCH (r:RFP)
        OPTIONAL MATCH (e:Entity)-[:ISSUED_RFP]->(r)
        RETURN 
          COUNT(r) as totalRFPs,
          COUNT(CASE WHEN r.status = 'ACTIVE' THEN 1 END) as activeRFPs,
          COUNT(DISTINCT e.type) as entityTypes,
          COUNT(DISTINCT e.sport) as sportsCovered,
          SUM(CASE WHEN r.priorityLevel = 'CRITICAL' THEN 1 ELSE 0 END) as criticalRFPs,
          SUM(CASE WHEN r.priorityLevel = 'MEDIUM' THEN 1 ELSE 0 END) as mediumRFPs,
          SUM(CASE WHEN r.priorityLevel = 'LOW' THEN 1 ELSE 0 END) as lowRFPs,
          AVG(r.confidenceScore) as avgConfidence,
          AVG(r.yellowPantherFit) as avgFitScore
      `);

      const record = result.records[0];
      return {
        totalRFPs: record.get('totalRFPs').toNumber(),
        activeRFPs: record.get('activeRFPs').toNumber(),
        entityTypes: record.get('entityTypes').toNumber(),
        sportsCovered: record.get('sportsCovered').toNumber(),
        priorityBreakdown: {
          critical: record.get('criticalRFPs').toNumber(),
          medium: record.get('mediumRFPs').toNumber(),
          low: record.get('lowRFPs').toNumber()
        },
        avgConfidence: record.get('avgConfidence') || 0,
        avgFitScore: record.get('avgFitScore') || 0
      };

    } finally {
      await session.close();
    }
  }
}

// Singleton instances for easy import
let rfpStorageInstance: RFPStorageService | null = null;

export function getRFPStorageService(neo4jService?: any): RFPStorageService {
  if (!rfpStorageInstance) {
    rfpStorageInstance = new RFPStorageService(neo4jService);
  }
  return rfpStorageInstance;
}

// Export singleton instance for hybrid storage
export const rfpStorageService = new RFPStorageService();