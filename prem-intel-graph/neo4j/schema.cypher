// Premier League Intelligence Graph - Neo4j Schema
// This file contains the Cypher commands to set up the graph database structure
// EXTENDED to include Code Repository Knowledge Graph integration

// =============================================================================
// NODE CONSTRAINTS & INDEXES - PREMIER LEAGUE INTELLIGENCE
// =============================================================================

// Create unique constraints for primary identifiers
CREATE CONSTRAINT club_name_unique IF NOT EXISTS FOR (c:Club) REQUIRE c.name IS UNIQUE;
CREATE CONSTRAINT agency_name_unique IF NOT EXISTS FOR (a:Agency) REQUIRE a.name IS UNIQUE;
CREATE CONSTRAINT stakeholder_name_unique IF NOT EXISTS FOR (s:Stakeholder) REQUIRE s.name IS UNIQUE;
CREATE CONSTRAINT role_title_unique IF NOT EXISTS FOR (r:Role) REQUIRE r.title IS UNIQUE;
CREATE CONSTRAINT signal_type_name_unique IF NOT EXISTS FOR (st:SignalType) REQUIRE st.name IS UNIQUE;

// Create indexes for commonly queried properties
CREATE INDEX club_tier_index IF NOT EXISTS FOR (c:Club) ON (c.tier);
CREATE INDEX club_location_index IF NOT EXISTS FOR (c:Club) ON (c.location);
CREATE INDEX agency_specialty_index IF NOT EXISTS FOR (a:Agency) ON (a.specialty);
CREATE INDEX stakeholder_title_index IF NOT EXISTS FOR (s:Stakeholder) ON (s.title);
CREATE INDEX signal_date_index IF NOT EXISTS FOR (sig:Signal) ON (sig.date);
CREATE INDEX signal_score_index IF NOT EXISTS FOR (sig:Signal) ON (sig.score);
CREATE INDEX signal_intel_type_index IF NOT EXISTS FOR (sig:Signal) ON (sig.intelType);

// =============================================================================
// NODE CONSTRAINTS & INDEXES - CODE REPOSITORY KNOWLEDGE GRAPH
// =============================================================================

// Create unique constraints for code repository entities
CREATE CONSTRAINT repository_name_unique IF NOT EXISTS FOR (r:Repository) REQUIRE r.name IS UNIQUE;
CREATE CONSTRAINT file_path_unique IF NOT EXISTS FOR (f:File) REQUIRE (f.path, f.repository) IS UNIQUE;
CREATE CONSTRAINT class_full_name_unique IF NOT EXISTS FOR (cl:Class) REQUIRE (cl.full_name, cl.repository) IS UNIQUE;
CREATE CONSTRAINT method_signature_unique IF NOT EXISTS FOR (m:Method) REQUIRE (m.signature, m.class_name, m.repository) IS UNIQUE;
CREATE CONSTRAINT function_full_name_unique IF NOT EXISTS FOR (fn:Function) REQUIRE (fn.full_name, fn.repository) IS UNIQUE;

// Create indexes for code repository queries
CREATE INDEX repository_created_index IF NOT EXISTS FOR (r:Repository) ON (r.created_at);
CREATE INDEX file_extension_index IF NOT EXISTS FOR (f:File) ON (f.extension);
CREATE INDEX class_name_index IF NOT EXISTS FOR (cl:Class) ON (cl.name);
CREATE INDEX method_name_index IF NOT EXISTS FOR (m:Method) ON (m.name);
CREATE INDEX function_name_index IF NOT EXISTS FOR (fn:Function) ON (fn.name);

// =============================================================================
// SAMPLE DATA CREATION - PREMIER LEAGUE INTELLIGENCE
// =============================================================================

// Create Signal Types
MERGE (st1:SignalType {name: "Hiring"})
MERGE (st2:SignalType {name: "Fan Innovation"})
MERGE (st3:SignalType {name: "Tech Investment"})
MERGE (st4:SignalType {name: "Partnership"})
MERGE (st5:SignalType {name: "Digital Transformation"})
MERGE (st6:SignalType {name: "Sponsorship"})
MERGE (st7:SignalType {name: "Code Analysis"})
MERGE (st8:SignalType {name: "Technical Debt"})
MERGE (st9:SignalType {name: "AI Hallucination"});

