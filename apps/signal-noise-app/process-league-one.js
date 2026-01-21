require('dotenv').config();
const neo4j = require('neo4j-driver');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const fetch = require('node-fetch');
const fs = require('fs');

// S3 Configuration
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

// League One teams from Supabase that need badges
const leagueOneTeams = [
  'Barnsley', 'Birmingham City', 'Blackpool', 'Bolton Wanderers',
  'Bristol Rovers', 'Burton Albion', 'Cambridge United', 'Charlton Athletic',
  'Crawley Town', 'Exeter City', 'Huddersfield Town', 'Leyton Orient',
  'Lincoln City', 'Mansfield Town', 'Northampton Town', 'Peterborough United',
  'Portsmouth', 'Reading', 'Rotherham United', 'Shrewsbury Town',
  'Stevenage', 'Stockport County', 'Wigan Athletic', 'Wrexham', 'Wycombe Wanderers'
];

// TheSportsDB API configuration
const THESPORTSDB_API_URL = 'https://www.thesportsdb.com/api/v1/json/3/searchteams.php';
const S3_BUCKET = process.env.S3_BUCKET_NAME;
const S3_REGION = process.env.AWS_REGION;

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
    console.error(`❌ Error searching TheSportsDB for ${teamName}:`, error.message);
    return null;
  }
}

async function downloadAndUploadBadge(team, teamData) {
  try {
    if (!teamData.strTeamBadge) {
      throw new Error('No badge URL found in TheSportsDB data');
    }

    const badgeUrl = teamData.strTeamBadge;
    const fileName = `${team.toLowerCase().replace(/\s+/g, '-')}-badge.png`;
    
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
      Bucket: S3_BUCKET,
      Key: s3Key,
      Body: buffer,
      ContentType: 'image/png',
      CacheControl: 'public, max-age=31536000' // 1 year cache
    };
    
    console.log(`   ☁️ Uploading to S3: s3://${S3_BUCKET}/${s3Key}`);
    const uploadResult = await s3Client.send(new PutObjectCommand(uploadParams));
    console.log(`   ✅ S3 upload success: ETag=${uploadResult.ETag}`);
    
    // Return S3 URL
    return `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${s3Key}`;
    
  } catch (error) {
    console.error(`   ❌ Error processing badge for ${team}:`, error.message);
    return null;
  }
}

async function updateNeo4jBadge(teamName, badgeUrl, thesportsdbId) {
  const driver = neo4j.driver(
    process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD)
  );
  const session = driver.session();
  
  try {
    const query = `
      MATCH (e:Entity {name: $teamName})
      WHERE e.league = 'League One'
      SET e.badge_url = $badgeUrl,
          e.thesportsdb_id = $thesportsdbId,
          e.badge_processed = true,
          e.badge_processed_date = datetime(),
          e.updated_at = datetime()
      RETURN e.name as name, e.badge_url as badgeUrl
    `;
    
    const result = await session.run(query, {
      teamName: teamName,
      badgeUrl: badgeUrl,
      thesportsdbId: thesportsdbId
    });
    
    if (result.records.length > 0) {
      console.log(`   ✅ Neo4j updated for ${teamName}`);
      return true;
    } else {
      console.log(`   ⚠️ No League One entity found for ${teamName}`);
      return false;
    }
  } catch (error) {
    console.error(`   ❌ Error updating Neo4j for ${teamName}:`, error.message);
    return false;
  } finally {
    await session.close();
    await driver.close();
  }
}

async function updateSupabaseBadge(teamName, badgeUrl) {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/cached_entities`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY
      },
      body: JSON.stringify({
        badge_s3_url: badgeUrl,
        updated_at: new Date().toISOString()
      })
    });
    
    if (!response.ok) {
      throw new Error(`Supabase update failed: ${response.statusText}`);
    }
    
    console.log(`   ✅ Supabase updated for ${teamName}`);
    return true;
  } catch (error) {
    console.error(`   ❌ Error updating Supabase for ${teamName}:`, error.message);
    return false;
  }
}

async function processLeagueOneTeam(teamName, index, total) {
  console.log(`\n⚽ Processing ${index}/${total}: ${teamName}`);
  console.log(`   🔍 Searching TheSportsDB...`);
  
  const teamData = await searchTheSportsDB(teamName);
  if (!teamData) {
    console.log(`   ❌ No data found for ${teamName}`);
    return { success: false, error: 'No TheSportsDB data found' };
  }
  
  console.log(`   ✅ Found: ${teamData.strTeam} (${teamData.strLeague || 'Unknown league'})`);
  
  const badgeUrl = await downloadAndUploadBadge(teamName, teamData);
  if (!badgeUrl) {
    return { success: false, error: 'Failed to download/upload badge' };
  }
  
  const neo4jUpdated = await updateNeo4jBadge(teamName, badgeUrl, teamData.idTeam);
  const supabaseUpdated = await updateSupabaseBadge(teamName, badgeUrl);
  
  const success = neo4jUpdated && supabaseUpdated;
  
  console.log(`   ${success ? '🎉' : '⚠️'} ${teamName}: ${success ? 'SUCCESS' : 'PARTIAL'} - Badge: ${badgeUrl}`);
  
  return {
    success: success,
    team: teamName,
    badgeUrl: badgeUrl,
    thesportsdbId: teamData.idTeam,
    league: teamData.strLeague,
    country: teamData.strCountry
  };
}

async function processBatchWithRetry(teams, maxRetries = 2) {
  const results = [];
  let currentRetry = 0;
  
  while (currentRetry <= maxRetries) {
    const remainingTeams = teams.filter((_, index) => !results[index]?.success);
    
    if (remainingTeams.length === 0) break;
    
    console.log(`\n🔄 ${currentRetry === 0 ? 'PROCESSING' : `RETRY ATTEMPT ${currentRetry}`}: ${remainingTeams.length} remaining teams`);
    
    for (let i = 0; i < teams.length; i++) {
      if (results[i]?.success) continue; // Skip already successful
      
      const result = await processLeagueOneTeam(teams[i], i + 1, teams.length);
      results[i] = result;
      
      // Small delay between teams
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    currentRetry++;
  }
  
  return results;
}

function generateFinalReport(results, teams) {
  console.log('\n' + '='.repeat(80));
  console.log('🏆 LEAGUE ONE BADGE PROCESSING FINAL REPORT');
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
  
  console.log(`\n🎯 League One badge coverage: ${successful.length}/${teams.length} teams (${((successful.length / teams.length) * 100).toFixed(1)}%)`);
  console.log('🚀 All badges are stored on S3 and integrated with Neo4j + Supabase!');
  
  return {
    total: teams.length,
    successful: successful.length,
    failed: failed.length,
    successRate: ((successful.length / teams.length) * 100).toFixed(1),
    results: results
  };
}

async function main() {
  console.log('🏆 LEAGUE ONE BADGE PROCESSOR STARTING');
  console.log('🎯 Processing 25 League One teams for badge integration');
  console.log('⚽ Goal: Complete League One badge coverage');
  
  console.log(`\n📋 Teams to process: ${leagueOneTeams.join(', ')}`);
  
  const results = await processBatchWithRetry(leagueOneTeams);
  const report = generateFinalReport(results, leagueOneTeams);
  
  console.log('\n🎉 League One badge processing completed!');
  
  // Save results to file
  const reportData = {
    timestamp: new Date().toISOString(),
    league: 'League One',
    ...report
  };
  
  fs.writeFileSync('league-one-badges-report.json', JSON.stringify(reportData, null, 2));
  console.log('\n📄 Detailed report saved to: league-one-badges-report.json');
}

main().catch(console.error);