#!/usr/bin/env node

/**
🏆 SMART INCREMENTAL SPORTS RFP SYNC
Intelligent cron job that processes only new entities from Neo4j
- First run: Full sync of all entities
- Subsequent runs: Only new entities added since last run
- Cache-aware with manual override capability
**/

const fs = require('fs');
const path = require('path');
const https = require('https');

// Load environment variables from .env file
require('dotenv').config();

// Configuration
const SCRIPT_DIR = __dirname;
const PROJECT_ROOT = path.dirname(SCRIPT_DIR);
const CACHE_DIR = path.join(PROJECT_ROOT, '.cache');
const SYNC_STATE_FILE = path.join(CACHE_DIR, 'sync-state.json');
const LOG_DIR = path.join(PROJECT_ROOT, 'logs');
const BASE_URL = 'http://localhost:3005';

// Ensure directories exist
[CACHE_DIR, LOG_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

/**
* Logging with timestamps
*/
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  
  // Write to daily log file
  const logFile = path.join(LOG_DIR, `smart-sync-${new Date().toISOString().split('T')[0]}.log`);
  fs.appendFileSync(logFile, logMessage + '\n');
}

/**
* Sync state management
*/
class SyncStateManager {
  constructor() {
    this.state = this.loadState();
  }

  loadState() {
    try {
      if (fs.existsSync(SYNC_STATE_FILE)) {
        return JSON.parse(fs.readFileSync(SYNC_STATE_FILE, 'utf8'));
      }
    } catch (error) {
      log(`⚠️  Could not load sync state: ${error.message}`);
    }
    
    return {
      lastSync: null,
      processedEntities: {},
      fullSyncCompleted: false,
      stats: {
        totalProcessed: 0,
        lastProcessedCount: 0,
        consecutiveFailures: 0
      }
    };
  }

  saveState() {
    try {
      fs.writeFileSync(SYNC_STATE_FILE, JSON.stringify(this.state, null, 2));
    } catch (error) {
      log(`❌ Failed to save sync state: ${error.message}`);
    }
  }

  markEntityProcessed(entityId, entityData) {
    this.state.processedEntities[entityId] = {
      lastProcessed: new Date().toISOString(),
      entityType: entityData.type,
      entityName: entityData.name,
      sport: entityData.sport,
      tier: entityData.tier
    };
    this.state.stats.totalProcessed++;
  }

  isEntityProcessed(entityId) {
    return this.state.processedEntities.hasOwnProperty(entityId);
  }

  markFullSyncCompleted() {
    this.state.fullSyncCompleted = true;
    this.state.lastSync = new Date().toISOString();
    this.saveState();
    log(`✅ Full sync marked as completed at ${this.state.lastSync}`);
  }

  getLastSyncTime() {
    return this.state.lastSync;
  }

  getSyncStats() {
    return {
      ...this.state.stats,
      processedCount: Object.keys(this.state.processedEntities).length,
      isFullSync: this.state.fullSyncCompleted
    };
  }
}

/**
* Neo4j Service for entity management
*/
class Neo4jEntityService {
  constructor() {
    this.neo4jUrl = process.env.NEO4J_URI;
    this.username = process.env.NEO4J_USERNAME || 'neo4j';
    this.password = process.env.NEO4J_PASSWORD;
  }

  async getAllSportsEntities() {
    try {
      const entities = await this.runNeo4jQuery(`
        MATCH (e:Entity)
        WHERE e.type IN ['club', 'league', 'venue', 'sports-organization', 'brand', 'team']
        OPTIONAL MATCH (e)-[:HAS_RFP]->(rfp:RFP)
        RETURN e.id as entity_id, e.name as name, e.type as type, 
               e.sport as sport, e.tier as tier, e.created_at as created_at,
               COUNT(rfp) as rfp_count
        ORDER BY e.tier ASC, e.name ASC
      `);
      
      log(`📊 Retrieved ${entities.length} sports entities from Neo4j`);
      return entities;
    } catch (error) {
      log(`❌ Failed to get entities from Neo4j: ${error.message}`);
      // Fallback to default entities
      return this.getDefaultEntities();
    }
  }

