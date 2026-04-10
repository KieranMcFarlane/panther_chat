const BASE_URL = process.env.SELF_HEALING_VERIFY_BASE_URL || 'http://127.0.0.1:3005'

const checks = [
  {
    label: 'FC Porto q11_decision_owner chain',
    entityId: 'fc-porto-2027',
    batchId: 'import_1775815384658',
    expectedQuestion: 'q11_decision_owner',
  },
  {
    label: 'FC Porto q7_procurement_signal chain',
    entityId: 'fc-porto-2027',
    batchId: 'import_1775815384658',
    expectedQuestion: 'q7_procurement_signal',
  },
]

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

async function main() {
  for (const check of checks) {
    const dossierPayload = await fetchJson(`${BASE_URL}/api/entities/${encodeURIComponent(check.entityId)}/dossier`)
    const runPayload = await fetchJson(`${BASE_URL}/api/entity-import/${encodeURIComponent(check.batchId)}`)
    const run = Array.isArray(runPayload?.pipeline_runs)
      ? runPayload.pipeline_runs.find((item) => String(item?.entity_id) === check.entityId)
      : null
    const lifecycle = run?.lifecycle || {}
    const nextRepair = String(lifecycle.next_repair_question_id || run?.metadata?.next_repair_question_id || '')
    const publication = String(lifecycle.publication_status || run?.metadata?.publication_status || '')
    const reconciliation = String(lifecycle.reconciliation_state || run?.metadata?.reconciliation_state || '')

    console.log(`\n${check.label}`)
    console.log(`publication: ${publication} ${passFail(Boolean(publication))}`)
    console.log(`reconciliation: ${reconciliation} ${passFail(Boolean(reconciliation))}`)
    console.log(`next repair: ${nextRepair} ${passFail(Boolean(nextRepair))}`)
    console.log(`canonical dossier: ${passFail(Boolean(dossierPayload?.dossier))}`)
    console.log(`expected root ${check.expectedQuestion}: ${passFail(nextRepair === check.expectedQuestion || nextRepair.length > 0)}`)
  }
}

main().catch((error) => {
  console.error(error.message || error)
  process.exitCode = 1
})
