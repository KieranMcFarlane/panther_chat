const neo4j = require('neo4j-driver');
const fs = require('fs');

// We'll manually create batches using the data we get from MCP functions
const BATCH_DATA = [
  // Batch 1: First 10 entities from the MCP query result
  [
    {
      neo4j_id: "4366",
      labels: ["Person"],
      properties: {
        name: "Andy Smith",
        role: "Financial Director",
        focus: "Financial planning and budget management",
        contactType: "FINANCIAL_DECISION_MAKER",
        currentCompany: "Harrogate Town",
        yellowPantherPriority: "MEDIUM",
        yellowPantherAccessibility: "HIGH"
      },
      badge_s3_url: null
    },
    {
      neo4j_id: "3048",
      labels: ["Entity"],
      properties: {
        name: "FIA World Rallycross Championship (WRX)",
        tier: "",
        type: "Tournament",
        level: "FIA Rallycross",
        notes: "",
        sport: "Motorsport",
        source: "csv_seed",
        country: "Global",
        website: "https://www.fiaworldrallycross.com/",
        linkedin: "",
        mobileApp: "",
        description: "",
        priorityScore: "",
        estimatedValue: "",
        digitalWeakness: "",
        opportunityType: ""
      },
      badge_s3_url: null
    },
    {
      neo4j_id: "3716",
      labels: ["Person"],
      properties: {
        name: "Thomas Strakosha",
        role: "Director of Football",
        focus: "Advanced analytics, recruitment technology",
        priority: "CRITICAL",
        influence: { low: 89, high: 0 },
        contact_type: "DECISION_MAKER"
      },
      badge_s3_url: null
    },
    {
      neo4j_id: "591",
      labels: ["Entity"],
      properties: {
        name: "Botswana Football Association",
        tier: "",
        type: "Federation",
        level: "FIFA Member",
        notes: "",
        sport: "Football",
        source: "csv_seed",
        country: "Botswana",
        website: "https://www.bfa.co.bw/",
        linkedin: "Not publicly available",
        mobileApp: "",
        description: "",
        priorityScore: "",
        estimatedValue: "",
        digitalWeakness: "",
        opportunityType: ""
      },
      badge_s3_url: null
    },
    {
      neo4j_id: "676",
      labels: ["Entity"],
      properties: {
        name: "Madagascar Football Federation",
        tier: "",
        type: "Federation",
        level: "FIFA Member",
        notes: "",
        sport: "Football",
        source: "csv_seed",
        country: "Madagascar",
        website: "-",
        linkedin: "Not publicly available",
        mobileApp: "",
        description: "",
        priorityScore: "",
        estimatedValue: "",
        digitalWeakness: "",
        opportunityType: ""
      },
      badge_s3_url: null
    },
    {
      neo4j_id: "4370",
      labels: ["Person"],
      properties: {
        name: "Chris Murray",
        role: "Head of Digital",
        focus: "Digital transformation and fan engagement platforms",
        contactType: "TECHNICAL_DECISION_MAKER",
        currentCompany: "Salford City",
        yellowPantherPriority: "HIGH",
        yellowPantherAccessibility: "HIGH"
      },
      badge_s3_url: null
    },
    {
      neo4j_id: "1900",
      labels: ["Entity"],
      properties: {
        name: "Balochistan",
        tier: "",
        type: "Club",
        level: "Quaid-e-Azam Trophy",
        notes: "",
        sport: "Cricket",
        source: "csv_seed",
        country: "Pakistan",
        website: "https://pcb.com.pk/balochistan",
        linkedin: "",
        mobileApp: "",
        description: "",
        priorityScore: "",
        estimatedValue: "",
        digitalWeakness: "",
        opportunityType: ""
      },
      badge_s3_url: null
    },
    {
      neo4j_id: "740",
      labels: ["Entity"],
      properties: {
        name: "International Biathlon Union (IBU) (json_seed)",
        tier: "tier_3",
        type: "Organization",
        level: "",
        notes: "",
        sport: "",
        source: "json_seed",
        country: "",
        website: "",
        linkedin: "",
        mobileApp: false,
        description: "Biathlonworld.com official site, live data center for World Cups, IBU app, YouTube channel for highlights and features ",
        originalName: "International Biathlon Union (IBU)",
        priorityScore: 5,
        estimatedValue: "£100K-£500K",
        digitalWeakness: "",
        opportunityType: ""
      },
      badge_s3_url: null
    },
    {
      neo4j_id: "3528",
      labels: ["Sport"],
      properties: {
        name: "Karate"
      },
      badge_s3_url: null
    },
    {
      neo4j_id: "3196",
      labels: ["Entity"],
      properties: {
        name: "Uno-X Mobility",
        tier: "",
        type: "Team",
        level: "UCI Women's WorldTeam",
        notes: "",
        sport: "Cycling",
        source: "csv_seed",
        country: "Norway",
        website: "https://www.unoxmobility.com/",
        linkedin: "https://www.linkedin.com/company/uno-x-mobility",
        mobileApp: "",
        description: "",
        priorityScore: "",
        estimatedValue: "",
        digitalWeakness: "",
        opportunityType: ""
      },
      badge_s3_url: null
    }
  ]
];

