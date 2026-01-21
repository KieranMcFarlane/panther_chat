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

/**
 * Get database URI with priority: FALKORDB_URI > NEO4J_URI > default
 */
function isNeo4jScheme(uri?: string): boolean {
  if (!uri) return false
  const lower = uri.toLowerCase()
  return lower.startsWith('bolt://') ||
    lower.startsWith('neo4j://') ||
    lower.startsWith('neo4j+s://') ||
    lower.startsWith('neo4j+ssc://') ||
    lower.startsWith('bolt+s://') ||
    lower.startsWith('bolt+ssc://')
}

function getDatabaseUri(): string {
  const candidates = [
    process.env.FALKORDB_URI,
    process.env.NEO4J_URI,
    process.env.NEXT_PUBLIC_FALKORDB_URI,
    process.env.NEXT_PUBLIC_NEO4J_URI
  ].filter(Boolean) as string[]

  const valid = candidates.find(isNeo4jScheme)
  if (!valid && candidates.length > 0) {
    console.warn('⚠️ No valid Neo4j URI found. Ignoring unsupported schemes:', candidates)
  }

  return valid || 'bolt://localhost:7687'
}

/**
 * Get database username with priority: FALKORDB_USER > NEO4J_USER > NEO4J_USERNAME > default
 */
function getDatabaseUser(): string {
  return process.env.FALKORDB_USER ||
         process.env.NEO4J_USER ||
         process.env.NEO4J_USERNAME ||
         process.env.NEXT_PUBLIC_FALKORDB_USER ||
         process.env.NEXT_PUBLIC_NEO4J_USER ||
         process.env.NEXT_PUBLIC_NEO4J_USERNAME ||
         'neo4j'
}

/**
 * Get database password with priority: FALKORDB_PASSWORD > NEO4J_PASSWORD > default
 */
function getDatabasePassword(): string {
  return process.env.FALKORDB_PASSWORD ||
         process.env.NEO4J_PASSWORD ||
         process.env.NEXT_PUBLIC_FALKORDB_PASSWORD ||
         process.env.NEXT_PUBLIC_NEO4J_PASSWORD ||
         ''
}

/**
 * Get database name
 */
function getDatabaseName(): string {
  return process.env.FALKORDB_DATABASE ||
         process.env.NEO4J_DATABASE ||
         'neo4j'
}

export class Neo4jService {
  private driver: any
  private initialized = false
  private readonly uri: string
  private readonly databaseName: string

  public getDriver() {
    return this.driver
  }

  constructor() {
    this.uri = getDatabaseUri()
    this.databaseName = getDatabaseName()

    // Log which database backend we're connecting to
    if (this.uri.includes('localhost') || this.uri.includes('127.0.0.1') || this.uri.includes('falkordb')) {
      console.log('🔗 Connecting to FalkorDB (Neo4j-compatible)')
    } else {
      console.log('🔗 Connecting to Neo4j AuraDB')
    }

    this.driver = neo4j.driver(
      this.uri,
      neo4j.auth.basic(
        getDatabaseUser(),
        getDatabasePassword()
      )
    )
  }

  async initialize() {
    if (this.initialized) return

    try {
      await this.driver.verifyConnectivity()

      // Create vector index if it doesn't exist
      const session = this.driver.session({ database: this.databaseName })
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
        console.log(`✅ Vector index created/verified for database: ${this.databaseName}`)
      } finally {
        await session.close()
      }

      this.initialized = true
    } catch (error) {
      console.error('❌ Failed to initialize Neo4j/FalkorDB:', error)
      throw error
    }
  }

  async vectorSearch(query: string, options: VectorSearchOptions = {}): Promise<SearchResult[]> {
    await this.initialize()

    try {
      // Generate embedding
      const embedding = await this.generateEmbedding(query)

      const session = this.driver.session({ database: this.databaseName })
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
      const session = this.driver.session({ database: this.databaseName })
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
      const session = this.driver.session({ database: this.databaseName })
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
      const session = this.driver.session({ database: this.databaseName })
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

// Export singleton instance for backward compatibility
export const neo4jService = new Neo4jService()
export const neo4jClient = neo4jService.getDriver()
