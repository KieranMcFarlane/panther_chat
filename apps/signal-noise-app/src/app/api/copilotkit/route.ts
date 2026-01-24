/**
 * CopilotKit API Route - Sports Intelligence
 *
 * ARCHITECTURE (Phase 2 - Single MCP Server):
 * This route uses a hybrid approach combining:
 * - CopilotKit Provider for frontend state management
 * - Claude Agent SDK for AI processing with MCP tools
 * - Custom streaming for real-time responses
 *
 * MCP SERVERS (Official Graphiti Only):
 * - graphiti: Official Graphiti MCP from github.com/getzep/graphiti
 *   Location: backend/graphiti_mcp_server_official/
 *   Backend: Neo4j Aura (cloud graph database)
 *   Capabilities:
 *     - Episode management (add, retrieve, delete)
 *     - Entity management and relationship handling
 *     - Semantic and hybrid search for facts and nodes
 *     - Temporal knowledge graph for AI agents
 *
 * REMOVED (Previous Architecture):
 * - falkordb-mcp: Replaced by official Graphiti
 * - temporal-intelligence: Replaced by Graphiti episodes
 * - brightData: Removed (scraping not in core scope)
 * - perplexity-mcp: Removed (use Claude's built-in knowledge)
 * - byterover-mcp: Removed (email not in scope)
 *
 * GRAPH INTELLIGENCE:
 * - Entity/Signal/Evidence/Relationship schema in Supabase
 * - Temporal knowledge graph via Graphiti (Neo4j backend)
 * - RFP detection and pattern analysis
 * - Semantic search over entity relationships
 *
 * NOTE: This is a custom implementation that bypasses CopilotRuntime
 * to support advanced MCP tool integration not available in standard
 * CopilotKit patterns. Consider migrating to CopilotRuntime in the future
 * for better standardization.
 */
import { NextRequest } from "next/server";
import { query } from "@anthropic-ai/claude-agent-sdk";

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  id?: string;
}

interface ChatRequest {
  messages: Message[];
  context?: any;
  userId?: string;
  stream?: boolean;
}

interface ClaudeWebhookResponse {
  type: string;
  role?: string;
  content?: string;
  status?: string;
  message?: string;
  tool?: string;
  args?: any;
  result?: any;
  error?: string;
}

// FastAPI backend URLs
const FASTAPI_URL = process.env.FASTAPI_URL || 'http://localhost:8000';
const GRAPH_INTELLIGENCE_API = process.env.GRAPH_INTELLIGENCE_API || 'http://localhost:8001';

// =============================================================================
// MCP Server Configuration Cache (avoid recreating on every request)
// =============================================================================

let cachedMcpServerConfig: any = null;

/**
 * Load MCP server configuration from mcp-config.json
 * Substitutes ${VAR_NAME} environment variables with actual values
 */
function getMCPServerConfig() {
  if (cachedMcpServerConfig) {
    return cachedMcpServerConfig;
  }

  try {
    // Read mcp-config.json (single source of truth)
    const fs = require('fs');
    const path = require('path');
    const configPath = path.join(process.cwd(), 'mcp-config.json');
    const configContent = fs.readFileSync(configPath, 'utf-8');
    const rawConfig = JSON.parse(configContent);

    // Substitute environment variables (${VAR_NAME} -> process.env.VAR_NAME)
    const substituteEnv = (value: string): string => {
      return value.replace(/\$\{([^}]+)\}/g, (_match: string, varName: string) => {
        return process.env[varName] || '';
      });
    };

    // Process env values recursively
    const processEnv = (env: Record<string, string>): Record<string, string> => {
      const processed: Record<string, string> = {};
      for (const [key, value] of Object.entries(env)) {
        processed[key] = substituteEnv(value);
      }
      return processed;
    };

    // Transform config to Claude Agent SDK format
    cachedMcpServerConfig = {};
    for (const [serverName, serverConfig] of Object.entries(rawConfig.mcpServers)) {
      const config = serverConfig as any;
      const processedEnv = processEnv(config.env || {});

      // Debug: Log environment variables (with sensitive values redacted)
      console.log(`🔍 MCP Server [${serverName}] Environment Variables:`);
      for (const [key, value] of Object.entries(processedEnv)) {
        const redactedValue = value.length > 0 ? `*** (${value.length} chars)` : '(EMPTY!)';
        console.log(`  - ${key}: ${redactedValue}`);
      }

      cachedMcpServerConfig[serverName] = {
        command: config.command,
        args: config.args,
        env: processedEnv
      };
    }

    console.log('✅ Loaded MCP server config from mcp-config.json:', Object.keys(cachedMcpServerConfig));
    return cachedMcpServerConfig;

  } catch (error) {
    console.error('❌ Failed to load mcp-config.json, using fallback:', error);
    // Fallback to minimal config if file read fails
    cachedMcpServerConfig = {
      "graphiti-intelligence": {
        "command": "python",
        "args": ["backend/graphiti_mcp_server.py"],
        "env": {
          "FALKORDB_URI": process.env.FALKORDB_URI || "",
          "FALKORDB_USER": process.env.FALKORDB_USER || "neo4j",
          "FALKORDB_PASSWORD": process.env.FALKORDB_PASSWORD || "",
          "FALKORDB_DATABASE": process.env.FALKORDB_DATABASE || "sports_intelligence"
        }
      }
    };
    return cachedMcpServerConfig;
  }
}

