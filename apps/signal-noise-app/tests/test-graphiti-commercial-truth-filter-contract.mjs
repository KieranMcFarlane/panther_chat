import assert from 'node:assert/strict'
import test from 'node:test'

const filterPath = new URL('../src/lib/graphiti-commercial-truth-filter.mjs', import.meta.url)

function row({
  entity = 'Test Entity',
  title = 'Test signal',
  fit = 80,
  status = 'watch',
  temporal = 'emerging',
  quality = 'complete',
  evidence = 5,
  useful = 8,
  text = '',
  strategy = {},
  blockers = [],
  active = false,
} = {}) {
  return {
    entity_name: entity,
    canonical_entity_name: entity,
    title,
    summary: text,
    why_it_matters: text,
    read_more_context: text,
    yellow_panther_fit: fit,
    is_active: active,
    raw_payload: {
      source: 'entity_dossiers',
      source_ledger_id: 'ledger-1',
      quality_state: quality,
      answer_count: useful,
      evidence_count: evidence,
      quality_metrics: {
        useful_fact_count: useful,
        evidence_url_count: evidence,
      },
      temporal_reasoning: { status: temporal },
      shortlist_opportunity: active,
      commercial_qualification: {
        status,
        blockers,
        buying_triggers: status === 'active' ? [{ text: 'App launched in March 2026' }] : [],
      },
      bd_strategy_brief: Object.keys(strategy).length > 0 ? {
        schema_version: 'yp_bd_strategy_v1',
        signal_title: title,
        decision_summary: strategy.summary || 'Specific commercial hypothesis.',
        what_happened: strategy.what || 'A current sports digital signal exists.',
        why_it_matters_now: strategy.why || 'It creates a plausible commercial wedge.',
        yellow_panther_angle: strategy.angle || 'Yellow Panther can support fan engagement and backend integration.',
        suggested_route: strategy.route || 'Digital or commercial owner likely; verify named buyer.',
        outreach_opener: strategy.opener || 'Congratulations on the launch. We help sports organisations improve connected digital platforms.',
        pursuit_recommendation: strategy.recommendation || 'verify_now',
        service_wedge: strategy.wedge || 'fan_engagement',
        verify_before_action: ['Confirm buyer owner'],
        evidence_used: ['Source evidence'],
        disqualifiers: strategy.disqualifiers || [],
      } : undefined,
    },
  }
}

test('commercial truth filter demotes polluted and broken rows out of watch', async () => {
  const { classifyGraphitiCommercialState } = await import(filterPath)

  const cases = [
    row({ entity: 'Super Lig', title: 'Eswatini national digital platform rollout', text: 'Eswatini government launched civic platforms.' }),
    row({ entity: 'Uno-X Mobility', title: 'Somalia National Capability Gaps (Misaligned Entity)', text: 'Somalia national capability gaps in military and judiciary.' }),
    row({ entity: 'PSL', title: 'PSL procurement signal', text: 'Search results for PSL RFP tender procurement return Preferred Supplier Lists as a procurement concept.' }),
    row({ entity: 'Athletico Paranaense', title: 'Athletico procurement signal', text: 'kind: summary' }),
    row({ entity: 'David Gale', title: 'David Gale hiring signal', quality: 'empty', text: 'Blocked by upstream question state: q2_digital_stack, q4_performance.' }),
    row({ entity: 'Azerbaijan Ice Hockey Federation', title: 'Azerbaijan digital product signal', text: 'No evidence of any launched products, apps, platforms, or fan experiences.' }),
  ]

  for (const input of cases) {
    const result = classifyGraphitiCommercialState(input)
    assert.equal(result.commercial_state, 'data_issue', `${input.entity_name} should be data_issue`)
    assert.equal(result.commercial_confidence, 'Low')
  }
})

test('commercial truth filter moves broad non-sports civic context to context only', async () => {
  const { classifyGraphitiCommercialState } = await import(filterPath)

  for (const entity of ['Bangladesh', 'Tamil Nadu', 'Nepal', 'Gauteng', 'South Sudan']) {
    const result = classifyGraphitiCommercialState(row({
      entity,
      title: `${entity} national digital platform expansion`,
      text: `${entity} government launched national civic digital platforms and policy programmes.`,
      fit: 90,
    }))
    assert.equal(result.commercial_state, 'context_only', `${entity} should be context_only`)
    assert.equal(result.commercial_confidence, 'Low')
  }
})

