export type ClientSmokeConfigItem = {
  entity_uuid: string
  display_name: string
  aliases?: string[]
  purpose: string
  smoke_note: string
  account_priority?: number
}

export const PINNED_CLIENT_SMOKE_SET: ClientSmokeConfigItem[] = [
  {
    entity_uuid: 'b11d37c8-ece8-56d2-aa6e-757d0b8add7b',
    display_name: 'Arsenal',
    aliases: ['Arsenal Football Club'],
    purpose: 'Happy-path club dossier',
    smoke_note: 'Use this to prove the dossier page, persistence, and phase rail on a strong entity.',
    account_priority: 100,
  },
  {
    entity_uuid: 'fb43fc6d-5eb8-5826-8eab-06e75e44489f',
    display_name: 'Coventry City',
    purpose: 'Repeat club run',
    smoke_note: 'Use this to confirm the browser-to-dossier journey is repeatable across clubs.',
    account_priority: 90,
  },
  {
    entity_uuid: 'fedd8440-4082-5ce4-b07a-2d662a4c200e',
    display_name: 'Zimbabwe Cricket',
    purpose: 'Persisted question-first dossier',
    smoke_note: 'Use this to verify the persisted dossier is visible immediately on the page.',
    account_priority: 85,
  },
  {
    entity_uuid: '1db6d6eb-89c5-5c9f-95cb-217d0985a176',
    display_name: 'Major League Cricket',
    aliases: ['Major League Cricket (MLC)'],
    purpose: 'Procurement signal check',
    smoke_note: 'Use this to exercise procurement signals and sparse-signal handling without breaking UX.',
    account_priority: 95,
  },
  {
    entity_uuid: 'a01fa763-6170-5f62-912b-cedd1363a804',
    display_name: 'Zimbabwe Handball Federation',
    purpose: 'Federation dossier path',
    smoke_note: 'Use this to confirm the federation dossier path and operator review controls.',
    account_priority: 70,
  },
]