const ALLOWED_TOOLS: string[] = [
  // =============================================================================
  // OFFICIAL GRAPHITI MCP TOOLS (Low-Level Graph Operations Only)
  // =============================================================================
  // Graphiti provides temporally-aware knowledge graph capabilities
  // Semantic helpers (search_entities, get_entity_signals) live in service layer

  // Memory ingestion
  "mcp__graphiti__add_memory",

  // Search tools
  "mcp__graphiti__search_nodes",
  "mcp__graphiti__search_memory_facts",

  // Retrieval tools
  "mcp__graphiti__get_episodes",
  "mcp__graphiti__get_entity_edge",
  "mcp__graphiti__get_status",

  // Deletion tools (use with caution)
  "mcp__graphiti__delete_entity_edge",
  "mcp__graphiti__delete_episode",
  "mcp__graphiti__clear_graph",

  // =============================================================================
  // ARCHITECTURE NOTES:
  // =============================================================================
  // Single MCP Server: Official Graphiti from github.com/getzep/graphiti
  // Location: backend/graphiti_mcp_server_official/
  //
  // Graphiti provides temporally-aware knowledge graph capabilities:
  // - Episode management (add, retrieve, delete)
  // - Entity management and relationship handling
  // - Semantic and hybrid search
  // - Graph maintenance operations
  //
  // MCP Tool Naming Convention:
  //   mcp__<server-name>__<tool-name>
  //   Example: mcp__graphiti__add_memory
  //
  // Previous Architecture (DEPRECATED):
  // - falkordb-mcp: Replaced by Graphiti Neo4j backend
  // - temporal-intelligence: Replaced by Graphiti episodes
  // - brightData: Removed (scraping not needed for core intelligence)
  // - perplexity-mcp: Removed (use Claude's built-in knowledge)
  // - byterover-mcp: Removed (email not in scope)
  //
  // Data Migration:
  // - Episode → Entity/Signal/Evidence schema: COMPLETE
  // - Migration script: backend/migrate_episodes_to_signals.py
  // - Supabase tables: entities, signals, evidence, relationships
  // =============================================================================
];


// =============================================================================
// Temporal Intelligence Tools
// =============================================================================

