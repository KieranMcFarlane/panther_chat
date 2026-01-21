#!/usr/bin/env node

/**
 * Complete Badge Manager Workflow with TheSportsDB Integration
 * 
 * This script implements the full badge workflow:
 * 1. Query Neo4j for entities without badges
 * 2. Fetch badge URLs from TheSportsDB API
 * 3. Download badge images from TheSportsDB
 * 4. Upload badges to S3 using AWS credentials
 * 5. Update Supabase with S3 URLs
 * 
 * Usage: node complete-badge-workflow.js [--entity-id ID] [--entity-name NAME] [--dry-run]
 */

// Load environment variables
require('dotenv').config();

const fs = require('fs').promises;
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

// Debug environment variables
console.log('🔧 Environment check:');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'NOT SET');
console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'NOT SET');
console.log('AWS_ACCESS_KEY_ID:', process.env.AWS_ACCESS_KEY_ID ? 'SET' : 'NOT SET');
console.log('AWS_SECRET_ACCESS_KEY:', process.env.AWS_SECRET_ACCESS_KEY ? 'SET' : 'NOT SET');
console.log('AWS_REGION:', process.env.AWS_REGION || 'eu-north-1');

// Configuration
const CONFIG = {
  // TheSportsDB API - using free tier (no key required for basic search)
  THESPORTSDB_API_BASE: 'https://www.thesportsdb.com/api/v1/json/3',
  
  // Supabase configuration - use environment variables
  SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://itlcuazbybqlkicsaola.supabase.co',
  SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0bGN1YXpieWJxbGtpY3Nhb2xhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkwOTc0MTQsImV4cCI6MjA3NDY3MzQxNH0.UXXSbe1Kk0CH7NkIGnwo3_qmJVV3VUbJz4Dw8lBGcKU',
  
  // S3 configuration
  S3_BUCKET: 'sportsintelligence',
  S3_REGION: 'eu-north-1',
  S3_BADGES_PATH: 'badges',
  
  // Local paths
  LOCAL_BADGES_DIR: './public/badges',
  
  // Badge sources priority
  BADGE_SOURCES: [
    'https://r2.thesportsdb.com/images/media/team/badge/',
    'https://r2.thesportsdb.com/images/media/league/badge/',
    'https://r2.thesportsdb.com/images/media/event/badge/',
    'https://r2.thesportsdb.com/images/media/organization/badge/'
  ]
};

class CompleteBadgeWorkflow {
  constructor() {
    this.supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
    this.results = {
      processed: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      details: []
    };
  }

  /**
   * 1. Query Neo4j for entities that need badges
   */
  async getEntitiesNeedingBadges(entityId = null, entityName = null) {
    console.log('🔍 Step 1: Querying entities that need badges...');
    
    let query = `
      SELECT neo4j_id, properties->>'name' as name, properties as entity_data
      FROM cached_entities 
      WHERE badge_s3_url IS NULL 
      AND properties->>'name' IS NOT NULL
    `;
    
    const params = [];
    
    if (entityId) {
      query += ` AND neo4j_id = $1`;
      params.push(entityId);
    } else if (entityName) {
      query += ` AND properties->>'name' ILIKE $1`;
      params.push(`%${entityName}%`);
    }
    
    query += ` ORDER BY properties->>'name' LIMIT 20`;
    
    try {
      const { data, error } = await this.supabase.rpc('execute_sql', {
        sql_query: query,
        params: params
      });
      
      if (error) {
        // Fallback to direct query if RPC not available
        console.log('⚠️  RPC not available, trying direct query...');
        let fallbackQuery = this.supabase
          .from('cached_entities')
          .select('neo4j_id, properties')
          .is('badge_s3_url', null)
          .not('properties', 'is', null);
      
      // Add entity name filter if specified
      if (entityName) {
        // Since Supabase JS client doesn't support JSON operators well,
        // we'll filter after getting the data
        console.log(`🔍 Will filter for entities containing "${entityName}"`);
      }
      
      // If searching for specific entity, get more records to find it
      const limit = entityName ? 200 : 50;
      const { data: fallbackData, error: fallbackError } = await fallbackQuery.limit(limit);
        
        if (fallbackError) throw fallbackError;
        
        // Filter by entity name if specified
        let filteredData = fallbackData;
        if (entityName && fallbackData) {
          filteredData = fallbackData.filter(entity => 
            entity.properties?.name && 
            entity.properties.name.toLowerCase().includes(entityName.toLowerCase())
          );
        }
        
        console.log(`✅ Found ${filteredData.length} entities needing badges${entityName ? ` matching "${entityName}"` : ''}`);
        return filteredData || [];
      }
      
      console.log(`✅ Found ${data.length} entities needing badges`);
      return data;
    } catch (error) {
      console.error('❌ Failed to query entities:', error.message);
      throw error;
    }
  }

