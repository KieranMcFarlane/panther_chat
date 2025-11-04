# Fix for Neo4j MCP Parameter Issues

## Problem
The native Neo4j MCP `execute_query` tool requires both `query` AND `params` parameters, even if params is empty.

## Current Failing Code (lines 53-60 in sports-intelligence-tools.ts):
```javascript
arguments: { 
  query: `MATCH (n) 
         RETURN count(n) as totalEntities,
                count(CASE WHEN n.enrichmentStatus IS NOT NULL THEN 1 END) as enrichedEntities,
                count(CASE WHEN n.keyPersonnel IS NOT NULL AND size(n.keyPersonnel) > 0 THEN 1 END) as entitiesWithPersonnel,
                count(CASE WHEN n.digitalMaturityScore IS NOT NULL THEN 1 END) as entitiesWithDigitalScores,
                count(CASE WHEN n.opportunityScore IS NOT NULL THEN 1 END) as entitiesWithOpportunityScores` 
}
```

## Fixed Code:
```javascript
arguments: { 
  query: `MATCH (n) 
         RETURN count(n) as totalEntities,
                count(CASE WHEN n.enrichmentStatus IS NOT NULL THEN 1 END) as enrichedEntities,
                count(CASE WHEN n.keyPersonnel IS NOT NULL AND size(n.keyPersonnel) > 0 THEN 1 END) as entitiesWithPersonnel,
                count(CASE WHEN n.digitalMaturityScore IS NOT NULL THEN 1 END) as entitiesWithDigitalScores,
                count(CASE WHEN n.opportunityScore IS NOT NULL THEN 1 END) as entitiesWithOpportunityScores`,
  params: {}  // THIS LINE WAS MISSING!
}
```

## What to Change
1. Add `, params: {}` after the query string in getEntityCount tool
2. Make sure all other tools that call `execute_query` include the `params` field
3. Use the helper functions I created in `neo4j-helper.ts` for consistency

## Working Example from Terminal Logs
Line 986-992 shows the correct format that works:
```javascript
{
  name: 'execute_query',
  arguments: {
    query: 'MATCH (n) WHERE n.name CONTAINS $organizationName OR n.clubName CONTAINS $organizationName RETURN n.name as organizationName, n.keyPersonnel as keyPersonnel, n.notes as accessibilityNotes LIMIT 1',
    params: { organizationName: 'Arsenal' }  // ✅ This works!
  }
}
```
