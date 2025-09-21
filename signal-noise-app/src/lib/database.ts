// Database service for AuraDB (Neo4j) integration
// Follows the exact Yellow Panther AI System schema

export interface BaseEntity {
  entity_id: string;
  entity_type: 'club' | 'sportsperson' | 'poi' | 'tender' | 'contact';
  source: string;
  last_updated: string;
  trust_score: number;
  vector_embedding: number[];
  priority_score: number;
  notes: string;
}

export interface Club extends BaseEntity {
  entity_type: 'club';
  name: string;
  division_id: string;
  location: string;
  digital_presence_score: number;
  revenue_estimate: string;
  key_personnel: string[];
  opportunity_score: number;
  linked_tenders: string[];
  tags: string[];
}

export interface Sportsperson extends BaseEntity {
  entity_type: 'sportsperson';
  name: string;
  club_id: string;
  role: string;
  influence_score: number;
  career_stats: Record<string, any>;
  connections: string[];
  tags: string[];
}

export interface POIContact extends BaseEntity {
  entity_type: 'poi' | 'contact';
  name: string;
  affiliation: string;
  role: string;
  contact_info: Record<string, any>;
  poi_score: number;
  relationship_strength: number;
  tags: string[];
}

export interface Tender extends BaseEntity {
  entity_type: 'tender';
  title: string;
  associated_club_id: string;
  division_id: string;
  deadline: string;
  priority_score: number;
  linked_contacts: string[];
  tags: string[];
}

export type Entity = Club | Sportsperson | POIContact | Tender;

export interface CriticalOpportunityScore {
  priority_score: number;
  trust_score: number;
  influence_score: number;
  poi_score: number;
  vector_similarity: number;
  critical_opportunity_score: number;
}

import { config } from './config';

// Database connection configuration
const DB_CONFIG = {
  url: config.neo4j.uri,
  username: config.neo4j.username,
  password: config.neo4j.password,
  database: config.neo4j.database
};

// Calculate critical opportunity score according to schema
export function calculateCriticalOpportunityScore(
  priority_score: number,
  trust_score: number,
  influence_score: number,
  poi_score: number,
  vector_similarity: number
): number {
  return config.calculateCriticalOpportunityScore({
    priority_score,
    trust_score,
    influence_score,
    poi_score,
    vector_similarity
  });
}

// Database service class
export class DatabaseService {
  private static instance: DatabaseService;
  private baseUrl: string;

  private constructor() {
    // Use backend API endpoints for database operations
    this.baseUrl = config.api.baseUrl;
  }

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  // Health check
  async healthCheck(): Promise<{ status: string; connection: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      if (response.ok) {
        return { status: 'healthy', connection: 'connected' };
      }
      return { status: 'unhealthy', connection: 'disconnected' };
    } catch (error) {
      return { status: 'unhealthy', connection: 'error' };
    }
  }

  // Get all entities with scoring
  async getEntities(): Promise<Entity[]> {
    try {
      const response = await fetch(`${this.baseUrl}/sports-entities`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
      return Array.isArray(data) ? data : (data?.entities ?? []);
    } catch (error) {
      console.error('Error fetching entities:', error);
      return [];
    }
  }

  // Get entities by type
  async getEntitiesByType(type: BaseEntity['entity_type']): Promise<Entity[]> {
    try {
      const response = await fetch(`${this.baseUrl}/entities/${type}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error(`Error fetching ${type} entities:`, error);
      return [];
    }
  }

  // Get entity by ID
  async getEntityById(entityId: string): Promise<Entity | null> {
    try {
      const response = await fetch(`${this.baseUrl}/entities/${entityId}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`Error fetching entity ${entityId}:`, error);
      return null;
    }
  }

  // Search entities with vector similarity
  async searchEntities(query: string, limit: number = 10): Promise<Entity[]> {
    try {
      const response = await fetch('/api/vector-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, limit })
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
      return data.results || [];
    } catch (error) {
      console.error('Error searching entities:', error);
      return [];
    }
  }

  // Get divisions and clubs hierarchy
  async getSportsHierarchy(): Promise<{
    divisions: Array<{
      id: string;
      name: string;
      country: string;
      level: string;
      clubs: Club[];
    }>;
  }> {
    try {
      const clubs = await this.getEntitiesByType('club');
      
      // Group clubs by division
      const divisionMap = new Map<string, {
        id: string;
        name: string;
        country: string;
        level: string;
        clubs: Club[];
      }>();

      clubs.forEach((club) => {
        if (club.entity_type === 'club') {
          const divisionId = club.division_id;
          if (!divisionMap.has(divisionId)) {
            divisionMap.set(divisionId, {
              id: divisionId,
              name: divisionId, // You might want to fetch division names separately
              country: club.location.split(', ')[1] || 'Unknown',
              level: 'Top Tier', // Default level
              clubs: []
            });
          }
          divisionMap.get(divisionId)!.clubs.push(club);
        }
      });

      return {
        divisions: Array.from(divisionMap.values())
      };
    } catch (error) {
      console.error('Error fetching sports hierarchy:', error);
      return { divisions: [] };
    }
  }

  // Get opportunities ranked by critical score
  async getOpportunities(limit: number = 50): Promise<Array<Entity & CriticalOpportunityScore>> {
    try {
      const entities = await this.getEntities();
      
      // Calculate critical opportunity scores for all entities
      const scoredEntities = entities.map(entity => {
        const scores = this.calculateEntityScores(entity);
        return {
          ...entity,
          ...scores
        };
      });

      // Sort by critical opportunity score (highest first)
      scoredEntities.sort((a, b) => b.critical_opportunity_score - a.critical_opportunity_score);
      
      return scoredEntities.slice(0, limit);
    } catch (error) {
      console.error('Error fetching opportunities:', error);
      return [];
    }
  }

  // Calculate scores for an entity
  private calculateEntityScores(entity: Entity): CriticalOpportunityScore {
    let priority_score = entity.priority_score;
    let trust_score = entity.trust_score;
    let influence_score = 0;
    let poi_score = 0;
    let vector_similarity = 0.5; // Default similarity

    // Calculate influence score for sportspeople
    if (entity.entity_type === 'sportsperson') {
      influence_score = entity.influence_score;
    }

    // Calculate POI score for contacts
    if (entity.entity_type === 'poi' || entity.entity_type === 'contact') {
      poi_score = entity.poi_score;
    }

    // Calculate critical opportunity score
    const critical_opportunity_score = calculateCriticalOpportunityScore(
      priority_score,
      trust_score,
      influence_score,
      poi_score,
      vector_similarity
    );

    return {
      priority_score,
      trust_score,
      influence_score,
      poi_score,
      vector_similarity,
      critical_opportunity_score
    };
  }

  // Get entity relationships for graph visualization
  async getEntityRelationships(entityId: string): Promise<{
    nodes: Array<{ id: string; label: string; type: string; properties: any }>;
    edges: Array<{ source: string; target: string; type: string; properties: any }>;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/entities/${entityId}/relationships`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
      return {
        nodes: data.nodes || [],
        edges: data.edges || []
      };
    } catch (error) {
      console.error(`Error fetching relationships for ${entityId}:`, error);
      return { nodes: [], edges: [] };
    }
  }

  // Execute custom Cypher query
  async executeCypherQuery(query: string, parameters: Record<string, any> = {}): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/cypher`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, parameters })
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error executing Cypher query:', error);
      return null;
    }
  }
}

// Export singleton instance
export const db = DatabaseService.getInstance();
