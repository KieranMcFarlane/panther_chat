/**
 * 🔵 Neo4j Knowledge Graph Schema for Level 3 Autonomous RFP System
 * Complete relationship structure for intelligent decision making
 */

// Create constraints for unique identifiers
CREATE CONSTRAINT organization_id_unique IF NOT EXISTS FOR (o:Organization) REQUIRE o.neo4j_id IS UNIQUE;
CREATE CONSTRAINT person_id_unique IF NOT EXISTS FOR (p:Person) REQUIRE p.neo4j_id IS UNIQUE;
CREATE CONSTRAINT opportunity_id_unique IF NOT EXISTS FOR (opp:Opportunity) REQUIRE opp.neo4j_id IS UNIQUE;
CREATE CONSTRAINT proposal_id_unique IF NOT EXISTS FOR (prop:Proposal) REQUIRE prop.neo4j_id IS UNIQUE;
CREATE CONSTRAINT agent_id_unique IF NOT EXISTS FOR (a:Agent) REQUIRE a.agent_id IS UNIQUE;

// Create indexes for performance
CREATE INDEX organization_name_index IF NOT EXISTS FOR (o:Organization) ON (o.name);
CREATE INDEX organization_industry_index IF NOT EXISTS FOR (o:Organization) ON (o.industry);
CREATE INDEX person_name_index IF NOT EXISTS FOR (p:Person) ON (p.name);
CREATE INDEX person_role_index IF NOT EXISTS FOR (p:Person) ON (p.role);
CREATE INDEX opportunity_title_index IF NOT EXISTS FOR (opp:Opportunity) ON (opp.title);
CREATE INDEX opportunity_value_index IF NOT EXISTS FOR (opp:Opportunity) ON (opp.value);
CREATE INDEX opportunity_deadline_index IF NOT EXISTS FOR (opp:Opportunity) ON (opp.deadline);
CREATE INDEX agent_type_index IF NOT EXISTS FOR (a:Agent) ON (a.agent_type);
CREATE INDEX interaction_timestamp_index IF NOT EXISTS FOR (i:Interaction) ON (i.timestamp);

// Full-text search indexes
CREATE FULLTEXT INDEX organization_search_index IF NOT EXISTS FOR (o:Organization) ON EACH [o.name, o.description, o.industry];
CREATE FULLTEXT INDEX person_search_index IF NOT EXISTS FOR (p:Person) ON EACH [p.name, p.role, p.bio];
CREATE FULLTEXT INDEX opportunity_search_index IF NOT EXISTS FOR (opp:Opportunity) ON EACH [opp.title, opp.description, opp.requirements];

// ========================================
// NODE CREATION FUNCTIONS
// ========================================

// Function to create or update Organization node
CREATE OR REPLACE FUNCTION createOrganization(neo4j_id STRING, name STRING, industry STRING, size STRING, location STRING, website STRING, description STRING)
RETURNS VOID
LANGUAGE cypher
AS $$
MERGE (o:Organization {neo4j_id: $neo4j_id})
ON CREATE SET 
    o.name = $name,
    o.industry = $industry,
    o.size = $size,
    o.location = $location,
    o.website = $website,
    o.description = $description,
    o.created_at = datetime(),
    o.updated_at = datetime()
ON MATCH SET 
    o.name = $name,
    o.industry = $industry,
    o.size = $size,
    o.location = $location,
    o.website = $website,
    o.description = $description,
    o.updated_at = datetime()
RETURN o
$$;

// Function to create or update Person node
CREATE OR REPLACE FUNCTION createPerson(neo4j_id STRING, name STRING, role STRING, email STRING, linkedin STRING, bio STRING, influence_level INTEGER)
RETURNS VOID
LANGUAGE cypher
AS $$
MERGE (p:Person {neo4j_id: $neo4j_id})
ON CREATE SET 
    p.name = $name,
    p.role = $role,
    p.email = $email,
    p.linkedin = $linkedin,
    p.bio = $bio,
    p.influence_level = $influence_level,
    p.created_at = datetime(),
    p.updated_at = datetime()
ON MATCH SET 
    p.name = $name,
    p.role = $role,
    p.email = $email,
    p.linkedin = $linkedin,
    p.bio = $bio,
    p.influence_level = $influence_level,
    p.updated_at = datetime()
RETURN p
$$;

