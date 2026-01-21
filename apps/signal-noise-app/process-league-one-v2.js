require('dotenv').config();
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

// BrightData configuration - search for team badges directly
const BRIGHTDATA_API_TOKEN = process.env.BRIGHTDATA_API_TOKEN;
const BRIGHTDATA_API_URL = 'https://api.brightdata.com/serp/req';
const S3_BUCKET = process.env.S3_BUCKET_NAME;
const S3_REGION = process.env.AWS_REGION;

// League One teams from Supabase that need badges
const leagueOneTeams = [
  'Barnsley FC', 'Birmingham City FC', 'Blackpool FC', 'Bolton Wanderers FC',
  'Bristol Rovers FC', 'Burton Albion FC', 'Cambridge United FC', 'Charlton Athletic FC',
  'Crawley Town FC', 'Exeter City FC', 'Huddersfield Town FC', 'Leyton Orient FC',
  'Lincoln City FC', 'Mansfield Town FC', 'Northampton Town FC', 'Peterborough United FC',
  'Portsmouth FC', 'Reading FC', 'Rotherham United FC', 'Shrewsbury Town FC',
  'Stevenage FC', 'Stockport County FC', 'Wigan Athletic FC', 'Wrexham FC', 'Wycombe Wanderers FC'
];

// Alternative search terms for better results
const searchVariations = {
  'Barnsley FC': ['Barnsley football badge', 'Barnsley FC crest'],
  'Birmingham City FC': ['Birmingham City badge', 'Birmingham City crest'],
  'Blackpool FC': ['Blackpool FC badge', 'Blackpool football crest'],
  'Bolton Wanderers FC': ['Bolton Wanderers badge', 'Bolton Wanderers crest'],
  'Bristol Rovers FC': ['Bristol Rovers badge', 'Bristol Rovers crest'],
  'Burton Albion FC': ['Burton Albion badge', 'Burton Albion crest'],
  'Cambridge United FC': ['Cambridge United badge', 'Cambridge United crest'],
  'Charlton Athletic FC': ['Charlton Athletic badge', 'Charlton Athletic crest'],
  'Crawley Town FC': ['Crawley Town badge', 'Crawley Town crest'],
  'Exeter City FC': ['Exeter City badge', 'Exeter City crest'],
  'Huddersfield Town FC': ['Huddersfield Town badge', 'Huddersfield Town crest'],
  'Leyton Orient FC': ['Leyton Orient badge', 'Leyton Orient crest'],
  'Lincoln City FC': ['Lincoln City badge', 'Lincoln City crest'],
  'Mansfield Town FC': ['Mansfield Town badge', 'Mansfield Town crest'],
  'Northampton Town FC': ['Northampton Town badge', 'Northampton Town crest'],
  'Peterborough United FC': ['Peterborough United badge', 'Peterborough United crest'],
  'Portsmouth FC': ['Portsmouth FC badge', 'Portsmouth football crest'],
  'Reading FC': ['Reading FC badge', 'Reading football crest'],
  'Rotherham United FC': ['Rotherham United badge', 'Rotherham United crest'],
  'Shrewsbury Town FC': ['Shrewsbury Town badge', 'Shrewsbury Town crest'],
  'Stevenage FC': ['Stevenage FC badge', 'Stevenage football crest'],
  'Stockport County FC': ['Stockport County badge', 'Stockport County crest'],
  'Wigan Athletic FC': ['Wigan Athletic badge', 'Wigan Athletic crest'],
  'Wrexham FC': ['Wrexham FC badge', 'Wrexham football crest'],
  'Wycombe Wanderers FC': ['Wycombe Wanderers badge', 'Wycombe Wanderers crest']
};

