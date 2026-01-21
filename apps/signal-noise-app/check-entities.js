require('dotenv').config();
const neo4j = require('neo4j-driver');

async function checkEntities() {
  const driver = neo4j.driver(
    process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD)
  );
  
  const session = driver.session();
  
  try {
    console.log('CHECKING ENTITY STATUS\n');
    
    // Count total entities
    const countResult = await session.run('MATCH (e:Entity) RETURN count(e) as count');
    const totalCount = countResult.records[0].get('count').toNumber();
    console.log('Total entities: ' + totalCount);
    
    // Count entities with badges
    const badgeResult = await session.run('MATCH (e:Entity) WHERE e.badge_url IS NOT NULL RETURN count(e) as count');
    const badgeCount = badgeResult.records[0].get('count').toNumber();
    console.log('Entities with badges: ' + badgeCount);
    
    // Check Arsenal entities
    const arsenalResult = await session.run("MATCH (e:Entity) WHERE e.name CONTAINS 'Arsenal' RETURN e.name as name, e.badge_url as badgeUrl");
    console.log('\nArsenal entities: ' + arsenalResult.records.length);
    
    arsenalResult.records.forEach(record => {
      const name = record.get('name');
      const badge = record.get('badgeUrl');
      console.log('   ' + name + ' - ' + (badge || 'No badge'));
    });
    
    // Show recent Premier League entities
    const plResult = await session.run(
      "MATCH (e:Entity) WHERE e.name IN ['Arsenal', 'Arsenal FC', 'Manchester United', 'Liverpool', 'Chelsea', 'Manchester City'] RETURN e.name, e.badge_url"
    );
    
    console.log('\nPremier League entities:');
    plResult.records.forEach(record => {
      const name = record.get('e.name');
      const badge = record.get('e.badge_url');
      const status = badge ? 'HAS BADGE' : 'NO BADGE';
      console.log('   ' + status + ' - ' + name);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await session.close();
    await driver.close();
  }
}

checkEntities();