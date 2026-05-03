import assert from 'node:assert/strict'
import test from 'node:test'

import { buildDossierTabs } from '../src/lib/dossier-tabs.ts'

test('buildDossierTabs derives tabs from dossier payload sections', () => {
  const tabs = buildDossierTabs(
    {
      core_info: { name: 'Arsenal' },
      digital_transformation: {},
      strategic_analysis: {},
      implementation_roadmap: {},
      linkedin_connection_analysis: {},
      metadata: {}
    },
    { entityType: 'Club' }
  )

  assert.deepEqual(
    tabs.map((tab) => tab.value),
    [
      'overview',
      'digital-stack',
      'procurement-ecosystem',
      'decision-owners-pois',
      'evidence-sources',
    ]
  )
})
