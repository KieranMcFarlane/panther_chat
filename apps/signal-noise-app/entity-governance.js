#!/usr/bin/env node

const neo4j = require('neo4j-driver');

// Configuration
const NEO4J_URI = process.env.NEO4J_URI || 'neo4j+s://cce1f84b.databases.neo4j.io';
const NEO4J_USERNAME = process.env.NEO4J_USERNAME || 'neo4j';
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || 'llNASCzMWGT-nTt-JkD9Qk_4W6PpJrv39X0PuYAIKV0';

class EntityDataGovernance {
    constructor() {
        this.driver = neo4j.driver(
            NEO4J_URI,
            neo4j.auth.basic(NEO4J_USERNAME, NEO4J_PASSWORD)
        );
    }

    async close() {
        await this.driver.close();
    }

    async getSession() {
        return this.driver.session();
    }

    // Validation patterns for problematic entities
    getProblematicPatterns() {
        return [
            {
                name: "json_seed_duplicates",
                pattern: /\(json_seed\)$/,
                description: "Entities with json_seed suffixes - data loading artifacts",
                severity: "HIGH",
                action: "EXCLUDE"
            },
            {
                name: "csv_seed_duplicates", 
                pattern: /\(csv_seed\)$/,
                description: "Entities with csv_seed suffixes - data loading artifacts",
                severity: "HIGH",
                action: "EXCLUDE"
            },
            {
                name: "generic_roles",
                pattern: /^(Academy Director|Commercial Director|Technical Director|Head Coach|General Manager|Chief Executive|Marketing Director|Operations Director|Finance Director|Stadium Manager|Equipment Manager|Team Doctor|Physiotherapist|Scout|Analyst)$/,
                description: "Generic role names instead of specific people",
                severity: "MEDIUM",
                action: "EXCLUDE"
            },
            {
                name: "test_data",
                pattern: /^(Test Person|Test.*|Placeholder.*|Sample.*)$/i,
                description: "Obvious test or placeholder entries",
                severity: "HIGH", 
                action: "EXCLUDE"
            },
            {
                name: "suspicious_numbers",
                pattern: /^[A-Z][a-z]+ [0-9]{3,4}$/,
                description: "Potential system-generated IDs masquerading as names",
                severity: "MEDIUM",
                action: "REVIEW"
            },
            {
                name: "numbered_teams",
                pattern: /[Tt]eam [0-9]+/,
                description: "Teams with generic numbers",
                severity: "MEDIUM",
                action: "REVIEW"
            },
            {
                name: "numbered_clubs",
                pattern: /[Cc]lub [0-9]+/,
                description: "Clubs with generic numbers",
                severity: "MEDIUM",
                action: "REVIEW"
            },
            {
                name: "numbered_golf",
                pattern: /[Gg]olf Club [0-9]+/,
                description: "Golf clubs with generic numbers",
                severity: "HIGH",
                action: "EXCLUDE"
            }
        ];
    }

    // Validate entity name against problematic patterns
    validateEntityName(name) {
        const results = [];
        
        for (const pattern of this.getProblematicPatterns()) {
            if (pattern.pattern.test(name)) {
                results.push({
                    pattern: pattern.name,
                    severity: pattern.severity,
                    action: pattern.action,
                    description: pattern.description
                });
            }
        }
        
        return {
            isValid: results.length === 0,
            issues: results,
            recommendation: results.length > 0 ? results[0].action : 'ACCEPT'
        };
    }

    // Check required entity fields
    validateRequiredFields(entity) {
        const required = ['name', 'type'];
        const recommended = ['sport', 'country'];
        const missing = [];
        const warnings = [];
        
        // Check required fields
        for (const field of required) {
            if (!entity[field] || entity[field].toString().trim() === '') {
                missing.push(field);
            }
        }
        
        // Check recommended fields
        for (const field of recommended) {
            if (!entity[field] || entity[field].toString().trim() === '') {
                warnings.push(field);
            }
        }
        
        return {
            isValid: missing.length === 0,
            missing,
            warnings,
            score: Math.max(0, 100 - (missing.length * 50) - (warnings.length * 10))
        };
    }