test('commercial truth filter keeps clean sports digital hypotheses in watch or verify now', async () => {
  const { classifyGraphitiCommercialState } = await import(filterPath)

  const atlanta = classifyGraphitiCommercialState(row({
    entity: 'Atlanta Braves',
    title: 'Atlanta Braves BravesVision DTC Network Launch',
    fit: 92,
    text: 'Atlanta Braves are launching BravesVision, a team-owned television network for the 2026 season.',
    strategy: {
      angle: 'Digital transformation wedge: companion fan engagement platforms, mobile apps, and backend/API integrations for BravesVision.',
      route: 'Buyer route unverified; likely digital, media, or commercial owner.',
      recommendation: 'needs_enrichment',
    },
  }))
  assert.equal(['watch', 'verify_now'].includes(atlanta.commercial_state), true)
  assert.notEqual(atlanta.commercial_state, 'data_issue')

  const pyramids = classifyGraphitiCommercialState(row({
    entity: 'Pyramids FC',
    title: 'Pyramids FC building digital fan engagement stack',
    fit: 100,
    text: 'Pyramids FC launched a Google Play news app and responsive website.',
    strategy: {
      angle: 'Fan engagement platform play: upgrade the basic news app with matchday, loyalty, and content personalization.',
      route: 'Buyer route unverified; likely digital or commercial owner.',
      recommendation: 'needs_enrichment',
    },
  }))
  assert.equal(['watch', 'verify_now'].includes(pyramids.commercial_state), true)
})

test('commercial truth filter does not let legacy formatter leaks override valid strategy briefs', async () => {
  const { classifyGraphitiCommercialState } = await import(filterPath)

  const result = classifyGraphitiCommercialState(row({
    entity: 'Canadian Rugby Union',
    title: 'Rugby Canada RUGBYCAN App Launch and Digital Transformation Push',
    status: 'active',
    temporal: 'active',
    fit: 92,
    useful: 28,
    evidence: 41,
    text: 'kind: summary · raw structured answer leaked from deterministic formatter',
    strategy: {
      angle: 'YP can offer digital transformation and backend integration services to unify the app, welfare system, and streaming experience.',
      route: 'Buyer route unverified',
      opener: 'Congratulations on the RUGBYCAN app launch.',
      recommendation: 'verify_now',
    },
  }))

  assert.equal(result.commercial_state, 'verify_now')
})

test('commercial truth filter keeps generic fallback BD phrasing out of verify now', async () => {
  const { classifyGraphitiCommercialState } = await import(filterPath)

  const result = classifyGraphitiCommercialState({
    ...row({
      entity: 'Graham Coughlan',
      title: 'Graham Coughlan — funding signal',
      fit: 90,
      useful: 16,
      evidence: 8,
      text: 'Lower-tier managerial context with no current sports technology buyer.',
    }),
    raw_payload: {
      ...row().raw_payload,
      quality_metrics: { useful_fact_count: 16, evidence_url_count: 8 },
      temporal_reasoning: { status: 'emerging' },
      commercial_qualification: { status: 'watch', buying_triggers: [] },
      yp_fit_reasoning: 'Lead with the digital buying trigger and validate the practical route to value.',
    },
  })

  assert.equal(result.commercial_state, 'watch')
})

test('commercial truth filter moves sparse generic materialized cards to data issues', async () => {
  const { classifyGraphitiCommercialState } = await import(filterPath)

  const result = classifyGraphitiCommercialState(row({
    entity: '4643b17e-24fa-4340-9665-ff46478e7b4e',
    title: '4643b17e-24fa-4340-9665-ff46478e7b4e has a dossier-backed opportunity signal',
    quality: 'empty',
    fit: 10,
    useful: 0,
    evidence: 1,
    text: 'Materialized commercial signal needs review.',
  }))

  assert.equal(result.commercial_state, 'data_issue')
})

test('commercial truth filter requires usable opener and route for outreach ready', async () => {
  const { classifyGraphitiCommercialState } = await import(filterPath)

  const doncaster = classifyGraphitiCommercialState(row({
    entity: 'Doncaster Rovers',
    title: 'Doncaster Rovers Recruitment Analyst vacancy',
    status: 'active',
    temporal: 'active',
    active: true,
    text: 'Recruitment Analyst vacancy posted on 17 April 2026.',
    strategy: {
      angle: 'Yellow Panther can support scouting workflow design, market monitoring, and recruitment data infrastructure.',
      route: 'Shaun Lockwood is a possible route, but football operations buyer ownership is unverified.',
      opener: 'Noticed Doncaster are strengthening recruitment analysis. We help clubs turn recruitment and market data into decision support.',
      recommendation: 'verify_now',
    },
  }))
  assert.equal(doncaster.commercial_state, 'verify_now')

  const ready = classifyGraphitiCommercialState(row({
    entity: 'Example Rugby',
    title: 'Example Rugby app launch',
    status: 'active',
    temporal: 'active',
    active: true,
    text: 'Example Rugby launched a member app in March 2026.',
    strategy: {
      angle: 'Yellow Panther can support fan engagement, data architecture, and backend platform integration.',
      route: 'Jane Smith, Chief Digital Officer.',
      opener: 'Congratulations on the app launch. We help federations connect fan, member, and data platforms after launch.',
      recommendation: 'outreach_ready',
    },
  }))
  assert.equal(ready.commercial_state, 'outreach_ready')
  assert.equal(ready.commercial_confidence, 'High')
})
