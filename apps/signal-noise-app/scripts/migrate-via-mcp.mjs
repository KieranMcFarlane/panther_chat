#!/usr/bin/env node
/**
 * Import data from JSON files into local PostgreSQL.
 * Usage: node scripts/import-json.mjs <table> <json-file>
 *
 * JSON files should contain an array of row objects.
 * The script auto-detects columns from local PG schema.
 */
import pg from 'pg';
import { readFileSync } from 'fs';

const table = process.argv[2];
const jsonFile = process.argv[3];

if (!table || !jsonFile) {
  console.error('Usage: node import-json.mjs <table> <json-file>');
  process.exit(1);
}

const pool = new pg.Pool({
  host: 'localhost',
  port: 5432,
  database: 'signal_noise_app',
  user: process.env.PGUSER || process.env.USER,
});

async function getColumns(tableName) {
  const result = await pool.query(
    `SELECT column_name, data_type FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
    [tableName]
  );
  return result.rows;
}

async function getPrimaryKey(tableName) {
  const result = await pool.query(
    `SELECT kcu.column_name FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
     WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = 'public' AND tc.table_name = $1`,
    [tableName]
  );
  return result.rows.length > 0 ? result.rows[0].column_name : null;
}

async function main() {
  const data = JSON.parse(readFileSync(jsonFile, 'utf-8'));
  console.log(`Importing ${data.length} rows into ${table}...`);

  const columns = await getColumns(table);
  const colNames = columns.map(c => c.column_name);
  const pkCol = await getPrimaryKey(table);
  const colSet = new Set(colNames);

  let inserted = 0;
  let skipped = 0;

  for (const row of data) {
    // Only use columns that exist in local schema
    const filteredCols = Object.keys(row).filter(k => colSet.has(k));
    const values = filteredCols.map(k => {
      const val = row[k];
      if (val === null || val === undefined) return null;
      return val;
    });

    const colList = filteredCols.map(c => `"${c}"`).join(', ');
    const placeholders = filteredCols.map((_, i) => {
      const col = columns.find(c => c.column_name === filteredCols[i]);
      if (col && col.data_type === 'ARRAY') {
        // Convert JS array to PostgreSQL text[] format
        const val = values[i];
        if (Array.isArray(val)) {
          values[i] = val; // pg driver handles JS arrays natively
        } else if (typeof val === 'string') {
          try { values[i] = JSON.parse(val); } catch { /* keep as-is */ }
        }
        return `$${i + 1}::text[]`;
      }
      if (col && (col.data_type === 'jsonb' || col.data_type === 'json')) {
        return `$${i + 1}::jsonb`;
      }
      return `$${i + 1}`;
    }).join(', ');

    const conflictClause = pkCol ? `ON CONFLICT ("${pkCol}") DO NOTHING` : 'ON CONFLICT DO NOTHING';
    const sql = `INSERT INTO "${table}" (${colList}) VALUES (${placeholders}) ${conflictClause}`;

    try {
      const result = await pool.query(sql, values);
      inserted += result.rowCount;
    } catch (err) {
      if (!err.message.includes('duplicate key') && !err.message.includes('violates unique')) {
        console.error(`  Error: ${err.message.substring(0, 100)}`);
      }
      skipped++;
    }
  }

  console.log(`Done: ${inserted} inserted, ${skipped} skipped`);

  // Verify count
  const count = await pool.query(`SELECT COUNT(*) FROM "${table}"`);
  console.log(`Total rows in ${table}: ${count.rows[0].count}`);

  await pool.end();
}

main().catch(err => {
  console.error('Import failed:', err);
  process.exit(1);
});
