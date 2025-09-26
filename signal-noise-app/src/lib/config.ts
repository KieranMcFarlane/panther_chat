// Configuration for AuraDB and Qdrant connections
// Follows the Yellow Panther AI System requirements

export const config = {
  // AuraDB (Neo4j) Configuration
  neo4j: {
    uri: process.env.NEXT_PUBLIC_NEO4J_URI || 'neo4j+s://cce1f84b.databases.neo4j.io',
    username: process.env.NEXT_PUBLIC_NEO4J_USER || 'neo4j',
    password: process.env.NEXT_PUBLIC_NEO4J_PASSWORD || 'llNASCzMWGT-nTt-JkD9Qk_4W6PpJrv39X0PuYAIKV0',
    database: process.env.NEXT_PUBLIC_NEO4J_DATABASE || 'neo4j'
  },

  // Backend API Configuration
  api: {
    baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
    timeout: 30000
  },

  // Qdrant Vector Database Configuration
  qdrant: {
    url: process.env.NEXT_PUBLIC_QDRANT_URL || 'https://fbd5ba7f-7aed-442a-9ac1-0a3f1024bffd.eu-west-2-0.aws.cloud.qdrant.io:6333',
    apiKey: process.env.NEXT_PUBLIC_QDRANT_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2Nlc3MiOiJtIn0.psevOgtPfPHKnCb2DUnxFBwIMF_ShCB76voNnCD5qHg',
    collection: process.env.NEXT_PUBLIC_QDRANT_COLLECTION || 'sports_entities'
  },

  // App Configuration
  app: {
    name: process.env.NEXT_PUBLIC_APP_NAME || 'Yellow Panther AI',
    version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
    environment: process.env.NEXT_PUBLIC_APP_ENV || 'development'
  },

  // Scoring Matrix Configuration (from Yellow Panther schema)
  scoring: {
    weights: {
      priority_score: 0.4,      // 40% - Goal alignment
      trust_score: 0.2,         // 20% - Source reliability
      influence_score: 0.2,     // 20% - Social/network influence
      poi_score: 0.1,           // 10% - Relevance of connected contacts
      vector_similarity: 0.1    // 10% - Semantic match to queries
    },
    thresholds: {
      high_priority: 8.0,
      medium_priority: 6.0,
      low_priority: 0.0
    }
  },

  // Entity Types (from Yellow Panther schema)
  entityTypes: {
    club: 'club',
    sportsperson: 'sportsperson',
    poi: 'poi',
    tender: 'tender',
    contact: 'contact'
  } as const,

  // Navigation Structure (from Yellow Panther schema)
  navigation: {
    home: '/',
    sports: '/sports',
    tenders: '/tenders',
    contacts: '/contacts',
    graph: '/graph',
    terminal: '/terminal',
    opportunities: '/opportunities',
    knowledgeGraphChat: '/knowledge-graph-chat'
  }
};

// Type for entity types
export type EntityType = typeof config.entityTypes[keyof typeof config.entityTypes];

// Type for navigation paths
export type NavigationPath = typeof config.navigation[keyof typeof config.navigation];

// Helper function to calculate critical opportunity score
export function calculateCriticalOpportunityScore(scores: {
  priority_score: number;
  trust_score: number;
  influence_score: number;
  poi_score: number;
  vector_similarity: number;
}): number {
  const { weights } = config.scoring;
  
  return (
    (scores.priority_score * weights.priority_score) +
    (scores.trust_score * weights.trust_score) +
    (scores.influence_score * weights.influence_score) +
    (scores.poi_score * weights.poi_score) +
    (scores.vector_similarity * weights.vector_similarity)
  );
}

// Helper function to get priority level
export function getPriorityLevel(score: number): 'high' | 'medium' | 'low' {
  const { thresholds } = config.scoring;
  
  if (score >= thresholds.high_priority) return 'high';
  if (score >= thresholds.medium_priority) return 'medium';
  return 'low';
}

// Helper function to validate entity type
export function isValidEntityType(type: string): type is EntityType {
  return Object.values(config.entityTypes).includes(type as EntityType);
}