    // Check for potential duplicate entities
    async checkForDuplicates(name, excludeId = null) {
        const session = await this.getSession();
        try {
            let query = 'MATCH (e:Entity) WHERE e.name = $name RETURN count(e) as count';
            let params = { name: name.trim() };
            
            if (excludeId) {
                query = 'MATCH (e:Entity) WHERE e.name = $name AND id(e) <> $excludeId RETURN count(e) as count';
                params.excludeId = excludeId;
            }
            
            const result = await session.run(query, params);
            const count = result.records[0].get('count').toNumber();
            
            return {
                hasDuplicates: count > 0,
                duplicateCount: count,
                recommendation: count > 0 ? 'REVIEW' : 'ACCEPT'
            };
        } finally {
            await session.close();
        }
    }

    // Comprehensive entity validation
    async validateEntity(entity, options = {}) {
        const { skipDuplicateCheck = false, excludeId = null } = options;
        
        const results = {
            entity: entity.name || 'Unknown',
            timestamp: new Date().toISOString(),
            overall: {
                isValid: true,
                score: 100,
                recommendation: 'ACCEPT'
            },
            checks: {}
        };
        
        // 1. Name validation
        const nameValidation = this.validateEntityName(entity.name || '');
        results.checks.nameValidation = nameValidation;
        if (!nameValidation.isValid) {
            results.overall.isValid = false;
            results.overall.score -= nameValidation.issues.length * 25;
            results.overall.recommendation = nameValidation.recommendation;
        }
        
        // 2. Required fields validation
        const fieldValidation = this.validateRequiredFields(entity);
        results.checks.fieldValidation = fieldValidation;
        if (!fieldValidation.isValid) {
            results.overall.isValid = false;
            results.overall.score = Math.min(results.overall.score, fieldValidation.score);
            results.overall.recommendation = 'REJECT';
        }
        
        // 3. Duplicate check
        if (!skipDuplicateCheck && entity.name) {
            const duplicateCheck = await this.checkForDuplicates(entity.name, excludeId);
            results.checks.duplicateCheck = duplicateCheck;
            if (duplicateCheck.hasDuplicates) {
                results.overall.score -= 20;
                if (results.overall.recommendation === 'ACCEPT') {
                    results.overall.recommendation = 'REVIEW';
                }
            }
        }
        
        return results;
    }

    // Run governance audit on all entities
    async runGovernanceAudit() {
        console.log('🔍 Running Data Governance Audit...\n');
        
        const session = await this.getSession();
        try {
            // Get all entities
            const result = await session.run('MATCH (e:Entity) RETURN e LIMIT 100');
            const entities = result.records.map(record => record.get('e'));
            
            console.log(`📊 Auditing ${entities.length} entities\n`);
            
            const auditResults = {
                timestamp: new Date().toISOString(),
                totalEntities: entities.length,
                summary: {
                    valid: 0,
                    issuesFound: 0,
                    highRiskIssues: 0,
                    mediumRiskIssues: 0,
                    lowRiskIssues: 0
                },
                problematicEntities: [],
                recommendations: []
            };
            
            for (const entity of entities) {
                const validation = await this.validateEntity(entity, { skipDuplicateCheck: true });
                
                if (!validation.overall.isValid) {
                    auditResults.summary.issuesFound++;
                    
                    // Categorize by severity
                    const highRiskIssues = validation.checks.nameValidation.issues.filter(i => i.severity === 'HIGH');
                    const mediumRiskIssues = validation.checks.nameValidation.issues.filter(i => i.severity === 'MEDIUM');
                    
                    if (highRiskIssues.length > 0) {
                        auditResults.summary.highRiskIssues++;
                    }
                    if (mediumRiskIssues.length > 0) {
                        auditResults.summary.mediumRiskIssues++;
                    }
                    
                    auditResults.problematicEntities.push({
                        name: entity.name || 'Unknown',
                        neo4jId: entity.elementId || 'Unknown',
                        issues: validation.checks.nameValidation.issues,
                        missingFields: validation.checks.fieldValidation.missing,
                        score: validation.overall.score,
                        recommendation: validation.overall.recommendation
                    });
                } else {
                    auditResults.summary.valid++;
                }
            }
            
            // Generate recommendations
            auditResults.recommendations = this.generateRecommendations(auditResults);
            
            return auditResults;
            
        } finally {
            await session.close();
        }
    }

