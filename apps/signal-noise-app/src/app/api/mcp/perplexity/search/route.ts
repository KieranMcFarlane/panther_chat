import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { query, max_results = 5 } = await request.json();
    
    console.log('Perplexity search:', query);
    
    // Mock Perplexity search results for now
    // In production, this would call the actual Perplexity MCP server
    const mockResults = [
      {
        content: `Based on current information about ${query}, here are the key insights...`,
        sources: [
          {
            title: `Source 1: ${query} Analysis`,
            url: 'https://example.com/source1'
          },
          {
            title: `Source 2: ${query} Overview`, 
            url: 'https://example.com/source2'
          }
        ],
        confidence: 0.85,
        timestamp: new Date().toISOString()
      }
    ];
    
    console.log('Perplexity search results:', mockResults);
    
    return NextResponse.json({
      success: true,
      data: mockResults,
      query: query,
      max_results: mockResults.length
    });
    
  } catch (error) {
    console.error('Perplexity search API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to search with Perplexity',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}