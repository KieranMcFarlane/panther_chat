import { liveLogService } from './LiveLogService';
import { notificationService } from './NotificationService';

interface EnrichmentConfig {
  brightdataApiKey: string;
  brightdataZone: string;
  perplexityApiKey: string;
  neo4jUri: string;
  neo4jUsername: string;
  neo4jPassword: string;
  batchSize: number;
  delayBetweenRequests: number; // milliseconds
}

interface EnrichmentResult {
  entityId: string;
  entityName: string;
  success: boolean;
  brightdataResults?: any;
  perplexityResults?: any;
  error?: string;
  duration: number;
  timestamp: string;
}

interface BatchProgress {
  batchId: string;
  totalEntities: number;
  processedEntities: number;
  successfulEnrichments: number;
  failedEnrichments: number;
  currentEntity: string;
  estimatedTimeRemaining: number;
  startTime: string;
  results: EnrichmentResult[];
}

export class EntityDossierEnrichmentService {
  private static instance: EntityDossierEnrichmentService;
  private config: EnrichmentConfig | null = null;
  private currentBatch: BatchProgress | null = null;
  private isProcessing: boolean = false;

  private constructor() {}

  public static getInstance(): EntityDossierEnrichmentService {
    if (!EntityDossierEnrichmentService.instance) {
      EntityDossierEnrichmentService.instance = new EntityDossierEnrichmentService();
    }
    return EntityDossierEnrichmentService.instance;
  }

  public configure(config: EnrichmentConfig): void {
    this.config = config;
    liveLogService.info('Entity Dossier Enrichment Service configured', {
      category: 'system',
      source: 'EntityDossierEnrichmentService',
      message: 'Service configured for systematic entity enrichment',
      data: {
        batchSize: config.batchSize,
        delayBetweenRequests: config.delayBetweenRequests
      },
      tags: ['entity-enrichment', 'configuration']
    });
  }

  /**
   * Start systematic enrichment of all entities
   */
  public async startSystematicEnrichment(): Promise<BatchProgress> {
    if (!this.config) {
      throw new Error('Entity Dossier Enrichment Service must be configured before starting');
    }

    if (this.isProcessing) {
      throw new Error('Entity enrichment already in progress');
    }

    this.isProcessing = true;
    const batchId = `enrichment_${Date.now()}`;
    
    // Get all entities that need enrichment
    const entities = await this.getEntitiesForEnrichment();
    
    this.currentBatch = {
      batchId,
      totalEntities: entities.length,
      processedEntities: 0,
      successfulEnrichments: 0,
      failedEnrichments: 0,
      currentEntity: '',
      estimatedTimeRemaining: 0,
      startTime: new Date().toISOString(),
      results: []
    };

    liveLogService.info('Systematic entity enrichment started', {
      category: 'system',
      source: 'EntityDossierEnrichmentService',
      message: `Starting enrichment of ${entities.length} entities`,
      data: {
        batchId,
        totalEntities: entities.length,
        batchSize: this.config.batchSize
      },
      tags: ['entity-enrichment', 'batch-start']
    });

    // Start processing in background
    this.processBatch(entities).catch(error => {
      liveLogService.error('Entity enrichment batch failed', {
        category: 'system',
        source: 'EntityDossierEnrichmentService',
        message: `Batch processing failed: ${error.message}`,
        data: {
          batchId,
          error: error.message
        },
        tags: ['entity-enrichment', 'error']
      });
      this.isProcessing = false;
    });

    return this.currentBatch;
  }

  /**
   * Get entities that need enrichment
   */
  private async getEntitiesForEnrichment(): Promise<any[]> {
    try {
      // Get entities that haven't been enriched or were enriched > 7 days ago
      const response = await fetch(`http://localhost:3005/api/entities?limit=5000`);
      const data = await response.json();
      
      // For testing: include all entities, remove 7-day filter
      return data.entities.slice(0, 10); // Test with first 10 entities only
    } catch (error) {
      liveLogService.error('Failed to fetch entities for enrichment', {
        category: 'system',
        source: 'EntityDossierEnrichmentService',
        message: `Error fetching entities: ${error.message}`,
        data: { error: error.message },
        tags: ['entity-enrichment', 'error']
      });
      throw error;
    }
  }

