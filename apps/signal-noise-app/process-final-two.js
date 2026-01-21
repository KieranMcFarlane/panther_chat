require('dotenv').config();
const neo4j = require('neo4j-driver');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const fetch = require('node-fetch');
const fs = require('fs');

// The two teams we need to process
const finalTeams = [
  { 
    name: 'Sheffield United', 
    searchVariations: ['Sheffield United', 'Sheffield United FC', 'Sheffield United Football Club'],
    theSportsDbId: '134622' // Actual Sheffield United FC ID
  },
  { 
    name: 'Luton Town', 
    searchVariations: ['Luton Town', 'Luton Town FC', 'Luton Town Football Club'],
    theSportsDbId: '134630' // Actual Luton Town FC ID
  }
];

async function checkExistingBadges() {
  const driver = neo4j.driver(
    process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD)
  );
  
  const session = driver.session();
  
  try {
    console.log('🔍 Checking existing badge status...\n');
    
    // Check if we already have Burnley and Southampton under different names
    const checkResult = await session.run(
      `MATCH (e:Entity) 
       WHERE e.name CONTAINS 'Burnley' OR e.name CONTAINS 'Southampton' 
       RETURN e.name as name, e.badge_url as badgeUrl, elementId(e) as id
       ORDER BY e.name`
    );
    
    console.log('Burnley/Southampton entities found:');
    checkResult.records.forEach((record, index) => {
      const name = record.get('name');
      const badge = record.get('badgeUrl') ? '✅' : '❌';
      const id = record.get('id').split(':')[2];
      console.log(`   ${index + 1}. ${badge} ${name} [ID: ${id}]`);
    });
    
    return checkResult.records.length > 0;
    
  } catch (error) {
    console.error('Error checking existing badges:', error);
    return false;
  } finally {
    await session.close();
    await driver.close();
  }
}

async function findTeamInTheSportsDB(team) {
  console.log(`   🔍 Searching for ${team.name} in TheSportsDB...`);
  
  for (const searchTerm of team.searchVariations) {
    try {
      console.log(`      Trying: "${searchTerm}"`);
      
      const searchUrl = `https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=${encodeURIComponent(searchTerm)}`;
      const response = await fetch(searchUrl);
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.teams && data.teams.length > 0) {
          // Find the best match (prefer Premier League Championship teams)
          const bestMatch = data.teams.find(team => 
            team.strLeague && (team.strLeague.includes('Premier League') || 
                              team.strLeague.includes('Championship') ||
                              team.strLeague.includes('League One'))
          ) || data.teams[0];
          
          if (bestMatch.strBadge) {
            console.log(`      ✅ Found: ${bestMatch.strTeam} (${bestMatch.strLeague})`);
            return {
              name: bestMatch.strTeam,
              badgeUrl: bestMatch.strBadge,
              league: bestMatch.strLeague,
              apiId: bestMatch.idTeam,
              searchedAs: searchTerm
            };
          }
        }
      }
    } catch (error) {
      console.log(`      ❌ Error searching for "${searchTerm}": ${error.message}`);
    }
  }
  
  console.log(`      ❌ No badge found with any variation`);
  return null;
}

