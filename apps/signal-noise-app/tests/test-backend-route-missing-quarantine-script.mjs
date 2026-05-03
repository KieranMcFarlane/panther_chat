import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ROUTE_MISSING_ERROR,
  ROUTE_MISSING_FAILURE_CLASS,
  ROUTE_MISSING_PHASE,
  buildCandidateQuery,
  buildQuarantineBatchesQuery,
  buildQuarantineRunsQuery,
  parseArgs,
} from '../scripts/quarantine-backend-route-missing-runs.mjs';

test('backend route missing quarantine targets only entity registration 404 infrastructure rows', () => {
  const query = buildCandidateQuery();

  assert.equal(ROUTE_MISSING_ERROR, 'HTTP Error 404: Not Found');
  assert.equal(ROUTE_MISSING_PHASE, 'entity_registration');
  assert.equal(ROUTE_MISSING_FAILURE_CLASS, 'backend_route_missing');
  assert.match(query, /WHERE error_message = \$1/);
  assert.match(query, /AND phase = \$2/);
  assert.match(query, /metadata->>'failure_class'/);
  assert.doesNotMatch(query, /\bDELETE\b/i);
});

test('backend route missing quarantine is dry-run by default and apply-only for mutation', () => {
  assert.deepEqual(parseArgs([]), { apply: false, limit: 0 });
  assert.deepEqual(parseArgs(['--apply', '--limit=25']), { apply: true, limit: 25 });
});

test('backend route missing quarantine marks runs and batches as infrastructure failures', () => {
  const runsQuery = buildQuarantineRunsQuery();
  const batchesQuery = buildQuarantineBatchesQuery();

  assert.match(runsQuery, /UPDATE entity_pipeline_runs/);
  assert.match(runsQuery, /'failure_class', \$3/);
  assert.match(runsQuery, /'infrastructure_failure', true/);
  assert.match(runsQuery, /'blocked_by_infrastructure', true/);
  assert.match(runsQuery, /'original_error_message', \$1/);
  assert.match(batchesQuery, /UPDATE entity_import_batches/);
  assert.match(batchesQuery, /'blocked_by_infrastructure', true/);
  assert.doesNotMatch(runsQuery + batchesQuery, /\bDELETE\b/i);
});
