require('dotenv').config();
const fetch = require('node-fetch');

// List of all the League One badges that should be uploaded
const expectedBadges = [
  'barnsley-badge.png',
  'birmingham-city-badge.png',
  'blackpool-badge.png',
  'bolton-wanderers-badge.png',
  'bristol-rovers-badge.png',
  'burton-albion-badge.png',
  'cambridge-united-badge.png',
  'charlton-athletic-badge.png',
  'crawley-town-badge.png',
  'exeter-city-badge.png',
  'huddersfield-town-badge.png',
  'leyton-orient-badge.png',
  'lincoln-city-badge.png',
  'mansfield-town-badge.png',
  'northampton-town-badge.png',
  'peterborough-united-badge.png',
  'portsmouth-badge.png',
  'reading-badge.png',
  'rotherham-united-badge.png',
  'shrewsbury-town-badge.png',
  'stevenage-badge.png',
  'stockport-county-badge.png',
  'wigan-athletic-badge.png',
  'wrexham-badge.png',
  'wycombe-wanderers-badge.png'
];

async function verifyBadgeUploads() {
  console.log('🔍 VERIFICATION: Checking uploaded League One badges');
  console.log('='.repeat(60));
  
  console.log(`\n📋 Environment Variables Status:`);
  console.log(`   S3_BUCKET_NAME: ${process.env.S3_BUCKET_NAME || 'NOT SET'}`);
  console.log(`   NEXT_PUBLIC_SUPABASE_URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'NOT SET'}`);
  console.log(`   SUPABASE_SERVICE_ROLE_KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'NOT SET'}`);
  
  const baseUrl = 'https://sportsintelligence.s3.eu-north-1.amazonaws.com/badges/';
  
  console.log(`\n🎯 Checking ${expectedBadges.length} expected badges...`);
  
  let foundCount = 0;
  let missingBadges = [];
  let successfulBadges = [];
  
  for (const badge of expectedBadges) {
    const url = `${baseUrl}${badge}`;
    try {
      const response = await fetch(url, { method: 'HEAD' });
      
      if (response.ok) {
        const contentLength = response.headers.get('content-length');
        console.log(`   ✅ ${badge} - ${contentLength} bytes`);
        foundCount++;
        successfulBadges.push({ name: badge, url: url, size: contentLength });
      } else {
        console.log(`   ❌ ${badge} - HTTP ${response.status}`);
        missingBadges.push(badge);
      }
    } catch (error) {
      console.log(`   ❌ ${badge} - Error: ${error.message}`);
      missingBadges.push(badge);
    }
  }
  
  console.log(`\n📊 SUMMARY:`);
  console.log(`   Total expected badges: ${expectedBadges.length}`);
  console.log(`   ✅ Successfully uploaded: ${foundCount}`);
  console.log(`   ❌ Missing/failed: ${missingBadges.length}`);
  console.log(`   📈 Success rate: ${((foundCount / expectedBadges.length) * 100).toFixed(1)}%`);
  
  if (successfulBadges.length > 0) {
    console.log(`\n✅ SUCCESSFUL BADGES (${successfulBadges.length}):`);
    successfulBadges.forEach(badge => {
      console.log(`   ${badge.name} - ${badge.url}`);
    });
  }
  
  if (missingBadges.length > 0) {
    console.log(`\n❌ MISSING BADGES (${missingBadges.length}):`);
    missingBadges.forEach(badge => {
      console.log(`   ${badge.name}`);
    });
  }
  
  // Check total file sizes
  const totalSize = successfulBadges.reduce((sum, badge) => sum + parseInt(badge.size || '0'), 0);
  console.log(`\n💾 Total storage used: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
  
  return {
    total: expectedBadges.length,
    found: foundCount,
    missing: missingBadges.length,
    successRate: ((foundCount / expectedBadges.length) * 100).toFixed(1),
    successfulBadges: successfulBadges,
    missingBadges: missingBadges,
    totalSizeBytes: totalSize
  };
}

async function main() {
  const results = await verifyBadgeUploads();
  
  // Save verification results
  const fs = require('fs');
  const reportData = {
    timestamp: new Date().toISOString(),
    verification: results
  };
  
  fs.writeFileSync('league-one-badges-verification.json', JSON.stringify(reportData, null, 2));
  console.log('\n📄 Verification report saved to: league-one-badges-verification.json');
  
  if (results.found === results.total) {
    console.log('\n🎉 EXCELLENT! All League One badges have been successfully uploaded to S3!');
  } else {
    console.log(`\n⚠️ PARTIAL SUCCESS: ${results.found}/${results.total} badges uploaded successfully.`);
  }
}

main().catch(console.error);