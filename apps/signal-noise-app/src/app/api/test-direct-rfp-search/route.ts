import { NextRequest, NextResponse } from 'next/server';
import { query } from '@anthropic-ai/claude-agent-sdk';

/**
 * Direct RFP search using Claude Agent SDK with MCP tools
 * Tests BrightData search for real RFP opportunities
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { searchQueries } = body;

    console.log(`🔍 [DIRECT RFP SEARCH] Starting direct RFP search with queries:`, searchQueries);

    if (!searchQueries || !Array.isArray(searchQueries)) {
      throw new Error('searchQueries array is required');
    }

    const searchResults = [];
    
    // Configure MCP servers
    const mcpServers = {
      'brightdata-mcp': {
        command: 'node',
        args: ['src/mcp-brightdata-server.js'],
        env: {
          BRIGHTDATA_API_TOKEN: process.env.BRIGHTDATA_API_TOKEN || 'bbbc6961d91d724bb6eb0b18bfc91bc11abd3a0d454411230d1f92aea27917f4',
          BRIGHTDATA_TOKEN: process.env.BRIGHTDATA_API_TOKEN || 'bbbc6961d91d724bb6eb0b18bfc91bc11abd3a0d454411230d1f92aea27917f4',
          BRIGHTDATA_ZONE: 'linkedin_posts_monitor'
        }
      }
    };

    const systemPrompt = {
      type: "preset" as const,
      preset: "claude_code" as const,
      append: `You are an expert RFP Intelligence Analyst specializing in sports industry procurement opportunities.

Your task is to find REAL, CURRENT RFP opportunities and procurement signals using BrightData web search.

DIRECT SEARCH INSTRUCTIONS:
- Use the mcp__brightdata-mcp__search_engine tool for comprehensive web search
- Try multiple search engines (google, bing, yandex) for maximum coverage
- Search for CURRENT and upcoming RFP opportunities only

RFP SEARCH PATTERNS TO LOOK FOR:
- "Request for Proposal", "RFP", "tender", "procurement", "bidding"
- "seeking proposals", "vendor selection", "supplier opportunities"
- "contract opportunities", "service providers wanted"
- Investment signals: "funding rounds", "expansion plans", "new facilities"

REQUIRED OUTPUT FORMAT:
For each RFP opportunity found, provide:
1. **Organization**: Company/organization name
2. **Title**: RFP title or description
3. **URL**: Direct link to the RFP/tender
4. **Deadline**: Submission deadline (if available)
5. **Estimated Value**: Contract value (if mentioned)
6. **Requirements**: Key project requirements
7. **Confidence**: Your confidence score (1-10) that this is genuine

QUALITY STANDARDS:
- Only include CURRENT opportunities (2025)
- Must have working URLs
- Focus on sports industry, digital transformation, technology
- Minimum confidence score of 6/10 to include

Search thoroughly and return at least 3 real RFP opportunities with URLs.`
    };

    // Process each search query
    for (const searchQuery of searchQueries) {
      console.log(`🔍 [DIRECT RFP SEARCH] Processing query: ${searchQuery}`);
      
      try {
        const queryResults = [];
        
        for await (const message of query({
          prompt: `Search for real RFP opportunities: ${searchQuery}`,
          options: {
            systemPrompt,
            mcpServers,
            allowedTools: [
              'mcp__brightdata-mcp__search_engine',
              'mcp__brightdata-mcp__scrape_as_markdown',
              'Read', 'Write', 'Grep', 'Bash'
            ],
            maxTurns: 6,
            permissionMode: 'default'
          }
        })) {
          if (message.type === 'assistant') {
            console.log(`📝 [DIRECT RFP SEARCH] Assistant response for ${searchQuery}`);
            let content = message.message?.content || '';
            if (Array.isArray(content)) {
              content = content.map(item => typeof item === 'object' ? JSON.stringify(item, null, 2) : String(item)).join('\n');
            } else if (typeof content === 'object') {
              content = JSON.stringify(content, null, 2);
            }
            queryResults.push(content);
          } else if (message.type === 'tool_use' && message.name === 'mcp__brightdata-mcp__search_engine') {
            console.log(`🔧 [DIRECT RFP SEARCH] BrightData search executed for: ${searchQuery}`);
            console.log(`🔍 [DEBUG] Search params:`, JSON.stringify(message.input, null, 2));
          } else if (message.type === 'tool_result') {
            console.log(`🔧 [DIRECT RFP SEARCH] Tool result received`);
            let content = message.content?.[0]?.text || '';
            if (content) {
              queryResults.push(content);
            }
          }
        }
        
        searchResults.push({
          query: searchQuery,
          results: queryResults,
          timestamp: new Date().toISOString()
        });
        
      } catch (error) {
        console.error(`❌ [DIRECT RFP SEARCH] Error processing query ${searchQuery}:`, error);
        searchResults.push({
          query: searchQuery,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }

    console.log(`✅ [DIRECT RFP SEARCH] Search completed for ${searchQueries.length} queries`);

    return NextResponse.json({
      success: true,
      search_queries: searchQueries,
      mcp_tools_used: ['brightdata-mcp'],
      results: searchResults,
      total_opportunities_found: searchResults.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [DIRECT RFP SEARCH] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Direct RFP Search Test Endpoint',
    usage: 'POST with { searchQueries: string[] }',
    example: {
      searchQueries: [
        'Premier League digital transformation RFP 2025',
        'sports technology procurement tender',
        'football club software vendor selection'
      ]
    },
    capabilities: [
      'Real BrightData web search',
      'Multiple search engines (Google, Bing, Yandex)',
      'RFP opportunity extraction',
      'Confidence scoring',
      'URL validation'
    ]
  });
}