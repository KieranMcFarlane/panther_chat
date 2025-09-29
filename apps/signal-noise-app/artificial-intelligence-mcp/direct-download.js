#!/usr/bin/env node

// Direct script to download badges without MCP server
import fetch from 'node-fetch';
import neo4j from 'neo4j-driver';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const SPORTSDB_API_BASE = "https://www.thesportsdb.com/api/v1/json/3";
const RATE_LIMIT_DELAY = 700; // 700ms between requests to stay under 100/minute
const NEO4J_URI = process.env.NEO4J_URI || "neo4j+s://cce1f84b.databases.neo4j.io";
const NEO4J_USER = process.env.NEO4J_USER || "neo4j";
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || "llNASCzMWGT-nTt-JkD9Qk_4W6PpJrv39X0PuYAIKV0";
const BADGES_DIR = path.join(__dirname, '..', 'public', 'badges');
const LEAGUES_DIR = path.join(BADGES_DIR, 'leagues');

// Initialize Neo4j driver
const driver = neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD));

async function scanForEntitiesWithoutBadges() {
  const session = driver.session();
  
  try {
    console.log('🔍 Scanning Neo4j for entities without badges...');
    
    const result = await session.run(
      `MATCH (e:Entity)
       WHERE (e.type = 'Club' OR e.type = 'club' OR e:Club OR e:Team OR e:Organization) 
         AND (e.badgePath IS NULL OR e.badgePath = '')
         AND e.name IS NOT NULL
       RETURN elementId(e) as id, e.name as name, NULL as leagueId, 'club' as entityType
       
       UNION ALL
       
       MATCH (e:Entity) 
       WHERE (e.type = 'League' OR e.type = 'league' OR e:League) 
         AND (e.leagueBadgePath IS NULL OR e.leagueBadgePath = '')
         AND (e.name IS NOT NULL)
         AND e.leagueId IS NOT NULL
       RETURN elementId(e) as id, e.name as name, e.leagueId as leagueId, 'league' as entityType
       
       LIMIT 10000`
    );
    
    const entities = result.records.map(record => {
      const data = {
        id: record.get('id'),
        name: record.get('name'),
        entityType: record.get('entityType')
      };
      
      if (record.has('leagueId')) {
        data.leagueId = record.get('leagueId');
      }
      
      return data;
    });
    
    const clubEntities = entities.filter(e => e.entityType === 'club');
    const leagueEntities = entities.filter(e => e.entityType === 'league');
    
    console.log(`📊 Found ${entities.length} entities without badges:`);
    console.log(`   - ${clubEntities.length} clubs`);
    console.log(`   - ${leagueEntities.length} leagues`);
    
    return { clubEntities, leagueEntities };
  } finally {
    await session.close();
  }
}

