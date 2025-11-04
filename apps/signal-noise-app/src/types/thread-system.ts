// Enhanced types for parallel conversation threads with Teams Store integration

export type ThreadStatus = 'idle' | 'thinking' | 'processing' | 'completed' | 'error';

export interface ConversationThread {
  id: string;
  userId: string;           // Better Auth user who owns this thread
  name: string;
  description?: string;
  status: ThreadStatus;
  messages: Message[];
  lastActivity: Date;
  createdAt: Date;
  updatedAt: Date;
  isArchived: boolean;
  isPinned: boolean;
  hasUnreadActivity: boolean; // For bell notifications
  claudeConfig: ClaudeConfig;
  tags: string[];
  
  // Parallel execution state
  isCurrentlyProcessing: boolean;
  currentTask?: {
    type: 'chat' | 'research' | 'analysis' | 'data_processing';
    description: string;
    startedAt: Date;
    estimatedDuration?: number;
  };
  
  // Teams Store integration
  sharedMemory?: {
    entities: string[];      // Entities discovered in this thread
    insights: string[];      // Key insights from this thread
    resources: Resource[];   // Resources found via BrightData
    connections: Connection[]; // Connections to other threads
  };
}

export interface Message {
  id: string;
  type: 'user' | 'assistant' | 'system' | 'thinking' | 'tool_result';
  content: string;
  timestamp: Date;
  threadId: string;
  userId: string;
  toolCalls?: ToolCall[];
  metadata?: {
    processingTime?: number;
    confidence?: number;
    sources?: string[];
    entities?: string[];
  };
}

export interface ToolCall {
  tool: string;
  args: any;
  result?: any;
  status: 'pending' | 'completed' | 'error';
  executionTime?: number;
  threadId: string;
}

export interface ClaudeConfig {
  model: string;
  temperature: number;
  maxTokens: number;
  tools: string[];
  systemPrompt: string;
  enableParallelProcessing: boolean;
}

// Teams Store - Global shared memory across all users and threads
export interface TeamsStore {
  id: string;
  name: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
  
  // Shared knowledge base
  entities: Entity[];
  insights: Insight[];
  resources: Resource[];
  connections: Connection[];
  conversations: ConversationSummary[];
  
  // BrightData MCP integration
  webResearch: WebResearchEntry[];
  scrapedContent: ScrapedContentEntry[];
  
  // Thread cross-references
  threadReferences: ThreadReference[];
}

export interface Entity {
  id: string;
  name: string;
  type: 'person' | 'organization' | 'opportunity' | 'location' | 'event';
  properties: Record<string, any>;
  discoveredBy: string[];    // Thread IDs that discovered this entity
  confidence: number;
  lastUpdated: Date;
  sources: string[];
}

export interface Insight {
  id: string;
  title: string;
  content: string;
  category: string;
  confidence: number;
  discoveredBy: string[];    // Thread IDs that generated this insight
  createdAt: Date;
  tags: string[];
}

export interface Resource {
  id: string;
  title: string;
  url: string;
  type: 'article' | 'report' | 'website' | 'document' | 'data';
  summary: string;
  discoveredBy: string[];    // Thread IDs that found this resource
  discoveredVia: 'brightdata' | 'user_input' | 'ai_inference';
  metadata: Record<string, any>;
  createdAt: Date;
}

export interface Connection {
  id: string;
  fromEntity: string;
  toEntity: string;
  type: string;
  strength: number;
  discoveredBy: string[];    // Thread IDs that found this connection
  createdAt: Date;
  verified: boolean;
}

export interface ConversationSummary {
  id: string;
  threadId: string;
  userId: string;
  title: string;
  summary: string;
  keyPoints: string[];
  entities: string[];
  insights: string[];
  createdAt: Date;
}

export interface WebResearchEntry {
  id: string;
  query: string;
  results: SearchResult[];
  performedBy: string;       // Thread ID
  createdAt: Date;
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  relevanceScore: number;
}

export interface ScrapedContentEntry {
  id: string;
  url: string;
  content: string;
  extractedData: Record<string, any>;
  scrapedBy: string;         // Thread ID
  createdAt: Date;
}

