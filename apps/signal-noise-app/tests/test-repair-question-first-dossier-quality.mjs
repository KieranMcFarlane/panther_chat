import assert from 'node:assert/strict'
import test from 'node:test'

import { repairDossierPayload } from '../scripts/repair-question-first-dossier-quality.mjs'

test('repairDossierPayload removes object-string evidence artifacts and upgrades source-backed q2', () => {
  const repair = repairDossierPayload(
    {
      entity_id: 'bucks',
      entity_name: 'Milwaukee Bucks',
      entity_type: 'Club',
      publish_status: 'published_healthy',
      metadata: {
        question_first_checkpoint: {
          answer_records: [
            {
              question_id: 'q11_decision_owner',
              answer: { kind: 'list', summary: 'insufficient_signal' },
              validation_state: 'no_signal',
              confidence: 0,
              evidence_url: '[object Object]',
              display_answer: { evidence: [{ url: '[object Object]' }] },
              reasoning: { structured_output: { sources: ['[object Object]'] } },
            },
          ],
        },
      },
      question_first: {
        answers: [
          {
            question_id: 'q2_digital_stack',
            answer: {
              kind: 'summary',
              summary: 'No signal',
              raw_structured_output: {
                summary: 'Adobe and Tradable Bits are visible vendor hints on NBA.com.',
                sources: ['https://www.nba.com/bucks/?page_id=1066458'],
              },
            },
            checked_sources: [{ url: 'https://www.nba.com/bucks/?page_id=1066458' }],
            validation_state: 'checked_no_signal',
            confidence: 0,
          },
          {
            question_id: 'q11_decision_owner',
            answer: { kind: 'list', summary: 'insufficient_signal' },
            validation_state: 'no_signal',
            confidence: 0,
            evidence_url: '[object Object]',
            display_answer: { evidence: [{ url: '[object Object]' }] },
          },
        ],
      },
    },
    'bucks',
    { entity_name: 'Milwaukee Bucks', entity_type: 'Club' },
    { questions: ['q2_digital_stack', 'q11_decision_owner'] },
  )

  assert.equal(repair.changed, true)
  assert.doesNotMatch(JSON.stringify(repair.repaired_dossier), /\[object Object\]/)

  const answers = repair.repaired_dossier.question_first.answers
  const q2 = answers.find((answer) => answer.question_id === 'q2_digital_stack')
  assert.equal(q2.validation_state, 'provisional')
  assert.equal(q2.confidence, 0.65)
  assert.match(q2.answer.summary, /Adobe/)
  assert.match(q2.answer.summary, /Tradable Bits/)
  assert.equal(q2.evidence_url, 'https://www.nba.com/bucks/?page_id=1066458')
})
