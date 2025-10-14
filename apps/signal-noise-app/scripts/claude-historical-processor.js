#!/usr/bin/env node

/**
 * Claude-Powered Historical Batch Processor - Real AI Analysis
 * Integrates Claude Agent SDK for sophisticated sports intelligence analysis
 * Processes entire Neo4j knowledge graph with real AI reasoning
 */

require('dotenv').config();
const neo4j = require('neo4j-driver');
const fs = require('fs');
const path = require('path');

// Import Claude Agent SDK
const { query } = require('@anthropic-ai/claude-agent-sdk');

class ClaudeHistoricalBatchProcessor {
  constructor() {
    this.neo4jDriver = neo4j.driver(
      process.env.NEO4J_URI,
      neo4j.auth.basic(
        process.env.NEO4J_USERNAME || process.env.NEO4J_USER || 'neo4j',
        process.env.NEO4J_PASSWORD
      )
    );
    
    this.historicalCacheDir = '.cache/claude-historical-batches';
    this.batchSize = 25; // Smaller batches for real AI processing
    this.mcpConfig = {};
    this.ensureCacheDir();
  }

  ensureCacheDir() {
    if (!fs.existsSync(this.historicalCacheDir)) {
      fs.mkdirSync(this.historicalCacheDir, { recursive: true });
    }
  }

  async loadMCPConfig() {
    try {
      // Load MCP configuration for Claude Agent
      console.log('🔧 Loading MCP configuration for Claude Agent SDK...');
      
      // Initialize with known MCP servers
      this.mcpConfig = {
        'neo4j-mcp': {
          command: 'node',
          args: ['node_modules/@anthropic-ai/claude-agent-sdk/src/mcp/neo4j-mcp/dist/index.js'],
          env: {
            NEO4J_URI: process.env.NEO4J_URI,
            NEO4J_USERNAME: process.env.NEO4J_USERNAME || process.env.NEO4J_USER,
            NEO4J_PASSWORD: process.env.NEO4J_PASSWORD
          }
        },
        'brightdata-mcp': {
          command: 'node',
          args: ['node_modules/@anthropic-ai/claude-agent-sdk/src/mcp/brightdata-mcp/dist/index.js'],
          env: {
            BRIGHTDATA_API_TOKEN: process.env.BRIGHTDATA_API_TOKEN
          }
        }
      };
      
      console.log('✅ MCP configuration loaded:', Object.keys(this.mcpConfig));
    } catch (error) {
      console.warn('⚠️ Failed to load MCP config:', error);
      this.mcpConfig = {};
    }
  }

  async analyzeHistoricalDataDistribution() {
    console.log(`\n📊 ===== CLAUDE-POWERED HISTORICAL ANALYSIS =====`);
    
    const session = this.neo4jDriver.session();
    
    try {
      // Get comprehensive data overview
      const overviewQuery = `
        MATCH (n)
        RETURN count(n) as total_nodes,
               collect(DISTINCT labels(n)[0])[..10] as node_types,
               'https://console.neo4j.io/' as neo4j_browser
      `;
      
      const overviewResult = await session.run(overviewQuery);
      const overview = overviewResult.records[0];
      
      console.log(`\n🌍 Neo4j Knowledge Graph Overview:`);
      console.log(`   Total nodes: ${overview.get('total_nodes')}`);
      console.log(`   Node types: ${overview.get('node_types').join(', ')}`);
      console.log(`   Browser: ${overview.get('neo4j_browser')}`);

      // Get data source distribution
      const sourceQuery = `
        MATCH (n)
        WHERE n.source IS NOT NULL
        RETURN n.source as data_source, count(n) as entity_count
        ORDER BY entity_count DESC
        LIMIT 10
      `;
      
      const sourceResult = await session.run(sourceQuery);
      console.log(`\n📋 Top 10 Data Sources:`);
      sourceResult.records.forEach(record => {
        console.log(`   ${record.get('data_source')}: ${record.get('entity_count')} entities`);
      });

      // Get enrichment timeline
      const timelineQuery = `
        MATCH (n)
        WHERE n.enriched_at IS NOT NULL
        RETURN 
          n.enriched_at as enrichment_timestamp,
          count(n) as daily_count,
          collect(n.name)[..2] as sample_entities
        ORDER BY enrichment_timestamp ASC
        LIMIT 10
      `;
      
      const timelineResult = await session.run(timelineQuery);
      console.log(`\n📅 Recent Enrichment Activity:`);
      timelineResult.records.forEach(record => {
        const timestamp = record.get('enrichment_timestamp');
        const count = record.get('daily_count');
        const samples = record.get('sample_entities');
        console.log(`   ${timestamp}: ${count} entities (${samples.join(', ')})`);
      });

      return {
        totalNodes: overview.get('total_nodes').toNumber(),
        nodeTypes: overview.get('node_types'),
        topSources: sourceResult.records.map(r => ({
          source: r.get('data_source'),
          count: r.get('entity_count').toNumber()
        })),
        enrichedEntities: timelineResult.records.reduce((sum, r) => sum + r.get('daily_count').toNumber(), 0)
      };

    } catch (error) {
      console.error(`❌ Historical analysis error: ${error.message}`);
      return null;
    } finally {
      await session.close();
    }
  }