async function processFinalTeam(team) {
  console.log(`\n🏆 PROCESSING ${team.name.toUpperCase()} [Final Team]`);
  
  const driver = neo4j.driver(
    process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD)
  );
  
  const session = driver.session();
  
  try {
    // Step 1: Find entity in Neo4j
    console.log(`   🔍 Step 1: Finding ${team.name} in Neo4j...`);
    const findResult = await session.run(
      "MATCH (e:Entity) WHERE e.name = $name RETURN e.name as name, elementId(e) as elementId, e.badge_url as currentBadge",
      { name: team.name }
    );
    
    if (findResult.records.length === 0) {
      console.log(`   ❌ No entity found for ${team.name}`);
      return { success: false, reason: 'Entity not found' };
    }
    
    const entity = findResult.records[0];
    const currentBadge = entity.get('currentBadge');
    
    if (currentBadge) {
      console.log(`   ✅ ${entity.get('name')} already has badge: ${currentBadge}`);
      return { success: true, reason: 'Already has badge', badgeUrl: currentBadge };
    }
    
    console.log(`   ✅ Found: ${entity.get('name')} [ID: ${entity.get('elementId').split(':')[2]}]`);
    
    // Step 2: Find team in TheSportsDB
    console.log(`   🌐 Step 2: TheSportsDB search...`);
    const theSportsDbTeam = await findTeamInTheSportsDB(team);
    
    if (!theSportsDbTeam) {
      console.log(`   ❌ No ${team.name} found in TheSportsDB`);
      return { success: false, reason: 'Not found in TheSportsDB' };
    }
    
    console.log(`   ✅ Found ${theSportsDbTeam.name} in ${theSportsDbTeam.league}`);
    console.log(`   🏷️  Badge URL: ${theSportsDbTeam.badgeUrl}`);
    
    // Step 3: Download badge
    console.log(`   ⬇️ Step 3: Downloading badge...`);
    const badgeResponse = await fetch(theSportsDbTeam.badgeUrl);
    
    if (!badgeResponse.ok) {
      console.log(`   ❌ Failed to download: ${badgeResponse.status}`);
      return { success: false, reason: 'Download failed' };
    }
    
    const buffer = await badgeResponse.arrayBuffer();
    const fileName = `${team.name.toLowerCase().replace(/\s+/g, '-')}-badge.png`;
    fs.writeFileSync(fileName, Buffer.from(buffer));
    console.log(`   ✅ Downloaded: ${fileName}`);
    
    // Step 4: Upload to S3
    console.log(`   ☁️ Step 4: Uploading to S3...`);
    
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
    console.log(`   💾 Step 5: Updating Neo4j...`);
    const elementId = entity.get('elementId');
    
    const updateResult = await session.run(
      `MATCH (e:Entity) WHERE elementId(e) = $eid 
       SET e.badge_url = $badgeUrl, 
           e.badge_source = 'TheSportsDB',
           e.badge_updated = datetime(),
           e.badge_api_id = $apiId,
           e.badge_team = $teamName,
           e.league = $league
       RETURN e.name as name, e.badge_url as badgeUrl`,
      { 
        eid: elementId, 
        badgeUrl: s3Url, 
        apiId: theSportsDbTeam.apiId,
        teamName: team.name,
        league: theSportsDbTeam.league
      }
    );
    
    if (updateResult.records.length > 0) {
      // Clean up local file
      fs.unlinkSync(fileName);
      
      console.log(`   🎉 SUCCESS! ${team.name} badge added successfully!`);
      console.log(`   🏷️  Badge: ${s3Url}`);
      
      return { 
        success: true, 
        reason: 'Final badge added',
        badgeUrl: s3Url,
        teamName: team.name,
        theSportsDbTeam: theSportsDbTeam.name,
        searchedAs: theSportsDbTeam.searchedAs
      };
    } else {
      console.log(`   ❌ Failed to update Neo4j`);
      return { success: false, reason: 'Neo4j update failed' };
    }
    
  } catch (error) {
    console.error(`   ❌ Error processing ${team.name}:`, error.message);
    return { success: false, reason: error.message };
  } finally {
    await session.close();
    await driver.close();
  }
}

async function processFinalTwoTeams() {
  console.log('🚀 PROCESSING FINAL 2 PREMIER LEAGUE TEAMS');
  
  // First check if we already have the missing teams
  await checkExistingBadges();
  
  console.log(`\n📊 Final teams to process: ${finalTeams.length}`);
  
  let successCount = 0;
  let failureCount = 0;
  const results = [];
  
  for (let i = 0; i < finalTeams.length; i++) {
    const team = finalTeams[i];
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Processing FINAL ${i + 1}/${finalTeams.length}: ${team.name}`);
    
    const result = await processFinalTeam(team);
    
    if (result.success) {
      successCount++;
      results.push({ 
        team: team.name, 
        status: result.reason, 
        badgeUrl: result.badgeUrl,
        theSportsDbTeam: result.theSportsDbTeam,
        searchedAs: result.searchedAs
      });
    } else {
      failureCount++;
      results.push({ team: team.name, status: result.reason, badgeUrl: null });
    }
    
    // Delay between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log(`\n🎉 FINAL PREMIER LEAGUE TEAMS PROCESSING COMPLETE!`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  
  console.log(`\n📊 FINAL RESULTS:`);
  console.log(`   ✅ Final badges added: ${successCount}`);
  console.log(`   ❌ Failed: ${failureCount}`);
  console.log(`   📈 Total final teams processed: ${finalTeams.length}`);
  
  console.log(`\n🏆 FINAL BADGE DETAILS:`);
  results.forEach(result => {
    const icon = result.status.includes('SUCCESS') ? '✅' : '❌';
    console.log(`   ${icon} ${result.team}: ${result.status}`);
    if (result.badgeUrl) {
      console.log(`      🏷️  ${result.badgeUrl}`);
    }
    if (result.theSportsDbTeam) {
      console.log(`      🔍 Found as: ${result.theSportsDbTeam} (searched: ${result.searchedAs})`);
    }
  });
  
  return { successCount, failureCount, results };
}

// Run the final processing
processFinalTwoTeams().catch(console.error);