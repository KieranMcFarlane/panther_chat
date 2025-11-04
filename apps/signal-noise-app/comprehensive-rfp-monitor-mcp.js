#!/usr/bin/env node

/**
 * 🎯 Complete RFP Monitoring & Detection System (MCP Integration)
 * 
 * Comprehensive RFP monitoring system designed to traverse all Neo4j entities
 * and detect Request for Proposals from multiple sources using MCP tools.
 * 
 * Process:
 * 1. Query ALL entities from Neo4j using batches of 300 until all (~4,000) have been checked
 * 2. Maintain running JSON state between batches (do not reset)
 * 3. For each batch: Use BrightData and Perplexity to detect RFPs
 * 4. Append structured records to results
 * 5. Write all unique records to Supabase (table: rfp_opportunities)
 * 6. Return structured JSON summary
 */

const fs = require('fs').promises;
const path = require('path');

// Import MCP Tool Executor (need to handle TypeScript import)
const { spawn } = require('child_process');
const util = require('util');

// State file for maintaining progress between batches
const STATE_FILE = './rfp-monitoring-state.json';
const RESULTS_FILE = './rfp-monitoring-results.json';

// RFP Detection Keywords (from document)
const RFP_KEYWORDS = {
  direct_rfp: [
    "request for proposal", "RFP", "request for tender", "RFT",
    "invitation to tender", "ITT", "soliciting proposals", "EOI",
    "expression of interest", "call for proposals", "CFP",
    "vendor selection", "procurement process", "bidding process",
    "supplier evaluation", "tender invitation", "contract opportunity",
    "invites proposals", "soliciting proposals"
  ],
  
  digital_projects: [
    "digital transformation", "website development", "mobile app",
    "application development", "web development", "software development",
    "digital platform", "online platform", "digital solution",
    "technology implementation", "system integration", "digital overhaul",
    "strategic redesign", "redevelopment", "comprehensive digital"
  ],
  
  sports_digital: [
    "fan engagement platform", "ticketing system", "sports app",
    "fan experience", "digital stadium", "mobile ticketing",
    "sports technology", "digital sports", "athlete management",
    "competition management", "league management", "federation platform",
    "fan-centric"
  ],
  
  investment_signals: [
    "strategic investment", "budget allocation", "capital expenditure",
    "million pounds", "million dollars", "€", "£", "$", "investment",
    "funding initiative", "financial commitment", "budget approved"
  ],
  
  urgency_signals: [
    "immediate opportunity", "seeking partners", "urgent requirement",
    "fast-track", "expedited process", "immediate start", "priority project",
    "deadline approaching", "submission deadline", "closing date"
  ]
};

class MCPHelper {
  constructor() {
    this.mcpToolExecutor = null;
  }

  async initialize() {
    // For Node.js environment, we'll use direct MCP tool calls
    console.log('🔧 Initializing MCP Helper...');
  }

  async executeNeo4jQuery(query, params = {}) {
    try {
      console.log(`🔍 Executing Neo4j query: ${query.substring(0, 100)}...`);
      
      // Direct MCP call - the tools are available globally in this environment
      const result = await mcp__neo4j-mcp__execute_query({ query, params });
      
      console.log(`✅ Neo4j query returned ${result?.records?.length || 0} records`);
      return result;
    } catch (error) {
      console.error('❌ Neo4j query failed:', error.message);
      return { records: [], error: error.message };
    }
  }

  async executeBrightDataSearch(query, engine = 'google') {
    try {
      console.log(`🌐 BrightData search: ${query}`);
      
      const result = await mcp__brightdata-mcp__search_engine({ query, engine });
      
      console.log(`✅ BrightData search returned ${result?.results?.length || 0} results`);
      return result;
    } catch (error) {
      console.error('❌ BrightData search failed:', error.message);
      return { results: [], error: error.message };
    }
  }

  async executePerplexityChat(messages, temperature = 0.3, include_sources = true) {
    try {
      console.log(`🧠 Perplexity chat with ${messages.length} messages`);
      
      const result = await mcp__perplexity-mcp__chat_completion({
        messages,
        temperature,
        include_sources
      });
      
      console.log(`✅ Perplexity chat completed`);
      return result;
    } catch (error) {
      console.error('❌ Perplexity chat failed:', error.message);
      return { content: '', error: error.message };
    }
  }

