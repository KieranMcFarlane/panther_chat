// 🎯 Level 3 Autonomous RFP System - Neo4j Knowledge Graph Schema
// ================================================================
// 
// Cypher script to create the complete knowledge graph structure
// Run this in your Neo4j browser or via Neo4j driver

// CONSTRAINTS - Ensure data integrity
CREATE CONSTRAINT IF NOT EXISTS FOR (o:Organization) REQUIRE o.id IS UNIQUE;
CREATE CONSTRAINT IF NOT EXISTS FOR (p:Person) REQUIRE p.id IS UNIQUE;
CREATE CONSTRAINT IF NOT EXISTS FOR (opp:Opportunity) REQUIRE opp.id IS UNIQUE;
CREATE CONSTRAINT IF NOT EXISTS FOR (r:Response) REQUIRE r.id IS UNIQUE;
CREATE CONSTRAINT IF NOT EXISTS FOR (a:Analysis) REQUIRE a.id IS UNIQUE;

// INDEXES - Optimize for performance
CREATE INDEX organization_name_index IF NOT EXISTS FOR (o:Organization) ON (o.name);
CREATE INDEX organization_industry_index IF NOT EXISTS FOR (o:Organization) ON (o.industry);
CREATE INDEX organization_size_index IF NOT EXISTS FOR (o:Organization) ON (o.size);
CREATE INDEX person_name_index IF NOT EXISTS FOR (p:Person) ON (p.name);
CREATE INDEX person_role_index IF NOT EXISTS FOR (p:Person) ON (p.role);
CREATE INDEX opportunity_title_index IF NOT EXISTS FOR (opp:Opportunity) ON (opp.title);
CREATE INDEX opportunity_source_index IF NOT EXISTS FOR (opp:Opportunity) ON (opp.source);
CREATE INDEX opportunity_status_index IF NOT EXISTS FOR (opp:Opportunity) ON (opp.status);
CREATE INDEX analysis_fit_score_index IF NOT EXISTS FOR (a:Analysis) ON (a.fitScore);

// NODE CREATION FUNCTIONS

// Function to create or update Organization nodes
CREATE OR REPLACE FUNCTION createOrUpdateOrganization(
    orgId STRING,
    name STRING,
    industry STRING DEFAULT NULL,
    size STRING DEFAULT NULL,
    location STRING DEFAULT NULL,
    website STRING DEFAULT NULL,
    description STRING DEFAULT NULL,
    digitalPresence MAP DEFAULT NULL
) RETURNS VOID AS
BEGIN
    MERGE (o:Organization {id: orgId})
    ON CREATE SET 
        o.name = name,
        o.industry = industry,
        o.size = size,
        o.location = location,
        o.website = website,
        o.description = description,
        o.digitalPresence = digitalPresence,
        o.createdAt = timestamp(),
        o.updatedAt = timestamp()
    ON MATCH SET 
        o.name = name,
        o.industry = industry,
        o.size = size,
        o.location = location,
        o.website = website,
        o.description = description,
        o.digitalPresence = digitalPresence,
        o.updatedAt = timestamp();
END;

// Function to create or update Person nodes
CREATE OR REPLACE FUNCTION createOrUpdatePerson(
    personId STRING,
    name STRING,
    role STRING DEFAULT NULL,
    email STRING DEFAULT NULL,
    linkedinProfile STRING DEFAULT NULL,
    organizationId STRING DEFAULT NULL,
    seniority STRING DEFAULT NULL,
    department STRING DEFAULT NULL,
    expertise MAP DEFAULT NULL
) RETURNS VOID AS
BEGIN
    MERGE (p:Person {id: personId})
    ON CREATE SET 
        p.name = name,
        p.role = role,
        p.email = email,
        p.linkedinProfile = linkedinProfile,
        p.seniority = seniority,
        p.department = department,
        p.expertise = expertise,
        p.createdAt = timestamp(),
        p.updatedAt = timestamp()
    ON MATCH SET 
        p.name = name,
        p.role = role,
        p.email = email,
        p.linkedinProfile = linkedinProfile,
        p.seniority = seniority,
        p.department = department,
        p.expertise = expertise,
        p.updatedAt = timestamp();
    
    // Link to organization if provided
    IF organizationId IS NOT NULL THEN
        MATCH (p:Person {id: personId})
        MATCH (o:Organization {id: organizationId})
        MERGE (p)-[:WORKS_FOR]->(o);
    END IF;
