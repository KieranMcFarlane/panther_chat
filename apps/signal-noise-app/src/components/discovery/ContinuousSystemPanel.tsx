'use client';

import { useEffect, useMemo, useState } from 'react';
import { Activity, ArrowRight, Brain, Radar, Sparkles } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

import DossierPhaseRail from './DossierPhaseRail';
import {
  deriveControlCenterBacklogSummary,
  deriveControlCenterMomentumStrip,
  deriveControlCenterPhaseStrip,
  deriveControlCenterStatusColumns,
  deriveDossierPhaseSnapshot,
  derivePipelinePhaseIndex,
  dossierLifecyclePhases,
  formatRelativeElapsed,
} from './discovery-phase-model';

interface PipelineSnapshot {
  status: string;
  scout: {
    status: string;
    updated_at?: string | null;
    summary?: Record<string, unknown>;
  };
  enrichment: {
    status: string;
    updated_at?: string | null;
    summary?: Record<string, unknown>;
  };
  updated_at?: string | null;
}

interface EnrichmentProgressSnapshot {
  isRunning: boolean;
  batch?: {
    batchId?: string;
    totalEntities?: number;
    processedEntities?: number;
    successfulEnrichments?: number;
    failedEnrichments?: number;
    currentEntity?: string;
  } | null;
  statistics?: {
    successRate?: number;
    averageTimePerEntity?: number;
    totalProcessed?: number;
    totalSuccessful?: number;
    totalFailed?: number;
  } | null;
  recentResults?: Array<{
    entityName: string;
    success: boolean;
    duration: number;
    error?: string;
  }>;
  timestamp?: string;
}

interface EnrichmentLaneSnapshot {
  lane: 'enrichment';
  status: 'inactive' | 'queued' | 'running' | 'completed' | 'failed' | 'active' | 'degraded';
  file_path: string | null;
  updated_at: string | null;
  summary: {
    total_candidates?: number;
    enriched?: number;
    company_matches?: number;
    contact_matches?: number;
    message?: string;
    state?: string;
  };
  artifact?: {
    id?: string;
    system?: string;
    source_lane?: string;
    enriched_candidates?: Array<{
      company?: { name?: string };
      contacts?: unknown[];
      decision_makers?: string[];
    }>;
  } | null;
}

interface FeedEntry {
  id: string;
  timestamp: string;
  title: string;
  detail: string;
  kind: 'system' | 'scout' | 'enrichment' | 'validation' | 'graph';
}

function formatTimestamp(timestamp: string) {
  try {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return timestamp;
  }
}

function deriveSystemPhaseIndex(pipeline: PipelineSnapshot | null, enrichment: EnrichmentProgressSnapshot | null) {
  return derivePipelinePhaseIndex(pipeline, enrichment);
}

function normalizeEnrichmentSnapshot(snapshot: EnrichmentLaneSnapshot | null): EnrichmentProgressSnapshot | null {
  if (!snapshot) {
    return null;
  }

  const totalEntities = Number(snapshot.summary?.total_candidates ?? 0);
  const successfulEnrichments = Number(snapshot.summary?.enriched ?? 0);
  const successRate = totalEntities > 0 ? Math.round((successfulEnrichments / totalEntities) * 100) : 0;
  const currentEntity = snapshot.artifact?.enriched_candidates?.[0]?.company?.name ?? snapshot.summary?.message ?? '';

  return {
    isRunning: snapshot.status === 'queued' || snapshot.status === 'running' || snapshot.status === 'active',
    batch: snapshot.artifact
      ? {
          batchId: snapshot.artifact.id ?? `enrichment-${snapshot.updated_at ?? Date.now().toString()}`,
          totalEntities,
          processedEntities: successfulEnrichments,
          successfulEnrichments,
          failedEnrichments: 0,
          currentEntity,
          estimatedTimeRemaining: 0,
          startTime: snapshot.updated_at ?? new Date().toISOString(),
          results: [],
        }
      : null,
    statistics: {
      successRate,
      averageTimePerEntity: 0,
      totalProcessed: totalEntities,
      totalSuccessful: successfulEnrichments,
      totalFailed: 0,
    },
    recentResults: [],
    timestamp: snapshot.updated_at ?? new Date().toISOString(),
  };
}

