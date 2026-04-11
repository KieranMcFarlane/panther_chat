const BASE_URL = process.env.SELF_HEALING_VERIFY_BASE_URL || 'http://127.0.0.1:3005'

const TARGET = {
  slug: process.env.SELF_HEALING_VERIFY_ENTITY_SLUG || 'fc-porto-2027',
  canonicalUuid: process.env.SELF_HEALING_VERIFY_ENTITY_UUID || 'f16e501a-c750-4450-9238-847e8d4b3f8a',
  q11BatchId: process.env.SELF_HEALING_VERIFY_Q11_BATCH_ID || 'import_1775831822073',
  q7BatchId: process.env.SELF_HEALING_VERIFY_Q7_BATCH_ID || 'import_1775831955666',
}

function passFail(condition) {
  return condition ? 'PASS' : 'FAIL'
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { accept: 'application/json' } })
  if (!response.ok) {
    throw new Error(`Request failed for ${url}: ${response.status}`)
  }
  return response.json()
}

function findRun(batchPayload) {
  if (!Array.isArray(batchPayload?.pipeline_runs)) {
    return null
  }
  return batchPayload.pipeline_runs.find((item) => {
    const entityId = String(item?.entity_id || '')
    const canonicalEntityId = String(item?.canonical_entity_id || '')
    return entityId === TARGET.slug || canonicalEntityId === TARGET.canonicalUuid
  }) || null
}

function readLifecycle(run) {
  return run?.lifecycle || run?.metadata || {}
}

function normalizeExecutionStatus(batchStatus, runStatus) {
  const normalizedBatchStatus = String(batchStatus || '').trim().toLowerCase()
  const normalizedRunStatus = String(runStatus || '').trim().toLowerCase()

  if (normalizedBatchStatus === 'running' || normalizedBatchStatus === 'retrying' || normalizedRunStatus === 'running' || normalizedRunStatus === 'retrying') {
    return 'running'
  }
  if (normalizedBatchStatus === 'queued' || normalizedBatchStatus === 'claiming' || normalizedRunStatus === 'queued' || normalizedRunStatus === 'claiming') {
    return 'queued'
  }
  if (normalizedBatchStatus === 'completed' || normalizedRunStatus === 'completed') {
    return 'completed'
  }
  if (normalizedBatchStatus === 'failed' || normalizedRunStatus === 'failed') {
    return 'failed'
  }
  return 'planned'
}

function nextBatchIdFromLifecycle(lifecycle) {
  return String(lifecycle?.next_repair_batch_id || lifecycle?.queued_repair_batch_id || '').trim() || null
}

async function traceRepairChain(rootBatchId) {
  const chain = []
  const seen = new Set()
  let currentBatchId = rootBatchId

  while (currentBatchId && !seen.has(currentBatchId) && chain.length < 12) {
    seen.add(currentBatchId)
    const batchPayload = await fetchJson(`${BASE_URL}/api/entity-import/${encodeURIComponent(currentBatchId)}`)
    const run = findRun(batchPayload)
    const lifecycle = readLifecycle(run)
    const batchStatus = String(batchPayload?.batch?.status || '').trim().toLowerCase()
    const runStatus = String(run?.status || '').trim().toLowerCase()
    const executionStatus = normalizeExecutionStatus(batchStatus, runStatus)
    const nextBatchId = nextBatchIdFromLifecycle(lifecycle)

    chain.push({
      batchId: currentBatchId,
      batchStatus,
      runStatus,
      executionStatus,
      lifecycle,
      nextBatchId,
    })

    if (!nextBatchId || seen.has(nextBatchId)) {
      break
    }
    currentBatchId = nextBatchId
  }

  return chain
}