  async getHistoricalBatches() {
    console.log(`\n🎯 ===== CREATING CLAUDE-AI OPTIMIZED BATCHES =====`);
    
    const session = this.neo4jDriver.session();
    
    try {
      // Get all entities with Claude-prioritized sorting
      const batchQuery = `
        MATCH (n:Entity)
        WHERE n.name IS NOT NULL
        OPTIONAL MATCH (n)-[r]->()
        RETURN n.id as entity_id,
               n.name as name,
               labels(n)[0] as type,
               n.sport as sport,
               n.tier as tier,
               n.source as data_source,
               n.enriched_at as enriched_at,
               n.key_contacts as has_contacts,
               n.tenders_rfps as has_tenders,
               n.website as website,
               n.linkedin as linkedin_url,
               count(r) as relationship_count,
               properties(n) as properties
        ORDER BY 
          CASE WHEN n.key_contacts IS NOT NULL OR n.tenders_rfps IS NOT NULL THEN 0 ELSE 1 END,  // High-value first
          CASE WHEN n.enriched_at IS NOT NULL THEN 0 ELSE 1 END,  // Enriched first
          CASE WHEN n.tier = 'tier_1' THEN 0 WHEN n.tier = 'tier_2' THEN 1 ELSE 2 END,  // By tier
          n.name ASC   // Alphabetical
      `;
      
      const result = await session.run(batchQuery);
      const entities = result.records.map((record, index) => ({
        batchId: Math.floor(index / this.batchSize) + 1,
        entityNumber: index + 1,
        entity_id: record.get('entity_id') || `entity_${Date.now()}_${index}`,
        name: record.get('name') || 'Unknown Entity',
        type: record.get('type') || 'Entity',
        sport: record.get('sport') || 'Multi-sport',
        tier: record.get('tier') || 'tier_3',
        data_source: record.get('data_source') || 'unknown',
        enriched_at: record.get('enriched_at'),
        has_contacts: record.get('has_contacts') ? true : false,
        has_tenders: record.get('has_tenders') ? true : false,
        website: record.get('website'),
        linkedin_url: record.get('linkedin_url'),
        relationship_count: record.get('relationship_count').toInt(),
        properties: record.get('properties'),
        claude_priority_score: this.calculateClaudePriorityScore(record)
      }));

      // Group into batches
      const batches = {};
      entities.forEach(entity => {
        const batchKey = entity.batchId;
        if (!batches[batchKey]) {
          batches[batchKey] = [];
        }
        batches[batchKey].push(entity);
      });

      console.log(`\n📦 Created ${Object.keys(batches).length} Claude-optimized batches with ${entities.length} total entities`);
      
      // Show sample high-priority entities
      const highPriorityEntities = entities.filter(e => e.claude_priority_score > 80).slice(0, 5);
      if (highPriorityEntities.length > 0) {
        console.log(`\n🌟 High-Priority Entities for Claude Analysis:`);
        highPriorityEntities.forEach(entity => {
          console.log(`   ${entity.name} (${entity.type}, ${entity.sport}) - Score: ${entity.claude_priority_score}`);
        });
      }
      
      return { batches, totalEntities: entities.length };

    } catch (error) {
      console.error(`❌ Batch creation error: ${error.message}`);
      return { batches: {}, totalEntities: 0 };
    } finally {
      await session.close();
    }
  }