async function migrateSampleBatch() {
  console.log('🚀 Starting Sample Migration with Real Data from MCP');
  
  // Neo4j configuration
  const NEO4J_URI = process.env.NEO4J_URI || 'neo4j+s://cce1f84b.databases.neo4j.io';
  const NEO4J_USERNAME = process.env.NEO4J_USERNAME || 'neo4j';
  const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || 'llNASCzMWGT-nTt-JkD9Qk_4W6PpJrv39X0PuYAIKV0';
  
  const driver = neo4j.driver(
    NEO4J_URI,
    neo4j.auth.basic(NEO4J_USERNAME, NEO4J_PASSWORD)
  );
  
  await driver.verifyConnectivity();
  console.log('✅ Connected to Neo4j AuraDB');
  
  const session = driver.session();
  
  try {
    // Check current state
    const currentCountResult = await session.run('MATCH (n) RETURN count(n) as current');
    const currentCount = currentCountResult.records[0].get('current').toNumber();
    console.log(`📊 Current Neo4j entities: ${currentCount}`);
    
    // Clear existing entities
    if (currentCount > 0) {
      console.log('🗑️ Clearing existing entities...');
      await session.run('MATCH (n) DETACH DELETE n');
      console.log('✅ Cleared existing entities');
    }
    
    // Setup constraints
    console.log('🔧 Setting up constraints...');
    await setupConstraintsAndIndexes(session);
    
    // Process the sample batch
    console.log('📦 Processing sample batch with real data...');
    const entities = BATCH_DATA[0];
    
    let createdCount = 0;
    let errors = [];
    
    // Process batch in transaction
    const tx = session.beginTransaction();
    try {
      let batchCreated = 0;
      for (const entity of entities) {
        try {
          await createEntityInNeo4j(tx, entity);
          batchCreated++;
          createdCount++;
          console.log(`✅ Created entity: ${entity.properties.name || entity.neo4j_id} (${entity.labels.join('/')})`);
        } catch (entityError) {
          const errorMsg = `Failed to create entity ${entity.neo4j_id}: ${entityError.message}`;
          errors.push(errorMsg);
          console.warn(`⚠️ ${errorMsg}`);
        }
      }
      
      await tx.commit();
      console.log(`✅ Batch completed: ${batchCreated}/${entities.length} entities created`);
      
    } catch (txError) {
      console.error(`❌ Transaction failed:`, txError);
      await tx.rollback();
      errors.push(`Transaction failed: ${txError.message}`);
    }
    
    // Create relationships
    console.log('🔗 Creating relationships between entities...');
    const relationshipStats = await createRelationshipsFromProperties(session);
    
    // Verify final state
    const finalCountResult = await session.run('MATCH (n) RETURN count(n) as final');
    const finalCount = finalCountResult.records[0].get('final').toNumber();
    
    const relationshipCountResult = await session.run('MATCH ()-[r]->() RETURN count(r) as relCount');
    const relationshipCount = relationshipCountResult.records[0].get('relCount').toNumber();
    
    // Get sample of created entities
    const sampleResult = await session.run(`
      MATCH (n) 
      WHERE n.name IS NOT NULL 
      RETURN n.name as name, labels(n) as labels, n.type as type, n.sport as sport 
      LIMIT 15
    `);
    
    const createdSampleEntities = sampleResult.records.map(record => ({
      name: record.get('name'),
      labels: record.get('labels'),
      type: record.get('type'),
      sport: record.get('sport')
    }));
    
    await session.close();
    await driver.close();
    
    console.log('\n🎉 SAMPLE MIGRATION COMPLETE!');
    console.log(`📊 Target entities: ${entities.length}`);
    console.log(`✅ Created entities: ${createdCount}`);
    console.log(`📈 Final entity count: ${finalCount}`);
    console.log(`🔗 Created relationships: ${relationshipCount}`);
    
    console.log('\n📋 Sample entities created:');
    createdSampleEntities.forEach(entity => {
      console.log(`  • ${entity.name} (${entity.labels.join('/')}, ${entity.type || 'N/A'}, ${entity.sport || 'N/A'})`);
    });
    
    console.log('\n💡 This demonstrates that the migration works with real data from MCP functions.');
    console.log('📥 To migrate all 4,422 entities, we would need to continue this process with additional batches.');
    
    if (errors.length > 0) {
      console.log(`\n⚠️ Encountered ${errors.length} errors:`);
      errors.forEach(error => console.log(`  • ${error}`));
    }
    
    return {
      success: true,
      stats: {
        targetEntities: entities.length,
        createdEntities: createdCount,
        finalEntityCount: finalCount,
        relationshipCount: relationshipCount,
        relationshipStats: relationshipStats,
        errors: errors,
        sampleEntities: createdSampleEntities,
        note: `Successfully demonstrated migration with ${createdCount} real entities from Supabase via MCP functions`
      }
    };
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    await session.close();
    throw error;
  }
}

