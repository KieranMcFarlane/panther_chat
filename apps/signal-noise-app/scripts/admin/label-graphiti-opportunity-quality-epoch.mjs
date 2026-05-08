#!/usr/bin/env node

import { resolve } from 'node:path'
import { config } from 'dotenv'
import pg from 'pg'

import {
  GRAPHITI_OPPORTUNITY_PROCESSED_VERSION,
  GRAPHITI_OPPORTUNITY_QUALITY_CUTOFF_AT,
  GRAPHITI_OPPORTUNITY_QUALITY_EPOCH,
} from '../../src/lib/graphiti-opportunity-quality-epoch.mjs'

// Official epoch: yp_graphiti_truth_v1 / graphiti_commercial_truth_v1.
config({ path: resolve(process.cwd(), '.env'), quiet: true })

const dryRun = !process.argv.includes('--apply')

function createPool() {
  if (process.env.DATABASE_URL) {
    return new pg.Pool({ connectionString: process.env.DATABASE_URL })
  }
  return new pg.Pool({
    host: process.env.PGHOST || 'localhost',
    port: Number(process.env.PGPORT || 5432),
    database: process.env.PGDATABASE || 'signal_noise_app',
    user: process.env.PGUSER || process.env.USER,
    password: process.env.PGPASSWORD || undefined,
  })
}

async function countRows(pool) {
  const materialized = await pool.query(
    `
      select
        count(*)::int as total_materialized_rows,
        count(*) filter (
          where coalesce(materialized_at, last_seen_at, detected_at, 'epoch'::timestamptz) < $1::timestamptz
        )::int as pre_cutoff_legacy_rows,
        count(*) filter (
          where coalesce(materialized_at, last_seen_at, detected_at) >= $1::timestamptz
        )::int as post_cutoff_trusted_candidates,
        count(*) filter (where raw_payload ? 'bd_strategy_brief')::int as rows_with_existing_strategy_briefs,
        count(*) filter (where raw_payload->>'quality_epoch' = $2 and coalesce(raw_payload->>'legacy_untrusted', 'false') <> 'true')::int as already_trusted_rows,
        count(*) filter (where coalesce(raw_payload->>'legacy_untrusted', 'false') = 'true')::int as already_legacy_rows
      from graphiti_materialized_opportunities
    `,
    [GRAPHITI_OPPORTUNITY_QUALITY_CUTOFF_AT, GRAPHITI_OPPORTUNITY_QUALITY_EPOCH],
  )
  const ingestions = await pool.query(
    `
      select
        count(*)::int as total_ingestion_rows,
        count(*) filter (
          where coalesce(ingested_at, source_generated_at, source_created_at, 'epoch'::timestamptz) < $1::timestamptz
        )::int as pre_cutoff_ingestion_rows,
        count(*) filter (
          where coalesce(ingested_at, source_generated_at, source_created_at) >= $1::timestamptz
        )::int as post_cutoff_ingestion_candidates
      from graphiti_dossier_ingestions
    `,
    [GRAPHITI_OPPORTUNITY_QUALITY_CUTOFF_AT],
  )
  return {
    ...materialized.rows[0],
    ...ingestions.rows[0],
  }
}

async function applyLabels(pool) {
  const legacyMaterialized = await pool.query(
    `
      update graphiti_materialized_opportunities
         set raw_payload = (coalesce(raw_payload, '{}'::jsonb) - ARRAY['quality_epoch', 'processed_with_version', 'quality_processed_at'])
           || jsonb_build_object(
             'quality_cutoff_at', $1,
             'legacy_untrusted', true,
             'legacy_untrusted_reason', 'pre_quality_epoch_cutoff'
           ),
             updated_at = now()
       where coalesce(materialized_at, last_seen_at, detected_at, 'epoch'::timestamptz) < $1::timestamptz
    `,
    [GRAPHITI_OPPORTUNITY_QUALITY_CUTOFF_AT],
  )
  const trustedMaterialized = await pool.query(
    `
      update graphiti_materialized_opportunities
         set raw_payload = (coalesce(raw_payload, '{}'::jsonb) - ARRAY['legacy_untrusted_reason'])
           || jsonb_build_object(
             'quality_epoch', $2::text,
             'processed_with_version', $3::text,
             'quality_cutoff_at', $1,
             'quality_processed_at', now(),
             'legacy_untrusted', false
           ),
             updated_at = now()
       where coalesce(materialized_at, last_seen_at, detected_at) >= $1::timestamptz
    `,
    [
      GRAPHITI_OPPORTUNITY_QUALITY_CUTOFF_AT,
      GRAPHITI_OPPORTUNITY_QUALITY_EPOCH,
      GRAPHITI_OPPORTUNITY_PROCESSED_VERSION,
    ],
  )
  const legacyIngestions = await pool.query(
    `
      update graphiti_dossier_ingestions
         set raw_metadata = (coalesce(raw_metadata, '{}'::jsonb) - ARRAY['quality_epoch', 'processed_with_version', 'quality_processed_at'])
           || jsonb_build_object(
             'quality_cutoff_at', $1,
             'legacy_untrusted', true,
             'legacy_untrusted_reason', 'pre_quality_epoch_cutoff'
           ),
             updated_at = now()
       where coalesce(ingested_at, source_generated_at, source_created_at, 'epoch'::timestamptz) < $1::timestamptz
    `,
    [GRAPHITI_OPPORTUNITY_QUALITY_CUTOFF_AT],
  )
  const trustedIngestions = await pool.query(
    `
      update graphiti_dossier_ingestions
         set raw_metadata = (coalesce(raw_metadata, '{}'::jsonb) - ARRAY['legacy_untrusted_reason'])
           || jsonb_build_object(
             'quality_epoch', $2::text,
             'processed_with_version', $3::text,
             'quality_cutoff_at', $1,
             'quality_processed_at', now(),
             'legacy_untrusted', false
           ),
             updated_at = now()
       where coalesce(ingested_at, source_generated_at, source_created_at) >= $1::timestamptz
    `,
    [
      GRAPHITI_OPPORTUNITY_QUALITY_CUTOFF_AT,
      GRAPHITI_OPPORTUNITY_QUALITY_EPOCH,
      GRAPHITI_OPPORTUNITY_PROCESSED_VERSION,
    ],
  )
  return {
    legacy_materialized_updated: legacyMaterialized.rowCount,
    trusted_materialized_updated: trustedMaterialized.rowCount,
    legacy_ingestions_updated: legacyIngestions.rowCount,
    trusted_ingestions_updated: trustedIngestions.rowCount,
  }
}

const pool = createPool()
try {
  const before = await countRows(pool)
  const applied = dryRun ? null : await applyLabels(pool)
  const after = dryRun ? null : await countRows(pool)
  console.log(JSON.stringify({
    dryRun,
    quality_epoch: GRAPHITI_OPPORTUNITY_QUALITY_EPOCH,
    processed_with_version: GRAPHITI_OPPORTUNITY_PROCESSED_VERSION,
    quality_cutoff_at: GRAPHITI_OPPORTUNITY_QUALITY_CUTOFF_AT,
    before,
    applied,
    after,
  }, null, 2))
} finally {
  await pool.end()
}