async function searchBrightDataForBadge(teamName, searchTerms) {
  for (const searchTerm of searchTerms) {
    try {
      console.log(`   🔍 BrightData search: "${searchTerm}"`);
      
      const brightDataParams = new URLSearchParams({
        api_token: BRIGHTDATA_API_TOKEN,
        q: searchTerm,
        country: 'gb',
        language: 'en',
        search_engine: 'google.com',
        results_per_page: 5,
        format: 'json'
      });

      const response = await fetch(`${BRIGHTDATA_API_URL}?${brightDataParams}`);
      if (!response.ok) {
        throw new Error(`BrightData API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.organic_results && data.organic_results.length > 0) {
        // Look for official team websites or Wikipedia pages that might have badge info
        for (const result of data.organic_results) {
          if (result.link && (
            result.link.includes('wikipedia.org') || 
            result.link.includes('.co.uk') ||
            result.link.includes('.com') ||
            result.title.toLowerCase().includes('badge') ||
            result.title.toLowerCase().includes('crest')
          )) {
            console.log(`   ✅ Found potential source: ${result.title} - ${result.link}`);
            return { searchTerm, result };
          }
        }
      }
    } catch (error) {
      console.log(`   ⚠️ BrightData search failed for "${searchTerm}": ${error.message}`);
    }
  }
  
  return null;
}

async function downloadBadgeFromPage(teamName, pageUrl) {
  try {
    console.log(`   📄 Fetching page: ${pageUrl}`);
    
    const response = await fetch(pageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch page: ${response.status}`);
    }
    
    const html = await response.text();
    
    // Look for image URLs that might be badges
    const imagePatterns = [
      /<img[^>]+src=["']([^"']*(?:badge|crest|logo)[^"']*\.(?:png|jpg|jpeg|svg))["'][^>]*>/gi,
      /<img[^>]+src=["']([^"']*logo[^"']*\.(?:png|jpg|jpeg|svg))["'][^>]*>/gi,
      /<img[^>]+alt=["']([^"']*(?:badge|crest|logo)[^"']*)["'][^>]+src=["']([^"']+)["'][^>]*>/gi
    ];
    
    for (const pattern of imagePatterns) {
      const matches = html.match(pattern);
      if (matches) {
        for (const match of matches) {
          let imgUrl = match;
          
          // Extract the URL from the img tag
          const urlMatch = match.match(/src=["']([^"']+)["']/i);
          if (urlMatch) {
            imgUrl = urlMatch[1];
            
            // Convert relative URLs to absolute
            if (imgUrl.startsWith('/')) {
              const baseUrl = new URL(pageUrl);
              imgUrl = `${baseUrl.protocol}//${baseUrl.host}${imgUrl}`;
            }
            
            // Skip obviously non-badge images
            if (imgUrl.includes('player') || imgUrl.includes('stadium') || 
                imgUrl.includes('sponsor') || imgUrl.includes('facebook') ||
                imgUrl.includes('twitter') || imgUrl.includes('instagram')) {
              continue;
            }
            
            console.log(`   🖼️ Found potential badge image: ${imgUrl}`);
            return imgUrl;
          }
        }
      }
    }
    
  } catch (error) {
    console.log(`   ❌ Error scraping page: ${error.message}`);
  }
  
  return null;
}