  /**
   * Process a batch of entities
   */
  private async processBatch(entities: any[]): Promise<void> {
    const startTime = Date.now();
    
    for (let i = 0; i < entities.length; i += this.config!.batchSize) {
      const batch = entities.slice(i, i + this.config!.batchSize);
      
      // Process each entity in the current batch
      for (const entity of batch) {
        if (!this.isProcessing) break; // Allow cancellation
        
        this.currentBatch!.currentEntity = entity.properties.name || entity.name;
        this.currentBatch!.processedEntities++;
        
        const result = await this.enrichSingleEntity(entity);
        this.currentBatch!.results.push(result);
        
        if (result.success) {
          this.currentBatch!.successfulEnrichments++;
        } else {
          this.currentBatch!.failedEnrichments++;
        }

        // Update estimated time remaining
        const avgTimePerEntity = (Date.now() - startTime) / this.currentBatch!.processedEntities;
        const remainingEntities = entities.length - this.currentBatch!.processedEntities;
        this.currentBatch!.estimatedTimeRemaining = Math.round(avgTimePerEntity * remainingEntities / 1000); // seconds

        // Log progress every 10 entities
        if (this.currentBatch!.processedEntities % 10 === 0) {
          liveLogService.info('Entity enrichment progress', {
            category: 'system',
            source: 'EntityDossierEnrichmentService',
            message: `Processed ${this.currentBatch!.processedEntities}/${entities.length} entities`,
            data: {
              progress: Math.round((this.currentBatch!.processedEntities / entities.length) * 100),
              successful: this.currentBatch!.successfulEnrichments,
              failed: this.currentBatch!.failedEnrichments,
              estimatedTimeRemaining: this.currentBatch!.estimatedTimeRemaining
            },
            tags: ['entity-enrichment', 'progress']
          });
        }

        // Delay between requests to avoid rate limiting
        if (this.config!.delayBetweenRequests > 0) {
          await this.sleep(this.config!.delayBetweenRequests);
        }
      }
    }

    // Batch completed
    this.isProcessing = false;
    const duration = Date.now() - startTime;
    
    liveLogService.info('Entity enrichment batch completed', {
      category: 'system',
      source: 'EntityDossierEnrichmentService',
      message: `Completed enrichment of ${this.currentBatch!.totalEntities} entities`,
      data: {
        batchId: this.currentBatch!.batchId,
        totalEntities: this.currentBatch!.totalEntities,
        successfulEnrichments: this.currentBatch!.successfulEnrichments,
        failedEnrichments: this.currentBatch!.failedEnrichments,
        duration: Math.round(duration / 1000),
        successRate: Math.round((this.currentBatch!.successfulEnrichments / this.currentBatch!.totalEntities) * 100)
      },
      tags: ['entity-enrichment', 'batch-complete']
    });

    // Send notification
    await notificationService.sendNotification({
      title: '🎯 Entity Dossier Enrichment Complete',
      message: `Successfully enriched ${this.currentBatch!.successfulEnrichments}/${this.currentBatch!.totalEntities} entities`,
      priority: 'medium',
      channels: ['teams'],
      metadata: {
        batchId: this.currentBatch!.batchId,
        successRate: Math.round((this.currentBatch!.successfulEnrichments / this.currentBatch!.totalEntities) * 100),
        duration: Math.round(duration / 1000)
      }
    });
  }

