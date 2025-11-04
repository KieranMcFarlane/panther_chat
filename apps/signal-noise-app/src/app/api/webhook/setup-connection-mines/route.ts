import { NextRequest, NextResponse } from 'next/server';
import { Neo4jService } from '@/lib/neo4j';
import { ConnectionIntelligenceAgent } from '@/services/ConnectionIntelligenceAgent';
import crypto from 'crypto';

/**
 * Connection Mines Setup Webhook
 * 
 * Creates passive "mines" for all entities in Neo4j database:
 * - 1st degree: Direct Yellow Panther team connections
 * - 2nd degree: Mutual connections through Yellow Panther team  
 * - 3rd degree: Extended network through bridge contacts
 * 
 * Each mine monitors for changes and triggers connection intelligence analysis
 */

interface ConnectionMineSetup {
  operation: 'setup_all_mines' | 'setup_entity_mine' | 'update_existing_mines';
  entity_filter?: {
    entity_types?: string[];
    yellow_panther_priority?: number;
    sports?: string[];
  };
  mine_configuration?: {
    monitoring_depth: 1 | 2 | 3;
    update_frequency: 'real_time' | 'hourly' | 'daily' | 'weekly';
    alert_thresholds: {
      personnel_change: boolean;
    organization_change: boolean;
    new_connections: boolean;
    opportunity_signals: boolean;
    };
    predictive_reasoning: {
      enabled: boolean;
      lookback_days: number;
      confidence_threshold: number;
    };
  };
}

interface ConnectionMine {
  id: string;
  entity_id: string;
  entity_name: string;
  entity_type: string;
  connection_depth: number;
  yellow_panther_connections: {
    direct_connections: number;
    mutual_connections: number;
    extended_connections: number;
  };
  monitoring_webhooks: Array<{
    webhook_url: string;
    trigger_type: string;
    active: boolean;
    last_triggered?: string;
  }>;
  predictive_data: {
    historical_patterns: Array<{
      pattern_type: string;
      frequency: number;
      confidence: number;
      next_predicted?: string;
    }>;
    relationship_strength: number;
    opportunity_likelihood: number;
  };
  created_at: string;
  last_updated: string;
  active: boolean;
}

class ConnectionMineSetupService {
  private neo4jService: Neo4jService;
  private connectionAgent: ConnectionIntelligenceAgent;

  constructor() {
    this.neo4jService = new Neo4jService();
    this.connectionAgent = new ConnectionIntelligenceAgent();
  }

  async setupConnectionMines(config: ConnectionMineSetup): Promise<{
    total_mines_created: number;
    mines_by_depth: Record<number, number>;
    processing_time_ms: number;
    sample_mines: ConnectionMine[];
  }> {
    const startTime = Date.now();
    
    try {
      console.log('🎯 Starting Connection Mine Setup for Neo4j entities');
      
      // Get entities from Neo4j based on filter
      const entities = await this.getEntitiesForMining(config.entity_filter);
      console.log(`📊 Found ${entities.length} entities for connection mining`);
      
      const mines: ConnectionMine[] = [];
      const minesByDepth: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
      
      // Process entities in batches
      const batchSize = 50;
      for (let i = 0; i < entities.length; i += batchSize) {
        const batch = entities.slice(i, i + batchSize);
        console.log(`⚡ Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(entities.length / batchSize)}`);
        
        const batchMines = await this.processEntityBatch(batch, config.mine_configuration);
        mines.push(...batchMines);
        
        // Update depth counts
        batchMines.forEach(mine => {
          minesByDepth[mine.connection_depth]++;
        });
      }
      
      // Store mines in Neo4j
      await this.storeMinesInNeo4j(mines);
      
      const processingTime = Date.now() - startTime;
      
      console.log(`✅ Connection Mine Setup Complete:`, {
        total_mines: mines.length,
        processing_time_ms: processingTime,
        depth_distribution: minesByDepth
      });
      
      return {
        total_mines_created: mines.length,
        mines_by_depth: minesByDepth,
        processing_time_ms: processingTime,
        sample_mines: mines.slice(0, 5) // Return first 5 as sample
      };
      
    } catch (error) {
      console.error('❌ Connection Mine Setup failed:', error);
      throw error;
    }
  }