// Function to create or update Opportunity node
CREATE OR REPLACE FUNCTION createOpportunity(neo4j_id STRING, title STRING, organization STRING, value STRING, deadline STRING, category STRING, status STRING, fit_score INTEGER, source STRING)
RETURNS VOID
LANGUAGE cypher
AS $$
MERGE (opp:Opportunity {neo4j_id: $neo4j_id})
ON CREATE SET 
    opp.title = $title,
    opp.organization = $organization,
    opp.value = $value,
    opp.deadline = date($deadline),
    opp.category = $category,
    opp.status = $status,
    opp.fit_score = $fit_score,
    opp.source = $source,
    opp.created_at = datetime(),
    opp.updated_at = datetime()
ON MATCH SET 
    opp.title = $title,
    opp.organization = $organization,
    opp.value = $value,
    opp.deadline = date($deadline),
    opp.category = $category,
    opp.status = $status,
    opp.fit_score = $fit_score,
    opp.source = $source,
    opp.updated_at = datetime()
RETURN opp
$$;

// Function to create or update Agent node
CREATE OR REPLACE FUNCTION createAgent(agent_id STRING, agent_type STRING, capabilities LIST<STRING>, performance_score INTEGER, status STRING)
RETURNS VOID
LANGUAGE cypher
AS $$
MERGE (a:Agent {agent_id: $agent_id})
ON CREATE SET 
    a.agent_type = $agent_type,
    a.capabilities = $capabilities,
    a.performance_score = $performance_score,
    a.status = $status,
    a.created_at = datetime(),
    a.last_active = datetime()
ON MATCH SET 
    a.agent_type = $agent_type,
    a.capabilities = $capabilities,
    a.performance_score = $performance_score,
    a.status = $status,
    a.last_active = datetime()
RETURN a
$$;

// ========================================
// RELATIONSHIP CREATION FUNCTIONS
// ========================================

// Function to link Person to Organization
CREATE OR REPLACE FUNCTION linkPersonToOrganization(person_neo4j_id STRING, org_neo4j_id STRING, role STRING, start_date STRING)
RETURNS VOID
LANGUAGE cypher
AS $$
MATCH (p:Person {neo4j_id: $person_neo4j_id})
MATCH (o:Organization {neo4j_id: $org_neo4j_id})
MERGE (p)-[r:WORKS_AT]->(o)
ON CREATE SET 
    r.role = $role,
    r.start_date = date($start_date),
    r.created_at = datetime()
ON MATCH SET 
    r.role = $role,
    r.start_date = date($start_date)
RETURN r
$$;

// Function to link Person to Opportunity as decision maker
CREATE OR REPLACE FUNCTION linkDecisionMakerToOpportunity(person_neo4j_id STRING, opp_neo4j_id STRING, influence_level STRING, contact_method STRING, last_contact STRING)
RETURNS VOID
LANGUAGE cypher
AS $$
MATCH (p:Person {neo4j_id: $person_neo4j_id})
MATCH (opp:Opportunity {neo4j_id: $opp_neo4j_id})
MERGE (p)-[r:DECISION_MAKER_FOR]->(opp)
ON CREATE SET 
    r.influence_level = $influence_level,
    r.contact_method = $contact_method,
    r.last_contact = datetime($last_contact),
    r.created_at = datetime()
ON MATCH SET 
    r.influence_level = $influence_level,
    r.contact_method = $contact_method,
    r.last_contact = datetime($last_contact)
RETURN r
$$;

// Function to link Organization to Opportunity
CREATE OR REPLACE FUNCTION linkOrganizationToOpportunity(org_neo4j_id STRING, opp_neo4j_id STRING, source STRING, discovery_date STRING)
RETURNS VOID
LANGUAGE cypher
AS $$
MATCH (o:Organization {neo4j_id: $org_neo4j_id})
MATCH (opp:Opportunity {neo4j_id: $opp_neo4j_id})
MERGE (o)-[r:PUBLISHED]->(opp)
ON CREATE SET 
    r.source = $source,
    r.discovery_date = date($discovery_date),
    r.created_at = datetime()
ON MATCH SET 
    r.source = $source,
    r.discovery_date = date($discovery_date)
RETURN r
$$;

