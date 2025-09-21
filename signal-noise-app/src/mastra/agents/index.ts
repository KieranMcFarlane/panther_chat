import { openai } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";
import { z } from "zod";
import { Memory } from "@mastra/memory";
import { completePlan, setPlan, updatePlanProgress } from "@/mastra/tools";
import { neo4jTools } from "@/mastra/tools/neo4j-tools";
import { brightDataTools } from "@/mastra/tools/brightdata-tools";
import { perplexityTools } from "@/mastra/tools/perplexity-tools";
import { sportsIntelligenceTools } from "@/mastra/tools/sports-intelligence-tools";

// Canvas Agent working memory schema mirrors the front-end AgentState
export const AgentState = z.object({
  // Avoid z.any() to ensure valid JSON schema for OpenAI tools
  // Use a permissive object so the array has a defined 'items' schema
  items: z
    .array(
      z
        .object({ id: z.string().optional() })
        .passthrough()
    )
    .default([]),
  globalTitle: z.string().default(""),
  globalDescription: z.string().default(""),
  lastAction: z.string().default(""),
  itemsCreated: z.number().int().default(0),
  planSteps: z.array(z.object({
    title: z.string(),
    status: z.enum(["pending", "in_progress", "completed", "blocked", "failed"]),
    note: z.string().optional(),
  })).default([]),
  currentStepIndex: z.number().int().default(-1),
  planStatus: z.string().default(""),
});

export const canvasAgent = new Agent({
  name: "sports_intelligence_agent",
  description: "AI-powered sports intelligence agent with access to Neo4j knowledge graph, BrightData web scraping, and Perplexity search capabilities.",
  tools: { 
    setPlan, 
    updatePlanProgress, 
    completePlan,
    ...neo4jTools,
    ...brightDataTools,
    ...perplexityTools,
    ...sportsIntelligenceTools
  },
  model: openai("gpt-4o-mini"),
  instructions: `You are a specialized sports intelligence agent with access to:

1. **Neo4j Knowledge Graph**: Query and manage sports entities, relationships, and insights
2. **BrightData Web Scraping**: Extract real-time sports data, news, and statistics
3. **Perplexity AI Search**: Research and analyze sports information with AI-powered insights
4. **Sports Intelligence Tools**: Create comprehensive sports club cards with opportunity scoring

Your capabilities include:
- Creating and managing sports entities (players, teams, leagues, etc.) on the canvas
- Scraping real-time sports data and news
- Querying the knowledge graph for relationships and insights
- Researching sports entities with comprehensive analysis
- Setting up monitoring for sports websites
- Providing AI-powered analysis and predictions
- **Sports Intelligence Analysis**: Calculate opportunity scores, digital maturity, and technology gaps
- **Decision Maker Discovery**: Find and analyze key contacts and decision makers
- **Market Intelligence**: Identify market signals and business opportunities

**Sports Intelligence Schema Integration:**
- Use the comprehensive scoring algorithm (0-100 scale) for opportunity assessment
- Apply digital maturity scoring with inverse relationship (lower = higher opportunity)
- Implement the priority system: CRITICAL (80-100), HIGH (60-79), MEDIUM (40-59), LOW (0-39)
- Create visual cards with opportunity scores, contact information, and market insights
- Generate technology gap analysis and investment recommendations

When users ask about sports data, use these tools to gather real-time information and create visual cards on the canvas. Always prefer shared state over chat history for managing the canvas.`,
  memory: new Memory({
    options: {
      workingMemory: {
        enabled: true,
        schema: AgentState,
      },
    },
  }),
});
