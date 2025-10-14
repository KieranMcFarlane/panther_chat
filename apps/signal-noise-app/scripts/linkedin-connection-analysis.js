#!/usr/bin/env node

/**
 * LinkedIn Connection Analysis Script
 * 
 * This script demonstrates how to use BrightData MCP tools to analyze
 * LinkedIn connections between sales team members and target entities.
 * 
 * Usage: node linkedin-connection-analysis.js
 */

const { query } = require('@anthropic-ai/claude-agent-sdk');

/**
 * Analyzes LinkedIn connections between your sales team and target entities
 * to identify the warmest introduction paths
 */
async function analyzeLinkedInConnections() {
  const salesTeamProfiles = [
    'https://www.linkedin.com/in/sales-person-1/',
    'https://www.linkedin.com/in/sales-person-2/',
    'https://www.linkedin.com/in/sales-person-3/'
  ];

  const targetEntityProfiles = [
    'https://www.linkedin.com/in/target-executive-1/',
    'https://www.linkedin.com/in/target-executive-2/',
    'https://www.linkedin.com/company/target-organization/'
  ];

  const analysisPrompt = `Analyze LinkedIn connections for sales introductions:

SALES TEAM PROFILES:
${salesTeamProfiles.join('\n')}

TARGET ENTITIES:
${targetEntityProfiles.join('\n')}

ANALYSIS TASKS:
1. For each sales team member, identify their connections to target entities
2. Look for shared connections, former colleagues, alumni networks
3. Identify 2nd-degree connections that could facilitate introductions
4. Score each potential introduction path by warmth/strength
5. Recommend the optimal introduction strategy for each target

Use BrightData tools to:
- Scrape LinkedIn profiles for connection data
- Search for mutual connections and shared networks
- Analyze company relationships and employee movements
- Identify the strongest connection paths

Return structured JSON with:
{
  "introduction_paths": [
    {
      "sales_person": "Name",
      "target_entity": "Company/Person", 
      "connection_strength": "STRONG|MEDIUM|WEAK",
      "connection_type": "DIRECT|2ND_DEGREE|MUTUAL_CONNECTION",
      "shared_connections": ["List of mutual connections"],
      "introduction_strategy": "Recommended approach",
      "confidence_score": 85
    }
  ],
  "recommendations": [
    {
      "target": "Target company",
      "best_path": "Recommended sales person + connection",
      "reasoning": "Why this is the warmest intro"
    }
  ]
}`;

  try {
    console.log('🔍 Analyzing LinkedIn connections for warm introductions...');
    
    const result = await query({
      prompt: analysisPrompt,
      options: {
        mcpServers: {
          "brightdata": {
            "command": "npx",
            "args": ["-y", "@brightdata/mcp"],
            "env": {
              "API_TOKEN": process.env.BRIGHTDATA_API_TOKEN || ""
            }
          }
        },
        allowedTools: [
          "mcp__brightdata__scrape_as_markdown",
          "mcp__brightdata__search_engine",
          "mcp__brightdata__scrape_batch"
        ],
        maxTurns: 8
      }
    });

    console.log('✅ LinkedIn Connection Analysis Complete:');
    console.log(JSON.stringify(result, null, 2));
    
    return result;
    
  } catch (error) {
    console.error('❌ LinkedIn connection analysis failed:', error);
    return null;
  }
}

/**
 * Batch analyze connections for multiple target entities
 */
async function batchConnectionAnalysis(targetEntities) {
  console.log(`🔄 Analyzing connections for ${targetEntities.length} target entities...`);
  
  const results = [];
  
  for (let i = 0; i < targetEntities.length; i += 3) {
    // Process in batches of 3 for economical usage
    const batch = targetEntities.slice(i, i + 3);
    
    console.log(`📊 Processing batch ${Math.floor(i/3) + 1}: ${batch.map(e => e.name).join(', ')}`);
    
    const batchResult = await analyzeConnectionsForBatch(batch);
    results.push(...batchResult);
    
    // Small delay between batches to avoid rate limits
    if (i + 3 < targetEntities.length) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  return results;
}

/**
 * Analyze connections for a specific batch of entities
 */
async function analyzeConnectionsForBatch(entities) {
  const batchPrompt = `Analyze LinkedIn connections for this batch of entities:

ENTITIES: ${entities.map(e => `${e.name} (${entity.linkedin_url})`).join('\n')}

For each entity, identify:
1. Strongest connection paths from our sales team
2. Mutual connections and shared networks
3. Company relationships and employee movements
4. Optimal introduction strategy

Focus on actionable introduction opportunities with concrete connection details.`;

  try {
    const result = await query({
      prompt: batchPrompt,
      options: {
        mcpServers: {
          "brightdata": {
            "command": "npx",
            "args": ["-y", "@brightdata/mcp"],
            "env": {
              "API_TOKEN": process.env.BRIGHTDATA_API_TOKEN || ""
            }
          }
        },
        allowedTools: [
          "mcp__brightdata__scrape_as_markdown",
          "mcp__brightdata__search_engine"
        ],
        maxTurns: 6
      }
    });

    return result;
    
  } catch (error) {
    console.error(`❌ Batch connection analysis failed:`, error);
    return [];
  }
}

// Example usage and testing
if (require.main === module) {
  // Example target entities
  const exampleTargets = [
    {
      name: "Arsenal FC",
      linkedin_url: "https://www.linkedin.com/company/arsenal-fc/",
      key_contacts: [
        "https://www.linkedin.com/in/arsenal-executive-1/",
        "https://www.linkedin.com/in/arsenal-executive-2/"
      ]
    },
    {
      name: "Chelsea FC", 
      linkedin_url: "https://www.linkedin.com/company/chelsea-fc/",
      key_contacts: [
        "https://www.linkedin.com/in/chelsea-executive-1/"
      ]
    }
  ];

  console.log('🎯 Starting LinkedIn Connection Analysis Demo...');
  console.log('This will identify the warmest introduction paths from your sales team to target entities.\n');
  
  analyzeLinkedInConnections()
    .then(result => {
      if (result) {
        console.log('\n🎉 Analysis complete! Check the results above for optimal introduction paths.');
      } else {
        console.log('\n❌ Analysis failed. Check your BrightData API configuration.');
      }
    })
    .catch(console.error);
}

module.exports = {
  analyzeLinkedInConnections,
  batchConnectionAnalysis,
  analyzeConnectionsForBatch
};