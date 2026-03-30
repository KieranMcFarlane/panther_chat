import assert from 'node:assert/strict'
import { test } from 'node:test'

import { linkOpportunityToCanonicalEntity } from '../src/lib/opportunity-entity-linking.ts'

test('prefers Tennis Australia for ausopen.com curated opportunities', () => {
  const linked = linkOpportunityToCanonicalEntity(
    {
      organization: 'Tennis Australia',
      title: 'Tournament Digital Platform Overhaul',
      description:
        'Tennis Australia seeking technology partner for comprehensive digital platform overhaul for Australian Open.',
      source_url: 'https://www.ausopen.com/digital-transformation',
    },
    [
      {
        id: '2531',
        properties: { name: 'US Open (Tennis)', type: 'Sports Entity' },
      },
      {
        id: '9991',
        properties: { name: 'Tennis Australia', type: 'Organization' },
      },
    ],
  )

  assert.equal(linked.canonical_entity_id, '9991')
  assert.equal(linked.canonical_entity_name, 'Tennis Australia')
})

test('leaves ausopen.com opportunities unlinked when the preferred host entity is missing from the canonical snapshot', () => {
  const linked = linkOpportunityToCanonicalEntity(
    {
      organization: 'Tennis Australia',
      title: 'Tournament Digital Platform Overhaul',
      description:
        'Tennis Australia seeking technology partner for comprehensive digital platform overhaul for Australian Open.',
      source_url: 'https://www.ausopen.com/digital-transformation',
    },
    [
      {
        id: '2531',
        properties: { name: 'US Open (Tennis)', type: 'Sports Entity' },
      },
    ],
  )

  assert.equal(linked.canonical_entity_id, null)
  assert.equal(linked.canonical_entity_name, null)
})

test('prefers All England Lawn Tennis Association for wimbledon.com curated opportunities', () => {
  const linked = linkOpportunityToCanonicalEntity(
    {
      organization: 'All England Lawn Tennis Association',
      title: 'Digital Fan Experience Enhancement',
      description:
        'Wimbledon seeking digital agency to enhance fan experience while maintaining the tournament heritage.',
      source_url: 'https://www.wimbledon.com/digital-opportunities',
    },
    [
      {
        id: '3872',
        properties: { name: 'AFC Wimbledon', type: 'Club' },
      },
      {
        id: '9992',
        properties: { name: 'All England Lawn Tennis Association', type: 'Organization' },
      },
    ],
  )

  assert.equal(linked.canonical_entity_id, '9992')
  assert.equal(linked.canonical_entity_name, 'All England Lawn Tennis Association')
})

test('links French Football Federation alias when the canonical federation exists', () => {
  const linked = linkOpportunityToCanonicalEntity(
    {
      organization: 'French Football Federation (FFF)',
      title: 'Mobile Engagement & Digital Transformation',
      description:
        'FFF announces a federation-wide digital transformation programme for football supporters.',
      source_url: 'https://www.fff.fr/digital-transformation-rfp',
    },
    [
      {
        id: '2100',
        properties: { name: 'French Football Federation', type: 'Federation' },
      },
    ],
  )

  assert.equal(linked.canonical_entity_id, '2100')
  assert.equal(linked.canonical_entity_name, 'French Football Federation')
})

test('links French Football Federation alias even with noisy generic federation candidates present', () => {
  const linked = linkOpportunityToCanonicalEntity(
    {
      organization: 'French Football Federation (FFF)',
      title: 'Mobile Engagement & Digital Transformation',
      description:
        'FFF announces a federation-wide digital transformation programme for football supporters.',
      source_url: 'https://www.fff.fr/digital-transformation-rfp',
    },
    [
      {
        id: 'generic-federation',
        properties: { name: 'Federation', type: 'Sports Category' },
      },
      {
        id: 'generic-football',
        properties: { name: 'Football', type: 'Sport Category' },
      },
      {
        id: 'rugby-federation',
        properties: { name: 'French Rugby Federation', type: 'Federation' },
      },
      {
        id: '2100',
        properties: { name: 'French Football Federation', type: 'Federation' },
      },
    ],
  )

  assert.equal(linked.canonical_entity_id, '2100')
  assert.equal(linked.canonical_entity_name, 'French Football Federation')
})

