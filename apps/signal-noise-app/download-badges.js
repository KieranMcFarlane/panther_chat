#!/usr/bin/env node

/**
 * Download all badges from S3 to local public/badges directory
 */

// Load environment variables from .env file
require('dotenv').config();

const { S3Client, ListObjectsV2Command, GetObjectCommand } = require('@aws-sdk/client-s3');
const { writeFileSync, mkdirSync } = require('fs');
const { join } = require('path');
const { Readable } = require('stream');

// AWS Configuration
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'eu-north-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }
});

const bucketName = process.env.S3_BUCKET || 'sportsintelligence';
const badgePrefix = 'badges/';
const localDir = join(process.cwd(), 'public', 'badges');

async function downloadBadge(key) {
  try {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    const response = await s3Client.send(command);

    if (!response.Body) {
      console.error(`⚠️  Empty body for ${key}`);
      return false;
    }

    // Convert stream to buffer
    const buffer = await streamToBuffer(response.Body);

    // Extract filename from key
    const filename = key.split('/').pop();
    const localPath = join(localDir, filename);

    // Write to file
    writeFileSync(localPath, buffer);

    return true;
  } catch (error) {
    if (error.name === 'NoSuchKey') {
      console.log(`  ⚠️  Key not found: ${key}`);
    } else {
      console.error(`  ❌ Error downloading ${key}:`, error.message);
    }
    return false;
  }
}

function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

async function listBadges() {
  let allBadges = [];
  let continuationToken = null;

  do {
    const command = new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: badgePrefix,
      ContinuationToken: continuationToken,
    });

    const response = await s3Client.send(command);

    if (response.Contents) {
      allBadges = allBadges.concat(response.Contents.map(obj => obj.Key));
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return allBadges;
}

async function main() {
  console.log('🎯 Starting badge download from S3...');
  console.log(`📁 Bucket: ${bucketName}`);
  console.log(`📂 Prefix: ${badgePrefix}`);
  console.log(`💾 Local directory: ${localDir}`);
  console.log('');

  // Ensure local directory exists
  mkdirSync(localDir, { recursive: true });

  try {
    // List all badges
    console.log('📋 Listing all badges in S3...');
    const badges = await listBadges();
    console.log(`✅ Found ${badges.length} badges`);
    console.log('');

    // Download each badge
    console.log('⬇️  Downloading badges...');
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < badges.length; i++) {
      const badge = badges[i];
      const filename = badge.split('/').pop();

      process.stdout.write(`  [${i + 1}/${badges.length}] ${filename}... `);

      const success = await downloadBadge(badge);

      if (success) {
        console.log('✅');
        successCount++;
      } else {
        console.log('❌');
        failCount++;
      }

      // Add small delay to avoid rate limiting
      if (i < badges.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log('');
    console.log('📊 Summary:');
    console.log(`  ✅ Successfully downloaded: ${successCount}`);
    console.log(`  ❌ Failed: ${failCount}`);
    console.log(`  📁 Total: ${badges.length}`);
    console.log('');
    console.log('✅ Badge download complete!');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
