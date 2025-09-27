import neo4j from 'neo4j-driver'

export interface Entity {
  id: string | number
  labels: string[]
  properties: Record<string, any>
}

export interface SearchResult {
  entity: Entity
  similarity: number
  connections: Connection[]
}

export interface Connection {
  relationship: string
  target: string
  target_type: string
}

export interface VectorSearchOptions {
  limit?: number
  threshold?: number
  entityType?: string
}

export class Neo4jService {
  private driver: any
  private initialized = false

  constructor() {
    this.driver = neo4j.driver(
      process.env.NEO4J_URI || process.env.NEXT_PUBLIC_NEO4J_URI || 'neo4j+s://cce1f84b.databases.neo4j.io',
      neo4j.auth.basic(
        process.env.NEO4J_USERNAME || process.env.NEO4J_USER || process.env.NEXT_PUBLIC_NEO4J_USER || 'neo4j',
        process.env.NEO4J_PASSWORD || process.env.NEXT_PUBLIC_NEO4J_PASSWORD || 'llNASCzMWGT-nTt-JkD9Qk_4W6PpJrv39X0PuYAIKV0'
      )
    )
  }

  async initialize() {
    if (this.initialized) return
    
    try {
      await this.driver.verifyConnectivity()
      
      // Create vector index if it doesn't exist
      const session = this.driver.session()
      try {
        await session.run(`
          CREATE VECTOR INDEX entity_embeddings IF NOT EXISTS
          FOR (n:Entity)
          ON n.embedding
          OPTIONS {
            indexConfig: {
              \`vector.dimensions\`: 1536,
              \`vector.similarity_function\`: 'cosine'
            }
          }
        `)
        console.log('✅ Vector index created/verified')
      } finally {
        await session.close()
      }
      
      this.initialized = true
    } catch (error) {
      console.error('❌ Failed to initialize Neo4j:', error)
      throw error
    }
  }

  async vectorSearch(query: string, options: VectorSearchOptions = {}): Promise<SearchResult[]> {
    await this.initialize()
    
    try {
      // Generate embedding
      const embedding = await this.generateEmbedding(query)
      
      const session = this.driver.session()
      try {
        // First try vector search, fallback to text search if no results
        const result = await session.run(`
          CALL db.index.vector.queryNodes('entity_embeddings', $limit, $embedding)
          YIELD node, score
          WHERE score >= $threshold
          WITH node, score
          // Get relationships and additional context
          OPTIONAL MATCH (node)-[r]-(related)
          RETURN node, score, collect({
            relationship: type(r),
            target: related.name,
            target_type: labels(related)[0]
          }) as connections
          ORDER BY score DESC
          LIMIT $limit
        `, {
          embedding,
          limit: neo4j.int(parseInt((options.limit || 10).toString())),
          threshold: options.threshold || 0.7
        })
        
        if (result.records.length > 0) {
          return result.records.map(record => ({
            entity: this.formatNode(record.get('node')),
            similarity: record.get('score'),
            connections: record.get('connections').filter((conn: any) => conn.target)
          }))
        }
        
        // Fallback to text search if no vector results
        console.log('📝 No vector results, falling back to text search')
        return await this.fallbackVectorSearch(query, options)
        
      } finally {
        await session.close()
      }
    } catch (error) {
      console.error('❌ Vector search failed:', error)
      return await this.fallbackVectorSearch(query, options)
    }
  }

  private async fallbackVectorSearch(query: string, options: VectorSearchOptions = {}): Promise<SearchResult[]> {
    try {
      const session = this.driver.session()
      try {
        const result = await session.run(`
          MATCH (n)
          WHERE n.name CONTAINS $query 
             OR n.description CONTAINS $query
             OR n.type CONTAINS $query
             OR n.sport CONTAINS $query
             OR n.country CONTAINS $query
          WITH n, 0.8 as score // Default similarity for text matches
          // Get relationships and additional context
          OPTIONAL MATCH (n)-[r]-(related)
          RETURN n as node, score, collect({
            relationship: type(r),
            target: related.name,
            target_type: labels(related)[0]
          }) as connections
          ORDER BY score DESC
          LIMIT $limit
        `, {
          query,
          limit: neo4j.int(parseInt((options.limit || 10).toString()))
        })
        
        return result.records.map(record => ({
          entity: this.formatNode(record.get('node')),
          similarity: record.get('score'),
          connections: record.get('connections').filter((conn: any) => conn.target)
        }))
      } finally {
        await session.close()
      }
    } catch (error) {
      console.error('❌ Fallback search failed:', error)
      return []
    }
  }

  async textSearch(query: string, options: VectorSearchOptions = {}): Promise<Entity[]> {
    await this.initialize()
    
    try {
      const session = this.driver.session()
      try {
        const result = await session.run(`
          MATCH (n)
          WHERE n.name CONTAINS $query 
             OR n.description CONTAINS $query
             OR n.type CONTAINS $query
             OR n.sport CONTAINS $query
             OR n.country CONTAINS $query
             OR n.website CONTAINS $query
          RETURN n
          LIMIT $limit
        `, {
          query,
          limit: neo4j.int(parseInt((options.limit || 10).toString()))
        })
        
        return result.records.map(record => this.formatNode(record.get('n')))
      } finally {
        await session.close()
      }
    } catch (error) {
      console.error('❌ Text search failed:', error)
      return []
    }
  }

  async getEntityRelationships(entityId: string): Promise<Connection[]> {
    await this.initialize()
    
    try {
      const session = this.driver.session()
      try {
        const result = await session.run(`
          MATCH (n)-[r]-(related)
          WHERE id(n) = $entityId
          RETURN type(r) as relationship, related.name as target, labels(related)[0] as target_type
          LIMIT 50
        `, { entityId: parseInt(entityId) })
        
        return result.records.map(record => ({
          relationship: record.get('relationship'),
          target: record.get('target'),
          target_type: record.get('target_type')
        }))
      } finally {
        await session.close()
      }
    } catch (error) {
      console.error('❌ Failed to get relationships:', error)
      return []
    }
  }

  private async generateEmbedding(query: string): Promise<number[]> {
    try {
      const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      })
      
      if (!response.ok) {
        throw new Error(`Embedding API failed: ${response.status}`)
      }
      
      const { embedding } = await response.json()
      return embedding
    } catch (error) {
      console.error('❌ Failed to generate embedding:', error)
      // Return a dummy embedding for demo purposes
      return Array(1536).fill(0).map(() => Math.random())
    }
  }

  private formatNode(node: any): Entity {
    return {
      id: node.identity.toString(),
      labels: node.labels,
      properties: node.properties
    }
  }

  async close() {
    if (this.driver) {
      await this.driver.close()
    }
  }
}