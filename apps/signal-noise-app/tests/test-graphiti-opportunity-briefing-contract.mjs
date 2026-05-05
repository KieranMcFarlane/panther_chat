import assert from 'node:assert/strict'
import test from 'node:test'
import { existsSync, readFileSync } from 'node:fs'

const briefingPath = new URL('../src/lib/graphiti-opportunity-briefing.ts', import.meta.url)
const clientSource = readFileSync(new URL('../src/app/opportunities/opportunities-client.tsx', import.meta.url), 'utf8')
const diagnosticsSource = readFileSync(new URL('../src/app/api/opportunities/diagnostics/route.ts', import.meta.url), 'utf8')
const contractSource = readFileSync(new URL('../src/lib/graphiti-opportunity-contract.ts', import.meta.url), 'utf8')

test('shared graphiti opportunity briefing normalizer owns BD analyst card copy', () => {
  assert.equal(existsSync(briefingPath), true)
  const source = readFileSync(briefingPath, 'utf8')

  assert.match(source, /export type GraphitiOpportunityBriefing/)
  assert.match(source, /export function buildGraphitiOpportunityBriefing/)
  assert.match(source, /signal_title/)
  assert.match(source, /signal_strength/)
  assert.match(source, /verification_status/)
  assert.match(source, /theme/)
  assert.match(source, /trigger/)
  assert.match(source, /why_it_matters/)
  assert.match(source, /yellow_panther_angle/)
  assert.match(source, /suggested_route/)
  assert.match(source, /next_move/)
  assert.match(source, /outreach_opener/)
  assert.match(source, /verify_before_action/)
  assert.match(source, /evidence_summary/)
  assert.match(source, /Doncaster Rovers/)
  assert.match(source, /Recruitment Analyst vacancy/)
  assert.match(source, /data-led recruitment intelligence/)
  assert.doesNotMatch(source, /Why this is an opportunity/)
  assert.doesNotMatch(source, /Suggested action/)
})

test('opportunities surfaces consume the shared briefing normalizer', () => {
  assert.match(contractSource, /briefing\?: GraphitiOpportunityBriefing/)
  assert.match(clientSource, /buildGraphitiOpportunityBriefing/)
  assert.match(clientSource, /opportunity\.briefing/)
  assert.match(diagnosticsSource, /buildGraphitiOpportunityBriefing/)
  assert.match(diagnosticsSource, /bd_brief: strategyBriefFor/)
})

test('fallback briefing suppresses repeated Graphiti reinforcement boilerplate', async () => {
  const { buildGraphitiOpportunityBriefing } = await import(briefingPath)
  const noisyReason = 'A fresh signal exists, but Graphiti has not seen enough reinforcement to call it a pattern.'
  const briefing = buildGraphitiOpportunityBriefing({
    organization: 'Atlanta Braves',
    title: 'Atlanta Braves — digital product signal',
    summary: "The Atlanta Braves' dominant strategic theme is the launch of BravesVision, their new team-owned television network for the 2026 season.",
    why_it_matters: noisyReason,
    yellow_panther_fit: 92,
    confidence: 70,
    temporal_reasoning: {
      status: 'emerging',
      reason: noisyReason,
    },
    raw_payload: {
      commercial_qualification: {
        status: 'watch',
        blockers: ['Weak or indirect buying trigger'],
        yp_fit_breakdown: {
          capability_match: 'fan engagement, sports media platform integration, and digital product strategy',
          buyer_route: 'cold',
        },
      },
    },
  })

  assert.notEqual(briefing.trigger, noisyReason)
  assert.notEqual(briefing.why_it_matters, noisyReason)
  assert.notEqual(briefing.trigger, briefing.why_it_matters)
  assert.match(briefing.why_it_matters, /verify|validation|buyer|commercial|outreach/i)
})
