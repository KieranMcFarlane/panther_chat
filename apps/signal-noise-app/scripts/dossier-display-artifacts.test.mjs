#!/usr/bin/env node

import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildRecommendedApproachText,
  buildYellowPantherOpportunityText,
} from '../src/lib/dossier-display-artifacts.ts'

test('buildYellowPantherOpportunityText prefers available q14 fit artifact', () => {
  const dossier = {
    question_first: {
      discovery_summary: {
        yellow_panther_fit: {
          status: 'available',
          best_service: 'DIGITAL_TRANSFORMATION',
          fit_rationale: 'Platform and sponsorship analytics evidence points to a digital transformation opportunity.',
        },
      },
    },
  }

  assert.equal(
    buildYellowPantherOpportunityText(dossier, 'N/A'),
    'DIGITAL TRANSFORMATION: Platform and sponsorship analytics evidence points to a digital transformation opportunity.',
  )
})

test('buildRecommendedApproachText surfaces insufficient outreach state before generic fallback', () => {
  const dossier = {
    question_first: {
      discovery_summary: {
        recommended_approach: 'Generic league context should not be treated as outreach.',
        outreach_strategy: {
          status: 'insufficient_signal',
          verification_needed: 'Need a verified buyer route before outreach.',
        },
      },
    },
  }

  assert.equal(
    buildRecommendedApproachText(dossier, 'Fallback approach'),
    'Need a verified buyer route before outreach.',
  )
})
