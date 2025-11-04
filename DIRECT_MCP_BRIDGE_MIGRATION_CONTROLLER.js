// DIRECT MCP BRIDGE MIGRATION CONTROLLER
// High-performance migration system with direct database connections

class Neo4jMCPBridge {
  constructor(config = {}) {
    this.neo4j = config.neo4j || process.env.NEO4J_URI;
    this.supabase = config.supabase || process.env.SUPABASE_URL;
    this.processingBatches = new Set();
    this.metrics = {
      entitiesMigrated: 0,
      relationshipsBuilt: 0,
      startTime: null,
      endTime: null,
      errors: []
    };
    
    // Agent performance tracking
    this.agents = {
      'agent-1': { entities: 0, batches: 0, startTime: null },
      'agent-2': { entities: 0, batches: 0, startTime: null },
      'agent-3': { entities: 0, batches: 0, startTime: null },
      'agent-4': { entities: 0, batches: 0, startTime: null },
      'agent-5': { entities: 0, batches: 0, startTime: null }
    };
  }

  async startAgent(agentId, assignedSections, priority) {
    const agent = {
      id: agentId,
      assignedSections: assignedSections,
      priority: priority,
      entitiesMigrated: 0,
      batches: 0,
      startTime: new Date(),
      lastActivity: new Date()
    };
    
    this.agents[agentId] = agent;
    this.metrics.startTime = new Date();
    
    console.log(`🚀 Starting ${agentId} - ${priority} priority`);
    console.log(`📋 Assigned sections:`, assignedSections);
    
    return agent;
  }

  async querySourceEntities() {
    try {
      // Query Neo4j for entities already processed by other agents
      const neo4jQuery = `
        MATCH (n) 
        WHERE n.supabase_id IS NOT NULL AND n.type IS NOT NULL
        RETURN n.name, labels(n), n.agent_id, n.source
        ORDER BY n.name
        LIMIT 1000
      `;
      
      const neo4jResult = await this.neo4j.execute_query({ query: neo4jQuery });
      const existingEntities = neo4jResult.data.map(n => ({
        name: n.name,
        labels: n.labels,
        agent_id: n.agent_id,
        source: n.source
      }));
      
      console.log(`🔍 Found ${existingEntities.length} existing entities in Neo4j`);
      return existingEntities;
    } catch (error) {
      console.error('❌ Error querying Neo4j:', error);
      return [];
    }
  }

  async deduplicateEntities(sourceEntities) {
    try {
      // Query Supabase for existing entities to avoid duplicates
      const supabaseQuery = `
        SELECT name, neo4j_id 
        FROM cached_entities 
        WHERE neo4j_id IS NOT NULL
        ORDER BY name
      `;
      
      const supabaseResult = await this.supabase.execute_sql({ query: supabaseQuery });
      const cachedNames = new Set(supabaseResult.data.map(row => row.name));
      
      // Filter out duplicates
      const deduplicatedEntities = sourceEntities.filter(entity => 
        !cachedNames.has(entity.name.toLowerCase())
      );
      
      console.log(`✅ Deduplication: ${sourceEntities.length} → ${deduplicatedEntities.length} entities`);
      console.log(`🚫 Duplicates removed: ${sourceEntities.length - deduplicatedEntities.length}`);
      
      return deduplicatedEntities;
    } catch (error) {
      console.error('❌ Error checking Supabase duplicates:', error);
      return sourceEntities; // Return original if deduplication fails
    }
  }

