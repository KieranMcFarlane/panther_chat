const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');

require('dotenv').config();

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'eu-north-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }
});

async function listAllBadges() {
  console.log('🔍 Listing ALL badges in S3...');

  let continuationToken = null;
  let allBadges = [];

  do {
    const response = await s3Client.send(new ListObjectsV2Command({
      Bucket: process.env.S3_BUCKET,
      Prefix: 'badges/',
      MaxKeys: 1000,
      ContinuationToken: continuationToken
    }));

    allBadges = [...allBadges, ...response.Contents];
    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  console.log(`\n✅ Total badges in S3: ${allBadges.length - 1}`); // -1 for .DS_Store

  const badgeNames = allBadges
    .filter(obj => !obj.Key.endsWith('.DS_Store') && !obj.Key.endsWith('/'))
    .map(obj => obj.Key.replace('badges/', ''))
    .sort();

  console.log('\n📋 All badges:');
  badgeNames.forEach(name => console.log(`  - ${name}`));

  // Search for similar names
  console.log('\n🔍 Searching for similar badges to the missing ones:');
  const searchTerms = ['nurnberg', 'nrnberg', 'nürnberg', 'kaiserslautern', 'union', 'bundesliga'];

  searchTerms.forEach(term => {
    const matches = badgeNames.filter(name => name.toLowerCase().includes(term.toLowerCase()));
    if (matches.length > 0) {
      console.log(`\n  "${term}":`);
      matches.forEach(m => console.log(`    - ${m}`));
    }
  });
}

listAllBadges().catch(console.error);