test('leaves USA Cricket alias opportunities unlinked when the canonical entity is absent', () => {
  const linked = linkOpportunityToCanonicalEntity(
    {
      organization: 'USA Cricket',
      title: 'Cricket Development and Youth Programs Technology Platform',
      description:
        'USA Cricket is requesting proposals for a youth development technology platform.',
      source_url: 'https://www.usacricket.org/procurement/youth-development-platform-2025',
    },
    [
      {
        id: '4431',
        properties: { name: 'Cricket', type: 'Sports Entity' },
      },
    ],
  )

  assert.equal(linked.canonical_entity_id, null)
  assert.equal(linked.canonical_entity_name, null)
})

test('leaves athletics.ca governing-body opportunities unlinked when the canonical entity is absent', () => {
  const linked = linkOpportunityToCanonicalEntity(
    {
      organization: 'Athletics Canada',
      title: 'Canadian 10,000m Championships Hosting',
      description:
        'Athletics Canada is currently searching for a host for the Canadian 10,000m championships.',
      source_url: 'https://athletics.ca/wp-content/uploads/2024/09/bid-handbook.pdf',
    },
    [
      {
        id: '3389',
        properties: { name: 'EFL Championship', type: 'League' },
      },
    ],
  )

  assert.equal(linked.canonical_entity_id, null)
  assert.equal(linked.canonical_entity_name, null)
})

test('leaves bundesliga.com operator opportunities unlinked when German Football League is absent from the canonical snapshot', () => {
  const linked = linkOpportunityToCanonicalEntity(
    {
      organization: 'German Football League (DFL)',
      title: 'Fan Technology Innovation Platform',
      description:
        'Bundesliga seeking technology partners for innovative fan platform including mobile applications and content delivery.',
      source_url: 'https://www.bundesliga.com/fan-technology-rfp',
    },
    [
      {
        id: '558',
        properties: { name: '2. Bundesliga', type: 'League' },
      },
    ],
  )

  assert.equal(linked.canonical_entity_id, null)
  assert.equal(linked.canonical_entity_name, null)
})

test('leaves canadasoccer.com governing-body opportunities unlinked when Canada Soccer is absent from the canonical snapshot', () => {
  const linked = linkOpportunityToCanonicalEntity(
    {
      organization: 'Canada Soccer',
      title: 'Digital Modernization & Fan Platform Enhancement',
      description:
        'Canada Soccer seeking digital agency for modernization, fan engagement, and national team content systems.',
      source_url: 'https://www.canadasoccer.com/digital-modernization-rfp',
    },
    [
      {
        id: '4481',
        properties: { name: 'USA/Canada', type: 'Sports Entity' },
      },
    ],
  )

  assert.equal(linked.canonical_entity_id, null)
  assert.equal(linked.canonical_entity_name, null)
})

test('leaves nzrugby.co.nz operator opportunities unlinked when New Zealand Rugby is absent from the canonical snapshot', () => {
  const linked = linkOpportunityToCanonicalEntity(
    {
      organization: 'New Zealand Rugby',
      title: 'Digital Transformation & Fan Platform',
      description:
        'New Zealand Rugby seeking digital agency for transformation, fan engagement, and All Blacks community integration.',
      source_url: 'https://www.nzrugby.co.nz/digital-transformation-rfp',
    },
    [
      {
        id: '297fb435-e99f-4cfc-b9e8-d8e1287df642',
        properties: { name: 'All Blacks', type: 'Sports Entity' },
      },
    ],
  )

  assert.equal(linked.canonical_entity_id, null)
  assert.equal(linked.canonical_entity_name, null)
})

test('keeps Volleyball World opportunities unlinked when the only strong candidate is an unrelated club brand', () => {
  const linked = linkOpportunityToCanonicalEntity(
    {
      organization: 'Volleyball World',
      title: 'Digital Growth Partnership in China',
      description:
        'Volleyball World is seeking a digital growth partner in China to expand distribution, fan engagement, and commercial reach for volleyball properties.',
      source_url: 'https://en.volleyballworld.com/news/volleyball-world-teams-up-with-mailman-to-supercharge-growth-in-china',
    },
    [
      {
        id: '3378',
        properties: { name: 'CBA (China)', type: 'League' },
      },
    ],
  )

  assert.equal(linked.canonical_entity_id, null)
  assert.equal(linked.canonical_entity_name, null)
})