// Function to link Agent analysis to Opportunity
CREATE OR REPLACE FUNCTION linkAgentAnalysisToOpportunity(agent_id STRING, opp_neo4j_id STRING, fit_score INTEGER, analysis_date STRING, confidence_level INTEGER)
RETURNS VOID
LANGUAGE cypher
AS $$
MATCH (a:Agent {agent_id: $agent_id})
MATCH (opp:Opportunity {neo4j_id: $opp_neo4j_id})
MERGE (opp)-[r:ANALYZED_BY]->(a)
ON CREATE SET 
    r.fit_score = $fit_score,
    r.analysis_date = datetime($analysis_date),
    r.confidence_level = $confidence_level,
    r.created_at = datetime()
ON MATCH SET 
    r.fit_score = $fit_score,
    r.analysis_date = datetime($analysis_date),
    r.confidence_level = $confidence_level
RETURN r
$$;

// Function to create competitive relationships
CREATE OR REPLACE FUNCTION linkCompetitiveRelationship(org1_neo4j_id STRING, org2_neo4j_id STRING, market_overlap FLOAT, intensity STRING, category STRING)
RETURNS VOID
LANGUAGE cypher
AS $$
MATCH (o1:Organization {neo4j_id: $org1_neo4j_id})
MATCH (o2:Organization {neo4j_id: $org2_neo4j_id})
MERGE (o1)-[r:COMPETES_WITH]->(o2)
ON CREATE SET 
    r.market_overlap = $market_overlap,
    r.intensity = $intensity,
    r.category = $category,
    r.created_at = datetime(),
    r.updated_at = datetime()
ON MATCH SET 
    r.market_overlap = $market_overlap,
    r.intensity = $intensity,
    r.category = $category,
    r.updated_at = datetime()
RETURN r
$$;

// ========================================
// ANALYTICS AND INTELLIGENCE FUNCTIONS
// ========================================

// Function to find decision makers for an opportunity
CREATE OR REPLACE FUNCTION findDecisionMakersForOpportunity(opp_neo4j_id STRING)
RETURNS TABLE (
    person_name STRING,
    person_role STRING,
    influence_level STRING,
    contact_method STRING,
    organization_name STRING,
    organization_industry STRING
)
LANGUAGE cypher
AS $$
MATCH (p:Person)-[:DECISION_MAKER_FOR]->(opp:Opportunity {neo4j_id: $opp_neo4j_id})
MATCH (p)-[:WORKS_AT]->(o:Organization)
RETURN 
    p.name AS person_name,
    p.role AS person_role,
    r.influence_level AS influence_level,
    r.contact_method AS contact_method,
    o.name AS organization_name,
    o.industry AS organization_industry
ORDER BY toInteger(p.influence_level) DESC
$$;

// Function to find similar opportunities
CREATE OR REPLACE FUNCTION findSimilarOpportunities(opp_neo4j_id STRING, limit INTEGER)
RETURNS TABLE (
    title STRING,
    organization STRING,
    category STRING,
    value STRING,
    similarity_score FLOAT
)
LANGUAGE cypher
AS $$
MATCH (target:Opportunity {neo4j_id: $opp_neo4j_id})-[:PUBLISHED]->(target_org:Organization)
MATCH (similar:Opportunity)-[:PUBLISHED]->(similar_org:Organization)
WHERE target.category = similar.category
AND target.org_id <> similar.neo4j_id
AND similar.status IN ['discovered', 'analyzing', 'analyzed']
RETURN 
    similar.title AS title,
    similar.organization AS organization,
    similar.category AS category,
    similar.value AS value,
    // Calculate similarity based on category and organization characteristics
    CASE 
        WHEN target_org.industry = similar_org.industry THEN 0.9
        WHEN target_org.size = similar_org.size THEN 0.7
        ELSE 0.5
    END AS similarity_score
ORDER BY similarity_score DESC, similar.fit_score DESC
LIMIT $limit
$$;

// Function to get agent performance network
CREATE OR REPLACE FUNCTION getAgentPerformanceNetwork()
RETURNS TABLE (
    agent_id STRING,
    agent_type STRING,
    performance_score INTEGER,
    total_opportunities INTEGER,
    success_rate FLOAT,
    collaboration_count INTEGER,
    last_active DATETIME
)
LANGUAGE cypher
AS $$
MATCH (a:Agent)
OPTIONAL MATCH (a)<-[:ANALYZED_BY]-(opp:Opportunity)
WITH a, count(opp) as total_opportunities,
     avg(opp.fit_score) as avg_fit_score,
     size((a)<-[:ANALYZED_BY]-()) as analysis_count