  /**
   * 2. Fetch badge URL from TheSportsDB API
   */
  async fetchBadgeFromTheSportsDB(entityName) {
    console.log(`🌐 Step 2: Fetching TheSportsDB badge for "${entityName}"`);
    
    try {
      // Create normalized search variations
      const searchVariations = this.createSearchVariations(entityName);
      console.log(`🔄 Will try ${searchVariations.length} search variations:`, searchVariations);
      
      // Try each search variation
      for (const searchTerm of searchVariations) {
        console.log(`\n🔍 Trying search term: "${searchTerm}"`);
        
        // Try team search first
        const teamResult = await this.searchTeams(searchTerm);
        if (teamResult) {
          console.log(`✅ Found team badge for "${searchTerm}"`);
          return teamResult;
        }
        
        // Try league search with multiple methods
        const leagueResult = await this.searchLeagues(searchTerm);
        if (leagueResult) {
          console.log(`✅ Found league badge for "${searchTerm}"`);
          return leagueResult;
        }
        
        // Try ID-based lookup for known entities
        const idResult = await this.searchById(searchTerm);
        if (idResult) {
          console.log(`✅ Found badge via ID lookup for "${searchTerm}"`);
          return idResult;
        }
      }
      
      console.log(`⚠️  No badge found for "${entityName}" after trying all variations`);
      return null;
      
    } catch (error) {
      console.error(`❌ Error searching TheSportsDB for "${entityName}":`, error.message);
      return null;
    }
  }

  /**
   * Create normalized search variations for better entity matching
   */
  createSearchVariations(entityName) {
    const variations = [entityName];
    
    // Remove common suffixes and prefixes
    let cleaned = entityName
      .replace(/\s+\([^)]*\)$/, '') // Remove parentheses content
      .replace(/\s+(json_seed|FC|CF|SC|AC|United|City|Racing|Team|Club)$/, '') // Remove common suffixes
      .replace(/^(FC|SC|AC)\s+/, '') // Remove common prefixes
      .replace(/\s+(?:of|for|the|and|&)\s+/g, ' ') // Normalize connecting words
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim();
    
    if (cleaned && cleaned !== entityName) {
      variations.push(cleaned);
    }
    
    // Add keyword-based search variations
    const keywordVariations = this.createKeywordVariations(entityName);
    variations.push(...keywordVariations);
    
    // Special case mappings for known entities
    const specialCases = {
      'CONCACAF (Confederation of North, Central America and Caribbean Association Football) (json_seed)': 
        ['CONCACAF', 'CONCACAF Champions Cup', 'Confederation of North Central America and Caribbean Association Football'],
      'Bundesliga (json_seed)': ['Bundesliga', 'German Bundesliga'],
      'Chinese Football Association (CFA) (json_seed)': ['Chinese Football Association', 'CFA'],
      'British Swimming (json_seed)': ['British Swimming', 'Swimming'],
      'British Olympic Association (Team GB)': ['British Olympic Association', 'Team GB', 'Great Britain Olympic'],
      'Counter-Strike Esports (Majors & S-Tier Events) (json_seed)': ['Counter-Strike', 'ESL', 'ESL Pro League'],
      'Cádiz CF': ['Cádiz', 'Cadiz'],
      'Dakar Rally': ['Dakar Rally', 'Rally Dakar']
    };
    