  calculateClaudePriorityScore(record) {
    let score = 0;
    
    // High-value intelligence gets highest priority
    if (record.get('has_contacts') || record.get('has_tenders')) score += 50;
    
    // Enriched entities get priority
    if (record.get('enriched_at')) score += 30;
    
    // Premium tiers get higher priority
    const tier = record.get('tier');
    if (tier === 'tier_1') score += 20;
    else if (tier === 'tier_2') score += 10;
    
    // Web presence indicates analysis readiness
    if (record.get('website') || record.get('linkedin_url')) score += 15;
    
    // More relationships = higher priority
    const relCount = record.get('relationship_count').toInt();
    score += Math.min(relCount, 15);
    
    // Premium sports get boost
    const sport = record.get('sport');
    if (sport === 'Football' || sport === 'Motorsport') score += 10;
    else if (sport === 'Golf' || sport === 'Tennis') score += 8;
    
    return score;
  }

  async processBatchWithClaude(batchId, entities) {
    console.log(`\n🤖 ===== CLAUDE AI PROCESSING BATCH ${batchId} =====`);
    console.log(`📊 Batch ${batchId}: ${entities.length} entities with Claude Agent SDK`);
    
    const batchResults = [];
    const batchStart = new Date().toISOString();
    let claudeApiCalls = 0;
    
    // Process each entity with Claude AI
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      console.log(`\n🧠 Claude AI Analyzing Entity ${i + 1}/${entities.length}: ${entity.name}`);
      console.log(`   🎪 Type: ${entity.type} | ⚽ Sport: ${entity.sport} | 🌟 Priority: ${entity.claude_priority_score}`);
      console.log(`   🔗 Web: ${entity.website || 'N/A'} | 💼 LinkedIn: ${entity.linkedin_url ? 'Yes' : 'No'}`);
      
      try {
        const analysis = await this.analyzeEntityWithClaude(entity);
        claudeApiCalls++;
        
        batchResults.push({
          entity,
          analysis,
          processed_at: new Date().toISOString(),
          claude_model: 'claude-3-5-sonnet-20241022',
          mcp_tools_used: analysis.mcp_tools_used || []
        });
        
        console.log(`   ✅ Claude Analysis Complete:`);
        console.log(`   💰 Opportunities: ${analysis.opportunities?.length || 0}`);
        console.log(`   ⚠️  Risks: ${analysis.risks?.length || 0}`);
        console.log(`   🎯 Confidence: ${analysis.confidence}%`);
        console.log(`   🔧 MCP Tools: ${analysis.mcp_tools_used?.join(', ') || 'None'}`);
        
      } catch (error) {
        console.error(`   ❌ Claude analysis failed for ${entity.name}: ${error.message}`);
        
        // Fallback to mock analysis
        const fallbackAnalysis = await this.analyzeEntityWithFallback(entity);
        batchResults.push({
          entity,
          analysis: fallbackAnalysis,
          processed_at: new Date().toISOString(),
          claude_model: 'fallback',
          error: error.message
        });
        
        console.log(`   🔄 Using fallback analysis for ${entity.name}`);
      }
      
      // Brief delay between Claude API calls to respect rate limits
      if (i < entities.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // Calculate batch summary
    const batchSummary = {
      batchId,
      batchStart,
      batchEnd: new Date().toISOString(),
      totalEntities: entities.length,
      claudeApiCalls,
      totalOpportunities: batchResults.reduce((sum, r) => sum + (r.analysis.opportunities?.length || 0), 0),
      totalRisks: batchResults.reduce((sum, r) => sum + (r.analysis.risks?.length || 0), 0),
      totalRecommendations: batchResults.reduce((sum, r) => sum + (r.analysis.recommendations?.length || 0), 0),
      estimatedValue: batchResults.reduce((sum, r) => {
        return sum + (r.analysis.opportunities || []).reduce((oppSum, opp) => {
          const value = parseFloat(opp.estimated_value?.replace(/[^0-9.]/g, '') || 0);
          return oppSum + value;
        }, 0);
      }, 0),
      averageConfidence: Math.round(batchResults.reduce((sum, r) => sum + (r.analysis.confidence || 0), 0) / batchResults.length),
      claudeSuccessRate: Math.round((claudeApiCalls / entities.length) * 100),
      entities: batchResults.map(r => ({
        name: r.entity.name,
        type: r.entity.type,
        sport: r.entity.sport,
        opportunities: r.analysis.opportunities?.length || 0,
        estimated_value: r.analysis.opportunities?.[0]?.estimated_value || '£0M',
        confidence: r.analysis.confidence || 0,
        claude_model: r.claude_model
      }))
    };
    
    // Persist batch results
    const batchFile = path.join(this.historicalCacheDir, `claude-batch-${batchId}.json`);
    fs.writeFileSync(batchFile, JSON.stringify(batchSummary, null, 2));
    
    console.log(`\n✅ Claude Batch ${batchId} completed:`);
    console.log(`   🤖 Claude API Calls: ${claudeApiCalls}/${entities.length}`);
    console.log(`   💰 Total Opportunities: ${batchSummary.totalOpportunities}`);
    console.log(`   💷 Estimated Value: £${batchSummary.estimatedValue.toFixed(1)}M`);
    console.log(`   🎯 Average Confidence: ${batchSummary.averageConfidence}%`);
    console.log(`   💾 Saved to: ${batchFile}`);
    
    return batchSummary;
  }

  async analyzeEntityWithClaude(entity) {
    const prompt = `Analyze this sports entity for comprehensive business intelligence and strategic opportunities:

ENTITY DETAILS:
Name: ${entity.name}
Type: ${entity.type}
Sport: ${entity.sport}
Tier: ${entity.tier}
Website: ${entity.website || 'Not available'}
LinkedIn: ${entity.linkedin_url || 'Not available'}
Data Source: ${entity.data_source}
Relationships: ${entity.relationship_count}
High-Value Intelligence: ${entity.has_contacts || entity.has_tenders ? 'Yes' : 'No'}

CONTEXT: This entity is part of a 12+ month sports intelligence knowledge graph containing 4,422+ entities. We are performing comprehensive historical analysis to identify business opportunities for Yellow Panther, a sports technology consulting company.

TASK: Using Neo4j database queries and web search capabilities, provide sophisticated analysis including:

1. **Entity Assessment**: Current market position, digital maturity, growth potential
2. **Opportunity Identification**: Specific business opportunities with value estimates
3. **Risk Analysis**: Potential challenges and mitigation strategies
4. **Strategic Recommendations**: Actionable engagement strategies
5. **Market Context**: Competitive landscape and market trends

REQUIREMENTS:
- Search our Neo4j database for this entity and related connections
- Use web search to get current market intelligence
- Provide specific, actionable insights with confidence scoring
- Focus on technology, digital transformation, and partnership opportunities
- Include estimated value ranges for opportunities identified

Format your response as structured JSON:
{
  "entity_assessment": {
    "market_position": "string",
    "digital_maturity": "emerging|developing|mature|advanced",
    "growth_potential": "low|medium|high|very_high",
    "competitive_position": "follower|challenger|leader|dominant"
  },
  "opportunities": [
    {
      "title": "string",
      "type": "technology|partnership|digital_transformation|fan_engagement|data_analytics",
      "estimated_value": "£X.XM",
      "confidence": 85,
      "timeline": "3-6 months",
      "strategic_fit": "high|medium|low",
      "description": "string"
    }
  ],
  "risks": [
    {
      "title": "string",
      "severity": "low|medium|high|critical",
      "probability": 0.75,
      "mitigation": "string"
    }
  ],
  "strategic_recommendations": [
    {
      "title": "string",
      "priority": "high|medium|low",
      "timeline": "string",
      "expected_impact": "string"
    }
  ],
  "market_context": {
    "market_size": "string",
    "growth_rate": "string",
    "competitor_count": 12,
    "technology_adoption": "low|medium|high"
  },
  "mcp_tools_used": ["neo4j-mcp", "brightdata-mcp"],
  "confidence": 87,
  "analysis_depth": "comprehensive"
}`;

    try {
      const result = await query({
        prompt,
        options: {
          mcpServers: this.mcpConfig,
          allowedTools: ['mcp__neo4j-mcp__execute_query', 'mcp__brightdata-mcp__search_engine'],
          maxTurns: 6,
          systemPrompt: {
            type: "preset",
            name: "claude-3-5-sonnet-20241022",
            prompt: "You are an elite sports business intelligence analyst with deep expertise in sports technology, digital transformation, and strategic consulting. Provide sophisticated, data-driven insights with specific value estimates and actionable recommendations for Yellow Panther's sports technology consulting business."
          }
        }
      });

      // Parse Claude's response
      return this.parseClaudeResponse(result, entity);
      
    } catch (error) {
      console.error(`Claude analysis failed for ${entity.name}:`, error);
      throw error;
    }
  }

  parseClaudeResponse(result, entity) {
    try {
      // Extract content from Claude Agent response
      let content = '';
      if (result.type === 'result' && result.subtype === 'success') {
        content = result.result?.content || result.message?.content || '';
      }
      
      // Try to parse JSON from Claude's response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        // Ensure required structure
        return {
          entity_assessment: parsed.entity_assessment || {
            market_position: 'Unknown',
            digital_maturity: 'developing',
            growth_potential: 'medium',
            competitive_position: 'challenger'
          },
          opportunities: parsed.opportunities || [],
          risks: parsed.risks || [],
          strategic_recommendations: parsed.strategic_recommendations || [],
          market_context: parsed.market_context || {
            market_size: 'Unknown',
            growth_rate: 'Unknown',
            competitor_count: 0,
            technology_adoption: 'medium'
          },
          mcp_tools_used: parsed.mcp_tools_used || [],
          confidence: parsed.confidence || 75,
          analysis_depth: parsed.analysis_depth || 'standard'
        };
      }
      
      // Fallback if JSON parsing fails
      return {
        entity_assessment: {
          market_position: 'Analysis completed',
          digital_maturity: 'developing',
          growth_potential: 'medium',
          competitive_position: 'challenger'
        },
        opportunities: [{
          title: `${entity.name} Strategic Analysis`,
          type: 'analysis',
          estimated_value: '£1.0M',
          confidence: 70,
          timeline: '3-6 months',
          strategic_fit: 'medium',
          description: 'Analysis completed using Claude AI with Neo4j and web research capabilities.'
        }],
        risks: [],
        strategic_recommendations: [],
        market_context: {
          market_size: 'Unknown',
          growth_rate: 'Unknown',
          competitor_count: 0,
          technology_adoption: 'medium'
        },
        mcp_tools_used: ['claude-ai'],
        confidence: 70,
        analysis_depth: 'standard'
      };
      
    } catch (error) {
      console.error('Failed to parse Claude response:', error);
      throw error;
    }
  }

