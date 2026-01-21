require('dotenv').config();
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const fetch = require('node-fetch');
const fs = require('fs');

// S3 Configuration - remove custom endpoint to use AWS default
const s3Client = new S3Client({
  region: 'eu-north-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

// TheSportsDB API configuration
const THESPORTSDB_API_URL = 'https://www.thesportsdb.com/api/v1/json/3/searchteams.php';

// Test with just a few teams first
const testTeams = ['Accrington Stanley', 'AFC Wimbledon', 'Barrow'];

async function searchTheSportsDB(teamName) {
  try {
    const response = await fetch(`${THESPORTSDB_API_URL}?t=${encodeURIComponent(teamName)}`);
    const data = await response.json();
    
    if (data.teams && data.teams.length > 0) {
      // Find the most relevant match (prefer English teams)
      let bestMatch = data.teams[0];
      for (const team of data.teams) {
        if (team.strCountry && (team.strCountry.includes('England') || team.strCountry.includes('UK'))) {
          bestMatch = team;
          break;
        }
      }
      return bestMatch;
    }
    return null;
  } catch (error) {
    console.log(`   ⚠️ Error searching TheSportsDB for ${teamName}: ${error.message}`);
    return null;
  }
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
      CacheControl: 'public, max-age=31536000' // 1 year cache
    };
    
    console.log(`   ☁️ Uploading to S3: s3://sportsintelligence/${s3Key}`);
    const uploadResult = await s3Client.send(new PutObjectCommand(uploadParams));
    console.log(`   ✅ S3 upload success: ETag=${uploadResult.ETag}`);
    
    // Return S3 URL
    return `https://sportsintelligence.s3.eu-north-1.amazonaws.com/${s3Key}`;
    
  } catch (error) {
    console.log(`   ❌ Error processing badge for ${team}: ${error.message}`);
    return null;
  }
}

async function processTeam(teamName, index, total) {
  console.log(`\n⚽ Processing ${index}/${total}: ${teamName}`);
  console.log(`   🔍 Searching TheSportsDB...`);
  
  const teamData = await searchTheSportsDB(teamName);
  if (!teamData) {
    console.log(`   ❌ No data found for ${teamName}`);
    return { success: false, error: 'No TheSportsDB data found' };
  }
  
  console.log(`   ✅ Found: ${teamData.strTeam} (${teamData.strLeague || 'Unknown league'})`);
  console.log(`   🏷️  Badge available: ${teamData.strBadge ? 'YES' : 'NO'}`);
  
  const badgeUrl = await downloadAndUploadBadge(teamName, teamData);
  if (!badgeUrl) {
    return { success: false, error: 'Failed to download/upload badge' };
  }
  
  console.log(`   🎉 ${teamName}: SUCCESS - Badge: ${badgeUrl}`);
  
  return {
    success: true,
    team: teamName,
    badgeUrl: badgeUrl,
    originalBadgeUrl: teamData.strBadge
  };
}

async function main() {
  console.log('🏆 S3 CONFIGURATION TEST');
  console.log('🎯 Testing S3 upload with 3 League Two teams');
  console.log('🔧 Using default AWS S3 endpoint');
  
  console.log(`\n📋 Test teams: ${testTeams.join(', ')}`);
  
  const results = [];
  
  for (let i = 0; i < testTeams.length; i++) {
    const result = await processTeam(testTeams[i], i + 1, testTeams.length);
    results.push(result);
    
    // Small delay between teams
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  const successful = results.filter(r => r.success);
  console.log(`\n📊 TEST RESULTS:`);
  console.log(`   Total: ${testTeams.length}`);
  console.log(`   ✅ Successful: ${successful.length}`);
  console.log(`   ❌ Failed: ${testTeams.length - successful.length}`);
  
  if (successful.length > 0) {
    console.log(`\n✅ SUCCESSFUL:`);
    successful.forEach(result => {
      console.log(`   ${result.team} → ${result.badgeUrl}`);
    });
    
    console.log(`\n🎉 S3 configuration is working! Ready to process all League Two teams.`);
  } else {
    console.log(`\n❌ S3 configuration needs fixing.`);
  }
}

main().catch(console.error);