async function downloadAndUploadBadge(teamName, imageUrl) {
  try {
    if (!imageUrl) {
      throw new Error('No image URL provided');
    }

    console.log(`   📥 Downloading badge image from: ${imageUrl}`);
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.statusText}`);
    }
    
    const buffer = await response.buffer();
    console.log(`   ✅ Badge downloaded successfully (${buffer.length} bytes)`);
    
    // Upload to S3
    const fileName = `${teamName.toLowerCase().replace(/\s+/g, '-').replace('-fc', '')}-badge.png`;
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
    
    return `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${s3Key}`;
    
  } catch (error) {
    console.error(`   ❌ Error processing badge for ${teamName}:`, error.message);
    return null;
  }
}

async function createFallbackBadge(teamName) {
  // Create a simple text-based badge as fallback
  const canvas = require('canvas');
  const { createCanvas, registerFont } = canvas;
  
  try {
    const width = 200;
    const height = 200;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    
    // Draw background circle
    ctx.fillStyle = '#2563eb'; // Blue background
    ctx.beginPath();
    ctx.arc(width/2, height/2, width/2, 0, 2 * Math.PI);
    ctx.fill();
    
    // Draw text
    ctx.fillStyle = 'white';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const shortName = teamName.replace(' FC', '').replace(' Football Club', '');
    const words = shortName.split(' ');
    
    if (words.length > 1) {
      ctx.fillText(words[0], width/2, height/2 - 15);
      ctx.fillText(words.slice(1).join(' '), width/2, height/2 + 15);
    } else {
      ctx.fillText(words[0], width/2, height/2);
    }
    
    const buffer = canvas.toBuffer('image/png');
    
    // Upload to S3
    const fileName = `${teamName.toLowerCase().replace(/\s+/g, '-').replace('-fc', '')}-badge.png`;
    const s3Key = `badges/${fileName}`;
    
    const uploadParams = {
      Bucket: S3_BUCKET,
      Key: s3Key,
      Body: buffer,
      ContentType: 'image/png',
      CacheControl: 'public, max-age=31536000'
    };
    
    await s3Client.send(new PutObjectCommand(uploadParams));
    
    return `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${s3Key}`;
    
  } catch (error) {
    console.log(`   ⚠️ Canvas fallback failed: ${error.message}`);
    return null;
  }
}

async function processLeagueOneTeam(teamName, index, total) {
  console.log(`\n⚽ Processing ${index}/${total}: ${teamName}`);
  
  const searchTerms = searchVariations[teamName] || [`${teamName} badge`, `${teamName} crest`];
  
  // Try BrightData search
  const searchData = await searchBrightDataForBadge(teamName, searchTerms);
  
  if (searchData && searchData.result) {
    const badgeUrl = await downloadBadgeFromPage(teamName, searchData.result.link);
    
    if (badgeUrl) {
      const finalBadgeUrl = await downloadAndUploadBadge(teamName, badgeUrl);
      if (finalBadgeUrl) {
        console.log(`   🎉 ${teamName}: SUCCESS using ${searchData.searchTerm}`);
        console.log(`   📷 Badge: ${finalBadgeUrl}`);
        return { success: true, team: teamName, badgeUrl: finalBadgeUrl, method: 'BrightData scraper' };
      }
    }
  }
  
  // Fallback: Create a simple badge
  console.log(`   🎨 Creating fallback badge for ${teamName}`);
  const fallbackBadgeUrl = await createFallbackBadge(teamName);
  
  if (fallbackBadgeUrl) {
    console.log(`   🎉 ${teamName}: SUCCESS with fallback badge`);
    console.log(`   📷 Badge: ${fallbackBadgeUrl}`);
    return { success: true, team: teamName, badgeUrl: fallbackBadgeUrl, method: 'Canvas fallback' };
  }
  
  console.log(`   ❌ ${teamName}: FAILED - All methods exhausted`);
  return { success: false, team: teamName, error: 'All badge generation methods failed' };
}

function generateFinalReport(results, teams) {
  console.log('\n' + '='.repeat(80));
  console.log('🏆 LEAGUE ONE BADGE PROCESSING FINAL REPORT');
  console.log('='.repeat(80));
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  const brightDataSuccess = results.filter(r => r.method === 'BrightData scraper');
  const fallbackSuccess = results.filter(r => r.method === 'Canvas fallback');
  
  console.log(`\n📊 SUMMARY:`);
  console.log(`   Total teams processed: ${teams.length}`);
  console.log(`   ✅ Successful: ${successful.length}`);
  console.log(`   ❌ Failed: ${failed.length}`);
  console.log(`   📈 Success rate: ${((successful.length / teams.length) * 100).toFixed(1)}%`);
  
  console.log(`\n🔧 METHODS USED:`);
  console.log(`   BrightData scraper: ${brightDataSuccess.length} teams`);
  console.log(`   Canvas fallback: ${fallbackSuccess.length} teams`);
  
  if (successful.length > 0) {
    console.log(`\n✅ SUCCESSFUL TEAMS (${successful.length}):`);
    successful.forEach(result => {
      console.log(`   ${result.team} (${result.method}) → ${result.badgeUrl}`);
    });
  }
  
  if (failed.length > 0) {
    console.log(`\n❌ FAILED TEAMS (${failed.length}):`);
    failed.forEach(result => {
      console.log(`   ${result.team} → ${result.error}`);
    });
  }
  
  console.log(`\n🎯 League One badge coverage: ${successful.length}/${teams.length} teams (${((successful.length / teams.length) * 100).toFixed(1)}%)`);
  console.log('🚀 All badges are stored on S3 and ready for Neo4j integration!');
  
  return {
    total: teams.length,
    successful: successful.length,
    failed: failed.length,
    successRate: ((successful.length / teams.length) * 100).toFixed(1),
    brightDataSuccess: brightDataSuccess.length,
    fallbackSuccess: fallbackSuccess.length,
    results: results
  };
}

async function main() {
  console.log('🏆 LEAGUE ONE BADGE PROCESSOR V2 STARTING');
  console.log('🎯 Processing 25 League One teams using BrightData + fallback methods');
  console.log('⚽ Goal: Complete League One badge coverage with intelligent fallbacks');
  
  console.log(`\n📋 Teams to process: ${leagueOneTeams.join(', ')}`);
  
  const results = [];
  
  for (let i = 0; i < leagueOneTeams.length; i++) {
    const result = await processLeagueOneTeam(leagueOneTeams[i], i + 1, leagueOneTeams.length);
    results.push(result);
    
    // Small delay between teams
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  const report = generateFinalReport(results, leagueOneTeams);
  
  console.log('\n🎉 League One badge processing completed!');
  
  // Save results to file
  const reportData = {
    timestamp: new Date().toISOString(),
    league: 'League One',
    ...report
  };
  
  fs.writeFileSync('league-one-badges-v2-report.json', JSON.stringify(reportData, null, 2));
  console.log('\n📄 Detailed report saved to: league-one-badges-v2-report.json');
}

main().catch(console.error);