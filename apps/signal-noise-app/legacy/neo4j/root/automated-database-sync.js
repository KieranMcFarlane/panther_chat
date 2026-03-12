// AUTOMATED DATABASE SYNC SYSTEM
// Prevents future data inconsistencies between Neo4j and Supabase

require('dotenv').config({ path: '.env.local' });

console.log('🔄 AUTOMATED DATABASE SYNC SYSTEM');
console.log('=' .repeat(80));

const neo4j = require('neo4j-driver');
const { createClient } = require('@supabase/supabase-js');

// Configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const neo4jUri = process.env.NEO4J_URI;
const neo4jUser = process.env.NEO4J_USERNAME;
const neo4jPassword = process.env.NEO4J_PASSWORD;

if (!supabaseUrl || !supabaseKey || !neo4jUri || !neo4jUser || !neo4jPassword) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

// Initialize clients
const supabase = createClient(supabaseUrl, supabaseKey);
const driver = neo4j.driver(neo4jUri, neo4j.auth.basic(neo4jUser, neo4jPassword));

class DatabaseSyncSystem {
  constructor() {
    this.lastSync = null;
    this.syncInterval = 5 * 60 * 1000; // 5 minutes
    this.isRunning = false;
  }

  async checkConsistency() {
    const session = driver.session();
    
    try {
      console.log('\n🔍 CHECKING DATABASE CONSISTENCY...');
      
      // Get cached_entities count
      const { data: cachedCount, error: cachedError } = await supabase
        .from('cached_entities')
        .select('id', { count: 'exact' })
        .eq('properties->>sport', 'Football')
        .eq('properties->>league', 'League One');
      
      if (cachedError) throw cachedError;
      
      // Get Neo4j count
      const neo4jResult = await session.run(`
        MATCH (e:Entity {sport: "Football"})
        WHERE e.league = "League One" OR e.level = "Tier 3"
        RETURN count(e) as count
      `);
      
      const neo4jCount = neo4jResult.records[0].get('count');
      
      console.log(`📊 Consistency Check:`);
      console.log(`   • cached_entities: ${cachedCount.length} teams`);
      console.log(`   • Neo4j: ${neo4jCount} teams`);
      console.log(`   • Difference: ${Math.abs(cachedCount.length - neo4jCount)} teams`);
      
      if (cachedCount.length !== neo4jCount) {
        console.log('⚠️  INCONSISTENCY DETECTED - Sync needed');
        return { consistent: false, cached: cachedCount.length, neo4j: neo4jCount };
      } else {
        console.log('✅ Databases are consistent');
        return { consistent: true, cached: cachedCount.length, neo4j: neo4jCount };
      }
      
    } catch (error) {
      console.error('❌ Consistency check failed:', error);
      return { consistent: false, error: error.message };
    } finally {
      await session.close();
    }
  }

  async syncMissingTeams() {
    const session = driver.session();
    
    try {
      console.log('\n🔄 STARTING TEAM SYNC...');
      
      // Get teams in cached_entities but not in Neo4j
      const { data: missingTeams, error: fetchError } = await supabase
        .from('cached_entities')
        .select('neo4j_id, properties')
        .eq('properties->>sport', 'Football')
        .eq('properties->>league', 'League One')
        .is('neo4j_id', 'not.null');
      
      if (fetchError) throw fetchError;
      
      let syncedCount = 0;
      
      for (const team of missingTeams) {
        const props = team.properties;
        const teamName = props.name;
        
        try {
          const result = await session.run(`
            MERGE (e:Entity {name: $teamName, sport: "Football"})
            ON CREATE SET 
              e.neo4j_id = $neo4jId,
              e.league = $league,
              e.level = $level,
              e.country = $country,
              e.entity_type = "Club",
              e.created_at = datetime(),
              e.updated_at = datetime(),
              e.properties = $properties,
              e.sync_source = "automated_sync"
            ON MATCH SET
              e.league = $league,
              e.level = $level,
              e.country = $country,
              e.updated_at = datetime(),
              e.properties = $properties,
              e.sync_source = "automated_sync"
            RETURN e.name as team_name, e.neo4j_id
          `, {
            teamName,
            neo4jId: team.neo4j_id,
            league: props.league || 'League One',
            level: props.level || 'Tier 3',
            country: props.country || 'England',
            properties: props
          });
          
          syncedCount++;
          console.log(`   ✅ Synced: ${teamName}`);
          
        } catch (syncError) {
          console.error(`   ❌ Failed to sync ${teamName}:`, syncError.message);
        }
      }
      
      console.log(`\n📈 SYNC SUMMARY: ${syncedCount} teams synced`);
      
      // Update structured teams table
      await this.updateStructuredTables();
      
      return { synced: syncedCount, total: missingTeams.length };
      
    } catch (error) {
      console.error('❌ Sync failed:', error);
      throw error;
    } finally {
      await session.close();
    }
  }

