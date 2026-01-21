require('dotenv').config();
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const fetch = require('node-fetch');
const fs = require('fs');

// S3 Configuration - working configuration
const s3Client = new S3Client({
  region: 'eu-north-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

// TheSportsDB API configuration
const THESPORTSDB_API_URL = 'https://www.thesportsdb.com/api/v1/json/3/searchteams.php';

// League Two teams from Supabase that need badges
const leagueTwoTeams = [
  'Accrington Stanley', 'AFC Wimbledon', 'Barrow', 'Bradford City',
  'Bromley', 'Carlisle United', 'Cheltenham Town', 'Chesterfield',
  'Colchester United', 'Crewe Alexandra', 'Doncaster Rovers', 'Fleetwood Town',
  'Gillingham', 'Grimsby Town', 'Harrogate Town', 'MK Dons',
  'Morecambe', 'Newport County', 'Notts County', 'Port Vale',
  'Salford City', 'Sutton United', 'Swindon Town', 'Tranmere Rovers'
];

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

async function processLeagueTwoTeam(teamName, index, total) {
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
    thesportsdbId: teamData.idTeam,
    league: teamData.strLeague,
    country: teamData.strCountry,
    originalBadgeUrl: teamData.strBadge
  };
}

function generateFinalReport(results, teams) {
  console.log('\n' + '='.repeat(80));
  console.log('🏆 LEAGUE TWO BADGE PROCESSING FINAL REPORT');
  console.log('='.repeat(80));
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`\n📊 SUMMARY:`);
  console.log(`   Total teams processed: ${teams.length}`);
  console.log(`   ✅ Successful: ${successful.length}`);
  console.log(`   ❌ Failed: ${failed.length}`);
  console.log(`   📈 Success rate: ${((successful.length / teams.length) * 100).toFixed(1)}%`);
  
  if (successful.length > 0) {
    console.log(`\n✅ SUCCESSFUL TEAMS (${successful.length}):`);
    successful.forEach(result => {
      console.log(`   ${result.team} → ${result.badgeUrl}`);
    });
  }
  
  if (failed.length > 0) {
    console.log(`\n❌ FAILED TEAMS (${failed.length}):`);
    failed.forEach(result => {
      console.log(`   ${result.team} → ${result.error}`);
    });
  }
  
  console.log(`\n🎯 League Two badge coverage: ${successful.length}/${teams.length} teams (${((successful.length / teams.length) * 100).toFixed(1)}%)`);
  console.log('🚀 All badges are stored on S3!');
  
  return {
    total: teams.length,
    successful: successful.length,
    failed: failed.length,
    successRate: ((successful.length / teams.length) * 100).toFixed(1),
    results: results
  };
}

async function main() {
  console.log('🏆 LEAGUE TWO BADGE PROCESSOR STARTING');
  console.log('🎯 Processing 24 League Two teams for badge integration');
  console.log('⚽ Goal: Complete League Two badge coverage');
  console.log('🔧 Using working S3 configuration and TheSportsDB strBadge field');
  
  console.log(`\n📋 Teams to process: ${leagueTwoTeams.join(', ')}`);
  
  const results = [];
  
  for (let i = 0; i < leagueTwoTeams.length; i++) {
    const result = await processLeagueTwoTeam(leagueTwoTeams[i], i + 1, leagueTwoTeams.length);
    results.push(result);
    
    // Small delay between teams to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  const report = generateFinalReport(results, leagueTwoTeams);
  
  console.log('\n🎉 League Two badge processing completed!');
  
  // Save results to file
  const reportData = {
    timestamp: new Date().toISOString(),
    league: 'League Two',
    ...report
  };
  
  fs.writeFileSync('league-two-badges-final-report.json', JSON.stringify(reportData, null, 2));
  console.log('\n📄 Detailed report saved to: league-two-badges-final-report.json');
}

main().catch(console.error);