export type DossierLifecyclePhaseKey =
  | 'intake'
  | 'discovery'
  | 'validation'
  | 'enrichment'
  | 'reasoning'
  | 'publish';

export type DossierPhaseStatus = 'complete' | 'active' | 'pending' | 'blocked' | 'stale';

export interface DossierLifecyclePhase {
  index: number;
  key: DossierLifecyclePhaseKey;
  label: string;
  description: string;
}

export interface DossierPhaseSnapshot {
  currentPhaseIndex: number;
  completionPercent: number;
  confidence: number | null;
  freshness: 'fresh' | 'warm' | 'stale';
  nextAction: string;
  evidenceCount: number;
  phaseStatuses: Array<DossierLifecyclePhase & { status: DossierPhaseStatus }>;
}

export interface DiscoveryPipelineSnapshotLike {
  status?: string;
  scout?: { status?: string; summary?: Record<string, unknown> | null } | null;
  enrichment?: { status?: string; summary?: Record<string, unknown> | null } | null;
}

export interface EnrichmentProgressLike {
  isRunning?: boolean;
  statistics?: {
    successRate?: number;
  } | null;
  batch?: {
    processedEntities?: number;
    totalEntities?: number;
    currentEntity?: string;
  } | null;
}

export interface ControlCenterStatusItem {
  label: string;
  value: string;
  detail: string;
  tone: 'active' | 'info' | 'blocked';
}

export interface ControlCenterStatusColumns {
  now: ControlCenterStatusItem[];
  next: ControlCenterStatusItem[];
  blocked: ControlCenterStatusItem[];
}

export interface ControlCenterPhaseStripItem {
  index: number;
  label: string;
  progress: number;
  status: 'complete' | 'active' | 'pending' | 'blocked';
}

function toTimestamp(value: string | number | Date): number {
  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === 'number') {
    return value;
  }

  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function formatRelativeElapsed(
  timestamp: string | number | Date,
  reference: string | number | Date = Date.now()
): string {
  const start = toTimestamp(timestamp);
  const end = toTimestamp(reference);

  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return 'unknown time';
  }

  const elapsedMs = Math.max(0, end - start);
  if (elapsedMs < 1000) return 'just now';

  const seconds = Math.floor(elapsedMs / 1000);
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

type ActivityFeedItemLike = {
  timestamp?: string;
  title?: string;
  detail?: string;
};

export function deriveControlCenterStatusColumns(
  pipeline?: DiscoveryPipelineSnapshotLike | null,
  enrichment?: EnrichmentProgressLike | null,
  feed: ActivityFeedItemLike[] = [],
  nextAction?: string
): ControlCenterStatusColumns {
  const scoutStatus = String(pipeline?.scout?.status ?? '').toLowerCase();
  const enrichmentStatus = enrichment?.isRunning
    ? 'running'
    : String(pipeline?.enrichment?.status ?? '').toLowerCase();
  const latestFeed = feed[0];
  const latestFeedLabel = latestFeed?.title?.trim() || 'System feed waiting for the next event.';
  const latestFeedDetail = latestFeed?.detail?.trim() || 'No live activity received yet.';
  const activeNow =
    scoutStatus === 'running' || scoutStatus === 'queued'
      ? 'Scout running'
      : enrichmentStatus === 'running' || enrichmentStatus === 'queued'
        ? 'Enrichment running'
        : pipeline?.status === 'healthy'
          ? 'Graph healthy'
          : latestFeed?.title
            ? latestFeed.title
            : 'System waiting';

  const blockedValue =
    enrichmentStatus === 'queued'
      ? 'Validation waiting on enrichment to finish.'
      : scoutStatus === 'running' && enrichmentStatus !== 'running'
        ? 'Enrichment waits for scout output.'
        : pipeline?.status === 'degraded'
          ? 'One or more lanes need attention.'
          : 'No blockers visible.';

  return {
    now: [
      {
        label: 'Active now',
        value: activeNow,
        detail: latestFeedDetail,
        tone: 'active',
      },
      {
        label: 'Latest event',
        value: latestFeedLabel,
        detail: latestFeedDetail,
        tone: 'info',
      },
    ],
    next: [
      {
        label: 'Next',
        value: nextAction?.trim() || 'Launch the next scout batch.',
        detail: 'The control center keeps the next hop visible at all times.',
        tone: 'info',
      },
    ],
    blocked: [
      {
        label: 'Blocked',
        value: blockedValue,
        detail: 'This lane stays visible so operators can remove bottlenecks quickly.',
        tone: 'blocked',
      },
    ],
  };
}

