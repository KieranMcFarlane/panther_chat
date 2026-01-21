const { Neo4jService } = require('../src/lib/neo4j.ts');

const neo4jService = new Neo4jService();

async function queryEntities(skip = 700, limit = 50) {
  await neo4jService.initialize();
  const session = neo4jService.getDriver().session();
  
  try {
    const result = await session.run(`
      MATCH (e:Entity)
      WHERE e.type IN ['Club','League','Federation','Tournament']
      RETURN e.name, e.sport, e.country, e.type
      SKIP $skip LIMIT $limit
    `, {
      skip: parseInt(skip.toString()),
      limit: parseInt(limit.toString())
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

async function linkedinRFPDetection(entity) {
  console.log(`[ENTITY-START] ${entity.name}`);
  
  let detectionResult = {
    organization: entity.name,
    src_link: null,
    detection_strategy: 'linkedin',
    summary_json: {
      title: '',
      confidence: 0,
      urgency: 'low',
      fit_score: 0,
      rfp_type: null
    }
  };
  
  try {
    // Phase 1: LinkedIn Posts search for open RFPs
    const postsQuery = `site:linkedin.com/posts "${entity.name}" + ("invites proposals from" OR "soliciting proposals from" OR "request for expression of interest" OR "invitation to tender" OR "call for proposals" OR "vendor selection process" OR "We're looking for" + (digital OR technology OR software) OR "Seeking partners for" + (digital OR technology OR software))`;
    
    const postsResults = await mcp__brightdata_mcp__search_engine({
      query: postsQuery,
      engine: 'google'
    });
    
    if (postsResults && postsResults.results && postsResults.results.length > 0) {
      detectionResult.summary_json.rfp_type = 'ACTIVE_RFP';
      detectionResult.summary_json.confidence = 85;
      detectionResult.summary_json.urgency = 'high';
      detectionResult.summary_json.fit_score = 90;
      detectionResult.src_link = postsResults.results[0].url;
      detectionResult.summary_json.title = postsResults.results[0].title;
      
      console.log(`[ENTITY-FOUND] ${entity.name} (ACTIVE_RFP: ${postsResults.results.length})`);
      return detectionResult;
    }
    
    // Phase 2: LinkedIn Jobs search for early signals
    const jobsQuery = `site:linkedin.com/jobs company:${entity.name} + ("Project Manager" + (Digital OR Transformation OR Technology) OR "Program Manager" + Technology OR "Transformation Lead" OR "Implementation Manager" OR "Digital Lead" OR "Technology Manager")`;
    
    const jobsResults = await mcp__brightdata_mcp__search_engine({
      query: jobsQuery,
      engine: 'google'
    });
    
    if (jobsResults && jobsResults.results && jobsResults.results.length > 0) {
      detectionResult.summary_json.rfp_type = 'EARLY_SIGNAL';
      detectionResult.summary_json.confidence = 70;
      detectionResult.summary_json.urgency = 'medium';
      detectionResult.summary_json.fit_score = 65;
      detectionResult.src_link = jobsResults.results[0].url;
      detectionResult.summary_json.title = jobsResults.results[0].title;
      
      console.log(`[ENTITY-FOUND] ${entity.name} (EARLY_SIGNAL: ${jobsResults.results.length})`);
      return detectionResult;
    }
    
    // Phase 3: LinkedIn Company pages search
    const companyQuery = `site:linkedin.com/company "${entity.name}" + ("seeking digital partner" OR "mobile app RFP" OR "web development tender" OR "software vendor RFP" OR "digital transformation partner" OR "technology RFP")`;
    
    const companyResults = await mcp__brightdata_mcp__search_engine({
      query: companyQuery,
      engine: 'google'
    });
    
    if (companyResults && companyResults.results && companyResults.results.length > 0) {
      detectionResult.summary_json.rfp_type = 'SIGNAL';
      detectionResult.summary_json.confidence = 60;
      detectionResult.summary_json.urgency = 'low';
      detectionResult.summary_json.fit_score = 50;
      detectionResult.src_link = companyResults.results[0].url;
      detectionResult.summary_json.title = companyResults.results[0].title;
      
      console.log(`[ENTITY-FOUND] ${entity.name} (SIGNAL: ${companyResults.results.length})`);
      return detectionResult;
    }
    
    console.log(`[ENTITY-NONE] ${entity.name}`);
    return null;
    
  } catch (error) {
    console.error(`Error processing ${entity.name}:`, error);
    console.log(`[ENTITY-NONE] ${entity.name}`);
    return null;
  }
}

async function main() {
  try {
    console.log('Querying 50 entities from Neo4j...');
    const entities = await queryEntities(700, 50);
    console.log(`Found ${entities.length} entities to process`);
    
    const highlights = [];
    
    for (const entity of entities) {
      const result = await linkedinRFPDetection(entity);
      if (result) {
        highlights.push(result);
      }
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
    
    // Write to Supabase (placeholder - would need actual implementation)
    console.log('\nWriting results to Supabase...');
    
    await neo4jService.close();
    
  } catch (error) {
    console.error('Main process error:', error);
    await neo4jService.close();
  }
}

main().catch(console.error);