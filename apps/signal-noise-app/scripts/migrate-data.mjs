#!/usr/bin/env node
/**
 * Migrate data from Supabase to local PostgreSQL.
 * Run: node scripts/migrate-data.mjs
 */
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '..', '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const localPg = new pg.Pool({
  host: 'localhost',
  port: 5432,
  database: 'signal_noise_app',
  user: process.env.PGUSER || 'kieranmcfarlane',
});

const BATCH_SIZE = 500;

// Tables to migrate, ordered by dependency
const TABLES = [
  // Small tables first
  { name: 'evidence', batch: 100 },
  { name: 'entity_source_registry', batch: 100 },
  { name: 'graphiti_notifications', batch: 100 },
  { name: 'rfp_opportunities_unified', batch: 100 },
  { name: 'graphiti_materialized_insights', batch: 200 },
  // Medium tables
  { name: 'entity_import_batches', batch: 500 },
  { name: 'entity_pipeline_runs', batch: 500 },
  { name: 'entity_aliases', batch: 500 },
  { name: 'rfp_opportunities', batch: 500 },
  { name: 'entity_dossiers', batch: 500 },
  // Large tables
  { name: 'cached_entities', batch: 1000 },
  { name: 'temporal_episodes', batch: 1000 },
  { name: 'entity_sync_tracker', batch: 1000 },
  // canonical_entities - just get the missing ones
  { name: 'canonical_entities', batch: 1000 },
];

async function fetchFromSupabase(table, offset, limit) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?select=*&order=id.asc&offset=${offset}&limit=${limit}`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase ${table} fetch failed: ${res.status} ${text}`);
  }
  return res.json();
}

async function getLocalColumns(table) {
  const result = await localPg.query(
    `SELECT column_name, data_type, is_nullable, column_default
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1
     ORDER BY ordinal_position`,
    [table]
  );
  return result.rows;
}

async function getPrimaryKey(table) {
  const result = await localPg.query(
    `SELECT kcu.column_name
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
     WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = 'public' AND tc.table_name = $1`,
    [table]
  );
  return result.rows.length > 0 ? result.rows[0].column_name : null;
}

async function getLocalCount(table) {
  const result = await localPg.query(`SELECT COUNT(*) as count FROM ${table}`);
  return parseInt(result.rows[0].count, 10);
}

function sanitizeRow(row, columns) {
  const colNames = columns.map(c => c.column_name);
  const clean = {};
  for (const col of colNames) {
    if (row[col] !== undefined) {
      // Convert arrays stored as strings back to arrays
      const colDef = columns.find(c => c.column_name === col);
      if (colDef && (colDef.data_type === 'ARRAY' || colDef.data_type === 'jsonb' || colDef.data_type === 'json')) {
        if (typeof row[col] === 'string') {
          try {
            clean[col] = JSON.parse(row[col]);
          } catch {
            clean[col] = row[col];
          }
        } else {
          clean[col] = row[col];
        }
      } else {
        clean[col] = row[col];
      }
    }
  }
  return clean;
}

