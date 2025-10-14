import { NextRequest } from "next/server";
import { query } from "@anthropic-ai/claude-agent-sdk";
import crypto from "crypto";

/**
 * Enhanced LinkedIn Procurement Webhook with Claude Agent SDK Integration
 */

interface BrightDataWebhookPayload {
  webhook_id: string;
  site_name: string;
  page_url: string;
  page_title: string;
  content: string;
  meta: {
    author?: string;
    company?: string;
    role?: string;
    post_id?: string;
    hashtags?: string[];
    mentions?: string[];
    engagement_count?: number;
  };
  extracted_at: string;
  signals: string[];
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const webhookData: BrightDataWebhookPayload = JSON.parse(body);
    
    console.log("Webhook received from:", webhookData.meta?.company);
    
    // Quick procurement signal detection
    const procurementKeywords = [
      "rfp", "request for proposal", "tender", "procurement", 
      "seeking partners", "digital transformation", "fan engagement"
    ];
    
    const hasProcurementSignal = procurementKeywords.some(keyword =>
      webhookData.content.toLowerCase().includes(keyword)
    );
    
    if (!hasProcurementSignal) {
      return new Response(JSON.stringify({ 
        status: "ignored",
        reason: "No procurement signal detected"
      }), { status: 200 });
    }
    
    // Create analysis prompt for Claude
    const analysisPrompt = `Analyze this LinkedIn procurement signal:

CONTENT: ${webhookData.content}
AUTHOR: ${webhookData.meta?.author} (${webhookData.meta?.role})
COMPANY: ${webhookData.meta?.company}

Tasks:
1. Verify this is genuine procurement
2. Extract: organization, sport type, estimated value, urgency
3. Use Neo4j to check existing relationships
4. Calculate Yellow Panther fit score (0-100)
5. Provide strategic recommendations

Return structured JSON with confidence scoring.`;

    // Use Claude Agent SDK for analysis
    const encoder = new TextEncoder();
    
    return new Response(
      new ReadableStream({
        async start(controller) {
          try {
            // Send initial status
            const initChunk = {
              type: "status",
              message: "Starting Claude analysis..."
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(initChunk)}\n\n`));
            
            // Process with Claude Agent SDK
            for await (const message of query({
              prompt: analysisPrompt,
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
                  "mcp__neo4j-mcp__create_node"
                ],
                maxTurns: 5
              }
            })) {
              
              if (message.type === "assistant") {
                const chunk = {
                  type: "analysis",
                  content: message.message.content
                };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
              }
              
              if (message.type === "tool_use") {
                const toolChunk = {
                  type: "tool_usage",
                  tool: message.name,
                  args: message.input
                };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(toolChunk)}\n\n`));
              }
            }
            
            controller.close();
            
          } catch (error) {
            console.error("Analysis failed:", error);
            controller.close();
          }
        }
      }),
      {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive"
        }
      }
    );
    
  } catch (error) {
    console.error("Webhook processing error:", error);
    return new Response(JSON.stringify({ 
      error: "Internal server error"
    }), { status: 500 });
  }
}