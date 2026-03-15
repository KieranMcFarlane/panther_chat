import Redis from 'ioredis'

type QueryRow = Record<string, any>

function decodeTypedValue(value: any): any {
  if (!Array.isArray(value) || value.length < 2 || typeof value[0] !== 'number') {
    return value
  }

  const [typeCode, payload] = value

  switch (typeCode) {
    case 1:
    case 2:
      return String(payload)
    case 3:
      return Number(payload)
    case 4:
      return Number(payload)
    case 5:
      return Boolean(payload)
    case 6:
      return Array.isArray(payload) ? payload.map((item) => decodeTypedValue(item)) : []
    case 10: {
      const map: Record<string, any> = {}
      if (Array.isArray(payload)) {
        for (let i = 0; i < payload.length; i += 2) {
          const key = String(payload[i])
          const typed = payload[i + 1]
          map[key] = decodeTypedValue(typed)
        }
      }
      return map
    }
    case 11:
      return payload
    default:
      return payload
  }
}

function parseCompactGraphResponse(raw: any): { headers: string[]; rows: QueryRow[] } {
  if (!Array.isArray(raw) || raw.length < 2) {
    return { headers: [], rows: [] }
  }

  const rawHeaders = Array.isArray(raw[0]) ? raw[0] : []
  const headers = rawHeaders.map((header: any) => {
    if (Array.isArray(header) && header.length > 1) {
      return String(header[1])
    }
    return String(header)
  })

  const rawRows = Array.isArray(raw[1]) ? raw[1] : []
  const rows = rawRows.map((row: any) => {
    const values = Array.isArray(row) ? row.map((cell) => decodeTypedValue(cell)) : []
    const output: QueryRow = {}
    headers.forEach((header, index) => {
      output[header] = values[index]
    })
    return output
  })

  return { headers, rows }
}

function escapeCypherString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

export interface GraphEntityRecord {
  neo4j_id: string
  labels: string[]
  properties: Record<string, any>
}

export interface GraphRelationshipRecord {
  source_neo4j_id: string
  target_neo4j_id: string
  relationship_type: string
  source_element_id: string
  target_element_id: string
  source_labels: string[]
  target_labels: string[]
  source_name: string
  target_name: string
  relationship_properties: Record<string, any>
}

export class FalkorRedisGraphService {
  private readonly graphName: string
  private readonly redis: Redis
  private initialized = false

  constructor() {
    const uri = process.env.FALKORDB_URI || process.env.REDIS_URL || 'redis://localhost:6379'
    const username = process.env.FALKORDB_USER || undefined
    const password = process.env.FALKORDB_PASSWORD || undefined

    this.graphName = process.env.FALKORDB_DATABASE || 'sports_intelligence'

    this.redis = new Redis(uri, {
      username,
      password,
      lazyConnect: true,
      connectTimeout: Number(process.env.FALKORDB_CONNECT_TIMEOUT_MS || 10000),
      maxRetriesPerRequest: 1,
      tls: uri.startsWith('rediss://') ? {} : undefined,
    })
  }

  async initialize() {
    if (this.initialized) return
    if (this.redis.status !== 'ready') {
      await this.redis.connect()
    }

    await this.redis.call('GRAPH.QUERY', this.graphName, 'RETURN 1 AS ok', '--compact')
    this.initialized = true
  }

  async close() {
    if (this.redis.status === 'ready' || this.redis.status === 'connect') {
      await this.redis.quit()
    }
    this.initialized = false
  }

  async query(cypher: string): Promise<QueryRow[]> {
    await this.initialize()
    const response = await this.redis.call('GRAPH.QUERY', this.graphName, cypher, '--compact')
    return parseCompactGraphResponse(response).rows
  }

  async countEntities(entityType?: string): Promise<number> {
    const whereClause = entityType && entityType !== 'all'
      ? `WHERE '${escapeCypherString(entityType)}' IN labels(n) OR toLower(coalesce(n.type,'')) = toLower('${escapeCypherString(entityType)}')`
      : ''

    const rows = await this.query(`MATCH (n) ${whereClause} RETURN count(n) as total`)
    return Number(rows[0]?.total || 0)
  }

  async getEntitiesBatch(skip: number, limit: number, entityType?: string): Promise<GraphEntityRecord[]> {
    const whereClause = entityType && entityType !== 'all'
      ? `WHERE '${escapeCypherString(entityType)}' IN labels(n) OR toLower(coalesce(n.type,'')) = toLower('${escapeCypherString(entityType)}')`
      : ''

    const rows = await this.query(`
      MATCH (n)
      ${whereClause}
      RETURN ID(n) as internal_id, labels(n) as labels, properties(n) as properties
      ORDER BY coalesce(n.name, '')
      SKIP ${Math.max(0, skip)}
      LIMIT ${Math.max(1, limit)}
    `)

    return rows.map((row) => ({
      neo4j_id: String(row.internal_id),
      labels: Array.isArray(row.labels) ? row.labels.map((item: any) => String(item)) : [],
      properties: row.properties && typeof row.properties === 'object' ? row.properties : {},
    }))
  }

  async getRelationshipsBatch(limit: number): Promise<GraphRelationshipRecord[]> {
    const rows = await this.query(`
      MATCH (n1)-[r]->(n2)
      RETURN
        ID(n1) as source_neo4j_id,
        ID(n2) as target_neo4j_id,
        type(r) as relationship_type,
        labels(n1) as source_labels,
        labels(n2) as target_labels,
        coalesce(n1.name, '') as source_name,
        coalesce(n2.name, '') as target_name,
        properties(r) as relationship_properties
      LIMIT ${Math.max(1, limit)}
    `)

    return rows.map((row) => ({
      source_neo4j_id: String(row.source_neo4j_id || ''),
      target_neo4j_id: String(row.target_neo4j_id || ''),
      relationship_type: String(row.relationship_type || ''),
      source_element_id: String(row.source_neo4j_id || ''),
      target_element_id: String(row.target_neo4j_id || ''),
      source_labels: Array.isArray(row.source_labels) ? row.source_labels.map((item: any) => String(item)) : [],
      target_labels: Array.isArray(row.target_labels) ? row.target_labels.map((item: any) => String(item)) : [],
      source_name: String(row.source_name || ''),
      target_name: String(row.target_name || ''),
      relationship_properties:
        row.relationship_properties && typeof row.relationship_properties === 'object'
          ? row.relationship_properties
          : {},
    }))
  }
}