  private async getEntitiesForMining(filter?: ConnectionMineSetup['entity_filter']): Promise<any[]> {
    let cypher = `
      MATCH (e:Entity)
      WHERE e.yellowPantherPriority IS NOT NULL
    `;
    
    const params: any = {};
    
    if (filter?.entity_types && filter.entity_types.length > 0) {
      cypher += ` AND e.type IN $entity_types `;
      params.entity_types = filter.entity_types;
    }
    
    if (filter?.yellow_panther_priority) {
      cypher += ` AND e.yellowPantherPriority <= $priority `;
      params.priority = filter.yellow_panther_priority;
    }
    
    if (filter?.sports && filter.sports.length > 0) {
      cypher += ` AND e.sport IN $sports `;
      params.sports = filter.sports;
    }
    
    cypher += `
      RETURN e.name as name, e.id as id, e.type as type, e.sport as sport, 
             e.yellowPantherPriority as priority, e.linkedin as linkedin,
             e.digitalTransformationScore as digital_score,
             e.yellowPantherFit as fit_score
      ORDER BY e.yellowPantherPriority ASC, e.digitalTransformationScore DESC
      LIMIT 1000
    `;
    
    const result = await this.neo4jService.executeQuery(cypher, params);
    return result.map(record => record.toObject());
  }

  private async processEntityBatch(
    entities: any[], 
    config?: ConnectionMineSetup['mine_configuration']
  ): Promise<ConnectionMine[]> {
    const mines: ConnectionMine[] = [];
    
    for (const entity of entities) {
      try {
        // Analyze connections for this entity
        const connectionAnalysis = await this.connectionAgent.analyzeConnections({
          organization: entity.name,
          linkedin_url: entity.linkedin,
          priority: entity.priority <= 5 ? 'HIGH' : 'MEDIUM',
          trigger_source: 'mine_setup',
          request_id: `mine_setup_${entity.id}_${Date.now()}`
        });
        
        // Create mines for different connection depths
        const depth = config?.monitoring_depth || 3;
        
        const mine: ConnectionMine = {
          id: `mine_${entity.id}_${Date.now()}`,
          entity_id: entity.id,
          entity_name: entity.name,
          entity_type: entity.type,
          connection_depth: depth,
          
          yellow_panther_connections: {
            direct_connections: connectionAnalysis.team_connections.stuart_cope_connections,
            mutual_connections: connectionAnalysis.team_connections.total_team_connections,
            extended_connections: connectionAnalysis.team_connections.strong_paths + connectionAnalysis.team_connections.medium_paths
          },
          
          monitoring_webhooks: this.generateWebhookEndpoints(entity.id, depth, config),
          
          predictive_data: await this.generatePredictiveData(entity, connectionAnalysis, config),
          
          created_at: new Date().toISOString(),
          last_updated: new Date().toISOString(),
          active: true
        };
        
        mines.push(mine);
        
      } catch (error) {
        console.error(`❌ Failed to create mine for ${entity.name}:`, error);
        // Continue with other entities
      }
    }
    
    return mines;
  }

  private generateWebhookEndpoints(
    entityId: string, 
    depth: number, 
    config?: ConnectionMineSetup['mine_configuration']
  ): Array<{
    webhook_url: string;
    trigger_type: string;
    active: boolean;
  }> {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3005';
    const webhooks = [];
    
    // 1st degree monitoring webhooks
    if (depth >= 1) {
      webhooks.push(
        {
          webhook_url: `${baseUrl}/api/webhook/linkedin-connection-analysis`,
          trigger_type: 'personnel_change',
          active: config?.alert_thresholds?.personnel_change || true
        },
        {
          webhook_url: `${baseUrl}/api/webhook/linkedin-procurement`,
          trigger_type: 'opportunity_detection',
          active: config?.alert_thresholds?.opportunity_signals || true
        }
      );
    }
    
    // 2nd degree monitoring webhooks
    if (depth >= 2) {
      webhooks.push(
        {
          webhook_url: `${baseUrl}/api/webhook/network-update`,
          trigger_type: 'mutual_connection_change',
          active: config?.alert_thresholds?.new_connections || true
        },
        {
          webhook_url: `${baseUrl}/api/webhook/relationship-boost`,
          trigger_type: 'network_expansion',
          active: true
        }
      );
    }
    
    // 3rd degree monitoring webhooks
    if (depth >= 3) {
      webhooks.push(
        {
          webhook_url: `${baseUrl}/api/webhook/extended-network`,
          trigger_type: 'bridge_contact_activity',
          active: true
        },
        {
          webhook_url: `${baseUrl}/api/webhook/predictive-opportunity`,
          trigger_type: 'pattern_detection',
          active: config?.predictive_reasoning?.enabled || true
        }
      );
    }
    
    return webhooks;
  }