  async updateStructuredTables() {
    try {
      console.log('\n📋 Updating structured tables...');
      
      // Update team count in leagues table
      const { error: updateError } = await supabase
        .from('leagues')
        .update({ 
          team_count: `(SELECT COUNT(*) FROM teams WHERE league_id = leagues.id)`,
          updated_at: new Date().toISOString()
        })
        .eq('name', 'League One');
      
      if (updateError) throw updateError;
      
      console.log('   ✅ Structured tables updated');
      
    } catch (error) {
      console.error('❌ Structured tables update failed:', error);
    }
  }

  async runHealthCheck() {
    const session = driver.session();
    
    try {
      console.log('\n🏥 DATABASE HEALTH CHECK...');
      
      // Check Neo4j connectivity
      const healthResult = await session.run('RETURN 1 as health');
      const neo4jHealthy = healthResult.records.length > 0;
      
      // Check Supabase connectivity
      const { data: healthData, error: healthError } = await supabase
        .from('sync_log')
        .select('id')
        .limit(1);
      
      const supabaseHealthy = !healthError;
      
      console.log(`   • Neo4j: ${neo4jHealthy ? '✅ Healthy' : '❌ Unhealthy'}`);
      console.log(`   • Supabase: ${supabaseHealthy ? '✅ Healthy' : '❌ Unhealthy'}`);
      
      return { neo4j: neo4jHealthy, supabase: supabaseHealthy };
      
    } catch (error) {
      console.error('❌ Health check failed:', error);
      return { neo4j: false, supabase: false, error: error.message };
    } finally {
      await session.close();
    }
  }

  async startMonitoring() {
    if (this.isRunning) {
      console.log('⚠️  Sync monitoring is already running');
      return;
    }
    
    this.isRunning = true;
    console.log('🚀 STARTING AUTOMATED SYNC MONITORING...');
    console.log(`📅 Sync interval: ${this.syncInterval / 1000} seconds`);
    
    const monitor = async () => {
      if (!this.isRunning) return;
      
      try {
        console.log(`\n${new Date().toISOString()} - Running automated sync check`);
        
        // Run health check
        const health = await this.runHealthCheck();
        if (!health.neo4j || !health.supabase) {
          console.log('❌ Health check failed - skipping sync');
          return;
        }
        
        // Check consistency
        const consistency = await this.checkConsistency();
        
        // Sync if needed
        if (!consistency.consistent) {
          await this.syncMissingTeams();
        }
        
        this.lastSync = new Date();
        
      } catch (error) {
        console.error('❌ Monitoring cycle failed:', error);
      }
      
      // Schedule next run
      setTimeout(monitor, this.syncInterval);
    };
    
    // Start monitoring
    await monitor();
  }

  stopMonitoring() {
    this.isRunning = false;
    console.log('🛑 Stopped automated sync monitoring');
  }

  async runOnce() {
    console.log('🔄 Running one-time sync...');
    
    const health = await this.runHealthCheck();
    if (!health.neo4j || !health.supabase) {
      throw new Error('Database health check failed');
    }
    
    const consistency = await this.checkConsistency();
    
    if (!consistency.consistent) {
      const result = await this.syncMissingTeams();
      return { success: true, result };
    } else {
      return { success: true, message: 'Databases already consistent' };
    }
  }
}

// CLI interface
async function main() {
  const syncSystem = new DatabaseSyncSystem();
  
  const command = process.argv[2];
  
  try {
    switch (command) {
      case 'check':
        await syncSystem.checkConsistency();
        break;
        
      case 'sync':
        await syncSystem.runOnce();
        break;
        
      case 'monitor':
        await syncSystem.startMonitoring();
        
        // Handle graceful shutdown
        process.on('SIGINT', () => {
          console.log('\n📡 Received SIGINT - Shutting down gracefully...');
          syncSystem.stopMonitoring();
          process.exit(0);
        });
        
        process.on('SIGTERM', () => {
          console.log('\n📡 Received SIGTERM - Shutting down gracefully...');
          syncSystem.stopMonitoring();
          process.exit(0);
        });
        
        break;
        
      case 'health':
        await syncSystem.runHealthCheck();
        break;
        
      default:
        console.log('\n📋 USAGE:');
        console.log('   node automated-database-sync.js check    - Check database consistency');
        console.log('   node automated-database-sync.js sync     - Run one-time sync');
        console.log('   node automated-database-sync.js monitor  - Start continuous monitoring');
        console.log('   node automated-database-sync.js health   - Run health check');
        break;
    }
    
  } catch (error) {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  } finally {
    await driver.close();
  }
}

// Export for use in other modules
module.exports = DatabaseSyncSystem;

// Run if called directly
if (require.main === module) {
  main();
}