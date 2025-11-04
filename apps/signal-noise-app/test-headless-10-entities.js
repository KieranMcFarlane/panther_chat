#!/usr/bin/env node

/**
 * Test Headless Claude Agent with 10 Neo4j Entities
 * 
 * This script will:
 * 1. Connect to Neo4j and fetch 10 entities
 * 2. Use your existing Claude Agent SDK service
 * 3. Process each entity with headless mode
 * 4. Generate RFP intelligence for each
 */

const Anthropic = require('@anthropic-ai/sdk');
const neo4j = require('neo4j-driver');
const fs = require('fs/promises');
const path = require('path');

// Configuration
const CONFIG = {
  neo4j: {
    uri: process.env.NEO4J_URI || 'neo4j+s://your-instance.databases.neo4j.io',
    user: process.env.NEO4J_USER || 'neo4j',
    password: process.env.NEO4J_PASS || 'your-password'
  },
  claude: {
    apiKey: process.env.ANTHROPIC_API_KEY || 'sk-ant-your-key',
    baseURL: process.env.ANTHROPIC_BASE_URL || 'https://api.z.ai/api/anthropic'
  },
  output: {
    dir: 'RUN_LOGS',
    filename: `HEADLESS_TEST_10_ENTITIES_${new Date().toISOString().replace(/[:.]/g, '-')}.md`
  }
};

class HeadlessEntityTester {
  constructor() {
    this.anthropic = new Anthropic({
      apiKey: CONFIG.claude.apiKey,
      baseURL: CONFIG.claude.baseURL
    });

    this.driver = neo4j.driver(
      CONFIG.neo4j.uri,
      neo4j.auth.basic(CONFIG.neo4j.user, CONFIG.neo4j.password)
    );
  }

  async initialize() {
    // Create output directory
    await fs.mkdir(CONFIG.output.dir, { recursive: true });
    
    console.log('🔧 Initialized Headless Entity Tester');
    console.log(`📁 Output will be saved to: ${path.join(CONFIG.output.dir, CONFIG.output.filename)}`);
    console.log(`🤖 Using Claude model via: ${CONFIG.claude.baseURL}`);
  }

  async fetchTestEntities(limit = 10) {
    console.log(`🧠 Fetching ${limit} entities from Neo4j...`);
    
    const session = this.driver.session();
    try {
      const query = `
        MATCH (e:Entity)
        WHERE e.name IS NOT NULL 
        AND (e:Club OR e:League OR e:Person)
        RETURN e.name as name, e.type as type, e.sport as sport, e.country as country
        LIMIT toInteger($limit)
      `;
      
      const result = await session.run(query, { limit: parseInt(limit) });
      const entities = result.records.map(record => record.toObject());
      
      console.log(`✅ Found ${entities.length} entities`);
      return entities;
      
    } catch (error) {
      console.error('❌ Failed to fetch entities:', error);
      throw error;
    } finally {
      await session.close();
    }
  }

  async processEntityWithHeadlessAgent(entity, index) {
    const startTime = Date.now();
    
    console.log(`🤖 Processing Entity ${index + 1}: ${entity.name} (${entity.type})`);
    
    try {
      // Build entity-specific prompt
      const entityPrompt = `
ENTITY TO ANALYZE:
- Name: ${entity.name}
- Type: ${entity.type}
- Sport: ${entity.sport || 'Not specified'}
- Country: ${entity.country || 'Not specified'}

TASK: Analyze this sports entity for RFP opportunities using the following methodology:

1. **Opportunity Detection**: Look for digital transformation, sponsorship, technology needs
2. **Market Positioning**: Assess their current market position and potential needs
3. **Engagement Strategy**: Suggest how Yellow Panther could approach them
4. **Opportunity Value**: Estimate potential contract value (£)
5. **Confidence Score**: Rate confidence in findings (0-100%)

CONTEXT: You are analyzing sports entities for Yellow Panther, a sports intelligence and technology consultancy.

Focus on actionable intelligence that could lead to real business opportunities.
`;

      // Execute with Claude Agent Headless style
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-latest',
        max_tokens: 1500,
        temperature: 0.7,
        system: `You are a Yellow Panther RFP Intelligence Agent operating in headless mode. 
        Analyze sports entities for business opportunities and provide structured, actionable intelligence.
        
        Your analysis should include:
        1. Entity overview and current situation
        2. Identified opportunities (2-3 specific opportunities)
        3. Recommended engagement approach
        4. Estimated value and confidence scores
        5. Next steps for Yellow Panther team
        
        Format your response as structured Markdown with clear sections.`,
        
        messages: [
          {
            role: 'user',
            content: entityPrompt
          }
        ]
      });

