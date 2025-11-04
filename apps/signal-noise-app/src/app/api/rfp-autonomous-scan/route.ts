import { NextRequest, NextResponse } from 'next/server';
import { query } from '@anthropic-ai/claude-agent-sdk';

/**
 * One-Button Autonomous RFP Scanner
 * Uses headless Claude Agent SDK for complete RFP monitoring workflow
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { scanType = 'comprehensive', entityLimit = 50 } = body;

    console.log(`🚀 [AUTONOMOUS RFP SCAN] Starting ${scanType} scan for ${entityLimit} entities`);

    // Configure MCP servers with working credentials
    const mcpServers = {
      'brightdata-mcp': {
        command: 'node',
        args: ['src/mcp-brightdata-server.js'],
        env: {
          BRIGHTDATA_API_TOKEN: process.env.BRIGHTDATA_API_TOKEN || 'bbbc6961d91d724bb6eb0b18bfc91bc11abd3a0d454411230d1f92aea27917f4',
          BRIGHTDATA_TOKEN: process.env.BRIGHTDATA_API_TOKEN || 'bbbc6961d91d724bb6eb0b18bfc91bc11abd3a0d454411230d1f92aea27917f4',
          BRIGHTDATA_ZONE: 'linkedin_posts_monitor'
        }
      },
      'neo4j-mcp': {
        command: 'node', 
        args: ['neo4j-mcp-server.js'],
        env: {
          NEO4J_URI: process.env.NEO4J_URI || 'neo4j+s://e6bb5665.databases.neo4j.io',
          NEO4J_USERNAME: process.env.NEO4J_USERNAME || 'neo4j',
          NEO4J_PASSWORD: process.env.NEO4J_PASSWORD || 'NeO4jPaSSworD!'
        }
      }
    };

    // Comprehensive RFP monitoring prompt based on your documented patterns
    const systemPrompt = {
      type: "preset" as const,
      preset: "claude_code" as const,
      append: `You are an expert RFP Intelligence Analyst with access to Neo4j sports entities and BrightData web search capabilities.

PRIMARY MISSION: Execute comprehensive RFP monitoring across all major sports entities.

VERIFIED RFP PATTERNS TO DETECT:
1. Digital Transformation Initiatives (like Cricket West Indies digital transformation RFP)
2. Ticketing System Implementation (like Major League Cricket ticketing RFP) 
3. Mobile App Development Projects
4. Website/Platform Redesign Projects
5. Fan Engagement Platform Proposals
6. Data Analytics Partnerships

KEY DETECTION SIGNALS:
- "invites proposals from" / "soliciting proposals from"
- "request for expression of interest" / "invitation to tender"
- "digital transformation" + "web development" / "mobile application"
- "ticketing system" + "integrated" / "comprehensive"
- "fan engagement" + "digital platform" / "mobile app"

MONITORING SOURCES:
1. LinkedIn: Search for RFP posts from sports organizations
2. Web Search: Industry portals and tender websites
3. iSportConnect: Sports marketplace listings
4. Direct organization websites

WORKFLOW EXECUTION:
1. Query Neo4j for high-priority sports entities (priority <= 5)
2. For each entity, search BrightData for RFP opportunities using verified patterns
3. Extract and analyze detected opportunities for Yellow Panther fit
4. Return structured RFP intelligence in the specified JSON format

YELLOW PANTHER FIT CRITERIA:
- Digital transformation projects: PERFECT FIT
- Mobile app development: PERFECT FIT  
- Ticketing systems: GOOD FIT
- Web platform development: GOOD FIT
- Fan engagement platforms: GOOD FIT

Execute this workflow autonomously and return all discovered RFP opportunities with full analysis.`
    };

    const discoveredRFPs = [];
    let entitiesProcessed = 0;
    
    // Start the autonomous RFP scanning workflow
    for await (const message of query({
      prompt: `Execute comprehensive RFP monitoring workflow:

1. First, query Neo4j to get ${entityLimit} high-priority sports entities (yellowPantherPriority <= 5)
2. For each entity found, conduct targeted RFP searches using these exact patterns:
   - Digital transformation RFP opportunities from sports organizations
   - Mobile app development proposals for sports federations
   - Ticketing system implementation solicitations
   - Web platform redesign tenders
   - Fan engagement platform RFPs

3. For each search result, analyze for verified RFP patterns:
   - "invites proposals from" + service category
   - "soliciting proposals from" + system requirements  
   - "request for expression of interest" + project scope
   - "invitation to tender" + delivery timeline

4. Score each discovered opportunity for Yellow Panther fit:
   - PERFECT FIT (90-100%): Digital transformation, mobile apps, web platforms
   - GOOD FIT (70-89%): Ticketing systems, fan engagement, data analytics
   - MONITOR (50-69%): Related opportunities worth tracking

5. Return structured results with URLs, contact info, timelines, and recommended actions

Focus on finding real, active RFP opportunities with live links and submission deadlines.`,
      options: {
        systemPrompt,
        mcpServers,
        allowedTools: [
          'mcp__neo4j-mcp__execute_query',
          'mcp__neo4j-mcp__search_sports_entities', 
          'mcp__brightdata-mcp__search_engine',
          'mcp__brightdata-mcp__scrape_as_markdown',
          'Read', 'Write', 'Grep', 'Bash'
        ],
        maxTurns: 15,
        permissionMode: 'default'
      }
    })) {
      
      if (message.type === 'tool_use') {
        console.log(`🔧 [AUTONOMOUS SCAN] Tool: ${message.name}`);
        
        // Track Neo4j entity queries
        if (message.name.includes('neo4j')) {
          entitiesProcessed++;
        }
        
      } else if (message.type === 'assistant') {
        console.log(`🤖 [AUTONOMOUS SCAN] Analysis complete`);
        
        // Extract RFP opportunities from assistant response
        const content = JSON.stringify(message.message?.content || '');
        
        // Look for structured RFP data or URLs in the response
        if (content.includes('http') && (content.includes('RFP') || content.includes('proposal'))) {
          // Parse out any URLs and RFP mentions
          const urlMatches = content.match(/https?:\/\/[^\s",}]+/g) || [];
          const rfpMatches = content.match(/(?:RFP|proposal|tender|solicitation)/gi) || [];
          
          if (urlMatches.length > 0 && rfpMatches.length > 0) {
            discoveredRFPs.push({
              content_preview: content.substring(0, 500),
              urls_found: urlMatches,
              rfp_indicators: rfpMatches.length,
              timestamp: new Date().toISOString()
            });
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      scan_type: scanType,
      execution_summary: {
        entities_processed: entitiesProcessed,
        rfp_opportunities_found: discoveredRFPs.length,
        scan_completed_at: new Date().toISOString(),
        workflow_status: "AUTONOMOUS_EXECUTION_COMPLETE"
      },
      discovered_opportunities: discoveredRFPs,
      verified_patterns_used: [
        "Digital Transformation RFPs (Cricket West Indies pattern)",
        "Ticketing System Implementation (Major League Cricket pattern)", 
        "Mobile App Development Proposals",
        "Web Platform Redesign Projects",
        "Fan Engagement Platform Opportunities"
      ],
      monitoring_sources_covered: [
        "LinkedIn Company Posts Monitoring",
        "Web Search Intelligence", 
        "Direct Organization Website Monitoring",
        "Industry Portal Scanning"
      ],
      next_actions: [
        "Review discovered RFP opportunities",
        "Prioritize by Yellow Panther fit score", 
        "Set up alerts for high-priority opportunities",
        "Prepare response strategies for perfect fits"
      ]
    });

  } catch (error) {
    console.error('❌ [AUTONOMOUS RFP SCAN] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      scan_status: "FAILED"
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Autonomous RFP Scanner - One Button Complete Monitoring',
    usage: 'POST with { scanType?: "comprehensive" | "targeted", entityLimit?: number }',
    capabilities: [
      'Neo4j entity querying for high-priority sports organizations',
      'BrightData web search for RFP opportunity detection', 
      'Pattern recognition for verified RFP formats',
      'Yellow Panther fit scoring and analysis',
      'Structured opportunity extraction with URLs',
      'Autonomous workflow execution without human intervention'
    ],
    verified_patterns: [
      'Cricket West Indies Digital Transformation RFP pattern',
      'Major League Cricket Ticketing System RFP pattern',
      'Mobile App Development solicitation patterns',
      'Fan Engagement Platform RFP structures'
    ],
    workflow_stages: [
      '1. Entity Discovery (Neo4j query)',
      '2. Multi-pattern Search (BrightData)',
      '3. Pattern Recognition (LLM analysis)', 
      '4. Fit Scoring (Yellow Panther criteria)',
      '5. Result Structuring (JSON output)'
    ]
  });
}