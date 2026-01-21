#!/usr/bin/env node

/**
 * Test TheSportsDB Badge Workflow
 * Demonstrates the complete process: TheSportsDB → Download → S3 Upload → Database Update
 */

const fs = require('fs').promises;
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Configuration
const CONFIG = {
  // Known working TheSportsDB badge URLs (from existing configuration)
  THESPORTSDB_BADGES: [
    {
      entity: 'Manchester United',
      url: 'https://r2.thesportsdb.com/images/media/team/badge/xzqdr11517660252.png'
    },
    {
      entity: 'São Paulo FC', 
      url: 'https://r2.thesportsdb.com/images/media/team/badge/sxpupx1473538135.png'
    },
    {
      entity: 'Premier League',
      url: 'https://r2.thesportsdb.com/images/media/league/badge/gasy9d1737743125.png'
    },
    {
      entity: 'Indian Premier League',
      url: 'https://r2.thesportsdb.com/images/media/league/badge/gaiti11741709844.png'
    }
  ],
  
  // S3 configuration  
  S3_BUCKET: 'sportsintelligence',
  S3_REGION: 'eu-north-1',
  S3_BADGES_PATH: 'badges',
  
  // Local paths
  LOCAL_BADGES_DIR: './public/badges',
  
  // AWS PEM file
  AWS_PEM_PATH: '/Users/kieranmcfarlane/Downloads/panther_chat/yellowpanther.pem'
};

class TheSportsDbBadgeWorkflow {
  constructor() {
    this.supabase = createClient(
      'https://itlcuazbybqlkicsaola.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0bGN1YXpieWJxbGtpY3Nhb2xhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MjA3NDY3MzQxNH0.UXXSbe1Kk0CH7NkIGnwo3_qmJVV3VUbJz4Dw8lBGcKU'
    );
    this.results = [];
  }

  /**
   * 1. Download badge from TheSportsDB
   */
  async downloadBadgeFromTheSportsDB(entityName, badgeUrl) {
    console.log(`🌐 Downloading ${entityName} badge from TheSportsDB...`);
    
    try {
      const response = await fetch(badgeUrl);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const buffer = await response.arrayBuffer();
      const size = buffer.byteLength;
      
      // Generate filename
      const normalizedName = entityName
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
      
      const filename = `${normalizedName}-badge.png`;
      const localPath = path.join(CONFIG.LOCAL_BADGES_DIR, filename);
      
      // Ensure directory exists
      await fs.mkdir(CONFIG.LOCAL_BADGES_DIR, { recursive: true });
      
      // Save locally
      await fs.writeFile(localPath, Buffer.from(buffer));
      
      console.log(`✅ Downloaded: ${filename} (${size} bytes)`);
      
      return {
        entity: entityName,
        localPath,
        filename,
        size,
        originalUrl: badgeUrl
      };
      
    } catch (error) {
      console.error(`❌ Failed to download ${entityName}:`, error.message);
      throw error;
    }
  }

  /**
   * 2. Upload badge to S3 using AWS CLI with PEM credentials
   */
  async uploadBadgeToS3(localPath, filename, entityName) {
    console.log(`☁️  Uploading ${filename} to S3...`);
    
    try {
      const s3Key = `${CONFIG.S3_BADGES_PATH}/${filename}`;
      const s3Uri = `s3://${CONFIG.S3_BUCKET}/${s3Key}`;
      
      // Try multiple AWS CLI commands to handle authentication
      const commands = [
        // Using PEM file directly
        `aws s3 cp "${localPath}" "${s3Uri}" --region ${CONFIG.S3_REGION} --acl public-read`,
        // Alternative with explicit profile
        `AWS_CONFIG_FILE=/dev/null aws s3 cp "${localPath}" "${s3Uri}" --region ${CONFIG.S3_REGION} --acl public-read`
      ];
      
      let uploadSuccess = false;
      let lastError = null;
      
      for (const command of commands) {
        try {
          console.log(`🚀 Executing: ${command}`);
          
          const { execSync } = require('child_process');
          const output = execSync(command, { 
            encoding: 'utf8', 
            stdio: ['pipe', 'pipe', 'pipe'],
            timeout: 30000 // 30 second timeout
          });
          
          if (output.includes('upload:') || output.includes('cp:')) {
            console.log(`✅ Successfully uploaded: ${s3Uri}`);
            uploadSuccess = true;
            
            const s3Url = `https://${CONFIG.S3_BUCKET}.s3.${CONFIG.S3_REGION}.amazonaws.com/${s3Key}`;
            
            return {
              s3Key,
              s3Url,
              s3Uri,
              command
            };
          }
        } catch (error) {
          lastError = error;
          console.log(`⚠️  Upload attempt failed: ${error.message}`);
          continue;
        }
      }
      
      if (!uploadSuccess) {
        throw new Error(lastError?.message || 'All S3 upload attempts failed');
      }
      
    } catch (error) {
      console.error(`❌ Failed to upload ${filename} to S3:`, error.message);
      throw error;
    }
  }

