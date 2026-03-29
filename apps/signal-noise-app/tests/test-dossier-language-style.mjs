import assert from 'node:assert/strict'
import test from 'node:test'

import { buildFallbackDossierNarrative, buildFallbackConnectionGuidance } from '../src/lib/dossier-language.ts'

test('buildFallbackDossierNarrative keeps fallback club language concise and evidence-led', () => {
  const narrative = buildFallbackDossierNarrative('Arsenal', 'Club', 'fan intelligence', 'commercial and innovation')

  assert.match(narrative.overallAssessment, /transition from prudence to investment/i)
  assert.match(narrative.yellowPantherOpportunity, /fan intelligence/i)
  assert.match(narrative.recommendedApproach, /^Lead with a proof of value/i)
})

test('buildFallbackConnectionGuidance uses a direct warm-path recommendation', () => {
  const guidance = buildFallbackConnectionGuidance('Arsenal')

  assert.match(guidance, /commercial or innovation team/i)
  assert.match(guidance, /warm partner path/i)
})