  async executeSupabaseSQL(query, params = []) {
    try {
      console.log(`💾 Executing Supabase SQL: ${query.substring(0, 100)}...`);
      
      const result = await mcp__supabase__execute_sql({ query, params });
      
      console.log(`✅ Supabase SQL completed`);
      return result;
    } catch (error) {
      console.error('❌ Supabase SQL failed:', error.message);
      return { error: error.message };
    }
  }
}

class RFPMonitoringSystem {
  constructor() {
    this.batchSize = 300;
    this.state = null;
    this.results = [];
    this.startTime = new Date().toISOString();
    this.mcpHelper = new MCPHelper();
  }

  async initialize() {
    console.log('🚀 Initializing RFP Monitoring System...');
    
    // Initialize MCP helper
    await this.mcpHelper.initialize();
    
    // Load existing state or create new
    try {
      const stateData = await fs.readFile(STATE_FILE, 'utf8');
      this.state = JSON.parse(stateData);
      console.log(`📂 Resumed from batch ${this.state.currentBatch}, entities checked: ${this.state.entitiesChecked}`);
    } catch (error) {
      // Create new state
      this.state = {
        startedAt: this.startTime,
        currentBatch: 0,
        entitiesChecked: 0,
        totalEntities: 0,
        rfpsDetected: 0,
        lastEntityOffset: 0,
        status: 'initialized',
        errors: []
      };
      console.log('🆕 Started new monitoring session');
    }

    // Load existing results
    try {
      const resultsData = await fs.readFile(RESULTS_FILE, 'utf8');
      const existingResults = JSON.parse(resultsData);
      this.results = existingResults.rfp_opportunities || [];
      console.log(`📊 Loaded ${this.results.length} existing RFP records`);
    } catch (error) {
      this.results = [];
      console.log('📊 No existing results found, starting fresh');
    }
  }

  async saveState() {
    this.state.lastUpdated = new Date().toISOString();
    await fs.writeFile(STATE_FILE, JSON.stringify(this.state, null, 2));
  }

  async saveResults() {
    const resultsPayload = {
      monitoring_session: {
        started_at: this.state.startedAt,
        last_updated: new Date().toISOString(),
        total_entities_checked: this.state.entitiesChecked,
        total_batches_processed: this.state.currentBatch,
        total_rfps_detected: this.state.rfpsDetected,
        status: this.state.status
      },
      rfp_opportunities: this.results
    };
    
    await fs.writeFile(RESULTS_FILE, JSON.stringify(resultsPayload, null, 2));
  }

  async getNextEntityBatch() {
    console.log(`🔍 Fetching batch ${this.state.currentBatch + 1} (entities ${this.state.lastEntityOffset} - ${this.state.lastEntityOffset + this.batchSize})...`);
    
    const query = `
      MATCH (e:Entity)
      WHERE e.type IN ['Club','League','Federation','Tournament']
      RETURN e.name as name, e.type as type, e.sport as sport, e.country as country, e.linkedin as linkedin
      SKIP ${this.state.lastEntityOffset}
      LIMIT ${this.batchSize}
    `;
    
    try {
      const result = await this.mcpHelper.executeNeo4jQuery(query);
      
      if (!result.records || result.records.length === 0) {
        console.log('✅ All entities have been processed');
        return null; // No more entities
      }
      
      const entities = result.records.map(record => ({
        name: record.name,
        type: record.type,
        sport: record.sport,
        country: record.country,
        linkedin: record.linkedin
      }));
      
      console.log(`📋 Retrieved ${entities.length} entities for processing`);
      this.state.lastEntityOffset += entities.length;
      return entities;
      
    } catch (error) {
      console.error('❌ Error fetching entity batch:', error);
      this.state.errors.push({
        timestamp: new Date().toISOString(),
        batch: this.state.currentBatch,
        error: error.message
      });
      return [];
    }
  }

