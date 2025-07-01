// Premier League Intelligence Graph - Sample Queries
// Collection of useful Cypher queries for business intelligence and opportunity identification

// =============================================================================
// OPPORTUNITY IDENTIFICATION QUERIES
// =============================================================================

// 1. Clubs without digital agency but investing in fan engagement
MATCH (c:Club)-[:emits]->(s:Signal)-[:type]->(:SignalType {name: "Fan Innovation"})
WHERE NOT (c)-[:partneredWith]->(:Agency)
RETURN c.name AS club, s.headline AS signal, s.date AS signalDate, s.score AS signalScore
ORDER BY s.score DESC, s.date DESC;

// 2. High-scoring signals from last 30 days for unpartnered clubs
MATCH (c:Club)-[:emits]->(s:Signal)
WHERE NOT (c)-[:partneredWith]->(:Agency {name: "Yellow Panther"})
  AND s.date >= date() - duration({days: 30})
  AND s.score >= 8.0
RETURN c.name AS club, s.headline AS signal, s.score AS score, s.intelType AS type
ORDER BY s.score DESC;

// 3. Clubs showing multiple innovation signals (innovation cycle detection)
MATCH (c:Club)-[:emits]->(s:Signal)
WHERE s.intelType IN ["Tech Investment", "Fan Innovation", "Digital Transformation"]
  AND s.date >= date() - duration({days: 60})
WITH c, count(s) AS signalCount, collect(s.headline) AS signals
WHERE signalCount >= 2
RETURN c.name AS club, signalCount, signals
ORDER BY signalCount DESC;

// =============================================================================
// STAKEHOLDER INTELLIGENCE QUERIES
// =============================================================================

// 4. Top innovation-focused stakeholders at Arsenal
MATCH (s:Stakeholder)<-[:employs]-(c:Club {name: "Arsenal"})
MATCH (s)<-[:mentions]-(sig:Signal)
WHERE sig.intelType IN ["Tech Investment", "Fan Innovation"]
RETURN s.name AS stakeholder, s.title AS title, s.influenceScore AS influence, 
       count(sig) AS signalCount
ORDER BY signalCount DESC, s.influenceScore DESC
LIMIT 5;

// 5. Most influential stakeholders across all clubs
MATCH (s:Stakeholder)<-[:employs]-(c:Club)
OPTIONAL MATCH (s)<-[:mentions]-(sig:Signal)
RETURN s.name AS stakeholder, s.title AS title, c.name AS club, 
       s.influenceScore AS influence, count(sig) AS mentions
ORDER BY s.influenceScore DESC
LIMIT 10;

// 6. Recently hired stakeholders in digital/marketing roles
MATCH (s:Stakeholder)-[:role]->(r:Role)
MATCH (s)<-[:employs]-(c:Club)
OPTIONAL MATCH (s)<-[:mentions]-(sig:Signal {intelType: "Hiring"})
WHERE r.domain IN ["Digital", "Marketing", "Technology", "Fan Experience"]
  AND sig.date >= date() - duration({days: 90})
RETURN s.name AS stakeholder, s.title AS title, c.name AS club, r.domain AS domain
ORDER BY sig.date DESC;

// =============================================================================
// COMPETITIVE INTELLIGENCE QUERIES
// =============================================================================

// 7. Agency-Club partnership network
MATCH (c:Club)-[:partneredWith]->(a:Agency)
RETURN c.name AS club, c.tier AS clubTier, a.name AS agency, a.specialty AS agencySpecialty
ORDER BY c.tier, c.name;

// 8. Agencies working with multiple Big 6 clubs
MATCH (a:Agency)<-[:partneredWith]-(c:Club {tier: "Big 6"})
WITH a, count(c) AS clubCount, collect(c.name) AS clubs
WHERE clubCount > 1
RETURN a.name AS agency, clubCount, clubs
ORDER BY clubCount DESC;

// 9. Unpartnered Big 6 clubs with recent high-value signals
MATCH (c:Club {tier: "Big 6"})-[:emits]->(s:Signal)
WHERE NOT (c)-[:partneredWith]->(:Agency)
  AND s.score >= 7.0
  AND s.date >= date() - duration({days: 45})
RETURN c.name AS club, count(s) AS recentSignals, 
       avg(s.score) AS avgScore, max(s.date) AS latestSignal
ORDER BY avgScore DESC, recentSignals DESC;

// =============================================================================
// TREND ANALYSIS QUERIES
// =============================================================================

