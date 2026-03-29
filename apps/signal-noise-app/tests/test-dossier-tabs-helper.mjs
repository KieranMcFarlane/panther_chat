import assert from 'node:assert/strict'
import test from 'node:test'

import { buildDossierTabs } from '../src/lib/dossier-tabs.ts'
import { buildHumanContextDossier } from '../src/lib/human-context-dossier.ts'

test('buildDossierTabs derives tabs from dossier payload sections', () => {
  const dossier = {
    core_info: { name: 'Arsenal' },
    digital_transformation: { digital_maturity: 80 },
    strategic_analysis: { overall_assessment: 'Strong digital posture' },
    implementation_roadmap: { phase_1_engagement: { timeline: 'Weeks 1-4' } },
    linkedin_connection_analysis: { recommendations: { optimal_team_member: 'Stuart Cope' } },
    metadata: { confidence_score: 0.85 }
  }
  const humanContext = buildHumanContextDossier(dossier, {
    id: 'arsenal-fc',
    properties: { name: 'Arsenal', type: 'Club', country: 'England' }
  })

  const tabs = buildDossierTabs(
    dossier,
    humanContext,
    { entityType: 'Club' }
  )

  assert.deepEqual(
    tabs.map((tab) => tab.value),
    [
      'questions',
      'overview',
      'commercial-digital-context',
      'temporal-relational-context',
      'procurement',
      'digital-transformation',
      'strategic-analysis',
      'opportunities',
      'leadership',
      'connections',
      'implementation-roadmap',
      'contact',
      'outreach',
      'system'
    ]
  )
})
