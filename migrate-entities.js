const { createClient } = require('@supabase/supabase-js')
const neo4j = require('neo4j-driver')
require('dotenv').config()

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase configuration in environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// Initialize Neo4j driver
const neo4jUri = process.env.NEO4J_URI || 'bolt://localhost:7687'
const neo4jUser = process.env.NEO4J_USER || 'neo4j'
const neo4jPassword = process.env.NEO4J_PASSWORD || 'password'

const driver = neo4j.driver(neo4jUri, neo4j.auth.basic(neo4jUser, neo4jPassword))

async function migrateEntities() {
  console.log('🚀 Starting entity migration from Neo4j to Supabase...')
  
  const session = driver.session()
  
  try {
    // Get total count
    const countResult = await session.run('MATCH (n) RETURN count(n) as total')
    const total = countResult.records[0].get('total').toNumber()
    console.log(`📊 Found ${total} entities to migrate`)
    
    let migratedCount = 0
    let skip = 0
    const batchSize = 100
    
    while (skip < total) {
      console.log(`📦 Migrating batch ${Math.floor(skip/batchSize) + 1} (entities ${skip + 1}-${Math.min(skip + batchSize, total)})`)
      
      // Get batch of entities
      const result = await session.run(`
        MATCH (n)
        RETURN n
        ORDER BY n.name
        SKIP $skip
        LIMIT $limit
      `, { skip: neo4j.int(skip), limit: neo4j.int(batchSize) })
      
      const entities = result.records.map(record => {
        const node = record.get('n')
        return {
          neo4j_id: node.identity.toString(),
          labels: node.labels,
          properties: node.properties,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          cache_version: 1
        }
      })
      
      if (entities.length === 0) break
      
      // Upsert to Supabase
      const { data, error } = await supabase
        .from('cached_entities')
        .upsert(entities, { onConflict: 'neo4j_id' })
      
      if (error) {
        console.error('❌ Error migrating batch:', error)
        throw error
      }
      
      migratedCount += entities.length
      console.log(`✅ Successfully migrated ${entities.length} entities (Total: ${migratedCount}/${total})`)
      
      skip += batchSize
      
      // Small delay to prevent overwhelming the database
      if (skip < total) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }
    
    console.log(`🎉 Migration completed! Successfully migrated ${migratedCount} entities to Supabase`)
    
    // Get migration stats
    const { data: stats, error: statsError } = await supabase
      .from('cached_entities')
      .select('labels')
    
    if (statsError) {
      console.error('❌ Error getting migration stats:', statsError)
    } else {
      const entitiesByType = {}
      stats.forEach(entity => {
        entity.labels.forEach(label => {
          entitiesByType[label] = (entitiesByType[label] || 0) + 1
        })
      })
      
      console.log('📊 Migration statistics:')
      Object.entries(entitiesByType).forEach(([type, count]) => {
        console.log(`  ${type}: ${count}`)
      })
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  } finally {
    await session.close()
    await driver.close()
  }
}

async function main() {
  console.log('🚀 Starting Neo4j to Supabase entity migration...')
  
  // Test connections
  try {
    await supabase.from('cached_entities').select('count', { count: 'exact', head: true })
    console.log('✅ Supabase connection successful')
  } catch (error) {
    console.error('❌ Supabase connection failed:', error)
    console.log('💡 Make sure the cached_entities table exists in your Supabase database')
    process.exit(1)
  }
  
  try {
    const session = driver.session()
    await session.run('RETURN 1')
    await session.close()
    console.log('✅ Neo4j connection successful')
  } catch (error) {
    console.error('❌ Neo4j connection failed:', error)
    console.log('💡 Make sure Neo4j is running and accessible')
    process.exit(1)
  }
  
  await migrateEntities()
}

main().catch(console.error)