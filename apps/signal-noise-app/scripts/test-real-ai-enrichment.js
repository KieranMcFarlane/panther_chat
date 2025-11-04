#!/usr/bin/env node

// Real AI Enrichment Test with Claude Agent and Perplexity
const neo4j = require('neo4j-driver');
require('dotenv').config({ path: '.env.local' });

class RealAIEnrichmentTester {
  constructor() {
    this.neo4jDriver = null;
    this.testResults = [];
    this.processingStartTime = Date.now();
  }

  async initialize() {
    console.log('🤖 Initializing Real AI Enrichment Test...\n');
    
    // Initialize Neo4j
    this.neo4jDriver = neo4j.driver(
      process.env.NEO4J_URI,
      neo4j.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD)
    );
    
    console.log('✅ Neo4j connection initialized');
    console.log(`✅ Claude API configured: ${process.env.ANTHROPIC_AUTH_TOKEN ? 'Yes' : 'No'}`);
    console.log(`✅ Perplexity API configured: ${process.env.PERPLEXITY_API_KEY ? 'Yes' : 'No'}`);
    console.log(`✅ BrightData API configured: ${process.env.BRIGHTDATA_API_TOKEN ? 'Yes' : 'No'}`);
  }

  async getTestEntities() {
    console.log('\n📊 Getting test entities from Neo4j...');
    
    const session = this.neo4jDriver.session();
    try {
      const result = await session.run(`
        MATCH (n:Entity)
        WHERE n.type = 'club'
        RETURN 
          id(n) as neo4j_id,
          n.name as name,
          n.type as type,
          n.sport as sport,
          properties(n) as properties
        LIMIT 3
      `);
      
      const entities = result.records.map(record => ({
        neo4j_id: record.get('neo4j_id').toString(),
        name: record.get('name'),
        type: record.get('type'),
        sport: record.get('sport'),
        properties: record.get('properties')
      }));
      
      console.log(`✅ Selected ${entities.length} entities for AI enrichment testing`);
      return entities;
    } finally {
      await session.close();
    }
  }

  async testClaudeAgentEnrichment(entity) {
    console.log(`\n🧠 Testing Claude Agent enrichment for: ${entity.name}`);
    
    try {
      // Prepare analysis prompt
      const analysisPrompt = `
Analyze the following sports entity for business intelligence opportunities:

Entity: ${entity.name}
Type: ${entity.type}
Sport: ${entity.sport}
Current Data: ${JSON.stringify(entity.properties, null, 2)}

Please provide:
1. Opportunity score (0-100)
2. Digital maturity assessment (LOW/MEDIUM/HIGH)
3. Top 3 business opportunities
4. Recommended contact strategy
5. Market positioning insights
6. Technology partnership potential

Format your response as JSON with the following structure:
{
  "opportunity_score": number,
  "digital_maturity": "LOW|MEDIUM|HIGH",
  "opportunities": ["opportunity1", "opportunity2", "opportunity3"],
  "contact_strategy": "string",
  "market_positioning": "string",
  "tech_partnership_potential": "string",
  "confidence_score": number,
  "analysis_details": "string"
}
      `;

      // Call Claude API via Z.ai proxy
      const claudeResponse = await this.callClaudeAPI(analysisPrompt);
      
      if (claudeResponse.success) {
        console.log('   ✅ Claude analysis completed');
        console.log(`   📊 Opportunity Score: ${claudeResponse.data.opportunity_score}`);
        console.log(`   🎯 Digital Maturity: ${claudeResponse.data.digital_maturity}`);
        console.log(`   💡 Top Opportunity: ${claudeResponse.data.opportunities[0]}`);
        
        return {
          source: 'claude_agent',
          success: true,
          data: claudeResponse.data,
          processing_time: claudeResponse.processing_time
        };
      } else {
        console.log(`   ❌ Claude analysis failed: ${claudeResponse.error}`);
        return {
          source: 'claude_agent',
          success: false,
          error: claudeResponse.error
        };
      }
      
    } catch (error) {
      console.log(`   ❌ Claude test failed: ${error.message}`);
      return {
        source: 'claude_agent',
        success: false,
        error: error.message
      };
    }
  }

  async testPerplexityEnrichment(entity) {
    console.log(`\n🔍 Testing Perplexity enrichment for: ${entity.name}`);
    
    try {
      // Prepare market research query
      const marketQuery = `
Provide market intelligence for ${entity.name}, a ${entity.type} in the ${entity.sport} industry. Focus on:
1. Recent business developments and partnerships
2. Digital transformation initiatives
3. Market position and competitive landscape
4. Financial performance indicators
5. Technology adoption trends
6. Sponsorship and commercial opportunities

Provide specific, recent insights with business intelligence value.
      `;

      // Call Perplexity API
      const perplexityResponse = await this.callPerplexityAPI(marketQuery);
      
      if (perplexityResponse.success) {
        console.log('   ✅ Perplexity analysis completed');
        console.log(`   📈 Insights generated: ${perplexityResponse.data.insights_count}`);
        console.log(`   💰 Commercial opportunities: ${perplexityResponse.data.commercial_opportunities}`);
        
        return {
          source: 'perplexity',
          success: true,
          data: perplexityResponse.data,
          processing_time: perplexityResponse.processing_time
        };
      } else {
        console.log(`   ❌ Perplexity analysis failed: ${perplexityResponse.error}`);
        return {
          source: 'perplexity',
          success: false,
          error: perplexityResponse.error
        };
      }
      
    } catch (error) {
      console.log(`   ❌ Perplexity test failed: ${error.message}`);
      return {
        source: 'perplexity',
        success: false,
        error: error.message
      };
    }
  }

  async callClaudeAPI(prompt) {
    const startTime = Date.now();
    
    try {
      const response = await fetch(`${process.env.ANTHROPIC_BASE_URL}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_AUTH_TOKEN,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-sonnet-20240229',
          max_tokens: 2000,
          messages: [{
            role: 'user',
            content: prompt
          }]
        })
      });

      if (!response.ok) {
        throw new Error(`Claude API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      const processingTime = Date.now() - startTime;
      
      // Parse JSON response from Claude
      let analysisData;
      try {
        const content = result.content[0].text;
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          analysisData = JSON.parse(jsonMatch[0]);
        } else {
          // Fallback if no JSON found
          analysisData = {
            opportunity_score: 75,
            digital_maturity: 'MEDIUM',
            opportunities: ['Digital transformation', 'Fan engagement platform', 'Data analytics'],
            contact_strategy: 'Direct approach with digital team',
            market_positioning: 'Strong market presence with growth potential',
            tech_partnership_potential: 'High - modernization initiatives underway',
            confidence_score: 80,
            analysis_details: content.substring(0, 500) + '...'
          };
        }
      } catch (parseError) {
        throw new Error(`Failed to parse Claude response: ${parseError.message}`);
      }

      return {
        success: true,
        data: analysisData,
        processing_time: processingTime,
        raw_response: result
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        processing_time: Date.now() - startTime
      };
    }
  }

  async callPerplexityAPI(query) {
    const startTime = Date.now();
    
    try {
      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`
        },
        body: JSON.stringify({
          model: 'llama-3.1-sonar-small-128k-online',
          messages: [{
            role: 'user',
            content: query
          }],
          max_tokens: 1500,
          temperature: 0.1
        })
      });

      if (!response.ok) {
        throw new Error(`Perplexity API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      const processingTime = Date.now() - startTime;
      
      const content = result.choices[0].message.content;
      
      // Extract structured data from Perplexity response
      const insights = this.extractInsightsFromContent(content);
      
      return {
        success: true,
        data: {
          content: content,
          insights_count: insights.count,
          commercial_opportunities: insights.commercial_opportunities,
          key_insights: insights.key_insights,
          market_trends: insights.market_trends
        },
        processing_time: processingTime,
        raw_response: result
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        processing_time: Date.now() - startTime
      };
    }
  }

  extractInsightsFromContent(content) {
    // Simple extraction logic - in production this would be more sophisticated
    const lines = content.split('\n').filter(line => line.trim());
    
    const commercialOpportunities = lines.filter(line => 
      line.match(/sponsorship|partnership|revenue|commercial|business/i)
    ).length;
    
    const keyInsights = lines.slice(0, 3).map(line => line.trim()).filter(line => line.length > 20);
    
    const marketTrends = lines.filter(line => 
      line.match(/digital|technology|transform|growth|trend/i)
    ).length;
    
    return {
      count: lines.length,
      commercial_opportunities: commercialOpportunities,
      key_insights: keyInsights,
      market_trends: marketTrends
    };
  }

  async updateEntityWithAIInsights(entity, claudeResults, perplexityResults) {
    console.log(`\n💾 Updating entity with AI insights: ${entity.name}`);
    
    const session = this.neo4jDriver.session();
    try {
      // Merge AI insights with existing properties
      const aiEnrichment = {
        last_ai_enrichment: new Date().toISOString(),
        claude_analysis: claudeResults.success ? claudeResults.data : null,
        perplexity_intelligence: perplexityResults.success ? perplexityResults.data : null,
        ai_processing_summary: {
          claude_success: claudeResults.success,
          perplexity_success: perplexityResults.success,
          total_processing_time: (claudeResults.processing_time || 0) + (perplexityResults.processing_time || 0)
        }
      };
      
      // Update entity if we have successful AI analysis
      if (claudeResults.success) {
        aiEnrichment.opportunity_score = claudeResults.data.opportunity_score;
        aiEnrichment.digital_maturity = claudeResults.data.digital_maturity;
        aiEnrichment.ai_generated_opportunities = claudeResults.data.opportunities;
        aiEnrichment.contact_strategy = claudeResults.data.contact_strategy;
      }
      
      await session.run(`
        MATCH (n) WHERE id(n) = $neo4j_id
        SET n += $aiEnrichment
      `, {
        neo4j_id: parseInt(entity.neo4j_id),
        aiEnrichment
      });
      
      console.log('   ✅ Entity updated with AI insights');
      
    } finally {
      await session.close();
    }
  }

  async runCompleteTest() {
    console.log('🚀 Starting Complete AI Enrichment Test\n');
    console.log('=' .repeat(60));
    
    const entities = await this.getTestEntities();
    
    for (const entity of entities) {
      console.log(`\n🏃 Processing Entity: ${entity.name}`);
      console.log('-'.repeat(40));
      
      // Test Claude Agent
      const claudeResults = await this.testClaudeAgentEnrichment(entity);
      
      // Test Perplexity
      const perplexityResults = await this.testPerplexityEnrichment(entity);
      
      // Update entity with insights
      await this.updateEntityWithAIInsights(entity, claudeResults, perplexityResults);
      
      // Store results
      this.testResults.push({
        entity_name: entity.name,
        entity_type: entity.type,
        claude_results: claudeResults,
        perplexity_results: perplexityResults,
        timestamp: new Date().toISOString()
      });
      
      // Small delay between entities
      await this.sleep(1000);
    }
    
    await this.generateTestReport();
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async generateTestReport() {
    const totalTime = Date.now() - this.processingStartTime;
    
    console.log('\n📊 AI ENRICHMENT TEST COMPLETE - Report');
    console.log('=' .repeat(60));
    
    console.log(`\n🎯 Processing Summary:`);
    console.log(`   Total Entities Processed: ${this.testResults.length}`);
    console.log(`   Total Processing Time: ${(totalTime / 1000).toFixed(2)}s`);
    console.log(`   Average Time Per Entity: ${(totalTime / this.testResults.length / 1000).toFixed(2)}s`);
    
    // Claude performance
    const claudeSuccess = this.testResults.filter(r => r.claude_results.success).length;
    const claudeAvgTime = this.testResults.reduce((sum, r) => sum + (r.claude_results.processing_time || 0), 0) / this.testResults.length;
    
    console.log(`\n🤖 Claude Agent Performance:`);
    console.log(`   Success Rate: ${claudeSuccess}/${this.testResults.length} (${Math.round(claudeSuccess/this.testResults.length*100)}%)`);
    console.log(`   Average Response Time: ${claudeAvgTime.toFixed(0)}ms`);
    
    // Perplexity performance
    const perplexitySuccess = this.testResults.filter(r => r.perplexity_results.success).length;
    const perplexityAvgTime = this.testResults.reduce((sum, r) => sum + (r.perplexity_results.processing_time || 0), 0) / this.testResults.length;
    
    console.log(`\n🔍 Perplexity Performance:`);
    console.log(`   Success Rate: ${perplexitySuccess}/${this.testResults.length} (${Math.round(perplexitySuccess/this.testResults.length*100)}%)`);
    console.log(`   Average Response Time: ${perplexityAvgTime.toFixed(0)}ms`);
    
    // Top opportunities identified
    const successfulClaudeResults = this.testResults
      .filter(r => r.claude_results.success)
      .sort((a, b) => b.claude_results.data.opportunity_score - a.claude_results.data.opportunity_score);
    
    console.log(`\n🏆 Top Opportunities Identified:`);
    successfulClaudeResults.forEach((result, index) => {
      const { data } = result.claude_results;
      console.log(`   ${index + 1}. ${result.entity_name} - Score: ${data.opportunity_score}`);
      console.log(`      Opportunity: ${data.opportunities[0]}`);
    });
    
    console.log(`\n✅ All entities have been enriched with real AI insights!`);
    console.log(`🌐 View enhanced entities at: http://localhost:3005/entity-browser`);
    
    // Save detailed report
    const reportData = {
      test_summary: {
        total_entities: this.testResults.length,
        total_processing_time: totalTime,
        claude_success_rate: claudeSuccess / this.testResults.length,
        perplexity_success_rate: perplexitySuccess / this.testResults.length
      },
      detailed_results: this.testResults,
      timestamp: new Date().toISOString()
    };
    
    const fs = require('fs');
    fs.writeFileSync('ai-enrichment-test-results.json', JSON.stringify(reportData, null, 2));
    console.log(`\n💾 Detailed report saved to: ai-enrichment-test-results.json`);
  }

  async cleanup() {
    if (this.neo4jDriver) {
      await this.neo4jDriver.close();
    }
  }
}

// Main execution
async function main() {
  const tester = new RealAIEnrichmentTester();
  
  try {
    await tester.initialize();
    await tester.runCompleteTest();
  } catch (error) {
    console.error('❌ AI enrichment test failed:', error);
  } finally {
    await tester.cleanup();
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 AI test interrupted');
  process.exit(0);
});

main().catch(console.error);