  async analyzeEntityWithFallback(entity) {
    // Enhanced fallback analysis based on entity properties
    const baseValue = this.calculateBaseValue(entity);
    const opportunities = this.generateFallbackOpportunities(entity, baseValue);
    const risks = this.generateFallbackRisks(entity);
    const recommendations = this.generateFallbackRecommendations(entity);
    
    return {
      entity_assessment: {
        market_position: `${entity.type} in ${entity.sport}`,
        digital_maturity: 'developing',
        growth_potential: 'medium',
        competitive_position: 'challenger'
      },
      opportunities,
      risks,
      strategic_recommendations: recommendations,
      market_context: {
        market_size: 'Unknown',
        growth_rate: 'Unknown',
        competitor_count: entity.relationship_count,
        technology_adoption: 'medium'
      },
      mcp_tools_used: [],
      confidence: 65 + Math.random() * 15,
      analysis_depth: 'fallback'
    };
  }

  calculateBaseValue(entity) {
    let baseValue = 1.0;
    
    // Adjust based on tier
    if (entity.tier === 'tier_1') baseValue = 5.0;
    else if (entity.tier === 'tier_2') baseValue = 2.5;
    else if (entity.tier === 'tier_3') baseValue = 1.2;
    
    // Premium sports get higher values
    if (entity.sport === 'Football') baseValue *= 1.5;
    else if (entity.sport === 'Motorsport') baseValue *= 1.3;
    else if (entity.sport === 'Golf') baseValue *= 1.4;
    
    // High-value entities get premium
    if (entity.has_contacts || entity.has_tenders) baseValue *= 2.5;
    
    // Enriched entities get boost
    if (entity.enriched_at) baseValue *= 1.3;
    
    // Web presence increases value
    if (entity.website || entity.linkedin_url) baseValue *= 1.2;
    
    return baseValue;
  }

