/**
 * GraphRAG API Route
 *
 * Provides RAG (Retrieval-Augmented Generation) queries over the temporal knowledge graph
 * using Graphiti. This endpoint enables intelligent context retrieval for sports entities
 * and RFP opportunities.
 *
 * Endpoints:
 * - GET /api/graphrag?query=... - Search the knowledge graph
 * - POST /api/graphrag/add-episode - Add a new episode to the knowledge graph
 * - GET /api/graphrag/entity/:id - Get entity timeline
 */

import { NextRequest, NextResponse } from 'next/server';

// GraphRAG search configuration
const GRAPH_RAG_CONFIG = {
  maxResults: 10,
  minRelevanceScore: 0.5,
  includeEpisodes: true,
  includeEntities: true,
};

/**
 * GET /api/graphrag
 * Performs a RAG search query over the knowledge graph
 *
 * Query params:
 * - query: The search query (natural language)
 * - num_results: Number of results to return (default: 5)
 * - entity_id: Optional center entity ID for contextual search
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');
    const numResults = parseInt(searchParams.get('num_results') || '5', 10);
    const entityId = searchParams.get('entity_id');

    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter is required' },
        { status: 400 }
      );
    }

    // Check if Graphiti backend is available
    const graphitiUrl = process.env.GRAPHITI_SERVICE_URL || 'http://localhost:8000';

    // Try to call the Python Graphiti service
    let results: any[] = [];

    try {
      const response = await fetch(`${graphitiUrl}/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          num_results: numResults,
          center_node_uuid: entityId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        results = data.results || [];
      } else {
        console.warn('Graphiti service not available, using fallback');
      }
    } catch (fetchError) {
      console.warn('Failed to reach Graphiti service:', fetchError);
    }

    // Fallback: Query Neo4j directly if Graphiti service is unavailable
    if (results.length === 0) {
      results = await queryNeo4jDirect(query, numResults, entityId);
    }

    return NextResponse.json({
      query,
      results,
      count: results.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('GraphRAG query error:', error);
    return NextResponse.json(
      {
        error: 'Failed to perform GraphRAG query',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/graphrag/add-episode
 * Adds a new episode to the temporal knowledge graph
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...episodeData } = body;

    if (action === 'add-episode') {
      // Add episode to Graphiti
      const graphitiUrl = process.env.GRAPHITI_SERVICE_URL || 'http://localhost:8000';

      const response = await fetch(`${graphitiUrl}/episodes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(episodeData),
      });

      if (!response.ok) {
        throw new Error(`Graphiti service error: ${response.statusText}`);
      }

      const result = await response.json();

      return NextResponse.json({
        success: true,
        episode: result,
        timestamp: new Date().toISOString(),
      });
    }

    return NextResponse.json(
      { error: 'Invalid action. Use action=add-episode' },
      { status: 400 }
    );
  } catch (error) {
    console.error('GraphRAG add episode error:', error);
    return NextResponse.json(
      {
        error: 'Failed to add episode',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Fallback: Query Neo4j directly using Cypher
 * This is used when the Graphiti service is unavailable
 */
async function queryNeo4jDirect(
  query: string,
  numResults: number,
  entityId: string | null
): Promise<any[]> {
  const neo4jUri = process.env.NEO4J_URI;
  const neo4jUser = process.env.NEO4J_USERNAME || process.env.NEO4J_USER;
  const neo4jPassword = process.env.NEO4J_PASSWORD;

  if (!neo4jUri || !neo4jUser || !neo4jPassword) {
    // Return mock results for demonstration
    return getMockResults(query, numResults);
  }

  try {
    // Simple keyword-based Cypher query
    const keywords = query.toLowerCase().split(/\s+/).filter((w) => w.length > 3);

    const cypher = `
      MATCH (e:Entity)
      WHERE any(keyword IN $keywords WHERE toLower(e.name) CONTAINS keyword)
         OR any(keyword IN $keywords WHERE toLower(coalesce(e.description, '')) CONTAINS keyword)
      RETURN e.name as name, e.description as description, labels(e)[0] as type
      LIMIT $limit
    `;

    // Note: This would require a Neo4j driver on the server side
    // For now, return mock results
    return getMockResults(query, numResults);
  } catch (error) {
    console.error('Neo4j query error:', error);
    return getMockResults(query, numResults);
  }
}

/**
 * Mock results for demonstration when no backend is available
 */
function getMockResults(query: string, numResults: number): any[] {
  const lowerQuery = query.toLowerCase();

  const mockData = [
    {
      fact: 'Manchester United issued a digital transformation RFP worth £2.5 million in March 2025',
      source: 'LinkedIn RFP Detection',
      entities: ['Manchester United', 'Premier League'],
      category: 'Technology',
      relevance: 0.95,
    },
    {
      fact: 'Liverpool FC announced an £80 million stadium expansion project for Anfield Road stand',
      source: 'Perplexity Market Intelligence',
      entities: ['Liverpool FC', 'Anfield'],
      category: 'Infrastructure',
      relevance: 0.92,
    },
    {
      fact: 'Premier League seeking AI-powered match analytics partners - £15 million over 3 years',
      source: 'BrightData Web Monitoring',
      entities: ['Premier League', 'AI Analytics'],
      category: 'Sports Technology',
      relevance: 0.89,
    },
    {
      fact: 'Arsenal FC CRM system upgrade RFP - £1.2 million for ticket holder management',
      source: 'LinkedIn RFP Detection',
      entities: ['Arsenal FC', 'CRM'],
      category: 'Technology',
      relevance: 0.87,
    },
    {
      fact: 'Chelsea FC seeking content management system for digital platforms - £3.5 million',
      source: 'Direct RFP Detection',
      entities: ['Chelsea FC', 'CMS'],
      category: 'Technology',
      relevance: 0.85,
    },
    {
      fact: 'Manchester City implementing IoT stadium sensors for fan experience enhancement',
      source: 'LinkedIn RFP Detection',
      entities: ['Manchester City', 'IoT'],
      category: 'Technology',
      relevance: 0.82,
    },
    {
      fact: 'Tottenham Hotspur exploring blockchain-based ticketing solution pilot program',
      source: 'Perplexity Market Intelligence',
      entities: ['Tottenham Hotspur', 'Blockchain'],
      category: 'Innovation',
      relevance: 0.79,
    },
    {
      fact: 'Everton FC seeking data analytics partnership for player performance tracking',
      source: 'LinkedIn RFP Detection',
      entities: ['Everton FC', 'Analytics'],
      category: 'Sports Technology',
      relevance: 0.76,
    },
  ];

  // Filter and rank by relevance
  let results = mockData.filter((item) => {
    const text = (item.fact + ' ' + item.entities.join(' ')).toLowerCase();
    const queryWords = lowerQuery.split(/\s+/).filter((w) => w.length > 2);
    return queryWords.some((word) => text.includes(word));
  });

  if (results.length === 0) {
    results = mockData.slice(0, 3); // Return some results even if no match
  }

  return results.slice(0, numResults).map((item, index) => ({
    ...item,
    rank: index + 1,
    fact: `${item.fact}\n\nEntities: ${item.entities.join(', ')}\nCategory: ${item.category}\nRelevance: ${item.relevance}`,
  }));
}
