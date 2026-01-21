require('dotenv').config();
const neo4j = require('neo4j-driver');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const fetch = require('node-fetch');
const fs = require('fs');

async function processManchesterUnited() {
  console.log('🏆 PROCESSING MANCHESTER UNITED BADGE\n');
  
  const driver = neo4j.driver(
    process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD)
  );
  
  const session = driver.session();
  
  try {
    // Step 1: Find Manchester United in Neo4j
    console.log('🔍 Step 1: Finding Manchester United in Neo4j...');
    const findResult = await session.run(
      "MATCH (e:Entity) WHERE e.name = 'Manchester United' RETURN e.name as name, elementId(e) as elementId, e.type as type"
    );
    
    if (findResult.records.length === 0) {
      console.log('❌ No Manchester United entity found');
      return;
    }
    
    const muEntity = findResult.records[0];
    console.log(`✅ Found: ${muEntity.get('name')} [ID: ${muEntity.get('elementId').split(':')[2]}]`);
    
    // Step 2: Get badge from TheSportsDB
    console.log('\n🌐 Step 2: Getting Manchester United badge...');
    const badgeUrl = 'https://r2.thesportsdb.com/images/media/team/badge/xzqdr11517660252.png';
    console.log(`   ✅ Badge URL: ${badgeUrl}`);
    
    // Step 3: Download badge
    console.log('\n⬇️ Step 3: Downloading badge...');
    const badgeResponse = await fetch(badgeUrl);
    
    if (!badgeResponse.ok) {
      console.log(`❌ Failed to download: ${badgeResponse.status}`);
      return;
    }
    
    const buffer = await badgeResponse.arrayBuffer();
    const fileName = 'manchester-united-badge.png';
    fs.writeFileSync(fileName, Buffer.from(buffer));
    console.log(`   ✅ Downloaded: ${fileName}`);
    
    // Step 4: Upload to S3
    console.log('\n☁️ Step 4: Uploading to S3...');
    
    const s3Client = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      }
    });
    
    const fileContent = fs.readFileSync(fileName);
    const s3Key = `badges/${fileName}`;
    
    const s3Result = await s3Client.send(new PutObjectCommand({
      Bucket: 'sportsintelligence',
      Key: s3Key,
      Body: fileContent,
      ContentType: 'image/png'
    }));
    
    const s3Url = `https://sportsintelligence.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;
    console.log(`   ✅ Uploaded to S3: ${s3Url}`);
    
    // Step 5: Update Neo4j
    console.log('\n💾 Step 5: Updating Neo4j...');
    const elementId = muEntity.get('elementId');
    
    const updateResult = await session.run(
      `MATCH (e:Entity) WHERE elementId(e) = $eid 
       SET e.badge_url = $badgeUrl, 
           e.badge_source = 'TheSportsDB',
           e.badge_updated = datetime(),
           e.badge_api_id = '133612'
       RETURN e.name as name, e.badge_url as badgeUrl`,
      { eid: elementId, badgeUrl: s3Url }
    );
    
    if (updateResult.records.length > 0) {
      const updated = updateResult.records[0];
      console.log(`   ✅ Updated successfully!`);
      console.log(`   📋 Name: ${updated.get('name')}`);
      console.log(`   🏷️  Badge: ${updated.get('badgeUrl')}`);
      
      // Clean up local file
      fs.unlinkSync(fileName);
      
      console.log('\n🎉 MANCHESTER UNITED BADGE PROCESSING COMPLETE!');
      return true;
    } else {
      console.log('❌ Failed to update Neo4j');
      return false;
    }
    
  } catch (error) {
    console.error('❌ Error processing Manchester United:', error);
    return false;
  } finally {
    await session.close();
    await driver.close();
  }
}

processManchesterUnited();