// Create Premier League Clubs (Top 10)
MERGE (arsenal:Club {
  name: "Arsenal",
  tier: "Big 6",
  location: "London",
  digitalMaturity: "High"
})
MERGE (chelsea:Club {
  name: "Chelsea FC",
  tier: "Big 6",
  location: "London",
  digitalMaturity: "High"
})
MERGE (liverpool:Club {
  name: "Liverpool FC",
  tier: "Big 6",
  location: "Liverpool",
  digitalMaturity: "Very High"
})
MERGE (mancity:Club {
  name: "Manchester City",
  tier: "Big 6",
  location: "Manchester",
  digitalMaturity: "Very High"
})
MERGE (manutd:Club {
  name: "Manchester United",
  tier: "Big 6",
  location: "Manchester",
  digitalMaturity: "High"
})
MERGE (tottenham:Club {
  name: "Tottenham Hotspur",
  tier: "Big 6",
  location: "London",
  digitalMaturity: "Medium"
});

// Create Digital Agencies
MERGE (yellowPanther:Agency {
  name: "Yellow Panther",
  specialty: "Digital Innovation & Fan Engagement",
  pastWork: "Man City digital transformation, Arsenal fan app"
})
MERGE (lagardere:Agency {
  name: "Lagardère Sports",
  specialty: "Sports Marketing & Digital",
  pastWork: "Chelsea partnerships, Liverpool sponsorship activation"
})
MERGE (octagon:Agency {
  name: "Octagon",
  specialty: "Sports Marketing",
  pastWork: "Premier League digital rights, club partnerships"
});

// Create Roles
MERGE (cmo:Role {title: "Chief Marketing Officer", domain: "Marketing"})
MERGE (cto:Role {title: "Chief Technology Officer", domain: "Technology"})
MERGE (cdo:Role {title: "Chief Digital Officer", domain: "Digital"})
MERGE (headFan:Role {title: "Head of Fan Engagement", domain: "Fan Experience"})
MERGE (dirComm:Role {title: "Director of Communications", domain: "Communications"})
MERGE (headCrm:Role {title: "Head of CRM", domain: "Customer Relations"})
MERGE (leadDev:Role {title: "Lead Developer", domain: "Engineering"})
MERGE (devOps:Role {title: "DevOps Engineer", domain: "Engineering"})
MERGE (aiEng:Role {title: "AI Engineer", domain: "AI/ML"});

// Create Key Stakeholders
MERGE (tomGlick:Stakeholder {
  name: "Tom Glick",
  title: "Chief Operating Officer",
  linkedinUrl: "https://linkedin.com/in/tomglick",
  influenceScore: 85
})
MERGE (julietSlot:Stakeholder {
  name: "Juliet Slot",
  title: "Chief Marketing Officer",
  linkedinUrl: "https://linkedin.com/in/julietslot",
  influenceScore: 78
})
MERGE (peterMoore:Stakeholder {
  name: "Peter Moore",
  title: "Chief Executive Officer",
  linkedinUrl: "https://linkedin.com/in/petermoore",
  influenceScore: 92
});

// =============================================================================
// SAMPLE DATA CREATION - CODE REPOSITORY EXAMPLES
// =============================================================================

// Create sample repositories that might be relevant to Premier League clubs
MERGE (pantherRepo:Repository {
  name: "panther_chat",
  url: "https://github.com/yellowpanther/panther_chat",
  description: "AI-powered chat system for Premier League fan engagement",
  created_at: datetime("2024-01-01T00:00:00Z"),
  language: "Python"
});

MERGE (crawlRepo:Repository {
  name: "crawl4ai-rag",
  url: "internal",
  description: "RAG system with AI hallucination detection for code analysis",
  created_at: datetime("2024-01-01T00:00:00Z"),
  language: "Python"
});

// =============================================================================
// RELATIONSHIPS - PREMIER LEAGUE INTELLIGENCE
// =============================================================================

// Club-Agency Partnerships
MATCH (chelsea:Club {name: "Chelsea FC"})
MATCH (lagardere:Agency {name: "Lagardère Sports"})
MERGE (chelsea)-[:partneredWith]->(lagardere);

