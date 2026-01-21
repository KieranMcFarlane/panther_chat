require('dotenv').config();
const neo4j = require('neo4j-driver');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const fetch = require('node-fetch');
const fs = require('fs');

// Premier League teams to process
const premierLeagueTeams = [
  { name: 'Liverpool', theSportsDbId: '133615' },
  { name: 'Manchester City', theSportsDbId: '133616' },
  { name: 'Chelsea', theSportsDbId: '133617' },
  { name: 'Tottenham', theSportsDbId: '133618' },
  { name: 'Everton', theSportsDbId: '133619' },
  { name: 'Leicester City', theSportsDbId: '133620' },
  { name: 'Crystal Palace', theSportsDbId: '133621' },
  { name: 'West Ham United', theSportsDbId: '133622' },
  { name: 'Aston Villa', theSportsDbId: '133623' },
  { name: 'Wolverhampton Wanderers', theSportsDbId: '133624' },
  { name: 'Nottingham Forest', theSportsDbId: '133625' },
  { name: 'Southampton FC', theSportsDbId: '133626' },
  { name: 'Brighton & Hove Albion', theSportsDbId: '133627' },
  { name: 'Burnley FC', theSportsDbId: '133628' },
  { name: 'Fulham FC', theSportsDbId: '133629' },
  { name: 'Newcastle United', theSportsDbId: '133630' },
  { name: 'Bournemouth', theSportsDbId: '133631' },
  { name: 'Brentford FC', theSportsDbId: '133632' }
];

