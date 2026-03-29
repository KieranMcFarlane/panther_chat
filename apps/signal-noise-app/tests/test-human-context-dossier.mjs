import assert from 'node:assert/strict'
import test from 'node:test'

import { buildHumanContextDossier } from '../src/lib/human-context-dossier.ts'

test('buildHumanContextDossier derives human-facing sections from persisted dossier data', () => {
  const dossier = {
    core_info: {
      name: 'Arsenal',
      type: 'Club',
      hq: 'London, England',
      website: 'https://www.arsenal.com',
    },
    digital_transformation: {
      digital_maturity: 68,
      transformation_score: 76,
      strategic_opportunities: ['AI-driven supporter journeys'],
    },
    strategic_analysis: {
      overall_assessment: 'Arsenal presents significant partnership opportunities with strong digital transformation potential and market position.',
      recommended_approach: 'Start with a proof of concept in fan intelligence, then expand into commercial activation.',
      opportunity_scoring: {
        immediate_launch: [
          { opportunity: 'AI-Powered Fan Engagement Platform', score: 76 },
        ],
      },
    },
    linkedin_connection_analysis: {
      recommendations: {
        optimal_team_member: 'Stuart Cope (Primary Contact)',
        recommended_approach: 'Lead with a performance plus commercial innovation narrative.',
        success_probability: '70%',
      },
      tier_1_analysis: {
        introduction_paths: [
          { introduction_strategy: 'Warm intro via sports technology network' },
        ],
      },
    },
    metadata: {
      information_freshness: 'Current as of 2025-11-17',
      confidence_score: 0.85,
    },
  }

  const entity = {
    id: 'arsenal-fc',
    properties: {
      name: 'Arsenal',
      type: 'Club',
      country: 'England',
    },
  }

  const humanContext = buildHumanContextDossier(dossier, entity)

  assert.equal(humanContext.entity_name, 'Arsenal')
  assert.equal(humanContext.sections.overview.status, 'filled')
  assert.match(humanContext.sections.overview.content.who_they_are, /Arsenal/i)
  assert.equal(humanContext.sections.commercial_digital_context.status, 'filled')
  assert.equal(humanContext.sections.leadership_decision_shape.status, 'filled')
  assert.equal(humanContext.sections.opportunity_narrative.status, 'filled')
  assert.equal(humanContext.sections.relationship_access.status, 'filled')
  assert.equal(humanContext.sections.temporal_relational_context.status, 'filled')
  assert.equal(humanContext.sections.recommended_approach.status, 'filled')
  assert.equal(
    humanContext.sections.overview.content.why_they_matter,
    'Arsenal matters because the current dossier already points to AI-Powered Fan Engagement Platform as the cleanest Yellow Panther angle.',
  )
  assert.equal(
    humanContext.sections.opportunity_narrative.content.yellow_panther_angle,
    'Yellow Panther can frame AI-Powered Fan Engagement Platform as a pilotable, revenue-adjacent initiative.',
  )
  assert.equal(
    humanContext.sections.recommended_approach.content.approach_strategy,
    'Lead with a proof of value in fan intelligence, then expand into commercial activation.',
  )
  assert.equal(
    humanContext.sections.relationship_access.content.best_entry_route,
    'Warm intro via sports technology network',
  )
  assert.match(
    humanContext.sections.temporal_relational_context.content.freshness_summary,
    /2025-11-17/,
  )
  assert.match(
    humanContext.sections.temporal_relational_context.content.relationship_summary,
    /connections found|paths/i,
  )
})