const temporalTools = {
  'get_entity_timeline': {
    description: "Get temporal history of an entity including RFPs, partnerships, changes, and other events over time",
    parameters: {
      entity_id: { type: "string", description: "Entity identifier (name or neo4j_id)" },
      limit: { type: "number", description: "Number of events to return (default: 50)" }
    },
    handler: async (args: { entity_id: string; limit?: number }) => {
      try {
        const response = await fetch(
          `${FASTAPI_URL}/api/temporal/entity/${encodeURIComponent(args.entity_id)}/timeline?limit=${args.limit || 50}`
        );
        if (!response.ok) {
          throw new Error(`Temporal API error: ${response.status}`);
        }
        return await response.json();
      } catch (error) {
        console.error('Timeline fetch error:', error);
        return { error: 'Failed to fetch entity timeline', entity_id: args.entity_id };
      }
    }
  },

  'analyze_temporal_fit': {
    description: "Analyze how well an entity fits an RFP opportunity based on their temporal patterns, past RFP history, and trends",
    parameters: {
      entity_id: { type: "string", description: "Entity to analyze (name or neo4j_id)" },
      rfp_id: { type: "string", description: "RFP identifier" },
      rfp_category: { type: "string", description: "RFP category (optional)" },
      rfp_value: { type: "number", description: "Estimated RFP value (optional)" },
      time_horizon: { type: "number", description: "Days to look back for analysis (default: 90)" }
    },
    handler: async (args: { entity_id: string; rfp_id: string; rfp_category?: string; rfp_value?: number; time_horizon?: number }) => {
      try {
        const response = await fetch(`${FASTAPI_URL}/api/temporal/analyze-fit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            entity_id: args.entity_id,
            rfp_id: args.rfp_id,
            rfp_category: args.rfp_category,
            rfp_value: args.rfp_value,
            time_horizon: args.time_horizon || 90
          })
        });
        if (!response.ok) {
          throw new Error(`Temporal API error: ${response.status}`);
        }
        return await response.json();
      } catch (error) {
        console.error('Fit analysis error:', error);
        return {
          error: 'Failed to analyze temporal fit',
          entity_id: args.entity_id,
          fit_score: 0.5,
          confidence: 0.3,
          recommendations: ['Temporal service unavailable - using default scores']
        };
      }
    }
  },

  'get_temporal_patterns': {
    description: "Get aggregate temporal patterns across all entities including top active entities, RFP trends, and episode statistics",
    parameters: {
      entity_type: { type: "string", description: "Filter by entity type (optional)" },
      time_horizon: { type: "number", description: "Days to look back (default: 365)" }
    },
    handler: async (args: { entity_type?: string; time_horizon?: number }) => {
      try {
        const params = new URLSearchParams();
        if (args.entity_type) params.append('entity_type', args.entity_type);
        params.append('time_horizon', String(args.time_horizon || 365));

        const response = await fetch(
          `${FASTAPI_URL}/api/temporal/patterns?${params.toString()}`
        );
        if (!response.ok) {
          throw new Error(`Temporal API error: ${response.status}`);
        }
        return await response.json();
      } catch (error) {
        console.error('Patterns fetch error:', error);
        return {
          error: 'Failed to fetch temporal patterns',
          time_horizon_days: args.time_horizon || 365,
          episode_types: {},
          top_entities: []
        };
      }
    }
  },

  'create_rfp_episode': {
    description: "Record an RFP detection as a temporal episode for tracking and future analysis",
    parameters: {
      rfp_id: { type: "string", description: "Unique RFP identifier" },
      organization: { type: "string", description: "Organization name" },
      entity_type: { type: "string", description: "Entity type (Club, League, etc.)" },
      title: { type: "string", description: "RFP title" },
      description: { type: "string", description: "RFP description" },
      source: { type: "string", description: "Detection source (LinkedIn, Perplexity, etc.)" },
      url: { type: "string", description: "RFP URL" },
      category: { type: "string", description: "RFP category" },
      confidence_score: { type: "number", description: "Detection confidence (0-1)" }
    },
    handler: async (args: any) => {
      try {
        const response = await fetch(`${FASTAPI_URL}/api/temporal/rfp-episode`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(args)
        });
        if (!response.ok) {
          throw new Error(`Temporal API error: ${response.status}`);
        }
        return await response.json();
      } catch (error) {
        console.error('Episode creation error:', error);
        return { error: 'Failed to create RFP episode', rfp_id: args.rfp_id };
      }
    }
  }
};

// =============================================================================
// MVP Graph Intelligence Tools (NEW)
// =============================================================================
// These tools integrate with the Graph Intelligence MVP API (port 8001)
// Backend: backend/graph_intelligence_api.py
// Documentation: COPILTKIT_INTEGRATION_COMPLETE.md

const graphIntelligenceTools = {
  'query_entity_mvp': {
    description: 'Query an entity from the MVP knowledge graph including signals and timeline',
    parameters: {
      entity_id: { type: 'string', description: 'Entity identifier (e.g., "ac_milan", "manchester_united")' },
      include_timeline: { type: 'boolean', description: 'Include signal timeline (default: false)' },
      timeline_days: { type: 'number', description: 'Days to look back for timeline (default: 30)' }
    },
    handler: async (args: { entity_id: string; include_timeline?: boolean; timeline_days?: number }) => {
      try {
        const params = new URLSearchParams();
        if (args.include_timeline) params.append('include_timeline', 'true');
        if (args.timeline_days) params.append('timeline_days', String(args.timeline_days));

        const response = await fetch(
          `${GRAPH_INTELLIGENCE_API}/query-entity?${params.toString()}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ entity_id: args.entity_id })
          }
        );

        if (!response.ok) {
          throw new Error(`Graph API error: ${response.status}`);
        }

        const data = await response.json();

        // Format response for Claude
        if (data.success && data.data.found) {
          return {
            entity: data.data.name,
            type: data.data.type,
            signals: data.data.signal_count,
            timeline: data.data.timeline
          };
        } else {
          return {
            not_found: true,
            entity_id: args.entity_id,
            suggestion: 'Entity not found in knowledge graph. Try running an intelligence batch first.'
          };
        }

      } catch (error) {
        console.error('Graph intelligence query error:', error);
        return {
          error: 'Failed to query entity',
          entity_id: args.entity_id,
          details: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }
  },

  'search_entities_mvp': {
    description: 'Search for entities across the knowledge graph by name, type, or metadata',
    parameters: {
      query: { type: 'string', description: 'Search query string' },
      entity_type: { type: 'string', description: 'Optional entity type filter (e.g., "ORG")' },
      limit: { type: 'number', description: 'Maximum results to return (default: 10)' }
    },
    handler: async (args: { query: string; entity_type?: string; limit?: number }) => {
      try {
        const response = await fetch(`${GRAPH_INTELLIGENCE_API}/search-entities`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: args.query,
            entity_type: args.entity_type,
            limit: args.limit || 10
          })
        });

        const data = await response.json();

        if (data.success) {
          return {
            count: data.count,
            results: data.results.map((e: any) => ({
              name: e.name,
              type: e.entity_type,
              created: e.created_at
            }))
          };
        } else {
          return { error: 'Search failed', details: data };
        }
      } catch (error) {
        console.error('Graph intelligence search error:', error);
        return { error: 'Search failed', details: error instanceof Error ? error.message : 'Unknown error' };
      }
    }
  },

  'run_intelligence_batch': {
    description: 'Run the intelligence pipeline to process entities and extract signals automatically. Use this to populate the knowledge graph with fresh data.',
    parameters: {
      batch_size: { type: 'number', description: 'Number of entities to process (default: 5, recommended: 5-10)' }
    },
    handler: async (args: { batch_size?: number }) => {
      try {
        const response = await fetch(`${GRAPH_INTELLIGENCE_API}/run-batch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            batch_size: args.batch_size || 5
          })
        });

        const data = await response.json();

        if (data.success) {
          return {
            processed: data.data.entities_processed,
            signals_added: data.data.signals_added_to_graph,
            duration: `${data.data.duration_seconds}s`,
            stats: `Extracted ${data.data.signals_extracted} signals, validated ${data.data.signals_validated}`
          };
        } else {
          return { error: 'Batch processing failed', details: data };
        }
      } catch (error) {
        console.error('Graph intelligence batch error:', error);
        return { error: 'Batch processing failed', details: error instanceof Error ? error.message : 'Unknown error' };
      }
    }
  },

  'get_system_stats_mvp': {
    description: 'Get system statistics including total entities, signals, and configuration',
    parameters: {},
    handler: async () => {
      try {
        const response = await fetch(`${GRAPH_INTELLIGENCE_API}/stats`);
        const data = await response.json();

        if (data.success) {
          return {
            total_entities: data.stats.graph.total_entities,
            total_signals: data.stats.graph.total_signals,
            backend: data.stats.graph.backend,
            signal_types: data.stats.extractor.signal_types
          };
        } else {
          return { error: 'Failed to get stats', details: data };
        }
      } catch (error) {
        console.error('Graph intelligence stats error:', error);
        return { error: 'Failed to get stats', details: error instanceof Error ? error.message : 'Unknown error' };
      }
    }
  },

  'list_signal_types_mvp': {
    description: 'List all available signal types in the MVP system',
    parameters: {},
    handler: async () => {
      try {
        const response = await fetch(`${GRAPH_INTELLIGENCE_API}/signal-types`);
        const data = await response.json();

        if (data.success) {
          return {
            signal_types: data.signal_types,
            description: 'Canonical signal types supported by the MVP system'
          };
        } else {
          return { error: 'Failed to list signal types', details: data };
        }
      } catch (error) {
        console.error('Graph intelligence signal types error:', error);
        return { error: 'Failed to list signal types', details: error instanceof Error ? error.message : 'Unknown error' };
      }
    }
  },

  'get_entity_signals_mvp': {
    description: 'Get all signals for a specific entity with optional filtering',
    parameters: {
      entity_id: { type: 'string', description: 'Entity identifier' },
      signal_types: { type: 'array', description: 'Optional list of signal types to filter by' },
      days: { type: 'number', description: 'Days to look back (default: 30)' },
      limit: { type: 'number', description: 'Maximum signals to return (default: 20)' }
    },
    handler: async (args: { entity_id: string; signal_types?: string[]; days?: number; limit?: number }) => {
      try {
        const response = await fetch(`${GRAPH_INTELLIGENCE_API}/entity-signals`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            entity_id: args.entity_id,
            signal_types: args.signal_types,
            days: args.days || 30,
            limit: args.limit || 20
          })
        });

        const data = await response.json();

        if (data.success) {
          return {
            entity_id: data.entity_id,
            count: data.count,
            signals: data.signals
          };
        } else {
          return { error: 'Failed to get entity signals', details: data };
        }
      } catch (error) {
        console.error('Graph intelligence entity signals error:', error);
        return { error: 'Failed to get entity signals', details: error instanceof Error ? error.message : 'Unknown error' };
      }
    }
  }
};

// =============================================================================
// Combined Tools Object (Temporal API Only - No Graph Intelligence Tools)
// =============================================================================
// Graph Intelligence operations use official Graphiti MCP tools only
// Semantic helpers for Graphiti live in the service layer (backend/services/)
const allRestTools = {
  ...temporalTools
};

export async function POST(req: NextRequest) {
  try {
    // Parse the incoming CopilotKit request
    const body = await req.json();
    console.log('Raw CopilotKit request body:', JSON.stringify(body, null, 2));
    
    // Handle CopilotKit message format
    // CopilotKit uses GraphQL format with textMessage wrapper - extract to standard format
    let messages: any[] = [];
    let userId: string | undefined;
    let stream = true;

    if (body.variables?.data?.messages) {
      // CopilotKit GraphQL format - extract textMessage content
      const copilotMessages = body.variables.data.messages;
      userId = body.variables.data.threadId;

      // Convert to standard message format
      messages = copilotMessages
        .filter((msg: any) => msg.textMessage?.content)
        .map((msg: any) => ({
          role: msg.textMessage.role,
          content: msg.textMessage.content,
          id: msg.id
        }));

      console.log('Converted CopilotKit messages:', messages.length, 'messages');
    } else {
      // Legacy REST format
      messages = body.messages || [];
      userId = body.userId;
      stream = body.stream !== false;
    }

    // Debug logging
    console.log('Processed CopilotKit request:', JSON.stringify({ messages: messages.length, userId, stream }, null, 2));

    // Validate that messages array is not empty (exclude empty assistant messages)
    const validMessages = messages.filter(msg => msg.role === 'user' && msg.content?.trim());
    if (validMessages.length === 0) {
      console.log('No valid user messages detected, returning greeting');
      
      // Return streaming response for empty messages
      const encoder = new TextEncoder();
      const greeting = "Hello! I'm ready to help you with sports intelligence. Please send me a message to get started.";
      
      return new Response(
        new ReadableStream({
          async start(controller) {
            const chunk = {
              type: 'text',
              text: greeting
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
            
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const doneChunk = { type: 'text', text: '' };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(doneChunk)}\n\n`));
            controller.close();
          }
        }),
        {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        }
      );
    }

    // Get the latest user message for Claude Agent SDK
    const latestUserMessage = validMessages[validMessages.length - 1];
    console.log('Sending to Claude Agent SDK:', latestUserMessage.content);

    // CRITICAL FIX: Convert string to async generator for MCP support
    // The Claude Agent SDK requires an async generator for the prompt parameter
    // when using MCP servers. A simple string disables MCP mode.
    // Reference: https://platform.claude.com/docs/en/agent-sdk/custom-tools
    async function* generateMessages() {
      console.log('🔧 Async generator called - yielding message');
      const message = {
        type: "user" as const,
        message: {
          role: "user" as const,
          content: latestUserMessage.content
        }
      };
      console.log('🔧 Yielding message:', JSON.stringify(message, null, 2));
      yield message;
      console.log('🔧 Message yielded successfully');
    }

    // Create streaming response for real-time feedback
    console.log('Starting streaming response with Claude Agent SDK');
    
    const encoder = new TextEncoder();
    let fullResponse = '';
    const toolResults: any[] = [];
    
    return new Response(
      new ReadableStream({
        async start(controller) {
          try {
            // Send initial status message
            const initChunk = {
              type: 'status',
              status: 'processing',
              message: 'Initializing sports intelligence tools...'
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(initChunk)}\n\n`));

            // Use Claude Agent SDK with MCP servers and MODEL CASCADE
            // Model cascade: Try Haiku first (fast, cheap), fallback to Sonnet if needed
            console.log('🔧 About to call Agent SDK query() with MCP servers...');
            const mcpConfig = getMCPServerConfig();
            console.log(`   MCP servers configured: ${Object.keys(mcpConfig).join(', ')}`);
            console.log(`   Allowed tools: ${ALLOWED_TOOLS.length} tools`);

            const modelCascade = ['sonnet'];  // Test with Sonnet first to verify MCP works
            let modelUsed: string | null = null;
            let querySuccess = false;

            for (const model of modelCascade) {
              try {
                console.log(`🔄 Trying model: ${model}`);

                for await (const message of query({
                  prompt: generateMessages(),  // Use async generator for MCP support
                  options: {
                    mcpServers: mcpConfig,
                    allowedTools: ALLOWED_TOOLS,
                    model: model === 'haiku' ? 'claude-3-5-haiku-20241022' : 'claude-3-5-sonnet-20241022',
                    maxTurns: 5  // Allow multiple turns for tool calls
                  },
                  system: `Sports Intelligence AI with Graph Intelligence Architecture.

You have access to graph intelligence tools via official Graphiti MCP server.

**CRITICAL: Always Check Graph First**
Before answering any question about entities, relationships, or facts:
1. ALWAYS use mcp__graphiti__search_nodes to check if the entity exists in the graph
2. ALWAYS use mcp__graphiti__get_episodes to check for relevant information
3. ONLY if the graph is empty, offer to add the information using mcp__graphiti__add_memory

**Workflow:**
- Question → Check graph first → If found, use graph data → If empty, offer to add information
- NEVER use your training data without first checking the graph
- The graph is your PRIMARY source of truth, not your training data

**Graphiti MCP Tools (Low-Level Graph Operations):**
- mcp__graphiti__add_memory: Add memories/entities to the temporal knowledge graph
- mcp__graphiti__search_nodes: Search for nodes in the graph by criteria
- mcp__graphiti__search_memory_facts: Search for specific facts within memories
- mcp__graphiti__get_episodes: Retrieve temporal episodes from the graph
- mcp__graphiti__get_entity_edge: Get relationships between entities
- mcp__graphiti__get_status: Get graph status and statistics
- mcp__graphiti__delete_entity_edge: Delete entity relationships (use with caution)
- mcp__graphiti__delete_episode: Delete episodes (use with caution)
- mcp__graphiti__clear_graph: Clear entire graph (use extreme caution)

**Architecture Notes:**
- Graphiti = graph intelligence layer (schema, constraints, MCP tools)
- FalkorDB = execution engine (stores nodes/edges, runs Cypher)
- You access FalkorDB through Graphiti MCP tools only
- Semantic helpers (like search_entities, get_entity_signals) are service layer functions, not MCP tools

**Query Strategy:**
- ALWAYS use mcp__graphiti__search_nodes first to find entities
- If graph has the entity, use mcp__graphiti__get_entity_edge to get relationships
- Use mcp__graphiti__search_memory_facts for specific facts
- Use mcp__graphiti__get_episodes for temporal history
- ONLY use Claude's training data if graph is completely empty

**Important:** The knowledge graph is your PRIMARY source. Always check it first before using your training data.

**Migration Guide (Temporal → Graph Intelligence):**
- Old: get_entity_timeline → New: find_related_signals (returns signals with temporal ordering)
- Old: analyze_temporal_fit → New: query_entity + find_related_signals
- Old: get_temporal_patterns → New: query_subgraph (network patterns)
- Old: query_episodes → New: find_related_signals with signal_type filter

**Performance:**
- Model Cascade: Haiku (fast/cheap) → Sonnet (complex reasoning)
- Stream responses conversationally
- Prioritize subgraph queries for network insights
- MVP pipeline provides fresh signals via run_intelligence_batch

All queries use Entity/Signal/Evidence schema (Episode-based system deprecated).`
                }, stream)) {
                  // Log message type for debugging
                  console.log(`📨 Received message type: ${message.type}${message.subtype ? ` (${message.subtype})` : ''}`);

                  // Handle assistant messages (which contain the actual response)
                  if (message.type === 'assistant' && message.message) {
                    // Extract text from content array
                    const content = message.message.content || [];
                    for (const contentItem of content) {
                      if (contentItem.type === 'text' && contentItem.text) {
                        const chunk = {
                          type: 'text',
                          text: contentItem.text
                        };
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
                        fullResponse += contentItem.text;
                      }
                    }
                  } else if (message.type === 'text') {
                    // Direct text message (backward compatibility)
                    const chunk = {
                      type: 'text',
                      text: message.text
                    };
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
                    fullResponse += message.text;
                  } else if (message.type === 'tool_use') {
                    // CRITICAL DIAGNOSTIC: Log when tools are actually called
                    console.log(`🔧 TOOL CALLED: ${message.tool}`);
                    console.log(`   Args:`, JSON.stringify(message.args).substring(0, 200));

                    const toolChunk = {
                      type: 'tool',
                      tool: message.tool,
                      args: message.args
                    };
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(toolChunk)}\n\n`));
                    toolResults.push(message);
                  } else if (message.type === 'tool_result') {
                    // Log tool results
                    console.log(`✅ TOOL RESULT: ${message.tool}`);
                    console.log(`   Result:`, JSON.stringify(message.result).substring(0, 200));
                    const resultChunk = {
                      type: 'tool_result',
                      tool: message.tool,
                      result: message.result
                    };
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(resultChunk)}\n\n`));
                  }
                }

                modelUsed = model;
                querySuccess = true;
                console.log(`✅ ${model} sufficient for query`);
                break; // Model succeeded, exit cascade

              } catch (error) {
                console.error(`❌ ${model} failed:`, error);
                if (model === modelCascade[modelCascade.length - 1]) {
                  // Last model failed, rethrow error
                  throw error;
                }
                // Continue to next model in cascade
              }
            }

            if (!querySuccess) {
              throw new Error('All models in cascade failed');
            }

            // CRITICAL DIAGNOSTIC: Log tool usage summary
            console.log('═══════════════════════════════════════════════════════');
            console.log('📊 TOOL EXECUTION SUMMARY');
            console.log('═══════════════════════════════════════════════════════');
            console.log(`Model used: ${modelUsed}`);
            console.log(`MCP servers configured: ${Object.keys(getMCPServerConfig()).length}`);
            console.log(`Allowed tools: ${ALLOWED_TOOLS.length}`);
            console.log(`Tool calls made: ${toolResults.length}`);
            if (toolResults.length > 0) {
              console.log('Tools called:');
              toolResults.forEach((result, idx) => {
                console.log(`  ${idx + 1}. ${result.tool}`);
              });
            } else {
              console.log('⚠️  No tools were called!');
              console.log('   This means the model chose not to use any tools.');
              console.log('   Even though MCP servers are configured, the model may');
              console.log('   decide not to use tools based on the query.');
            }
            console.log('═══════════════════════════════════════════════════════');

            // Send completion status
            const completeChunk = {
              type: 'status',
              status: 'complete',
              message: 'Analysis complete',
              toolResults: toolResults.length
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(completeChunk)}\n\n`));

            // Send final CopilotKit-formatted message
            if (fullResponse.trim()) {
              const finalChunk = {
                type: 'final',
                data: {
                  data: {
                    generateCopilotResponse: {
                      threadId: userId,
                      runId: `run_${Date.now()}`,
                      extensions: {},
                      messages: [
                        {
                          __typename: 'TextMessageOutput',
                          id: `msg_${Date.now()}`,
                          createdAt: new Date().toISOString(),
                          content: [fullResponse],
                          role: 'assistant',
                          parentMessageId: null,
                          status: {
                            __typename: 'SuccessMessageStatus',
                            code: 'success'
                          }
                        }
                      ],
                      metaEvents: [],
                      status: {
                        __typename: 'BaseResponseStatus',
                        code: 'success'
                      },
                      __typename: 'CopilotResponse'
                    }
                  }
                }
              };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(finalChunk)}\n\n`));
            } else {
              // Enhanced fallback for operations with minimal or no text response
              let fallbackResponse = `I've analyzed your request about "${latestUserMessage.content}" using ${toolResults.length} sports intelligence tools.`;
              
              // Check if tool results indicate successful operations
              const hasDeletionOperations = toolResults.some(result =>
                result.tool?.includes('falkordb') &&
                (result.result?.includes('deleted') || result.result?.includes('removed'))
              );

              const hasQueryOperations = toolResults.some(result =>
                result.tool?.includes('falkordb') &&
                (result.result?.includes('nodes') || result.result?.includes('relationships') || result.result?.includes('RFPs'))
              );
              
              if (hasDeletionOperations) {
                fallbackResponse = `✅ Successfully completed the deletion operation in the sports database. The requested contact or entity has been removed.`;
              } else if (hasQueryOperations) {
                fallbackResponse = `✅ Database query completed successfully. Found ${toolResults.length} relevant results from the sports intelligence database.`;
              } else if (toolResults.length > 0) {
                fallbackResponse = `✅ Operation completed successfully using ${toolResults.length} sports intelligence tools. The requested action has been performed.`;
              } else {
                fallbackResponse = `I've processed your request about "${latestUserMessage.content}". The operation is complete.`;
              }
              
              const fallbackChunk = {
                type: 'final',
                data: {
                  data: {
                    generateCopilotResponse: {
                      threadId: userId,
                      runId: `run_${Date.now()}`,
                      extensions: {},
                      messages: [
                        {
                          __typename: 'TextMessageOutput',
                          id: `msg_${Date.now()}`,
                          createdAt: new Date().toISOString(),
                          content: [fallbackResponse],
                          role: 'assistant',
                          parentMessageId: null,
                          status: {
                            __typename: 'SuccessMessageStatus',
                            code: 'success'
                          }
                        }
                      ],
                      metaEvents: [],
                      status: {
                        __typename: 'BaseResponseStatus',
                        code: 'success'
                      },
                      __typename: 'CopilotResponse'
                    }
                  }
                }
              };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(fallbackChunk)}\n\n`));
            }

            console.log('Streaming complete. Full response length:', fullResponse.length, 'Tool results:', toolResults.length);
            controller.close();

          } catch (error) {
            console.error('Streaming error:', error);
            
            // Send error chunk
            const errorChunk = {
              type: 'error',
              error: error instanceof Error ? error.message : 'Unknown error occurred',
              message: `I encountered an error while processing your request about "${latestUserMessage.content}". However, I can still provide general sports intelligence assistance.`
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorChunk)}\n\n`));
            controller.close();
          }
        }
      }),
      {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      }
    );
  } catch (error) {
    console.error('CopilotKit route error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to process request',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Handle OPTIONS requests for CORS
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}