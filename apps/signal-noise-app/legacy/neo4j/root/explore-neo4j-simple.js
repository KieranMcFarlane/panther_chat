const neo4j = require('neo4j-driver');

require('dotenv').config();

async function exploreNeo4jSimple() {
  console.log('🔍 Exploring Neo4j Database (Simplified)...\n');
  
  const driver = neo4j.driver(
    process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD)
  );
  
  const session = driver.session();
  
  try {
    // 1. Basic Statistics
    console.log('📊 BASIC STATISTICS');
    const nodeCountResult = await session.run('MATCH (n) RETURN count(n) as nodeCount');
    const relCountResult = await session.run('MATCH ()-[r]->() RETURN count(r) as relCount');
    
    console.log(`Total Nodes: ${nodeCountResult.records[0].get('nodeCount').toLocaleString()}`);
    console.log(`Total Relationships: ${relCountResult.records[0].get('relCount').toLocaleString()}\n`);

    // 2. Label Distribution
    console.log('🏷️ LABEL DISTRIBUTION');
    const labelResult = await session.run('CALL db.labels() YIELD label CALL apoc.cypher.run("MATCH (n:' + label + ') RETURN count(n) as count", {}) YIELD value RETURN label, value.count as count ORDER BY value.count DESC');
    
    labelResult.records.forEach(record => {
      console.log(`  ${record.get('label')}: ${record.get('count').toLocaleString()}`);
    });
    console.log();

    // 3. Dossier Data Analysis
    console.log('📋 DOSSIER ANALYSIS');
    const dossierResult = await session.run('MATCH (n) WHERE n.dossier_data IS NOT NULL RETURN COUNT(n) as count');
    const noDossierResult = await session.run('MATCH (n) WHERE n.dossier_data IS NULL RETURN COUNT(n) as count');
    
    console.log(`Entities with dossier_data: ${dossierResult.records[0].get('count').toLocaleString()}`);
    console.log(`Entities without dossier_data: ${noDossierResult.records[0].get('count').toLocaleString()}`);
    console.log(`Coverage: ${(dossierResult.records[0].get('count') / (dossierResult.records[0].get('count') + noDossierResult.records[0].get('count')) * 100).toFixed(1)}%`);
    console.log();

    // 4. Named Entities Sample
    console.log('🏟️ NAMED ENTITIES SAMPLE');
    const namedResult = await session.run('MATCH (n) WHERE n.name IS NOT NULL RETURN n.name as name, labels(n) as labels LIMIT 20');
    
    console.log('Sample named entities:');
    namedResult.records.forEach(record => {
      console.log(`  ${record.get('name')} - ${record.get('labels').join(', ')}`);
    });
    console.log();

    // 5. Yellow Panther Network
    console.log('🐆 YELLOW PANTHER NETWORK');
    const ypEntitiesResult = await session.run('MATCH (n:YellowPanther) RETURN n.name as name');
    const ypConnectionsResult = await session.run('MATCH (entity)-[:HAS_CONNECTION_TO]-(yp:YellowPanther) RETURN COUNT(DISTINCT entity) as entities');
    
    console.log(`YP Team members: ${ypEntitiesResult.records.length}`);
    console.log(`Entities connected to YP: ${ypConnectionsResult.records[0].get('entities').toLocaleString()}`);
    
    ypEntitiesResult.records.forEach(record => {
      console.log(`  ${record.get('name')}`);
    });
    console.log();

    // 6. Sports Distribution
    console.log('⚽ SPORTS DISTRIBUTION');
    const sportsResult = await session.run('MATCH (n) WHERE n.sport IS NOT NULL RETURN n.sport as sport, COUNT(n) as count ORDER BY count DESC LIMIT 15');
    
    sportsResult.records.forEach(record => {
      console.log(`  ${record.get('sport')}: ${record.get('count').toLocaleString()}`);
    });
    console.log();

    // 7. High-Value Entities
    console.log('💎 HIGH-VALUE ENTITIES');
    const highValueResult = await session.run('MATCH (n) WHERE n.priorityScore >= 80 OR n.opportunity_score >= 80 RETURN n.name as name, COALESCE(n.priorityScore, n.opportunity_score) as score, n.sport as sport, labels(n)[0] as type ORDER BY score DESC LIMIT 15');
    
    highValueResult.records.forEach(record => {
      console.log(`  ${record.get('name')} (${record.get('sport')}) - Score: ${record.get('score')} - ${record.get('type')}`);
    });
    console.log();

    // 8. Countries Distribution
    console.log('🌍 COUNTRIES DISTRIBUTION');
    const countriesResult = await session.run('MATCH (n) WHERE n.country IS NOT NULL RETURN n.country as country, COUNT(n) as count ORDER BY count DESC LIMIT 10');
    
    countriesResult.records.forEach(record => {
      console.log(`  ${record.get('country')}: ${record.get('count').toLocaleString()}`);
    });
    console.log();

    // 9. Technology Partners
    console.log('💻 TECHNOLOGY PARTNERS');
    const techResult = await session.run('MATCH (n:TechnologyPartner) RETURN n.name as name LIMIT 10');
    
    if (techResult.records.length > 0) {
      console.log('Technology partners in database:');
      techResult.records.forEach(record => {
        console.log(`  ${record.get('name')}`);
      });
    } else {
      console.log('No technology partners found');
    }
    console.log();

    // 10. Opportunities
    console.log('🎯 OPPORTUNITIES');
    const oppResult = await session.run('MATCH (n:Opportunity) RETURN n.name as name LIMIT 10');
    
    if (oppResult.records.length > 0) {
      console.log('Opportunities in database:');
      oppResult.records.forEach(record => {
        console.log(`  ${record.get('name')}`);
      });
    } else {
      console.log('No opportunities found');
    }

  } catch (error) {
    console.error('❌ Neo4j Error:', error.message);
  } finally {
    await session.close();
    await driver.close();
  }
}

exploreNeo4jSimple().catch(console.error);