async function migrateTable(tableConfig) {
  const { name: table, batch } = tableConfig;
  console.log(`\n=== Migrating ${table} ===`);

  const columns = await getLocalColumns(table);
  const colNames = columns.map(c => c.column_name);
  const pkCol = await getPrimaryKey(table);
  const localCount = await getLocalCount(table);
  console.log(`  Local rows: ${localCount}`);

  let totalInserted = 0;
  let offset = 0;
  let hasMore = true;

  // For canonical_entities, skip existing rows
  if (table === 'canonical_entities' && localCount > 0) {
    console.log(`  Skipping first ${localCount} rows (already imported)`);
    offset = localCount;
  }

  while (hasMore) {
    try {
      const rows = await fetchFromSupabase(table, offset, batch || BATCH_SIZE);
      if (!rows || rows.length === 0) {
        hasMore = false;
        break;
      }

      // Sanitize and filter to only columns that exist locally
      const cleanRows = rows.map(r => sanitizeRow(r, columns)).filter(r => {
        // Skip rows where all values are null
        return Object.values(r).some(v => v !== null && v !== undefined);
      });

      if (cleanRows.length === 0) {
        offset += rows.length;
        hasMore = rows.length === (batch || BATCH_SIZE);
        continue;
      }

      // Build INSERT query
      const insertCols = Object.keys(cleanRows[0]);
      const colList = insertCols.map(c => `"${c}"`).join(', ');

      const valueGroups = [];
      const params = [];
      let paramIdx = 1;

      for (const row of cleanRows) {
        const placeholders = [];
        for (const col of insertCols) {
          const val = row[col];
          if (val === null || val === undefined) {
            placeholders.push('NULL');
          } else if (typeof val === 'object') {
            params.push(JSON.stringify(val));
            placeholders.push(`$${paramIdx}::jsonb`);
            paramIdx++;
          } else {
            params.push(val);
            placeholders.push(`$${paramIdx}`);
            paramIdx++;
          }
        }
        valueGroups.push(`(${placeholders.join(', ')})`);
      }

      // Use ON CONFLICT DO NOTHING to handle duplicates
      const conflictClause = pkCol ? `ON CONFLICT ("${pkCol}") DO NOTHING` : 'ON CONFLICT DO NOTHING';
      const sql = `INSERT INTO "${table}" (${colList}) VALUES ${valueGroups.join(', ')} ${conflictClause}`;

      try {
        const result = await localPg.query(sql, params);
        totalInserted += result.rowCount;
      } catch (err) {
        // Try row-by-row for problematic data
        console.log(`  Batch insert failed (${err.message}), trying row-by-row...`);
        for (const row of cleanRows) {
          try {
            const insertCols2 = Object.keys(row);
            const colList2 = insertCols2.map(c => `"${c}"`).join(', ');
            const params2 = [];
            const placeholders2 = [];

            for (const col of insertCols2) {
              const val = row[col];
              if (val === null || val === undefined) {
                placeholders2.push('NULL');
              } else if (typeof val === 'object') {
                params2.push(JSON.stringify(val));
                placeholders2.push(`$${params2.length}::jsonb`);
              } else {
                params2.push(val);
                placeholders2.push(`$${params2.length}`);
              }
            }

            const conflictClause2 = pkCol ? `ON CONFLICT ("${pkCol}") DO NOTHING` : 'ON CONFLICT DO NOTHING';
            const sql2 = `INSERT INTO "${table}" (${colList2}) VALUES (${placeholders2.join(', ')}) ${conflictClause2}`;
            const r = await localPg.query(sql2, params2);
            totalInserted += r.rowCount;
          } catch (e2) {
            // Skip individual bad rows
            if (!e2.message.includes('duplicate key') && !e2.message.includes('violates unique constraint')) {
              console.log(`    Skipped row: ${e2.message.substring(0, 80)}`);
            }
          }
        }
      }

      offset += rows.length;
      hasMore = rows.length === (batch || BATCH_SIZE);
      process.stdout.write(`  Fetched ${offset}, inserted ${totalInserted}\r`);
    } catch (err) {
      console.error(`  Error at offset ${offset}: ${err.message}`);
      hasMore = false;
    }
  }

  const finalCount = await getLocalCount(table);
  console.log(`\n  Done: ${totalInserted} inserted, total local: ${finalCount}`);
  return totalInserted;
}

async function main() {
  console.log('Supabase → Local PG Data Migration');
  console.log('====================================');

  let totalAll = 0;
  for (const table of TABLES) {
    try {
      const inserted = await migrateTable(table);
      totalAll += inserted;
    } catch (err) {
      console.error(`Failed to migrate ${table.name}: ${err.message}`);
    }
  }

  console.log(`\n====================================`);
  console.log(`Total rows inserted: ${totalAll}`);

  // Print final counts
  console.log(`\nFinal row counts:`);
  for (const table of TABLES) {
    const count = await getLocalCount(table.name);
    console.log(`  ${table.name}: ${count}`);
  }

  await localPg.end();
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
