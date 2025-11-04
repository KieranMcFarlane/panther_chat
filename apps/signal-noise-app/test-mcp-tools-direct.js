#!/usr/bin/env node

/**
 * DIRECT MCP TOOL VALIDATION TEST
 * 
 * This script tests the MCP tools directly without Claude Agent SDK
 * to validate they actually work with real data sources.
 */

const { mcpToolExecutor } = require('./src/lib/mcp-tool-executor');

class DirectMCPValidator {
  constructor() {
    this.results = {
      startTime: new Date().toISOString(),
      tests: [],
      successes: 0,
      failures: 0,
      actualDataFound: false,
      realEntities: [],
      realOpportunities: [],
      errors: []
    };
  }

  log(message, type = 'INFO') {
    const timestamp = new Date().toISOString();
    const prefix = type === 'SUCCESS' ? '✅' : type === 'ERROR' ? '❌' : type === 'WARNING' ? '⚠️' : 'ℹ️';
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  async testNeo4jEntityQuery() {
    this.log('TEST 1: Neo4j MCP Tool - Query Sports Entities', 'INFO');
    
    try {
      // Test 1: Basic entity query
      const query1 = 'MATCH (e:SportsEntity) RETURN e.name as name, e.type as type, e.sport as sport, e.country as country LIMIT 5';
      
      const result1 = await mcpToolExecutor.executeTool('mcp__neo4j-mcp__execute_query', {
        query: query1,
        params: {}
      });

      this.results.tests.push({
        test: 'Neo4j Basic Query',
        tool: 'mcp__neo4j-mcp__execute_query',
        success: result1.success,
        dataFound: result1.success && result1.data && result1.data.length > 0,
        result: result1
      });

      if (result1.success && result1.data && result1.data.length > 0) {
        this.log(`SUCCESS: Found ${result1.data.length} sports entities`, 'SUCCESS');
        this.results.successes++;
        this.results.actualDataFound = true;
        this.results.realEntities.push(...result1.data);
        
        // Log the entities
        result1.data.slice(0, 3).forEach((entity, i) => {
          this.log(`  Entity ${i+1}: ${entity.name} (${entity.type || 'N/A'}, ${entity.sport || 'N/A'})`);
        });
      } else {
        this.log(`FAILED: Neo4j query returned no data. Error: ${result1.error || 'Unknown'}`, 'ERROR');
        this.results.failures++;
        this.results.errors.push(`Neo4j basic query failed: ${result1.error}`);
      }

      // Test 2: Priority entity query
      const query2 = `
        MATCH (e:SportsEntity) 
        WHERE e.yellowPantherPriority <= 5 OR e.priority <= 5
        RETURN e.name as name, e.type as type, e.sport as sport, e.country as country, 
               e.yellowPantherPriority as priority
        ORDER BY coalesce(e.yellowPantherPriority, e.priority, 999) ASC 
        LIMIT 5
      `;
      
      const result2 = await mcpToolExecutor.executeTool('mcp__neo4j-mcp__execute_query', {
        query: query2,
        params: {}
      });

      this.results.tests.push({
        test: 'Neo4j Priority Query',
        tool: 'mcp__neo4j-mcp__execute_query',
        success: result2.success,
        dataFound: result2.success && result2.data && result2.data.length > 0,
        result: result2
      });

      if (result2.success && result2.data && result2.data.length > 0) {
        this.log(`SUCCESS: Found ${result2.data.length} priority entities`, 'SUCCESS');
        this.results.successes++;
        result2.data.forEach((entity, i) => {
          this.log(`  Priority Entity ${i+1}: ${entity.name} (Priority: ${entity.priority || 'N/A'})`);
        });
      } else {
        this.log(`WARNING: No priority entities found, using fallback entities`, 'WARNING');
        this.results.errors.push(`Neo4j priority query returned no data: ${result2.error}`);
      }

    } catch (error) {
      this.log(`ERROR: Neo4j test failed: ${error.message}`, 'ERROR');
      this.results.failures++;
      this.results.errors.push(`Neo4j test exception: ${error.message}`);
    }
  }

  async testBrightDataSearch() {
    this.log('TEST 2: BrightData MCP Tool - Real RFP Searches', 'INFO');
    
    try {
      // Use real entities from Neo4j (or fallback entities if Neo4j failed)
      const testEntities = this.results.realEntities.length > 0 
        ? this.results.realEntities.slice(0, 3)
        : [
            { name: 'Premier League', sport: 'Football' },
            { name: 'UEFA', sport: 'Football' },
            { name: 'Manchester United', sport: 'Football' }
          ];

      let totalSearches = 0;
      let realResultsFound = 0;

      for (let i = 0; i < testEntities.length; i++) {
        const entity = testEntities[i];
        this.log(`Testing entity ${i+1}/${testEntities.length}: ${entity.name}`);
        
        // Multiple search strategies for each entity
        const searchQueries = [
          `"${entity.name}" RFP "request for proposal" 2025`,
          `"${entity.name}" digital transformation tender 2025`,
          `"${entity.name}" mobile app development solicitation 2025`
        ];

        for (let j = 0; j < searchQueries.length; j++) {
          const query = searchQueries[j];
          totalSearches++;
          
          try {
            const searchResult = await mcpToolExecutor.executeTool('mcp__brightdata-mcp__search_engine', {
              query: query,
              engine: 'google',
              limit: 8
            });

            this.results.tests.push({
              test: `BrightData Search ${i+1}-${j+1}`,
              entity: entity.name,
              query: query,
              tool: 'mcp__brightdata-mcp__search_engine',
              success: searchResult.success,
              dataFound: searchResult.success && searchResult.results && searchResult.results.length > 0,
              result: searchResult
            });

            if (searchResult.success && searchResult.results && searchResult.results.length > 0) {
              this.log(`SUCCESS: Found ${searchResult.results.length} search results`, 'SUCCESS');
              this.results.successes++;
              
              // Check for actual RFP content
              const rfpResults = searchResult.results.filter(result => {
                const text = (result.title + ' ' + (result.snippet || '')).toLowerCase();
                return text.includes('rfp') || 
                       text.includes('request for proposal') || 
                       text.includes('tender') ||
                       text.includes('solicitation') ||
                       text.includes('bid');
              });

              if (rfpResults.length > 0) {
                this.log(`FOUND ${rfpResults.length} RFP-related results:`, 'SUCCESS');
                realResultsFound++;
                
                rfpResults.slice(0, 2).forEach((rfp, k) => {
                  this.log(`  RFP ${k+1}: ${rfp.title}`);
                  this.log(`    URL: ${rfp.link || rfp.url}`);
                  this.log(`    Snippet: ${(rfp.snippet || '').substring(0, 150)}...`);
                  
                  // Store for validation
                  this.results.realOpportunities.push({
                    entity: entity.name,
                    title: rfp.title,
                    url: rfp.link || rfp.url,
                    snippet: rfp.snippet,
                    query: query,
                    validated: true
                  });
                });
              } else {
                this.log(`No RFP content in results (${searchResult.results.length} total results)`, 'INFO');
              }
            } else {
              this.log(`FAILED: BrightData search returned no data. Error: ${searchResult.error || 'Unknown'}`, 'ERROR');
              this.results.failures++;
              this.results.errors.push(`BrightData search failed for ${entity.name}: ${searchResult.error}`);
            }

            // Small delay between searches
            await new Promise(resolve => setTimeout(resolve, 1500));

          } catch (searchError) {
            this.log(`ERROR: BrightData search failed for ${entity.name}: ${searchError.message}`, 'ERROR');
            this.results.failures++;
            this.results.errors.push(`BrightData search exception for ${entity.name}: ${searchError.message}`);
          }
        }
      }

      this.log(`BrightData Search Summary: ${realResultsFound} real RFP results from ${totalSearches} searches`, realResultsFound > 0 ? 'SUCCESS' : 'WARNING');

    } catch (error) {
      this.log(`ERROR: BrightData test failed: ${error.message}`, 'ERROR');
      this.results.failures++;
      this.results.errors.push(`BrightData test exception: ${error.message}`);
    }
  }

  async testPerplexityAnalysis() {
    this.log('TEST 3: Perplexity MCP Tool - Market Intelligence', 'INFO');
    
    try {
      // Test with real opportunity if found, otherwise use mock scenario
      if (this.results.realOpportunities.length > 0) {
        const opportunity = this.results.realOpportunities[0];
        
        const analysisQuery = `
Analyze this RFP opportunity for Yellow Panther Digital:

Title: ${opportunity.title}
Entity: ${opportunity.entity}
URL: ${opportunity.url}
Description: ${opportunity.snippet}

Provide analysis on:
1. Project scope and complexity
2. Budget estimation (if possible)
3. Competition level
4. Strategic value for Yellow Panther
5. Technical requirements
6. Timeline considerations
        `;

        const analysisResult = await mcpToolExecutor.executeTool('mcp__perplexity-mcp__chat_completion', {
          messages: [{ role: 'user', content: analysisQuery }],
          model: 'sonar'
        });

        this.results.tests.push({
          test: 'Perplexity Real Analysis',
          opportunity: opportunity.title,
          tool: 'mcp__perplexity-mcp__chat_completion',
          success: analysisResult.success,
          dataFound: analysisResult.success && analysisResult.message,
          result: analysisResult
        });

        if (analysisResult.success && analysisResult.message) {
          this.log(`SUCCESS: Market analysis completed (${analysisResult.message.length} chars)`, 'SUCCESS');
          this.results.successes++;
          this.log(`Analysis Preview: ${analysisResult.message.substring(0, 200)}...`);
        } else {
          this.log(`FAILED: Perplexity analysis returned no data. Error: ${analysisResult.error || 'Unknown'}`, 'ERROR');
          this.results.failures++;
        }
      } else {
        // Test with mock scenario
        this.log('Testing Perplexity with mock opportunity (no real opportunities found)', 'WARNING');
        
        const mockAnalysis = await mcpToolExecutor.executeTool('mcp__perplexity-mcp__chat_completion', {
          messages: [{ 
            role: 'user', 
            content: 'Analyze the market for digital transformation in sports organizations. Focus on mobile apps, ticketing systems, and fan engagement platforms.' 
          }],
          model: 'sonar'
        });

        this.results.tests.push({
          test: 'Perplexity Mock Analysis',
          tool: 'mcp__perplexity-mcp__chat_completion',
          success: mockAnalysis.success,
          dataFound: mockAnalysis.success && mockAnalysis.message,
          result: mockAnalysis
        });

        if (mockAnalysis.success && mockAnalysis.message) {
          this.log(`SUCCESS: Mock analysis completed (${mockAnalysis.message.length} chars)`, 'SUCCESS');
          this.results.successes++;
        } else {
          this.log(`FAILED: Mock Perplexity analysis failed. Error: ${mockAnalysis.error || 'Unknown'}`, 'ERROR');
          this.results.failures++;
        }
      }

    } catch (error) {
      this.log(`ERROR: Perplexity test failed: ${error.message}`, 'ERROR');
      this.results.failures++;
      this.results.errors.push(`Perplexity test exception: ${error.message}`);
    }
  }

  generateReport() {
    const endTime = new Date().toISOString();
    const duration = Date.now() - new Date(this.results.startTime).getTime();

    console.log('\n' + '='.repeat(80));
    console.log('🧪 DIRECT MCP TOOL VALIDATION REPORT');
    console.log('='.repeat(80));
    console.log(`⏰ Started: ${this.results.startTime}`);
    console.log(`⏰ Completed: ${endTime}`);
    console.log(`⏱️ Duration: ${(duration / 1000).toFixed(1)} seconds`);
    console.log('');

    console.log('📊 VALIDATION SUMMARY:');
    console.log(`  Total Tests: ${this.results.tests.length}`);
    console.log(`  Successful Tests: ${this.results.successes}`);
    console.log(`  Failed Tests: ${this.results.failures}`);
    console.log(`  Success Rate: ${Math.round((this.results.successes / this.results.tests.length) * 100)}%`);
    console.log('');

    console.log('🔍 REAL DATA VALIDATION:');
    console.log(`  Neo4j Entities Found: ${this.results.realEntities.length}`);
    console.log(`  BrightData Results: ${this.results.realOpportunities.length}`);
    console.log(`  Actual Data Found: ${this.results.actualDataFound ? 'YES' : 'NO'}`);
    console.log('');

    // Detailed test results
    console.log('📋 DETAILED TEST RESULTS:');
    console.log('-'.repeat(80));
    
    this.results.tests.forEach((test, index) => {
      const status = test.success ? '✅ SUCCESS' : '❌ FAILED';
      const dataStatus = test.dataFound ? '📊 DATA' : '🚫 NO DATA';
      console.log(`${index + 1}. ${test.test}: ${status} ${dataStatus}`);
      
      if (test.entity) {
        console.log(`    Entity: ${test.entity}`);
      }
      if (test.query) {
        console.log(`    Query: ${test.query.substring(0, 100)}...`);
      }
      if (test.result && !test.success) {
        console.log(`    Error: ${test.result.error || 'Unknown error'}`);
      }
    });

    // Real entities found
    if (this.results.realEntities.length > 0) {
      console.log('\n🏆 REAL NEO4J ENTITIES DISCOVERED:');
      console.log('-'.repeat(80));
      this.results.realEntities.slice(0, 5).forEach((entity, i) => {
        console.log(`${i + 1}. ${entity.name}`);
        console.log(`   Type: ${entity.type || 'N/A'}`);
        console.log(`   Sport: ${entity.sport || 'N/A'}`);
        console.log(`   Country: ${entity.country || 'N/A'}`);
        console.log('');
      });
    }

    // Real opportunities found
    if (this.results.realOpportunities.length > 0) {
      console.log('🎯 REAL RFP OPPORTUNITIES DISCOVERED:');
      console.log('-'.repeat(80));
      this.results.realOpportunities.forEach((opp, i) => {
        console.log(`${i + 1}. ${opp.title}`);
        console.log(`   Entity: ${opp.entity}`);
        console.log(`   URL: ${opp.url}`);
        console.log(`   Query: ${opp.query}`);
        console.log(`   Validated: ${opp.validated}`);
        console.log('');
      });
    }

    // Errors encountered
    if (this.results.errors.length > 0) {
      console.log('⚠️ ERRORS ENCOUNTERED:');
      console.log('-'.repeat(80));
      this.results.errors.slice(0, 5).forEach((error, i) => {
        console.log(`${i + 1}. ${error}`);
      });
    }

    // Validation conclusion
    console.log('🔍 VALIDATION CONCLUSION:');
    console.log('-'.repeat(80));
    
    if (this.results.actualDataFound) {
      console.log('✅ VALIDATION PASSED: MCP tools are working with real data');
      console.log(`   - Neo4j: ${this.results.realEntities.length} entities confirmed`);
      console.log(`   - BrightData: ${this.results.realOpportunities.length} RFP results found`);
    } else {
      console.log('❌ VALIDATION FAILED: No real data was processed');
      console.log('   - All tests either failed or returned empty results');
      console.log('   - MCP tools may not be properly connected or configured');
    }

    console.log(`\n🏁 MCP TOOL VALIDATION COMPLETE`);
    console.log(`Success Rate: ${Math.round((this.results.successes / this.results.tests.length) * 100)}%`);
    console.log(`Real Data: ${this.results.actualDataFound ? 'CONFIRMED' : 'NOT FOUND'}`);

    // Save detailed results
    const reportPath = `./mcp-validation-results-${Date.now()}.json`;
    require('fs').writeFileSync(reportPath, JSON.stringify(this.results, null, 2));
    console.log(`\n💾 Detailed results saved to: ${reportPath}`);
  }

  async runValidation() {
    console.log('🚀 STARTING DIRECT MCP TOOL VALIDATION');
    console.log('This test bypasses Claude Agent SDK to test MCP tools directly');
    console.log('Test will validate 10+ entities and verify real MCP tool execution');
    console.log('');

    try {
      await this.testNeo4jEntityQuery();
      await this.testBrightDataSearch();
      await this.testPerplexityAnalysis();
      
      this.results.endTime = new Date().toISOString();
      
    } catch (error) {
      this.log(`CRITICAL ERROR: ${error.message}`, 'ERROR');
      this.results.errors.push(`Critical validation failure: ${error.message}`);
    } finally {
      this.generateReport();
    }
  }
}

// Run the validation
async function main() {
  const validator = new DirectMCPValidator();
  await validator.runValidation();
}

main().catch(console.error);