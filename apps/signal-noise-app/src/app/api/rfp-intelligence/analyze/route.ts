import { NextRequest } from "next/server";
import { query } from "@anthropic-ai/claude-agent-sdk";

/**
 * RFP Intelligence Agent
 * Provides structured analysis of procurement signals using Claude Agent SDK
 */

interface RFPAnalysisRequest {
  content: string;
  author: string;
  role: string;
  company: string;
  url: string;
  metadata?: any;
}

interface RFPIntelligence {
  procurement_validation: {
    is_genuine_procurement: boolean;
    confidence: number;
    reasoning: string[];
    exclusion_flags: string[];
  };
  structured_extraction: {
    organization_name: string;
    sport_type: string;
    procurement_category: string;
    estimated_value_range: string;
    urgency_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    deadline_estimate?: string;
    technical_requirements: string[];
    business_objectives: string[];
  };
  relationship_analysis: {
    existing_connections: number;
    warm_intro_paths: Array<{
      contact_person: string;
      relationship_path: string;
      strength: 'STRONG' | 'MODERATE' | 'WEAK';
    }>;
    competitor_analysis?: Array<{
      competitor: string;
      relationship_strength: string;
    }>;
  };
  market_intelligence: {
    current_tech_stack: string[];
    digital_maturity: 'LOW' | 'MEDIUM' | 'HIGH';
    recent_initiatives: string[];
    decision_makers: Array<{
      name: string;
      role: string;
      linkedin_url?: string;
      contact_pattern?: string;
    }>;
  };
  yellow_panther_assessment: {
    fit_score: number;
    rationale: string[];
    competitive_advantages: string[];
    potential_challenges: string[];
    recommended_approach: string;
  };
  strategic_recommendations: {
    immediate_actions: string[];
    outreach_strategy: string;
    value_proposition_focus: string[];
    timeline_recommendations: string[];
    risk_mitigation: string[];
  };
}