function parseMaybeTimestamp(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (value instanceof Date) {
    const parsed = value.getTime();
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function getSnapshotTimestamp(snapshot?: { updated_at?: string | null; summary?: Record<string, unknown> | null } | null): number | null {
  if (!snapshot) return null;
  return (
    parseMaybeTimestamp(snapshot.updated_at) ??
    parseMaybeTimestamp(snapshot.summary?.updated_at) ??
    parseMaybeTimestamp(snapshot.summary?.last_updated) ??
    parseMaybeTimestamp(snapshot.summary?.captured_at)
  );
}

export function deriveControlCenterMomentumStrip(
  feed: ActivityFeedItemLike[] = [],
  reference: string | number | Date = Date.now()
): ControlCenterStatusItem[] {
  const referenceTs = toTimestamp(reference);
  const minuteAgo = Number.isFinite(referenceTs) ? referenceTs - 60_000 : Number.NaN;
  const recentFeed = feed.filter((item) => {
    const itemTs = parseMaybeTimestamp(item.timestamp);
    return itemTs !== null && Number.isFinite(minuteAgo) && itemTs >= minuteAgo;
  });
  const latest = feed[0];
  const latestDetail = latest?.detail?.trim() || 'No live updates yet.';

  return [
    {
      label: 'Last minute',
      value: recentFeed.length ? `${recentFeed.length} update${recentFeed.length === 1 ? '' : 's'}` : 'Quiet minute',
      detail: latestDetail,
      tone: recentFeed.length ? 'active' : 'info',
    },
    {
      label: 'Most recent',
      value: latest?.title?.trim() || 'Awaiting the next event',
      detail: latest ? formatRelativeElapsed(latest.timestamp ?? reference, reference) : 'No activity received yet.',
      tone: latest ? 'active' : 'info',
    },
    {
      label: 'Momentum',
      value: recentFeed.some((item) => /enrichment/i.test(`${item.title ?? ''} ${item.detail ?? ''}`))
        ? 'Enrichment picking up'
        : recentFeed.some((item) => /scout/i.test(`${item.title ?? ''} ${item.detail ?? ''}`))
          ? 'Scout momentum active'
          : 'Standing by',
      detail: latestDetail,
      tone: recentFeed.length ? 'active' : 'info',
    },
  ];
}

export function deriveControlCenterBacklogSummary(
  pipeline?: DiscoveryPipelineSnapshotLike | null,
  enrichment?: EnrichmentProgressLike | null,
  reference: string | number | Date = Date.now()
): ControlCenterStatusItem[] {
  const referenceTs = toTimestamp(reference);
  const scoutTs = getSnapshotTimestamp(pipeline?.scout ?? null);
  const enrichmentTs = getSnapshotTimestamp(pipeline?.enrichment ?? null);

  const ages = [scoutTs, enrichmentTs].filter((value): value is number => value !== null && Number.isFinite(value));
  const staleSources = ages.filter((value) => Number.isFinite(referenceTs) && referenceTs - value > 1000 * 60 * 60 * 24).length;

  const revisitValue =
    enrichment?.isRunning || String(pipeline?.enrichment?.status ?? '').toLowerCase() === 'queued'
      ? 'Review enrichment once the queue clears.'
      : String(pipeline?.scout?.status ?? '').toLowerCase() === 'completed'
        ? 'Review scout leads and decide the next hop.'
        : 'Review the backlog before the next batch.';

  return [
    {
      label: 'Stale sources',
      value: staleSources > 0 ? `${staleSources} stale source window${staleSources === 1 ? '' : 's'}` : 'No stale sources',
      detail: 'Keep source freshness visible so revisits stay intentional.',
      tone: staleSources > 0 ? 'blocked' : 'info',
    },
    {
      label: 'Revisit due',
      value: revisitValue,
      detail: 'The newest candidate or queued lane should not be buried.',
      tone: 'blocked',
    },
  ];
}

export function deriveControlCenterPhaseStrip(
  currentPhaseIndex: number,
  progressPercent = 0
): ControlCenterPhaseStripItem[] {
  const safePhaseIndex = clampPhaseIndex(currentPhaseIndex);
  const safeProgress = Math.max(0, Math.min(100, Math.round(progressPercent)));

  return dossierLifecyclePhases.map((phase) => ({
    index: phase.index,
    label: phase.label,
    progress:
      phase.index < safePhaseIndex
        ? 100
        : phase.index === safePhaseIndex
          ? Math.max(safeProgress, 10)
          : phase.index === safePhaseIndex + 1 && safePhaseIndex < dossierLifecyclePhases.length - 1
            ? 20
            : 0,
    status:
      phase.index < safePhaseIndex
        ? 'complete'
        : phase.index === safePhaseIndex
          ? 'active'
          : phase.index === safePhaseIndex + 1 && safePhaseIndex < dossierLifecyclePhases.length - 1
            ? 'blocked'
            : 'pending',
  }));
}

export const dossierLifecyclePhases: DossierLifecyclePhase[] = [
  {
    index: 0,
    key: 'intake',
    label: 'Phase 0 · Intake',
    description: 'Capture the seed query, entity, and why it matters.',
  },
  {
    index: 1,
    key: 'discovery',
    label: 'Phase 1 · Discovery',
    description: 'Find candidate sources, opportunities, and adjacent signals.',
  },
  {
    index: 2,
    key: 'validation',
    label: 'Phase 2 · Validation',
    description: 'Accept or reject evidence and decide whether the dossier is real.',
  },
  {
    index: 3,
    key: 'enrichment',
    label: 'Phase 3 · Enrichment',
    description: 'Add people, company context, and structured metadata.',
  },
  {
    index: 4,
    key: 'reasoning',
    label: 'Phase 4 · Reasoning',
    description: 'Score fit, urgency, and next best action.',
  },
  {
    index: 5,
    key: 'publish',
    label: 'Phase 5 · Publish',
    description: 'Write the dossier, graph memory, and action plan.',
  },
];

function clampPhaseIndex(value: number): number {
  if (Number.isNaN(value) || !Number.isFinite(value)) return 0;
  return Math.min(Math.max(Math.floor(value), 0), dossierLifecyclePhases.length - 1);
}

function toConfidence(value: unknown): number | null {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  return value > 1 ? Math.max(0, Math.min(value / 100, 1)) : Math.max(0, Math.min(value, 1));
}

function countEvidence(dossier: Record<string, any>): number {
  const buckets = [
    dossier.rawEvidence,
    dossier.source_urls,
    dossier.sourceUrls,
    dossier.signals,
    dossier.topPOIs,
    dossier.contacts,
    dossier.decision_makers,
    dossier.recommendedActions,
    dossier.recommended_actions,
    dossier.issues,
  ];

  return buckets.reduce((total, bucket) => {
    if (Array.isArray(bucket)) return total + bucket.length;
    return total;
  }, 0);
}

function inferFreshness(dossier: Record<string, any>): 'fresh' | 'warm' | 'stale' {
  const freshnessHint = String(
    dossier.freshness ??
    dossier.metadata?.freshness ??
    dossier.metadata?.signal_state ??
    ''
  ).toLowerCase();

  if (freshnessHint.includes('stale') || freshnessHint.includes('archived')) {
    return 'stale';
  }

  const timestamp =
    dossier.updated_at ??
    dossier.lastUpdated ??
    dossier.last_updated ??
    dossier.metadata?.updated_at ??
    dossier.metadata?.last_updated ??
    dossier.captured_at ??
    dossier.metadata?.captured_at;

  if (typeof timestamp === 'string') {
    const ageMs = Date.now() - new Date(timestamp).getTime();
    if (Number.isFinite(ageMs) && ageMs > 1000 * 60 * 60 * 24 * 30) {
      return 'stale';
    }
    if (Number.isFinite(ageMs) && ageMs > 1000 * 60 * 60 * 24 * 7) {
      return 'warm';
    }
  }

  return freshnessHint.includes('warm') ? 'warm' : 'fresh';
}

function inferNextAction(dossier: Record<string, any>): string {
  const explicit =
    dossier.next_action ??
    dossier.metadata?.next_action ??
    dossier.metadata?.decision_summary ??
    dossier.recommendedActions?.[0]?.action ??
    dossier.recommended_actions?.[0]?.action;

  if (typeof explicit === 'string' && explicit.trim()) {
    return explicit.trim();
  }

  if (Array.isArray(dossier.contacts) && dossier.contacts.length > 0) {
    return 'Continue contact enrichment and lock the decision maker list.';
  }

  if (Array.isArray(dossier.rawEvidence) && dossier.rawEvidence.length > 0) {
    return 'Validate the strongest evidence and push the dossier forward.';
  }

  return 'Keep scouting for new evidence and revisit the backlog.';
}

export function deriveDossierPhaseIndex(dossier?: Record<string, any> | null): number {
  if (!dossier) return 0;

  const metadata = dossier.metadata ?? dossier;
  const explicit = metadata.phase_index ?? metadata.current_phase_index ?? metadata.phaseIndex;
  if (typeof explicit === 'number') {
    return clampPhaseIndex(explicit);
  }

  const signalState = String(metadata.signal_state ?? metadata.state ?? '').toLowerCase();

  if (
    signalState.includes('publish') ||
    signalState.includes('complete') ||
    signalState.includes('validated') ||
    metadata.browser_dossier_url ||
    metadata.page_url
  ) {
    return 5;
  }

  const confidence = toConfidence(metadata.rfp_confidence ?? metadata.confidence ?? metadata.opportunity_score);
  if ((confidence ?? 0) >= 0.8 || typeof metadata.opportunity_score === 'number' && metadata.opportunity_score >= 80) {
    return 4;
  }

  if (
    (Array.isArray(dossier.contacts) && dossier.contacts.length > 0) ||
    (Array.isArray(dossier.decision_makers) && dossier.decision_makers.length > 0) ||
    (Array.isArray(dossier.topPOIs) && dossier.topPOIs.length > 0)
  ) {
    return 3;
  }

  if (
    (Array.isArray(dossier.rawEvidence) && dossier.rawEvidence.length > 0) ||
    (Array.isArray(dossier.source_urls) && dossier.source_urls.length > 0) ||
    (Array.isArray(dossier.signals) && dossier.signals.length > 0)
  ) {
    return 2;
  }

  if (metadata.name || dossier.entityName || metadata.summary || dossier.summary) {
    return 1;
  }

  return 0;
}

export function derivePipelinePhaseIndex(
  pipeline?: DiscoveryPipelineSnapshotLike | null,
  enrichment?: EnrichmentProgressLike | null
): number {
  if (!pipeline) {
    if (enrichment?.isRunning) return 3;
    return 0;
  }

  const scoutStatus = String(pipeline.scout?.status ?? '').toLowerCase();
  const enrichmentStatus = String(pipeline.enrichment?.status ?? '').toLowerCase();

  if (enrichment?.isRunning || enrichmentStatus === 'running' || enrichmentStatus === 'queued') {
    return 3;
  }

  if (enrichmentStatus === 'completed' || pipeline.status === 'healthy') {
    return 5;
  }

  if (scoutStatus === 'running' || scoutStatus === 'queued') {
    return 1;
  }

  if (scoutStatus === 'completed') {
    return 2;
  }

  return 0;
}

export function deriveDossierPhaseSnapshot(
  dossier?: Record<string, any> | null,
  overrides?: {
    currentPhaseIndex?: number;
    progressPercent?: number;
    nextAction?: string;
  }
): DossierPhaseSnapshot {
  const currentPhaseIndex = clampPhaseIndex(
    overrides?.currentPhaseIndex ?? deriveDossierPhaseIndex(dossier)
  );
  const completionPercent = Math.max(
    0,
    Math.min(
      100,
      overrides?.progressPercent ?? Math.round((currentPhaseIndex / (dossierLifecyclePhases.length - 1)) * 100)
    )
  );
  const confidence = toConfidence(
    dossier?.metadata?.rfp_confidence ??
      dossier?.metadata?.confidence ??
      dossier?.metadata?.opportunity_score ??
      dossier?.rfp_confidence ??
      dossier?.confidence ??
      null
  );
  const freshness = inferFreshness(dossier ?? {});
  const nextAction = overrides?.nextAction ?? inferNextAction(dossier ?? {});
  const evidenceCount = countEvidence(dossier ?? {});

  return {
    currentPhaseIndex,
    completionPercent,
    confidence,
    freshness,
    nextAction,
    evidenceCount,
    phaseStatuses: dossierLifecyclePhases.map((phase) => ({
      ...phase,
      status:
        phase.index < currentPhaseIndex
          ? 'complete'
          : phase.index === currentPhaseIndex
            ? 'active'
            : phase.index === currentPhaseIndex + 1 && currentPhaseIndex < 2
              ? 'blocked'
              : 'pending',
    })),
  };
}