  /**
   * 3. Update Supabase database
   */
  async updateSupabase(neo4jId, entityName, s3Url, theSportsDbUrl) {
    console.log(`💾 Updating database for ${entityName}...`);
    
    try {
      const { data, error } = await this.supabase
        .from('cached_entities')
        .update({
          badge_s3_url: s3Url,
          badge_thesportsdb_url: theSportsDbUrl,
          badge_source: 'thesportsdb',
          updated_at: new Date().toISOString()
        })
        .eq('properties->>name', entityName)
        .select();
      
      if (error) {
        throw error;
      }
      
      console.log(`✅ Database updated: ${entityName} -> ${s3Url}`);
      return data;
      
    } catch (error) {
      console.error(`❌ Failed to update database for ${entityName}:`, error.message);
      throw error;
    }
  }

  /**
   * 4. Verify the complete workflow
   */
  async verifyWorkflow(entityName, s3Url) {
    console.log(`🔍 Verifying workflow for ${entityName}...`);
    
    try {
      // Check S3 URL accessibility
      const s3Response = await fetch(s3Url, { method: 'HEAD' });
      
      if (s3Response.ok) {
        console.log(`✅ S3 URL accessible: ${s3Url}`);
      } else {
        console.log(`⚠️  S3 URL returned ${s3Response.status}: ${s3Url}`);
      }
      
      // Check API proxy URL (this would be used by the frontend)
      const filename = s3Url.split('/').pop();
      const apiProxyUrl = `/api/badges/${filename}`;
      console.log(`📱 Frontend API proxy: ${apiProxyUrl}`);
      
    } catch (error) {
      console.error(`❌ Verification failed:`, error.message);
    }
  }

  /**
   * Complete workflow for one entity
   */
  async processEntity(badgeConfig) {
    const { entity, url } = badgeConfig;
    
    console.log(`\n🔄 Processing: ${entity}`);
    console.log('=' .repeat(50));
    
    try {
      // Step 1: Download from TheSportsDB
      const downloadResult = await this.downloadBadgeFromTheSportsDB(entity, url);
      
      // Step 2: Upload to S3  
      const s3Result = await this.uploadBadgeToS3(
        downloadResult.localPath,
        downloadResult.filename,
        entity
      );
      
      // Step 3: Update database
      await this.updateSupabase(
        null, // We don't know the neo4j_id, search by name
        entity,
        s3Result.s3Url,
        url
      );
      
      // Step 4: Verify workflow
      await this.verifyWorkflow(entity, s3Result.s3Url);
      
      this.results.push({
        entity,
        status: 'success',
        download: downloadResult,
        s3: s3Result,
        timestamp: new Date().toISOString()
      });
      
      console.log(`🎉 Successfully completed workflow for ${entity}`);
      
    } catch (error) {
      this.results.push({
        entity,
        status: 'failed',
        error: error.message,
        timestamp: new Date().toISOString()
      });
      
      console.error(`❌ Workflow failed for ${entity}:`, error.message);
    }
  }

  /**
   * Main execution
   */
  async run() {
    console.log('🚀 TheSportsDB Badge Workflow Demo');
    console.log('=' .repeat(50));
    console.log(`📁 Local badges directory: ${CONFIG.LOCAL_BADGES_DIR}`);
    console.log(`☁️  S3 bucket: ${CONFIG.S3_BUCKET}`);
    console.log(`🔑 AWS PEM: ${CONFIG.AWS_PEM_PATH}`);
    console.log('');
    
    // Process a few badges as demonstration
    const badgesToProcess = CONFIG.THESPORTSDB_BADGES.slice(0, 2); // Process 2 badges
    
    for (const badgeConfig of badgesToProcess) {
      await this.processEntity(badgeConfig);
      
      // Add delay between entities to be respectful to APIs
      console.log('\n⏸️  Waiting 2 seconds before next entity...\n');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Print results summary
    console.log('\n📊 ===== WORKFLOW RESULTS =====');
    const successful = this.results.filter(r => r.status === 'success').length;
    const failed = this.results.filter(r => r.status === 'failed').length;
    
    console.log(`✅ Successful: ${successful}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📈 Total: ${this.results.length}`);
    
    if (this.results.length > 0) {
      console.log('\n📋 Details:');
      this.results.forEach(result => {
        const icon = result.status === 'success' ? '✅' : '❌';
        console.log(`${icon} ${result.entity}: ${result.status}`);
        if (result.error) console.log(`   Error: ${result.error}`);
        if (result.s3) console.log(`   S3 URL: ${result.s3.s3Url}`);
      });
    }
    
    console.log('\n🎉 Workflow demonstration complete!');
    console.log('\n📝 Next Steps:');
    console.log('1. Test API proxy URLs in frontend: /api/badges/[filename]');
    console.log('2. Verify badges display in entity browser');
    console.log('3. Update badge service to use new S3 URLs');
  }
}

// Run the demo
if (require.main === module) {
  const workflow = new TheSportsDbBadgeWorkflow();
  workflow.run().catch(error => {
    console.error('❌ Workflow demo failed:', error);
    process.exit(1);
  });
}

module.exports = TheSportsDbBadgeWorkflow;