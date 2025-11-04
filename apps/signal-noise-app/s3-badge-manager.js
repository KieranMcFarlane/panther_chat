#!/usr/bin/env node

/**
 * S3 Badge Management Script
 * This script demonstrates how to add S3 badge mappings to entities
 * and store the S3 URLs in Supabase.
 */

const { createClient } = require('@supabase/supabase-js');

// Configuration - replace with your actual values
const SUPABASE_URL = 'https://itlcuazbybqlkicsaola.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0bGN1YXpieWJxbGtpY3Nhb2xhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MjA3NDY3MzQxNH0.UXXSbe1Kk0CH7NkIGnwo3_qmJVV3VUbJz4Dw8lBGcKU';

const S3_BUCKET_URL = 'https://sportsintelligence.s3.eu-north-1.amazonaws.com/badges';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * Generate S3 badge URL based on entity name
 */
function generateS3BadgeUrl(entityName) {
  const normalizedName = entityName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
  
  return `${S3_BUCKET_URL}/${normalizedName}-badge.png`;
}

/**
 * Add S3 badge URL to an entity in Supabase
 */
async function addS3BadgeToEntity(entityId, entityName) {
  try {
    const s3Url = generateS3BadgeUrl(entityName);
    
    const { data, error } = await supabase
      .from('cached_entities')
      .update({ 
        badge_s3_url: s3Url,
        updated_at: new Date().toISOString()
      })
      .eq('neo4j_id', entityId)
      .select();
    
    if (error) {
      console.error(`❌ Failed to add S3 badge to ${entityName}:`, error.message);
      return false;
    }
    
    console.log(`✅ Added S3 badge to ${entityName}: ${s3Url}`);
    return true;
  } catch (error) {
    console.error(`❌ Error adding S3 badge to ${entityName}:`, error.message);
    return false;
  }
}

/**
 * Add S3 badges to multiple entities
 */
async function addS3BadgesToEntities(entities) {
  console.log('🚀 Starting S3 badge assignment...');
  
  let successCount = 0;
  let failureCount = 0;
  
  for (const entity of entities) {
    const success = await addS3BadgeToEntity(entity.id, entity.name);
    if (success) {
      successCount++;
    } else {
      failureCount++;
    }
  }
  
  console.log(`\n📊 Results:`);
  console.log(`✅ Success: ${successCount} entities`);
  console.log(`❌ Failed: ${failureCount} entities`);
  console.log(`📈 Total: ${entities.length} entities`);
}

/**
 * Get all entities without S3 badges
 */
async function getEntitiesWithoutS3Badges() {
  try {
    const { data, error } = await supabase
      .from('cached_entities')
      .select('neo4j_id, properties->>name as name')
      .is('badge_s3_url', null)
      .order('name');
    
    if (error) {
      console.error('❌ Failed to fetch entities:', error.message);
      return [];
    }
    
    return data.map(entity => ({
      id: entity.neo4j_id,
      name: entity.name
    }));
  } catch (error) {
    console.error('❌ Error fetching entities:', error.message);
    return [];
  }
}

/**
 * List all entities with their S3 badge status
 */
async function listS3BadgeStatus() {
  try {
    const { data, error } = await supabase
      .from('cached_entities')
      .select('neo4j_id, properties->>name as name, badge_s3_url')
      .order('name');
    
    if (error) {
      console.error('❌ Failed to fetch badge status:', error.message);
      return;
    }
    
    console.log('📋 S3 Badge Status Report:');
    console.log('='.repeat(80));
    
    data.forEach(entity => {
      const hasS3Badge = entity.badge_s3_url ? '✅' : '❌';
      console.log(`${hasS3Badge} ${entity.name} (${entity.neo4j_id})`);
      if (entity.badge_s3_url) {
        console.log(`   URL: ${entity.badge_s3_url}`);
      }
    });
    
    const withS3 = data.filter(e => e.badge_s3_url).length;
    const withoutS3 = data.filter(e => !e.badge_s3_url).length;
    
    console.log('\n📊 Summary:');
    console.log(`✅ With S3 badges: ${withS3}`);
    console.log(`❌ Without S3 badges: ${withoutS3}`);
    console.log(`📈 Total entities: ${data.length}`);
  } catch (error) {
    console.error('❌ Error listing badge status:', error.message);
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  switch (command) {
    case 'status':
      await listS3BadgeStatus();
      break;
      
    case 'add-missing':
      const entitiesWithout = await getEntitiesWithoutS3Badges();
      if (entitiesWithout.length > 0) {
        await addS3BadgesToEntities(entitiesWithout);
      } else {
        console.log('✅ All entities already have S3 badges!');
      }
      break;
      
    case 'add':
      const entityId = args[1];
      const entityName = args[2];
      if (entityId && entityName) {
        await addS3BadgeToEntity(entityId, entityName);
      } else {
        console.log('Usage: node s3-badge-manager.js add <entityId> <entityName>');
      }
      break;
      
    default:
      console.log('S3 Badge Management Script');
      console.log('Usage:');
      console.log('  node s3-badge-manager.js status          - List all entities and their S3 badge status');
      console.log('  node s3-badge-manager.js add-missing      - Add S3 badges to entities without them');
      console.log('  node s3-badge-manager.js add <id> <name>  - Add S3 badge to specific entity');
      break;
  }
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  generateS3BadgeUrl,
  addS3BadgeToEntity,
  addS3BadgesToEntities,
  getEntitiesWithoutS3Badges,
  listS3BadgeStatus
};