END;

// Function to create or update Opportunity nodes
CREATE OR REPLACE FUNCTION createOrUpdateOpportunity(
    oppId STRING,
    title STRING,
    description STRING DEFAULT NULL,
    source STRING DEFAULT NULL,
    sourceUrl STRING DEFAULT NULL,
    organizationId STRING DEFAULT NULL,
    deadline STRING DEFAULT NULL,
    budgetRange STRING DEFAULT NULL,
    requirements LIST<STRING> DEFAULT NULL,
    fitScore FLOAT DEFAULT NULL,
    status STRING DEFAULT 'detected'
) RETURNS VOID AS
BEGIN
    MERGE (opp:Opportunity {id: oppId})
    ON CREATE SET 
        opp.title = title,
        opp.description = description,
        opp.source = source,
        opp.sourceUrl = sourceUrl,
        opp.deadline = deadline,
        opp.budgetRange = budgetRange,
        opp.requirements = requirements,
        opp.fitScore = fitScore,
        opp.status = status,
        opp.detectedAt = timestamp(),
        opp.updatedAt = timestamp()
    ON MATCH SET 
        opp.title = title,
        opp.description = description,
        opp.source = source,
        opp.sourceUrl = sourceUrl,
        opp.deadline = deadline,
        opp.budgetRange = budgetRange,
        opp.requirements = requirements,
        opp.fitScore = fitScore,
        opp.status = status,
        opp.updatedAt = timestamp();
    
    // Link to organization if provided
    IF organizationId IS NOT NULL THEN
        MATCH (opp:Opportunity {id: oppId})
        MATCH (o:Organization {id: organizationId})
        MERGE (o)-[:PUBLISHED]->(opp);
    END IF;
END;

// Function to create Analysis nodes
CREATE OR REPLACE FUNCTION createAnalysis(
    analysisId STRING,
    opportunityId STRING,
    fitScore FLOAT,
    reasoning STRING DEFAULT NULL,
    strengths LIST<STRING> DEFAULT NULL,
    weaknesses LIST<STRING> DEFAULT NULL,
    recommendations LIST<STRING> DEFAULT NULL,
    confidence FLOAT DEFAULT NULL,
    model STRING DEFAULT NULL
) RETURNS VOID AS
BEGIN
    CREATE (a:Analysis {
        id: analysisId,
        fitScore: fitScore,
        reasoning: reasoning,
        strengths: strengths,
        weaknesses: weaknesses,
        recommendations: recommendations,
        confidence: confidence,
        model: model,
        createdAt = timestamp()
    });
    
    // Link to opportunity
    MATCH (a:Analysis {id: analysisId})
    MATCH (opp:Opportunity {id: opportunityId})
    MERGE (opp)-[:HAS_ANALYSIS]->(a);
END;

// RELATIONSHIP CREATION FUNCTIONS

// Function to create partnership between organizations
CREATE OR REPLACE FUNCTION createPartnership(
    orgId1 STRING,
    orgId2 STRING,
    partnershipType STRING DEFAULT 'general',
    details MAP DEFAULT NULL
) RETURNS VOID AS
BEGIN
    MATCH (o1:Organization {id: orgId1})
    MATCH (o2:Organization {id: orgId2})
    MERGE (o1)-[p:PARTNERSHIP]->(o2)
    SET p.type = partnershipType, p.details = details, p.createdAt = timestamp();
END;

// Function to connect person to opportunity
CREATE OR REPLACE FUNCTION connectPersonToOpportunity(
    personId STRING,
    opportunityId STRING,
    relationshipType STRING DEFAULT 'contact',
    details MAP DEFAULT NULL
) RETURNS VOID AS
BEGIN
    MATCH (p:Person {id: personId})
    MATCH (opp:Opportunity {id: opportunityId})
    MERGE (p)-[r:RELATED_TO]->(opp)
    SET r.type = relationshipType, r.details = details, r.createdAt = timestamp();
END;