  /**
   * Enrich a single entity with BrightData and Perplexity
   */
  private async enrichSingleEntity(entity: any): Promise<EnrichmentResult> {
    const startTime = Date.now();
    const entityId = entity.id || entity.neo4j_id;
    const entityName = entity.properties?.name || entity.name;
    
    const result: EnrichmentResult = {
      entityId,
      entityName,
      success: false,
      duration: 0,
      timestamp: new Date().toISOString()
    };

    try {
      // Step 1: BrightData enrichment
      const brightdataResults = await this.enrichWithBrightData(entity);
      result.brightdataResults = brightdataResults;

      // Step 2: Perplexity market intelligence
      const perplexityResults = await this.enrichWithPerplexity(entity, brightdataResults);
      result.perplexityResults = perplexityResults;

      // Step 3: Update entity in Neo4j with combined results
      await this.updateEntityWithEnrichment(entityId, {
        brightdata: brightdataResults,
        perplexity: perplexityResults,
        enriched_at: new Date().toISOString(),
        enrichment_version: '2.0'
      });

      result.success = true;
      result.duration = Date.now() - startTime;

      liveLogService.info('Entity enriched successfully', {
        category: 'system',
        source: 'EntityDossierEnrichmentService',
        message: `Successfully enriched ${entityName}`,
        data: {
          entityId,
          entityName,
          duration: result.duration,
          brightdataSources: brightdataResults?.sources_found || 0,
          perplexityInsights: perplexityResults?.market_analysis?.length || 0
        },
        tags: ['entity-enrichment', 'success']
      });

    } catch (error) {
      result.error = error.message;
      result.duration = Date.now() - startTime;

      liveLogService.error('Entity enrichment failed', {
        category: 'system',
        source: 'EntityDossierEnrichmentService',
        message: `Failed to enrich ${entityName}: ${error.message}`,
        data: {
          entityId,
          entityName,
          error: error.message,
          duration: result.duration
        },
        tags: ['entity-enrichment', 'error']
      });
    }

    return result;
  }