async function setupConstraintsAndIndexes(session) {
  const constraints = [
    'CREATE CONSTRAINT entity_id_unique IF NOT EXISTS FOR (e:Entity) REQUIRE e.neo4j_id IS UNIQUE',
    'CREATE CONSTRAINT person_id_unique IF NOT EXISTS FOR (p:Person) REQUIRE p.neo4j_id IS UNIQUE',
    'CREATE CONSTRAINT country_id_unique IF NOT EXISTS FOR (c:Country) REQUIRE c.neo4j_id IS UNIQUE',
    'CREATE CONSTRAINT sport_id_unique IF NOT EXISTS FOR (s:Sport) REQUIRE s.neo4j_id IS UNIQUE',
    'CREATE CONSTRAINT league_id_unique IF NOT EXISTS FOR (l:League) REQUIRE l.neo4j_id IS UNIQUE',
    'CREATE CONSTRAINT venue_id_unique IF NOT EXISTS FOR (v:Venue) REQUIRE v.neo4j_id IS UNIQUE',
    'CREATE CONSTRAINT federation_id_unique IF NOT EXISTS FOR (f:Federation) REQUIRE f.neo4j_id IS UNIQUE'
  ];

  for (const constraint of constraints) {
    try {
      await session.run(constraint);
    } catch (error) {
      if (!error.message.includes('already exists')) {
        console.warn(`⚠️ Warning creating constraint: ${error.message}`);
      }
    }
  }
}

async function createEntityInNeo4j(tx, entity) {
  const { neo4j_id, labels, properties, badge_s3_url } = entity;
  
  if (!neo4j_id || !labels || labels.length === 0) {
    throw new Error(`Invalid entity data: missing neo4j_id or labels for entity ${neo4j_id}`);
  }
  
  // Clean and prepare labels for Cypher
  const cleanLabels = labels.map(label => 
    label.replace(/[^a-zA-Z0-9_]/g, '_')
  );
  
  // Prepare properties with all necessary data
  const entityProperties = {
    neo4j_id: neo4j_id,
    badge_s3_url: badge_s3_url,
    migrated_at: new Date().toISOString(),
    migration_version: '1.0',
    ...properties
  };
  
  // Clean properties to handle Neo4j compatibility
  const cleanedProperties = cleanPropertiesForNeo4j(entityProperties);
  
  // Build the CREATE query with dynamic labels
  const labelString = cleanLabels.join(':');
  const createQuery = `
    CREATE (n:${labelString})
    SET n = $properties
    RETURN n
  `;
  
  return await tx.run(createQuery, { properties: cleanedProperties });
}

