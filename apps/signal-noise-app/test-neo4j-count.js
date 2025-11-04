import { Neo4jService } from './src/lib/neo4j.js'

const neo4jService = new Neo4jService()

async function runTestQuery() {
  try {
    console.log('🔗 Connecting to Neo4j...')
    await neo4jService.initialize()
    
    console.log('📊 Running query: MATCH (n) RETURN COUNT(n)')
    const session = neo4jService.getDriver().session()
    
    try {
      const result = await session.run('MATCH (n) RETURN COUNT(n) as count')
      const count = result.records[0].get('count')
      console.log(`✅ Total nodes in database: ${count}`)
      
      // Also check what types of entities exist
      const typesResult = await session.run('MATCH (n) RETURN labels(n) as labels, count(*) as count')
      console.log('\n📋 Entity types:')
      typesResult.records.forEach(record => {
        const labels = record.get('labels')
        const count = record.get('count')
        console.log(`  ${labels.join(', ')}: ${count}`)
      })
      
    } finally {
      await session.close()
    }
    
  } catch (error) {
    console.error('❌ Error running query:', error.message)
  } finally {
    await neo4jService.close()
  }
}

runTestQuery()