// Function to create similarity relationships
CREATE OR REPLACE FUNCTION createSimilarity(
    entityType STRING,
    entityId1 STRING,
    entityId2 STRING,
    similarityScore FLOAT,
    similarityType STRING DEFAULT 'general'
) RETURNS VOID AS
BEGIN
    CALL apoc.do.case([
        entityType = 'Organization', 
        'MATCH (o1:Organization {id: entityId1}) 
         MATCH (o2:Organization {id: entityId2}) 
         MERGE (o1)-[s:SIMILAR_TO]->(o2) 
         SET s.score = similarityScore, s.type = similarityType, s.createdAt = timestamp()',
        
        entityType = 'Opportunity',
        'MATCH (o1:Opportunity {id: entityId1}) 
         MATCH (o2:Opportunity {id: entityId2}) 
         MERGE (o1)-[s:SIMILAR_TO]->(o2) 
         SET s.score = similarityScore, s.type = similarityType, s.createdAt = timestamp()',
        
        entityType = 'Person',
        'MATCH (p1:Person {id: entityId1}) 
         MATCH (p2:Person {id: entityId2}) 
         MERGE (p1)-[s:SIMILAR_TO]->(p2) 
         SET s.score = similarityScore, s.type = similarityType, s.createdAt = timestamp()'
    ], 
    'RETURN 1', 
    {entityType: entityType, entityId1: entityId1, entityId2: entityId2, similarityScore: similarityScore, similarityType: similarityType});
END;

// ANALYTICAL FUNCTIONS

// Function to find decision makers in an organization
CREATE OR REPLACE FUNCTION findDecisionMarkers(organizationId STRING)
RETURNS TABLE(personId STRING, name STRING, role STRING, email STRING, seniority STRING) AS
BEGIN
    MATCH (p:Person)-[:WORKS_FOR]->(o:Organization {id: organizationId})
    WHERE p.seniority IN ['senior', 'executive', 'c-level', 'director', 'vp'] 
       OR p.role IN ['CEO', 'CTO', 'CFO', 'Director', 'Vice President', 'VP', 'Head', 'Manager']
    RETURN p.id AS personId, p.name AS name, p.role AS role, p.email AS email, p.seniority AS seniority;
END;

// Function to find similar opportunities based on fit score and content
CREATE OR REPLACE FUNCTION findSimilarOpportunities(opportunityId STRING, limit INTEGER DEFAULT 5)
RETURNS TABLE(oppId STRING, title STRING, fitScore FLOAT, similarityScore FLOAT) AS
BEGIN
    MATCH (target:Opportunity {id: opportunityId})
    MATCH (other:Opportunity)
    WHERE other.id <> opportunityId
      AND other.status IN ['detected', 'analyzing', 'qualified']
    WITH other, 
         // Calculate similarity based on multiple factors
         (CASE WHEN target.industry = other.industry THEN 0.3 ELSE 0 END) +
         (CASE WHEN target.budgetRange = other.budgetRange THEN 0.2 ELSE 0 END) +
         (ABS(target.fitScore - other.fitScore) * 0.5) AS similarityScore
    ORDER BY similarityScore DESC, other.fitScore DESC
    LIMIT limit
    RETURN other.id AS oppId, other.title AS title, other.fitScore AS fitScore, similarityScore;
END;

// Function to analyze network connections for opportunity
CREATE OR REPLACE FUNCTION analyzeNetworkConnections(opportunityId STRING)
RETURNS MAP AS
BEGIN
    MATCH (opp:Opportunity {id: opportunityId})<-[:PUBLISHED]-(org:Organization)
    OPTIONAL MATCH (org)<-[p:PARTNERSHIP]-(partnerOrg:Organization)
    OPTIONAL MATCH (org)<-[:WORKS_FOR]-(person:Person)
    OPTIONAL MATCH (person)-[:RELATED_TO]-(relatedOpp:Opportunity)
    
    RETURN {
        organization: properties(org),
        partners: COLLECT(DISTINCT properties(partnerOrg)),
        contacts: COLLECT(DISTINCT properties(person)),
        relatedOpportunities: COLLECT(DISTINCT properties(relatedOpp)),
        partnerCount: COUNT(DISTINCT partnerOrg),
        contactCount: COUNT(DISTINCT person),
        relatedOpportunityCount: COUNT(DISTINCT relatedOpp)
    };
END;