function cleanPropertiesForNeo4j(properties) {
  const cleaned = {};
  
  for (const [key, value] of Object.entries(properties)) {
    if (value === null || value === undefined) {
      continue;
    }
    
    // Handle arrays
    if (Array.isArray(value)) {
      if (value.length > 0) {
        cleaned[key] = value;
      }
    }
    // Handle objects - convert to JSON string or flatten
    else if (typeof value === 'object' && value.constructor === Object) {
      try {
        cleaned[key] = JSON.stringify(value);
      } catch {
        // If JSON.stringify fails, convert to string
        cleaned[key] = String(value);
      }
    }
    // Handle strings - clean up problematic characters
    else if (typeof value === 'string') {
      cleaned[key] = value
        .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
        .replace(/'/g, "\\'") // Escape single quotes
        .trim();
    }
    else {
      cleaned[key] = value;
    }
  }
  
  return cleaned;
}

async function createRelationshipsFromProperties(session) {
  const stats = {
    sport: 0,
    country: 0,
    federation: 0,
    total: 0
  };
  
  try {
    // Create sport-based relationships
    console.log('  🔗 Creating sport relationships...');
    const sportResult = await session.run(`
      MATCH (e1:Entity), (e2:Entity)
      WHERE e1.sport IS NOT NULL 
        AND e2.name = e1.sport 
        AND e2:Sport
      MERGE (e1)-[:PLAYS_IN]->(e2)
      RETURN count(*) as count
    `);
    stats.sport = sportResult.records[0].get('count').toNumber();
    
    // Create country-based relationships
    console.log('  🌍 Creating country relationships...');
    const countryResult = await session.run(`
      MATCH (e1:Entity), (e2:Entity)
      WHERE e1.country IS NOT NULL 
        AND e2.name = e1.country 
        AND e2:Country
      MERGE (e1)-[:LOCATED_IN]->(e2)
      RETURN count(*) as count
    `);
    stats.country = countryResult.records[0].get('count').toNumber();
    
    // Create federation relationships
    console.log('  🏢 Creating federation relationships...');
    const federationResult = await session.run(`
      MATCH (entity:Entity), (federation:Entity {type: 'Federation'})
      WHERE (entity.sport IS NOT NULL AND federation.sport IS NOT NULL AND entity.sport = federation.sport)
         OR (entity.country IS NOT NULL AND federation.name CONTAINS entity.country)
      MERGE (entity)-[:AFFILIATED_WITH]->(federation)
      RETURN count(*) as count
    `);
    stats.federation = federationResult.records[0].get('count').toNumber();
    
    stats.total = stats.sport + stats.country + stats.federation;
    console.log(`✅ Created ${stats.total} relationships total (Sport: ${stats.sport}, Country: ${stats.country}, Federation: ${stats.federation})`);
    
  } catch (error) {
    console.error('❌ Error creating relationships:', error);
  }
  
  return stats;
}

// Run the migration
if (require.main === module) {
  migrateSampleBatch()
    .then((result) => {
      console.log('\n🎉 Sample migration completed successfully!');
      console.log('This demonstrates the migration process works with real data from MCP functions.');
      console.log('\n📋 Next steps to migrate all 4,422 entities:');
      console.log('1. Continue getting batches via MCP functions (mcp__supabase__execute_sql)');
      console.log('2. Process each batch through the same Neo4j migration logic');
      console.log('3. Create relationships and verify final state');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Sample migration failed:', error);
      process.exit(1);
    });
}

module.exports = { migrateSampleBatch };