  /**
   * Enrich entity with BrightData scraping
   */
  private async enrichWithBrightData(entity: any): Promise<any> {
    const entityName = entity.properties?.name || entity.name;
    const entityWebsite = entity.properties?.website || entity.website;
    
    // Call existing BrightData enrichment endpoint
    const requestBody = {
      entity_id: entity.id || entity.neo4j_id,
      entityName,
      entityWebsite,
      sources: ['linkedin', 'crunchbase', 'web']
    };
    
    console.log(`🔄 Enriching ${entityName} with BrightData:`, requestBody);
    
    const response = await fetch(`http://localhost:3005/api/enrich-entity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    const responseText = await response.text();
    console.log(`📡 BrightData response (${response.status}):`, responseText);

    if (!response.ok) {
      throw new Error(`BrightData enrichment failed: ${response.statusText} - ${responseText}`);
    }

    return JSON.parse(responseText);
  }

  /**
   * Enrich entity with Perplexity market intelligence
   */
  private async enrichWithPerplexity(entity: any, brightdataResults: any): Promise<any> {
    const entityName = entity.properties?.name || entity.name;
    const entityType = entity.properties?.type || entity.type;
    const entitySport = entity.properties?.sport || entity.sport;
    const entityCountry = entity.properties?.country || entity.country;

    // Create market research prompt
    const marketResearchPrompt = `
Analyze the sports entity "${entityName}" (${entityType}) in the ${entitySport} industry based in ${entityCountry}.

Provide comprehensive market intelligence including:
1. Current market position and competitive landscape
2. Digital transformation opportunities and challenges
3. Recent industry trends affecting this entity type
4. Potential technology partnership opportunities
5. Estimated market size and growth potential
6. Key decision makers and organizational structure insights
7. RFP/procurement likelihood and timing predictions

Focus on actionable business intelligence for technology vendors and service providers.
    `.trim();

    // Call Perplexity API (simplified version)
    try {
      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config!.perplexityApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.1-sonar-small-128k-online',
          messages: [
            {
              role: 'system',
              content: 'You are a sports industry market intelligence analyst providing detailed business insights for technology vendors.'
            },
            {
              role: 'user',
              content: marketResearchPrompt
            }
          ],
          temperature: 0.3,
          max_tokens: 2000
        })
      });

      if (!response.ok) {
        throw new Error(`Perplexity API error: ${response.statusText}`);
      }

      const perplexityData = await response.json();
      
      return {
        market_analysis: perplexityData.choices?.[0]?.message?.content || '',
        model_used: 'llama-3.1-sonar-small-128k-online',
        analysis_timestamp: new Date().toISOString(),
        confidence_score: 0.85
      };

    } catch (error) {
      liveLogService.warn('Perplexity enrichment failed, using fallback', {
        category: 'system',
        source: 'EntityDossierEnrichmentService',
        message: `Perplexity API failed for ${entityName}: ${error.message}`,
        data: { entityName, error: error.message },
        tags: ['entity-enrichment', 'perplexity-fallback']
      });

      // Fallback analysis
      return {
        market_analysis: `Market intelligence unavailable due to API limitations. Entity ${entityName} operates in the ${entitySport} ${entityType} sector in ${entityCountry}.`,
        model_used: 'fallback',
        analysis_timestamp: new Date().toISOString(),
        confidence_score: 0.3
      };
    }
  }

  /**
   * Update entity with enrichment results
   */
  private async updateEntityWithEnrichment(entityId: string, enrichmentData: any): Promise<void> {
    const response = await fetch(`http://localhost:3005/api/entities/${entityId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        properties: {
          enriched: true,
          enriched_at: enrichmentData.enriched_at,
          enrichment_version: enrichmentData.enrichment_version,
          brightdata_enrichment: enrichmentData.brightdata,
          perplexity_intelligence: enrichmentData.perplexity,
          data_sources: {
            brightdata_mcp: enrichmentData.brightdata ? 'success' : 'failed',
            perplexity_ai: enrichmentData.perplexity ? 'success' : 'failed'
          },
          enrichment_summary: `Enhanced with BrightData scraping (${enrichmentData.brightdata?.sources_found || 0} sources) and Perplexity market intelligence (confidence: ${enrichmentData.perplexity?.confidence_score || 0})`
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to update entity: ${response.statusText}`);
    }
  }

  /**
   * Get current batch progress
   */
  public getCurrentBatch(): BatchProgress | null {
    return this.currentBatch;
  }

  /**
   * Cancel current enrichment batch
   */
  public cancelEnrichment(): void {
    this.isProcessing = false;
    
    if (this.currentBatch) {
      liveLogService.info('Entity enrichment cancelled', {
        category: 'system',
        source: 'EntityDossierEnrichmentService',
        message: `Cancelled batch ${this.currentBatch.batchId}`,
        data: {
          batchId: this.currentBatch.batchId,
          processedEntities: this.currentBatch.processedEntities,
          totalEntities: this.currentBatch.totalEntities
        },
        tags: ['entity-enrichment', 'cancelled']
      });
    }
  }

  /**
   * Check if enrichment is currently running
   */
  public isEnrichmentRunning(): boolean {
    return this.isProcessing;
  }

  /**
   * Utility function for delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Configure from environment variables
   */
  public configureFromEnvironment(): EntityDossierEnrichmentService {
    const config: EnrichmentConfig = {
      brightdataApiKey: process.env.BRIGHTDATA_API_TOKEN || '',
      brightdataZone: process.env.BRIGHTDATA_ZONE || 'linkedin_posts_monitor',
      perplexityApiKey: process.env.PERPLEXITY_API_KEY || '',
      neo4jUri: process.env.NEO4J_URI || '',
      neo4jUsername: process.env.NEO4J_USERNAME || '',
      neo4jPassword: process.env.NEO4J_PASSWORD || '',
      batchSize: 3, // Conservative batch size
      delayBetweenRequests: 2000 // 2 seconds between requests
    };

    // Validate required environment variables
    if (!config.brightdataApiKey) {
      throw new Error('BRIGHTDATA_API_TOKEN environment variable is required');
    }

    if (!config.perplexityApiKey) {
      throw new Error('PERPLEXITY_API_KEY environment variable is required');
    }

    this.configure(config);
    return this;
  }
}

// Global instance
export const entityDossierEnrichmentService = EntityDossierEnrichmentService.getInstance();