  async detectRFPsForEntity(entity) {
    const rfpDetections = [];
    
    console.log(`🔎 Analyzing ${entity.name} (${entity.type}, ${entity.sport}, ${entity.country})`);
    
    // 1. BrightData Search for LinkedIn and web content
    const brightDataSearches = [
      // LinkedIn specific searches
      `site:linkedin.com "${entity.name}" ${RFP_KEYWORDS.direct_rfp.slice(0, 3).join(' OR ')}`,
      `site:linkedin.com "${entity.name}" ${RFP_KEYWORDS.digital_projects.slice(0, 3).join(' OR ')}`,
      
      // General web searches
      `"${entity.name}" ${RFP_KEYWORDS.direct_rfp.slice(0, 2).join(' OR ')} ${RFP_KEYWORDS.digital_projects.slice(0, 2).join(' OR ')}`,
      `"${entity.name}" ${RFP_KEYWORDS.sports_digital.slice(0, 2).join(' OR ')} ${RFP_KEYWORDS.investment_signals.slice(0, 2).join(' OR ')}`
    ];
    
    for (const searchQuery of brightDataSearches) {
      try {
        console.log(`🌐 BrightData search: ${searchQuery}`);
        const searchResult = await this.mcpHelper.executeBrightDataSearch(searchQuery);
        
        if (searchResult && searchResult.results && searchResult.results.length > 0) {
          const rfpRecord = this.analyzeSearchResults(entity, searchResult, 'brightdata', searchQuery);
          if (rfpRecord) {
            rfpDetections.push(rfpRecord);
          }
        }
        
        // Add small delay between searches
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`❌ BrightData search failed for ${entity.name}:`, error.message);
      }
    }
    
    // 2. Perplexity search for market intelligence
    try {
      const perplexityQuery = `
        Research "${entity.name}" for any recent digital transformation initiatives, RFPs, tenders, or technology partnership opportunities 
        in the last 6 months. Focus on mobile app development, website projects, fan engagement systems, or digital platform modernization.
      `;
      
      console.log(`🧠 Perplexity research: ${entity.name}`);
      const perplexityResult = await this.mcpHelper.executePerplexityChat([
        {
          role: 'system',
          content: 'You are a market intelligence analyst specializing in sports industry RFP detection and digital transformation opportunities.'
        },
        {
          role: 'user',
          content: perplexityQuery
        }
      ]);
      
      if (perplexityResult && perplexityResult.content) {
        const rfpRecord = this.analyzePerplexityResult(entity, perplexityResult, 'perplexity', perplexityQuery);
        if (rfpRecord) {
          rfpDetections.push(rfpRecord);
        }
      }
      
    } catch (error) {
      console.error(`❌ Perplexity research failed for ${entity.name}:`, error.message);
    }
    