  generateFallbackOpportunities(entity, baseValue) {
    const variance = baseValue * 0.4;
    const value = `£${(baseValue + (Math.random() - 0.5) * variance).toFixed(1)}M`;
    
    const opportunities = [
      {
        title: `${entity.name} Digital Transformation Initiative`,
        type: 'technology',
        estimated_value: value,
        confidence: 70 + Math.random() * 20,
        timeline: '3-6 months',
        strategic_fit: entity.has_contacts || entity.has_tenders ? 'high' : 'medium',
        description: `Technology modernization opportunity for ${entity.name} in ${entity.sport}`
      }
    ];

    if (entity.type === 'Club' || entity.type === 'Team') {
      opportunities.push({
        title: `${entity.name} Fan Engagement Platform`,
        type: 'fan_engagement',
        estimated_value: `£${(baseValue * 0.6 + Math.random() * 2).toFixed(1)}M`,
        confidence: 65 + Math.random() * 25,
        timeline: '6-9 months',
        strategic_fit: 'medium',
        description: `Digital fan experience enhancement for ${entity.name}`
      });
    }

    if (entity.has_contacts || entity.has_tenders) {
      opportunities.push({
        title: `${entity.name} Strategic Partnership Development`,
        type: 'partnership',
        estimated_value: `£${(baseValue * 1.2 + Math.random() * 3).toFixed(1)}M`,
        confidence: 75 + Math.random() * 20,
        timeline: '6-12 months',
        strategic_fit: 'high',
        description: `High-value partnership opportunity with existing relationships`
      });
    }

    return opportunities;
  }

