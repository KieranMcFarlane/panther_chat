import neo4j from 'neo4j-driver'

const driver = neo4j.driver(
  process.env.NEO4J_URI || 'neo4j+s://cce1f84b.databases.neo4j.io',
  neo4j.auth.basic(
    process.env.NEO4J_USER || 'neo4j',
    process.env.NEO4J_PASS || 'llNASCzMWGT-nTt-JkD9Qk_4W6PpJrv39X0PuYAIKV0'
  )
)

async function runCountQuery() {
  console.log('🔗 Connecting to Neo4j...')
  
  try {
    // Test connectivity
    await driver.verifyConnectivity()
    console.log('✅ Connected to Neo4j database')
    
    const session = driver.session()
    
    try {
      // Run the count query
      const result = await session.run('MATCH (n) RETURN COUNT(n) as count')
      const count = result.records[0].get('count')
      console.log(`📊 Total nodes in database: ${count}`)
      
      // Get entity types
      const typesResult = await session.run(`
        MATCH (n) 
        RETURN labels(n) as labels, count(*) as count 
        ORDER BY count DESC
      `)
      
      console.log('\n📋 Entity types:')
      typesResult.records.forEach(record => {
        const labels = record.get('labels')
        const count = record.get('count')
        console.log(`  ${labels.join(', ')}: ${count}`)
      })
      
      // Get relationship types
      const relResult = await session.run(`
        MATCH ()-[r]-() 
        RETURN type(r) as relationship, count(*) as count 
        ORDER BY count DESC
      `)
      
      console.log('\n🔗 Relationship types:')
      relResult.records.forEach(record => {
        const relationship = record.get('relationship')
        const count = record.get('count')
        console.log(`  ${relationship}: ${count}`)
      })
      
    } finally {
      await session.close()
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message)
  } finally {
    await driver.close()
  }
}

runCountQuery()