async function processPremierLeagueTeam(teamName, teamId) {
  console.log(`\n🏆 PROCESSING ${teamName.toUpperCase()} [ID: ${teamId}]`);
  
  const driver = neo4j.driver(
    process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD)
  );
  
  const session = driver.session();
  
  try {
    // Step 1: Find entity in Neo4j
    console.log(`   🔍 Finding ${teamName} in Neo4j...`);
    const findResult = await session.run(
      "MATCH (e:Entity) WHERE e.name = $name RETURN e.name as name, elementId(e) as elementId, e.badge_url as currentBadge",
      { name: teamName }
    );
    
    if (findResult.records.length === 0) {
      console.log(`   ❌ No ${teamName} entity found`);
      return { success: false, reason: 'Entity not found' };
    }
    
    const entity = findResult.records[0];
    const currentBadge = entity.get('currentBadge');
    
    if (currentBadge) {
      console.log(`   ✅ ${teamName} already has badge: ${currentBadge}`);
      return { success: true, reason: 'Already has badge' };
    }
    
    console.log(`   ✅ Found: ${entity.get('name')} [ID: ${entity.get('elementId').split(':')[2]}]`);
    
    // Step 2: Search TheSportsDB
    console.log(`   🌐 Searching TheSportsDB for ${teamName}...`);
    const searchUrl = `https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=${encodeURIComponent(teamName)}`;
    
    const response = await fetch(searchUrl);
    if (!response.ok) {
      console.log(`   ❌ TheSportsDB API error: ${response.status}`);
      return { success: false, reason: 'API error' };
    }
    
    const data = await response.json();
    if (!data.teams || data.teams.length === 0) {
      console.log(`   ❌ No ${teamName} found in TheSportsDB`);
      return { success: false, reason: 'Not found in TheSportsDB' };
    }
    
    const team = data.teams[0];
    const badgeUrl = team.strBadge;
    
    if (!badgeUrl) {
      console.log(`   ❌ ${teamName} has no badge in TheSportsDB`);
      return { success: false, reason: 'No badge in TheSportsDB' };
    }
    
    console.log(`   ✅ Found badge: ${badgeUrl}`);
    
    // Step 3: Download badge
    console.log(`   ⬇️ Downloading badge...`);
    const badgeResponse = await fetch(badgeUrl);
    
    if (!badgeResponse.ok) {
      console.log(`   ❌ Failed to download badge: ${badgeResponse.status}`);
      return { success: false, reason: 'Download failed' };
    }
    
    const buffer = await badgeResponse.arrayBuffer();
    const fileName = `${teamName.toLowerCase().replace(/\s+/g, '-')}-badge.png`;
    fs.writeFileSync(fileName, Buffer.from(buffer));
    console.log(`   ✅ Downloaded: ${fileName}`);
    
    // Step 4: Upload to S3
    console.log(`   ☁️ Uploading to S3...`);
    
    const s3Client = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      }
    });
    
    const fileContent = fs.readFileSync(fileName);
    const s3Key = `badges/${fileName}`;
    
    await s3Client.send(new PutObjectCommand({
      Bucket: 'sportsintelligence',
      Key: s3Key,
      Body: fileContent,
      ContentType: 'image/png'
    }));
    
    const s3Url = `https://sportsintelligence.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;
    console.log(`   ✅ Uploaded to S3: ${s3Url}`);
    
    // Step 5: Update Neo4j
    console.log(`   💾 Updating Neo4j...`);
    const elementId = entity.get('elementId');
    
    const updateResult = await session.run(
      `MATCH (e:Entity) WHERE elementId(e) = $eid 
       SET e.badge_url = $badgeUrl, 
           e.badge_source = 'TheSportsDB',
           e.badge_updated = datetime(),
           e.badge_api_id = $apiId,
           e.badge_team = $teamName
       RETURN e.name as name, e.badge_url as badgeUrl`,
      { 
        eid: elementId, 
        badgeUrl: s3Url, 
        apiId: teamId,
        teamName: teamName 
      }
    );
    
    if (updateResult.records.length > 0) {
      // Clean up local file
      fs.unlinkSync(fileName);
      
      console.log(`   🎉 SUCCESS! ${teamName} badge added successfully!`);
      console.log(`   🏷️  Badge: ${s3Url}`);
      
      return { 
        success: true, 
        reason: 'Badge added',
        badgeUrl: s3Url,
        teamName: teamName 
      };
    } else {
      console.log(`   ❌ Failed to update Neo4j`);
      return { success: false, reason: 'Neo4j update failed' };
    }
    
  } catch (error) {
    console.error(`   ❌ Error processing ${teamName}:`, error.message);
    return { success: false, reason: error.message };
  } finally {
    await session.close();
    await driver.close();
  }
}

async function batchProcessPremierLeague() {
  console.log('🚀 BATCH PROCESSING PREMIER LEAGUE TEAMS');
  console.log(`\n📊 Teams to process: ${premierLeagueTeams.length}`);
  
  let successCount = 0;
  let skipCount = 0;
  let failureCount = 0;
  const results = [];
  
  for (let i = 0; i < premierLeagueTeams.length; i++) {
    const team = premierLeagueTeams[i];
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Processing ${i + 1}/${premierLeagueTeams.length}: ${team.name}`);
    
    const result = await processPremierLeagueTeam(team.name, team.theSportsDbId);
    
    if (result.success) {
      if (result.reason === 'Already has badge') {
        skipCount++;
      } else {
        successCount++;
      }
      results.push({ team: team.name, status: result.reason, badgeUrl: result.badgeUrl });
    } else {
      failureCount++;
      results.push({ team: team.name, status: result.reason, badgeUrl: null });
    }
    
    // Small delay between requests to be respectful to the API
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log(`\n🎉 PREMIER LEAGUE BATCH PROCESSING COMPLETE!`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  
  console.log(`\n📊 FINAL RESULTS:`);
  console.log(`   ✅ Successful badges: ${successCount}`);
  console.log(`   ⏭️  Already had badges: ${skipCount}`);
  console.log(`   ❌ Failed: ${failureCount}`);
  console.log(`   📈 Total processed: ${premierLeagueTeams.length}`);
  
  console.log(`\n🏆 BADGE DETAILS:`);
  results.forEach(result => {
    const icon = result.status.includes('SUCCESS') ? '✅' : 
                 result.status.includes('Already') ? '⏭️' : '❌';
    console.log(`   ${icon} ${result.team}: ${result.status}`);
    if (result.badgeUrl) {
      console.log(`      🏷️  ${result.badgeUrl}`);
    }
  });
  
  // Summary
  console.log(`\n🎯 SUMMARY:`);
  console.log(`   🏆 Total Premier League teams with badges: ${successCount + skipCount}`);
  console.log(`   🚀 Ready for application: ${successCount} new badges added`);
  
  return { successCount, skipCount, failureCount, results };
}

// Run the batch processing
batchProcessPremierLeague().catch(console.error);