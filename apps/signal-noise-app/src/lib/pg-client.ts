/**
 * PostgreSQL client with Supabase-compatible query builder interface.
 * Drop-in replacement for @supabase/supabase-js that uses local PostgreSQL.
 */
import { Pool, PoolConfig } from 'pg';

// ── Connection ──────────────────────────────────────────────────────────

const poolConfig: PoolConfig = {
  connectionString: process.env.DATABASE_URL || `postgresql:///signal_noise_app?host=/tmp`,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 30000,
};

let _pool: Pool | null = null;

export function getPool(): Pool {
  if (!_pool) {
    _pool = new Pool(poolConfig);
    _pool.on('error', (err) => {
      console.error('[pg-client] Unexpected pool error:', err.message);
    });
  }
  return _pool;
}

export async function query(sql: string, params: any[] = []) {
  const pool = getPool();
  const result = await pool.query(sql, params);
  return result;
}

// ── Query Builder ───────────────────────────────────────────────────────

type FilterOp = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'is' | 'like' | 'ilike' | 'cs' | 'cd' | 'ov' | 'or';

interface Filter {
  column: string;
  op: FilterOp | 'and' | 'not';
  value: any;
}

interface OrderSpec {
  column: string;
  ascending: boolean;
  nullsFirst?: boolean;
}

class PgQueryBuilder {
  private tableName: string;
  private selectColumns: string | string[] | Record<string, string> = '*';
  private filters: Filter[] = [];
  private orderSpecs: OrderSpec[] = [];
  private groupSpecs: string[] = [];
  private limitCount?: number;
  private offsetCount?: number;
  private isCount = false;
  private isHead = false;
  private isSingle = false;
  private isMaybeSingle = false;
  private insertRows: any[] = [];
  private updateData: Record<string, any> | null = null;
  private upsertRows: any[] = [];
  private upsertConflictKey?: string;
  private deleteMode = false;
  private rpcFunc?: string;
  private rpcParams?: Record<string, any>;

  constructor(table: string) {
    this.tableName = table;
  }

  // ── Select ──

  select(columns?: string | { count?: string }, options?: { count?: string | 'exact'; head?: boolean }) {
    if (typeof columns === 'object' && columns !== null && !Array.isArray(columns)) {
      // This is the { count: 'exact' } pattern
      if (columns.count) this.isCount = true;
      this.selectColumns = '*';
    } else {
      this.selectColumns = columns || '*';
    }
    if (options?.count === 'exact') this.isCount = true;
    if (options?.head) this.isHead = true;
    return this;
  }

  // ── Filters ──

  eq(column: string, value: any) {
    this.filters.push({ column, op: 'eq', value });
    return this;
  }

  neq(column: string, value: any) {
    this.filters.push({ column, op: 'neq', value });
    return this;
  }

  gt(column: string, value: any) {
    this.filters.push({ column, op: 'gt', value });
    return this;
  }

  gte(column: string, value: any) {
    this.filters.push({ column, op: 'gte', value });
    return this;
  }

  lt(column: string, value: any) {
    this.filters.push({ column, op: 'lt', value });
    return this;
  }

  lte(column: string, value: any) {
    this.filters.push({ column, op: 'lte', value });
    return this;
  }

  in(column: string, values: any[]) {
    this.filters.push({ column, op: 'in', value: values });
    return this;
  }

  is(column: string, value: any) {
    this.filters.push({ column, op: 'is', value });
    return this;
  }

  like(column: string, pattern: string) {
    this.filters.push({ column, op: 'like', value: pattern });
    return this;
  }

  ilike(column: string, pattern: string) {
    this.filters.push({ column, op: 'ilike', value: pattern });
    return this;
  }

  cs(column: string, value: any) {
    this.filters.push({ column, op: 'cs', value });
    return this;
  }

  or(filterStr: string) {
    // Parse Supabase-style "or" filter: "col1.eq.val,col2.eq.val"
    this.filters.push({ column: '', op: 'or', value: filterStr });
    return this;
  }

  not(column: string, op: string, value: any) {
    this.filters.push({ column, op: 'not' as any, value: { op, value } });
    return this;
  }

  contains(column: string, value: any) {
    this.filters.push({ column, op: 'cs', value });
    return this;
  }

  overlaps(column: string, values: any[]) {
    this.filters.push({ column, op: 'ov', value: values });
    return this;
  }

  group(columns: string) {
    this.groupSpecs = String(columns || '')
      .split(',')
      .map((column) => column.trim())
      .filter(Boolean);
    return this;
  }