function summarizeChain(chain) {
  const active = chain.filter((entry) => entry.executionStatus === 'queued' || entry.executionStatus === 'running')
  const latest = chain[chain.length - 1] || null
  const latestCompleted = [...chain].reverse().find((entry) => entry.executionStatus === 'completed') || null
  const latestLifecycle = latest?.lifecycle || {}
  const latestCompletedLifecycle = latestCompleted?.lifecycle || {}
  const latestNextStatus = String(latestLifecycle?.next_repair_status || '').trim().toLowerCase()
  const latestNextQuestionId = String(latestLifecycle?.next_repair_question_id || '').trim()
  const latestNextBatchId = nextBatchIdFromLifecycle(latestLifecycle)
  const durableNextStatus = active.length === 1
    ? active[0].executionStatus
    : (latestNextStatus || (latestNextQuestionId ? 'planned' : 'none'))

  return {
    latest,
    latestCompleted,
    latestLifecycle,
    latestCompletedLifecycle,
    active,
    latestNextQuestionId,
    latestNextBatchId,
    durableNextStatus,
    plannedWithoutBatch: durableNextStatus === 'planned' && !latestNextBatchId,
    duplicateActiveBatches: active.length > 1,
  }
}

function printChainSummary(title, summary) {
  const publicationStatus = String(summary.latestCompletedLifecycle?.publication_status || summary.latestLifecycle?.publication_status || '')
  const reconciliationState = String(summary.latestCompletedLifecycle?.reconciliation_state || summary.latestLifecycle?.reconciliation_state || '')
  const nextRepairQuestionId = String(summary.latestNextQuestionId || '')
  const activeBatchIds = summary.active.map((entry) => entry.batchId)

  console.log(`\n${title}`)
  console.log(`publication: ${publicationStatus} ${passFail(Boolean(publicationStatus))}`)
  console.log(`reconciliation: ${reconciliationState} ${passFail(Boolean(reconciliationState))}`)
  console.log(`next repair: ${nextRepairQuestionId} ${passFail(Boolean(nextRepairQuestionId))}`)
  console.log(`next repair status: ${summary.durableNextStatus} ${passFail(summary.durableNextStatus === 'queued' || summary.durableNextStatus === 'running')}`)
  console.log(`active repair batches: ${activeBatchIds.join(', ') || 'none'} ${passFail(activeBatchIds.length === 1)}`)
  console.log(`no duplicate equivalent batch: ${passFail(!summary.duplicateActiveBatches)}`)
  console.log(`planned without batch: ${passFail(!summary.plannedWithoutBatch)}`)
}

async function main() {
  const [slugDossier, uuidDossier, entityPayload, q11Chain, q7Chain] = await Promise.all([
    fetchJson(`${BASE_URL}/api/entities/${encodeURIComponent(TARGET.slug)}/dossier`),
    fetchJson(`${BASE_URL}/api/entities/${encodeURIComponent(TARGET.canonicalUuid)}/dossier`),
    fetchJson(`${BASE_URL}/api/entities/${encodeURIComponent(TARGET.slug)}`),
    traceRepairChain(TARGET.q11BatchId),
    traceRepairChain(TARGET.q7BatchId),
  ])

  const q11Summary = summarizeChain(q11Chain)
  const q7Summary = summarizeChain(q7Chain)
  const slugCanonicalId = String(slugDossier?.dossier?.entity_id || '')
  const uuidCanonicalId = String(uuidDossier?.dossier?.entity_id || '')
  const entityApiUuid = String(entityPayload?.entity?.uuid || '')
  const combinedActiveBatches = [...new Set([...q11Summary.active, ...q7Summary.active].map((entry) => entry.batchId))]

  console.log(`entity slug: ${TARGET.slug}`)
  console.log(`canonical uuid: ${TARGET.canonicalUuid}`)
  console.log(`slug-vs-uuid collapse: ${passFail(slugCanonicalId === uuidCanonicalId && slugCanonicalId === TARGET.canonicalUuid)}`)
  console.log(`entity api canonical uuid: ${entityApiUuid} ${passFail(entityApiUuid === TARGET.canonicalUuid)}`)
  console.log(`canonical dossier row: ${passFail(slugDossier?.source === 'supabase_persisted_dossier' && slugCanonicalId === TARGET.canonicalUuid)}`)
  console.log(`active repair batches: ${combinedActiveBatches.join(', ') || 'none'} ${passFail(combinedActiveBatches.length >= 1)}`)

  printChainSummary('FC Porto q11_decision_owner chain', q11Summary)
  printChainSummary('FC Porto q7_procurement_signal chain', q7Summary)
}

main().catch((error) => {
  console.error(error.message || error)
  process.exitCode = 1
})