OPTIONAL MATCH (a)-[:COLLABORATED_WITH]-(other:Agent)
WITH a, total_opportunities, avg_fit_score, analysis_count,
     count(other) as collaboration_count
RETURN 
    a.agent_id AS agent_id,
    a.agent_type AS agent_type,
    a.performance_score AS performance_score,
    total_opportunities,
     avg_fit_score AS success_rate,
     collaboration_count,
     a.last_active AS last_active
ORDER BY a.performance_score DESC
$$;

// Function to identify market opportunities
CREATE OR REPLACE FUNCTION identifyMarketOpportunities(industry STRING, min_fit_score INTEGER)
RETURNS TABLE (
    organization_name STRING,
    opportunity_count INTEGER,
    avg_fit_score FLOAT,
    decision_maker_count INTEGER,
    market_potential STRING
)
LANGUAGE cypher
AS $$
MATCH (o:Organization {industry: $industry})
OPTIONAL MATCH (o)-[:PUBLISHED]->(opp:Opportunity)
WHERE opp.fit_score >= $min_fit_score
WITH o, count(opp) as opportunity_count, avg(opp.fit_score) as avg_fit_score
OPTIONAL MATCH (o)<-[:WORKS_AT]-(p:Person)
WHERE p.influence_level > 6
WITH o, opportunity_count, avg_fit_score, count(p) as decision_maker_count
RETURN 
    o.name AS organization_name,
    opportunity_count,
    avg_fit_score,
    decision_maker_count,
    CASE 
        WHEN opportunity_count >= 3 AND decision_maker_count >= 2 THEN 'HIGH'
        WHEN opportunity_count >= 2 AND decision_maker_count >= 1 THEN 'MEDIUM'
        WHEN opportunity_count >= 1 THEN 'LOW'
        ELSE 'MINIMAL'
    END AS market_potential
ORDER BY opportunity_count DESC, avg_fit_score DESC
$$;

// Function to update agent learning from interactions
CREATE OR REPLACE FUNCTION updateAgentLearning(agent_id STRING, interaction_type STRING, outcome STRING, confidence_gain FLOAT)
RETURNS VOID
LANGUAGE cypher
AS $$
MATCH (a:Agent {agent_id: $agent_id})
// Create interaction node for learning
CREATE (i:Interaction {
    type: $interaction_type,
    outcome: $outcome,
    confidence_gain: $confidence_gain,
    timestamp: datetime()
})
// Link to agent
MERGE (a)-[:LEARNED_FROM]->(i)
// Update agent performance score based on learning
SET a.performance_score = CASE 
    WHEN $outcome = 'success' THEN a.performance_score + toInteger($confidence_gain * 10)
    WHEN $outcome = 'failure' THEN GREATEST(a.performance_score - 5, 0)
    ELSE a.performance_score
END,
a.last_active = datetime()
RETURN a
$$;

// Function to get knowledge graph summary
CREATE OR REPLACE FUNCTION getKnowledgeGraphSummary()
RETURNS TABLE (
    node_type STRING,
    count INTEGER,
    sample_properties STRING
)
LANGUAGE cypher
AS $$
CALL {
    MATCH (o:Organization) RETURN count(o) as org_count, 'Organization' as type
    UNION ALL
    MATCH (p:Person) RETURN count(p) as person_count, 'Person' as type
    UNION ALL
    MATCH (opp:Opportunity) RETURN count(opp) as opp_count, 'Opportunity' as type
    UNION ALL
    MATCH (a:Agent) RETURN count(a) as agent_count, 'Agent' as type
}
UNWIND [org_count, person_count, opp_count, agent_count] as counts
UNWIND ['Organization', 'Person', 'Opportunity', 'Agent'] as types
WITH types, counts
WHERE counts IS NOT NULL
RETURN types as node_type, counts as count,
CASE types
    WHEN 'Organization' THEN 'Industries: Sports, Entertainment, Technology'
    WHEN 'Person' THEN 'Roles: Decision makers, Technical leads, Executives'
    WHEN 'Opportunity' THEN 'Categories: Analytics, Digital Transformation, Platforms'
    WHEN 'Agent' THEN 'Types: Discovery, Intelligence, Action, Coordination'
END as sample_properties
$$;