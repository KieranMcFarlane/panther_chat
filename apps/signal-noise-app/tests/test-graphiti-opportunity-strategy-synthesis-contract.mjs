import assert from 'node:assert/strict'
import test from 'node:test'
import { existsSync, readFileSync } from 'node:fs'

const synthesisPath = new URL('../src/lib/graphiti-opportunity-strategy-synthesis.mjs', import.meta.url)
const contractPath = new URL('../src/lib/graphiti-opportunity-contract.ts', import.meta.url)
const backfillRoutePath = new URL('../src/app/api/admin/graphiti/opportunities/backfill/route.ts', import.meta.url)
const readModelPath = new URL('../src/lib/graphiti-opportunity-read-model.ts', import.meta.url)
const diagnosticsPath = new URL('../src/app/api/opportunities/diagnostics/route.ts', import.meta.url)
const clientPath = new URL('../src/app/opportunities/opportunities-client.tsx', import.meta.url)

test('strategy synthesis module owns GLM prompt and strict brief schema', () => {
  assert.equal(existsSync(synthesisPath), true)
  const source = readFileSync(synthesisPath, 'utf8')

  assert.match(source, /GraphitiOpportunityStrategyBrief/)
  assert.match(source, /yp_bd_strategy_v1/)
  assert.match(source, /YELLOW-PANTHER-BUSINESS-PROFILE\.md/)
  assert.match(source, /sports mobile apps/)
  assert.match(source, /fan engagement/)
  assert.match(source, /digital transformation/)
  assert.match(source, /AI\/analytics/)
  assert.match(source, /backend\/API integrations/)
  assert.match(source, /£80K-£500K/)
  assert.match(source, /CEO\/MD\/CTO\/commercial\/marketing\/operations/)
  assert.match(source, /Team GB app/)
  assert.match(source, /Premier Padel/)
  assert.match(source, /LNB/)
  assert.match(source, /ISU/)
  assert.match(source, /FIBA 3x3/)
  assert.match(source, /Do not copy raw evidence into Yellow Panther angle/)
  assert.match(source, /Return one valid JSON object matching the schema/)
  assert.match(source, /ANTHROPIC_DEFAULT_OPUS_MODEL/)
  assert.match(source, /ANTHROPIC_DEFAULT_SONNET_MODEL/)
  assert.match(source, /GLM-5\.1/)
  assert.match(source, /ZAI_API_KEY/)
  assert.match(source, /ANTHROPIC_AUTH_TOKEN/)
  assert.match(source, /ANTHROPIC_API_KEY/)
  assert.match(source, /ANTHROPIC_BASE_URL/)
  assert.match(source, /GRAPHITI_STRATEGY_MODEL_TIMEOUT_MS/)
  assert.match(source, /AbortController/)
  assert.match(source, /strategy_model_timeout/)
  assert.match(source, /combinedCandidates/)
  assert.match(source, /combinedCandidates\.slice\(0, limit\)/)
  assert.match(source, /bd_strategy_status/)
  assert.match(source, /!== 'ready'/)
  assert.match(source, /failed_provider/)
  assert.match(source, /bd_strategy_failed_at/)
})

test('strategy brief validation rejects repetitive generic AI cards', async () => {
  const {
    validateStrategyBrief,
    normalizeStrategyBriefForDisplay,
  } = await import(synthesisPath)

  const bad = {
    schema_version: 'yp_bd_strategy_v1',
    generated_at: '2026-05-05T00:00:00.000Z',
    model: 'GLM-5.1',
    source_profile: 'YELLOW-PANTHER-BUSINESS-PROFILE.md',
    signal_title: 'Pyramids FC — digital product signal',
    signal_strength: 'High',
    verification_status: 'Needs verification',
    service_wedge: 'mobile_app',
    pursuit_recommendation: 'verify_now',
    decision_summary: 'A fresh signal exists.',
    what_happened: 'A fresh signal exists, but Graphiti has not seen enough reinforcement to call it a pattern.',
    why_it_matters_now: 'A fresh signal exists, but Graphiti has not seen enough reinforcement to call it a pattern.',
    yellow_panther_angle: 'Pyramids FC has launched the following: (1) Pyramids F.C News mobile app on Google Play providing club news, player info, transfers, match results, league standings and fixtures.',
    suggested_route: 'cold',
    next_move: 'Verify recency.',
    outreach_opener: 'Use this as a verification hypothesis.',
    verify_before_action: ['Verify recency'],
    disqualifiers: [],
    evidence_used: ['Pyramids FC has launched the following: (1) Pyramids F.C News mobile app on Google Play providing club news, player info, transfers, match results, league standings and fixtures.'],
    reasoning_notes: 'Copied evidence.',
  }

  const result = validateStrategyBrief(bad)
  assert.equal(result.valid, false)
  assert.match(result.reason, /repeats|route|copied/i)

  const display = normalizeStrategyBriefForDisplay(bad, result)
  assert.equal(display.pursuit_recommendation, 'needs_enrichment')
  assert.equal(display.service_wedge, 'no_clear_fit')
  assert.match(display.decision_summary, /Needs enrichment/i)
  assert.match(display.yellow_panther_angle, /No clear Yellow Panther angle/i)
})

