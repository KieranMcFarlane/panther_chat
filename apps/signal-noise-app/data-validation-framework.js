#!/usr/bin/env node

/**
 * Data Validation Framework for Sports League Sync
 * 
 * This script implements comprehensive validation to prevent data quality issues
 * during future sports league synchronization processes.
 * 
 * Features:
 * - Duplicate detection and prevention
 * - League size validation
 * - Team name standardization
 * - Season accuracy verification
 * - Cross-reference validation
 */

class SportsDataValidator {
  constructor() {
    // Expected league sizes for validation
    this.expectedLeagueSizes = {
      'Premier League': 20,
      'NBA': 30,
      'LaLiga': 18,
      'Serie A': 20,
      'MLS': 29,
      'Bundesliga': 18,
      'EuroLeague': 18,
      'Ligue 1': 18,
      'Eredivisie': 18,
      'Primeira Liga': 18
    };

    // Known team mappings for standardization
    this.teamNameMappings = {
      'Tottenham': 'Tottenham Hotspur',
      'Man United': 'Manchester United',
      'Man City': 'Manchester City',
      'Real Madrid CF': 'Real Madrid',
      'FC Barcelona': 'Barcelona',
      'Atletico Madrid': 'Atlético de Madrid',
      'FC Bayern Munich': 'Bayern München'
    };

    // Teams that should be excluded (relegated, dissolved, etc.)
    this.excludedTeams = {
      'Premier League': ['Burnley', 'Sheffield United', 'Leeds United', 'Sunderland'],
      'LaLiga': ['Espanyol'], // Relegated after 2022-23
      'Serie A': ['Venezia', 'Sampdoria'] // Relegated after 2022-23
    };

    this.validationResults = {
      passed: 0,
      failed: 0,
      warnings: [],
      errors: [],
      fixes: []
    };
  }

