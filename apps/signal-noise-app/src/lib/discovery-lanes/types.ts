export type DiscoveryLane = 'scout' | 'enrichment';

export type DiscoveryFreshness = 'fresh' | 'warm' | 'stale';

export type ValidationState = 'pending' | 'validated' | 'rejected' | 'needs-review';

export interface ScoutLead {
  id: string;
  lane: DiscoveryLane;
  state: 'candidate' | 'accepted' | 'rejected' | 'archived';
  source: string;
  source_urls: string[];
  source_url?: string;
  title: string;
  summary: string;
  confidence: number;
  freshness: DiscoveryFreshness;
  validation_state: ValidationState;
  follow_up_query: string;
  entity_name?: string;
  entity_type?: string;
  country?: string;
  tags: string[];
  captured_at: string;
}

export interface EnrichmentContact {
  name: string;
  title?: string;
  role?: string;
  linkedin_url?: string;
  company_name?: string;
  city?: string;
  country?: string;
  confidence?: number;
}

export interface EnrichmentCompany {
  name: string;
  domain?: string;
  industry?: string;
  employee_count?: number;
  revenue_range?: string;
  funding_summary?: string;
  city?: string;
  country?: string;
  technologies?: string[];
}

export interface EnrichmentResult {
  id: string;
  lane: DiscoveryLane;
  state: 'enriched' | 'needs-review' | 'rejected';
  validation_state: ValidationState;
  source_urls: string[];
  company: EnrichmentCompany;
  contacts: EnrichmentContact[];
  decision_makers: string[];
  summary: string;
  confidence: number;
  freshness: DiscoveryFreshness;
  captured_at: string;
}

function toSourceUrls(input: Record<string, any>): string[] {
  const urls = new Set<string>();

  if (typeof input.source_url === 'string' && input.source_url.trim()) {
    urls.add(input.source_url.trim());
  }

  if (Array.isArray(input.source_urls)) {
    for (const url of input.source_urls) {
      if (typeof url === 'string' && url.trim()) {
        urls.add(url.trim());
      }
    }
  }

  return Array.from(urls);
}

function nowIso(): string {
  return new Date().toISOString();
}

export function normalizeScoutLead(input: Record<string, any>): ScoutLead {
  const sourceUrls = toSourceUrls(input);

  return {
    id: String(input.id ?? input.lead_id ?? input.source_url ?? input.title ?? `scout-${Date.now()}`),
    lane: 'scout',
    state: input.state === 'accepted' || input.state === 'rejected' || input.state === 'archived'
      ? input.state
      : 'candidate',
    source: String(input.source ?? 'unknown'),
    source_urls: sourceUrls,
    source_url: typeof input.source_url === 'string' ? input.source_url : sourceUrls[0],
    title: String(input.title ?? input.entity_name ?? 'Untitled lead'),
    summary: String(input.summary ?? input.notes ?? ''),
    confidence: typeof input.confidence === 'number' ? input.confidence : 0.5,
    freshness: input.freshness === 'warm' || input.freshness === 'stale' ? input.freshness : 'fresh',
    validation_state: input.validation_state === 'validated' || input.validation_state === 'rejected' || input.validation_state === 'needs-review'
      ? input.validation_state
      : 'pending',
    follow_up_query: String(input.follow_up_query ?? input.seed_query ?? input.title ?? ''),
    entity_name: typeof input.entity_name === 'string' ? input.entity_name : undefined,
    entity_type: typeof input.entity_type === 'string' ? input.entity_type : undefined,
    country: typeof input.country === 'string' ? input.country : undefined,
    tags: Array.isArray(input.tags) ? input.tags.filter((tag: unknown): tag is string => typeof tag === 'string') : [],
    captured_at: typeof input.captured_at === 'string' ? input.captured_at : nowIso(),
  };
}

export function normalizeEnrichmentResult(input: Record<string, any>): EnrichmentResult {
  const sourceUrls = toSourceUrls(input);
  const company = input.company ?? {};

  return {
    id: String(input.id ?? input.lead_id ?? input.title ?? `enrichment-${Date.now()}`),
    lane: 'enrichment',
    state: input.state === 'needs-review' || input.state === 'rejected' ? input.state : 'enriched',
    validation_state: input.validation_state === 'validated' || input.validation_state === 'rejected' || input.validation_state === 'needs-review'
      ? input.validation_state
      : 'pending',
    source_urls: sourceUrls,
    company: {
      name: String(company.name ?? input.company_name ?? 'Unknown company'),
      domain: typeof company.domain === 'string' ? company.domain : undefined,
      industry: typeof company.industry === 'string' ? company.industry : undefined,
      employee_count: typeof company.employee_count === 'number' ? company.employee_count : undefined,
      revenue_range: typeof company.revenue_range === 'string' ? company.revenue_range : undefined,
      funding_summary: typeof company.funding_summary === 'string' ? company.funding_summary : undefined,
      city: typeof company.city === 'string' ? company.city : undefined,
      country: typeof company.country === 'string' ? company.country : undefined,
      technologies: Array.isArray(company.technologies) ? company.technologies.filter((item: unknown): item is string => typeof item === 'string') : [],
    },
    contacts: Array.isArray(input.contacts)
      ? input.contacts.map((contact: Record<string, any>) => ({
          name: String(contact.name ?? 'Unknown contact'),
          title: typeof contact.title === 'string' ? contact.title : undefined,
          role: typeof contact.role === 'string' ? contact.role : undefined,
          linkedin_url: typeof contact.linkedin_url === 'string' ? contact.linkedin_url : undefined,
          company_name: typeof contact.company_name === 'string' ? contact.company_name : undefined,
          city: typeof contact.city === 'string' ? contact.city : undefined,
          country: typeof contact.country === 'string' ? contact.country : undefined,
          confidence: typeof contact.confidence === 'number' ? contact.confidence : undefined,
        }))
      : [],
    decision_makers: Array.isArray(input.decision_makers)
      ? input.decision_makers.filter((name: unknown): name is string => typeof name === 'string')
      : [],
    summary: String(input.summary ?? input.notes ?? ''),
    confidence: typeof input.confidence === 'number' ? input.confidence : 0.5,
    freshness: input.freshness === 'warm' || input.freshness === 'stale' ? input.freshness : 'fresh',
    captured_at: typeof input.captured_at === 'string' ? input.captured_at : nowIso(),
  };
}
