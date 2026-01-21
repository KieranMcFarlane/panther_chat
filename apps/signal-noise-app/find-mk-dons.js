require('dotenv').config();
const fetch = require('node-fetch');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const THESPORTSDB_API_URL = 'https://www.thesportsdb.com/api/v1/json/3/searchteams.php';

// S3 Configuration - working configuration
const s3Client = new S3Client({
  region: 'eu-north-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

async function searchTheSportsDBVariations(teamName) {
  const searchVariations = [
    teamName,
    'Milton Keynes Dons',
    'MK Dons FC',
    'Wimbledon FC', // Try the old name
    'Milton Keynes'
  ];
  
  for (const searchTerm of searchVariations) {
    try {
      console.log(`   🔍 Searching: "${searchTerm}"`);
      const response = await fetch(`${THESPORTSDB_API_URL}?t=${encodeURIComponent(searchTerm)}`);
      const data = await response.json();
      
      if (data.teams && data.teams.length > 0) {
        console.log(`   ✅ Found ${data.teams.length} results for "${searchTerm}"`);
        
        // Find the most relevant match
        let bestMatch = null;
        for (const team of data.teams) {
          // Check for exact name match or close variation
          if (team.strTeam.toLowerCase().includes('milton') || 
              team.strTeam.toLowerCase().includes('mk') ||
              team.strTeam.toLowerCase().includes('wimbledon') ||
              team.strTeam.toLowerCase().includes('dons')) {
            bestMatch = team;
            console.log(`   🎯 Best match: ${team.strTeam}`);
            break;
          }
        }
        
        if (!bestMatch && data.teams.length > 0) {
          bestMatch = data.teams[0];
          console.log(`   🎯 First result: ${bestMatch.strTeam}`);
        }
        
        return bestMatch;
      }
    } catch (error) {
      console.log(`   ⚠️ Error searching for "${searchTerm}": ${error.message}`);
    }
  }
  
  return null;
}

async function tryLeagueLookup() {
  console.log(`\n🔍 Trying league lookup for League Two...`);
  try {
    const response = await fetch('https://www.thesportsdb.com/api/v1/json/3/search_all_teams.php?l=English%20League%202');
    const data = await response.json();
    
    if (data.teams) {
      console.log(`   📊 Found ${data.teams.length} teams in League Two`);
      
      // Look for MK Dons or variations
      for (const team of data.teams) {
        if (team.strTeam.toLowerCase().includes('milton') || 
            team.strTeam.toLowerCase().includes('mk') ||
            team.strTeam.toLowerCase().includes('dons')) {
          console.log(`   🎯 Found in League Two: ${team.strTeam}`);
          if (team.strBadge) {
            console.log(`   🏷️ Badge available: ${team.strBadge}`);
          } else {
            console.log(`   ❌ No badge available`);
          }
          return team;
        }
      }
      
      // List all teams for reference
      console.log(`\n📋 All League Two teams in TheSportsDB:`);
      data.teams.forEach(team => {
        const hasBadge = team.strBadge ? '✅' : '❌';
        console.log(`   ${hasBadge} ${team.strTeam}`);
      });
    }
  } catch (error) {
    console.log(`   ⚠️ Error looking up League Two: ${error.message}`);
  }
  
  return null;
}

async function tryAlternativeAPIs() {
  console.log(`\n🔍 Trying alternative API sources...`);
  
  // Try search by different API endpoints
  const alternativeSearches = [
    'https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=Milton%20Keynes',
    'https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=Wimbledon',
    'https://www.thesportsdb.com/api/v1/json/3/lookupteam.php?id=133745' // Common ID for MK Dons
  ];
  
  for (const url of alternativeSearches) {
    try {
      console.log(`   🔍 Trying: ${url}`);
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.teams) {
        if (Array.isArray(data.teams) && data.teams.length > 0) {
          console.log(`   ✅ Found: ${data.teams[0].strTeam}`);
          if (data.teams[0].strBadge) {
            console.log(`   🏷️ Badge: ${data.teams[0].strBadge}`);
          }
          return data.teams[0];
        }
      } else if (data.teams && typeof data.teams === 'object') {
        console.log(`   ✅ Found single team: ${data.teams.strTeam}`);
        if (data.teams.strBadge) {
          console.log(`   🏷️ Badge: ${data.teams.strBadge}`);
        }
        return data.teams;
      }
    } catch (error) {
      console.log(`   ⚠️ Error: ${error.message}`);
    }
  }
  
  return null;
}

async function downloadAndUploadBadge(team, teamData) {
  try {
    if (!teamData.strBadge) {
      throw new Error('No badge URL found in TheSportsDB data');
    }

    const badgeUrl = teamData.strBadge;
    const fileName = `${team.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '')}-badge.png`;
    
    // Download badge
    console.log(`   📥 Downloading badge from: ${badgeUrl}`);
    const response = await fetch(badgeUrl);
    if (!response.ok) {
      throw new Error(`Failed to download badge: ${response.statusText}`);
    }
    
    const buffer = await response.buffer();
    console.log(`   ✅ Badge downloaded successfully (${buffer.length} bytes)`);
    
    // Upload to S3
    const s3Key = `badges/${fileName}`;
    const uploadParams = {
      Bucket: 'sportsintelligence',
      Key: s3Key,
      Body: buffer,
      ContentType: 'image/png',
      CacheControl: 'public, max-age=31536000'
    };
    
    console.log(`   ☁️ Uploading to S3: s3://sportsintelligence/${s3Key}`);
    const uploadResult = await s3Client.send(new PutObjectCommand(uploadParams));
    console.log(`   ✅ S3 upload success: ETag=${uploadResult.ETag}`);
    
    return `https://sportsintelligence.s3.eu-north-1.amazonaws.com/${s3Key}`;
    
  } catch (error) {
    console.log(`   ❌ Error processing badge: ${error.message}`);
    return null;
  }
}

async function main() {
  console.log('🔍 MK DONS - COMPREHENSIVE SEARCH');
  console.log('='.repeat(50));
  console.log('Goal: Find MK Dons badge in TheSportsDB using multiple search strategies');
  
  let teamData = null;
  let searchMethod = '';
  
  // Method 1: Try various name combinations
  console.log(`\n🎯 METHOD 1: Name Variation Search`);
  teamData = await searchTheSportsDBVariations('MK Dons');
  if (teamData) {
    searchMethod = 'Name variation search';
  }
  
  // Method 2: Try league lookup
  if (!teamData) {
    console.log(`\n🎯 METHOD 2: League Lookup`);
    teamData = await tryLeagueLookup();
    if (teamData) {
      searchMethod = 'League lookup';
    }
  }
  
  // Method 3: Try alternative API endpoints
  if (!teamData) {
    console.log(`\n🎯 METHOD 3: Alternative API Endpoints`);
    teamData = await tryAlternativeAPIs();
    if (teamData) {
      searchMethod = 'Alternative API endpoint';
    }
  }
  
  if (teamData) {
    console.log(`\n🎉 SUCCESS! Found MK Dons using: ${searchMethod}`);
    console.log(`Team: ${teamData.strTeam}`);
    console.log(`League: ${teamData.strLeague}`);
    console.log(`Country: ${teamData.strCountry}`);
    console.log(`Badge URL: ${teamData.strBadge}`);
    
    if (teamData.strBadge) {
      console.log(`\n🚀 Processing badge upload...`);
      const badgeUrl = await downloadAndUploadBadge('MK Dons', teamData);
      if (badgeUrl) {
        console.log(`\n🎉 MK Dons badge successfully uploaded!`);
        console.log(`🔗 Badge URL: ${badgeUrl}`);
      } else {
        console.log(`\n❌ Failed to upload badge`);
      }
    }
  } else {
    console.log(`\n❌ COMPLETE FAILURE - No MK Dons data found in TheSportsDB`);
    console.log(`\n💡 Recommendations:`);
    console.log(`   1. Try manually creating a badge using team colors`);
    console.log(`   2. Search for official badge from club website`);
    console.log(`   3. Use a placeholder badge`);
    console.log(`   4. Check if team has been recently promoted/relegated`);
  }
}

main().catch(console.error);