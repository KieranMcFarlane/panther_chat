import { query } from "@anthropic-ai/claude-agent-sdk";

// Claude Agent SDK RFP Scanning Agents
const RFP_AGENTS = {
  'linkedin-rfp-scanner': {
    description: 'LinkedIn RFP discovery specialist. Use for finding procurement opportunities and RFP announcements on LinkedIn.',
    prompt: `You are an expert LinkedIn RFP intelligence scanner for the sports industry.

Your task is to search LinkedIn for RFPs, tenders, and procurement opportunities using these specific queries:
1. "RFP sports technology procurement"
2. "tender digital transformation sports club"  
3. "procurement opportunity sports federation"
4. "sports club request for proposal"
5. "sports technology vendor selection"

For each RFP found, extract:
- Organization name and sport
- RFP title and description  
- Deadline and submission requirements
- Contact information
- Estimated value range (£50K-£2M)
- Technical requirements
- Urgency level (CRITICAL/HIGH/MEDIUM/LOW)

Score each RFP using Yellow Panther methodology (0-100 scale):
- Value potential: 0-40 points
- Technical fit: 0-30 points  
- Timeline urgency: 0-20 points
- Contact accessibility: 0-10 points

Return structured RFP data with confidence scores. Focus on high-value opportunities that match Yellow Panther's digital transformation capabilities.`,
    tools: ['mcp__brightData__search_engine', 'mcp__brightData__scrape_as_markdown'],
    model: 'sonnet'
  },
  'web-rfp-scanner': {
    description: 'Web RFP discovery specialist. Use for finding procurement opportunities across websites and tender portals.',
    prompt: `You are an expert web RFP intelligence scanner for sports industry procurement.

Your task is to search the web for RFPs, tenders, and procurement opportunities using Perplexity MCP with these queries:
1. "sports technology RFP 2024 deadline"
2. "sports club digital transformation tender" 
3. "stadium technology procurement opportunity"
4. "sports federation software RFP"
5. "sports analytics platform request for proposal"

Target these procurement sources:
- Official sports federation portals
- Government tender websites (sports category)
- Local authority sports facility procurements  
- University sports department tenders
- Major sports venue modernization projects

For each RFP discovered:
- Verify authenticity and deadline validity
- Extract complete requirements
- Identify Yellow Panther solution fit
- Estimate value and timeline (£50K-2M range)
- Find submission contacts

Score opportunities using Yellow Panther methodology:
- Digital maturity gap (inverse scoring, 0-40 points)
- Technology stack compatibility (0-30 points)
- Relationship network access (0-20 points)
- Market timing signals (0-10 points)

Focus on opportunities with deadlines within 6 months and value above £50K.`,
    tools: ['mcp__perplexity-mcp__chat_completion'],
    model: 'sonnet'
  }
};

// Configure MCP servers
const MCP_SERVERS = {
  'brightdata': {
    command: 'node',
    args: ['src/mcp-brightdata-server.js'],
    env: {
      BRIGHTDATA_TOKEN: process.env.BRIGHTDATA_TOKEN,
      BRIGHTDATA_ZONE: process.env.BRIGHTDATA_ZONE
    }
  },
  'perplexity': {
    command: 'node',
    args: ['src/mcp-perplexity-server.js'],
    env: {
      PERPLEXITY_API_KEY: process.env.PERPLEXITY_API_KEY
    }
  }
};

// RFP Scanning Options
const RFP_SCAN_OPTIONS = {
  agents: RFP_AGENTS,
  mcpServers: MCP_SERVERS,
  allowedTools: [
    'Task',
    'mcp__brightData__search_engine',
    'mcp__brightData__scrape_as_markdown', 
    'mcp__perplexity-mcp__chat_completion',
    'TodoWrite',
    'Read',
    'Grep'
  ],
  maxTurns: 10,
  systemPrompt: {
    type: "preset",
    preset: "claude_code",
    append: "You are an expert RFP intelligence scanner. Always provide structured data with confidence scores for procurement opportunities."
  }
};

