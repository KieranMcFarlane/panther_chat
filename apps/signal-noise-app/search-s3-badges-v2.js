const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');

require('dotenv').config();

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }
});

async function searchBadges() {
  // List ALL badges in S3
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

  const badgeNames = allBadges
    .filter(obj => !obj.Key.endsWith('.DS_Store') && !obj.Key.endsWith('/') && obj.Key.endsWith('.png'))
    .map(obj => obj.Key.replace('badges/', ''))
    .map(n => n.toLowerCase());

  // Check for variations of the missing badges
  const searchTerms = [
    'nurnberg', 'nrnberg', 'nuernberg',
    'kaiserslautern',
    'union', '1. fc union', 'fc union'
  ];

  console.log('🔍 Searching for similar badge names in S3:');
  console.log('');

  searchTerms.forEach(term => {
    const matches = badgeNames.filter(name => name.includes(term));
    if (matches.length > 0) {
      console.log(`"${term}":`);
      matches.forEach(m => console.log(`  - ${m}`));
      console.log('');
    }
  });

  // Show badges starting with N, K, U
  console.log('📋 Badges in S3 starting with N, K, U:');
  badgeNames
    .filter(n => n[0] === 'n' || n[0] === 'k' || n[0] === 'u')
    .sort()
    .forEach(n => console.log(`  - ${n}`));
}

searchBadges().catch(console.error);