function createSnapshotFeedItems(
  pipeline: PipelineSnapshot | null,
  enrichment: EnrichmentProgressSnapshot | null
): FeedEntry[] {
  const now = new Date().toISOString();
  const items: FeedEntry[] = [
    {
      id: 'system-heartbeat',
      timestamp: now,
      kind: 'system',
      title: pipeline?.status === 'healthy' ? 'System healthy' : 'System active',
      detail: pipeline
        ? `Scout: ${pipeline.scout?.status ?? 'inactive'} · Enrichment: ${pipeline.enrichment?.status ?? 'inactive'}`
        : 'Awaiting lane snapshots.',
    },
  ];

  if (pipeline?.scout) {
    items.push({
      id: 'scout-snapshot',
      timestamp: pipeline.scout.updated_at ?? now,
      kind: 'scout',
      title: 'Scout lane snapshot',
      detail: `Status: ${pipeline.scout.status} · Updated: ${pipeline.scout.updated_at ? formatTimestamp(pipeline.scout.updated_at) : 'n/a'}`,
    });
  }

  if (pipeline?.enrichment) {
    items.push({
      id: 'enrichment-snapshot',
      timestamp: pipeline.enrichment.updated_at ?? now,
      kind: 'enrichment',
      title: 'Enrichment lane snapshot',
      detail: `Status: ${pipeline.enrichment.status} · Updated: ${pipeline.enrichment.updated_at ? formatTimestamp(pipeline.enrichment.updated_at) : 'n/a'}`,
    });
  }

  if (enrichment?.isRunning) {
    items.push({
      id: 'enrichment-progress',
      timestamp: enrichment.timestamp ?? now,
      kind: 'validation',
      title: 'Enrichment batch in flight',
      detail: enrichment.batch?.currentEntity
        ? `Processing ${enrichment.batch.currentEntity}`
        : 'Processing next entity in the batch.',
    });
  }

  return items;
}

function normalizeActivityEvent(raw: any): FeedEntry | null {
  const timestamp = raw?.timestamp ?? new Date().toISOString();

  if (raw?.type === 'sdk_message') {
    const message = raw.data ?? {};
    const subtype = String(message.subtype ?? 'system');
    return {
      id: `${subtype}-${raw.sessionId ?? 'continuous'}-${timestamp}`,
      timestamp,
      kind:
        message.type === 'assistant'
          ? 'validation'
          : message.type === 'result'
            ? 'graph'
            : 'system',
      title: message.type === 'assistant' ? 'Agent reasoning update' : 'SDK activity',
      detail:
        message.message?.content ??
        message.message ??
        message.subtype ??
        'Live system event',
    };
  }

  if (raw?.type === 'tool_execution') {
    return {
      id: `tool-${timestamp}`,
      timestamp,
      kind: 'graph',
      title: `${raw.toolName ?? 'Tool'} execution`,
      detail: raw.error ? String(raw.error) : `${raw.action ?? 'completed'} in ${raw.duration ?? 0}ms`,
    };
  }

  if (raw?.type === 'mcp_activity') {
    return {
      id: `mcp-${timestamp}`,
      timestamp,
      kind: 'scout',
      title: `${raw.server ?? 'MCP'} activity`,
      detail: `${raw.tool ?? 'tool'} · ${raw.status ?? 'unknown'}`,
    };
  }

  if (raw?.type === 'session_event') {
    return {
      id: `session-${timestamp}`,
      timestamp,
      kind: 'system',
      title: 'Session event',
      detail: raw.data?.message ?? raw.message ?? raw.data?.event ?? 'Session update',
    };
  }

  if (raw?.type === 'dossier_phase_update' || raw?.type === 'dossier_generation_status' || raw?.type === 'pipeline_lane_update') {
    const phaseIndex = raw?.data?.phaseIndex ?? raw?.data?.phase_index;
    const phaseLabel = raw?.data?.phaseLabel ?? raw?.data?.phase_label ?? raw?.data?.stage ?? raw?.type;
    return {
      id: `phase-${raw?.data?.entityId ?? raw?.data?.entity_id ?? 'pipeline'}-${phaseIndex ?? timestamp}`,
      timestamp,
      kind: 'validation',
      title: String(raw?.data?.title ?? phaseLabel ?? raw?.type),
      detail: String(raw?.data?.detail ?? raw?.data?.message ?? raw?.data?.entityName ?? 'Pipeline update'),
    };
  }

  if (raw?.type === 'error') {
    return {
      id: `error-${timestamp}`,
      timestamp,
      kind: 'validation',
      title: 'System error',
      detail: raw.data?.error ?? raw.error ?? 'Unknown error',
    };
  }

  return null;
}