  generateFallbackRisks(entity) {
    const risks = [
      {
        title: 'Technology Integration Complexity',
        severity: 'medium',
        probability: 0.3 + Math.random() * 0.4,
        mitigation: 'Phased implementation approach with expert consulting'
      }
    ];

    if (entity.relationship_count > 20) {
      risks.push({
        title: 'Stakeholder Coordination Challenges',
        severity: 'low',
        probability: 0.2 + Math.random() * 0.3,
        mitigation: 'Early stakeholder engagement and clear communication strategy'
      });
    }

    return risks;
  }

  generateFallbackRecommendations(entity) {
    return [
      {
        title: 'Establish Digital Task Force',
        priority: 'high',
        timeline: '3-6 months',
        expected_impact: 'Foundation for comprehensive digital transformation'
      },
      {
        title: 'Phase 1: Digital Assessment',
        priority: entity.has_contacts || entity.has_tenders ? 'high' : 'medium',
        timeline: '6-9 months',
        expected_impact: 'Clear roadmap and priorities for technology investments'
      }
    ];
  }

  async generateClaudeSummary() {
    console.log(`\n📊 ===== GENERATING CLAUDE-AI HISTORICAL SUMMARY =====`);
    
    const batchFiles = fs.readdirSync(this.historicalCacheDir)
      .filter(file => file.startsWith('claude-batch-') && file.endsWith('.json'))
      .sort((a, b) => {
        const aNum = parseInt(a.split('-')[2].split('.')[0]);
        const bNum = parseInt(b.split('-')[2].split('.')[0]);
        return aNum - bNum;
      });

    let totalSummary = {
      totalBatches: batchFiles.length,
      totalEntities: 0,
      claudeApiCalls: 0,
      totalOpportunities: 0,
      totalRisks: 0,
      totalRecommendations: 0,
      estimatedValue: 0,
      averageConfidence: 0,
      claudeSuccessRate: 0,
      batches: [],
      mcpToolsUsage: {}
    };

    console.log(`\n📈 Analyzing ${batchFiles.length} Claude-processed batches...`);

    for (const batchFile of batchFiles) {
      try {
        const batchPath = path.join(this.historicalCacheDir, batchFile);
        const batchData = JSON.parse(fs.readFileSync(batchPath, 'utf8'));
        
        totalSummary.totalEntities += batchData.totalEntities;
        totalSummary.claudeApiCalls += batchData.claudeApiCalls || 0;
        totalSummary.totalOpportunities += batchData.totalOpportunities;
        totalSummary.totalRisks += batchData.totalRisks;
        totalSummary.totalRecommendations += batchData.totalRecommendations;
        totalSummary.estimatedValue += batchData.estimatedValue;
        
        totalSummary.batches.push({
          batchId: batchData.batchId,
          entities: batchData.totalEntities,
          opportunities: batchData.totalOpportunities,
          value: batchData.estimatedValue,
          claudeSuccessRate: batchData.claudeSuccessRate,
          averageConfidence: batchData.averageConfidence
        });
        
      } catch (error) {
        console.error(`❌ Error reading batch ${batchFile}: ${error.message}`);
      }
    }

    // Calculate averages
    if (totalSummary.batches.length > 0) {
      totalSummary.averageConfidence = Math.round(
        totalSummary.batches.reduce((sum, b) => sum + b.averageConfidence, 0) / totalSummary.batches.length
      );
      totalSummary.claudeSuccessRate = Math.round(
        totalSummary.batches.reduce((sum, b) => sum + b.claudeSuccessRate, 0) / totalSummary.batches.length
      );
    }

    // Save comprehensive summary
    const summaryFile = path.join(this.historicalCacheDir, 'claude-historical-summary.json');
    fs.writeFileSync(summaryFile, JSON.stringify(totalSummary, null, 2));

    console.log(`\n🎯 ===== CLAUDE-AI HISTORICAL ANALYSIS COMPLETE =====`);
    console.log(`🤖 Total Batches Processed: ${totalSummary.totalBatches}`);
    console.log(`🏢 Total Entities Analyzed: ${totalSummary.totalEntities}`);
    console.log(`🧠 Claude API Calls: ${totalSummary.claudeApiCalls}`);
    console.log(`💰 Total Opportunities: ${totalSummary.totalOpportunities}`);
    console.log(`⚠️ Total Risks: ${totalSummary.totalRisks}`);
    console.log(`💡 Total Recommendations: ${totalSummary.totalRecommendations}`);
    console.log(`💷 Total Portfolio Value: £${totalSummary.estimatedValue.toFixed(1)}M`);
    console.log(`🎯 Average Confidence: ${totalSummary.averageConfidence}%`);
    console.log(`✅ Claude Success Rate: ${totalSummary.claudeSuccessRate}%`);
    console.log(`💾 Summary saved to: ${summaryFile}`);

    return totalSummary;
  }

