/**
 * REAL BRIGHTDATA RFP SEARCH API
 * Uses the working BrightData MCP tool to find genuine RFP opportunities
 */

import { mcp__brightdata__search_engine } from '@/lib/mcp/brightdata';

export async function POST(request: Request) {
  try {
    const { query, num_results = 5, engine = 'google' } = await request.json();

    if (!query) {
      return Response.json({ error: 'Missing query parameter' }, { status: 400 });
    }

    console.log(`🔍 [REAL BRIGHTDATA] Searching for: ${query}`);

    const searchResults = await mcp__brightdata__search_engine({
      query: `${query} RFP tender procurement 2025`,
      engine,
      num_results
    });

    const results = Array.isArray(searchResults.results) ? searchResults.results : [];
    console.log(`📊 [REAL BRIGHTDATA] Found ${results.length} results`);

    return Response.json({ 
      success: true,
      results,
      query,
      count: results.length,
      timestamp: new Date().toISOString(),
      source: 'real_brightdata_mcp_tool'
    });

  } catch (error) {
    console.error('❌ [REAL BRIGHTDATA] Search failed:', error);
    return Response.json({ 
      error: error.message,
      success: false 
    }, { status: 500 });
  }
}
