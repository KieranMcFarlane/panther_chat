import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const contractSource = readFileSync(new URL('../src/lib/graphiti-opportunity-contract.ts', import.meta.url), 'utf8')
const readModelSource = readFileSync(new URL('../src/lib/graphiti-opportunity-read-model.ts', import.meta.url), 'utf8')
const materializerSource = readFileSync(new URL('../src/lib/graphiti-opportunity-materializer.ts', import.meta.url), 'utf8')
const clientSource = readFileSync(new URL('../src/app/opportunities/opportunities-client.tsx', import.meta.url), 'utf8')

test('graphiti opportunity contract exposes temporal reasoning and findings', () => {
  assert.match(contractSource, /GraphitiOpportunityTemporalReasoning/)
  assert.match(contractSource, /GraphitiOpportunityPatternReasoning/)
  assert.match(contractSource, /GraphitiOpportunityFinding/)
  assert.match(contractSource, /temporal_reasoning\?:/)
  assert.match(contractSource, /pattern_reasoning\?:/)
  assert.match(contractSource, /yp_fit_reasoning\?:/)
  assert.match(contractSource, /recommended_action\?:/)
  assert.match(contractSource, /findings\?:/)
  assert.match(contractSource, /timeline\?:/)
  assert.match(contractSource, /related_patterns\?:/)
})

test('graphiti materializer and read model use deterministic temporal reasoning helper', () => {
  assert.match(materializerSource, /buildGraphitiOpportunityReasoning/)
  assert.match(readModelSource, /buildGraphitiOpportunityReasoning/)
  assert.match(readModelSource, /temporal_reasoning/)
  assert.match(readModelSource, /findings/)
})

test('opportunity cards render temporal reasoning, graphiti findings, and temporal filter', () => {
  assert.match(clientSource, /Why now/)
  assert.match(clientSource, /Why it fits/)
  assert.match(clientSource, /Graphiti pattern/)
  assert.match(clientSource, /Recommended action/)
  assert.match(clientSource, /Graphiti findings/)
  assert.match(clientSource, /temporalStatusFilter/)
  assert.match(clientSource, /label: 'Temporal Status'/)
})

test('opportunity cards prefer concise Graphiti reasoning over raw dossier answer dumps', () => {
  assert.match(clientSource, /function conciseText/)
  assert.match(clientSource, /function conciseBlockText/)
  assert.match(clientSource, /function conciseList/)
  assert.match(clientSource, /function objectToText/)
  assert.match(clientSource, /function stripPlaceholderFragments/)
  assert.match(clientSource, /ypFitReasoning/)
  assert.match(clientSource, /findings\.slice\(0, 3\)/)
  assert.match(clientSource, /\[object Object\]/)
  assert.doesNotMatch(clientSource, /fitFeedback:\s*toText\(opp\.yellow_panther_fit_feedback\)/)
  assert.doesNotMatch(clientSource, /signalSummary:\s*\[/)
  assert.match(clientSource, /fitFeedback:\s*conciseBlockText\(opp\.yp_fit_reasoning/)
  assert.match(clientSource, /recommendedAction\s*=\s*conciseBlockText\(opp\.recommended_action/)
})

test('opportunities page does not show the canonical pipeline status panel', () => {
  assert.doesNotMatch(clientSource, /Canonical pipeline status/)
  assert.doesNotMatch(clientSource, /pipelineStatus/)
  assert.doesNotMatch(clientSource, /api\/home\/pipeline-status/)
})