MATCH (mancity:Club {name: "Manchester City"})
MATCH (yellowPanther:Agency {name: "Yellow Panther"})
MERGE (mancity)-[:partneredWith]->(yellowPanther);

// Club-Stakeholder Employment
MATCH (chelsea:Club {name: "Chelsea FC"})
MATCH (tomGlick:Stakeholder {name: "Tom Glick"})
MERGE (chelsea)-[:employs]->(tomGlick);

MATCH (liverpool:Club {name: "Liverpool FC"})
MATCH (peterMoore:Stakeholder {name: "Peter Moore"})
MERGE (liverpool)-[:employs]->(peterMoore);

// Stakeholder-Role Assignments
MATCH (tomGlick:Stakeholder {name: "Tom Glick"})
MATCH (cmo:Role {title: "Chief Marketing Officer"})
MERGE (tomGlick)-[:role]->(cmo);

MATCH (peterMoore:Stakeholder {name: "Peter Moore"})
MATCH (cdo:Role {title: "Chief Digital Officer"})
MERGE (peterMoore)-[:role]->(cdo);

// =============================================================================
// RELATIONSHIPS - CODE REPOSITORY TO PREMIER LEAGUE INTEGRATION
// =============================================================================

// Link Yellow Panther agency to their repositories
MATCH (yellowPanther:Agency {name: "Yellow Panther"})
MATCH (pantherRepo:Repository {name: "panther_chat"})
MERGE (yellowPanther)-[:owns]->(pantherRepo);

MATCH (yellowPanther:Agency {name: "Yellow Panther"})
MATCH (crawlRepo:Repository {name: "crawl4ai-rag"})
MERGE (yellowPanther)-[:owns]->(crawlRepo);

// Example Signals
MERGE (signal1:Signal {
  headline: "Chelsea FC seeks Head of CRM",
  summary: "New job posting suggests focus on fan engagement strategy.",
  source: "https://careers.chelseafc.com/crm-head",
  date: date("2024-01-15"),
  score: 8.5,
  intelType: "Hiring"
})
MERGE (signal2:Signal {
  headline: "Arsenal announces new digital fan experience platform",
  summary: "Club partners with tech startup for immersive matchday experience.",
  source: "https://arsenal.com/news/digital-innovation",
  date: date("2024-01-20"),
  score: 9.2,
  intelType: "Tech Investment"
})
MERGE (signal3:Signal {
  headline: "AI hallucinations detected in Manchester City's chatbot code",
  summary: "Code analysis reveals potential issues in AI-generated fan engagement scripts.",
  source: "internal_analysis",
  date: date("2024-01-25"),
  score: 7.8,
  intelType: "AI Hallucination"
});

// Connect Signals
MATCH (chelsea:Club {name: "Chelsea FC"})
MATCH (signal1:Signal {headline: "Chelsea FC seeks Head of CRM"})
MATCH (st1:SignalType {name: "Hiring"})
MERGE (chelsea)-[:emits]->(signal1)
MERGE (signal1)-[:type]->(st1);

MATCH (arsenal:Club {name: "Arsenal"})
MATCH (signal2:Signal {headline: "Arsenal announces new digital fan experience platform"})
MATCH (st3:SignalType {name: "Tech Investment"})
MERGE (arsenal)-[:emits]->(signal2)
MERGE (signal2)-[:type]->(st3);

MATCH (mancity:Club {name: "Manchester City"})
MATCH (signal3:Signal {headline: "AI hallucinations detected in Manchester City's chatbot code"})
MATCH (st9:SignalType {name: "AI Hallucination"})
MERGE (mancity)-[:emits]->(signal3)
MERGE (signal3)-[:type]->(st9);

// =============================================================================
// UTILITY QUERIES FOR VALIDATION
// =============================================================================

// Verify schema creation
// CALL db.schema.visualization();

// Count nodes by type
// MATCH (n) RETURN labels(n) as NodeType, count(n) as Count;

// Show all relationships
// MATCH ()-[r]->() RETURN type(r) as RelationshipType, count(r) as Count; 