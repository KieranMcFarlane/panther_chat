const { S3Client, ListObjectsV2Command, GetObjectCommand } = require('@aws-sdk/client-s3');
const { createClient } = require('@supabase/supabase-js');

require('dotenv').config();

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'eu-north-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
);

async function checkBadgeMismatches() {
  console.log('🔍 Checking badge mismatches between database and S3...');

  // Get all badges from S3
  let continuationToken = null;
  let allS3Badges = [];

  do {
    const response = await s3Client.send(new ListObjectsV2Command({
      Bucket: process.env.S3_BUCKET,
      Prefix: 'badges/',
      MaxKeys: 1000,
      ContinuationToken: continuationToken
    }));

    allS3Badges = [...allS3Badges, ...response.Contents];
    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  const s3BadgeSet = new Set(
    allS3Badges
      .filter(obj => !obj.Key.endsWith('.DS_Store') && !obj.Key.endsWith('/') && obj.Key.endsWith('.png'))
      .map(obj => obj.Key.replace('badges/', ''))
  );

  console.log(`✅ Found ${s3BadgeSet.size} badges in S3`);

  // Get entities with badge_s3_url from Supabase
  const { data: entities, error } = await supabase
    .from('cached_entities')
    .select('id, neo4j_id, properties->>name as name, badge_s3_url')
    .not('badge_s3_url', 'is', null)
    .limit(100);

  if (error) {
    console.error('❌ Supabase error:', error);
    return;
  }

  console.log(`✅ Found ${entities.length} entities with badge_s3_url\n`);

  const mismatches = [];
  const matches = [];

  for (const entity of entities) {
    // Extract badge filename from URL
    let badgeFilename = entity.badge_s3_url;

    if (badgeFilename.includes('s3') && badgeFilename.includes('/badges/')) {
      badgeFilename = badgeFilename.split('/badges/').pop();
    } else if (badgeFilename.includes('/badges/')) {
      badgeFilename = badgeFilename.split('/badges/').pop();
    } else if (badgeFilename.startsWith('/badges/')) {
      badgeFilename = badgeFilename.replace('/badges/', '');
    } else if (badgeFilename.startsWith('https://sportsintelligence.s3')) {
      const urlParts = new URL(badgeFilename);
      const pathParts = urlParts.pathname.split('/');
      badgeFilename = pathParts[pathParts.length - 1];
    }

    // Check if this badge exists in S3
    if (s3BadgeSet.has(badgeFilename)) {
      matches.push({ name: entity.name, badge: badgeFilename });
    } else {
      // Try to find similar badge in S3
      const similar = Array.from(s3BadgeSet).filter(s3Badge => {
        const s3Base = s3Badge.replace('.png', '').toLowerCase();
        const dbBase = badgeFilename.replace('.png', '').toLowerCase();
        return s3Base.includes(dbBase.replace('1-fc-', '').replace('2-', '')) ||
               dbBase.includes(s3Base.replace('1-fc-', '').replace('2-', ''));
      });

      mismatches.push({
        name: entity.name,
        lookingFor: badgeFilename,
        similarInS3: similar.length > 0 ? similar : null
      });
    }
  }

  console.log('✅ Badges that match:', matches.length);
  console.log('❌ Badges that DON\'T match:', mismatches.length);
  console.log('');

  if (mismatches.length > 0) {
    console.log('📋 Mismatches (first 20):');
    mismatches.slice(0, 20).forEach(m => {
      if (m.similarInS3) {
        console.log(`  ⚠️  ${m.name}`);
        console.log(`     Looking for: ${m.lookingFor}`);
        console.log(`     Similar in S3: ${m.similarInS3.join(', ')}`);
      } else {
        console.log(`  ❌ ${m.name}`);
        console.log(`     Looking for: ${m.lookingFor}`);
        console.log(`     No similar badge found in S3`);
      }
      console.log('');
    });
  }
}

checkBadgeMismatches().catch(console.error);