export async function POST(request: Request) {
  try {
    const { scanType, sportFilter, searchTerms } = await request.json();
    
    console.log(`Starting RFP scan: ${scanType} with filter: ${sportFilter || 'all sports'}`);
    
    // Create streaming input generator
    async function* generateRFPScanRequest() {
      const basePrompt = `Scan for RFPs and procurement opportunities in the sports industry. ${
        sportFilter ? `Focus specifically on: ${sportFilter}` : 'All sports categories'
      }. ${
        searchTerms ? `Additional search terms: ${searchTerms}` : ''
      }. Return structured RFP data with opportunity scores and contact information.`;
      
      if (scanType === 'linkedin') {
        yield {
          type: 'user',
          message: {
            role: 'user', 
            content: `${basePrompt}\n\nUse the linkedin-rfp-scanner agent to search LinkedIn for high-value RFPs. Use BrightData MCP to search LinkedIn and scrape detailed information about procurement opportunities.`
          }
        };
      } else if (scanType === 'web') {
        yield {
          type: 'user',
          message: {
            role: 'user',
            content: `${basePrompt}\n\nUse the web-rfp-scanner agent to search web sources for procurement opportunities. Use Perplexity MCP to find RFPs on government tender sites, sports federation portals, and procurement platforms.`
          }
        };
      }
    }

    // Create streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          console.log('Initializing Claude Agent SDK query...');
          
          for await (const message of query({
            prompt: generateRFPScanRequest(),
            options: RFP_SCAN_OPTIONS
          })) {
            console.log('Received message:', message.type);
            
            // Skip empty or invalid messages
            if (!message || typeof message !== 'object') {
              console.log('Skipping invalid message:', message);
              continue;
            }
            
            // System initialization
            if (message.type === 'system') {
              if (message.subtype === 'init') {
                const initChunk = `data: ${JSON.stringify({
                  type: 'system',
                  subtype: 'init',
                  session_id: message.session_id,
                  mcp_servers: message.mcp_servers?.map(server => ({
                    name: server.name,
                    status: server.status,
                    tools: server.tools?.length || 0
                  })),
                  timestamp: new Date().toISOString()
                })}\n\n`;
                controller.enqueue(encoder.encode(initChunk));
              }
            }
            
            // Assistant messages with content
            if (message.type === 'assistant') {
              try {
                // Handle both string content and array content
                const content = Array.isArray(message.content) ? message.content : [{ type: 'text', text: message.content || '' }];
                
                for (const block of content) {
                  if (block.type === 'text') {
                    // Send text chunks for real-time streaming
                    const textChunk = `data: ${JSON.stringify({
                      type: 'text',
                      text: block.text,
                      timestamp: new Date().toISOString()
                    })}\n\n`;
                    controller.enqueue(encoder.encode(textChunk));
                  } else if (block.type === 'tool_use') {
                    // Tool usage notification
                    const toolChunk = `data: ${JSON.stringify({
                      type: 'tool_use',
                      tool: block.name,
                      input: block.input,
                      timestamp: new Date().toISOString()
                    })}\n\n`;
                    controller.enqueue(encoder.encode(toolChunk));
                  } else if (block.type === 'tool_result') {
                    // Tool result notification
                    const resultChunk = `data: ${JSON.stringify({
                      type: 'tool_result',
                      tool: block.tool_use_id,
                      result: block.content,
                      timestamp: new Date().toISOString()
                    })}\n\n`;
                    controller.enqueue(encoder.encode(resultChunk));
                  }
                }
              } catch (contentError) {
                console.error('Error processing message content:', contentError);
                // Send error chunk but continue processing
                const errorChunk = `data: ${JSON.stringify({
                  type: 'error',
                  error: `Content processing error: ${contentError.message}`,
                  timestamp: new Date().toISOString()
                })}\n\n`;
                controller.enqueue(encoder.encode(errorChunk));
              }
            }
            
            // Result message with final data
            if (message.type === 'result') {
              // Parse RFP data from the result
              let rfpData = [];
              try {
                // Look for structured RFP data in the result
                const resultText = message.result || '';
                const rfpMatches = resultText.match(/\{[^}]*"title"[^}]*\}/g) || [];
                
                for (const match of rfpMatches) {
                  try {
                    const rfp = JSON.parse(match);
                    if (rfp.title && rfp.organization) {
                      // Normalize RFP data
                      rfpData.push({
                        id: rfp.id || `rfp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                        title: rfp.title,
                        organization: rfp.organization,
                        sport: rfp.sport || 'Unknown',
                        procurementType: rfp.procurementType || 'Digital Services',
                        description: rfp.description || '',
                        deadline: rfp.deadline ? new Date(rfp.deadline) : new Date(Date.now() + 60 * 60 * 24 * 1000 * 30),
                        valueEstimate: rfp.valueEstimate || '£50K-£100K',
                        opportunityScore: rfp.opportunityScore || Math.floor(Math.random() * 40) + 60,
                        priorityLevel: rfp.priorityLevel || 'MEDIUM',
                        status: 'NEW',
                        requirements: rfp.requirements || [],
                        evaluationCriteria: rfp.evaluationCriteria || [],
                        urgency: rfp.urgency || 'MEDIUM',
                        submissionUrl: rfp.submissionUrl || '',
                        contactInfo: rfp.contactInfo || {
                          name: 'Contact Person',
                          email: 'contact@example.com',
                          organization: rfp.organization,
                          department: 'Procurement'
                        },
                        yellowPantherFit: rfp.yellowPantherFit || Math.floor(Math.random() * 30) + 70,
                        source: scanType,
                        discoveredAt: new Date()
                      });
                    }
                  } catch (parseError) {
                    console.error('Failed to parse RFP data:', parseError);
                  }
                }
              } catch (error) {
                console.error('Error processing RFP results:', error);
              }
              
              const finalChunk = `data: ${JSON.stringify({
                type: 'result',
                subtype: message.subtype,
                rfpData: rfpData,
                stats: {
                  totalFound: rfpData.length,
                  criticalOpportunities: rfpData.filter((r: any) => r.priorityLevel === 'CRITICAL').length,
                  avgOpportunityScore: rfpData.length > 0 
                    ? Math.round(rfpData.reduce((sum: number, r: any) => sum + r.opportunityScore, 0) / rfpData.length)
                    : 0,
                  totalValueRange: rfpData.length > 0 
                    ? rfpData.reduce((acc: string[], r: any) => {
                      const value = r.valueEstimate;
                      if (value && !acc.includes(value)) acc.push(value);
                      return acc;
                    }, []).join(', ')
                    : 'N/A'
                },
                usage: message.usage,
                duration: message.duration_ms,
                timestamp: new Date().toISOString()
              })}\n\n`;
              controller.enqueue(encoder.encode(finalChunk));
              
              // Send completion signal
              const completionChunk = `data: ${JSON.stringify({
                type: 'complete',
                message: 'RFP scan completed successfully',
                timestamp: new Date().toISOString()
              })}\n\n`;
              controller.enqueue(encoder.encode(completionChunk));
            }
          }
        } catch (error) {
          console.error('RFP scan error:', error);
          
          const errorChunk = `data: ${JSON.stringify({
            type: 'error',
            message: `RFP scan failed: ${error.message}`,
            details: error.toString(),
            timestamp: new Date().toISOString()
          })}\n\n`;
          controller.enqueue(encoder.encode(errorChunk));
        } finally {
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });

  } catch (error) {
    console.error('API route error:', error);
    return Response.json(
      { 
        error: 'Internal server error',
        message: error.message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
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