// 10. Signal distribution by type over last 90 days
MATCH (s:Signal)-[:type]->(st:SignalType)
WHERE s.date >= date() - duration({days: 90})
RETURN st.name AS signalType, count(s) AS signalCount, 
       avg(s.score) AS avgScore, max(s.date) AS latestSignal
ORDER BY signalCount DESC;

// 11. Club digital maturity vs signal activity correlation
MATCH (c:Club)-[:emits]->(s:Signal)
WHERE s.date >= date() - duration({days: 60})
WITH c, count(s) AS signalActivity, avg(s.score) AS avgSignalScore
RETURN c.name AS club, c.digitalMaturity AS maturity, 
       signalActivity, avgSignalScore
ORDER BY signalActivity DESC;

// 12. Geographic clustering of innovation signals
MATCH (c:Club)-[:emits]->(s:Signal)
WHERE s.intelType IN ["Tech Investment", "Fan Innovation"]
  AND s.date >= date() - duration({days: 90})
WITH c.location AS location, count(s) AS innovationSignals, 
     avg(s.score) AS avgScore
RETURN location, innovationSignals, avgScore
ORDER BY innovationSignals DESC;

// =============================================================================
// RELATIONSHIP MAPPING QUERIES
// =============================================================================

// 13. Two-hop connections: Find potential warm introductions
MATCH path = (target:Stakeholder)<-[:employs]-(targetClub:Club),
             (target)<-[:worksWith]-(sharedAgency:Agency)-[:worksWith]->(contact:Stakeholder)
WHERE targetClub.name = "Arsenal"  // Replace with target club
  AND NOT (targetClub)-[:partneredWith]->(sharedAgency)
RETURN target.name AS targetStakeholder, target.title AS targetTitle,
       sharedAgency.name AS connectionPoint, contact.name AS existingContact
LIMIT 10;

// 14. Stakeholder career trajectory (role changes)
MATCH (s:Stakeholder)<-[:mentions]-(sig:Signal {intelType: "Hiring"})
MATCH (s)-[:role]->(r:Role)
MATCH (s)<-[:employs]-(c:Club)
RETURN s.name AS stakeholder, c.name AS club, r.title AS currentRole,
       sig.date AS hireDate, sig.headline AS announcement
ORDER BY sig.date DESC;

// 15. Agency expertise mapping
MATCH (a:Agency)<-[:partneredWith]-(c:Club)-[:emits]->(s:Signal)-[:type]->(st:SignalType)
WHERE s.date >= date() - duration({days: 180})
WITH a, st.name AS signalType, count(s) AS signalCount
RETURN a.name AS agency, collect({type: signalType, count: signalCount}) AS expertiseAreas
ORDER BY a.name;

// =============================================================================
// ALERT GENERATION QUERIES
// =============================================================================

// 16. High-priority alerts: New signals above threshold
MATCH (c:Club)-[:emits]->(s:Signal)
WHERE s.date >= date() - duration({days: 7})
  AND s.score >= 8.5
  AND NOT (c)-[:partneredWith]->(:Agency {name: "Yellow Panther"})
RETURN c.name AS club, s.headline AS alert, s.score AS priority,
       s.intelType AS category, s.date AS alertDate
ORDER BY s.score DESC;

// 17. Role change detection
MATCH (s:Stakeholder)<-[:mentions]-(sig:Signal)
WHERE sig.intelType = "Hiring"
  AND sig.date >= date() - duration({days: 14})
MATCH (s)<-[:employs]-(c:Club)
RETURN s.name AS stakeholder, c.name AS club, sig.headline AS change,
       sig.date AS changeDate
ORDER BY sig.date DESC;

// 18. Partnership opportunity scoring
MATCH (c:Club)
WHERE NOT (c)-[:partneredWith]->(:Agency {name: "Yellow Panther"})
OPTIONAL MATCH (c)-[:emits]->(recentSignals:Signal)
WHERE recentSignals.date >= date() - duration({days: 60})
WITH c, count(recentSignals) AS signalActivity, 
     avg(recentSignals.score) AS avgScore,
     collect(DISTINCT recentSignals.intelType) AS signalTypes
RETURN c.name AS club, c.tier AS tier, c.digitalMaturity AS maturity,
       signalActivity, avgScore, signalTypes,
       (signalActivity * 0.4 + avgScore * 0.6) AS opportunityScore
ORDER BY opportunityScore DESC; 