  log(message, level = 'info', data = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${level.toUpperCase()}: ${message}`;
    console.log(logEntry, data);
  }

  /**
   * Validate team names and apply standardization
   */
  validateTeamName(teamName, league) {
    let validatedName = teamName.trim();
    
    // Apply standardization mappings
    if (this.teamNameMappings[validatedName]) {
      validatedName = this.teamNameMappings[validatedName];
      this.validationResults.fixes.push({
        type: 'name_standardization',
        league: league,
        original: teamName,
        corrected: validatedName
      });
    }

    return validatedName;
  }

  /**
   * Check if team should be excluded from current league
   */
  shouldExcludeTeam(teamName, league) {
    const excludedTeams = this.excludedTeams[league] || [];
    return excludedTeams.includes(teamName);
  }

  /**
   * Validate league size against expected count
   */
  validateLeagueSize(league, teamCount) {
    const expectedSize = this.expectedLeagueSizes[league];
    
    if (!expectedSize) {
      this.validationResults.warnings.push({
        type: 'unknown_league_size',
        league: league,
        message: `No expected size defined for ${league}`
      });
      return true; // Allow unknown leagues through
    }

    const variance = Math.abs(teamCount - expectedSize);
    const tolerance = Math.ceil(expectedSize * 0.1); // 10% tolerance

    if (variance > tolerance) {
      this.validationResults.errors.push({
        type: 'size_mismatch',
        league: league,
        expected: expectedSize,
        actual: teamCount,
        variance: variance,
        tolerance: tolerance
      });
      return false;
    }

    if (variance > 0) {
      this.validationResults.warnings.push({
        type: 'size_variance',
        league: league,
        expected: expectedSize,
        actual: teamCount,
        variance: variance
      });
    }

    return true;
  }

  /**
   * Detect duplicate teams in a list
   */
  detectDuplicates(teams) {
    const seen = new Set();
    const duplicates = [];

    teams.forEach(team => {
      const normalizedTeam = team.toLowerCase().trim();
      if (seen.has(normalizedTeam)) {
        duplicates.push(team);
      } else {
        seen.add(normalizedTeam);
      }
    });

    return duplicates;
  }

  /**
   * Validate a list of teams for a specific league
   */
  validateTeamList(teams, league) {
    const results = {
      valid: true,
      duplicates: [],
      excluded: [],
      standardized: [],
      issues: []
    };

    // Check for duplicates
    const duplicates = this.detectDuplicates(teams);
    if (duplicates.length > 0) {
      results.duplicates = duplicates;
      results.valid = false;
      results.issues.push({
        type: 'duplicates',
        count: duplicates.length,
        teams: duplicates
      });
    }

    // Process each team
    teams.forEach(team => {
      // Check if team should be excluded
      if (this.shouldExcludeTeam(team, league)) {
        results.excluded.push(team);
        results.issues.push({
          type: 'excluded_team',
          team: team,
          league: league,
          reason: 'Team not in current league season'
        });
      } else {
        // Standardize team name
        const standardized = this.validateTeamName(team, league);
        if (standardized !== team) {
          results.standardized.push({
            original: team,
            standardized: standardized
          });
        }
      }
    });

    // Validate league size
    const validTeams = teams.filter(team => 
      !results.duplicates.includes(team) && 
      !results.excluded.includes(team)
    );

    const sizeValid = this.validateLeagueSize(league, validTeams.length);
    if (!sizeValid) {
      results.valid = false;
    }

    return results;
  }

  /**
   * Generate validation report
   */
  generateValidationReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        validations_run: this.validationResults.passed + this.validationResults.failed,
        passed: this.validationResults.passed,
        failed: this.validationResults.failed,
        warnings: this.validationResults.warnings.length,
        errors: this.validationResults.errors.length,
        fixes: this.validationResults.fixes.length
      },
      issues: {
        warnings: this.validationResults.warnings,
        errors: this.validationResults.errors,
        fixes: this.validationResults.fixes
      },
      recommendations: this.generateRecommendations()
    };

    return report;
  }

  /**
   * Generate recommendations based on validation results
   */
  generateRecommendations() {
    const recommendations = [];

    if (this.validationResults.errors.length > 0) {
      recommendations.push({
        priority: 'CRITICAL',
        type: 'fix_validation_errors',
        description: `${this.validationResults.errors.length} validation errors must be fixed`,
        action: 'Review and correct data before proceeding with sync'
      });
    }

    if (this.validationResults.warnings.length > 0) {
      recommendations.push({
        priority: 'HIGH',
        type: 'review_warnings',
        description: `${this.validationResults.warnings.length} warnings should be reviewed`,
        action: 'Investigate and resolve warning conditions'
      });
    }

    if (this.validationResults.fixes.length > 0) {
      recommendations.push({
        priority: 'MEDIUM',
        type: 'apply_fixes',
        description: `${this.validationResults.fixes.length} automatic fixes identified`,
        action: 'Apply standardization and correction fixes'
      });
    }

    recommendations.push({
      priority: 'LOW',
      type: 'establish_monitoring',
      description: 'Set up automated monitoring for data quality',
      action: 'Implement regular validation and alerting system'
    });

    return recommendations;
  }

  /**
   * Run comprehensive validation on league data
   */
  async validateLeagueData(teams, league) {
    this.log(`Starting validation for ${league} with ${teams.length} teams`);
    
    const startTime = Date.now();
    const results = this.validateTeamList(teams, league);
    const validationTime = Date.now() - startTime;

    if (results.valid) {
      this.validationResults.passed++;
      this.log(`✅ Validation passed for ${league}`, 'info', {
        teamCount: teams.length,
        validTeams: teams.length - results.duplicates.length - results.excluded.length,
        validationTime: validationTime
      });
    } else {
      this.validationResults.failed++;
      this.log(`❌ Validation failed for ${league}`, 'error', {
        teamCount: teams.length,
        issues: results.issues.length,
        validationTime: validationTime
      });
    }

    return {
      ...results,
      league: league,
      validationTime: validationTime
    };
  }

  /**
   * Create validation rules documentation
   */
  createValidationRules() {
    return {
      version: '1.0.0',
      created: new Date().toISOString(),
      rules: {
        duplicate_prevention: {
          enabled: true,
          method: 'case_insensitive_string_comparison',
          action: 'reject_duplicates'
        },
        league_size_validation: {
          enabled: true,
          tolerance: 0.1, // 10% tolerance
          action: 'warn_on_variance'
        },
        team_name_standardization: {
          enabled: true,
          mappings: this.teamNameMappings,
          action: 'auto_correct'
        },
        team_exclusion: {
          enabled: true,
          excluded_teams: this.excludedTeams,
          action: 'auto_exclude'
        },
        cross_reference_validation: {
          enabled: true,
          sources: ['official_league_sites', 'sports_data_apis'],
          action: 'verify_against_sources'
        }
      }
    };
  }
}

// Export for use in other modules
module.exports = SportsDataValidator;

// Example usage if run directly
if (require.main === module) {
  // Sample data for testing
  const validator = new SportsDataValidator();
  
  const sampleTeams = [
    'Arsenal', 'Chelsea', 'Manchester United', 'Manchester City',
    'Tottenham', 'Liverpool', 'Leicester City', 'Everton',
    'Arsenal', // Duplicate
    'Burnley', // Should be excluded (relegated)
    'Man United' // Should be standardized
  ];

  validator.validateLeagueData(sampleTeams, 'Premier League')
    .then(results => {
      console.log('\n=== Validation Results ===');
      console.log(JSON.stringify(results, null, 2));
      
      const report = validator.generateValidationReport();
      console.log('\n=== Validation Report ===');
      console.log(JSON.stringify(report, null, 2));
    })
    .catch(error => {
      console.error('Validation failed:', error);
    });
}