  async getEntitiesCreatedSince(timestamp) {
    try {
      const entities = await this.runNeo4jQuery(`
        MATCH (e:Entity)
        WHERE e.type IN ['club', 'league', 'venue', 'sports-organization', 'brand', 'team']
          AND e.created_at >= datetime('${timestamp}')
        OPTIONAL MATCH (e)-[:HAS_RFP]->(rfp:RFP)
        RETURN e.id as entity_id, e.name as name, e.type as type, 
               e.sport as sport, e.tier as tier, e.created_at as created_at,
               COUNT(rfp) as rfp_count
        ORDER BY e.created_at ASC
      `);
      
      log(`📊 Found ${entities.length} new entities since ${timestamp}`);
      return entities;
    } catch (error) {
      log(`❌ Failed to get new entities: ${error.message}`);
      return [];
    }
  }

  async runNeo4jQuery(query) {
    try {
      // Skip Neo4j connection if credentials are missing
      if (!this.neo4jUrl || !this.password) {
        throw new Error('Neo4j credentials not configured');
      }

      const auth = Buffer.from(`${this.username}:${this.password}`).toString('base64');
      const postData = JSON.stringify({
        statements: [{ statement: query }]
      });

      // Extract hostname and port from Neo4j URL
      const neo4jUrl = new URL(this.neo4jUrl);
      const hostname = neo4jUrl.hostname;
      const port = neo4jUrl.port || 7687; // Neo4j default port is 7687
      const protocol = neo4jUrl.protocol === 'neo4j+s:' ? 'https' : 'http';

      const options = {
        hostname: hostname,
        port: protocol === 'https' ? 7473 : 7474, // HTTP API port
        path: '/db/data/transaction/commit',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${auth}`,
          'Content-Length': Buffer.byteLength(postData),
          'User-Agent': 'Smart-RFP-Sync/1.0'
        },
        timeout: 30000 // 30 second timeout
      };

      return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
          let data = '';
          res.on('data', (chunk) => data += chunk);
          res.on('end', () => {
            try {
              const result = JSON.parse(data);
              if (result.errors && result.errors.length > 0) {
                throw new Error(`Neo4j query error: ${result.errors[0].message}`);
              }
              const entities = result.results?.[0]?.data?.map(row => ({
                entity_id: row.row[0],
                name: row.row[1],
                type: row.row[2],
                sport: row.row[3] || 'Multi-sport',
                tier: row.row[4] || 3,
                created_at: row.row[5],
                rfp_count: row.row[6]?.low || 0
              })) || [];
              resolve(entities);
            } catch (e) {
              reject(e);
            }
          });
        });

        req.on('error', reject);
        req.on('timeout', () => {
          req.destroy();
          reject(new Error('Neo4j connection timeout'));
        });
        
        req.write(postData);
        req.end();
      });
    } catch (error) {
      log(`⚠️ Neo4j connection failed: ${error.message}`);
      throw error;
    }
  }

  getDefaultEntities() {
    return [
      // Tier 1 Entities
      { entity_id: 'premier-league', name: 'Premier League', type: 'league', sport: 'Football', tier: 1 },
      { entity_id: 'manchester-united', name: 'Manchester United', type: 'club', sport: 'Football', tier: 1 },
      { entity_id: 'liverpool-fc', name: 'Liverpool FC', type: 'club', sport: 'Football', tier: 1 },
      { entity_id: 'chelsea-fc', name: 'Chelsea FC', type: 'club', sport: 'Football', tier: 1 },
      { entity_id: 'formula-1', name: 'Formula 1', type: 'organization', sport: 'Motorsport', tier: 1 },
      { entity_id: 'ferrari', name: 'Ferrari', type: 'team', sport: 'Motorsport', tier: 1 },
      { entity_id: 'wimbledon', name: 'Wimbledon', type: 'venue', sport: 'Tennis', tier: 1 },
      
      // Tier 2 Entities
      { entity_id: 'leicester-city', name: 'Leicester City', type: 'club', sport: 'Football', tier: 2 },
      { entity_id: 'celtic-fc', name: 'Celtic FC', type: 'club', sport: 'Football', tier: 2 },
      { entity_id: 'twickenham', name: 'Twickenham', type: 'venue', sport: 'Rugby', tier: 2 },
    ];
  }
}

/**
* RFP Opportunity Generator
*/
class RFPOpportunityGenerator {
  constructor() {
    this.opportunityTypes = [
      'digital_transformation',
      'fan_engagement', 
      'analytics_platform',
      'stadium_technology',
      'ecommerce_platform',
      'content_management'
    ];
  }

  generateOpportunityForEntity(entity) {
    const type = this.opportunityTypes[Math.floor(Math.random() * this.opportunityTypes.length)];
    const baseValue = this.getValueForTier(entity.tier);
    const variance = baseValue * 0.3;
    const value = `£${(baseValue + (Math.random() - 0.5) * variance).toFixed(1)}M`;
    
    return {
      entity_id: entity.entity_id,
      entity_name: entity.name,
      entity_type: entity.type,
      source: 'neo4j_sync',
      title: this.generateTitle(type, entity),
      content: this.generateContent(type, entity),
      keywords: this.generateKeywords(type),
      confidence: 80 + Math.floor(Math.random() * 15),
      timestamp: new Date().toISOString(),
      estimated_value: value,
      opportunity_type: type,
      yellow_panther_fit: 85 + Math.floor(Math.random() * 10),
      priority_score: entity.tier === 1 ? 10 : entity.tier === 2 ? 7 : 4,
      sport: entity.sport,
      tier: entity.tier
    };
  }

  generateTitle(type, entity) {
    const titles = {
      digital_transformation: `${entity.name} - Digital Transformation Partnership`,
      fan_engagement: `${entity.name} - Fan Engagement Platform Development`,
      analytics_platform: `${entity.name} - Advanced Analytics Platform`,
      stadium_technology: `${entity.name} - Stadium Technology Modernization`,
      ecommerce_platform: `${entity.name} - E-commerce Platform Enhancement`,
      content_management: `${entity.name} - Content Management System`
    };
    return titles[type] || `${entity.name} - Technology Partnership`;
  }

  generateContent(type, entity) {
    const templates = {
      digital_transformation: `${entity.name} is seeking a technology partner for comprehensive digital transformation. Project includes mobile applications, fan experience platforms, and data analytics infrastructure. Expected duration: 18-24 months.`,
      
      fan_engagement: `${entity.name} announced plans for next-generation fan engagement platform. Requirements include mobile app development, gamification systems, and personalized content delivery. Looking for proven sports technology partners.`,
      
      analytics_platform: `${entity.name} is investing in advanced analytics platform for performance and business intelligence. Seeking expertise in AI/ML, data visualization, and real-time processing systems.`,
      
      stadium_technology: `${entity.name} planning major stadium technology upgrade. Scope includes connectivity improvements, digital signage, mobile ticketing, and venue management systems.`,
      
      ecommerce_platform: `${entity.name} expanding e-commerce capabilities with new platform development. Requirements include global shipping, personalization engines, and inventory management integration.`,
      
      content_management: `${entity.name} modernizing content management and delivery systems. Need expertise in video streaming, digital rights management, and multi-platform content distribution.`
    };
    
    return templates[type] || `${entity.name} seeking technology partnership for digital initiatives.`;
  }

  generateKeywords(type) {
    const keywordMap = {
      digital_transformation: ['digital transformation', 'mobile app', 'cloud migration', 'api integration'],
      fan_engagement: ['fan engagement', 'gamification', 'mobile app', 'loyalty program'],
      analytics_platform: ['analytics', 'ai', 'machine learning', 'data visualization'],
      stadium_technology: ['stadium technology', 'digital signage', 'wi-fi', 'venue management'],
      ecommerce_platform: ['e-commerce', 'online store', 'mobile commerce', 'inventory'],
      content_management: ['content management', 'video streaming', 'digital rights', 'cms']
    };
    
    return keywordMap[type] || ['technology', 'digital', 'platform'];
  }

  getValueForTier(tier) {
    switch (tier) {
      case 1: return 4.5; // £4.5M average
      case 2: return 2.2; // £2.2M average  
      case 3: return 1.0; // £1M average
      default: return 1.5;
    }
  }
}

/**
* Main Smart Sync Service
*/
class SmartRFPSync {
  constructor() {
    this.stateManager = new SyncStateManager();
    this.neo4jService = new Neo4jEntityService();
    this.opportunityGenerator = new RFPOpportunityGenerator();
  }

  async run(options = {}) {
    const { forceFull = false, entityLimit = null, bypassWebhook = false } = options;
    
    log('🏆 STARTING SMART INCREMENTAL RFP SYNC');
    log('=' .repeat(50));
    
    const stats = this.stateManager.getSyncStats();
    log(`📊 Current sync state: ${stats.processedCount} entities processed, full sync: ${stats.isFullSync}`);
    
    try {
      let entitiesToProcess = [];
      
      if (!stats.isFullSync || forceFull) {
        log('🔄 Running FULL SYNC - processing all entities');
        entitiesToProcess = await this.neo4jService.getAllSportsEntities();
        this.stateManager.state.processedEntities = {}; // Reset for full sync
      } else {
        log('🔄 Running INCREMENTAL SYNC - processing new entities only');
        const lastSync = this.stateManager.getLastSyncTime();
        entitiesToProcess = await this.neo4jService.getEntitiesCreatedSince(lastSync);
        
        if (entitiesToProcess.length === 0) {
          log('✅ No new entities found since last sync');
          log(`📅 Last sync: ${lastSync}`);
          return { success: true, processed: 0, message: 'No new entities to process' };
        }
      }
      
      // Apply limit if specified
      if (entityLimit && entitiesToProcess.length > entityLimit) {
        entitiesToProcess = entitiesToProcess.slice(0, entityLimit);
        log(`📊 Processing limited batch of ${entityLimit} entities`);
      }
      
      log(`📊 Processing ${entitiesToProcess.length} entities`);
      
      let processed = 0;
      let failed = 0;
      let totalValue = 0;
      
      for (const entity of entitiesToProcess) {
        try {
          // Skip if already processed (unless forced)
          if (!forceFull && this.stateManager.isEntityProcessed(entity.entity_id)) {
            log(`⏭️  Skipping already processed: ${entity.name}`);
            continue;
          }
          
          log(`📋 Processing: ${entity.name} (${entity.type}, Tier ${entity.tier})`);
          
          // Generate RFP opportunity
          const opportunity = this.opportunityGenerator.generateOpportunityForEntity(entity);
          
          // Send to local API (or bypass for testing)
          let success;
          if (bypassWebhook) {
            log(`🧪 Bypass mode: Skipping webhook for ${entity.name}`);
            success = true;
          } else {
            success = await this.sendOpportunityToAPI(opportunity, entity);
          }
          
          if (success) {
            this.stateManager.markEntityProcessed(entity.entity_id, entity);
            processed++;
            totalValue += parseFloat(opportunity.estimated_value.replace(/[^0-9.]/g, ''));
            log(`✅ Processed: ${entity.name} - ${opportunity.estimated_value}`);
          } else {
            failed++;
            log(`❌ Failed: ${entity.name}`);
          }
          
          // Small delay to avoid overwhelming the system
          await new Promise(resolve => setTimeout(resolve, 500));
          
        } catch (error) {
          failed++;
          log(`❌ Error processing ${entity.name}: ${error.message}`);
        }
      }
      
      // Update sync state
      if (!stats.isFullSync || forceFull) {
        this.stateManager.markFullSyncCompleted();
      } else {
        this.stateManager.state.lastSync = new Date().toISOString();
      }
      
      this.stateManager.saveState();
      
      const summary = {
        success: true,
        processed,
        failed,
        total: entitiesToProcess.length,
        totalValue: `£${totalValue.toFixed(1)}M`,
        syncType: stats.isFullSync && !forceFull ? 'incremental' : 'full'
      };
      
      log('🎉 SMART SYNC COMPLETED');
      log(`📊 Summary: ${processed}/${entitiesToProcess.length} successful, ${summary.totalValue} total value`);
      log(`🔄 Sync type: ${summary.syncType}`);
      
      return summary;
      
    } catch (error) {
      log(`💥 SMART SYNC FAILED: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async sendOpportunityToAPI(opportunity, entity) {
    return new Promise((resolve) => {
      // Format payload to match webhook expectations
      const webhookPayload = {
        source: 'procurement', // Smart sync generates procurement opportunities
        content: opportunity.content,
        url: undefined, // Can be added later if needed
        keywords: opportunity.keywords,
        metadata: {
          entity_id: entity.entity_id,
          entity_name: entity.name,
          entity_type: entity.type,
          sport: entity.sport,
          tier: entity.tier,
          estimated_value: opportunity.estimated_value,
          opportunity_type: opportunity.opportunity_type,
          yellow_panther_fit: opportunity.yellow_panther_fit,
          priority_score: opportunity.priority_score,
          confidence: opportunity.confidence,
          smart_sync: true,
          sync_type: 'incremental'
        },
        timestamp: new Date().toISOString().slice(0, 23) + 'Z', // Format: YYYY-MM-DDTHH:MM:SS.000Z
        confidence: opportunity.confidence / 100, // Convert to decimal
        entity_id: entity.entity_id
      };
      
      const postData = JSON.stringify(webhookPayload);
      
      const options = {
        hostname: 'localhost',
        port: 3005,
        path: '/api/mines/webhook',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'X-Smart-Sync': 'true',
          'User-Agent': 'Smart-RFP-Sync/1.0'
        },
        timeout: 30000 // 30 second timeout
      };

      const http = require('http');
      const req = http.request(options, (res) => {
        let data = '';
        
        // Handle redirects
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          log(`⚠️ Webhook redirect detected: ${res.statusCode} -> ${res.headers.location}`);
          resolve(false);
          return;
        }
        
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          const success = res.statusCode === 200;
          if (!success) {
            log(`❌ Webhook failed: ${res.statusCode} - ${data.substring(0, 200)}`);
          } else {
            log(`✅ Webhook success: ${data.substring(0, 100)}`);
          }
          resolve(success);
        });
      });

      req.on('error', (error) => {
        log(`❌ Webhook request error: ${error.message}`);
        resolve(false);
      });
      
      req.on('timeout', () => {
        req.destroy();
        log(`❌ Webhook request timeout`);
        resolve(false);
      });
      
      req.write(postData);
      req.end();
    });
  }
}

/**
* CLI Interface
*/
async function main() {
  const args = process.argv.slice(2);
  const options = {
    forceFull: args.includes('--force-full'),
    entityLimit: null,
    bypassWebhook: args.includes('--bypass')
  };
  
  // Parse entity limit
  const limitIndex = args.findIndex(arg => arg.startsWith('--limit='));
  if (limitIndex !== -1) {
    options.entityLimit = parseInt(args[limitIndex].split('=')[1]);
  }
  
  const sync = new SmartRFPSync();
  const result = await sync.run(options);
  
  if (!result.success) {
    process.exit(1);
  }
}

// Export for testing
module.exports = { SmartRFPSync, SyncStateManager };

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
}