export interface ThreadReference {
  threadId: string;
  referencedBy: string[];    // Other thread IDs that reference this
  context: string;
  strength: number;
}

// Thread execution state for parallel processing
export interface ThreadExecution {
  threadId: string;
  status: ThreadStatus;
  currentStep: string;
  progress: number;
  startTime?: Date;
  endTime?: Date;
  error?: string;
  notifications: ThreadNotification[];
}

export interface ThreadNotification {
  id: string;
  threadId: string;
  type: 'task_completed' | 'error' | 'insight_found' | 'resource_discovered';
  title: string;
  message: string;
  timestamp: Date;
  isRead: boolean;
  priority: 'low' | 'medium' | 'high';
}

// Enhanced thread state
export interface ThreadState {
  threads: ConversationThread[];
  activeThreadId: string | null;
  teamsStore: TeamsStore;
  executions: Record<string, ThreadExecution>;
  notifications: ThreadNotification[];
  isLoading: boolean;
  error: string | null;
  filters: {
    status?: ThreadStatus;
    userId?: string;
    tags?: string[];
    dateRange?: { start: Date; end: Date };
  };
  viewMode: 'threads' | 'teams-store' | 'notifications';
}

// Thread actions for parallel execution
export interface ThreadAction {
  type: 'CREATE_THREAD' | 'UPDATE_THREAD' | 'DELETE_THREAD' | 'SET_ACTIVE_THREAD' |
        'START_EXECUTION' | 'UPDATE_EXECUTION' | 'COMPLETE_EXECUTION' | 'SET_THREAD_STATUS' |
        'ADD_MESSAGE' | 'UPDATE_TEAMS_STORE' | 'ADD_NOTIFICATION' | 'MARK_NOTIFICATION_READ' |
        'SET_FILTERS' | 'SET_VIEW_MODE';
  payload: any;
}

// Thread templates for quick creation
export const THREAD_TEMPLATES = {
  quick_research: {
    name: 'Quick Research',
    description: 'Fast research using BrightData MCP',
    claudeConfig: {
      model: 'claude-3-sonnet-20240229',
      temperature: 0.3,
      maxTokens: 4000,
      tools: ['brightdata', 'neo4j-mcp'],
      systemPrompt: 'You are a research assistant. Use BrightData MCP to find current information and Neo4j to connect with existing knowledge.',
      enableParallelProcessing: true
    },
    tags: ['research', 'quick']
  },
  
  deep_analysis: {
    name: 'Deep Analysis',
    description: 'Comprehensive analysis with multiple tools',
    claudeConfig: {
      model: 'claude-3-sonnet-20240229',
      temperature: 0.2,
      maxTokens: 8000,
      tools: ['brightdata', 'neo4j-mcp', 'perplexity-mcp'],
      systemPrompt: 'You are an analyst. Perform deep research using all available tools and contribute findings to the Teams Store.',
      enableParallelProcessing: true
    },
    tags: ['analysis', 'comprehensive']
  },
  
  rfp_monitoring: {
    name: 'RFP Monitoring',
    description: 'Monitor and analyze RFP opportunities',
    claudeConfig: {
      model: 'claude-3-sonnet-20240229',
      temperature: 0.4,
      maxTokens: 6000,
      tools: ['brightdata', 'neo4j-mcp'],
      systemPrompt: 'You are an RFP intelligence specialist. Monitor procurement opportunities and add them to the Teams Store.',
      enableParallelProcessing: true
    },
    tags: ['rfp', 'monitoring', 'opportunities']
  },
  
  entity_mapping: {
    name: 'Entity Mapping',
    description: 'Map relationships between entities',
    claudeConfig: {
      model: 'claude-3-sonnet-20240229',
      temperature: 0.1,
      maxTokens: 4000,
      tools: ['neo4j-mcp'],
      systemPrompt: 'You are a knowledge graph specialist. Map entity relationships and update the Teams Store.',
      enableParallelProcessing: true
    },
    tags: ['entities', 'mapping', 'knowledge-graph']
  }
} as const;

export type ThreadTemplate = keyof typeof THREAD_TEMPLATES;