test('keeps Australian Sports Commission opportunities unlinked when the best lexical match is an unrelated club', () => {
  const linked = linkOpportunityToCanonicalEntity(
    {
      organization: 'Australian Sports Commission',
      title: 'Participation Growth Funding 2024-25 and Investment Announcements',
      description:
        'Australian Sports Commission funding initiative focused on national participation growth, investment programs, and strategic sports development.',
      source_url: 'https://www.ausport.gov.au/',
    },
    [
      {
        id: '1934',
        properties: { name: 'Sporting CP', type: 'Club' },
      },
    ],
  )

  assert.equal(linked.canonical_entity_id, null)
  assert.equal(linked.canonical_entity_name, null)
})

test('keeps government agency opportunities unlinked when the candidate is a sports league brand', () => {
  const linked = linkOpportunityToCanonicalEntity(
    {
      organization: 'Government of Odisha',
      title: 'World Athletics Continental Tour Event Management Agency',
      description:
        'Government of Odisha procurement for a World Athletics Continental Tour event management agency.',
      source_url: 'https://odisha.gov.in/',
    },
    [
      {
        id: '2503',
        properties: { name: 'WTA Tour', type: 'League' },
      },
    ],
  )

  assert.equal(linked.canonical_entity_id, null)
  assert.equal(linked.canonical_entity_name, null)
})

test('keeps government agency opportunities unlinked when an event brand is typed as organization', () => {
  const linked = linkOpportunityToCanonicalEntity(
    {
      organization: 'Government of Odisha',
      title: 'World Athletics Continental Tour Event Management Agency',
      description:
        'Government of Odisha procurement for a World Athletics Continental Tour event management agency.',
      source_url: 'https://odisha.gov.in/',
    },
    [
      {
        id: '2503',
        properties: { name: 'WTA Tour', type: 'Organization' },
      },
    ],
  )

  assert.equal(linked.canonical_entity_id, null)
  assert.equal(linked.canonical_entity_name, null)
})

test('keeps federation opportunities unlinked when the only candidate is an unrelated league', () => {
  const linked = linkOpportunityToCanonicalEntity(
    {
      organization: 'World Karate Federation (WKF)',
      title: 'Digital Platform and Championships Technology Services',
      description:
        'World Karate Federation procurement for platform and championships technology services.',
      source_url: 'https://www.wkf.net/procurement-and-tenders',
    },
    [
      {
        id: '3389',
        properties: { name: 'EFL Championship', type: 'League' },
      },
    ],
  )

  assert.equal(linked.canonical_entity_id, null)
  assert.equal(linked.canonical_entity_name, null)
})

test('keeps mismatched sport associations unlinked when source and candidate sports differ', () => {
  const linked = linkOpportunityToCanonicalEntity(
    {
      organization: 'Hong Kong Volleyball Association',
      title: 'VNL 2025 Press and Side Event Management Services',
      description:
        'Hong Kong Volleyball Association procurement for Volleyball Nations League side-event management services.',
      source_url:
        'https://www.vbahk.org.hk/items/media/Volleyball/2025/VNL2025/Tender/vnlhk2025tender_invitation_of_press_and_side_event_management_service.pdf',
    },
    [
      {
        id: '1565',
        properties: { name: 'Hong Kong Baseball Association', type: 'Association' },
      },
    ],
  )

  assert.equal(linked.canonical_entity_id, null)
  assert.equal(linked.canonical_entity_name, null)
})

test('keeps multi-token organizations unlinked when the candidate name is only a generic sport token', () => {
  const linked = linkOpportunityToCanonicalEntity(
    {
      organization: 'Hockey India',
      title: 'LED Perimeter Boards & Replay Screens for Hero Hockey India League 2026',
      description:
        'Hockey India procurement for LED perimeter boards and replay screens for league operations.',
      source_url:
        'https://hockey-india.b-cdn.net/media/uploads/2025/08/RFP-for-Engagement-of-Vendors-to-provide-LED-Perimeter-Boards-Replay-Screens-for-Hero-Hockey-India-League-Men-Women-2026-at-Chennai-Ranchi-and-Bhubaneswar.pdf',
    },
    [
      {
        id: '3525',
        properties: { name: 'Hockey', type: 'Sports Entity' },
      },
    ],
  )

  assert.equal(linked.canonical_entity_id, null)
  assert.equal(linked.canonical_entity_name, null)
})