  // ── Ordering / Pagination ──

  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }) {
    this.orderSpecs.push({
      column,
      ascending: options?.ascending !== false,
      nullsFirst: options?.nullsFirst,
    });
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  range(from: number, to: number) {
    this.limitCount = to - from + 1;
    this.offsetCount = from;
    return this;
  }

  single() {
    this.isSingle = true;
    this.limitCount = 1;
    return this;
  }

  maybeSingle() {
    this.isMaybeSingle = true;
    this.limitCount = 1;
    return this;
  }

  // ── Insert ──

  insert(rows: any | any[]) {
    this.insertRows = Array.isArray(rows) ? rows : [rows];
    return this;
  }

  // ── Update ──

  update(data: Record<string, any>) {
    this.updateData = data;
    return this;
  }

  // ── Upsert ──

  upsert(rows: any | any[], options?: { onConflict?: string }) {
    this.upsertRows = Array.isArray(rows) ? rows : [rows];
    this.upsertConflictKey = options?.onConflict;
    return this;
  }

  // ── Delete ──

  delete() {
    this.deleteMode = true;
    return this;
  }

  // ── RPC ──

  rpc(func: string, params?: Record<string, any>) {
    this.rpcFunc = func;
    this.rpcParams = params;
    return this;
  }

  // ── Build SQL ──

  private quoteCol(col: string): string {
    return `"${col}"`;
  }

  private escapeValue(v: any): string {
    if (v === null || v === undefined) return 'NULL';
    if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
    if (typeof v === 'number') return String(v);
    if (Array.isArray(v)) {
      const escaped = JSON.stringify(v).replace(/'/g, "''");
      return `'${escaped}'`;
    }
    if (typeof v === 'object') {
      const escaped = JSON.stringify(v).replace(/'/g, "''");
      return `'${escaped}'`;
    }
    return `'${String(v).replace(/'/g, "''")}'`;
  }

  private escapeArrayLiteral(values: any): string {
    const arrayValues = Array.isArray(values) ? values : [values];
    const escaped = arrayValues
      .map((value) => String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"'))
      .map((value) => `"${value}"`)
      .join(',');
    return `'{${escaped}}'`;
  }

  private buildWhere(): string {
    if (this.filters.length === 0) return '';
    const clauses: string[] = [];
    for (const f of this.filters) {
      const col = this.quoteCol(f.column);
      switch (f.op) {
        case 'eq':
          clauses.push(`${col} = ${this.escapeValue(f.value)}`);
          break;
        case 'neq':
          clauses.push(`${col} != ${this.escapeValue(f.value)}`);
          break;
        case 'gt':
          clauses.push(`${col} > ${this.escapeValue(f.value)}`);
          break;
        case 'gte':
          clauses.push(`${col} >= ${this.escapeValue(f.value)}`);
          break;
        case 'lt':
          clauses.push(`${col} < ${this.escapeValue(f.value)}`);
          break;
        case 'lte':
          clauses.push(`${col} <= ${this.escapeValue(f.value)}`);
          break;
        case 'in':
          const vals = (f.value as any[]).map((v) => this.escapeValue(v)).join(', ');
          clauses.push(`${col} IN (${vals})`);
          break;
        case 'is':
          if (f.value === null) {
            clauses.push(`${col} IS NULL`);
          } else {
            clauses.push(`${col} IS ${this.escapeValue(f.value)}`);
          }
          break;
        case 'like':
          clauses.push(`${col} LIKE '${String(f.value).replace(/'/g, "''")}'`);
          break;
        case 'ilike':
          // ilike values often contain % wildcards - wrap as string literal
          clauses.push(`${col} ILIKE '${String(f.value).replace(/'/g, "''")}'`);
          break;
        case 'cs':
          clauses.push(`${col} @> ${this.escapeArrayLiteral(f.value)}`);
          break;
        case 'cd':
          clauses.push(`${col} <@ ${this.escapeArrayLiteral(f.value)}`);
          break;
        case 'ov':
          clauses.push(`${col} && ${this.escapeArrayLiteral(f.value)}`);
          break;
        case 'or':
          // Parse "col1.eq.val,col2.ilike.%search%,col3.cs.{val}"
          const orParts = String(f.value).split(',').map((part) => {
            const match = part.match(/(\w+)\.(eq|neq|gt|gte|lt|lte|like|ilike|cs|cd|ov)\.(.*)/);
            if (!match) return 'TRUE';
            const [, c, op, v] = match;
            const arrayValue = v.replace(/[{}]/g, '').split(',').map((item) => item.trim()).filter(Boolean);
            if (op === 'cs') {
              return `${this.quoteCol(c)} @> ${this.escapeArrayLiteral(arrayValue)}`;
            }
            if (op === 'cd') {
              return `${this.quoteCol(c)} <@ ${this.escapeArrayLiteral(arrayValue)}`;
            }
            if (op === 'ov') {
              return `${this.quoteCol(c)} && ${this.escapeArrayLiteral(arrayValue)}`;
            }
            const opMap: Record<string, string> = {
              eq: '=', neq: '!=', gt: '>', gte: '>=', lt: '<', lte: '<=',
              like: 'LIKE', ilike: 'ILIKE',
            };
            // For like/ilike, wrap value in quotes (it contains % wildcards)
            const sqlOp = opMap[op] || '=';
            const escapedVal = (op === 'like' || op === 'ilike')
              ? `'${v.replace(/'/g, "''")}'`
              : this.escapeValue(v);
            return `${this.quoteCol(c)} ${sqlOp} ${escapedVal}`;
          });
          clauses.push(`(${orParts.join(' OR ')})`);
          break;
        default:
          break;
      }
    }
    return clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  }

  private buildSelect(): { sql: string; countSql?: string } {
    const table = this.quoteCol(this.tableName);
    const cols = typeof this.selectColumns === 'string'
      ? this.selectColumns
      : (this.selectColumns as string[]).map((c) => this.quoteCol(c)).join(', ');

    const where = this.buildWhere();
    // When count is requested WITH data, select the actual columns (not COUNT(*))
    // The count will be fetched separately in execute()
    const selectExpr = this.isHead ? '1' : (cols === '*' ? `${table}.*` : cols);
    let sql = `SELECT ${selectExpr} FROM ${table} ${where}`;

    if (this.groupSpecs.length > 0 && !this.isHead) {
      sql += ` GROUP BY ${this.groupSpecs.map((column) => this.quoteCol(column)).join(', ')}`;
    }

    // Order
    if (this.orderSpecs.length > 0 && !this.isHead) {
      const orderParts = this.orderSpecs.map((o) => {
        let part = `${this.quoteCol(o.column)} ${o.ascending ? 'ASC' : 'DESC'}`;
        if (o.nullsFirst !== undefined) {
          part += o.nullsFirst ? ' NULLS FIRST' : ' NULLS LAST';
        }
        return part;
      });
      sql += ` ORDER BY ${orderParts.join(', ')}`;
    }

    // Limit / Offset
    if (this.limitCount !== undefined) {
      sql += ` LIMIT ${this.limitCount}`;
    }
    if (this.offsetCount !== undefined) {
      sql += ` OFFSET ${this.offsetCount}`;
    }

    let countSql: string | undefined;
    if (this.isCount && !this.isHead) {
      // count is already in the select
    } else if (this.isCount && this.isHead) {
      countSql = `SELECT COUNT(*) FROM ${table} ${where}`;
    }

    return { sql, countSql };
  }

  private buildInsert(): string {
    const table = this.quoteCol(this.tableName);
    const cols = Object.keys(this.insertRows[0]);
    const colStr = cols.map((c) => this.quoteCol(c)).join(', ');
    const valueRows = this.insertRows.map((row) => {
      const vals = cols.map((c) => this.escapeValue(row[c]));
      return `(${vals.join(', ')})`;
    });
    return `INSERT INTO ${table} (${colStr}) VALUES ${valueRows.join(', ')} RETURNING *`;
  }

  private buildUpdate(): string {
    const table = this.quoteCol(this.tableName);
    if (!this.updateData) throw new Error('No update data');
    const setParts = Object.entries(this.updateData).map(
      ([k, v]) => `${this.quoteCol(k)} = ${this.escapeValue(v)}`
    );
    const where = this.buildWhere();
    return `UPDATE ${table} SET ${setParts.join(', ')} ${where} RETURNING *`;
  }

  private buildUpsert(): string {
    const table = this.quoteCol(this.tableName);
    const cols = Object.keys(this.upsertRows[0]);
    const colStr = cols.map((c) => this.quoteCol(c)).join(', ');
    const valueRows = this.upsertRows.map((row) => {
      const vals = cols.map((c) => this.escapeValue(row[c]));
      return `(${vals.join(', ')})`;
    });
    const conflictCol = this.upsertConflictKey || cols[0];
    const updateParts = cols.map((c) => `${this.quoteCol(c)} = EXCLUDED.${this.quoteCol(c)}`);
    return `INSERT INTO ${table} (${colStr}) VALUES ${valueRows.join(', ')} ON CONFLICT ("${conflictCol}") DO UPDATE SET ${updateParts.join(', ')} RETURNING *`;
  }

  private buildDelete(): string {
    const table = this.quoteCol(this.tableName);
    const where = this.buildWhere();
    return `DELETE FROM ${table} ${where} RETURNING *`;
  }

  // ── Execute ──

  async then(resolve: (result: any) => void, reject: (error: any) => void) {
    try {
      const result = await this.execute();
      resolve(result);
    } catch (err) {
      reject(err);
    }
  }

  async execute() {
    // RPC
    if (this.rpcFunc) {
      return this.executeRpc();
    }

    // Determine operation type
    let sql: string;
    let isModification = false;

    if (this.deleteMode) {
      sql = this.buildDelete();
      isModification = true;
    } else if (this.upsertRows.length > 0) {
      sql = this.buildUpsert();
      isModification = true;
    } else if (this.updateData) {
      sql = this.buildUpdate();
      isModification = true;
    } else if (this.insertRows.length > 0) {
      sql = this.buildInsert();
      isModification = true;
    } else {
      const built = this.buildSelect();
      sql = built.sql;
    }

    try {
      const pgResult = await query(sql);

      if (isModification || this.deleteMode) {
        return {
          data: pgResult.rows,
          error: null,
          count: pgResult.rowCount,
        };
      }

      // SELECT results
      if (this.isMaybeSingle) {
        return {
          data: pgResult.rows.length > 0 ? pgResult.rows[0] : null,
          error: null,
          count: pgResult.rows.length,
        };
      }

      if (this.isSingle) {
        if (pgResult.rows.length === 0) {
          return {
            data: null,
            error: { code: 'PGRST116', message: 'No rows found' },
            count: 0,
          };
        }
        return {
          data: pgResult.rows[0],
          error: null,
          count: 1,
        };
      }

      // Count + data query: fetch count separately
      if (this.isCount && this.isHead) {
        const countResult = await query(`SELECT COUNT(*) FROM ${this.quoteCol(this.tableName)} ${this.buildWhere()}`);
        return {
          data: [],
          error: null,
          count: parseInt(countResult.rows[0]?.count || '0', 10),
        };
      }

      if (this.isCount) {
        // Return data AND count (Supabase's { count: 'exact' } pattern)
        const countResult = await query(`SELECT COUNT(*) FROM ${this.quoteCol(this.tableName)} ${this.buildWhere()}`);
        return {
          data: pgResult.rows,
          error: null,
          count: parseInt(countResult.rows[0]?.count || '0', 10),
        };
      }

      // Head query (no data, just count)
      if (this.isHead) {
        return {
          data: [],
          error: null,
          count: pgResult.rowCount,
        };
      }

      return {
        data: pgResult.rows,
        error: null,
        count: pgResult.rowCount,
      };
    } catch (err: any) {
      console.error(`[pg-client] SQL error on ${this.tableName}:`, err.message);
      return {
        data: null,
        error: { message: err.message, code: err.code },
        count: 0,
      };
    }
  }

  private async executeRpc() {
    // Handle known RPC functions
    if (this.rpcFunc === 'execute_sql') {
      const sqlText = this.rpcParams?.query_text || this.rpcParams?.query;
      const params = this.rpcParams?.query_params || [];
      try {
        const result = await query(sqlText, params);
        return { data: result.rows, error: null };
      } catch (err: any) {
        return { data: null, error: { message: err.message } };
      }
    }
    // Unknown RPC
    console.warn(`[pg-client] Unknown RPC function: ${this.rpcFunc}`);
    return { data: null, error: { message: `Unknown RPC function: ${this.rpcFunc}` } };
  }
}

// ── Public API (Supabase-compatible) ────────────────────────────────────

export interface PgClient {
  from(table: string): PgQueryBuilder;
  rpc(func: string, params?: Record<string, any>): PgQueryBuilder;
  auth: {
    persistSession: boolean;
  };
}

function createPgClient(): PgClient {
  return {
    from(table: string) {
      return new PgQueryBuilder(table);
    },
    rpc(func: string, params?: Record<string, any>) {
      const builder = new PgQueryBuilder('__rpc__');
      return builder.rpc(func, params);
    },
    auth: { persistSession: false },
  };
}

// ── Exports matching supabase-client.ts interface ──

let _client: PgClient | null = null;

export function getSupabase(): PgClient {
  if (!_client) {
    _client = createPgClient();
  }
  return _client;
}

export const supabase = getSupabase();

export function getSupabaseAdmin(): PgClient {
  return getSupabase();
}

export async function executeSupabaseQuery(sql: string, params: any[] = []) {
  try {
    const result = await query(sql, params);
    return { rows: result.rows };
  } catch (error) {
    console.error('[pg-client] Query error:', error);
    throw error;
  }
}

export function createCacheHeaders(maxAge = 300, staleWhileRevalidate = 600) {
  return new Headers({
    'Cache-Control': `public, s-maxage=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`,
    'Content-Type': 'application/json',
  });
}

// Re-export Pool for direct SQL access
export { getPool as pool };
