// Core types for the multi-user tab system

export type TabType = 'general' | 'rfp' | 'sports' | 'knowledge-graph' | 'custom';

export interface Message {
  id: string;
  type: 'user' | 'assistant' | 'system' | 'thinking';
  content: string;
  timestamp: Date;
  toolCalls?: ToolCall[];
  userId?: string; // Track which user sent the message
}

export interface ToolCall {
  tool: string;
  args: any;
  result?: any;
  status: 'pending' | 'completed' | 'error';
}

export interface UserTabContext {
  userId: string;
  sessionId: string;
  organizationId?: string;
  role: 'user' | 'admin' | 'member';
  permissions: string[];
  activeSession: {
    token: string;
    expiresAt: Date;
    impersonatedBy?: string;
  };
}

export interface TabACL {
  owner: string;
  viewers: string[];
  editors: string[];
  isPublic: boolean;
  organizationLevel: boolean;
  permissions: {
    canView: boolean;
    canEdit: boolean;
    canShare: boolean;
    canDelete: boolean;
    canExport: boolean;
  };
}

export interface ClaudeConfig {
  model: string;
  temperature: number;
  maxTokens: number;
  tools: string[];
  systemPrompt: string;
}

export interface TabMetadata {
  title: string;
  summary: string;
  messageCount: number;
  tokenUsage: number;
  toolsUsed: string[];
  entitiesMentioned: string[];
  category: TabType;
  tags: string[];
  isFavorite: boolean;
  isArchived: boolean;
}

export interface ChatTab {
  id: string;
  ownerId: string;
  organizationId?: string;
  name: string;
  type: TabType;
  color?: string;
  isPinned: boolean;
  isShared: boolean;
  sharedWith: string[];
  messages: Message[];
  context: UserTabContext;
  acl: TabACL;
  claudeConfig: ClaudeConfig;
  metadata: TabMetadata;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatHistory {
  id: string;
  tabId: string;
  userId: string;
  messages: Message[];
  context: UserTabContext;
  metadata: TabMetadata;
  createdAt: Date;
  updatedAt: Date;
  isArchived: boolean;
  isFavorite: boolean;
  tags: string[];
}

export interface TabState {
  tabs: ChatTab[];
  activeTabId: string | null;
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
  filterType: TabType | 'all';
  viewMode: 'tabs' | 'history' | 'search';
}

export interface TabAction {
  type: 'CREATE_TAB' | 'UPDATE_TAB' | 'DELETE_TAB' | 'SET_ACTIVE_TAB' | 
        'ADD_MESSAGE' | 'UPDATE_MESSAGES' | 'SET_LOADING' | 'SET_ERROR' |
        'SET_SEARCH_QUERY' | 'SET_FILTER_TYPE' | 'SET_VIEW_MODE' | 'REORDER_TABS';
  payload: any;
}

// Tab type configurations
export const TAB_TYPE_CONFIGS = {
  general: {
    name: 'General Chat',
    icon: '💬',
    color: '#3B82F6',
    systemPrompt: "You are a helpful AI assistant for the Signal Noise sports intelligence platform.",
    tools: ['neo4j-mcp', 'brightdata', 'perplexity-mcp', 'better-auth'],
    defaultClaudeConfig: {
      model: 'claude-3-sonnet-20240229',
      temperature: 0.7,
      maxTokens: 4000,
      tools: ['neo4j-mcp', 'brightdata', 'perplexity-mcp', 'better-auth'],
      systemPrompt: "You are a helpful AI assistant for the Signal Noise sports intelligence platform."
    }
  },
  rfp: {
    name: 'RFP Intelligence',
    icon: '📋',
    color: '#10B981',
    systemPrompt: "You are an RFP analysis specialist. Help users identify and analyze procurement opportunities in the sports industry.",
    tools: ['neo4j-mcp', 'brightdata', 'perplexity-mcp'],
    defaultClaudeConfig: {
      model: 'claude-3-sonnet-20240229',
      temperature: 0.3,
      maxTokens: 6000,
      tools: ['neo4j-mcp', 'brightdata', 'perplexity-mcp'],
      systemPrompt: "You are an RFP analysis specialist. Help users identify and analyze procurement opportunities in the sports industry."
    }
  },
  sports: {
    name: 'Sports Intelligence',
    icon: '⚽',
    color: '#F59E0B',
    systemPrompt: "You are a sports intelligence expert. Help users analyze sports entities, clubs, leagues, and business opportunities.",
    tools: ['neo4j-mcp', 'brightdata'],
    defaultClaudeConfig: {
      model: 'claude-3-sonnet-20240229',
      temperature: 0.5,
      maxTokens: 4000,
      tools: ['neo4j-mcp', 'brightdata'],
      systemPrompt: "You are a sports intelligence expert. Help users analyze sports entities, clubs, leagues, and business opportunities."
    }
  },
  'knowledge-graph': {
    name: 'Knowledge Graph',
    icon: '🕸️',
    color: '#8B5CF6',
    systemPrompt: "You are a Neo4j and knowledge graph specialist. Help users query and analyze complex entity relationships.",
    tools: ['neo4j-mcp'],
    defaultClaudeConfig: {
      model: 'claude-3-sonnet-20240229',
      temperature: 0.2,
      maxTokens: 8000,
      tools: ['neo4j-mcp'],
      systemPrompt: "You are a Neo4j and knowledge graph specialist. Help users query and analyze complex entity relationships."
    }
  },
  custom: {
    name: 'Custom',
    icon: '⚙️',
    color: '#6B7280',
    systemPrompt: "You are a customizable AI assistant. Users can configure your behavior and tools.",
    tools: ['neo4j-mcp', 'brightdata', 'perplexity-mcp', 'better-auth'],
    defaultClaudeConfig: {
      model: 'claude-3-sonnet-20240229',
      temperature: 0.7,
      maxTokens: 4000,
      tools: ['neo4j-mcp', 'brightdata', 'perplexity-mcp', 'better-auth'],
      systemPrompt: "You are a customizable AI assistant. Users can configure your behavior and tools."
    }
  }
} as const;

// Default tab templates
export const DEFAULT_TAB_TEMPLATES = {
  quickChat: {
    name: 'Quick Chat',
    type: 'general' as TabType,
    claudeConfig: TAB_TYPE_CONFIGS.general.defaultClaudeConfig
  },
  rfpAnalysis: {
    name: 'RFP Analysis',
    type: 'rfp' as TabType,
    claudeConfig: TAB_TYPE_CONFIGS.rfp.defaultClaudeConfig
  },
  sportsResearch: {
    name: 'Sports Research',
    type: 'sports' as TabType,
    claudeConfig: TAB_TYPE_CONFIGS.sports.defaultClaudeConfig
  },
  graphExploration: {
    name: 'Graph Exploration',
    type: 'knowledge-graph' as TabType,
    claudeConfig: TAB_TYPE_CONFIGS['knowledge-graph'].defaultClaudeConfig
  }
} as const;