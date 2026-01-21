#!/usr/bin/env node

/**
 * Entity Name Pattern Analysis
 *
 * Analyzes entity names in the database to understand matching issues with TheSportsDB
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs').promises;

class EntityNameAnalyzer {
  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
    this.analysis = {
      total: 0,
      categories: {},
      issues: {},
      theSportsDBPotential: []
    };
  }

  async analyzeEntityNames() {
    console.log('🔍 Analyzing entity name patterns...\n');

    try {
      // Get entities without badges
      const { data, error } = await this.supabase
        .from('cached_entities')
        .select('neo4j_id, properties')
        .is('badge_s3_url', null)
        .not('properties', 'is', null)
        .limit(50);

      if (error) {
        console.error('❌ Error fetching entities:', error);
        return;
      }

      this.analysis.total = data.length;

      // Categorize entities
      data.forEach(entity => {
        const name = entity.properties?.name || entity.properties?.label || 'Unknown';
        const category = this.categorizeEntity(name);
        const issues = this.identifyNameIssues(name);
        const theSportsDBPotential = this.assessTheSportsDBPotential(name, category);

        if (!this.analysis.categories[category]) {
          this.analysis.categories[category] = [];
        }

        this.analysis.categories[category].push({
          name,
          id: entity.neo4j_id,
          issues,
          theSportsDBPotential
        });

        // Track issues
        issues.forEach(issue => {
          if (!this.analysis.issues[issue]) {
            this.analysis.issues[issue] = [];
          }
          this.analysis.issues[issue].push(name);
        });

        if (theSportsDBPotential.score > 0.3) {
          this.analysis.theSportsDBPotential.push({
            name,
            category,
            score: theSportsDBPotential.score,
            suggestions: theSportsDBPotential.suggestions
          });
        }
      });

      this.printAnalysis();
      await this.saveAnalysis();

    } catch (error) {
      console.error('❌ Analysis failed:', error);
    }
  }

  categorizeEntity(name) {
    const lower = name.toLowerCase();

    // Football clubs indicators
    if (this.containsAny(lower, ['fc', 'united', 'city', 'palace', 'racing', 'al ',
        'arsenal', 'chelsea', 'liverpool', 'milan', 'munich', 'madrid']) ||
        this.endsWithAny(lower, ['fc', 'cf', 'ac', 'sc']) ||
        this.isFootballClubPattern(name)) {
      return 'Football Clubs';
    }

    // Leagues
    if (this.containsAny(lower, ['league', 'primera división', 'premier league', 'bundesliga',
        'serie a', 'serie a', 'liga', 'championship', 'division'])) {
      return 'Leagues';
    }

    // National teams/federations
    if (this.containsAny(lower, ['national team', 'federation', 'association',
        'confederation', 'union']) &&
        this.containsAny(lower, ['football', 'soccer', 'fifa'])) {
      return 'National Teams';
    }

    // Generic federations
    if (this.containsAny(lower, ['federation', 'association', 'confederation', 'union'])) {
      return 'Federations';
    }

    // Individuals (look like person names)
    if (this.isPersonName(name)) {
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

  identifyNameIssues(name) {
    const issues = [];
    const lower = name.toLowerCase();

    // Complex or non-standard names
    if (name.length > 50) issues.push('Very long name');
    if (name.length > 80) issues.push('Extremely long name');
    if (name.includes('(') && name.includes(')')) issues.push('Parenthetical content');
    if (lower.includes('json_seed')) issues.push('System suffix');

    // Character issues
    if (/[0-9]/.test(name) && !/\b(19|20)\d{2}\b/.test(name)) issues.push('Numbers in name');
    if (/[^\w\s\-\.'&()]/.test(name)) issues.push('Special characters');
    if (/[áéíóúñüçäöß]/.test(name)) issues.push('Non-English characters');

    // Generic names
    if (lower.includes('entity') && /\d+/.test(name)) issues.push('Generic entity name');
    if (lower.includes('league') && !this.containsAny(lower, ['premier', 'bundesliga', 'serie', 'primera'])) {
      issues.push('Generic league name');
    }

    // TheSportsDB specific issues
    if (this.containsAny(lower, ['volleyball', 'handball', 'karate', 'cycling federation'])) {
      issues.push('Sport not well covered by TheSportsDB');
    }

    return issues;
  }

  assessTheSportsDBPotential(name, category) {
    const lower = name.toLowerCase();
    let score = 0;
    const suggestions = [];

    // High potential categories
    if (category === 'Football Clubs') {
      score = 0.8;

      // Normalize common football name patterns
      if (lower.includes('fc')) suggestions.push('Try removing "FC"');
      if (lower.includes('al ')) suggestions.push('Try "Al" without space');
      if (this.endsWithAny(lower, [' cf', ' fc'])) suggestions.push('Try without suffix');

      // Specific known clubs
      if (this.containsAny(lower, ['crystal palace', 'corinthians'])) {
        score = 0.9;
        suggestions.push('Should be available in TheSportsDB');
      }
    }

    if (category === 'Leagues') {
      score = 0.6;
      if (this.containsAny(lower, ['premier league', 'bundesliga', 'serie a', 'liga'])) {
        score = 0.8;
        suggestions.push('Major league - should be available');
      }
    }

    if (category === 'National Teams') {
      score = 0.7;
      suggestions.push('Try country name only');
    }

    // Medium potential
    if (category === 'Competitions') {
      score = 0.4;
    }

    // Low potential categories
    if (['Federations', 'Other Sports', 'System Generated'].includes(category)) {
      score = 0.1;
    }

    // Individuals (mixed potential)
    if (category === 'Individuals') {
      score = 0.3;
      if (this.containsAny(lower, ['lebron james', 'chris murray'])) {
        score = 0.5;
        suggestions.push('Famous athletes might be available');
      }
    }

    // Penalty for issues
    if (name.includes('(')) score -= 0.1;
    if (/[áéíóúñüç]/.test(name)) score -= 0.1;
    if (name.length > 40) score -= 0.1;
    if (lower.includes('json_seed')) score -= 0.3;

    return {
      score: Math.max(0, Math.min(1, score)),
      suggestions
    };
  }

  containsAny(str, patterns) {
    return patterns.some(pattern => str.includes(pattern));
  }

  endsWithAny(str, suffixes) {
    return suffixes.some(suffix => str.endsWith(suffix));
  }

  isFootballClubPattern(name) {
    const patterns = [
      /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s+FC)?$/,
      /^[A-Z][a-z]+\s+(?:United|City|Racing|Athletic|Sporting)$/,
      /^[A-Z][a-z]+\s+[A-Z][a-z]+\s+(?:FC|CF|AC|SC)$/
    ];

    return patterns.some(pattern => pattern.test(name));
  }

  isPersonName(name) {
    const words = name.trim().split(/\s+/);

    // Basic person name patterns
    if (words.length >= 2 && words.length <= 4) {
      // Check if first word looks like a first name
      const firstWord = words[0];
      if (firstWord.length >= 2 && firstWord.length <= 20 && /^[A-Z][a-z]/.test(firstWord)) {
        // Check if other words don't contain sports-specific terms
        const otherWords = words.slice(1).join(' ').toLowerCase();
        if (!this.containsAny(otherWords, ['fc', 'club', 'team', 'league', 'federation', 'association'])) {
          return true;
        }
      }
    }

    return false;
  }

  printAnalysis() {
    console.log('📊 ENTITY NAME ANALYSIS REPORT');
    console.log('=====================================\n');

    console.log(`📈 Total entities analyzed: ${this.analysis.total}`);
    console.log('📋 Categories:');

    Object.entries(this.analysis.categories).forEach(([category, entities]) => {
      const percentage = ((entities.length / this.analysis.total) * 100).toFixed(1);
      console.log(`  ${category}: ${entities.length} (${percentage}%)`);

      // Show examples for each category
      if (entities.length > 0) {
        console.log(`    Examples:`);
        entities.slice(0, 3).forEach(entity => {
          const status = entity.theSportsDBPotential.score > 0.3 ? '✅' : '❌';
          console.log(`      ${status} ${entity.name}`);
          if (entity.issues.length > 0) {
            console.log(`         ⚠️  ${entity.issues.join(', ')}`);
          }
        });
        if (entities.length > 3) {
          console.log(`      ... and ${entities.length - 3} more`);
        }
      }
    });

    console.log('\n🔍 Common Issues:');
    Object.entries(this.analysis.issues).forEach(([issue, names]) => {
      console.log(`  ${issue}: ${names.length} entities`);
      if (names.length <= 3) {
        names.forEach(name => console.log(`    - ${name}`));
      }
    });

    console.log('\n🎯 TheSportsDB Potential (High Score > 0.3):');
    this.analysis.theSportsDBPotential
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .forEach(entity => {
        console.log(`  ${entity.score.toFixed(2)} ${entity.name} (${entity.category})`);
        if (entity.suggestions.length > 0) {
          console.log(`    💡 Suggestions: ${entity.suggestions.join(', ')}`);
        }
      });
  }

  async saveAnalysis() {
    const report = {
      timestamp: new Date().toISOString(),
      analysis: this.analysis,
      recommendations: this.generateRecommendations()
    };

    try {
      await fs.writeFile('entity-name-analysis-report.json', JSON.stringify(report, null, 2));
      console.log('\n💾 Analysis saved to: entity-name-analysis-report.json');
    } catch (error) {
      console.error('❌ Failed to save analysis:', error);
    }
  }

  generateRecommendations() {
    return [
      'Focus on mainstream football clubs - highest TheSportsDB coverage',
      'Implement name normalization for common patterns (FC, Al, etc.)',
      'Create manual badge upload for federations and non-football entities',
      'Use country names instead of full federation names',
      'Remove parenthetical content and system suffixes before searching',
      'Consider alternative badge sources for non-football sports',
      'Implement entity name mapping table for known mismatches'
    ];
  }
}

// Run analysis if called directly
if (require.main === module) {
  const analyzer = new EntityNameAnalyzer();
  analyzer.analyzeEntityNames().catch(console.error);
}

module.exports = EntityNameAnalyzer;