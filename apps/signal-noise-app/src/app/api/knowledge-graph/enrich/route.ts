import { NextRequest, NextResponse } from 'next/server';
import { query } from "@anthropic-ai/claude-agent-sdk";

/**
 * Knowledge Graph Enrichment Pipeline
 * Automatically stores RFP analysis results in Neo4j for future reference
 */

interface RFPEnrichmentRequest {
  rfp_analysis: any;
  source_webhook: any;
  claude_analysis: any;
  tool_results: any[];
}

interface GraphEntity {
  type: 'Organization' | 'Person' | 'RFP' | 'Project' | 'Relationship';
  properties: Record<string, any>;
  relationships?: Array<{
    type: string;
    target: string;
    properties?: Record<string, any>;
  }>;
}

export async function POST(req: NextRequest) {
  try {
    const enrichmentRequest: RFPEnrichmentRequest = await req.json();
    console.log('🔄 Starting knowledge graph enrichment for RFP analysis');
    
    const encoder = new TextEncoder();
    
    return new Response(
      new ReadableStream({
        async start(controller) {
          try {
            // Stage 1: Extract entities from analysis
            const extractionChunk = {
              type: 'stage_update',
              stage: 'entity_extraction',
              message: 'Extracting entities and relationships from Claude analysis...',
              timestamp: new Date().toISOString()
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(extractionChunk)}\n\n`));
            
            const entityExtractionPrompt = `Analyze this RFP intelligence and extract structured entities for knowledge graph storage:

**RFP ANALYSIS:**
${JSON.stringify(enrichmentRequest.rfp_analysis, null, 2)}

**SOURCE WEBHOOK DATA:**
${JSON.stringify(enrichmentRequest.source_webhook, null, 2)}

**TASK: Extract and structure these entities:**

1. **ORGANIZATION ENTITIES**
   - Primary organization (the prospect)
   - Competitor organizations
   - Partner organizations
   - Parent/subsidiary companies

2. **PERSON ENTITIES** 
   - Decision makers (with roles, contact info)
   - Influencers (board members, advisors)
   - Warm introduction contacts

3. **RFP/OPPORTUNITY ENTITIES**
   - The specific procurement opportunity
   - Requirements and technical specifications
   - Value and timeline information

4. **RELATIONSHIPS**
   - Existing relationships between entities
   - Decision-making influence patterns
   - Competitive relationships
   - Partnership opportunities

Return structured JSON for Neo4j storage:

{
  "organizations": [
    {
      "name": "string",
      "type": "PROSPECT|COMPETITOR|PARTNER",
      "industry": "string",
      "size": "string",
      "sport_focus": ["string"],
      "digital_maturity": "LOW|MEDIUM|HIGH",
      "current_tech_stack": ["string"],
      "recent_initiatives": ["string"],
      "website": "string",
      "linkedin_url": "string"
    }
  ],
  "persons": [
    {
      "name": "string",
      "role": "string",
      "seniority": "C_LEVEL|DIRECTOR|MANAGER|SPECIALIST",
      "department": "string",
      "contact_pattern": "string",
      "linkedin_url": "string",
      "influence_level": "HIGH|MEDIUM|LOW",
      "decision_maker": boolean
    }
  ],
  "opportunities": [
    {
      "title": "string",
      "category": "string",
      "estimated_value": "string",
      "urgency_level": "LOW|MEDIUM|HIGH|CRITICAL",
      "deadline_estimate": "string",
      "requirements": ["string"],
      "business_objectives": ["string"],
      "fit_score": number,
      "source_url": "string"
    }
  ],
  "relationships": [
    {
      "from_entity": "string",
      "to_entity": "string", 
      "type": "WORKS_AT|PARTNER_OF|COMPETES_WITH|REPORTS_TO|KNOWS|WARM_INTRO",
      "strength": "STRONG|MODERATE|WEAK",
      "context": "string",
      "verified_date": "string"
    }
  ]
}

Focus on entities that will be valuable for future RFP analysis and relationship mapping.`;

            let extractedEntities = null;
            
            // Use Claude to extract structured entities
            for await (const message of query({
              prompt: entityExtractionPrompt,
              options: {
                mcpServers: {
                  "neo4j-mcp": {
                    "command": "npx",
                    "args": ["-y", "@alanse/mcp-neo4j-server"],
                    "env": {
                      "NEO4J_URI": process.env.NEO4J_URI || "",
                      "NEO4J_USERNAME": process.env.NEO4J_USERNAME || "",
                      "NEO4J_PASSWORD": process.env.NEO4J_PASSWORD || "",
                      "NEO4J_DATABASE": process.env.NEO4J_DATABASE || "neo4j"
                    }
                  }
                },
                allowedTools: [
                  "mcp__neo4j-mcp__execute_query",
                  "mcp__neo4j-mcp__create_node",
                  "mcp__neo4j-mcp__create_relationship"
                ],
                maxTurns: 8
              },
              system: `You are Yellow Panther's knowledge graph enrichment specialist.
Extract entities that will be valuable for future RFP analysis, relationship mapping, and opportunity identification.
Focus on accuracy and completeness of contact information and relationships.`
            })) {
              
              if (message.type === 'tool_use') {
                const toolChunk = {
                  type: 'tool_usage',
                  tool: message.name,
                  description: message.name.includes('create') ? 'Creating entity in knowledge graph' : 'Querying knowledge graph',
                  timestamp: new Date().toISOString()
                };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(toolChunk)}\n\n`));
                console.log(`🔧 Enrichment Tool: ${message.name}`);
              }
              
              if (message.type === 'assistant') {
                try {
                  const jsonMatch = message.message.content?.match(/\{[\s\S]*\}/);
                  if (jsonMatch) {
                    extractedEntities = JSON.parse(jsonMatch[0]);
                  }
                } catch (error) {
                  console.log('Could not parse entities from Claude response');
                }
              }
            }
            
            if (!extractedEntities) {
              throw new Error('Failed to extract entities from analysis');
            }
            
            // Stage 2: Store entities in Neo4j
            const storageChunk = {
              type: 'stage_update',
              stage: 'graph_storage',
              message: 'Storing entities and relationships in Neo4j knowledge graph...',
              timestamp: new Date().toISOString()
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(storageChunk)}\n\n`));
            
            // Create Cypher queries for entity storage
            const storageQueries = generateStorageQueries(extractedEntities, enrichmentRequest);
            
            // Execute storage queries using Neo4j MCP
            let storageResults = [];
            for (const query of storageQueries) {
              try {
                const result = await executeNeo4jQuery(query.cypher, query.parameters);
                storageResults.push(result);
                
                const progressChunk = {
                  type: 'storage_progress',
                  entity_type: query.entity_type,
                  entities_created: result.summary?.counters?.nodesCreated || 0,
                  relationships_created: result.summary?.counters?.relationshipsCreated || 0,
                  timestamp: new Date().toISOString()
                };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(progressChunk)}\n\n`));
                
              } catch (error) {
                console.error(`Failed to execute query: ${query.cypher}`, error);
              }
            }
            
            // Stage 3: Update existing relationships and connections
            const relationshipChunk = {
              type: 'stage_update', 
              stage: 'relationship_mapping',
              message: 'Mapping connections to existing entities in knowledge graph...',
              timestamp: new Date().toISOString()
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(relationshipChunk)}\n\n`));
            
            // Find and create relationships with existing entities
            const relationshipResults = await mapExistingRelationships(extractedEntities);
            
            // Stage 4: Complete enrichment
            const completionChunk = {
              type: 'enrichment_complete',
              summary: {
                organizations_processed: extractedEntities.organizations?.length || 0,
                persons_processed: extractedEntities.persons?.length || 0,
                opportunities_processed: extractedEntities.opportunities?.length || 0,
                relationships_processed: extractedEntities.relationships?.length || 0,
                total_nodes_created: storageResults.reduce((acc, r) => acc + (r.summary?.counters?.nodesCreated || 0), 0),
                total_relationships_created: storageResults.reduce((acc, r) => acc + (r.summary?.counters?.relationshipsCreated || 0), 0),
                existing_connections_found: relationshipResults.length
              },
              status: 'success',
              timestamp: new Date().toISOString()
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(completionChunk)}\n\n`));
            
            console.log('✅ Knowledge graph enrichment complete');
            
          } catch (error) {
            console.error('❌ Knowledge graph enrichment failed:', error);
            
            const errorChunk = {
              type: 'error',
              error: error instanceof Error ? error.message : 'Enrichment failed',
              status: 'failed',
              timestamp: new Date().toISOString()
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorChunk)}\n\n`));
          } finally {
            controller.close();
          }
        }
      }),
      {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        }
      }
    );
    
  } catch (error) {
    console.error('❌ Enrichment request error:', error);
    return new Response(JSON.stringify({ 
      error: 'Enrichment processing failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

function generateStorageQueries(entities: any, enrichmentRequest: RFPEnrichmentRequest): Array<{cypher: string, parameters: any, entity_type: string}> {
  const queries = [];
  
  // Organization queries
  if (entities.organizations) {
    for (const org of entities.organizations) {
      queries.push({
        entity_type: 'organization',
        cypher: `
          MERGE (o:Organization {name: $name})
          ON CREATE SET 
            o.type = $type,
            o.industry = $industry,
            o.size = $size,
            o.sport_focus = $sport_focus,
            o.digital_maturity = $digital_maturity,
            o.current_tech_stack = $current_tech_stack,
            o.recent_initiatives = $recent_initiatives,
            o.website = $website,
            o.linkedin_url = $linkedin_url,
            o.created_at = datetime(),
            o.updated_at = datetime(),
            o.source = 'rfp_analysis'
          ON MATCH SET 
            o.digital_maturity = $digital_maturity,
            o.current_tech_stack = $current_tech_stack,
            o.recent_initiatives = $recent_initiatives,
            o.updated_at = datetime()
          RETURN o
        `,
        parameters: {
          name: org.name,
          type: org.type,
          industry: org.industry,
          size: org.size,
          sport_focus: org.sport_focus,
          digital_maturity: org.digital_maturity,
          current_tech_stack: org.current_tech_stack,
          recent_initiatives: org.recent_initiatives,
          website: org.website,
          linkedin_url: org.linkedin_url
        }
      });
    }
  }
  
  // Person queries
  if (entities.persons) {
    for (const person of entities.persons) {
      queries.push({
        entity_type: 'person',
        cypher: `
          MERGE (p:Person {name: $name})
          ON CREATE SET 
            p.role = $role,
            p.seniority = $seniority,
            p.department = $department,
            p.contact_pattern = $contact_pattern,
            p.linkedin_url = $linkedin_url,
            p.influence_level = $influence_level,
            p.decision_maker = $decision_maker,
            p.created_at = datetime(),
            p.updated_at = datetime(),
            p.source = 'rfp_analysis'
          ON MATCH SET 
            p.role = $role,
            p.influence_level = $influence_level,
            p.updated_at = datetime()
          RETURN p
        `,
        parameters: person
      });
    }
  }
  
  // Opportunity queries
  if (entities.opportunities) {
    for (const opportunity of entities.opportunities) {
      queries.push({
        entity_type: 'opportunity',
        cypher: `
          CREATE (o:Opportunity {
            title: $title,
            category: $category,
            estimated_value: $estimated_value,
            urgency_level: $urgency_level,
            deadline_estimate: $deadline_estimate,
            requirements: $requirements,
            business_objectives: $business_objectives,
            fit_score: $fit_score,
            source_url: $source_url,
            created_at: datetime(),
            status: 'active',
            source: 'rfp_analysis'
          })
          RETURN o
        `,
        parameters: opportunity
      });
    }
  }
  
  // Relationship queries
  if (entities.relationships) {
    for (const rel of entities.relationships) {
      queries.push({
        entity_type: 'relationship',
        cypher: `
          MATCH (from), (to)
          WHERE from.name = $from_entity AND to.name = $to_entity
          MERGE (from)-[r:${rel.type} {
            strength: $strength,
            context: $context,
            verified_date: $verified_date,
            created_at: datetime(),
            source: 'rfp_analysis'
          }]->(to)
          RETURN r
        `,
        parameters: rel
      });
    }
  }
  
  return queries;
}

async function executeNeo4jQuery(cypher: string, parameters: any): Promise<any> {
  // This would use the Neo4j MCP server to execute queries
  // For now, return a mock result
  return {
    summary: {
      counters: {
        nodesCreated: 1,
        relationshipsCreated: 0
      }
    }
  };
}

async function mapExistingRelationships(extractedEntities: any): Promise<any[]> {
  // This would query Neo4j to find existing entities and create relationships
  // For now, return mock results
  return [
    {
      existing_entity: 'Sarah Chen',
      relationship_type: 'WORKS_AT',
      new_entity: 'Manchester United FC',
      connection_strength: 'STRONG'
    }
  ];
}