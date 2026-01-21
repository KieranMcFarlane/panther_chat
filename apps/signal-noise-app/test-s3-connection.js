const { S3Client, ListObjectsV2Command, GetObjectCommand } = require('@aws-sdk/client-s3');

// Load environment variables
require('dotenv').config();

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'eu-north-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }
});

async function testS3Connection() {
  console.log('🔍 Testing S3 connection...');
  console.log('Region:', process.env.AWS_REGION);
  console.log('Bucket:', process.env.S3_BUCKET);
  console.log('');

  try {
    // List objects in the badges folder
    const listCommand = new ListObjectsV2Command({
      Bucket: process.env.S3_BUCKET,
      Prefix: 'badges/',
      MaxKeys: 20
    });

    const response = await s3Client.send(listCommand);
    console.log(`✅ Found ${response.Contents.length} objects in badges/ folder:`);

    response.Contents.forEach(obj => {
      console.log(`  - ${obj.Key} (${obj.Size} bytes)`);
    });

    // Test fetching one of the missing badges
    const missingBadges = [
      '1-fc-nrnberg-badge.png',
      '1-fc-kaiserslautern-badge.png',
      '2-bundesliga-jsonseed-badge.png',
      '1-fc-nurnberg-badge.png',
      '1-fc-union-berlin-badge.png'
    ];

    console.log('\n🔍 Checking missing badges:');
    for (const badge of missingBadges) {
      try {
        const getCommand = new GetObjectCommand({
          Bucket: process.env.S3_BUCKET,
          Key: `badges/${badge}`
        });
        await s3Client.send(getCommand);
        console.log(`  ✅ ${badge} - EXISTS`);
      } catch (err) {
        console.log(`  ❌ ${badge} - NOT FOUND (${err.name}: ${err.message})`);
      }
    }

  } catch (err) {
    console.error('❌ S3 Connection Error:', err.name, err.message);
    if (err.name === 'NoSuchBucket') {
      console.error('   The bucket does not exist or you don\'t have access');
    } else if (err.name === 'InvalidAccessKeyId') {
      console.error('   The AWS access key ID is invalid');
    } else if (err.name === 'SignatureDoesNotMatch') {
      console.error('   The AWS secret access key is invalid');
    }
  }
}

testS3Connection();
