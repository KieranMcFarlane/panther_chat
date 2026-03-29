import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveBadgeDisplayState } from '../src/lib/badge-display-state.ts'

test('badge display state uses explicit entity badge metadata without lookup', () => {
  const state = resolveBadgeDisplayState({
    id: '1',
    properties: {
      name: 'Arsenal FC',
      badge_s3_url: '/badges/arsenal-fc-badge.png',
      badge_lookup_complete: true,
      badge_path: '/badges/arsenal-fc-badge.png'
    }
  })

  assert.equal(state.explicitBadgeUrl, '/badges/arsenal-fc-badge.png')
  assert.equal(state.shouldLookupBadge, false)
  assert.equal(state.isLookupComplete, true)
  assert.equal(state.initialLoading, false)
})

test('badge display state requests lookup when metadata is missing', () => {
  const state = resolveBadgeDisplayState({
    id: '2',
    properties: {
      name: 'Unknown Entity'
    }
  })

  assert.equal(state.explicitBadgeUrl, null)
  assert.equal(state.shouldLookupBadge, true)
  assert.equal(state.isLookupComplete, false)
  assert.equal(state.initialLoading, true)
})
