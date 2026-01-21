require('dotenv').config();
const neo4j = require('neo4j-driver');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const fetch = require('node-fetch');
const fs = require('fs');

// Teams that failed during batch processing with enhanced search variations
const remainingTeams = [
  { 
    name: 'Tottenham', 
    searchVariations: ['Tottenham', 'Tottenham Hotspur', 'Spurs', 'Tottenham Hotspur FC'],
    knownId: '133618'
  },
  { 
    name: 'Brighton & Hove Albion', 
    searchVariations: ['Brighton', 'Brighton & Hove Albion', 'Brighton Hove Albion', 'Brighton and Hove Albion'],
    knownId: '133627'
  },
  { 
    name: 'Brentford FC', 
    searchVariations: ['Brentford', 'Brentford FC', 'Brentford Football Club'],
    knownId: '133632'
  },
  { 
    name: 'Southampton', 
    searchVariations: ['Southampton', 'Southampton FC', 'Southampton Football Club'],
    knownId: '133626'
  },
  { 
    name: 'Burnley', 
    searchVariations: ['Burnley', 'Burnley FC', 'Burnley Football Club'],
    knownId: '133628'
  },
  { 
    name: 'Fulham', 
    searchVariations: ['Fulham', 'Fulham FC', 'Fulham Football Club'],
    knownId: '133629'
  }
];

async function findEntityInNeo4j(session, teamName) {
  // Try multiple name variations
  const variations = [
    teamName,
    teamName + ' FC',
    teamName.replace(' FC', ''),
    teamName.replace(' & Hove Albion', ' & Hove Albion FC'),
    teamName.replace(' Brighton &', ' Brighton and')
  ];
  
  for (const variation of variations) {
    const result = await session.run(
      "MATCH (e:Entity) WHERE e.name = $name RETURN e.name as name, elementId(e) as elementId, e.badge_url as currentBadge",
      { name: variation }
    );
    
    if (result.records.length > 0) {
      const record = result.records[0];
      return {
        name: record.get('name'),
        elementId: record.get('elementId'),
        currentBadge: record.get('currentBadge'),
        foundAs: variation
      };
    }
  }
  
  return null;
}

async function findTeamInTheSportsDB(searchVariations) {
  console.log(`   🔍 Searching with ${searchVariations.length} variations...`);
  
  for (const searchTerm of searchVariations) {
    try {
      console.log(`      Trying: "${searchTerm}"`);
      
      const searchUrl = `https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=${encodeURIComponent(searchTerm)}`;
      const response = await fetch(searchUrl);
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.teams && data.teams.length > 0) {
          // Find the best match (prefer English Premier League teams)
          const bestMatch = data.teams.find(team => 
            team.strLeague && team.strLeague.includes('Premier League')
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

async function processRemainingTeam(team) {
  console.log(`\n🏆 PROCESSING ${team.name.toUpperCase()}`);
  
  const driver = neo4j.driver(
    process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD)
  );
  
  const session = driver.session();
  
  try {
    // Step 1: Find entity in Neo4j
    console.log(`   🔍 Step 1: Finding ${team.name} in Neo4j...`);
    const entity = await findEntityInNeo4j(session, team.name);
    
    if (!entity) {
      console.log(`   ⚠️  No entity found for ${team.name}, creating one...`);
      
      // Create new entity
      const createResult = await session.run(
        `CREATE (e:Entity {
          name: $name,
          type: 'Club',
          league: 'English Premier League',
          sport: 'Football',
          created_by: 'badge_workflow',
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
    } else {
      console.log(`   ✅ Found existing entity: ${entity.name} (found as: ${entity.foundAs})`);
      
      if (entity.currentBadge) {
        console.log(`   ✅ Already has badge: ${entity.currentBadge}`);
        return { success: true, reason: 'Already has badge', badgeUrl: entity.currentBadge };
      }
    }
    
    // Step 2: Find team in TheSportsDB with enhanced search
    console.log(`   🌐 Step 2: Enhanced TheSportsDB search...`);
    const theSportsDbTeam = await findTeamInTheSportsDB(team.searchVariations);
    
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
    const fileName = `${team.name.toLowerCase().replace(/\s+/g, '-').replace(/[&]/g, 'and')}-badge.png`;
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
           e.league = $league
       RETURN e.name as name, e.badge_url as badgeUrl`,
      { 
        eid: entity.elementId, 
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
        reason: 'Badge added',
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

async function processAllRemainingTeams() {
  console.log('🚀 PROCESSING REMAINING PREMIER LEAGUE TEAMS WITH ENHANCED SEARCH');
  console.log(`\n📊 Teams to process: ${remainingTeams.length}`);
  
  let successCount = 0;
  let skipCount = 0;
  let failureCount = 0;
  const results = [];
  
  for (let i = 0; i < remainingTeams.length; i++) {
    const team = remainingTeams[i];
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Processing ${i + 1}/${remainingTeams.length}: ${team.name}`);
    
    const result = await processRemainingTeam(team);
    
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
        searchedAs: result.searchedAs
      });
    } else {
      failureCount++;
      results.push({ team: team.name, status: result.reason, badgeUrl: null });
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log(`\n🎉 REMAINING PREMIER LEAGUE PROCESSING COMPLETE!`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  
  console.log(`\n📊 FINAL RESULTS:`);
  console.log(`   ✅ Successful badges: ${successCount}`);
  console.log(`   ⏭️  Already had badges: ${skipCount}`);
  console.log(`   ❌ Failed: ${failureCount}`);
  console.log(`   📈 Total processed: ${remainingTeams.length}`);
  
  console.log(`\n🏆 BADGE DETAILS:`);
  results.forEach(result => {
    const icon = result.status.includes('SUCCESS') ? '✅' : 
                 result.status.includes('Already') ? '⏭️' : '❌';
    console.log(`   ${icon} ${result.team}: ${result.status}`);
    if (result.badgeUrl) {
      console.log(`      🏷️  ${result.badgeUrl}`);
    }
    if (result.theSportsDbTeam) {
      console.log(`      🔍 Found as: ${result.theSportsDbTeam} (searched: ${result.searchedAs})`);
    }
  });
  
  return { successCount, skipCount, failureCount, results };
}

// Run the processing
processAllRemainingTeams().catch(console.error);