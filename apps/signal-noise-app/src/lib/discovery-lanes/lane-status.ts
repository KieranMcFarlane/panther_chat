import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { buildManusScoutArtifact, normalizeManusScoutObjective } from './manus-scout.ts';

export interface LaneSnapshot {
  lane: 'scout' | 'enrichment';
  status: 'inactive' | 'queued' | 'running' | 'completed' | 'failed' | 'active' | 'degraded';
  file_path: string | null;
  updated_at: string | null;
  summary: Record<string, unknown>;
  artifact: Record<string, unknown> | null;
}

const DEFAULT_DISCOVERY_DIR = join(process.cwd(), 'backend', 'data', 'discovery_lanes');

async function resolveLatestJsonFile(directory: string, prefix: string) {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    const candidates = [];

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.startsWith(prefix) || !entry.name.endsWith('.json')) {
        continue;
      }

      const filePath = join(directory, entry.name);
      const fileStat = await stat(filePath);
      candidates.push({ filePath, mtimeMs: fileStat.mtimeMs });
    }

    candidates.sort((left, right) => right.mtimeMs - left.mtimeMs);
    return candidates[0]?.filePath ?? null;
  } catch {
    return null;
  }
}

async function loadJson(filePath: string) {
  const raw = await readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

export async function readLaneSnapshot(input: {
  lane: 'scout' | 'enrichment';
  outputDir?: string;
}) : Promise<LaneSnapshot> {
  const outputDir = input.outputDir ?? DEFAULT_DISCOVERY_DIR;
  const prefix = input.lane === 'scout' ? 'manus_scout_' : 'opencode_enrichment_';
  const filePath = await resolveLatestJsonFile(outputDir, prefix);

  if (!filePath) {
    return {
      lane: input.lane,
      status: 'active',
      file_path: null,
      updated_at: null,
      summary: {
        state: 'awaiting_first_snapshot',
        message: `${input.lane} lane is live and waiting for its first artifact.`,
      },
      artifact: null,
    };
  }

  const artifact = await loadJson(filePath);
  const summary = artifact.summary ?? {
    total_candidates: Array.isArray(artifact.accepted_candidates)
      ? artifact.accepted_candidates.length
      : 0,
  };

  return {
    lane: input.lane,
    status: artifact.status ?? 'completed',
    file_path: filePath,
    updated_at: artifact.generated_at ?? artifact.captured_at ?? null,
    summary,
    artifact,
  };
}

export async function writeLaneRequestFile(input: {
  lane: 'scout' | 'enrichment';
  outputDir?: string;
  payload: Record<string, unknown>;
}) {
  const outputDir = input.outputDir ?? DEFAULT_DISCOVERY_DIR;
  const requestDir = join(outputDir, 'requests');
  await mkdir(requestDir, { recursive: true });

  const requestId = `${input.lane}_${Date.now()}`;
  const filePath = join(requestDir, `${requestId}.json`);
  const payload = {
    id: requestId,
    lane: input.lane,
    status: 'queued',
    captured_at: new Date().toISOString(),
    ...input.payload,
  };

  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return { requestId, filePath, payload };
}

export async function readDiscoveryPipelineSnapshot(input?: { outputDir?: string }) {
  const scout = await readLaneSnapshot({ lane: 'scout', outputDir: input?.outputDir });
  const enrichment = await readLaneSnapshot({ lane: 'enrichment', outputDir: input?.outputDir });

  const status =
    scout.status === 'failed' || enrichment.status === 'failed'
      ? 'degraded'
      : scout.status === 'inactive' && enrichment.status === 'inactive'
        ? 'inactive'
        : scout.status === 'completed' && enrichment.status === 'completed'
          ? 'healthy'
          : 'active';

  return {
    status,
    scout,
    enrichment,
    updated_at: new Date().toISOString(),
  };
}

export function buildDefaultScoutRequest(payload: Record<string, unknown>) {
  const objective = typeof payload.objective === 'string' ? payload.objective : 'Find broad sports RFP opportunities';
  const normalized = normalizeManusScoutObjective({
    objective,
    sport_scope: typeof payload.sport_scope === 'string' ? payload.sport_scope : 'sports-universe',
    seed_query: typeof payload.seed_query === 'string' ? payload.seed_query : objective,
  });

  return buildManusScoutArtifact({
    objective: normalized,
    candidates: [],
  });
}