export default function ContinuousSystemPanel() {
  const [pipeline, setPipeline] = useState<PipelineSnapshot | null>(null);
  const [enrichment, setEnrichment] = useState<EnrichmentProgressSnapshot | null>(null);
  const [feed, setFeed] = useState<FeedEntry[]>([]);
  const [discoveryFeed, setDiscoveryFeed] = useState<FeedEntry[]>([]);
  const [connectionState, setConnectionState] = useState<'connecting' | 'live' | 'degraded'>('connecting');
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;

    const loadSnapshots = async () => {
      try {
        const [pipelineResponse, enrichmentResponse] = await Promise.all([
          fetch('/api/discovery-lanes/pipeline', { cache: 'no-store' }),
          fetch('/api/discovery-lanes/enrichment', { cache: 'no-store' }),
        ]);

        if (cancelled) return;

        if (pipelineResponse.ok) {
          const pipelineJson = await pipelineResponse.json();
          if (!cancelled) {
            setPipeline(pipelineJson?.data ?? null);
          }
        }

        if (enrichmentResponse.ok) {
          const enrichmentJson = await enrichmentResponse.json();
          if (!cancelled) {
            setEnrichment(normalizeEnrichmentSnapshot(enrichmentJson?.data ?? null));
          }
        }
      } catch (error) {
        console.warn('Failed to load continuous system snapshots', error);
      }
    };

    void loadSnapshots();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const eventSource = new EventSource('/api/claude-agent/activity?session_id=continuous-system');
    setConnectionState('connecting');

    eventSource.onopen = () => {
      setConnectionState('live');
    };

    eventSource.onmessage = (event) => {
      try {
        const raw = JSON.parse(event.data);
        const normalized = normalizeActivityEvent(raw);
        if (!normalized) return;

        setFeed((previous) => [
          normalized,
          ...previous.filter((item) => item.id !== normalized.id).slice(0, 19),
        ]);
      } catch (error) {
        setConnectionState('degraded');
        console.warn('Continuous system event parse error', error);
      }
    };

    eventSource.onerror = () => {
      setConnectionState('degraded');
    };

    return () => {
      eventSource.close();
    };
  }, []);

  useEffect(() => {
    const eventSource = new EventSource('/api/streaming/events');

    eventSource.onmessage = (event) => {
      try {
        const raw = JSON.parse(event.data);
        const normalized = normalizeActivityEvent(raw);
        if (!normalized) return;

        setDiscoveryFeed((previous) => [
          normalized,
          ...previous.filter((item) => item.id !== normalized.id).slice(0, 19),
        ]);
      } catch (error) {
        console.warn('Discovery event parse error', error);
      }
    };

    return () => {
      eventSource.close();
    };
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 5000);

    return () => window.clearInterval(interval);
  }, []);

  const snapshotFeed = useMemo(() => createSnapshotFeedItems(pipeline, enrichment), [pipeline, enrichment]);
  const currentPhaseIndex = useMemo(() => deriveSystemPhaseIndex(pipeline, enrichment), [pipeline, enrichment]);
  const completionPercent = useMemo(() => Math.round((currentPhaseIndex / (dossierLifecyclePhases.length - 1)) * 100), [currentPhaseIndex]);
  const mergedFeed = useMemo(() => [...snapshotFeed, ...discoveryFeed, ...feed].slice(0, 14), [snapshotFeed, discoveryFeed, feed]);
  const nextAction =
    enrichment?.isRunning
      ? 'Wait for enrichment to finish, then validate the new evidence.'
      : pipeline?.enrichment?.status === 'completed'
        ? 'Promote validated dossiers into the graph.'
        : pipeline?.scout?.status === 'completed'
          ? 'Hand scout leads into enrichment.'
          : 'Launch the next scout batch.';
  const statusColumns = useMemo(
    () => deriveControlCenterStatusColumns(pipeline, enrichment, mergedFeed, nextAction),
    [pipeline, enrichment, mergedFeed, nextAction]
  );
  const momentumStrip = useMemo(
    () => deriveControlCenterMomentumStrip(mergedFeed, now),
    [mergedFeed, now]
  );
  const backlogSummary = useMemo(
    () => deriveControlCenterBacklogSummary(pipeline, enrichment, now),
    [pipeline, enrichment, now]
  );
  const phaseStrip = useMemo(
    () => deriveControlCenterPhaseStrip(currentPhaseIndex, completionPercent),
    [currentPhaseIndex, completionPercent]
  );
  const latestActivityTimestamp = useMemo(() => {
    return mergedFeed[0]?.timestamp ?? enrichment?.timestamp ?? pipeline?.updated_at ?? new Date().toISOString();
  }, [mergedFeed, enrichment?.timestamp, pipeline?.updated_at]);

  const successfulRate = enrichment?.statistics?.successRate ?? null;

  return (
    <Card className="border border-white/10 bg-slate-950/70 backdrop-blur-md shadow-2xl shadow-cyan-500/10">
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-3 text-xl text-white">
              <Radar className="h-5 w-5 text-cyan-300" />
              Continuous system pulse
            </CardTitle>
            <CardDescription className="text-slate-300">
              See the scout, enrichment, validation, and graph loop updating as it runs.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              className={
                connectionState === 'live'
                  ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100'
                  : connectionState === 'connecting'
                    ? 'border-cyan-400/20 bg-cyan-500/10 text-cyan-100'
                    : 'border-amber-400/20 bg-amber-500/10 text-amber-100'
              }
            >
              <span className="mr-2 inline-flex h-2 w-2 rounded-full bg-current animate-pulse" />
              {connectionState}
            </Badge>
            <Badge className="border-cyan-400/20 bg-cyan-500/10 text-cyan-100">
              Phase {currentPhaseIndex}/5
            </Badge>
            <Badge className="border-white/10 bg-white/5 text-slate-100">
              {pipeline?.status ?? 'inactive'}
            </Badge>
            <Badge className="border-white/10 bg-white/5 text-slate-100">
              Updated {formatRelativeElapsed(latestActivityTimestamp, now)}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 lg:grid-cols-[0.78fr_0.6fr_0.62fr]">
          {[statusColumns.now, statusColumns.next, statusColumns.blocked].map((column, columnIndex) => {
            const columnKey = ['now', 'next', 'blocked'][columnIndex];
            const cardTone =
              columnKey === 'now'
                ? 'border-cyan-400/30 bg-cyan-500/10'
                : columnKey === 'next'
                  ? 'border-violet-400/30 bg-violet-500/10'
                  : 'border-amber-400/30 bg-amber-500/10';

            return (
              <div key={columnKey} className={`rounded-3xl border p-4 ${cardTone}`}>
                <div className="mb-3 text-xs uppercase tracking-[0.3em] text-slate-300">{columnKey}</div>
                <div className="space-y-3">
                  {column.map((item) => (
                    <div key={`${columnKey}-${item.label}`} className="rounded-2xl border border-white/10 bg-slate-950/40 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-medium text-white">{item.label}</div>
                        <Badge
                          className={
                            item.tone === 'active'
                              ? 'border-cyan-400/20 bg-cyan-500/10 text-cyan-100'
                              : item.tone === 'blocked'
                                ? 'border-amber-400/20 bg-amber-500/10 text-amber-100'
                                : 'border-white/10 bg-white/5 text-slate-100'
                          }
                        >
                          {item.tone}
                        </Badge>
                      </div>
                      <div className="mt-2 flex items-center gap-2 text-sm text-slate-200">
                        <Sparkles
                          className={
                            item.tone === 'active'
                              ? 'h-4 w-4 animate-pulse text-cyan-300'
                              : item.tone === 'blocked'
                                ? 'h-4 w-4 text-amber-300'
                                : 'h-4 w-4 text-violet-300'
                          }
                        />
                        <span>{item.value}</span>
                      </div>
                      <div className="mt-2 text-xs leading-5 text-slate-400">{item.detail}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="border border-white/10 bg-white/[0.03]">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-white">What changed in the last minute</CardTitle>
              <CardDescription className="text-slate-300">
                Keep the freshest changes in view so the control center feels live.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              {momentumStrip.map((item) => (
                <div key={item.label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-[0.28em] text-slate-400">{item.label}</div>
                  <div className="mt-2 text-lg font-semibold text-white">{item.value}</div>
                  <div className="mt-2 text-sm leading-6 text-slate-300">{item.detail}</div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border border-white/10 bg-white/[0.03]">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-white">Stale sources and revisit due</CardTitle>
              <CardDescription className="text-slate-300">
                Show the backlog explicitly so nothing gets buried.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {backlogSummary.map((item) => (
                <div key={item.label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium text-white">{item.label}</div>
                    <Badge
                      className={
                        item.tone === 'blocked'
                          ? 'border-amber-400/20 bg-amber-500/10 text-amber-100'
                          : 'border-white/10 bg-white/5 text-slate-100'
                      }
                    >
                      {item.tone}
                    </Badge>
                  </div>
                  <div className="mt-2 text-sm leading-6 text-slate-200">{item.value}</div>
                  <div className="mt-2 text-xs leading-5 text-slate-400">{item.detail}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs uppercase tracking-[0.28em] text-slate-400">Global progress</div>
            <div className="mt-2 text-3xl font-semibold text-white">{completionPercent}%</div>
            <Progress value={completionPercent} className="mt-3 h-2 bg-white/5" />
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs uppercase tracking-[0.28em] text-slate-400">Enrichment success</div>
            <div className="mt-2 text-3xl font-semibold text-white">
              {successfulRate === null ? 'n/a' : `${successfulRate}%`}
            </div>
            <div className="mt-2 text-sm text-slate-300">
              {enrichment?.batch?.processedEntities ?? 0} / {enrichment?.batch?.totalEntities ?? 0} processed
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs uppercase tracking-[0.28em] text-slate-400">Next action</div>
            <div className="mt-2 flex items-start gap-2 text-sm leading-6 text-slate-200">
              <ArrowRight className="mt-0.5 h-4 w-4 flex-shrink-0 text-cyan-300" />
              <span>{nextAction}</span>
            </div>
          </div>
        </div>

        <Card className="border border-white/10 bg-white/[0.03]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-white">Dossier phase strip</CardTitle>
            <CardDescription className="text-slate-300">
              A compact phase bar for the home screen so dossier progress is visible at a glance.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
            {phaseStrip.map((phase) => (
              <div
                key={phase.label}
                className={`rounded-2xl border p-3 ${
                  phase.status === 'active'
                    ? 'border-cyan-400/30 bg-cyan-500/10'
                    : phase.status === 'complete'
                      ? 'border-emerald-400/20 bg-emerald-500/10'
                      : phase.status === 'blocked'
                        ? 'border-amber-400/30 bg-amber-500/10'
                        : 'border-white/10 bg-white/5'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs uppercase tracking-[0.24em] text-slate-400">
                    Phase {phase.index}
                  </div>
                  <Badge
                    className={
                      phase.status === 'active'
                        ? 'border-cyan-400/20 bg-cyan-500/10 text-cyan-100'
                        : phase.status === 'complete'
                          ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100'
                          : phase.status === 'blocked'
                            ? 'border-amber-400/20 bg-amber-500/10 text-amber-100'
                            : 'border-white/10 bg-white/5 text-slate-100'
                    }
                  >
                    {phase.status}
                  </Badge>
                </div>
                <div className="mt-2 text-sm font-medium text-white">{phase.label}</div>
                <Progress value={phase.progress} className="mt-3 h-1.5 bg-white/5" />
              </div>
            ))}
          </CardContent>
        </Card>

        <DossierPhaseRail
          title="Continuous dossier phase rail"
          entityName="Yellow Panther system"
          currentPhaseIndex={currentPhaseIndex}
          progressPercent={completionPercent}
          dossier={{
            metadata: {
              rfp_confidence: successfulRate !== null ? successfulRate / 100 : undefined,
              freshness: pipeline?.status === 'healthy' ? 'fresh' : 'warm',
              next_action: nextAction,
            },
            source_urls: [],
            rawEvidence: mergedFeed.map((item) => item.detail),
          }}
          nextAction={nextAction}
          compact
        />

        <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-4">
            <Card className="border border-white/10 bg-white/[0.03]">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-white">Lane health</CardTitle>
                <CardDescription className="text-slate-300">Scout and enrichment snapshots from the latest run.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium text-white">Scout lane</div>
                      <div className="text-slate-300">{pipeline?.scout?.status ?? 'inactive'}</div>
                    </div>
                    <Badge className="border-cyan-400/20 bg-cyan-500/10 text-cyan-100">
                      Manus
                    </Badge>
                  </div>
                  <div className="mt-2 text-xs text-slate-400">
                    {JSON.stringify(pipeline?.scout?.summary ?? {}, null, 0) || 'No scout summary yet.'}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium text-white">Enrichment lane</div>
                      <div className="text-slate-300">{pipeline?.enrichment?.status ?? 'inactive'}</div>
                    </div>
                    <Badge className="border-fuchsia-400/20 bg-fuchsia-500/10 text-fuchsia-100">
                      OpenCode
                    </Badge>
                  </div>
                  <div className="mt-2 text-xs text-slate-400">
                    {JSON.stringify(enrichment?.statistics ?? {}, null, 0) || 'No enrichment summary yet.'}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center gap-2 text-white">
                    <Brain className="h-4 w-4 text-amber-300" />
                    GLM / Ralph
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-300">
                    Reasoning and validation remain visible so the operator can see why a dossier advanced or stalled.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border border-white/10 bg-white/[0.03]">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-white">Live activity feed</CardTitle>
              <CardDescription className="text-slate-300">
                Latest system events from the continuous loop.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {mergedFeed.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                  No live events yet. The feed will populate as lanes and streams emit updates.
                </div>
              ) : (
                mergedFeed.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Activity className="h-4 w-4 text-cyan-300" />
                        <div className="font-medium text-white">{item.title}</div>
                      </div>
                      <Badge
                        className={
                          item.kind === 'enrichment'
                            ? 'border-fuchsia-400/20 bg-fuchsia-500/10 text-fuchsia-100'
                            : item.kind === 'scout'
                              ? 'border-cyan-400/20 bg-cyan-500/10 text-cyan-100'
                              : item.kind === 'graph'
                                ? 'border-violet-400/20 bg-violet-500/10 text-violet-100'
                                : item.kind === 'validation'
                                  ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100'
                                  : 'border-white/10 bg-white/5 text-slate-100'
                        }
                      >
                        {item.kind}
                      </Badge>
                    </div>
                    <div className="mt-2 text-sm leading-6 text-slate-300">{item.detail}</div>
                    <div className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-500">
                      {formatTimestamp(item.timestamp)}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  );
}
