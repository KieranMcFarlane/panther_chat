import assert from 'node:assert/strict'
import test from 'node:test'

import { applyLiveTabStatus } from '../src/lib/dossier-live-tab-status.ts'

test('applyLiveTabStatus upgrades tab statuses from live phase progress', () => {
  const tabs = [
    { value: 'questions', label: 'Questions', description: '', hasData: true, status: 'filled' },
    { value: 'overview', label: 'Overview', description: '', hasData: true, status: 'filled' },
    { value: 'procurement', label: 'Procurement', description: '', hasData: false, status: 'missing' },
    { value: 'outreach', label: 'Outreach', description: '', hasData: false, status: 'missing' },
    { value: 'system', label: 'System', description: '', hasData: false, status: 'missing' },
  ]

  const liveTabs = applyLiveTabStatus(tabs, [
    {
      type: 'dossier_phase_update',
      timestamp: '2026-03-28T10:00:00Z',
      priority: 'HIGH',
      data: {
        phaseIndex: 3,
      },
    },
  ])

  assert.equal(liveTabs.find((tab) => tab.value === 'procurement')?.status, 'partial')
  assert.equal(liveTabs.find((tab) => tab.value === 'outreach')?.status, 'partial')
  assert.equal(liveTabs.find((tab) => tab.value === 'system')?.status, 'missing')
})

test('applyLiveTabStatus marks all tabs filled after writeback/publish completion', () => {
  const tabs = [
    { value: 'questions', label: 'Questions', description: '', hasData: true, status: 'filled' },
    { value: 'overview', label: 'Overview', description: '', hasData: true, status: 'filled' },
    { value: 'system', label: 'System', description: '', hasData: false, status: 'missing' },
  ]

  const liveTabs = applyLiveTabStatus(tabs, [
    {
      type: 'graph_update',
      timestamp: '2026-03-28T10:01:00Z',
      priority: 'HIGH',
      data: {
        phaseIndex: 5,
        stage: 'completed',
      },
    },
  ])

  assert.equal(liveTabs.find((tab) => tab.value === 'system')?.status, 'filled')
})

test('applyLiveTabStatus uses section statuses from live writeback events', () => {
  const tabs = [
    { value: 'questions', label: 'Questions', description: '', hasData: true, status: 'filled' },
    { value: 'overview', label: 'Overview', description: '', hasData: true, status: 'filled' },
    { value: 'leadership', label: 'Leadership', description: '', hasData: false, status: 'missing' },
    { value: 'system', label: 'System', description: '', hasData: false, status: 'missing' },
  ]

  const liveTabs = applyLiveTabStatus(tabs, [
    {
      type: 'dossier_section_update',
      timestamp: '2026-03-28T10:02:00Z',
      priority: 'HIGH',
      data: {
        phaseIndex: 3,
        sectionStatuses: {
          leadership: 'filled',
        },
      },
    },
  ])

  assert.equal(liveTabs.find((tab) => tab.value === 'leadership')?.status, 'filled')
  assert.equal(liveTabs.find((tab) => tab.value === 'system')?.status, 'missing')
})