    if (specialCases[entityName]) {
      variations.push(...specialCases[entityName]);
    }
    
    // Remove duplicates and empty strings
    return [...new Set(variations.filter(v => v && v.trim().length > 0))];
  }

  /**
   * Create keyword-based search variations for fuzzy matching
   */
  createKeywordVariations(entityName) {
    const variations = [];
    
    // Extract meaningful words (3+ characters)
    const words = entityName
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove non-word characters from start
      .replace(/\s+(?:of|for|the|and|&|in|on|at|de|la|el|di|du|da|del|dell|von|van|der|le|la)\s+/g, ' ') // Remove common prepositions in multiple languages
      .split(/\s+/)
      .filter(word => word.length >= 3); // Only keep words 3+ chars
    
    // Create single word searches
    for (const word of words) {
      variations.push(word);
    }
    
    // Create 2-word combinations
    for (let i = 0; i < words.length - 1; i++) {
      variations.push(`${words[i]} ${words[i + 1]}`);
    }
    
    // Return all keyword variations
    return variations;
  }

  /**
   * Search for teams by name
   */
  async searchTeams(searchTerm) {
    const teamSearchUrl = `${CONFIG.THESPORTSDB_API_BASE}/searchteams.php?t=${encodeURIComponent(searchTerm)}`;
    console.log(`   🏟️  Searching teams: ${teamSearchUrl}`);
    
    try {
      const teamResponse = await this.fetchWithTimeout(teamSearchUrl, 10000);
      
      if (teamResponse.ok) {
        const teamData = await teamResponse.json();
        
        if (teamData.teams && teamData.teams.length > 0) {
          const team = teamData.teams[0];
          const badgeUrl = team.strBadge;
          
          if (badgeUrl) {
            return {
              type: 'team',
              url: badgeUrl,
              entityName: team.strTeam,
              entityData: team
            };
          }
        }
      }
    } catch (error) {
      console.log(`   ⚠️  Team search failed for "${searchTerm}": ${error.message}`);
    }
    
    return null;
  }

  /**
   * Search for leagues by name with multiple endpoints
   */
  async searchLeagues(searchTerm) {
    const endpoints = [
      `${CONFIG.THESPORTSDB_API_BASE}/search_all_leagues.php?l=${encodeURIComponent(searchTerm)}`,
      `${CONFIG.THESPORTSDB_API_BASE}/searchleagues.php?l=${encodeURIComponent(searchTerm)}`,
      `${CONFIG.THESPORTSDB_API_BASE}/searchleague.php?l=${encodeURIComponent(searchTerm)}`
    ];
    
    for (const endpoint of endpoints) {
      console.log(`   🏆 Searching leagues: ${endpoint}`);
      
      try {
        const response = await this.fetchWithTimeout(endpoint, 10000);
        
        if (response.ok) {
          const data = await response.json();
          
          // Handle different response structures
          let leagues = null;
          if (data.leagues) leagues = data.leagues;
          else if (data.countrys) leagues = data.countrys;
          else if (Array.isArray(data)) leagues = data;
          
          if (leagues && leagues.length > 0 && leagues[0] !== null) {
            const league = leagues[0];
            const badgeUrl = league.strBadge;
            
            if (badgeUrl) {
              return {
                type: 'league',
                url: badgeUrl,
                entityName: league.strLeague || league.strLeagueAlternate || league.strCountry,
                entityData: league
              };
            }
          }
        }
      } catch (error) {
        console.log(`   ⚠️  League search failed for "${searchTerm}": ${error.message}`);
      }
    }
    
    return null;
  }

  /**
   * Search by ID for known entities
   */
  async searchById(searchTerm) {
    // Known entity IDs based on our testing
    const knownEntities = {
      'CONCACAF': 4721,
      'CONCACAF Champions Cup': 4721,
      'Dakar Rally': 4447,
      'Bundesliga': 4331,
      'German Bundesliga': 4331,
      'Indian Premier League': 4460,
      'Australian Football League': 4456
    };
    
    for (const [entity, id] of Object.entries(knownEntities)) {
      if (searchTerm.toLowerCase().includes(entity.toLowerCase()) || 
          entity.toLowerCase().includes(searchTerm.toLowerCase())) {
        
        const idUrl = `${CONFIG.THESPORTSDB_API_BASE}/lookupleague.php?id=${id}`;
        console.log(`   🎯 Searching by ID (${id}): ${idUrl}`);
        
        try {
          const idResponse = await this.fetchWithTimeout(idUrl, 10000);
          
          if (idResponse.ok) {
            const idData = await idResponse.json();
            
            if (idData.leagues && idData.leagues.length > 0) {
              const league = idData.leagues[0];
              const badgeUrl = league.strBadge;
              
              if (badgeUrl) {
                return {
                  type: 'league',
                  url: badgeUrl,
                  entityName: league.strLeague,
                  entityData: league,
                  source: 'id-lookup'
                };
              }
            }
          }
        } catch (error) {
          console.log(`   ⚠️  ID lookup failed: ${error.message}`);
        }
      }
    }
    
    return null;
  }

  /**
   * 3. Download badge image from TheSportsDB
   */
  async downloadBadgeFromTheSportsDB(badgeUrl, entityName) {
    console.log(`⬇️  Step 3: Downloading badge for "${entityName}"`);
    
    try {
      const response = await this.fetchWithTimeout(badgeUrl, 15000);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const buffer = await response.arrayBuffer();
      const size = buffer.byteLength;
      
      // Validate image size (should be reasonable for a badge)
      if (size > 5 * 1024 * 1024) { // 5MB limit
        throw new Error(`Badge image too large: ${size} bytes`);
      }
      
      if (size < 1000) { // 1KB minimum
        console.warn(`⚠️  Badge image very small: ${size} bytes`);
      }
      
      // Generate local filename
      const normalizedName = this.normalizeEntityName(entityName);
      const filename = `${normalizedName}-badge.png`;
      const localPath = path.join(CONFIG.LOCAL_BADGES_DIR, filename);
      
      // Ensure badges directory exists
      await fs.mkdir(CONFIG.LOCAL_BADGES_DIR, { recursive: true });
      
      // Save to local file
      await fs.writeFile(localPath, Buffer.from(buffer));
      
      console.log(`✅ Downloaded badge: ${filename} (${size} bytes)`);
      return {
        localPath,
        filename,
        size,
        url: badgeUrl
      };
      
    } catch (error) {
      console.error(`❌ Failed to download badge for "${entityName}":`, error.message);
      throw error;
    }
  }

  /**
   * 4. Upload badge to S3
   */
  async uploadBadgeToS3(localPath, filename, entityName) {
    console.log(`☁️  Step 4: Uploading "${filename}" to S3`);
    
    try {
      // Initialize S3 client
      const s3Client = new S3Client({
        region: CONFIG.S3_REGION,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        }
      });
      
      const s3Key = `${CONFIG.S3_BADGES_PATH}/${filename}`;
      
      // Read file content
      const fileContent = await fs.readFile(localPath);
      
      // Upload to S3
      const command = new PutObjectCommand({
        Bucket: CONFIG.S3_BUCKET,
        Key: s3Key,
        Body: fileContent,
        ContentType: 'image/png',
        CacheControl: 'public, max-age=31536000', // Cache for 1 year
        Metadata: {
          'entity-name': entityName,
          'source': 'thesportsdb-badge-workflow'
        }
      });
      
      console.log(`🚀 Uploading to S3: s3://${CONFIG.S3_BUCKET}/${s3Key}`);
      
      const result = await s3Client.send(command);
      
      if (result.$metadata.httpStatusCode === 200) {
        console.log(`✅ Uploaded to S3: s3://${CONFIG.S3_BUCKET}/${s3Key}`);
        
        const s3Url = `https://${CONFIG.S3_BUCKET}.s3.${CONFIG.S3_REGION}.amazonaws.com/${s3Key}`;
        
        return {
          s3Key,
          s3Url,
          etag: result.ETag
        };
      } else {
        throw new Error(`S3 upload failed with status: ${result.$metadata.httpStatusCode}`);
      }
      
    } catch (error) {
      console.error(`❌ Failed to upload "${filename}" to S3:`, error.message);
      
      // Check if it's a credentials issue
      if (error.message.includes('credentials') || error.name === 'CredentialsProviderError') {
        console.log(`💡 Tip: Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables`);
      }
      
      throw error;
    }
  }

  /**
   * 5. Update Supabase with S3 URL
   */
  async updateDatabaseWithS3Url(neo4jId, entityName, s3Url, theSportsDbUrl) {
    console.log(`💾 Step 5: Updating database for "${entityName}"`);
    
    try {
      const { data, error } = await this.supabase
        .from('cached_entities')
        .update({
          badge_s3_url: s3Url,
          updated_at: new Date().toISOString()
        })
        .eq('neo4j_id', neo4jId)
        .select();
      
      if (error) {
        throw error;
      }
      
      console.log(`✅ Updated database: ${entityName} -> ${s3Url}`);
      return data;
      
    } catch (error) {
      console.error(`❌ Failed to update database for "${entityName}":`, error.message);
      throw error;
    }
  }

  /**
   * Main workflow process for a single entity
   */
  async processEntity(entity) {
    const { neo4j_id, properties } = entity;
    const name = properties?.name || 'Unknown Entity';
    const entity_data = properties;
    
    console.log(`\n🔄 Processing entity: ${name} (ID: ${neo4j_id})`);
    
    try {
      this.results.processed++;
      
      // Step 2: Fetch from TheSportsDB
      const theSportsDbData = await this.fetchBadgeFromTheSportsDB(name);
      
      if (!theSportsDbData) {
        console.log(`⏭️  Skipping ${name} - no TheSportsDB badge found`);
        this.results.skipped++;
        this.results.details.push({
          entity: name,
          status: 'skipped',
          reason: 'No TheSportsDB badge found'
        });
        return;
      }
      
      // Step 3: Download from TheSportsDB
      const downloadResult = await this.downloadBadgeFromTheSportsDB(
        theSportsDbData.url, 
        theSportsDbData.entityName
      );
      
      // Step 4: Upload to S3 (if AWS CLI is available)
      let s3Result = null;
      try {
        s3Result = await this.uploadBadgeToS3(
          downloadResult.localPath,
          downloadResult.filename,
          name
        );
      } catch (s3Error) {
        console.log(`⚠️  S3 upload failed, using local fallback: ${s3Error.message}`);
        s3Result = {
          s3Url: `/badges/${downloadResult.filename}`,
          localOnly: true
        };
      }
      
      // Step 5: Update database
      await this.updateDatabaseWithS3Url(
        neo4j_id,
        name,
        s3Result.s3Url,
        theSportsDbData.url
      );
      
      this.results.successful++;
      this.results.details.push({
        entity: name,
        status: 'success',
        theSportsDbUrl: theSportsDbData.url,
        localPath: downloadResult.localPath,
        s3Url: s3Result.s3Url,
        s3LocalOnly: s3Result.localOnly || false
      });
      
      console.log(`🎉 Successfully processed: ${name}`);
      
    } catch (error) {
      this.results.failed++;
      this.results.details.push({
        entity: name,
        status: 'failed',
        error: error.message
      });
      
      console.error(`❌ Failed to process ${name}:`, error.message);
    }
  }

  /**
   * Utility functions
   */
  normalizeEntityName(entityName) {
    return entityName
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  async fetchWithTimeout(url, timeout = 10000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; BadgeManager/1.0)'
        }
      });
      
      clearTimeout(timeoutId);
      return response;
      
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${timeout}ms`);
      }
      
      throw error;
    }
  }

  /**
   * Print final results
   */
  printResults() {
    console.log('\n📊 ===== WORKFLOW RESULTS =====');
    console.log(`📈 Processed: ${this.results.processed}`);
    console.log(`✅ Successful: ${this.results.successful}`);
    console.log(`❌ Failed: ${this.results.failed}`);
    console.log(`⏭️  Skipped: ${this.results.skipped}`);
    
    if (this.results.details.length > 0) {
      console.log('\n📋 Details:');
      this.results.details.forEach(detail => {
        const icon = detail.status === 'success' ? '✅' : 
                    detail.status === 'skipped' ? '⏭️' : '❌';
        console.log(`${icon} ${detail.entity}: ${detail.status}`);
        if (detail.error) console.log(`   Error: ${detail.error}`);
        if (detail.theSportsDbUrl) console.log(`   TheSportsDB: ${detail.theSportsDbUrl}`);
        if (detail.s3Url) console.log(`   S3 URL: ${detail.s3Url}`);
      });
    }
    
    console.log('\n🎉 Workflow complete!');
  }

  /**
   * Main execution
   */
  async run(options = {}) {
    const { entityId, entityName, dryRun = false } = options;
    
    console.log('🚀 Starting Complete Badge Workflow');
    console.log(`📝 Options: ${JSON.stringify(options, null, 2)}`);
    
    try {
      // Step 1: Get entities needing badges
      const entities = await this.getEntitiesNeedingBadges(entityId, entityName);
      
      if (entities.length === 0) {
        console.log('📝 No entities found needing badges');
        return;
      }
      
      console.log(`\n📝 Found ${entities.length} entities to process`);
      
      if (dryRun) {
        console.log('🔍 DRY RUN - Would process these entities:');
        entities.forEach(entity => {
          const name = entity.properties?.name || entity.name || 'Unknown Entity';
          console.log(`  - ${name} (ID: ${entity.neo4j_id})`);
        });
        return;
      }
      
      // Process each entity
      for (const entity of entities) {
        await this.processEntity(entity);
        
        // Add delay to be respectful to APIs
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
    } catch (error) {
      console.error('❌ Workflow failed:', error.message);
      throw error;
    } finally {
      this.printResults();
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const options = {};
  
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--entity-id':
        options.entityId = args[++i];
        break;
      case '--entity-name':
        options.entityName = args[++i];
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--help':
        console.log(`
Complete Badge Workflow - TheSportsDB Integration

Usage: node complete-badge-workflow.js [options]

Options:
  --entity-id ID     Process specific entity ID
  --entity-name NAME  Process entities matching this name
  --dry-run          Show what would be processed without executing
  --help             Show this help message

Examples:
  node complete-badge-workflow.js                           # Process up to 20 entities
  node complete-badge-workflow.js --entity-name Arsenal     # Process Arsenal only
  node complete-badge-workflow.js --entity-id 139           # Process Manchester United
  node complete-badge-workflow.js --dry-run                 # Preview what would be processed
        `);
        return;
      default:
        console.error(`Unknown argument: ${args[i]}`);
        console.log('Use --help for usage information');
        process.exit(1);
    }
  }
  
  const workflow = new CompleteBadgeWorkflow();
  await workflow.run(options);
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
  });
}

module.exports = CompleteBadgeWorkflow;