test('football recruitment hiring signals can map to a Yellow Panther analytics wedge', async () => {
  const {
    buildGraphitiOpportunityStrategyPrompt,
    synthesizeGraphitiOpportunityStrategyBrief,
  } = await import(synthesisPath)
  const source = readFileSync(synthesisPath, 'utf8')

  assert.match(source, /Football recruitment-ops hiring signals/i)
  assert.match(source, /analytics_ai or consulting/i)

  const row = {
    entity_name: 'Doncaster Rovers',
    canonical_entity_name: 'Doncaster Rovers',
    title: 'Doncaster Rovers — Recruitment Analyst vacancy',
    summary: 'Doncaster Rovers appear to be hiring a Recruitment Analyst role.',
    why_it_matters: 'The role suggests current investment in recruitment operations and data-led player identification.',
    yellow_panther_fit: 80,
    evidence: [{
      source: 'https://example.com/doncaster-recruitment-analyst',
      snippet: 'Recruitment Analyst vacancy listed by Doncaster Rovers in April 2026.',
    }],
    raw_payload: {
      source: 'entity_dossiers',
      evidence_count: 3,
      answer_count: 7,
      commercial_qualification: {
        status: 'watch',
        yp_fit_breakdown: {
          capability_match: 'Recruitment intelligence, analytics, scouting workflows, and academy pathway decision support.',
          outreach_angle: 'Use the hiring signal as a verification wedge into football operations.',
          buyer_route: 'Shaun Lockwood',
        },
      },
    },
    supporting_signals: [
      'Recruitment Analyst hiring signal',
      'Data-led player identification and scouting workflow investment',
    ],
  }

  const prompt = buildGraphitiOpportunityStrategyPrompt({
    row,
    yellowPantherProfile: 'Yellow Panther builds analytics and AI products for sports organisations.',
  })
  assert.match(prompt, /recruitment intelligence/i)
  assert.match(prompt, /football operations/i)
  assert.match(prompt, /academy pathway/i)
  assert.match(prompt, /analytics_ai|consulting/)

  const { brief, validation } = await synthesizeGraphitiOpportunityStrategyBrief(
    row,
    'Yellow Panther builds analytics and AI products for sports organisations.',
    {
      env: { ZAI_API_KEY: 'test', ANTHROPIC_DEFAULT_SONNET_MODEL: 'GLM-5.1' },
      modelOutput: {
        schema_version: 'yp_bd_strategy_v1',
        generated_at: '2026-05-05T00:00:00.000Z',
        model: 'GLM-5.1',
        source_profile: 'YELLOW-PANTHER-BUSINESS-PROFILE.md',
        signal_title: 'Doncaster Rovers — Recruitment Analyst vacancy',
        signal_strength: 'High',
        verification_status: 'Needs verification',
        service_wedge: 'analytics_ai',
        pursuit_recommendation: 'verify_now',
        decision_summary: 'Recruitment analyst hiring is a credible verification wedge into football-ops analytics, but the buyer and live role status still need checking.',
        what_happened: 'Doncaster Rovers appear to be hiring for a Recruitment Analyst role, suggesting active investment in recruitment operations and data-led player identification.',
        why_it_matters_now: 'A live football-operations hire can indicate budget, urgency, or an operational gap around scouting workflows, player intelligence, and academy pathway planning.',
        yellow_panther_angle: 'Position Yellow Panther around practical recruitment intelligence: analytics tooling, scouting workflow support, market monitoring, and academy pathway decision support for football operations.',
        suggested_route: 'Shaun Lockwood as a possible commercial route; verify whether football operations or recruitment owns the buying decision.',
        next_move: 'Confirm the role is still live, identify the hiring owner, then use the vacancy as a soft verification-led outreach wedge.',
        outreach_opener: 'Noticed Doncaster are hiring around recruitment analysis; Yellow Panther helps clubs turn recruitment and market signals into practical decision support.',
        verify_before_action: ['Confirm role recency', 'Verify source quality', 'Identify whether recruitment, academy, or football operations owns the need'],
        disqualifiers: [],
        evidence_used: ['Recruitment Analyst vacancy listed by Doncaster Rovers in April 2026.'],
        reasoning_notes: 'Recruitment-ops hiring maps to Yellow Panther analytics and consulting if role recency and buyer ownership are confirmed.',
      },
    }
  )

  assert.equal(validation.valid, true)
  assert.equal(brief.service_wedge, 'analytics_ai')
  assert.equal(brief.pursuit_recommendation, 'verify_now')
  assert.match(brief.yellow_panther_angle, /recruitment intelligence/i)
  assert.doesNotMatch(brief.decision_summary, /No clear Yellow Panther angle/i)
})

test('opportunities surfaces prefer persisted strategy brief before deterministic fallback', () => {
  const contractSource = readFileSync(contractPath, 'utf8')
  const backfillSource = readFileSync(backfillRoutePath, 'utf8')
  const readModelSource = readFileSync(readModelPath, 'utf8')
  const diagnosticsSource = readFileSync(diagnosticsPath, 'utf8')
  const clientSource = readFileSync(clientPath, 'utf8')

  assert.match(contractSource, /export type GraphitiOpportunityStrategyBrief/)
  assert.match(contractSource, /strategy_brief\?: GraphitiOpportunityStrategyBrief/)
  assert.match(backfillSource, /synthesizeAndPersistGraphitiOpportunityStrategyBriefs/)
  assert.match(backfillSource, /strategy_synthesis/)
  assert.match(readModelSource, /rawPayload\.bd_strategy_brief/)
  assert.match(readModelSource, /strategy_brief/)
  assert.match(diagnosticsSource, /rawPayload\.bd_strategy_brief/)
  assert.match(diagnosticsSource, /bd_brief:\s*strategyBriefFor/)
  assert.match(clientSource, /strategyBriefForOpportunity/)
  assert.match(clientSource, /decision_summary/)
  assert.match(clientSource, /what_happened/)
  assert.match(clientSource, /why_it_matters_now/)
  assert.match(clientSource, /Outreach opener/)
  assert.doesNotMatch(clientSource, /Outreach hypothesis/)
})