  private async generatePredictiveData(
    entity: any, 
    connectionAnalysis: any, 
    config?: ConnectionMineSetup['mine_configuration']
  ): Promise<ConnectionMine['predictive_data']> {
    const predictiveData: ConnectionMine['predictive_data'] = {
      historical_patterns: [],
      relationship_strength: 0,
      opportunity_likelihood: 0
    };
    
    if (!config?.predictive_reasoning?.enabled) {
      return predictiveData;
    }
    
    try {
      // Analyze historical patterns from Neo4j
      const historicalPatterns = await this.analyzeHistoricalPatterns(entity.id, config.predictive_reasoning.lookback_days || 180);
      predictiveData.historical_patterns = historicalPatterns;
      
      // Calculate relationship strength score
      predictiveData.relationship_strength = this.calculateRelationshipStrength(connectionAnalysis, entity);
      
      // Predict opportunity likelihood
      predictiveData.opportunity_likelihood = this.predictOpportunityLikelihood(entity, connectionAnalysis, historicalPatterns);
      
    } catch (error) {
      console.error(`❌ Predictive data generation failed for ${entity.name}:`, error);
    }
    
    return predictiveData;
  }

  private async analyzeHistoricalPatterns(entityId: string, lookbackDays: number): Promise<Array<{
    pattern_type: string;
    frequency: number;
    confidence: number;
    next_predicted?: string;
  }>> {
    const cypher = `
      MATCH (e:Entity {id: $entityId})
      OPTIONAL MATCH (e)-[r:HAS_OPPORTUNITY]->(o:Opportunity)
      WHERE o.created_at > datetime() - duration({days: $lookbackDays})
      
      // Personnel change patterns
      OPTIONAL MATCH (e)-[:HAS_PERSONNEL]->(p:Person)
      WHERE p.role_change_date > datetime() - duration({days: $lookbackDays})
      
      // Digital transformation patterns
      OPTIONAL MATCH (e)-[:HAS_DIGITAL_INITIATIVE]->(d:DigitalInitiative)
      WHERE d.launch_date > datetime() - duration({days: $lookbackDays})
      
      RETURN 
        count(DISTINCT o) as opportunity_count,
        count(DISTINCT p) as personnel_changes,
        count(DISTINCT d) as digital_initiatives,
        collect(DISTINCT o.type) as opportunity_types,
        collect(DISTINCT p.new_role) as role_types
    `;
    
    const result = await this.neo4jService.executeQuery(cypher, { entityId, lookbackDays });
    
    if (result.length === 0) {
      return [];
    }
    
    const data = result[0].toObject();
    const patterns = [];
    
    // Opportunity patterns
    if (data.opportunity_count > 0) {
      patterns.push({
        pattern_type: 'rfp_opportunities',
        frequency: data.opportunity_count,
        confidence: Math.min(data.opportunity_count * 20, 90),
        next_predicted: this.predictNextOccurrence(data.opportunity_count, lookbackDays)
      });
    }
    
    // Personnel change patterns
    if (data.personnel_changes > 0) {
      patterns.push({
        pattern_type: 'personnel_changes',
        frequency: data.personnel_changes,
        confidence: Math.min(data.personnel_changes * 25, 85),
        next_predicted: this.predictNextOccurrence(data.personnel_changes, lookbackDays)
      });
    }
    
    // Digital initiative patterns
    if (data.digital_initiatives > 0) {
      patterns.push({
        pattern_type: 'digital_transformations',
        frequency: data.digital_initiatives,
        confidence: Math.min(data.digital_initiatives * 30, 95),
        next_predicted: this.predictNextOccurrence(data.digital_initiatives, lookbackDays)
      });
    }
    
    return patterns;
  }

  private calculateRelationshipStrength(connectionAnalysis: any, entity: any): number {
    let strength = 0;
    
    // Stuart Cope connections (highest weight)
    strength += Math.min(connectionAnalysis.team_connections.stuart_cope_connections * 25, 50);
    
    // Total team connections
    strength += Math.min(connectionAnalysis.team_connections.total_team_connections * 15, 30);
    
    // Strong paths
    strength += Math.min(connectionAnalysis.team_connections.strong_paths * 10, 20);
    
    // Entity priority bonus
    if (entity.priority <= 3) {
      strength += 10;
    } else if (entity.priority <= 5) {
      strength += 5;
    }
    
    // Digital readiness bonus
    if (entity.digital_score >= 80) {
      strength += 10;
    } else if (entity.digital_score >= 60) {
      strength += 5;
    }
    
    return Math.min(strength, 100);
  }