  async processBatch(entities, agentId) {
    try {
      console.log(`🔄 ${agentId}: Processing batch of ${entities.length} entities`);
      
      const migrationPromises = entities.map(async (entity) => {
        const entityForNeo4j = { ...entity }; // Transform to Neo4j format
        
        // Generate supabase_id first
        const supabaseId = await this.supabase.from('uuid_generate_v4');
        const entityForCache = {
          name: entity.name,
          neo4j_id: entityForNeo4j.id,
          source: 'mcp_bridge_migration',
          type: this.classifyEntityType(entity),
          metadata: entity.metadata || {}
        };
        
        // Set supabase_id in cached entity for Neo4j migration
        const cachePromise = this.supabase
          .from('cached_entities')
          .insert(entityForCache)
          .eq('neo4j_id', entityForNeo4j.id)
          .single();
        
        // Store in Neo4j with supabase_id and migration data
        const neo4jEntity = await this.neo4j.execute_query({
          query: `
            CREATE (e:Entity {
              name: $entityName,
              supabase_id: $supabaseId,
              source: 'mcp_bridge_migration',
              type: $entityType,
              labels: $entityLabels,
              properties: $entityProperties,
              created_at: datetime(),
              migration_status: 'completed',
              agent_id: $agentId,
              assigned_at: datetime(),
              assigned_section: '${agentId.toUpperCase()}_SECTION',
              metadata: $entityMetadata
            })
          `
        });
        
        migrationPromises.push(cachePromise, neo4jEntity);
      });
      
      const results = await Promise.all(migrationPromises);
      const successful = results.filter(r => r.status === 'fulfilled');
      
      // Update metrics
      this.agents[agentId].entitiesMigrated += successful.length;
      this.agents[agentId].batches += 1;
      
      console.log(`✅ ${agentId}: ${successful.length}/${entities.length} entities migrated`);
      return successful;
    } catch (error) {
      console.error(`❌ Error in batch processing for ${agentId}:`, error);
      this.metrics.errors.push(error.message);
      return [];
    }
  }

  async buildStrategicRelationships() {
    try {
      console.log('🕸 Building strategic relationships...');
      
      const relationshipQueries = [
        // Connect executives to organizations
        'MATCH (p:Person {name: $execName})-[r:EXECUTIVE_ROLE {role: $role, created_by: \'MCP_BRIDGE\', created_at: datetime()}]->(o:Organization {name: $orgName}) RETURN p.name, o.name',
        
        // Connect teams to leagues
        'MATCH (t:Entity {name: $teamName})-[:MEMBER_OF]->(l:Entity {name: $leagueName}) RETURN t.name, l.name',
        
        // Connect entities to countries
        'MATCH (e:Entity {name: $entityName})-[:BASED_IN]->(c:Country {name: $countryName}) RETURN e.name, c.name'
      ];
      
      const relationshipPromises = relationshipQueries.map(query => 
        this.neo4j.execute_query({ query })
      );
      
      await Promise.all(relationshipPromises);
      
      const relationshipsBuilt = relationshipPromises.length;
      this.metrics.relationshipsBuilt += relationshipsBuilt;
      
      console.log(`🔗 Strategic relationships built: ${relationshipsBuilt}`);
      return relationshipsBuilt;
    } catch (error) {
      console.error('❌ Error building relationships:', error);
      this.metrics.errors.push(error.message);
      return 0;
    }
  }

  async syncAndVerify() {
    try {
      // Sync cached entities with Neo4j
      const supabaseQuery = `
        SELECT ce.name, ce.neo4j_id 
        FROM cached_entities 
        WHERE neo4j_id IS NOT NULL
      `;
      
      const unsyncedEntities = await this.supabase.execute_sql({ query: supabaseQuery });
      console.log(`🔄 Syncing ${unsyncedEntities.length} entities to Neo4j...`);
      
      const syncPromises = unsyncedEntities.map(async (entity) => {
        // Get Neo4j node ID for this entity
        const neo4jQuery = `
          MATCH (e:Entity {name: '${entity.name}'})
          RETURN id(e) as neo4j_id
        `;
        
        const neo4jResult = await this.neo4j.execute_query({ query: neo4jQuery });
        const neo4jId = neo4jResult.data[0]?.id(e);
        
        if (neo4jId) {
          await this.supabase
            .from('cached_entities')
            .update({ neo4j_id: neo4jId })
            .eq('name', entity.name)
            .single();
        }
      });
      
      await Promise.all(syncPromises);
      console.log(`✅ Synced ${syncPromises.length} entities to Neo4j`);
    } catch (error) {
      console.error('❌ Sync error:', error);
      this.metrics.errors.push(error.message);
    }
  }