    return rfpDetections;
  }

  analyzeSearchResults(entity, searchResult, source, searchQuery) {
    if (!searchResult.results || searchResult.results.length === 0) {
      return null;
    }
    
    const relevantResults = searchResult.results.filter(result => {
      const text = `${result.title || ''} ${result.description || ''}`.toLowerCase();
      
      // Check for RFP keywords
      const hasRFPKeywords = RFP_KEYWORDS.direct_rfp.some(keyword => 
        text.includes(keyword.toLowerCase())
      );
      
      const hasDigitalKeywords = RFP_KEYWORDS.digital_projects.some(keyword => 
        text.includes(keyword.toLowerCase())
      );
      
      const hasSportsKeywords = RFP_KEYWORDS.sports_digital.some(keyword => 
        text.includes(keyword.toLowerCase())
      );
      
      return hasRFPKeywords && (hasDigitalKeywords || hasSportsKeywords);
    });
    
    if (relevantResults.length === 0) {
      return null;
    }
    
    // Calculate confidence score
    const confidence = Math.min(0.95, 0.6 + (relevantResults.length * 0.1));
    
    // Generate summary
    const summary = {
      entity: entity.name,
      source: source,
      search_query: searchQuery,
      total_results: searchResult.results.length,
      relevant_results: relevantResults.length,
      sample_findings: relevantResults.slice(0, 3).map(r => ({
        title: r.title,
        url: r.url,
        description: r.description ? r.description.substring(0, 200) + '...' : null
      }))
    };
    
    return {
      organization: entity.name,
      type: entity.type,
      sport: entity.sport,
      country: entity.country,
      src_link: relevantResults[0]?.url || null,
      summary_json: summary,
      confidence: confidence,
      detected_at: new Date().toISOString(),
      detection_method: source
    };
  }

  analyzePerplexityResult(entity, perplexityResult, source, query) {
    const content = perplexityResult.content.toLowerCase();
    
    // Check if the content mentions RFPs or opportunities
    const hasOpportunityMention = 
      content.includes('rfp') ||
      content.includes('proposal') ||
      content.includes('tender') ||
      content.includes('opportunity') ||
      content.includes('initiative') ||
      content.includes('project') ||
      content.includes('partnership');
    
    if (!hasOpportunityMention) {
      return null;
    }
    
    // Extract key opportunities
    const opportunities = [];
    if (content.includes('digital')) opportunities.push('digital_transformation');
    if (content.includes('mobile') || content.includes('app')) opportunities.push('mobile_app');
    if (content.includes('website') || content.includes('web')) opportunities.push('web_development');
    if (content.includes('fan') || content.includes('engagement')) opportunities.push('fan_engagement');
    if (content.includes('ticket')) opportunities.push('ticketing_system');
    
    if (opportunities.length === 0) {
      return null;
    }
    
    return {
      organization: entity.name,
      type: entity.type,
      sport: entity.sport,
      country: entity.country,
      src_link: null, // Perplexity may not provide direct URLs
      summary_json: {
        entity: entity.name,
        source: source,
        query: query,
        content_summary: perplexityResult.content.substring(0, 500) + '...',
        opportunities_detected: opportunities,
        sources: perplexityResult.sources || []
      },
      confidence: 0.75, // Moderate confidence for Perplexity results
      detected_at: new Date().toISOString(),
      detection_method: source
    };
  }

  async processBatch(entities) {
    console.log(`🔄 Processing batch with ${entities.length} entities...`);
    
    const batchResults = [];
    
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      
      try {
        const rfpDetections = await this.detectRFPsForEntity(entity);
        
        if (rfpDetections.length > 0) {
          batchResults.push(...rfpDetections);
          this.state.rfpsDetected += rfpDetections.length;
          console.log(`🎯 ${entity.name}: ${rfpDetections.length} RFP(s) detected`);
        } else {
          console.log(`➖ ${entity.name}: No RFPs detected`);
        }
        
        this.state.entitiesChecked++;
        
        // Save progress every 10 entities
        if (i % 10 === 0) {
          await this.saveState();
        }
        
      } catch (error) {
        console.error(`❌ Error processing entity ${entity.name}:`, error);
        this.state.errors.push({
          timestamp: new Date().toISOString(),
          entity: entity.name,
          error: error.message
        });
      }
      
      // Small delay between entities
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    return batchResults;
  }

  async storeRFPOpportunities(rfpRecords) {
    if (rfpRecords.length === 0) {
      return 0;
    }
    
    console.log(`💾 Storing ${rfpRecords.length} RFP opportunities to Supabase...`);
    
    try {
      // Check if rfp_opportunities table exists, create if not
      const createTableQuery = `
        CREATE TABLE IF NOT EXISTS rfp_opportunities (
          id SERIAL PRIMARY KEY,
          organization TEXT NOT NULL,
          type TEXT,
          sport TEXT,
          country TEXT,
          src_link TEXT,
          summary_json JSONB,
          confidence DECIMAL(3,2),
          detected_at TIMESTAMP WITH TIME ZONE,
          detection_method TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(organization, detected_at, src_link)
        );
      `;
      
      await this.mcpHelper.executeSupabaseSQL(createTableQuery);
      
      let storedCount = 0;
      
      for (const rfp of rfpRecords) {
        try {
          // Insert or ignore duplicate records
          const insertQuery = `
            INSERT INTO rfp_opportunities 
            (organization, type, sport, country, src_link, summary_json, confidence, detected_at, detection_method)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (organization, detected_at, src_link) DO NOTHING
          `;
          
          await this.mcpHelper.executeSupabaseSQL(insertQuery, [
            rfp.organization,
            rfp.type,
            rfp.sport,
            rfp.country,
            rfp.src_link,
            JSON.stringify(rfp.summary_json),
            rfp.confidence,
            rfp.detected_at,
            rfp.detection_method
          ]);
          
          storedCount++;
        } catch (error) {
          // If insert fails, might be a duplicate or constraint violation
          console.log(`⚠️ Could not store RFP for ${rfp.organization}: ${error.message}`);
        }
      }
      
      console.log(`✅ Successfully stored ${storedCount} new RFP opportunities`);
      return storedCount;
      
    } catch (error) {
      console.error('❌ Error storing RFP opportunities:', error);
      this.state.errors.push({
        timestamp: new Date().toISOString(),
        operation: 'store_rfps',
        error: error.message
      });
      return 0;
    }
  }

  generateSummaryReport() {
    // Get top 10 highlights
    const topRFPs = this.results
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 10);
    
    // Get unique source links
    const sourceLinks = [...new Set(this.results
      .filter(rfp => rfp.src_link)
      .map(rfp => rfp.src_link)
    )];
    
    // Group by sport
    const bySport = this.results.reduce((acc, rfp) => {
      const sport = rfp.sport || 'Unknown';
      acc[sport] = (acc[sport] || 0) + 1;
      return acc;
    }, {});
    
    // Group by type
    const byType = this.results.reduce((acc, rfp) => {
      const type = rfp.type || 'Unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});
    
    return {
      total_rfps_detected: this.state.rfpsDetected,
      entities_checked: this.state.entitiesChecked,
      batch_count: this.state.currentBatch,
      
      highlights: topRFPs.map(rfp => ({
        organization: rfp.organization,
        type: rfp.type,
        sport: rfp.sport,
        confidence: rfp.confidence,
        detection_method: rfp.detection_method,
        key_findings: rfp.summary_json?.sample_findings?.[0]?.title || rfp.summary_json?.opportunities_detected?.join(', ') || 'RFP detected',
        src_link: rfp.src_link
      })),
      
      source_links: sourceLinks,
      
      analytics: {
        by_sport: bySport,
        by_type: byType,
        by_detection_method: this.results.reduce((acc, rfp) => {
          const method = rfp.detection_method || 'Unknown';
          acc[method] = (acc[method] || 0) + 1;
          return acc;
        }, {}),
        confidence_distribution: {
          high: this.results.filter(r => r.confidence >= 0.8).length,
          medium: this.results.filter(r => r.confidence >= 0.6 && r.confidence < 0.8).length,
          low: this.results.filter(r => r.confidence < 0.6).length
        }
      }
    };
  }

  async run() {
    try {
      await this.initialize();
      
      console.log('🎯 Starting RFP monitoring...');
      this.state.status = 'running';
      await this.saveState();
      
      let hasMoreEntities = true;
      
      while (hasMoreEntities) {
        this.state.currentBatch++;
        
        // Get next batch of entities
        const entities = await this.getNextEntityBatch();
        
        if (!entities || entities.length === 0) {
          hasMoreEntities = false;
          break;
        }
        
        // Process the batch
        const batchResults = await this.processBatch(entities);
        
        if (batchResults.length > 0) {
          // Add to results
          this.results.push(...batchResults);
          
          // Store to Supabase
          await this.storeRFPOpportunities(batchResults);
        }
        
        // Save progress
        await this.saveState();
        await this.saveResults();
        
        console.log(`✅ Batch ${this.state.currentBatch} completed. Total RFPs: ${this.state.rfpsDetected}`);
      }
      
      // Generate final summary
      this.state.status = 'completed';
      this.state.completedAt = new Date().toISOString();
      await this.saveState();
      await this.saveResults();
      
      const summaryReport = this.generateSummaryReport();
      
      // Save summary report
      const summaryFile = `./rfp-monitoring-summary-${new Date().toISOString().split('T')[0]}.json`;
      await fs.writeFile(summaryFile, JSON.stringify(summaryReport, null, 2));
      
      console.log('\n🎉 RFP Monitoring Complete!');
      console.log(`📊 Total entities checked: ${this.state.entitiesChecked}`);
      console.log(`🎯 Total RFPs detected: ${this.state.rfpsDetected}`);
      console.log(`📁 Summary report saved to: ${summaryFile}`);
      console.log(`📁 Results saved to: ${RESULTS_FILE}`);
      
      return summaryReport;
      
    } catch (error) {
      console.error('❌ Fatal error in RFP monitoring:', error);
      this.state.status = 'error';
      this.state.errors.push({
        timestamp: new Date().toISOString(),
        error: error.message,
        fatal: true
      });
      await this.saveState();
      throw error;
    }
  }
}

// CLI Interface
async function main() {
  const system = new RFPMonitoringSystem();
  
  try {
    const results = await system.run();
    
    // Output JSON for programmatic use
    console.log('\n=== RFP MONITORING RESULTS ===');
    console.log(JSON.stringify(results, null, 2));
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ RFP monitoring failed:', error);
    process.exit(1);
  }
}

// Allow running as script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = RFPMonitoringSystem;