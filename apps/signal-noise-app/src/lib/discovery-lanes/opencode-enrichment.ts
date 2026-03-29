import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { LeadIqClient } from './leadiq-client.ts';
import type {
  EnrichmentCompany,
  EnrichmentContact,
  EnrichmentResult,
  ScoutLead,
} from './types.ts';

export interface OpenCodeEnrichedCandidate {
  id: string;
  source_candidate_id: string;
  source_urls: string[];
  company: EnrichmentCompany;
  contacts: EnrichmentContact[];
  decision_makers: string[];
  summary: string;
  confidence: number;
  freshness: 'fresh' | 'warm' | 'stale';
  validation_state: 'pending' | 'validated' | 'rejected' | 'needs-review';
}

export interface OpenCodeEnrichmentArtifact {
  id: string;
  lane: 'enrichment';
  system: 'opencode';
  source_lane: 'scout';
  source_artifact_id: string;
  graph_write: false;
  status: 'queued' | 'running' | 'completed' | 'failed';
  objective: Record<string, unknown>;
  enriched_candidates: OpenCodeEnrichedCandidate[];
  summary: {
    total_candidates: number;
    enriched: number;
    company_matches: number;
    contact_matches: number;
  };
  generated_at: string;
}

export interface BuildOpenCodeEnrichmentArtifactInput {
  scoutArtifact: {
    id: string;
    objective: Record<string, unknown>;
    accepted_candidates: ScoutLead[];
    rejected_candidates?: ScoutLead[];
    stale_candidates?: ScoutLead[];
  };
  leadIqClient?: LeadIqClient;
}

function nowIso() {
  return new Date().toISOString();
}

function inferCompanyName(candidate: ScoutLead): string {
  if (candidate.entity_name?.trim()) {
    return candidate.entity_name.trim();
  }

  const title = candidate.title.trim();
  const separators = [' - ', ' | ', ':'];
  for (const separator of separators) {
    const [head] = title.split(separator);
    if (head && head.trim().length >= 3) {
      return head.trim();
    }
  }

  return title;
}

function mapCompanyResult(result: any, fallbackName: string): EnrichmentCompany {
  return {
    name: String(result?.name ?? fallbackName),
    domain: typeof result?.domain === 'string' ? result.domain : undefined,
    industry: typeof result?.industry === 'string' ? result.industry : undefined,
    employee_count: typeof result?.numberOfEmployees === 'number' ? result.numberOfEmployees : undefined,
    revenue_range: result?.revenueRange?.description ? String(result.revenueRange.description) : undefined,
    funding_summary: result?.fundingInfo?.fundingTotalUsd
      ? `USD ${result.fundingInfo.fundingTotalUsd}`
      : undefined,
    city: result?.locationInfo?.city ? String(result.locationInfo.city) : undefined,
    country: result?.locationInfo?.country ? String(result.locationInfo.country) : undefined,
    technologies: Array.isArray(result?.companyTechnologies) ? result.companyTechnologies.filter((entry: unknown): entry is string => typeof entry === 'string') : [],
  };
}

function mapPeopleResult(result: any): EnrichmentContact {
  return {
    name: String(result?.name ?? 'Unknown contact'),
    title: typeof result?.title === 'string' ? result.title : undefined,
    role: typeof result?.role === 'string' ? result.role : undefined,
    linkedin_url: typeof result?.linkedinUrl === 'string' ? result.linkedinUrl : undefined,
    company_name: typeof result?.company?.name === 'string' ? result.company.name : undefined,
    city: typeof result?.city === 'string' ? result.city : undefined,
    country: typeof result?.country === 'string' ? result.country : undefined,
    confidence: typeof result?.confidence === 'number' ? result.confidence : undefined,
  };
}

function resolveContactsFromPeopleSearch(peopleResult: any): EnrichmentContact[] {
  return Array.isArray(peopleResult?.people) ? peopleResult.people.map(mapPeopleResult) : [];
}

export async function buildOpenCodeEnrichmentArtifact(input: BuildOpenCodeEnrichmentArtifactInput): Promise<OpenCodeEnrichmentArtifact> {
  const leadIqClient = input.leadIqClient ?? new LeadIqClient();
  const acceptedCandidates = input.scoutArtifact.accepted_candidates ?? [];
  const enriched_candidates: OpenCodeEnrichedCandidate[] = [];

  for (const candidate of acceptedCandidates) {
    const companyQuery = inferCompanyName(candidate);
    const companyResponse = await leadIqClient.searchCompany({
      company_name: companyQuery,
      company_domain: candidate.source_url?.includes('linkedin.com') ? undefined : undefined,
      strict: false,
    });

    const companyResult = companyResponse?.results?.[0] ?? null;
    const company = mapCompanyResult(companyResult, companyQuery);

    const peopleResponse = await leadIqClient.flatAdvancedSearch({
      title: candidate.follow_up_query || candidate.summary || candidate.title,
      company_name: company.name,
      company_domain: company.domain,
      country_code: candidate.country,
      limit: 10,
    });

    const contacts = resolveContactsFromPeopleSearch(peopleResponse);
    const decision_makers = contacts.slice(0, 3).map((contact) => contact.name);

    enriched_candidates.push({
      id: candidate.id,
      source_candidate_id: candidate.id,
      source_urls: candidate.source_urls,
      company,
      contacts,
      decision_makers,
      summary: candidate.summary,
      confidence: Math.min(1, candidate.confidence + (contacts.length > 0 ? 0.05 : 0)),
      freshness: candidate.freshness,
      validation_state: 'pending',
    });
  }

  const company_matches = enriched_candidates.filter((candidate) => Boolean(candidate.company.name)).length;
  const contact_matches = enriched_candidates.reduce((sum, candidate) => sum + candidate.contacts.length, 0);

  return {
    id: `opencode-enrichment-${input.scoutArtifact.id}`,
    lane: 'enrichment',
    system: 'opencode',
    source_lane: 'scout',
    source_artifact_id: input.scoutArtifact.id,
    graph_write: false,
    status: 'completed',
    objective: input.scoutArtifact.objective,
    enriched_candidates,
    summary: {
      total_candidates: acceptedCandidates.length,
      enriched: enriched_candidates.length,
      company_matches,
      contact_matches,
    },
    generated_at: nowIso(),
  };
}

export async function writeOpenCodeEnrichmentArtifact(input: {
  outputDir: string;
  artifact: OpenCodeEnrichmentArtifact;
}) {
  await mkdir(input.outputDir, { recursive: true });
  const filePath = join(input.outputDir, `opencode_enrichment_${input.artifact.id}.json`);
  await writeFile(filePath, `${JSON.stringify(input.artifact, null, 2)}\n`, 'utf8');
  return { filePath, artifact: input.artifact };
}

export function summarizeOpenCodeEnrichmentArtifact(artifact: OpenCodeEnrichmentArtifact): EnrichmentResult {
  const first = artifact.enriched_candidates[0];

  return {
    id: artifact.id,
    lane: 'enrichment',
    state: 'enriched',
    validation_state: 'pending',
    source_urls: first?.source_urls ?? [],
    company: first?.company ?? {
      name: 'Unknown company',
      technologies: [],
    },
    contacts: first?.contacts ?? [],
    decision_makers: first?.decision_makers ?? [],
    summary: `Enriched ${artifact.summary.enriched} candidate(s)`,
    confidence: first?.confidence ?? 0.5,
    freshness: first?.freshness ?? 'fresh',
    captured_at: artifact.generated_at,
  };
}
