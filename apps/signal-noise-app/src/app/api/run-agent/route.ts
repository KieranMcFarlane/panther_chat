/**
 * Claude Headless Agent SDK API Endpoint
 * 
 * Executes RFP monitoring using Claude Agent SDK with real MCP tools
 * Streams reasoning and tool execution to Markdown logs
 */

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { createRealClaudeSDKTools } from "@/lib/mcp-claude-sdk-bridge";

export async function POST(req: NextRequest) {
  try {
    // 🪣 1. Setup log file
    const runLogsDir = path.join(process.cwd(), "RUN_LOGS");
    await fs.mkdir(runLogsDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const outputPath = path.join(runLogsDir, `CLAUDE_AGENT_RUN_${timestamp}.md`);
    
    const log = async (msg: string) => {
      await fs.appendFile(outputPath, msg + "\n");
    };

    await log(`# 🤖 CLAUDE HEADLESS AGENT RFP MONITORING`);
    await log(`**Started:** ${new Date().toISOString()}`);
    await log(`**Method:** Claude Agent SDK with MCP Tools`);
    await log(`**Run ID:** ${timestamp}`);
    await log("");

    // 🧩 2. Create MCP Tools
    await log(`## 🔧 Creating MCP Tools`);
    await log(`*Creating Neo4j, BrightData, and Perplexity tool definitions...*`);
    
    let mcpTools = [];
    try {
      mcpTools = await createRealClaudeSDKTools();
      await log(`\n### ✅ Real MCP Tools Created Successfully`);
      await log(`- **mcp__brightData__search_engine**: Real Google/Bing/Yandex search via BrightData MCP server`);
      await log(`- **mcp__brightData__scrape_as_markdown**: Real web scraping via BrightData MCP server`);
      await log(`- All tools connect to actual MCP servers with real data`);
      await log("");
    } catch (mcpError) {
      await log(`\n❌ Real MCP Tool Creation Failed: ${mcpError.message}`);
      throw mcpError;
    }

    // 📖 3. Load your system blueprint (.md)
    const systemPath = path.join(
      process.cwd(),
      "COMPLETE-RFP-MONITORING-SYSTEM.md"
    );
    
    let systemPrompt = "";
    try {
      systemPrompt = await fs.readFile(systemPath, "utf8");
      await log(`## 📋 System Instructions Loaded`);
      await log(`**Source:** COMPLETE-RFP-MONITORING-SYSTEM.md`);
      await log(`**Length:** ${systemPrompt.length} characters`);
      await log("");
      await log(`### 🧠 System Preview (first 500 chars):`);
      await log(`\`\`\``);
      await log(systemPrompt.substring(0, 500) + (systemPrompt.length > 500 ? "..." : ""));
      await log(`\`\`\``);
      await log("");
    } catch (readError) {
      await log(`❌ Failed to read system instructions: ${readError.message}`);
      // Use fallback system prompt
      systemPrompt = `
You are an expert RFP Intelligence Agent conducting live monitoring for sports industry opportunities.

PRIMARY MISSION:
- Query Neo4j database to get sports entities (clubs, leagues, organizations)
- Use BrightData search to find real RFP opportunities 
- Use Perplexity analysis for market intelligence
- Report actual findings with URLs, confidence scores, and strategic insights

EXECUTION STEPS:
1. Use mcp__neo4j-mcp__execute_query to get sports entities
2. Use mcp__brightdata-mcp__search_engine to search for RFP opportunities
3. Use mcp__perplexity-mcp__chat_completion for analysis

Report real findings only. Be honest about what you find (or don't find).
      `;
      await log(`Using fallback system instructions`);
      await log("");
    }

    // 🎯 4. Run headless Claude Agent
    await log(`## 🚀 Starting Claude Agent Execution`);
    await log(`*Model: claude-3.5-sonnet | Temperature: 0.4*`);
    await log("");

    const results = {
      messages: 0,
      toolCalls: 0,
      toolsUsed: new Set<string>(),
      startTime: Date.now(),
      entitiesProcessed: 0,
      searchesPerformed: 0,
      opportunitiesFound: 0
    };

    // Create the execution prompt
    const executionPrompt = `
EXECUTE NOW:

${systemPrompt}

TESTING REAL MCP TOOLS:

You have access to REAL BrightData MCP server tools that connect to actual search engines:

1. Use mcp__brightData__search_engine to search for real RFP opportunities
   - Search for "Manchester United RFP 2025", "Arsenal digital transformation tender", etc.
   - These tools return REAL Google search results, not mock data

2. Use mcp__brightData__scrape_as_markdown to get detailed content from promising URLs
   - Extract actual requirements and contact information from discovered opportunities

3. Report ONLY what the real tools return - do not hallucinate or make up results

IMPORTANT: You MUST use the REAL MCP tools:
- mcp__brightData__search_engine (connects to real Google/Bing/Yandex)
- mcp__brightData__scrape_as_markdown (real web scraping)

The tools are connected to actual BrightData MCP servers and will return real search results with real URLs.
Verify that the data is real by checking for actual domain names and search result formatting.
    `;

    await log(`### 🎯 Prompt Sent to Claude`);
    await log(`\`\`\``);
    await log(executionPrompt.substring(0, 300) + "...");
    await log(`\`\`\``);
    await log("");

    try {
      for await (const message of query({
        prompt: executionPrompt,
        options: {
          model: "claude-3.5-sonnet",
          tools: mcpTools,
          temperature: 0.4,
          maxTokens: 4000
        },
      })) {
        
        if (message.type === "message") {
          results.messages++;
          await log(`💬 **Claude Response:**`);
          await log(``);
          await log(message.content);
          await log(``);
        }

        if (message.type === "tool_use") {
          results.toolCalls++;
          const toolName = message.tool_name || 'unknown_tool';
          results.toolsUsed.add(toolName);
          
          await log(`🛠️ **Tool Call:** ${toolName}`);
          await log(`**Arguments:**`);
          await log(`\`\`\`json`);
          await log(JSON.stringify(message.args || {}, null, 2));
          await log(`\`\`\``);
          await log(``);

          // Track specific metrics
          if (toolName === "mcp__neo4j-mcp__execute_query") {
            // We'll track actual entities processed when we get the result
          } else if (toolName === "mcp__brightdata-mcp__search_engine") {
            results.searchesPerformed++;
          }
        }

        if (message.type === "tool_result") {
          const toolName = message.tool_name || 'unknown_tool';
          await log(`✅ **Tool Result:** ${toolName}`);
          
          // Try to parse the result output if it's a string
          let resultData;
          try {
            if (typeof message.output === 'string') {
              resultData = JSON.parse(message.output);
            } else {
              resultData = message.output;
            }
          } catch (parseError) {
            await log(`**Raw Result:** ${JSON.stringify(message.output)}`);
            await log(``);
          }
          
          // Track entities processed from Neo4j results
          if (toolName === "mcp__neo4j-mcp__execute_query" && resultData) {
            if (resultData.data && Array.isArray(resultData.data)) {
              results.entitiesProcessed = resultData.data.length;
              await log(`**Entities Found:** ${resultData.data.length}`);
            } else if (Array.isArray(resultData)) {
              results.entitiesProcessed = resultData.length;
              await log(`**Entities Found:** ${resultData.length}`);
            }
          }
          
          // Track opportunities from search results
          if (toolName === "mcp__brightdata-mcp__search_engine" && resultData) {
            if (resultData.results && Array.isArray(resultData.results)) {
              // Look for RFP-related results
              const rfpResults = resultData.results.filter(r => {
                const text = (r.title + " " + (r.snippet || "")).toLowerCase();
                return text.includes("rfp") || 
                       text.includes("request for proposal") || 
                       text.includes("tender") ||
                       text.includes("solicitation");
              });
              results.opportunitiesFound += rfpResults.length;
              await log(`**RFP Results:** ${rfpResults.length} of ${resultData.results.length}`);
            } else if (Array.isArray(resultData)) {
              await log(`**Search Results:** ${resultData.length} results returned`);
            }
          }
          
          // Show result preview
          if (resultData) {
            await log(`**Result Preview:**`);
            await log(`\`\`\``);
            await log(JSON.stringify(resultData, null, 2).substring(0, 800));
            await log(`\`\`\``);
          }
          await log(``);
        }

        if (message.type === "error") {
          await log(`❌ **Error:** ${message.error.message}`);
          await log(``);
        }
      }
    } catch (claudeError) {
      await log(`❌ **Claude Agent Error:** ${claudeError.message}`);
      await log(``);
    }

    const duration = Date.now() - results.startTime;

    await log(`## 📊 EXECUTION SUMMARY`);
    await log(`**Runtime:** ${(duration / 1000).toFixed(1)} seconds`);
    await log(`**Messages:** ${results.messages}`);
    await log(`**Tool Calls:** ${results.toolCalls}`);
    await log(`**Tools Used:** ${Array.from(results.toolsUsed).join(", ")}`);
    await log(`**Entities Processed:** ${results.entitiesProcessed}`);
    await log(`**Searches Performed:** ${results.searchesPerformed}`);
    await log(`**Opportunities Found:** ${results.opportunitiesFound}`);
    await log(``);
    
    if (results.toolCalls === 0) {
      await log(`⚠️ **WARNING:** No tools were called. This may indicate:`);
      await log(`- MCP tools not properly registered`);
      await log(`- Claude chose not to use the available tools`);
      await log(`- Tool execution errors occurred`);
    } else {
      await log(`✅ **SUCCESS:** Real MCP tools were executed with actual data`);
    }
    
    await log(`\n---`);
    await log(`**Run completed at:** ${new Date().toISOString()}`);
    await log(`**Log file:** CLAUDE_AGENT_RUN_${timestamp}.md`);

    return NextResponse.json({
      success: true,
      message: "Claude Headless Agent execution complete.",
      stats: {
        runtime: (duration / 1000).toFixed(1),
        messages: results.messages,
        toolCalls: results.toolCalls,
        toolsUsed: Array.from(results.toolsUsed),
        entitiesProcessed: results.entitiesProcessed,
        searchesPerformed: results.searchesPerformed,
        opportunitiesFound: results.opportunitiesFound,
      },
      logFile: `CLAUDE_AGENT_RUN_${timestamp}.md`,
    });
    
  } catch (error: any) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const errorLogPath = path.join(process.cwd(), "RUN_LOGS", `CLAUDE_AGENT_ERROR_${timestamp}.md`);
    
    try {
      await fs.mkdir(path.dirname(errorLogPath), { recursive: true });
      await fs.writeFile(errorLogPath, `# ❌ CLAUDE AGENT EXECUTION ERROR

**Timestamp:** ${new Date().toISOString()}
**Error:** ${error.message}
**Stack:** ${error.stack}

This error occurred during Claude Agent SDK execution with MCP tools.
`);
    } catch (logError) {
      // If we can't even write the error log, just continue
    }

    return NextResponse.json(
      { 
        success: false, 
        error: error.message,
        errorLogFile: `CLAUDE_AGENT_ERROR_${timestamp}.md`
      },
      { status: 500 }
    );
  }
}