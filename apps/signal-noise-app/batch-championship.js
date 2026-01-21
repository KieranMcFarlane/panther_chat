require('dotenv').config();
const neo4j = require('neo4j-driver');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const fetch = require('node-fetch');
const fs = require('fs');

// Teams that need badges from our discovery
const championshipTeamsToProcess = [
  {
    name: 'Millwall',
    searchVariations: ['Millwall', 'Millwall FC', 'Millwall Football Club'],
    sport: 'Football',
    knownId: null // Let API find it
  },
  {
    name: 'Sheffield Wednesday',
    searchVariations: ['Sheffield Wednesday', 'Sheffield Wednesday FC', 'Sheffield Wednesday Football Club'],
    sport: 'Football', 
    knownId: null
  },
  {
    name: 'Cardiff City',
    searchVariations: ['Cardiff City', 'Cardiff City FC', 'Cardiff City Football Club'],
    sport: 'Football',
    knownId: null
  },
  {
    name: 'Coventry City',
    searchVariations: ['Coventry City', 'Coventry City FC', 'Coventry City Football Club'],
    sport: 'Football',
    knownId: null
  },
  {
    name: 'Derby County',
    searchVariations: ['Derby County', 'Derby County FC', 'Derby County Football Club'],
    sport: 'Football',
    knownId: null
  },
  {
    name: 'Ipswich Town',
    searchVariations: ['Ipswich Town', 'Ipswich Town FC', 'Ipswich Town Football Club'],
    sport: 'Football',
    knownId: null
  },
  {
    name: 'Leeds United',
    searchVariations: ['Leeds United', 'Leeds United FC', 'Leeds United Football Club'],
    sport: 'Football',
    knownId: null
  },
  {
    name: 'Middlesbrough',
    searchVariations: ['Middlesbrough', 'Middlesbrough FC', 'Middlesbrough Football Club'],
    sport: 'Football',
    knownId: null
  },
  {
    name: 'Norwich City',
    searchVariations: ['Norwich City', 'Norwich City FC', 'Norwich City Football Club'],
    sport: 'Football',
    knownId: null
  },
  {
    name: 'Sunderland',
    searchVariations: ['Sunderland', 'Sunderland AFC', 'Sunderland Association Football Club'],
    sport: 'Football',
    knownId: null
  },
  {
    name: 'Swansea City',
    searchVariations: ['Swansea City', 'Swansea City AFC', 'Swansea City Association Football Club'],
    sport: 'Football',
    knownId: null
  },
  {
    name: 'Watford',
    searchVariations: ['Watford', 'Watford FC', 'Watford Football Club'],
    sport: 'Football',
    knownId: null
  },
  {
    name: 'West Bromwich Albion',
    searchVariations: ['West Bromwich Albion', 'West Brom', 'West Bromwich Albion FC'],
    sport: 'Football',
    knownId: null
  }
];

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
          // Find the best match (prefer Championship or related teams)
          const bestMatch = data.teams.find(team => 
            team.strLeague && (team.strLeague.includes('Championship') || 
                              team.strLeague.includes('League One') ||
                              team.strLeague.includes('Premier League') ||
                              team.strLeague.includes('League Two') ||
                              team.strLeague.includes('English'))
          ) || data.teams[0];
          
          if (bestMatch.strBadge) {
            console.log(`      ✅ Found: ${bestMatch.strTeam} (${bestMatch.strLeague})`);
            return {
              name: bestMatch.strTeam,
              badgeUrl: bestMatch.strBadge,
              league: bestMatch.strLeague,
              apiId: bestMatch.idTeam,
              searchedAs: searchTerm,
              sport: bestMatch.strSport
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

async function processChampionshipTeam(team) {
  console.log(`\n🏆 PROCESSING ${team.name.toUpperCase()} [Championship]`);
  
  const driver = neo4j.driver(
    process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD)
  );
  
  const session = driver.session();
  
  try {
    // Step 1: Find entity in Neo4j
    console.log(`   🔍 Step 1: Finding ${team.name} in Neo4j...`);
    
    // Try multiple name variations
    let entity = null;
    for (const variation of [team.name, team.name + ' FC', team.name.replace(' City', ' City FC'), team.name.replace(' County', ' County FC')]) {
      const findResult = await session.run(
        "MATCH (e:Entity) WHERE e.name = $name RETURN e.name as name, elementId(e) as elementId, e.badge_url as currentBadge",
        { name: variation }
      );
      
      if (findResult.records.length > 0) {
        entity = {
          name: findResult.records[0].get('name'),
          elementId: findResult.records[0].get('elementId'),
          currentBadge: findResult.records[0].get('currentBadge'),
          foundAs: variation
        };
        console.log(`   ✅ Found: ${entity.name} (found as: ${entity.foundAs})`);
        break;
      }
    }
    
    if (!entity) {
      console.log(`   ⚠️  No entity found for ${team.name}, creating one...`);
      
      // Create new entity
      const createResult = await session.run(
        `CREATE (e:Entity {
          name: $name,
          type: 'Club',
          league: 'English Championship',
          sport: 'Football',
          created_by: 'championship_workflow',
          created_at: datetime()
        }) RETURN e.name as name, elementId(e) as elementId`,
        { name: team.name }
      );
      
      if (createResult.records.length > 0) {
        entity = {
          name: createResult.records[0].get('name'),
          elementId: createResult.records[0].get('elementId'),
          currentBadge: null,
          foundAs: team.name
        };
        console.log(`   ✅ Created new entity: ${entity.name}`);
      } else {
        console.log(`   ❌ Failed to create entity for ${team.name}`);
        return { success: false, reason: 'Entity creation failed' };
      }
    } else if (entity.currentBadge) {
      console.log(`   ✅ Already has badge: ${entity.currentBadge}`);
      return { success: true, reason: 'Already has badge', badgeUrl: entity.currentBadge };
    }
    
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
    
    const updateResult = await session.run(
      `MATCH (e:Entity) WHERE elementId(e) = $eid 
       SET e.badge_url = $badgeUrl, 
           e.badge_source = 'TheSportsDB',
           e.badge_updated = datetime(),
           e.badge_api_id = $apiId,
           e.badge_team = $teamName,
           e.league = $league,
           e.sport = $sport
       RETURN e.name as name, e.badge_url as badgeUrl`,
      { 
        eid: entity.elementId, 
        badgeUrl: s3Url, 
        apiId: theSportsDbTeam.apiId,
        teamName: team.name,
        league: theSportsDbTeam.league,
        sport: theSportsDbTeam.sport
      }
    );
    
    if (updateResult.records.length > 0) {
      // Clean up local file
      fs.unlinkSync(fileName);
      
      console.log(`   🎉 SUCCESS! ${team.name} badge added successfully!`);
      console.log(`   🏷️  Badge: ${s3Url}`);
      
      return { 
        success: true, 
        reason: 'Championship badge added',
        badgeUrl: s3Url,
        teamName: team.name,
        theSportsDbTeam: theSportsDbTeam.name,
        searchedAs: theSportsDbTeam.searchedAs,
        league: theSportsDbTeam.league
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

async function batchProcessChampionship() {
  console.log('🚀 BATCH PROCESSING ENGLISH CHAMPIONSHIP TEAMS');
  console.log(`\n📊 Teams to process: ${championshipTeamsToProcess.length}`);
  console.log('🎯 Focus: Football teams in English Championship');
  
  let successCount = 0;
  let skipCount = 0;
  let failureCount = 0;
  const results = [];
  
  for (let i = 0; i < championshipTeamsToProcess.length; i++) {
    const team = championshipTeamsToProcess[i];
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Processing ${i + 1}/${championshipTeamsToProcess.length}: ${team.name}`);
    
    const result = await processChampionshipTeam(team);
    
    if (result.success) {
      if (result.reason === 'Already has badge') {
        skipCount++;
      } else {
        successCount++;
      }
      results.push({ 
        team: team.name, 
        status: result.reason, 
        badgeUrl: result.badgeUrl,
        theSportsDbTeam: result.theSportsDbTeam,
        searchedAs: result.searchedAs,
        league: result.league
      });
    } else {
      failureCount++;
      results.push({ team: team.name, status: result.reason, badgeUrl: null });
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 800));
  }
  
  console.log(`\n🎉 CHAMPIONSHIP BATCH PROCESSING COMPLETE!`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  
  console.log(`\n📊 FINAL RESULTS:`);
  console.log(`   ✅ Successful badges: ${successCount}`);
  console.log(`   ⏭️  Already had badges: ${skipCount}`);
  console.log(`   ❌ Failed: ${failureCount}`);
  console.log(`   📈 Total processed: ${championshipTeamsToProcess.length}`);
  
  console.log(`\n🏆 CHAMPIONSHIP BADGE DETAILS:`);
  results.forEach(result => {
    const icon = result.status.includes('SUCCESS') ? '✅' : 
                 result.status.includes('Already') ? '⏭️' : '❌';
    console.log(`   ${icon} ${result.team}: ${result.status}`);
    if (result.badgeUrl) {
      console.log(`      🏷️  ${result.badgeUrl}`);
    }
    if (result.theSportsDbTeam) {
      console.log(`      🔍 Found as: ${result.theSportsDbTeam} (searched: ${result.searchedAs})`);
      console.log(`      🏆 League: ${result.league}`);
    }
  });
  
  console.log(`\n🎯 SUMMARY:`);
  console.log(`   🏆 Championship badges added: ${successCount}`);
  console.log(`   🚀 Ready for application: ${successCount} new badges`);
  
  return { successCount, skipCount, failureCount, results };
}

// Run the batch processing
batchProcessChampionship().catch(console.error);