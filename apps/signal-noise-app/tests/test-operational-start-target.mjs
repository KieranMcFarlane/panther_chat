import test from 'node:test'
import assert from 'node:assert/strict'

import { resolvePipelineStartTarget } from '../src/lib/operational-start-target.ts'

test('start prefers the selected completed entity and queues its next repair question', () => {
  const target = resolvePipelineStartTarget({
    activeSection: 'completed',
    drilldown: {
      queue: {
        in_progress_entity: null,
        resume_needed_entities: [],
        completed_entities: [
          {
            entity_id: 'fc-porto-2027',
            entity_name: 'FC Porto',
            entity_type: 'club',
            next_repair_question_id: 'q11_decision_owner',
            current_question_id: null,
            active_question_id: null,
            summary: 'Published degraded',
            run_phase: 'completed',
          },
        ],
        upcoming_entities: [],
      },
    },
  })

  assert.equal(target?.entityId, 'fc-porto-2027')
  assert.equal(target?.questionId, 'q11_decision_owner')
  assert.equal(target?.mode, 'question')
})

test('start falls back to an entity run when no question is available', () => {
  const target = resolvePipelineStartTarget({
    activeSection: 'entities',
    drilldown: {
      queue: {
        in_progress_entity: null,
        resume_needed_entities: [],
        completed_entities: [],
        upcoming_entities: [
          {
            entity_id: 'fifa',
            entity_name: 'FIFA',
            entity_type: 'federation',
            summary: 'Waiting in the serialized live loop',
            run_phase: 'queued',
          },
        ],
      },
    },
  })

  assert.equal(target?.entityId, 'fifa')
  assert.equal(target?.questionId, null)
  assert.equal(target?.mode, 'full')
})

test('start falls back to the latest completed entity when the running section is empty', () => {
  const target = resolvePipelineStartTarget({
    activeSection: 'running',
    drilldown: {
      queue: {
        in_progress_entity: null,
        resume_needed_entities: [],
        completed_entities: [
          {
            entity_id: 'fc-porto-2027',
            entity_name: 'FC Porto',
            entity_type: 'club',
            next_repair_question_id: 'q11_decision_owner',
            current_question_id: null,
            active_question_id: null,
            summary: 'Published degraded',
            run_phase: 'completed',
          },
        ],
        upcoming_entities: [
          {
            entity_id: 'fifa',
            entity_name: 'FIFA',
            entity_type: 'federation',
            summary: 'Waiting in the serialized live loop',
            run_phase: 'queued',
          },
        ],
      },
    },
  })

  assert.equal(target?.entityId, 'fc-porto-2027')
  assert.equal(target?.questionId, 'q11_decision_owner')
  assert.equal(target?.mode, 'question')
})
