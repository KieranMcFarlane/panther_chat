export type RolloutProofQualityState = 'client_ready' | 'complete' | 'blocked' | 'partial'
export type RolloutProofRole = 'validation' | 'regression'

export type RolloutProofSetItem = {
  entity_uuid: string
  display_name: string
  aliases?: string[]
  expected_quality_state: RolloutProofQualityState
  expected_question_count: number
  role: RolloutProofRole
  purpose: string
  smoke_note: string
  account_priority?: number
}

export const ROLLOUT_PROOF_SET: RolloutProofSetItem[] = [
  {
    entity_uuid: 'b11d37c8-ece8-56d2-aa6e-757d0b8add7b',
    display_name: 'Arsenal Football Club',
    aliases: ['Arsenal'],
    expected_quality_state: 'client_ready',
    expected_question_count: 15,
    role: 'validation',
    purpose: 'Happy-path club dossier',
    smoke_note: 'Use this to prove the dossier page, persistence, and phase rail on a strong client-ready entity.',
    account_priority: 100,
  },
  {
    entity_uuid: 'fb43fc6d-5eb8-5826-8eab-06e75e44489f',
    display_name: 'Coventry City',
    expected_quality_state: 'blocked',
    expected_question_count: 15,
    role: 'validation',
    purpose: 'Full-pack blocked club dossier',
    smoke_note: 'Use this to verify a 15-question club dossier that persists cleanly but remains blocked by downstream quality gates.',
    account_priority: 95,
  },
  {
    entity_uuid: 'fedd8440-4082-5ce4-b07a-2d662a4c200e',
    display_name: 'Zimbabwe Cricket',
    expected_quality_state: 'blocked',
    expected_question_count: 15,
    role: 'validation',
    purpose: 'Full-pack blocked federation dossier',
    smoke_note: 'Use this to verify a 15-question federation dossier that persists cleanly through the canonical browser route but remains blocked by downstream quality gates.',
    account_priority: 90,
  },
]

export const VALIDATION_ROLLOUT_PROOF_SET = ROLLOUT_PROOF_SET.filter((item) => item.role === 'validation')
export const REGRESSION_ROLLOUT_PROOF_SET = ROLLOUT_PROOF_SET.filter((item) => item.role === 'regression')