// Function to get opportunity journey and status
CREATE OR REPLACE FUNCTION getOpportunityJourney(opportunityId STRING)
RETURNS MAP AS
BEGIN
    MATCH (opp:Opportunity {id: opportunityId})
    OPTIONAL MATCH (opp)-[:HAS_ANALYSIS]->(analysis:Analysis)
    OPTIONAL MATCH (opp)<-[:TARGETS]-(response:Response)
    OPTIONAL MATCH (response)-[:TRIGGERS]->(outreach:Outreach)
    
    RETURN {
        opportunity: properties(opp),
        analysis: properties(analysis),
        response: properties(response),
        outreach: properties(outreach),
        journeyStatus: CASE 
            WHEN outreach.status = 'sent' THEN 'outreach_initiated'
            WHEN response.id IS NOT NULL THEN 'response_ready'
            WHEN analysis.id IS NOT NULL THEN 'analyzed'
            ELSE 'detected'
        END
    };
END;

// AUTONOMOUS SYSTEM FUNCTIONS

// Function to identify high-value opportunities
CREATE OR REPLACE FUNCTION identifyHighValueOpportunities(minFitScore FLOAT DEFAULT 70.0)
RETURNS TABLE(oppId STRING, title STRING, fitScore FLOAT, organizationName STRING, deadline STRING) AS
BEGIN
    MATCH (opp:Opportunity)
    WHERE opp.fitScore >= minFitScore
      AND opp.status IN ['detected', 'analyzing', 'qualified']
      AND opp.deadline >= timestamp()
    OPTIONAL MATCH (opp)<-[:PUBLISHED]-(org:Organization)
    RETURN opp.id AS oppId, opp.title AS title, opp.fitScore AS fitScore, org.name AS organizationName, opp.deadline AS deadline
    ORDER BY opp.fitScore DESC, opp.deadline ASC;
END;

// Function to get learning insights from similar opportunities
CREATE OR REPLACE FUNCTION getLearningInsights(opportunityId STRING)
RETURNS MAP AS
BEGIN
    MATCH (target:Opportunity {id: opportunityId})
    
    // Find similar successful opportunities
    OPTIONAL MATCH (target)-[:SIMILAR_TO]-(similar:Opportunity)
    WHERE similar.status = 'won'
    
    // Find similar failed opportunities  
    OPTIONAL MATCH (target)-[:SIMILAR_TO]-(failed:Opportunity)
    WHERE failed.status = 'lost'
    
    RETURN {
        successfulPatterns: COLLECT(DISTINCT similar.successFactors),
        failurePatterns: COLLECT(DISTINCT failed.failureReasons),
        recommendedApproach: 
            CASE 
                WHEN COUNT(similar) > COUNT(failed) THEN 'similar_successful'
                WHEN COUNT(failed) > COUNT(similar) THEN 'avoid_similar_failures'
                ELSE 'new_approach'
            END,
        confidenceLevel: 
            CASE 
                WHEN COUNT(similar) + COUNT(failed) > 5 THEN 'high'
                WHEN COUNT(similar) + COUNT(failed) > 2 THEN 'medium'
                ELSE 'low'
            END
    };
END;

// Sample data insertion for testing
/*
CALL createOrUpdateOrganization(
    'org-1', 
    'Manchester City FC', 
    'sports', 
    'large', 
    'Manchester, UK', 
    'https://www.mancity.com',
    'Premier League football club'
);

CALL createOrUpdatePerson(
    'person-1',
    'John Smith',
    'Technical Director',
    'john.smith@mancity.com',
    'https://linkedin.com/in/johnsmith',
    'org-1',
    'senior',
    'technical'
);

CALL createOrUpdateOpportunity(
    'opp-1',
    'Stadium Technology Upgrade',
    'Complete digital transformation of stadium systems',
    'linkedin',
    'https://example.com/rfp',
    'org-1',
    '2024-03-15',
    '£500K-£1M',
    ['IoT', 'Connectivity', 'Fan Experience'],
    85.5
);

CALL createAnalysis(
    'analysis-1',
    'opp-1',
    85.5,
    'Strong fit with our smart stadium experience and IoT capabilities',
    ['Relevant industry experience', 'Technical capabilities match'],
    ['Tight deadline', 'Large organization may have complex procurement'],
    ['Focus on fan experience differentiation', 'Leverage similar project case studies'],
    0.85,
    'claude-3-sonnet'
);
*/

-- Completion message
RETURN 'Level 3 Autonomous RFP System Neo4j schema created successfully! 
Ready for intelligent relationship mapping and autonomous agent operations.';