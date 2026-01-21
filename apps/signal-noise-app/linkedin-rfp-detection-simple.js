const neo4j = require('neo4j-driver');

// Neo4j connection setup
const driver = neo4j.driver(
  process.env.NEO4J_URI || 'neo4j+s://cce1f84b.databases.neo4j.io',
  neo4j.auth.basic(
    process.env.NEO4J_USERNAME || 'neo4j',
    process.env.NEO4J_PASSWORD || 'llNASCzMWGT-nTt-JkD9Qk_4W6PpJrv39X0PuYAIKV0'
  )
);

async function queryEntities(skip = 700, limit = 50) {
  const session = driver.session();
  
  try {
    const result = await session.run(`
      MATCH (e:Entity)
      WHERE e.type IN ['Club','League','Federation','Tournament']
      RETURN e.name, e.sport, e.country, e.type
      SKIP $skip LIMIT $limit
    `, {
      skip: neo4j.int(skip),
      limit: neo4j.int(limit)
    });
    
    return result.records.map(record => ({
      name: record.get('e.name'),
      sport: record.get('e.sport'),
      country: record.get('e.country'),
      type: record.get('e.type')
    }));
  } finally {
    await session.close();
  }
}

async function main() {
  try {
    console.log('Querying 50 entities from Neo4j...');
    const entities = await queryEntities(700, 50);
    console.log(`Found ${entities.length} entities to process`);
    
    const highlights = [];
    let entityCount = 0;
    
    for (const entity of entities) {
      entityCount++;
      console.log(`[ENTITY-START] ${entity.name}`);
      
      // Phase 1: LinkedIn Posts search for open RFPs
      console.log(`Phase 1: Searching LinkedIn posts for ${entity.name}...`);
      try {
        const postsResults = await mcp__brightdata_mcp__search_engine({
          query: `site:linkedin.com/posts "${entity.name}" "invites proposals from" OR "soliciting proposals from" OR "request for expression of interest" OR "invitation to tender" OR "call for proposals" OR "vendor selection process"`,
          engine: 'google'
        });
        
        if (entityCount <= 3) {
          console.log(`[MCP-RESPONSE-POSTS] ${JSON.stringify(postsResults?.results?.slice(0, 3) || [])}`);
        }
        
        if (postsResults && postsResults.results && postsResults.results.length > 0) {
          const firstResult = postsResults.results[0];
          highlights.push({
            organization: entity.name,
            src_link: firstResult.url,
            detection_strategy: 'linkedin',
            summary_json: {
              title: firstResult.title,
              confidence: 85,
              urgency: 'high',
              fit_score: 90,
              rfp_type: 'ACTIVE_RFP'
            }
          });
          console.log(`[ENTITY-FOUND] ${entity.name} (ACTIVE_RFP: ${postsResults.results.length})`);
          continue;
        }
      } catch (error) {
        console.error(`Phase 1 error for ${entity.name}:`, error.message);
      }
      
      // Phase 2: LinkedIn Jobs search for early signals
      console.log(`Phase 2: Searching LinkedIn jobs for ${entity.name}...`);
      try {
        const jobsResults = await mcp__brightdata_mcp__search_engine({
          query: `site:linkedin.com/jobs company:${entity.name} "Project Manager" + (Digital OR Transformation OR Technology) OR "Program Manager" + Technology OR "Transformation Lead" OR "Implementation Manager"`,
          engine: 'google'
        });
        
        if (jobsResults && jobsResults.results && jobsResults.results.length > 0) {
          const firstResult = jobsResults.results[0];
          highlights.push({
            organization: entity.name,
            src_link: firstResult.url,
            detection_strategy: 'linkedin',
            summary_json: {
              title: firstResult.title,
              confidence: 70,
              urgency: 'medium',
              fit_score: 65,
              rfp_type: 'EARLY_SIGNAL'
            }
          });
          console.log(`[ENTITY-FOUND] ${entity.name} (EARLY_SIGNAL: ${jobsResults.results.length})`);
          continue;
        }
      } catch (error) {
        console.error(`Phase 2 error for ${entity.name}:`, error.message);
      }
      
      // Phase 3: LinkedIn Company pages search
      console.log(`Phase 3: Searching LinkedIn company for ${entity.name}...`);
      try {
        const companyResults = await mcp__brightdata_mcp__search_engine({
          query: `site:linkedin.com/company "${entity.name}" "seeking digital partner" OR "mobile app RFP" OR "web development tender" OR "software vendor RFP" OR "digital transformation partner" OR "technology RFP"`,
          engine: 'google'
        });
        
        if (companyResults && companyResults.results && companyResults.results.length > 0) {
          const firstResult = companyResults.results[0];
          highlights.push({
            organization: entity.name,
            src_link: firstResult.url,
            detection_strategy: 'linkedin',
            summary_json: {
              title: firstResult.title,
              confidence: 60,
              urgency: 'low',
              fit_score: 50,
              rfp_type: 'SIGNAL'
            }
          });
          console.log(`[ENTITY-FOUND] ${entity.name} (SIGNAL: ${companyResults.results.length})`);
          continue;
        }
      } catch (error) {
        console.error(`Phase 3 error for ${entity.name}:`, error.message);
      }
      
      console.log(`[ENTITY-NONE] ${entity.name}`);
    }
    
    const finalResult = {
      total_rfps_detected: highlights.length,
      entities_checked: 50,
      detection_strategy: 'linkedin',
      highlights: highlights,
      scoring_summary: {
        avg_confidence: highlights.length > 0 ? 
          Math.round(highlights.reduce((sum, h) => sum + h.summary_json.confidence, 0) / highlights.length) : 0,
        avg_fit_score: highlights.length > 0 ? 
          Math.round(highlights.reduce((sum, h) => sum + h.summary_json.fit_score, 0) / highlights.length) : 0,
        top_opportunity: highlights.length > 0 ? 
          highlights.sort((a, b) => b.summary_json.fit_score - a.summary_json.fit_score)[0].organization : 'None'
      }
    };
    
    console.log('\n=== FINAL RESULT ===');
    console.log(JSON.stringify(finalResult, null, 2));
    
    await driver.close();
    return finalResult;
    
  } catch (error) {
    console.error('Main process error:', error);
    await driver.close();
    throw error;
  }
}

main().catch(console.error);