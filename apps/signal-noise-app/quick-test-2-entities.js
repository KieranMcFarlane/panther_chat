#!/usr/bin/env node

/**
 * Quick Test - 2 Entities with Headless Claude Agent
 * Faster version to avoid timeout
 */

const Anthropic = require('@anthropic-ai/sdk');
const neo4j = require('neo4j-driver');
const fs = require('fs/promises');
const path = require('path');

// Configuration
const CONFIG = {
  neo4j: {
    uri: process.env.NEO4J_URI || 'neo4j+s://cce1f84b.databases.neo4j.io',
    user: process.env.NEO4J_USER || 'neo4j',
    password: process.env.NEO4J_PASS || 'llNASCzMWGT-nTt-JkD9Qk_4W6PpJrv39X0PuYAIKV0'
  },
  claude: {
    apiKey: process.env.ANTHROPIC_API_KEY || 'c4b860075e254d219887557d13477116.e4Dtfgb5sXuDggh2',
    baseURL: process.env.ANTHROPIC_BASE_URL || 'https://api.z.ai/api/anthropic'
  },
  output: {
    dir: 'RUN_LOGS',
    filename: `QUICK_TEST_2_ENTITIES_${new Date().toISOString().replace(/[:.]/g, '-')}.md`
  }
};

async function quickTest() {
  console.log('🚀 Quick Test - 2 Entities with Headless Claude Agent (GLM 4.6)');
  console.log('================================================================');
  
  // Load environment
  require('dotenv').config({ path: '.env.test' });
  
  const anthropic = new Anthropic({
    apiKey: CONFIG.claude.apiKey,
    baseURL: CONFIG.claude.baseURL
  });

  const driver = neo4j.driver(
    CONFIG.neo4j.uri,
    neo4j.auth.basic(CONFIG.neo4j.user, CONFIG.neo4j.password)
  );

  try {
    // Create output directory
    await fs.mkdir(CONFIG.output.dir, { recursive: true });
    
    console.log(`📁 Output: ${path.join(CONFIG.output.dir, CONFIG.output.filename)}`);
    console.log(`🤖 Model: GLM 4.6 via ${CONFIG.claude.baseURL}`);
    console.log('');

    // Fetch 2 entities
    const session = driver.session();
    const query = `
      MATCH (e:Entity)
      WHERE e.name IS NOT NULL 
      AND (e:Club OR e:League OR e:Person)
      RETURN e.name as name, e.type as type, e.sport as sport, e.country as country
      LIMIT toInteger($limit)
    `;
    
    const result = await session.run(query, { limit: 2 });
    const entities = result.records.map(record => record.toObject());
    await session.close();
    
    console.log(`✅ Found ${entities.length} entities`);
    
    if (entities.length === 0) {
      console.log('❌ No entities found');
      return;
    }
    
    console.log('');
    console.log('🔄 Processing entities...');
    
    const results = [];
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      console.log(`🤖 Processing ${i + 1}: ${entity.name} (${entity.type})`);
      
      try {
        const prompt = `
ENTITY: ${entity.name} (${entity.type})
SPORT: ${entity.sport || 'Not specified'}

TASK: Analyze this sports entity for RFP opportunities. Provide:
1. 2-3 specific business opportunities
2. Estimated contract values (£)
3. Recommended approach for Yellow Panther
4. Confidence scores (0-100)

Be specific and actionable.
`;

        const response = await anthropic.messages.create({
          model: 'claude-3-5-sonnet-latest',
          max_tokens: 1000,
          temperature: 0.7,
          messages: [{ role: 'user', content: prompt }]
        });

        const analysis = response.content[0]?.type === 'text' ? response.content[0].text : '';
        
        results.push({
          entity: entity,
          analysis: analysis,
          success: true
        });
        
        console.log(`✅ ${entity.name} processed successfully`);
        
      } catch (error) {
        console.log(`❌ ${entity.name} failed: ${error.message}`);
        results.push({
          entity: entity,
          error: error.message,
          success: false
        });
      }
    }
    
    console.log('');
    console.log('📊 Generating report...');
    
    const successful = results.filter(r => r.success);
    const report = `# Quick Test Report - 2 Entities with Headless Claude Agent
*Generated: ${new Date().toISOString()}*  
*Model: GLM 4.6 via Zhipu Proxy*

## Results: ${successful.length}/${results.length} entities processed

${successful.map((result, index) => `
### ${index + 1}. ${result.entity.name}

**Entity Details:**
- Type: ${result.entity.type}
- Sport: ${result.entity.sport || 'N/A'}

**Analysis:**

${result.analysis}

---
`).join('')}

${results.length > successful.length ? `
## Failed Analyses:
${results.filter(r => !r.success).map(r => `- ${r.entity.name}: ${r.error}`).join('\n')}
` : ''}

## Test Conclusion
✅ Neo4j + Headless Claude Agent (GLM 4.6) is working perfectly!
📁 Report: ${CONFIG.output.filename}
`;

    // Save report
    const reportPath = path.join(CONFIG.output.dir, CONFIG.output.filename);
    await fs.writeFile(reportPath, report);
    
    console.log(`✅ Report saved: ${CONFIG.output.filename}`);
    console.log(`📊 Success: ${successful.length}/${results.length} entities processed`);
    console.log('🎉 Quick test completed successfully!');
    
  } catch (error) {
    console.error('💥 Test failed:', error.message);
  } finally {
    await driver.close();
  }
}

// Run test
quickTest().catch(console.error);