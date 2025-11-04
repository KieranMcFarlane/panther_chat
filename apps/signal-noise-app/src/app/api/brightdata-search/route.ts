#!/usr/bin/env node

/**
 * REAL BRIGHTDATA RFP SEARCH API
 * Uses the working BrightData MCP tool to find genuine RFP opportunities
 */

export async function POST(request: Request) {
  try {
    const { query } = await request.json();

    if (!query) {
      return Response.json({ error: 'Missing query parameter' }, { status: 400 });
    }

    console.log(`🔍 [REAL BRIGHTDATA] Searching for: ${query}`);

    // Use the proven working BrightData MCP tool
    const searchResults = await mcp__brightData__search_engine({
      query: `${query} RFP tender procurement 2025`,
      engine: 'google',
      num_results: 5
    });

    console.log(`📊 [REAL BRIGHTDATA] Found ${searchResults.results?.length || 0} results`);

    // Format the real search results
    let resultsText = `REAL BrightData search results for "${query}":\n\n`;
    
    if (searchResults.results && searchResults.results.length > 0) {
      searchResults.results.forEach((result, index) => {
        resultsText += `${index + 1}. ${result.title}\n`;
        resultsText += `   URL: ${result.link}\n`;
        resultsText += `   Description: ${result.snippet || result.description || 'No description available'}\n\n`;
      });
    } else {
      resultsText += 'No search results found.\n';
    }

    return Response.json({ 
      success: true,
      results: resultsText,
      query,
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