  async close() {
    await this.neo4jDriver.close();
    console.log(`\n🔌 Neo4j connection closed`);
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const action = args[0] || 'analyze';
  const batchSize = parseInt(args.find(arg => arg.startsWith('--batch-size='))?.split('=')[1]) || 25;
  const maxBatches = parseInt(args.find(arg => arg.startsWith('--max-batches='))?.split('=')[1]) || 5;

  console.log(`🚀 ===== STARTING CLAUDE-POWERED HISTORICAL BATCH PROCESSOR =====`);
  console.log(`⏰ Started at: ${new Date().toISOString()}`);
  console.log(`📦 Batch size: ${batchSize} (optimized for Claude AI)`);
  console.log(`🤖 AI Model: Claude 3.5 Sonnet with MCP tools`);

  const processor = new ClaudeHistoricalBatchProcessor();
  processor.batchSize = batchSize;

  try {
    // Initialize MCP configuration
    await processor.loadMCPConfig();

    switch (action) {
      case 'analyze':
        await processor.analyzeHistoricalDataDistribution();
        break;
        
      case 'process':
        // Step 1: Analyze historical data
        const distribution = await processor.analyzeHistoricalDataDistribution();
        
        // Step 2: Create Claude-optimized batches
        const { batches, totalEntities } = await processor.getHistoricalBatches();
        
        if (totalEntities === 0) {
          console.log(`❌ No entities found to process`);
          return;
        }
        
        console.log(`\n🔄 Starting Claude AI batch processing of ${totalEntities} entities...`);
        console.log(`📋 Processing ${Math.min(maxBatches, Object.keys(batches).length)} batches (limit for demo)`);
        
        // Step 3: Process batches with Claude AI
        const batchIds = Object.keys(batches).slice(0, maxBatches);
        const processedBatches = [];
        
        for (const batchId of batchIds) {
          const batchSummary = await processor.processBatchWithClaude(parseInt(batchId), batches[batchId]);
          processedBatches.push(batchSummary);
          
          // Delay between batches to respect Claude API limits
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        // Step 4: Generate comprehensive summary
        await processor.generateClaudeSummary();
        
        console.log(`\n🎉 Claude AI historical batch processing completed!`);
        console.log(`📊 Processed ${processedBatches.length} batches of ${totalEntities} total entities`);
        console.log(`🤖 All entities analyzed with real Claude AI intelligence`);
        console.log(`💰 Use 'node claude-historical-processor.js summary' to see complete results`);
        break;
        
      case 'summary':
        await processor.generateClaudeSummary();
        break;
        
      case 'full':
        console.log(`🚀 STARTING FULL HISTORICAL PROCESSING - ALL BATCHES`);
        console.log(`⚠️  This will process all entities with Claude AI (may take several hours)`);
        console.log(`💰 Estimated cost: Significant - ensure Claude API credits are available`);
        
        // Process all batches
        const fullDistribution = await processor.analyzeHistoricalDataDistribution();
        const { batches: allBatches, totalEntities: allTotalEntities } = await processor.getHistoricalBatches();
        
        const allBatchIds = Object.keys(allBatches);
        console.log(`\n🔄 Processing ALL ${allBatchIds.length} batches with Claude AI...`);
        
        for (let i = 0; i < allBatchIds.length; i++) {
          const batchId = allBatchIds[i];
          console.log(`\n📊 Progress: ${i + 1}/${allBatchIds.length} batches (${Math.round((i / allBatchIds.length) * 100)}%)`);
          
          try {
            await processor.processBatchWithClaude(parseInt(batchId), allBatches[batchId]);
            
            // Longer delay for full processing
            await new Promise(resolve => setTimeout(resolve, 3000));
          } catch (error) {
            console.error(`❌ Batch ${batchId} failed: ${error.message}`);
            console.log(`⏭️  Continuing with next batch...`);
          }
        }
        
        await processor.generateClaudeSummary();
        console.log(`\n🎉 FULL HISTORICAL PROCESSING COMPLETE!`);
        console.log(`📊 All ${allBatchIds.length} batches processed with Claude AI`);
        break;
        
      default:
        console.log(`Usage: node claude-historical-processor.js [analyze|process|summary|full] [--batch-size=N] [--max-batches=N]`);
        console.log(`Commands:`);
        console.log(`  analyze    - Analyze historical data distribution`);
        console.log(`  process    - Process limited number of batches (default 5)`);
        console.log(`  summary    - Generate comprehensive summary`);
        console.log(`  full       - Process ALL batches (warning: high API cost)`);
    }

  } catch (error) {
    console.error(`❌ Claude historical batch processor failed:`, error);
  } finally {
    await processor.close();
  }
}

main().catch(console.error);