export async function POST(req: NextRequest) {
  try {
    const analysisRequest: RFPAnalysisRequest = await req.json();
    console.log('🎯 RFP Intelligence Analysis requested for:', analysisRequest.company);
    
    const encoder = new TextEncoder();
    
    return new Response(
      new ReadableStream({
        async start(controller) {
          try {
            // Stage 1: Initial validation
            const validationChunk = {
              type: 'stage_update',
              stage: 'validation',
              message: 'Validating procurement signal authenticity...',
              timestamp: new Date().toISOString()
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(validationChunk)}\n\n`));
            
            // Stage 2: Multi-step Claude analysis
            const comprehensivePrompt = `You are Yellow Panther's RFP Intelligence Analyzer. Your expertise is UK sports industry digital transformation opportunities valued £100K-£2M.

**PROCUREMENT SIGNAL:**
${analysisRequest.content}

**SOURCE:**
Author: ${analysisRequest.author} (${analysisRequest.role})
Company: ${analysisRequest.company}
URL: ${analysisRequest.url}

**ANALYSIS REQUIREMENTS:**

1. **PROCUREMENT VALIDATION**
   - Verify this is genuine procurement (not recruitment/sales/marketing)
   - Assess confidence level (0.0-1.0)
   - Identify any exclusion flags

2. **STRUCTURED EXTRACTION**
   - Organization name and sport type
   - Procurement category (digital transformation, fan engagement, ticketing, analytics, CRM)
   - Estimated value range based on scope and organization size
   - Urgency level and deadline indicators
   - Technical requirements and business objectives

3. **RELATIONSHIP ANALYSIS** (Use Neo4j)
   - Search for existing connections to this organization
   - Identify warm introduction paths
   - Map competitor relationships

4. **MARKET INTELLIGENCE** (Use BrightData + Perplexity)
   - Research current technology stack
   - Assess digital maturity level
   - Identify recent initiatives and decision-makers
   - Find contact information patterns

5. **YELLOW PANTHER ASSESSMENT**
   - Calculate fit score (0-100) based on:
     * Sport type match (football, rugby, cricket, venues = high fit)
     * Value range alignment (£100K-£2M sweet spot)
     * Technical capability match
     * Existing relationship leverage
   - Provide rationale and competitive advantages
   - Identify potential challenges

6. **STRATEGIC RECOMMENDATIONS**
   - Immediate next actions
   - Outreach strategy (warm intro vs cold)
   - Value proposition focus areas
   - Timeline recommendations
   - Risk mitigation strategies

Return your analysis as structured JSON following this exact format:

{
  "procurement_validation": {
    "is_genuine_procurement": boolean,
    "confidence": number (0.0-1.0),
    "reasoning": ["string explanations"],
    "exclusion_flags": ["string warnings"]
  },
  "structured_extraction": {
    "organization_name": "string",
    "sport_type": "string",
    "procurement_category": "string",
    "estimated_value_range": "string",
    "urgency_level": "LOW|MEDIUM|HIGH|CRITICAL",
    "deadline_estimate": "string",
    "technical_requirements": ["string"],
    "business_objectives": ["string"]
  },
  "relationship_analysis": {
    "existing_connections": number,
    "warm_intro_paths": [
      {
        "contact_person": "string",
        "relationship_path": "string",
        "strength": "STRONG|MODERATE|WEAK"
      }
    ],
    "competitor_analysis": [
      {
        "competitor": "string", 
        "relationship_strength": "string"
      }
    ]
  },
  "market_intelligence": {
    "current_tech_stack": ["string"],
    "digital_maturity": "LOW|MEDIUM|HIGH",
    "recent_initiatives": ["string"],
    "decision_makers": [
      {
        "name": "string",
        "role": "string",
        "linkedin_url": "string",
        "contact_pattern": "string"
      }
    ]
  },
  "yellow_panther_assessment": {
    "fit_score": number (0-100),
    "rationale": ["string"],
    "competitive_advantages": ["string"],
    "potential_challenges": ["string"],
    "recommended_approach": "string"
  },
  "strategic_recommendations": {
    "immediate_actions": ["string"],
    "outreach_strategy": "string",
    "value_proposition_focus": ["string"],
    "timeline_recommendations": ["string"],
    "risk_mitigation": ["string"]
  }
}

Use your MCP tools to research and enrich this analysis. Be thorough but practical.`;

            // Execute Claude analysis with tool orchestration
            let analysisProgress = '';
            let toolUsageLog: any[] = [];
            
            for await (const message of query({
              prompt: comprehensivePrompt,
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
                  },
                  "brightData": {
                    "command": "npx",
                    "args": ["-y", "@brightdata/mcp"],
                    "env": {
                      "API_TOKEN": process.env.BRIGHTDATA_API_TOKEN || "",
                      "PRO_MODE": "true"
                    }
                  },
                  "perplexity-mcp": {
                    "command": "npx",
                    "args": ["-y", "mcp-perplexity-search"],
                    "env": {
                      "PERPLEXITY_API_KEY": process.env.PERPLEXITY_API_KEY || ""
                    }
                  }
                },
                allowedTools: [
                  "mcp__neo4j-mcp__execute_query",
                  "mcp__neo4j-mcp__create_node",
                  "mcp__neo4j-mcp__create_relationship", 
                  "mcp__brightData__scrape_as_markdown",
                  "mcp__perplexity-mcp__chat_completion",
                  "mcp__brightData__search_engine",
                  "mcp__brightData__extract"
                ],
                maxTurns: 15
              },
              system: `You are Yellow Panther's expert RFP intelligence analyst.
Focus: UK sports industry digital transformation (£100K-£2M opportunities)
Expertise: Fan engagement, ticketing systems, analytics platforms, CRM integration
Markets: Premier League, Championship, major rugby clubs, cricket venues, stadiums

Always provide structured, actionable intelligence with clear confidence scoring.`
            })) {
              
              if (message.type === 'tool_use') {
                const toolLog = {
                  tool: message.name,
                  args: message.input,
                  timestamp: new Date().toISOString()
                };
                toolUsageLog.push(toolLog);
                
                const toolChunk = {
                  type: 'tool_usage',
                  tool: message.name,
                  description: getToolDescription(message.name),
                  timestamp: new Date().toISOString()
                };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(toolChunk)}\n\n`));
                console.log(`🔧 RFP Analysis Tool: ${message.name}`);
              }
              
              if (message.type === 'assistant') {
                analysisProgress = message.message.content || '';
                
                const progressChunk = {
                  type: 'analysis_progress',
                  content_length: analysisProgress.length,
                  timestamp: new Date().toISOString()
                };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(progressChunk)}\n\n`));
              }
            }
            
            // Parse and validate the structured analysis
            let parsedIntelligence: RFPIntelligence | null = null;
            
            try {
              // Extract JSON from Claude's response
              const jsonMatch = analysisProgress.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                parsedIntelligence = JSON.parse(jsonMatch[0]);
                
                // Validate required fields
                if (!parsedIntelligence.procurement_validation || !parsedIntelligence.yellow_panther_assessment) {
                  throw new Error('Missing required analysis sections');
                }
                
                // Add metadata
                parsedIntelligence = {
                  ...parsedIntelligence,
                  analysis_metadata: {
                    source_url: analysisRequest.url,
                    analyzed_at: new Date().toISOString(),
                    tool_usage_count: toolUsageLog.length,
                    confidence_weight: 0.85
                  }
                };
                
              } else {
                throw new Error('No JSON found in analysis response');
              }
              
            } catch (parseError) {
              console.error('Failed to parse structured analysis:', parseError);
              
              // Fallback: create basic structure from raw text
              parsedIntelligence = {
                procurement_validation: {
                  is_genuine_procurement: true,
                  confidence: 0.6,
                  reasoning: ['Raw text analysis fallback'],
                  exclusion_flags: []
                },
                structured_extraction: {
                  organization_name: analysisRequest.company,
                  sport_type: 'Unknown',
                  procurement_category: 'Digital Transformation',
                  estimated_value_range: '£250K-£750K',
                  urgency_level: 'MEDIUM',
                  technical_requirements: [],
                  business_objectives: []
                },
                relationship_analysis: {
                  existing_connections: 0,
                  warm_intro_paths: [],
                  competitor_analysis: []
                },
                market_intelligence: {
                  current_tech_stack: [],
                  digital_maturity: 'MEDIUM',
                  recent_initiatives: [],
                  decision_makers: []
                },
                yellow_panther_assessment: {
                  fit_score: 65,
                  rationale: ['Fallback analysis - manual review required'],
                  competitive_advantages: [],
                  potential_challenges: ['Limited information'],
                  recommended_approach: 'Manual analysis recommended'
                },
                strategic_recommendations: {
                  immediate_actions: ['Review raw analysis'],
                  outreach_strategy: 'TBD',
                  value_proposition_focus: [],
                  timeline_recommendations: [],
                  risk_mitigation: []
                },
                analysis_metadata: {
                  source_url: analysisRequest.url,
                  analyzed_at: new Date().toISOString(),
                  analysis_type: 'fallback',
                  raw_analysis: analysisProgress
                }
              } as RFPIntelligence;
            }
            
            // Send final structured intelligence
            const finalChunk = {
              type: 'intelligence_complete',
              intelligence: parsedIntelligence,
              tool_usage_summary: {
                total_tools: toolUsageLog.length,
                tools_used: toolUsageLog.map(t => t.tool)
              },
              status: 'success',
              timestamp: new Date().toISOString()
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(finalChunk)}\n\n`));
            
            console.log(`✅ RFP Intelligence complete for ${analysisRequest.company} - Fit Score: ${parsedIntelligence?.yellow_panther_assessment?.fit_score}`);
            
          } catch (error) {
            console.error('❌ RFP Intelligence analysis failed:', error);
            
            try {
              const errorChunk = {
                type: 'error',
                error: error instanceof Error ? error.message : 'Analysis failed',
                status: 'failed',
                timestamp: new Date().toISOString()
              };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorChunk)}\n\n`));
            } catch (enqueueError) {
              console.error('Failed to enqueue error chunk:', enqueueError);
            }
          }
          
          // Close controller safely
          try {
            controller.close();
          } catch (closeError) {
            console.error('Failed to close controller:', closeError);
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
    console.error('❌ RFP Intelligence request error:', error);
    return new Response(JSON.stringify({ 
      error: 'Request processing failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

function getToolDescription(toolName: string): string {
  const descriptions: Record<string, string> = {
    'mcp__neo4j-mcp__execute_query': 'Querying knowledge graph for relationships',
    'mcp__neo4j-mcp__create_node': 'Creating new entity in knowledge graph',
    'mcp__neo4j-mcp__create_relationship': 'Mapping relationship in knowledge graph',
    'mcp__brightData__scrape_as_markdown': 'Researching organization website',
    'mcp__perplexity-mcp__chat_completion': 'Researching market intelligence',
    'mcp__brightData__search_engine': 'Searching for company information',
    'mcp__brightData__extract': 'Extracting structured data from web content'
  };
  return descriptions[toolName] || `Using tool: ${toolName}`;
}