#!/usr/bin/env node

// Test script to download badges for specific clubs that we know exist in TheSportsDB
import fetch from 'node-fetch';
import neo4j from 'neo4j-driver';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const SPORTSDB_API_BASE = "https://www.thesportsdb.com/api/v1/json/3";
const NEO4J_URI = process.env.NEO4J_URI || "neo4j+s://cce1f84b.databases.neo4j.io";
const NEO4J_USER = process.env.NEO4J_USER || "neo4j";
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || "llNASCzMWGT-nTt-JkD9Qk_4W6PpJrv39X0PuYAIKV0";
const BADGES_DIR = path.join(__dirname, '..', 'public', 'badges');

// Initialize Neo4j driver
const driver = neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD));

// List of clubs we know should work
const TEST_CLUBS = [
  'Chelsea',
  'Arsenal',
  'Liverpool',
  'Barcelona',
  'Real Madrid',
  'Bayern Munich',
  'Juventus',
  'AC Milan',
  'Paris Saint Germain',
  'Manchester City'
];

async function downloadAndMapBadge(clubName) {
  const session = driver.session();
  
  try {
    console.log(`\n🔄 Processing club: ${clubName}`);
    
    // First, find the entity in Neo4j
    const entityResult = await session.run(
      'MATCH (e:Entity {name: $name}) RETURN elementId(e) as id, e.name as name, e.badgePath as badgePath',
      { name: clubName }
    );
    
    if (entityResult.records.length === 0) {
      console.log(`❌ Entity not found in Neo4j: ${clubName}`);
      return { success: false, message: `Entity not found in Neo4j: ${clubName}` };
    }
    
    const entityId = entityResult.records[0].get('id');
    console.log(`✅ Found entity: ${clubName} (ID: ${entityId})`);
    
    // Check if entity already has a badge
    const record = entityResult.records[0];
    const existingBadge = record.get('badgePath');
    if (existingBadge) {
      console.log(`ℹ️  Entity already has badge: ${existingBadge}`);
      return { success: true, message: `Already has badge: ${existingBadge}`, clubName };
    }
    
    // Search for the club in TheSportsDB
    console.log(`🔍 Searching for club in TheSportsDB: ${clubName}`);
    const url = `${SPORTSDB_API_BASE}/searchteams.php?t=${encodeURIComponent(clubName)}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      console.log(`❌ API error for ${clubName}: ${response.status} ${response.statusText}`);
      return { success: false, message: `API error: ${response.status} ${response.statusText}`, clubName };
    }
    
    const data = await response.json();
    
    // Check for API errors
    if (data.error) {
      console.log(`❌ API error for ${clubName}: ${data.message || data.error}`);
      return { success: false, message: `API error: ${data.message || data.error}`, clubName };
    }
    
    if (!data?.teams || data.teams.length === 0) {
      console.log(`❌ No club found in TheSportsDB: ${clubName}`);
      return { success: false, message: `No club found in TheSportsDB: ${clubName}` };
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
    
    // Update the entity with badge path
    console.log(`🔗 Mapping entity ${entityId} to badge...`);
    const updateResult = await session.run(
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
        filename: badgeFilename 
      }
    );
    
    if (updateResult.records.length === 0) {
      console.log(`❌ Failed to update entity: ${entityId}`);
      return { success: false, message: `Failed to update entity: ${entityId}`, clubName };
    }
    
    console.log(`✅ Successfully processed ${clubName}`);
    return {
      success: true,
      clubName,
      entityId,
      badgeUrl,
      localPath: badgePath,
      filename: badgeFilename
    };
    
  } catch (error) {
    console.error(`❌ Error processing ${clubName}:`, error.message);
    return { success: false, message: error.message, clubName };
  } finally {
    await session.close();
  }
}

async function processTestClubs() {
  console.log('🎯 Testing badge download for specific clubs');
  console.log('=========================================');
  
  const results = [];
  
  for (const clubName of TEST_CLUBS) {
    try {
      const result = await downloadAndMapBadge(clubName);
      results.push(result);
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      results.push({
        success: false,
        message: error.message,
        clubName
      });
    }
  }
  
  return results;
}

async function main() {
  try {
    const results = await processTestClubs();
    
    console.log('\n📊 TEST RESULTS:');
    console.log('================');
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    console.log(`✅ Successful: ${successful.length}`);
    console.log(`❌ Failed: ${failed.length}`);
    
    if (successful.length > 0) {
      console.log('\n✅ Successfully processed clubs:');
      successful.forEach(r => {
        console.log(`   - ${r.clubName}: ${r.localPath}`);
      });
    }
    
    if (failed.length > 0) {
      console.log('\n❌ Failed clubs:');
      failed.forEach(r => {
        console.log(`   - ${r.clubName}: ${r.message}`);
      });
    }
    
    console.log('\n🔍 Current badges directory contents:');
    const badgeFiles = await fs.readdir(BADGES_DIR);
    badgeFiles.forEach(file => {
      console.log(`   - ${file}`);
    });
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
  } finally {
    await driver.close();
  }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}