    // Generate governance recommendations
    generateRecommendations(auditResults) {
        const recommendations = [];
        
        if (auditResults.summary.highRiskIssues > 0) {
            recommendations.push({
                priority: 'URGENT',
                category: 'Data Quality',
                issue: `${auditResults.summary.highRiskIssues} high-risk entities found`,
                action: 'Remove or exclude entities with json_seed/csv_seed suffixes and test data',
                estimatedImpact: 'HIGH'
            });
        }
        
        if (auditResults.summary.mediumRiskIssues > 0) {
            recommendations.push({
                priority: 'HIGH',
                category: 'Data Quality', 
                issue: `${auditResults.summary.mediumRiskIssues} medium-risk entities found`,
                action: 'Review entities with generic roles or suspicious naming patterns',
                estimatedImpact: 'MEDIUM'
            });
        }
        
        if (auditResults.summary.issuesFound > auditResults.totalEntities * 0.1) {
            recommendations.push({
                priority: 'HIGH',
                category: 'Process Improvement',
                issue: 'High percentage of problematic entities (>10%)',
                action: 'Implement stricter data validation and pre-import screening',
                estimatedImpact: 'HIGH'
            });
        }
        
        // Add specific recommendations based on findings
        const problematicNames = auditResults.problematicEntities
            .filter(e => e.issues.some(i => i.pattern === 'json_seed_duplicates'))
            .length;
            
        if (problematicNames > 0) {
            recommendations.push({
                priority: 'URGENT',
                category: 'Data Cleanup',
                issue: `${problematicNames} entities with json_seed suffixes`,
                action: 'Batch remove these data loading artifacts using automated cleanup script',
                estimatedImpact: 'HIGH'
            });
        }
        
        return recommendations;
    }