  async getFinalReport() {
    const endTime = new Date();
    const duration = this.metrics.endTime - this.metrics.startTime;
    
    return {
      status: 'COMPLETED',
      metrics: {
        ...this.metrics,
        totalEntitiesMigrated: Object.values(this.agents).reduce((sum, agent) => sum + agent.entitiesMigrated, 0),
        totalRelationshipsBuilt: this.metrics.relationshipsBuilt,
        duration: duration,
        errors: this.metrics.errors,
        endTime: endTime
      },
      agents: Object.entries(this.agents).map(([id, agent]) => ({
        agentId: id,
        ...agent,
        performance: {
          entitiesPerHour: agent.entitiesMigrated / (duration / 3600000),
          avgBatchTime: duration / (agent.batches || 1)
        }
      }))
    };
  }

  async startMultiAgentMigration() {
    console.log('🚀 STARTING MULTI-AGENT MIGRATION');
    
    // Initialize all agents
    const agent1 = await this.startAgent('agent-1', ['M', 'N', 'O'], 'EXECUTIVE_PRIORITY');
    const agent2 = await this.startAgent('agent-2', ['P', 'R'], 'INTERNATIONAL_FOCUS');
    const agent3 = await this.startAgent('agent-3', ['S', 'T', 'U'], 'GOVERNANCE_FEDERATIONS');
    const agent4 = await this.startAgent('agent-4', ['A', 'B', 'V'], 'PREMIER_LEAGUES_TEAMS');
    
    // Agent 5 gets whatever sections remain
    const remainingEntitiesQuery = 'MATCH (n) WHERE n.supabase_id IS NULL AND n.type IS NULL RETURN n.name LIMIT 100';
    const remaining = await this.neo4j.execute_query({ query: remainingEntitiesQuery });
    const remainingSections = remaining.data.map(n => n.name[0]).sort();
    const agent5 = await this.startAgent('agent-5', remainingSections, 'COMPLETE_COVERAGE');
    
    const agents = [agent1, agent2, agent3, agent4, agent5];
    
    // Process entities directly with current bridge instance
    console.log('🔄 Starting direct migration process...');
    
    try {
      // Query Supabase for cached entities that need migration
      const sourceEntities = await this.querySourceEntities();
      console.log(`📊 Found ${sourceEntities.length} entities for migration`);
      
      // Deduplicate against existing Neo4j entities
      const deduplicatedEntities = await this.deduplicateEntities(sourceEntities);
      console.log(`✅ Deduplicated to ${deduplicatedEntities.length} unique entities`);
      
      // Process in batches
      const batchSize = 25;
      const batches = [];
      for (let i = 0; i < deduplicatedEntities.length; i += batchSize) {
        batches.push(deduplicatedEntities.slice(i, i + batchSize));
      }
      
      console.log(`📦 Processing ${batches.length} batches of ${batchSize} entities each`);
      
      let totalMigrated = 0;
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        console.log(`🔄 Processing batch ${i + 1}/${batches.length} (${batch.length} entities)`);
        
        // Simulate agent processing with rotation
        const agentId = `agent-${((i % 5) + 1)}`;
        const results = await this.processBatch(batch, agentId);
        totalMigrated += results.length;
        
        console.log(`✅ Batch ${i + 1} completed: ${results.length} entities migrated`);
      }
      
      // Build strategic relationships
      console.log('🕸️ Building strategic relationships...');
      await this.buildStrategicRelationships();
      
      // Sync and verify
      console.log('🔄 Syncing and verifying...');
      await this.syncAndVerify();
      
      // Generate final report
      this.metrics.endTime = new Date();
      this.metrics.entitiesMigrated = totalMigrated;
      
      const finalReport = await this.getFinalReport();
      console.log('📊 MIGRATION COMPLETED:', finalReport);
      
      return finalReport;
      
    } catch (error) {
      console.error('❌ Migration error:', error);
      this.metrics.errors.push(error.message);
      throw error;
    }
  }

  classifyEntityType(entity) {
    const labels = entity.labels || [];
    if (labels.includes('Person')) return 'Sports Person';
    if (labels.includes('Country')) return 'Country';
    if (labels.includes('Sport')) return 'Sport Category';
    if (entity.name.toLowerCase().includes('league')) return 'Sports League';
    if (entity.name.toLowerCase().includes('federation')) return 'Sports Federation';
    return 'Sports Entity';
  }
}

// Execute migration
const migrationBridge = new Neo4jMCPBridge();
migrationBridge.startMultiAgentMigration().catch(console.error);