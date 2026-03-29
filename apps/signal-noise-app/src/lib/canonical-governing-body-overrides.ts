import type { CanonicalEntity } from '@/lib/entity-canonicalization'

export const CANONICAL_GOVERNING_BODY_OVERRIDES: CanonicalEntity[] = [
  {
    id: 'override-korea-football-association',
    neo4j_id: 'override-korea-football-association',
    labels: ['Entity', 'Federation'],
    properties: {
      name: 'Korea Football Association',
      type: 'Federation',
      sport: 'Football',
      country: 'South Korea',
      website: 'https://www.kfa.or.kr/',
      source: 'curated_governing_body_override',
    },
  },
  {
    id: 'override-us-soccer-federation',
    neo4j_id: 'override-us-soccer-federation',
    labels: ['Entity', 'Federation'],
    properties: {
      name: 'U.S. Soccer Federation',
      type: 'Federation',
      sport: 'Football',
      country: 'United States',
      website: 'https://www.ussoccer.com/',
      source: 'curated_governing_body_override',
    },
  },
  {
    id: 'override-mexican-football-federation',
    neo4j_id: 'override-mexican-football-federation',
    labels: ['Entity', 'Federation'],
    properties: {
      name: 'Mexican Football Federation',
      type: 'Federation',
      sport: 'Football',
      country: 'Mexico',
      website: 'https://www.fmf.mx/',
      source: 'curated_governing_body_override',
    },
  },
  {
    id: 'override-usa-cricket',
    neo4j_id: 'override-usa-cricket',
    labels: ['Entity', 'Federation'],
    properties: {
      name: 'USA Cricket',
      type: 'Federation',
      sport: 'Cricket',
      country: 'United States',
      website: 'https://www.usacricket.org/',
      source: 'curated_governing_body_override',
    },
  },
  {
    id: 'override-usa-cycling',
    neo4j_id: 'override-usa-cycling',
    labels: ['Entity', 'Federation'],
    properties: {
      name: 'USA Cycling',
      type: 'Federation',
      sport: 'Cycling',
      country: 'United States',
      website: 'https://usacycling.org/',
      source: 'curated_governing_body_override',
    },
  },
]
