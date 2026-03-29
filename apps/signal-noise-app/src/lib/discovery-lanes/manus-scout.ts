import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export type ManusScoutCandidateState = 'candidate' | 'accepted' | 'rejected' | 'stale';

export interface ManusScoutObjectiveInput {
  id?: string;
  objective: string;
  sport_scope?: string;
  seed_query?: string;
  source_priority?: string[];
  confidence_threshold?: number;
  candidate_budget?: number;
  graph_write?: boolean;
  status?: 'queued' | 'running' | 'completed' | 'failed';
}

export interface ManusScoutObjective {
  id: string;
  lane: 'scout';
  system: 'manus';
  objective: string;
  sport_scope: string;
  seed_query: string;
  source_priority: string[];
  confidence_threshold: number;
  candidate_budget: number;
  graph_write: boolean;
  status: 'queued' | 'running' | 'completed' | 'failed';
  validation_state: 'pending' | 'validated' | 'rejected' | 'needs-review';
  captured_at: string;
}

export interface ManusScoutCandidateInput {
  id: string;
  title: string;
  source: string;
  source_url?: string;
  summary?: string;
  confidence?: number;
  freshness?: 'fresh' | 'warm' | 'stale';
  state?: ManusScoutCandidateState;
  follow_up_query?: string;
}

export interface ManusScoutCandidate extends ManusScoutCandidateInput {
  source_urls: string[];
  validation_state: 'pending' | 'validated' | 'rejected' | 'needs-review';
}

export interface ManusScoutArtifact {
  id: string;
  lane: 'scout';
  system: 'manus';
  objective: ManusScoutObjective;
  graph_write: false;
  status: 'queued' | 'running' | 'completed' | 'failed';
  accepted_candidates: ManusScoutCandidate[];
  rejected_candidates: ManusScoutCandidate[];
  stale_candidates: ManusScoutCandidate[];
  summary: {
    total_candidates: number;
    accepted: number;
    rejected: number;
    stale: number;
  };
  generated_at: string;
}

function nowIso() {
  return new Date().toISOString();
}

function toStringId(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function toStringArray(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback;
  const items = value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
  return items.length > 0 ? items : fallback;
}

export function normalizeManusScoutObjective(input: ManusScoutObjectiveInput): ManusScoutObjective {
  return {
    id: toStringId(input.id, `manus-scout-${Date.now()}`),
    lane: 'scout',
    system: 'manus',
    objective: input.objective,
    sport_scope: input.sport_scope ?? 'sports-universe',
    seed_query: input.seed_query ?? input.objective,
    source_priority: toStringArray(input.source_priority, ['google_serp', 'linkedin', 'official_site', 'press_release', 'news']),
    confidence_threshold: typeof input.confidence_threshold === 'number' ? input.confidence_threshold : 0.65,
    candidate_budget: typeof input.candidate_budget === 'number' ? input.candidate_budget : 5,
    graph_write: input.graph_write ?? false,
    status: input.status ?? 'queued',
    validation_state: 'pending',
    captured_at: nowIso(),
  };
}

function normalizeCandidate(candidate: ManusScoutCandidateInput): ManusScoutCandidate {
  return {
    ...candidate,
    source_urls: candidate.source_url ? [candidate.source_url] : [],
    validation_state: candidate.state === 'accepted'
      ? 'validated'
      : candidate.state === 'rejected'
        ? 'rejected'
        : candidate.state === 'stale'
          ? 'needs-review'
          : 'pending',
  };
}

export function buildManusScoutArtifact(input: {
  objective: ManusScoutObjectiveInput | ManusScoutObjective;
  candidates: ManusScoutCandidateInput[];
}): ManusScoutArtifact {
  const objective = 'lane' in input.objective
    ? input.objective
    : normalizeManusScoutObjective(input.objective);

  const normalizedCandidates = input.candidates.map(normalizeCandidate);
  const accepted_candidates = normalizedCandidates.filter((candidate) => candidate.state === 'accepted');
  const rejected_candidates = normalizedCandidates.filter((candidate) => candidate.state === 'rejected');
  const stale_candidates = normalizedCandidates.filter((candidate) => candidate.state === 'stale');

  return {
    id: objective.id,
    lane: 'scout',
    system: 'manus',
    objective,
    graph_write: false,
    status: objective.status,
    accepted_candidates,
    rejected_candidates,
    stale_candidates,
    summary: {
      total_candidates: normalizedCandidates.length,
      accepted: accepted_candidates.length,
      rejected: rejected_candidates.length,
      stale: stale_candidates.length,
    },
    generated_at: nowIso(),
  };
}

export async function writeManusScoutArtifact(input: {
  outputDir: string;
  artifact: ManusScoutArtifact;
}) {
  await mkdir(input.outputDir, { recursive: true });
  const filePath = join(input.outputDir, `manus_scout_${input.artifact.id}.json`);
  await writeFile(filePath, `${JSON.stringify(input.artifact, null, 2)}\n`, 'utf8');
  return { filePath, artifact: input.artifact };
}

export function buildDefaultManusCandidates(objective: ManusScoutObjective): ManusScoutCandidateInput[] {
  return [
    {
      id: `${objective.id}-lead-1`,
      title: `${objective.objective} - high signal opportunity`,
      source: 'manus',
      source_url: `https://example.invalid/${encodeURIComponent(objective.seed_query)}`,
      summary: `Scout lead generated for ${objective.seed_query}`,
      confidence: 0.82,
      freshness: 'fresh',
      state: 'accepted',
      follow_up_query: objective.seed_query,
    },
    {
      id: `${objective.id}-lead-2`,
      title: `${objective.objective} - noisy mention`,
      source: 'manus',
      source_url: `https://example.invalid/noise/${encodeURIComponent(objective.seed_query)}`,
      summary: `Noisy mention for ${objective.seed_query}`,
      confidence: 0.31,
      freshness: 'warm',
      state: 'rejected',
      follow_up_query: objective.seed_query,
    },
  ];
}