    // Generate governance report
    async generateGovernanceReport() {
        const auditResults = await this.runGovernanceAudit();
        
        console.log('='.repeat(70));
        console.log('🛡️  ENTITY DATA GOVERNANCE REPORT');
        console.log('='.repeat(70));
        console.log(`Generated: ${new Date().toLocaleString()}`);
        console.log('');

        // Summary
        console.log('📊 AUDIT SUMMARY');
        console.log('-'.repeat(30));
        console.log(`Total Entities Audited:   ${auditResults.totalEntities.toLocaleString()}`);
        console.log(`Valid Entities:          ${auditResults.summary.valid.toLocaleString()} (${((auditResults.summary.valid/auditResults.totalEntities)*100).toFixed(1)}%)`);
        console.log(`Entities with Issues:    ${auditResults.summary.issuesFound.toLocaleString()} (${((auditResults.summary.issuesFound/auditResults.totalEntities)*100).toFixed(1)}%)`);
        console.log(`High Risk Issues:        ${auditResults.summary.highRiskIssues.toLocaleString()}`);
        console.log(`Medium Risk Issues:      ${auditResults.summary.mediumRiskIssues.toLocaleString()}`);
        console.log('');

        // Problematic entities sample
        if (auditResults.problematicEntities.length > 0) {
            console.log('⚠️  PROBLEMATIC ENTITIES (Sample)');
            console.log('-'.repeat(30));
            auditResults.problematicEntities.slice(0, 10).forEach((entity, index) => {
                console.log(`${index + 1}. ${entity.name} (Score: ${entity.score})`);
                if (entity.issues.length > 0) {
                    console.log(`   Issues: ${entity.issues.map(i => i.pattern).join(', ')}`);
                }
                if (entity.missingFields.length > 0) {
                    console.log(`   Missing: ${entity.missingFields.join(', ')}`);
                }
                console.log(`   Recommendation: ${entity.recommendation}`);
                console.log('');
            });
            
            if (auditResults.problematicEntities.length > 10) {
                console.log(`... and ${auditResults.problematicEntities.length - 10} more entities`);
            }
        }

        // Recommendations
        console.log('🎯 RECOMMENDATIONS');
        console.log('-'.repeat(30));
        auditResults.recommendations.forEach((rec, index) => {
            console.log(`${index + 1}. [${rec.priority}] ${rec.category}`);
            console.log(`   Issue: ${rec.issue}`);
            console.log(`   Action: ${rec.action}`);
            console.log(`   Impact: ${rec.estimatedImpact}`);
            console.log('');
        });

        // Export to JSON
        const reportPath = `./governance-report-${Date.now()}.json`;
        require('fs').writeFileSync(reportPath, JSON.stringify(auditResults, null, 2));
        console.log(`📄 Full report exported to: ${reportPath}`);

        return auditResults;
    }

    // Entity validation rules for new imports
    getValidationRules() {
        return {
            requiredFields: ['name', 'type'],
            recommendedFields: ['sport', 'country', 'division'],
            forbiddenPatterns: [
                {
                    pattern: /\(json_seed\)$/,
                    reason: 'Data loading artifact'
                },
                {
                    pattern: /\(csv_seed\)$/,
                    reason: 'Data loading artifact'
                },
                {
                    pattern: /^(Test Person|Test.*|Placeholder.*|Sample.*)$/i,
                    reason: 'Test data'
                }
            ],
            qualityThresholds: {
                minimumNameLength: 2,
                maximumNameLength: 200,
                allowedTypes: ['Club', 'Federation', 'League', 'Tournament', 'Team', 'Organization', 'International Federation', 'Continental Federation', 'Brand', 'Region'],
                requiredForType: {
                    'Club': ['sport'],
                    'Federation': ['sport', 'country'],
                    'League': ['sport'],
                    'Team': ['sport'],
                    'Tournament': ['sport']
                }
            }
        };
    }
}

// Command line interface
if (require.main === module) {
    const governance = new EntityDataGovernance();
    
    const command = process.argv[2] || 'audit';
    
    switch (command) {
        case 'audit':
            governance.generateGovernanceReport()
                .then(() => governance.close())
                .catch(err => {
                    console.error('❌ Governance audit failed:', err);
                    governance.close();
                    process.exit(1);
                });
            break;
            
        case 'validate':
            const entityName = process.argv[3];
            if (!entityName) {
                console.error('❌ Please provide an entity name to validate');
                process.exit(1);
            }
            
            governance.validateEntity({ name: entityName })
                .then(result => {
                    console.log('Validation Result:');
                    console.log(JSON.stringify(result, null, 2));
                    return governance.close();
                })
                .catch(err => {
                    console.error('❌ Validation failed:', err);
                    governance.close();
                    process.exit(1);
                });
            break;
            
        case 'rules':
            console.log('Data Governance Validation Rules:');
            console.log(JSON.stringify(governance.getValidationRules(), null, 2));
            governance.close();
            break;
            
        default:
            console.log('Available commands:');
            console.log('  audit      - Run full governance audit and generate report');
            console.log('  validate   - Validate a specific entity name');
            console.log('  rules      - Show validation rules');
            governance.close();
    }
}

module.exports = EntityDataGovernance;