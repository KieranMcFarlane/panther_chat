import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('wide research route references Manus execution and canonical entity reconciliation', async () => {
  const source = await readFile(new URL('../src/app/api/rfp-wide-research/route.ts', import.meta.url), 'utf8')

  assert.match(source, /MANUS_API/)
  assert.match(source, /Set MANUS_API in \.env before running wide research\./)
  assert.match(source, /https:\/\/api\.manus\.ai\/v2\/task\.create/)
  assert.match(source, /https:\/\/api\.manus\.ai\/v2\/task\.listMessages/)
  assert.match(source, /x-manus-api-key/)
  assert.match(source, /https:\/\/api\.manus\.ai\/v1\/tasks/)
  assert.match(source, /API_KEY/)
  assert.match(source, /callManusV1FallbackApi/)
  assert.match(source, /isManusV2CreateFallbackError/)
  assert.match(source, /manusTaskId/)
  assert.match(source, /focusArea/)
  assert.match(source, /web-platforms/)
  assert.match(source, /searchGraphitiEntities/)
  assert.match(source, /syncWideRfpBatchToGraphiti/)
  assert.match(source, /toText\(body\.prompt\) \|\| buildWideRfpResearchPrompt/)
  assert.match(source, /getDefaultWideRfpSeedQuery/)
  assert.match(source, /buildWideRfpResearchPrompt/)
  assert.match(source, /normalizeWideRfpResearchBatch/)
  assert.match(source, /canonical_entities/)
  assert.match(source, /upsert/)
  assert.match(source, /canonical_key/)
  assert.match(source, /maybeSingle/)
  assert.match(source, /create an entity|createCanonicalEntity|ensureCanonicalEntity/i)
  assert.match(source, /crypto\.randomUUID/)
  assert.match(source, /normalized_name/)
  assert.doesNotMatch(source, /canonical-\$\{slugify\(organization\)\}/)
  assert.match(source, /original_source_url/)
  assert.match(source, /created_via/)
  assert.match(source, /description/)
  assert.match(source, /deadline/)
  assert.match(source, /category/)
  assert.match(source, /inferOpportunitySport/)
  assert.match(source, /writeWideRfpResearchArtifact|persist/i)
})

test('wide research route falls back to Manus v1 when v2 task creation fails upstream', async () => {
  const source = await readFile(new URL('../src/app/api/rfp-wide-research/route.ts', import.meta.url), 'utf8')

  assert.match(source, /failed to create task record/)
  assert.match(source, /v1_fallback/)
  assert.match(source, /manus_fallback_reason/)
  assert.match(source, /waitForManusV1Task/)
  assert.match(source, /Manus v2 message polling could not see task/)
  assert.match(source, /Manus v1 task poll failed with/)
  assert.match(source, /credit_usage/)
  assert.match(source, /Manus v1 fallback task did not complete/)
  assert.match(source, /recoverCompletedManusTask/)
})

test('wide research route carries Manus task credit metadata into normalized batches', async () => {
  const source = await readFile(new URL('../src/app/api/rfp-wide-research/route.ts', import.meta.url), 'utf8')

  assert.match(source, /credit_usage/)
  assert.match(source, /manus_task_id/)
  assert.match(source, /manus_task_url/)
  assert.match(source, /manus_credit_usage/)
  assert.match(source, /manus_agent_profile/)
  assert.match(source, /prompt_execution_metadata/)
})

test('wide research route reads v2 stopped messages and structured output results', async () => {
  const source = await readFile(new URL('../src/app/api/rfp-wide-research/route.ts', import.meta.url), 'utf8')

  assert.match(source, /agent_status/)
  assert.match(source, /stopped/)
  assert.match(source, /structured_output_result/)
  assert.doesNotMatch(source, /structured_output_schema/)
  assert.match(source, /assistant_message/)
  assert.match(source, /error_message/)
  assert.match(source, /isRetryableManusPollError/)
  assert.match(source, /Task not found/i)
})

test('wide research route recovers Manus JSON output files', async () => {
  const source = await readFile(new URL('../src/app/api/rfp-wide-research/route.ts', import.meta.url), 'utf8')

  assert.match(source, /parseTaskOutputFilePayload/)
  assert.match(source, /fileUrl/)
  assert.match(source, /mimeType/)
  assert.match(source, /batch_metadata/)
  assert.match(source, /sweep_id/)
  assert.match(source, /executed_at/)
  assert.match(source, /unixSecondsToIso\(payload\.updated_at\)/)
})

test('wide research route accepts scheduled Manus JSON attachments that are bare opportunity arrays', async () => {
  const source = await readFile(new URL('../src/app/api/rfp-wide-research/route.ts', import.meta.url), 'utf8')

  assert.match(source, /normalizeParsedTaskPayload/)
  assert.match(source, /Array\.isArray\(parsed\)/)
  assert.match(source, /opportunities:\s*parsed/)
  assert.match(source, /scheduled_json_array/)
})

test('wide research route recovers source-linked Manus narration as review-required JSON', async () => {
  const source = await readFile(new URL('../src/app/api/rfp-wide-research/route.ts', import.meta.url), 'utf8')

  assert.match(source, /normalizeNarrativeTaskPayload/)
  assert.match(source, /extractNarrativeSourceUrls/)
  assert.match(source, /narrative_recovery_used/)
  assert.match(source, /review_required_source_linked_narrative_recovery/)
  assert.match(source, /provider_output_format:\s*'narrative'/)
  assert.match(source, /Recovered from Manus narrative/)
})

test('wide research route bounds Manus spend and forces final JSON before stopping', async () => {
  const source = await readFile(new URL('../src/app/api/rfp-wide-research/route.ts', import.meta.url), 'utf8')

  assert.match(source, /MANUS_RFP_MAX_POLL_ATTEMPTS/)
  assert.match(source, /MANUS_RFP_MAX_CREDITS/)
  assert.match(source, /sendManusFinalizeMessage/)
  assert.match(source, /task\.sendMessage/)
  assert.match(source, /task\.stop/)
  assert.match(source, /Return the best qualified opportunities found so far/i)
  assert.match(source, /credit_usage/)
})