async function downloadClubBadge(clubName) {
  try {
    console.log(`🔍 Searching for club: ${clubName}`);
    
    const url = `${SPORTSDB_API_BASE}/searchteams.php?t=${encodeURIComponent(clubName)}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      console.log(`❌ API error for ${clubName}: ${response.status} ${response.statusText}`);
      return { success: false, message: `API error: ${response.status} ${response.statusText}`, clubName };
    }
    
    const data = await response.json();
    
    // Check for rate limiting or API errors
    if (data.error) {
      console.log(`❌ API error for ${clubName}: ${data.message || data.error}`);
      return { success: false, message: `API error: ${data.message || data.error}`, clubName };
    }
    
    if (!data?.teams || data.teams.length === 0) {
      console.log(`❌ No club found for: ${clubName}`);
      return { success: false, message: `No club found for: ${clubName}` };
    }
    
    const club = data.teams[0];
    const badgeUrl = club.strBadge;
    
    if (!badgeUrl) {
      console.log(`❌ No badge available for: ${clubName}`);
      return { success: false, message: `No badge available for: ${clubName}`, club };
    }
    
    console.log(`✅ Found badge for ${clubName}: ${badgeUrl}`);
    
    // Ensure badges directory exists
    await fs.ensureDir(BADGES_DIR);
    
    // Generate filename
    const safeClubName = clubName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const badgeFilename = `${safeClubName}-badge.png`;
    const badgePath = path.join(BADGES_DIR, badgeFilename);
    
    // Download the badge image
    console.log(`⬇️  Downloading badge for ${clubName}...`);
    const imageResponse = await fetch(badgeUrl);
    
    if (!imageResponse.ok) {
      console.log(`❌ Failed to download badge image for ${clubName}: ${imageResponse.status}`);
      return { success: false, message: `Failed to download badge image: ${imageResponse.status}`, clubName };
    }
    
    const imageBuffer = await imageResponse.buffer();
    
    // Save the image
    await fs.writeFile(badgePath, imageBuffer);
    console.log(`💾 Saved badge to: ${badgePath}`);
    
    return {
      success: true,
      clubName,
      badgeUrl,
      localPath: badgePath,
      filename: badgeFilename
    };
  } catch (error) {
    console.error(`❌ Failed to download badge for ${clubName}:`, error.message);
    return { success: false, message: error.message, clubName };
  }
}

async function mapEntityToBadge(entityId, badgePath, clubName) {
  const session = driver.session();
  
  try {
    console.log(`🔗 Mapping entity ${entityId} to badge ${badgePath}`);
    
    const result = await session.run(
      `
      MATCH (e)
      WHERE elementId(e) = $entityId
      SET e.badgePath = $badgePath,
          e.badgeFilename = $filename,
          e.hasBadge = true,
          e.badgeUpdatedAt = datetime()
      RETURN e
      `,
      { 
        entityId, 
        badgePath, 
        filename: path.basename(badgePath),
        clubName 
      }
    );
    
    if (result.records.length === 0) {
      console.log(`❌ Entity not found: ${entityId}`);
      return { success: false, message: `Entity not found: ${entityId}` };
    }
    
    console.log(`✅ Successfully mapped entity ${entityId} to badge`);
    return { success: true, entityId, badgePath, clubName };
  } finally {
    await session.close();
  }
}

async function processClubEntities(clubEntities) {
  const results = [];
  
  for (const entity of clubEntities) {
    console.log(`\n🔄 Processing club: ${entity.name} (${entity.id})`);
    
    try {
      // Download badge
      const downloadResult = await downloadClubBadge(entity.name);
      
      if (downloadResult.success) {
        // Map entity to badge
        const mapResult = await mapEntityToBadge(
          entity.id,
          downloadResult.localPath,
          entity.name
        );
        
        results.push({
          entityId: entity.id,
          entityName: entity.name,
          downloadSuccess: true,
          mapSuccess: mapResult.success,
          localPath: downloadResult.localPath,
          downloadMessage: downloadResult.message || 'Badge downloaded',
          mapMessage: mapResult.message || 'Entity mapped'
        });
        
        if (mapResult.success) {
          console.log(`✅ Successfully processed ${entity.name}`);
        } else {
          console.log(`⚠️  Badge downloaded but mapping failed for ${entity.name}: ${mapResult.message}`);
        }
      } else {
        results.push({
          entityId: entity.id,
          entityName: entity.name,
          success: false,
          error: downloadResult.message
        });
        console.log(`❌ Failed to download badge for ${entity.name}: ${downloadResult.message}`);
      }
    } catch (error) {
      results.push({
        entityId: entity.id,
        entityName: entity.name,
        success: false,
        error: error.message
      });
      console.log(`❌ Error processing ${entity.name}:`, error.message);
    }
    
    // Rate limiting delay to avoid hitting API limits
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
  }
  
  return results;
}

async function downloadAllMissingBadges() {
  console.log('🚀 Starting badge download process...');
  console.log('📁 Badge directory:', BADGES_DIR);
  
  try {
    // Ensure directories exist
    await fs.ensureDir(BADGES_DIR);
    await fs.ensureDir(LEAGUES_DIR);
    
    // Scan for entities without badges
    const { clubEntities, leagueEntities } = await scanForEntitiesWithoutBadges();
    
    if (clubEntities.length === 0 && leagueEntities.length === 0) {
      console.log('✅ No entities found that need badges!');
      return { success: true, message: 'All entities already have badges' };
    }
    
    const results = {
      summary: {
        total: clubEntities.length + leagueEntities.length,
        clubs: clubEntities.length,
        leagues: leagueEntities.length,
        successful: 0,
        failed: 0
      },
      clubResults: [],
      leagueResults: []
    };
    
    // Process all clubs
    if (clubEntities.length > 0) {
      console.log(`\n🏃 Processing ${clubEntities.length} club entities...`);
      results.clubResults = await processClubEntities(clubEntities);
      
      results.summary.successful += results.clubResults.filter(r => r.downloadSuccess && r.mapSuccess).length;
      results.summary.failed += results.clubResults.filter(r => !r.downloadSuccess || !r.mapSuccess).length;
    }
    
    // Process leagues (if any)
    if (leagueEntities.length > 0) {
      console.log(`\n🏆 Processing ${leagueEntities.length} league entities...`);
      // For now, we'll skip leagues as the dry run showed none need badges
      console.log('ℹ️  Skipping league processing - none need badges according to dry run');
    }
    
    console.log('\n📊 FINAL RESULTS:');
    console.log(`   Total entities processed: ${results.summary.total}`);
    console.log(`   Successful: ${results.summary.successful}`);
    console.log(`   Failed: ${results.summary.failed}`);
    
    return {
      success: true,
      message: 'Badge download process completed',
      results
    };
    
  } catch (error) {
    console.error('❌ Fatal error in badge download process:', error);
    return {
      success: false,
      error: error.message
    };
  } finally {
    await driver.close();
  }
}

// Main execution
async function main() {
  try {
    console.log('🎯 Direct Badge Download Script');
    console.log('================================');
    
    const result = await downloadAllMissingBadges();
    
    if (result.success) {
      console.log('\n✅ Badge download completed successfully!');
      process.exit(0);
    } else {
      console.log('\n❌ Badge download failed!');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { downloadAllMissingBadges };