#!/usr/bin/env node

/**
 * Improved Badge Manager Workflow with Enhanced Entity Name Matching
 *
 * Based on analysis of entity name patterns, this implements:
 * 1. Better entity name normalization
 * 2. Smart search variation generation
 * 3. Entity type prioritization
 * 4. Manual mapping for known entities
 * 5. Alternative badge sources
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs').promises;
const path = require('path');

// Import original workflow class
const CompleteBadgeWorkflow = require('./complete-badge-workflow.js');

class ImprovedBadgeWorkflow extends CompleteBadgeWorkflow {
  constructor() {
    super();

    // Entity mapping for known problematic entities
    this.entityMappings = {
      'Crystal Palace': {
        theSportsDBSearch: 'Crystal Palace',
        type: 'team',
        confidence: 0.95
      },
      'Corinthians': {
        theSportsDBSearch: 'Corinthians',
        type: 'team',
        confidence: 0.95
      },
      'Lazio': {
        theSportsDBSearch: 'Lazio',
        type: 'team',
        confidence: 0.95
      },
      'Al Shabab': {
        theSportsDBSearch: 'Al Shabab',
        type: 'team',
        confidence: 0.9
      },
      'LeBron James': {
        theSportsDBSearch: 'LeBron James',
        type: 'individual',
        confidence: 0.7
      }
    };

    // Football club name normalization patterns
    this.footballPatterns = {
      // Remove common prefixes
      prefixes: [
        /^(Al\s+|El\s+|The\s+)/i,
        /^(FC\s+|CF\s+|AC\s+|SC\s+)/i
      ],

      // Remove common suffixes
      suffixes: [
        /\s+(FC|CF|AC|SC)$/i,
        /\s+(United|City|Racing|Athletic|Sporting)$/i,
        /\s+(Club|Football|Soccer)$/i
      ],

      // Known club name variations
      variations: {
        'crystal palace': 'Crystal Palace',
        'corinthians': 'Corinthians',
        'lazio': 'Lazio',
        'al shabab': 'Al Shabab',
        'al ahly': 'Al Ahly',
        'real madrid': 'Real Madrid',
        'barcelona': 'Barcelona',
        'manchester united': 'Manchester United',
        'manchester city': 'Manchester City',
        'liverpool': 'Liverpool',
        'chelsea': 'Chelsea',
        'arsenal': 'Arsenal'
      }
    };

    // Entity type priority (focus on high-match categories first)
    this.priorityOrder = [
      'Football Clubs',      // 80%+ TheSportsDB coverage
      'Leagues',           // 70% TheSportsDB coverage
      'National Teams',     // 60% TheSportsDB coverage
      'Individuals',        // 40% TheSportsDB coverage
      'Other Sports'        // 20% TheSportsDB coverage
    ];
  }

  /**
   * Enhanced entity filtering and prioritization
   */
  async getPrioritizedEntities(entityId = null, entityName = null, limit = 20) {
    console.log('🎯 Step 1: Getting prioritized entities for badge processing...');

    try {
      // Get entities without badges
      const { data, error } = await this.supabase
        .from('cached_entities')
        .select('neo4j_id, properties')
        .is('badge_s3_url', null)
        .not('properties', 'is', null)
        .limit(100); // Get more to filter

      if (error) throw error;

      // Categorize and score entities
      const scoredEntities = data.map(entity => {
        const name = entity.properties?.name || entity.properties?.label || 'Unknown';
        const category = this.categorizeEntity(name);
        const score = this.calculateEntityScore(name, category);
        const issues = this.identifyNameIssues(name);

        return {
          ...entity,
          normalizedName: this.normalizeEntityName(name),
          category,
          score,
          issues,
          theSportsDBPotential: this.assessTheSportsDBPotential(name, category)
        };
      });

      // Filter out very low potential entities
      const filteredEntities = scoredEntities.filter(entity =>
        entity.theSportsDBPotential.score > 0.1 ||
        this.entityMappings[entity.properties?.name]
      );

      // Sort by priority and score
      filteredEntities.sort((a, b) => {
        // First by category priority
        const aPriority = this.priorityOrder.indexOf(a.category);
        const bPriority = this.priorityOrder.indexOf(b.category);

        if (aPriority !== bPriority) {
          return aPriority - bPriority;
        }

        // Then by TheSportsDB potential score
        return b.theSportsDBPotential.score - a.theSportsDBPotential.score;
      });

      // Apply entity name filter if specified
      let finalEntities = filteredEntities;
      if (entityName) {
        finalEntities = filteredEntities.filter(entity =>
          entity.properties?.name?.toLowerCase().includes(entityName.toLowerCase())
        );
      }

      // Apply ID filter if specified
      if (entityId) {
        finalEntities = filteredEntities.filter(entity =>
          entity.neo4j_id === entityId
        );
      }

      // Return top results
      const result = finalEntities.slice(0, limit);

      console.log(`✅ Found ${result.length} high-priority entities:`);
      result.forEach((entity, i) => {
        const status = entity.theSportsDBPotential.score > 0.5 ? '🟢' :
                      entity.theSportsDBPotential.score > 0.3 ? '🟡' : '🔴';
        console.log(`  ${i + 1}. ${status} ${entity.properties?.name} (${entity.category}) - Score: ${entity.theSportsDBPotential.score.toFixed(2)}`);
        if (entity.issues.length > 0) {
          console.log(`      ⚠️  Issues: ${entity.issues.join(', ')}`);
        }
      });

      return result;

    } catch (error) {
      console.error('❌ Failed to get prioritized entities:', error.message);
      throw error;
    }
  }

  /**
   * Enhanced entity categorization
   */
  categorizeEntity(name) {
    const lower = name.toLowerCase();

    // Football clubs indicators (enhanced)
    if (this.isFootballClub(lower, name)) {
      return 'Football Clubs';
    }

    // Leagues
    if (this.containsAny(lower, [
      'league', 'primera división', 'premier league', 'bundesliga',
      'serie a', 'serie a', 'liga', 'championship', 'division',
      'la liga', 'eredivisie', 'primeira liga'
    ])) {
      return 'Leagues';
    }

    // National teams/federations
    if (this.containsAny(lower, ['national team', 'federation', 'association',
        'confederation', 'union']) && this.containsAny(lower, ['football', 'soccer'])) {
      return 'National Teams';
    }

    // Other federations
    if (this.containsAny(lower, ['federation', 'association', 'confederation', 'union'])) {
      return 'Federations';
    }

    // Famous individuals
    if (this.isFamousPerson(name)) {
      return 'Individuals';
    }

    // Competitions
    if (this.containsAny(lower, ['championship', 'cup', 'tournament', 'world',
        'olympic', 'games', 'grand prix', 'rally'])) {
      return 'Competitions';
    }

    // Other sports
    if (this.containsAny(lower, ['basketball', 'baseball', 'volleyball', 'hockey',
        'rugby', 'cycling', 'swimming', 'tennis', 'karate', 'handball'])) {
      return 'Other Sports';
    }

    // System/Generated names
    if (this.containsAny(lower, ['entity', 'json_seed', 'system', 'api']) ||
        /^entity\s+\d+/i.test(name)) {
      return 'System Generated';
    }

    return 'Other';
  }

  /**
   * Enhanced football club detection
   */
  isFootballClub(lower, original) {
    // Known club patterns
    const knownPatterns = [
      /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s+FC)?$/,
      /^[A-Z][a-z]+\s+(?:United|City|Racing|Athletic|Sporting)$/,
      /^[A-Z][a-z]+\s+(?:FC|CF|AC|SC)$/,
      /^(?:Al\s+|El\s+)?[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:FC|CF|AC|SC)$/
    ];

    if (knownPatterns.some(pattern => pattern.test(original))) {
      return true;
    }

    // Known club names (case-insensitive)
    const knownClubs = [
      'crystal palace', 'corinthians', 'lazio', 'inter milan', 'ac milan',
      'real madrid', 'barcelona', 'manchester united', 'manchester city',
      'liverpool', 'chelsea', 'arsenal', 'tottenham', 'juventus',
      'bayern munich', 'psg', 'borussia dortmund', 'ajax', 'porto',
      'benfica', 'sporting cp', 'celtic', 'rangers'
    ];

    if (knownClubs.includes(lower)) {
      return true;
    }

    // Check for football club indicators
    const clubIndicators = ['fc', 'united', 'city', 'palace', 'racing', 'athletic', 'sporting'];
    if (clubIndicators.some(indicator => lower.includes(indicator))) {
      return true;
    }

    return false;
  }

  /**
   * Enhanced famous person detection
   */
  isFamousPerson(name) {
    const famousAthletes = [
      'LeBron James', 'Chris Murray', 'Lars H Jorgensen',
      'Lionel Messi', 'Cristiano Ronaldo', 'Neymar', 'Mbappé'
    ];

    return famousAthletes.includes(name);
  }

  /**
   * Calculate entity matching score
   */
  calculateEntityScore(name, category) {
    let score = 0;

    // Category base scores
    const categoryScores = {
      'Football Clubs': 0.9,
      'Leagues': 0.7,
      'National Teams': 0.6,
      'Individuals': 0.4,
      'Other Sports': 0.3,
      'Competitions': 0.3,
      'Federations': 0.1,
      'System Generated': 0.05
    };

    score = categoryScores[category] || 0.1;

    // Known entity mapping bonus
    if (this.entityMappings[name]) {
      score = Math.max(score, this.entityMappings[name].confidence);
    }

    // Name quality penalties
    if (name.includes('(')) score -= 0.1;
    if (/[^\w\s\-\.'&()]/.test(name)) score -= 0.1;
    if (/[áéíóúñüç]/.test(name)) score -= 0.1;
    if (name.length > 50) score -= 0.1;
    if (name.toLowerCase().includes('json_seed')) score -= 0.3;

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Enhanced TheSportsDB potential assessment
   */
  assessTheSportsDBPotential(name, category) {
    const lower = name.toLowerCase();
    let score = this.calculateEntityScore(name, category);
    const suggestions = [];

    // Specific entity mappings
    if (this.entityMappings[name]) {
      score = this.entityMappings[name].confidence;
      suggestions.push('Known entity mapping available');
    }

    // Football clubs - very high potential
    if (category === 'Football Clubs') {
      score = Math.max(score, 0.7);

      if (this.footballPatterns.variations[lower]) {
        score = 0.95;
        suggestions.push(`Use mapped name: "${this.footballPatterns.variations[lower]}"`);
      }
    }

    // Major leagues - high potential
    if (category === 'Leagues') {
      if (this.containsAny(lower, ['premier league', 'bundesliga', 'serie a', 'la liga'])) {
        score = 0.85;
        suggestions.push('Major football league - should be available');
      }
    }

    // Famous individuals - medium potential
    if (category === 'Individuals' && this.isFamousPerson(name)) {
      score = 0.6;
      suggestions.push('Famous athlete - might be available');
    }

    return {
      score: Math.max(0, Math.min(1, score)),
      suggestions
    };
  }

  /**
   * Enhanced entity name normalization
   */
  normalizeEntityName(name) {
    let normalized = name.trim();

    // Remove parentheses content
    normalized = normalized.replace(/\s*\([^)]*\)\s*/g, ' ').trim();

    // Remove system suffixes
    normalized = normalized.replace(/\s*\((json_seed|system|generated)\)\s*/gi, '').trim();

    // Handle common football club patterns
    if (this.isFootballClub(normalized.toLowerCase(), normalized)) {
      // Apply prefix/suffix patterns
      this.footballPatterns.prefixes.forEach(pattern => {
        normalized = normalized.replace(pattern, '');
      });

      this.footballPatterns.suffixes.forEach(pattern => {
        normalized = normalized.replace(pattern, '');
      });
    }

    // Normalize spacing and special characters
    normalized = normalized.replace(/\s+/g, ' ').trim();
    normalized = normalized.replace(/[^\w\s\-\.'&]/g, '');

    return normalized;
  }

  /**
   * Enhanced search variations based on analysis
   */
  createEnhancedSearchVariations(entityName) {
    const variations = new Set([entityName]);
    const lower = entityName.toLowerCase();

    // Add normalized version
    const normalized = this.normalizeEntityName(entityName);
    if (normalized && normalized !== entityName) {
      variations.add(normalized);
    }

    // Add known mappings
    if (this.footballPatterns.variations[lower]) {
      variations.add(this.footballPatterns.variations[lower]);
    }

    // Add entity mapping if available
    if (this.entityMappings[entityName]) {
      variations.add(this.entityMappings[entityName].theSportsDBSearch);
    }

    // Add football-specific variations
    if (this.isFootballClub(lower, entityName)) {
      // Remove common prefixes
      ['Al ', 'El ', 'The '].forEach(prefix => {
        if (entityName.startsWith(prefix)) {
          variations.add(entityName.substring(prefix.length));
        }
      });

      // Remove common suffixes
      [' FC', ' CF', ' AC', ' SC'].forEach(suffix => {
        if (entityName.endsWith(suffix)) {
          variations.add(entityName.substring(0, entityName.length - suffix.length).trim());
        }
      });
    }

    // Remove duplicates and filter
    return Array.from(variations).filter(v => v && v.trim().length > 2);
  }

  /**
   * Override the fetch method with enhanced search
   */
  async fetchBadgeFromTheSportsDB(entityName) {
    console.log(`🌐 Enhanced Step 2: Fetching TheSportsDB badge for "${entityName}"`);

    try {
      // Create enhanced search variations
      const searchVariations = this.createEnhancedSearchVariations(entityName);
      console.log(`🔄 Will try ${searchVariations.length} enhanced search variations:`, searchVariations);

      // Try each search variation with priority
      for (const searchTerm of searchVariations) {
        console.log(`\n🔍 Trying enhanced search term: "${searchTerm}"`);

        // Try team search first for football clubs
        const teamResult = await this.searchTeams(searchTerm);
        if (teamResult) {
          console.log(`✅ Found team badge for "${searchTerm}"`);
          return {
            ...teamResult,
            searchTerm,
            searchMethod: 'enhanced-team-search'
          };
        }

        // Try league search
        const leagueResult = await this.searchLeagues(searchTerm);
        if (leagueResult) {
          console.log(`✅ Found league badge for "${searchTerm}"`);
          return {
            ...leagueResult,
            searchTerm,
            searchMethod: 'enhanced-league-search'
          };
        }

        // Try ID-based lookup for known entities
        const idResult = await this.searchById(searchTerm);
        if (idResult) {
          console.log(`✅ Found badge via ID lookup for "${searchTerm}"`);
          return {
            ...idResult,
            searchTerm,
            searchMethod: 'enhanced-id-lookup'
          };
        }
      }

      console.log(`⚠️  No badge found for "${entityName}" after enhanced search`);
      return null;

    } catch (error) {
      console.error(`❌ Error in enhanced TheSportsDB search for "${entityName}":`, error.message);
      return null;
    }
  }

  /**
   * Enhanced main execution
   */
  async run(options = {}) {
    const { entityId, entityName, dryRun = false, limit = 20 } = options;

    console.log('🚀 Starting Improved Badge Workflow');
    console.log(`📝 Options: ${JSON.stringify(options, null, 2)}`);

    try {
      // Step 1: Get prioritized entities
      const entities = await this.getPrioritizedEntities(entityId, entityName, limit);

      if (entities.length === 0) {
        console.log('📝 No high-priority entities found for badge processing');
        return;
      }

      console.log(`\n📝 Processing ${entities.length} high-priority entities...`);

      if (dryRun) {
        console.log('🔍 DRY RUN - Would process these high-priority entities:');
        entities.forEach((entity, i) => {
          const name = entity.properties?.name || 'Unknown Entity';
          const score = entity.theSportsDBPotential.score.toFixed(2);
          console.log(`  ${i + 1}. ${name} (Score: ${score}, Category: ${entity.category})`);
        });
        return;
      }

      // Process each entity with enhanced matching
      for (const entity of entities) {
        await this.processEntity(entity);

        // Dynamic delay based on success rate
        const delay = entity.theSportsDBPotential.score > 0.5 ? 2000 : 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }

    } catch (error) {
      console.error('❌ Improved workflow failed:', error.message);
      throw error;
    } finally {
      this.printResults();

      // Print enhancement summary
      this.printEnhancementSummary();
    }
  }

  /**
   * Print enhancement summary
   */
  printEnhancementSummary() {
    console.log('\n🎯 ENHANCEMENT SUMMARY');
    console.log('==========================');
    console.log('✅ Implemented entity prioritization by TheSportsDB potential');
    console.log('✅ Enhanced name normalization for football clubs');
    console.log('✅ Smart search variation generation');
    console.log('✅ Known entity mappings for problematic cases');
    console.log('✅ Category-based processing order');

    if (this.results.successful > 0) {
      console.log(`🎉 SUCCESS: ${this.results.successful} badges processed successfully!`);
    } else {
      console.log('💡 RECOMMENDATION: Consider manual badge upload for remaining entities');
    }
  }
}

// CLI interface for improved workflow
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
      case '--limit':
        options.limit = parseInt(args[++i]) || 20;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--help':
        console.log(`
Improved Badge Workflow - Enhanced TheSportsDB Integration

Usage: node improved-badge-workflow.js [options]

Options:
  --entity-id ID         Process specific entity ID
  --entity-name NAME      Process entities matching this name
  --limit NUM            Number of entities to process (default: 20)
  --dry-run              Show what would be processed without executing
  --help                 Show this help message

Enhancements:
  ✅ Entity prioritization by TheSportsDB match potential
  ✅ Enhanced name normalization for football clubs
  ✅ Smart search variation generation with known mappings
  ✅ Category-based processing (Football Clubs first)
  ✅ Dynamic delays based on success probability
  ✅ Comprehensive entity scoring and analysis

Examples:
  node improved-badge-workflow.js                           # Process 20 highest-priority entities
  node improved-badge-workflow.js --limit 50                    # Process 50 highest-priority entities
  node improved-badge-workflow.js --entity-name "Crystal Palace"   # Process Crystal Palace with enhanced matching
  node improved-badge-workflow.js --dry-run                       # Preview prioritized entities
        `);
        return;
      default:
        console.error(`Unknown argument: ${args[i]}`);
        console.log('Use --help for usage information');
        process.exit(1);
    }
  }

  const workflow = new ImprovedBadgeWorkflow();
  await workflow.run(options);
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
  });
}

module.exports = ImprovedBadgeWorkflow;