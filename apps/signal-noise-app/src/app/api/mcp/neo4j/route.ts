import { NextRequest, NextResponse } from 'next/server';

// Neo4j MCP Server configuration
const MCP_SERVER_URL = process.env.MCP_SERVER_URL || 'http://localhost:3001';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('Neo4j MCP request:', body);
    
    // Handle RFP operations
    if (body.operation === 'createRFPNodes') {
      return await createRFPNodes(body.data);
    }
    
    // Handle traditional query operations
    if (body.query) {
      return await executeQuery(body.query, body.database);
    }
    
    return NextResponse.json(
      { error: 'Invalid request - missing operation or query' },
      { status: 400 }
    );
    
  } catch (error) {
    console.error('Neo4j MCP API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to execute Neo4j operation',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

async function executeQuery(query: string, database = 'neo4j') {
  try {
    console.log('Executing Neo4j query:', query);
    
    // Call MCP server (you'll need to run the MCP server separately)
    const response = await fetch(`${MCP_SERVER_URL}/neo4j/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'execute_query',
          arguments: {
            query,
            database
          }
        },
        id: Date.now()
      })
    });
    
    if (!response.ok) {
      throw new Error(`MCP server error: ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log('Neo4j query result:', result);
    
    return NextResponse.json({
      success: true,
      data: result.result || result,
      query: query
    });
    
  } catch (error) {
    console.error('Query execution error:', error);
    throw new Error(`Failed to execute query: ${error.message}`);
  }
}

async function createRFPNodes(rfpData: any[]) {
  try {
    console.log(`Creating ${rfpData.length} RFP nodes in Neo4j`);
    
    const results = [];
    
    for (const rfp of rfpData) {
      // Create comprehensive Cypher query for RFP with relationships
      const query = `
        // Create or update Organization
        MERGE (org:Organization {name: $organizationName})
        SET org.sport = $sport,
            org.type = 'Sports Organization',
            org.lastUpdated = timestamp()
        
        // Create or update Contact
        MERGE (contact:Contact {email: $contactEmail})
        SET contact.name = $contactName,
            contact.department = $contactDepartment,
            contact.organization = $organizationName,
            contact.linkedinUrl = $contactLinkedinUrl,
            contact.lastUpdated = timestamp()
        
        // Create or update RFP
        MERGE (rfp:RFP {id: $rfpId})
        SET rfp.title = $title,
            rfp.description = $description,
            rfp.procurementType = $procurementType,
            rfp.valueEstimate = $valueEstimate,
            rfp.deadline = datetime($deadline),
            rfp.opportunityScore = toInteger($opportunityScore),
            rfp.priorityLevel = $priorityLevel,
            rfp.status = $status,
            rfp.urgency = $urgency,
            rfp.submissionUrl = $submissionUrl,
            rfp.source = $source,
            rfp.discoveredAt = datetime($discoveredAt),
            rfp.yellowPantherFit = toInteger($yellowPantherFit),
            rfp.requirements = $requirements,
            rfp.evaluationCriteria = $evaluationCriteria,
            rfp.lastUpdated = timestamp()
        
        // Create relationships
        MERGE (org)-[:PUBLISHED_RFP {timestamp: timestamp()}]->(rfp)
        MERGE (contact)-[:CONTACT_PERSON_FOR {timestamp: timestamp()}]->(rfp)
        MERGE (rfp)-[:BELONGS_TO_ORGANIZATION]->(org)
        
        // Create sport relationship if specified
        WITH org, rfp
        CALL apoc.create.relationship(org, 'IN_SPORT_CATEGORY', {strength: 1.0}, rfp) YIELD rel
        RETURN org, contact, rfp
      `;

      const params = {
        organizationName: rfp.organization,
        sport: rfp.sport,
        contactEmail: rfp.contactInfo.email,
        contactName: rfp.contactInfo.name,
        contactDepartment: rfp.contactInfo.department,
        contactLinkedinUrl: rfp.contactInfo.linkedinUrl || '',
        rfpId: rfp.id,
        title: rfp.title,
        description: rfp.description,
        procurementType: rfp.procurementType,
        valueEstimate: rfp.valueEstimate,
        deadline: rfp.deadline.toISOString(),
        opportunityScore: rfp.opportunityScore,
        priorityLevel: rfp.priorityLevel,
        status: rfp.status,
        urgency: rfp.urgency,
        submissionUrl: rfp.submissionUrl || '',
        source: rfp.source,
        discoveredAt: rfp.discoveredAt.toISOString(),
        yellowPantherFit: rfp.yellowPantherFit,
        requirements: rfp.requirements,
        evaluationCriteria: rfp.evaluationCriteria
      };

      try {
        const result = await executeQuery(query);
        results.push({
          rfpId: rfp.id,
          status: 'success',
          result: result
        });
      } catch (error) {
        console.error(`Failed to create RFP ${rfp.id}:`, error);
        results.push({
          rfpId: rfp.id,
          status: 'error',
          error: error.message
        });
      }
    }

    const successCount = results.filter(r => r.status === 'success').length;
    
    return NextResponse.json({
      success: true,
      message: `Successfully processed ${rfpData.length} RFPs (${successCount} successful, ${rfpData.length - successCount} failed)`,
      results,
      stats: {
        total: rfpData.length,
        successful: successCount,
        failed: rfpData.length - successCount,
        nodesCreated: successCount * 3, // Organization + Contact + RFP
        relationshipsCreated: successCount * 4 // PUBLISHED_RFP + CONTACT_PERSON_FOR + BELONGS_TO_ORGANIZATION + IN_SPORT_CATEGORY
      }
    });

  } catch (error) {
    console.error('Error creating RFP nodes:', error);
    throw new Error(`Failed to create RFP nodes: ${error.message}`);
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}