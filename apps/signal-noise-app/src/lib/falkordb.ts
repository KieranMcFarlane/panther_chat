import { createClient } from 'redis'

type CompactCell = [number, unknown]
type CompactRow = CompactCell[]
type CompactResult = [CompactCell[], CompactRow[], string[]]

export interface FalkorQueryResultRow {
  [key: string]: unknown
}

function getFalkorUrl(): string {
  return process.env.FALKORDB_URI || process.env.NEXT_PUBLIC_FALKORDB_URI || 'redis://localhost:6379'
}

function getFalkorUsername(): string | undefined {
  return process.env.FALKORDB_USER || process.env.NEXT_PUBLIC_FALKORDB_USER || undefined
}

function getFalkorPassword(): string | undefined {
  return process.env.FALKORDB_PASSWORD || process.env.NEXT_PUBLIC_FALKORDB_PASSWORD || undefined
}

function getFalkorGraphName(): string {
  return process.env.FALKORDB_DATABASE || 'sports_intelligence'
}

function decodeCompactCell(cell: unknown): unknown {
  if (!Array.isArray(cell)) {
    return cell
  }

  const [type, value] = cell as CompactCell
  switch (type) {
    case 1:
    case 2:
    case 3:
    case 4:
    case 5:
      return value
    case 6:
      return Array.isArray(value) ? value.map(decodeCompactCell) : []
    case 10: {
      const entries = Array.isArray(value) ? value : []
      const object: Record<string, unknown> = {}
      for (let index = 0; index < entries.length; index += 2) {
        const key = entries[index]
        const entryValue = entries[index + 1]
        if (typeof key === 'string') {
          object[key] = decodeCompactCell(entryValue)
        }
      }
      return object
    }
    default:
      return value
  }
}

export function parseCompactGraphResult(raw: unknown): FalkorQueryResultRow[] {
  if (!Array.isArray(raw) || raw.length < 2) {
    return []
  }

  const [headerCells, rowCells] = raw as CompactResult
  const columns = (headerCells || []).map((cell) => String(decodeCompactCell(cell) ?? ''))
  const rows = rowCells || []

  return rows.map((row) => {
    const record: FalkorQueryResultRow = {}
    columns.forEach((column, index) => {
      record[column] = decodeCompactCell(row[index])
    })
    return record
  })
}

export function escapeCypherString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

class FalkorGraphClient {
  private client: any | null = null
  private connectPromise: Promise<void> | null = null

  async initialize() {
    if (this.client?.isOpen) {
      return
    }
    if (this.connectPromise) {
      await this.connectPromise
      return
    }

    this.connectPromise = this.connect()
    try {
      await this.connectPromise
    } finally {
      this.connectPromise = null
    }
  }

  private async connect() {
    const url = getFalkorUrl()
    const client = createClient({
      url,
      username: getFalkorUsername(),
      password: getFalkorPassword(),
      socket: {
        tls: url.startsWith('rediss://'),
        reconnectStrategy: false,
      },
    })

    client.on('error', (error) => {
      console.error('❌ FalkorDB Redis client error:', error)
    })

    await client.connect()
    this.client = client
  }

  async queryRows<T extends FalkorQueryResultRow = FalkorQueryResultRow>(cypher: string): Promise<T[]> {
    await this.initialize()
    if (!this.client) {
      throw new Error('FalkorDB client not initialized')
    }

    const raw = await this.client.sendCommand([
      'GRAPH.QUERY',
      getFalkorGraphName(),
      cypher,
      '--compact',
    ])

    return parseCompactGraphResult(raw) as T[]
  }

  async close() {
    if (this.client?.isOpen) {
      await this.client.quit()
    }
    this.client = null
  }
}

export const falkorGraphClient = new FalkorGraphClient()
