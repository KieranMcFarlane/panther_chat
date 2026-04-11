import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const queueSource = readFileSync(new URL('../src/lib/entity-dossier-queue.ts', import.meta.url), 'utf8')
const rerunRouteSource = readFileSync(new URL('../src/app/api/entities/[entityId]/dossier/rerun/route.ts', import.meta.url), 'utf8')

test('question repair queue dedupes active reruns by repair key and exposes reused batch metadata', () => {
  assert.match(queueSource, /findActivePipelineRunByEntityId/)
  assert.match(queueSource, /canonical_entity_id/)
  assert.match(queueSource, /rerun_mode/)
  assert.match(queueSource, /question_id/)
  assert.match(queueSource, /cascade_dependents/)
  assert.match(queueSource, /repair_queue_source|auto_repair_queued|repair_state/)
  assert.match(queueSource, /repair_retry_budget/)
  assert.match(queueSource, /next_repair_question_id/)
  assert.match(queueSource, /reusedBatchId|reused_batch_id|reused_batch/)
  assert.match(rerunRouteSource, /reused_batch/)
})

test('question repair reruns forward the canonical artifact path into repair source metadata', () => {
  assert.match(rerunRouteSource, /canonical\.artifactPath/)
  assert.match(rerunRouteSource, /canonical\.source === 'question_first_run'/)
  assert.match(rerunRouteSource, /canonical\.source === 'question_first_dossier'/)
  assert.match(rerunRouteSource, /repairSourceRunPath,\s*\n\s*repairSourceDossierPath/)
  assert.match(rerunRouteSource, /body\?\.rerun_mode/)
})

test('question repair dedupe ignores stale active runs whose leases have expired', () => {
  assert.match(queueSource, /lease_expires_at/)
  assert.match(queueSource, /new Date\(String\(.*lease_expires_at.*\)\)/s)
  assert.match(queueSource, /Date\.now\(\)/)
})

test('question repair dedupe ignores runs whose batch row is already terminal', () => {
  assert.match(queueSource, /activeRunState\.batch/)
  assert.match(queueSource, /activeBatchStillActive/)
  assert.match(queueSource, /!\['completed', 'failed'\]\.includes/)
})

test('question repair dedupe can collapse slug and uuid requests onto the same canonical entity', () => {
  assert.match(queueSource, /entity\.uuid/)
  assert.match(queueSource, /findActivePipelineRunByEntityId\(/)
  assert.match(rerunRouteSource, /resolveEntityForDossierQueue/)
})