  private predictOpportunityLikelihood(entity: any, connectionAnalysis: any, historicalPatterns: any[]): number {
    let likelihood = 30; // Base 30% likelihood
    
    // Network access boost
    if (connectionAnalysis.team_connections.stuart_cope_connections > 0) {
      likelihood += 25;
    }
    
    if (connectionAnalysis.team_connections.total_team_connections >= 3) {
      likelihood += 15;
    }
    
    // Historical patterns boost
    const opportunityPattern = historicalPatterns.find(p => p.pattern_type === 'rfp_opportunities');
    if (opportunityPattern) {
      likelihood += Math.min(opportunityPattern.frequency * 5, 20);
    }
    
    // Entity characteristics boost
    if (entity.type === 'Federation' || entity.type === 'League') {
      likelihood += 10;
    }
    
    if (entity.digital_score >= 70) {
      likelihood += 10;
    }
    
    if (entity.fit_score >= 80) {
      likelihood += 10;
    }
    
    return Math.min(likelihood, 95);
  }

  private predictNextOccurrence(frequency: number, lookbackDays: number): string {
    if (frequency === 0) return 'Unknown';
    
    const averageDaysBetweenEvents = lookbackDays / frequency;
    const nextOccurrenceDays = Math.round(averageDaysBetweenEvents);
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + nextOccurrenceDays);
    
    return nextDate.toISOString().split('T')[0]; // Return just the date
  }

  private async storeMinesInNeo4j(mines: ConnectionMine[]): Promise<void> {
    for (const mine of mines) {
      try {
        const cypher = `
          MERGE (cm:ConnectionMine {entity_id: $entity_id})
          SET cm.id = $id,
              cm.entity_name = $entity_name,
              cm.entity_type = $entity_type,
              cm.connection_depth = $connection_depth,
              cm.yellow_panther_connections = $connections,
              cm.monitoring_webhooks = $webhooks,
              cm.predictive_data = $predictive_data,
              cm.created_at = datetime($created_at),
              cm.last_updated = datetime($last_updated),
              cm.active = $active
        `;
        
        await this.neo4jService.executeQuery(cypher, {
          entity_id: mine.entity_id,
          id: mine.id,
          entity_name: mine.entity_name,
          entity_type: mine.entity_type,
          connection_depth: mine.connection_depth,
          connections: JSON.stringify(mine.yellow_panther_connections),
          webhooks: JSON.stringify(mine.monitoring_webhooks),
          predictive_data: JSON.stringify(mine.predictive_data),
          created_at: mine.created_at,
          last_updated: mine.last_updated,
          active: mine.active
        });
        
      } catch (error) {
        console.error(`❌ Failed to store mine for ${mine.entity_name}:`, error);
      }
    }
  }
}

// Webhook endpoint
export async function POST(request: NextRequest) {
  try {
    const config: ConnectionMineSetup = await request.json();
    
    // Verify webhook signature if implemented
    const signature = request.headers.get('x-signature');
    if (signature && !verifyWebhookSignature(config, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
    
    const mineService = new ConnectionMineSetupService();
    const result = await mineService.setupConnectionMines(config);
    
    return NextResponse.json({
      status: 'success',
      message: 'Connection mines setup completed',
      ...result
    });
    
  } catch (error) {
    console.error('Connection mine setup webhook error:', error);
    return NextResponse.json(
      { error: 'Mine setup failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Get existing mines status
export async function GET() {
  try {
    const neo4jService = new Neo4jService();
    
    const cypher = `
      MATCH (cm:ConnectionMine)
      WHERE cm.active = true
      RETURN 
        count(cm) as total_mines,
        cm.connection_depth as depth,
        count(cm) as mines_at_depth
      ORDER BY depth
    `;
    
    const result = await neo4jService.executeQuery(cypher);
    
    const depthDistribution: Record<number, number> = {};
    let totalMines = 0;
    
    result.forEach(record => {
      const depth = record.get('depth');
      const count = record.get('mines_at_depth');
      depthDistribution[depth] = count;
      totalMines += count;
    });
    
    return NextResponse.json({
      status: 'active',
      total_mines: totalMines,
      mines_by_depth: depthDistribution,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get mine status' },
      { status: 500 }
    );
  }
}

function verifyWebhookSignature(data: any, signature: string): boolean {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) return true;
  
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(data))
    .digest('hex');
    
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
}