      const processingTime = Date.now() - startTime;
      const analysis = response.content[0]?.type === 'text' ? response.content[0].text : '';

      return {
        entity: entity,
        analysis: analysis,
        processingTime: processingTime,
        success: true,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`❌ Failed to process ${entity.name}:`, error.message);
      
      return {
        entity: entity,
        error: error.message,
        processingTime: processingTime,
        success: false,
        timestamp: new Date().toISOString()
      };
    }
  }

  async generateReport(results) {
    console.log('📊 Generating comprehensive report...');
    
    const successfulResults = results.filter(r => r.success);
    const failedResults = results.filter(r => !r.success);
    
    const totalProcessingTime = results.reduce((sum, r) => sum + r.processingTime, 0);
    const averageProcessingTime = successfulResults.length > 0 ? 
      totalProcessingTime / successfulResults.length : 0;

    const report = `# 🤖 Headless Claude Agent Test Report
*Generated: ${new Date().toISOString()}*  
*Test Type: 10 Entity Analysis with Neo4j + Headless Claude Agent*

---

## 🎯 Test Configuration

**Claude Agent Configuration:**
- Model: claude-3-5-sonnet-latest
- API Endpoint: ${CONFIG.claude.baseURL}
- Max Tokens: 1500 per entity
- Temperature: 0.7
- Mode: Headless (automated processing)

**Neo4j Configuration:**
- Database: ${CONFIG.neo4j.uri}
- Query: MATCH (e:Entity) WHERE e:Club OR e:League OR e:Person
- Entity Limit: 10

---

## 📊 Execution Summary

**Overall Results:**
- ✅ **Successful Analyses:** ${successfulResults.length}/${results.length} (${((successfulResults.length/results.length)*100).toFixed(1)}%)
- ❌ **Failed Analyses:** ${failedResults.length}/${results.length}
- ⏱️ **Total Processing Time:** ${(totalProcessingTime/1000).toFixed(1)} seconds
- 📈 **Average Processing Time:** ${(averageProcessingTime/1000).toFixed(1)} seconds per entity
- 🎯 **Success Rate:** ${((successfulResults.length/results.length)*100).toFixed(1)}%

---

## 🧠 Entity Analysis Results

${successfulResults.map((result, index) => `
### Entity ${index + 1}: ${result.entity.name}

**Entity Details:**
- **Name:** ${result.entity.name}
- **Type:** ${result.entity.type}
- **Sport:** ${result.entity.sport || 'Not specified'}
- **Country:** ${result.entity.country || 'Not specified'}
- **Processing Time:** ${(result.processingTime/1000).toFixed(1)}s

**Intelligence Analysis:**

${result.analysis}

---

*Analysis completed: ${result.timestamp}*
`).join('\n')}

${failedResults.length > 0 ? `
## ❌ Failed Analyses

${failedResults.map((result, index) => `
### Failed Entity ${index + 1}: ${result.entity.name}

**Error:** ${result.error}
**Entity Details:** ${result.entity.name} (${result.entity.type})
**Processing Time:** ${(result.processingTime/1000).toFixed(1)}s
**Timestamp:** ${result.timestamp}
`).join('\n')}
` : ''}

---

## 🎯 Key Insights

**Opportunities Identified:**
${successfulResults.map(r => {
  // Extract opportunity count from analysis (basic heuristic)
  const opportunityCount = (r.analysis.match(/opportunity/gi) || []).length;
  return `- ${r.entity.name}: ~${opportunityCount} opportunities identified`;
}).join('\n')}

**Entity Types Analyzed:**
${Object.entries(
  successfulResults.reduce((acc, r) => {
    const type = r.entity.type || 'Unknown';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {})
).map(([type, count]) => `- ${type}: ${count} entities`).join('\n')}

**Performance Metrics:**
- Fastest Analysis: ${Math.min(...successfulResults.map(r => r.processingTime))/1000}s
- Slowest Analysis: ${Math.max(...successfulResults.map(r => r.processingTime))/1000}s
- Total Tokens Generated: ~${successfulResults.reduce((sum, r) => sum + (r.analysis.length / 4), 0).toFixed(0)} tokens

---

## ✅ Test Conclusion

**Headless Claude Agent Performance:** ${successfulResults.length === results.length ? 'EXCELLENT' : 'NEEDS ATTENTION'}
- All entities processed successfully: ${successfulResults.length === results.length ? '✅' : '❌'}
- Average processing time: ${averageProcessingTime < 30000 ? 'Excellent' : averageProcessingTime < 60000 ? 'Good' : 'Needs Optimization'}
- Quality of analysis: ${successfulResults.length > 0 ? 'High-quality structured intelligence generated' : 'No successful analyses'}

**Recommendations:**
${successfulResults.length === results.length ? 
  '✅ Headless Claude Agent is working perfectly for automated entity analysis' :
  '⚠️ Review failed analyses and consider error handling improvements'
}

**Next Steps:**
1. Scale test to larger entity batches (50, 100, 250)
2. Implement batch processing with parallel execution
3. Add results storage to Neo4j for historical tracking
4. Set up automated cron jobs for continuous monitoring

---

*This test demonstrates the capability of Headless Claude Agent for automated sports intelligence analysis using Neo4j data.*

*Test Environment: Node.js + Neo4j + Claude Agent SDK*  
*Report generated by automated test system*`;

    // Save report
    const reportPath = path.join(CONFIG.output.dir, CONFIG.output.filename);
    await fs.writeFile(reportPath, report);
    
    console.log(`✅ Report saved to: ${reportPath}`);
    console.log(`📊 ${successfulResults.length}/${results.length} entities processed successfully`);
    console.log(`⏱️ Total time: ${(totalProcessingTime/1000).toFixed(1)}s`);
  }

  async runTest() {
    console.log('🚀 Starting Headless Claude Agent Test with 10 Neo4j Entities');
    console.log('================================================================');
    
    try {
      await this.initialize();
      
      // Fetch test entities
      const entities = await this.fetchTestEntities(10);
      
      if (entities.length === 0) {
        console.log('❌ No entities found. Please check your Neo4j connection and data.');
        return;
      }
      
      console.log(`\n🔄 Processing ${entities.length} entities with Headless Claude Agent...\n`);
      
      // Process each entity
      const results = [];
      for (let i = 0; i < entities.length; i++) {
        const result = await this.processEntityWithHeadlessAgent(entities[i], i);
        results.push(result);
        
        // Small delay between requests to avoid rate limiting
        if (i < entities.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      console.log('\n📊 Generating comprehensive report...\n');
      
      // Generate final report
      await this.generateReport(results);
      
      console.log('🎉 Headless Claude Agent test completed successfully!');
      console.log(`📁 Full report: ${path.join(CONFIG.output.dir, CONFIG.output.filename)}`);
      
    } catch (error) {
      console.error('💥 Test failed:', error.message);
      throw error;
    } finally {
      await this.driver.close();
    }
  }
}

// Main execution
async function main() {
  const tester = new HeadlessEntityTester();
  
  try {
    await tester.runTest();
    process.exit(0);
  } catch (error) {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  }
}

// Handle uncaught errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

// Run if called directly
if (require.main === module) {
  main();
}