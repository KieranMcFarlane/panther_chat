'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, Clock3, Loader2, RefreshCw, Sparkles } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';

interface EnrichmentLaneSummary {
  total_candidates?: number;
  enriched?: number;
  company_matches?: number;
  contact_matches?: number;
  message?: string;
  state?: string;
}

interface EnrichmentLaneArtifact {
  id?: string;
  lane?: string;
  system?: string;
  source_lane?: string;
  source_artifact_id?: string;
  status?: string;
  summary?: EnrichmentLaneSummary;
  enriched_candidates?: Array<{
    id?: string;
    company?: {
      name?: string;
      domain?: string;
    };
    contacts?: unknown[];
    decision_makers?: string[];
  }>;
}

interface EnrichmentLaneSnapshot {
  lane: 'enrichment';
  status: 'inactive' | 'queued' | 'running' | 'completed' | 'failed' | 'active' | 'degraded';
  file_path: string | null;
  updated_at: string | null;
  summary: EnrichmentLaneSummary;
  artifact: EnrichmentLaneArtifact | null;
}

interface QueueRequest {
  requestId: string;
  filePath: string;
  payload: Record<string, unknown>;
}

function formatTimestamp(timestamp: string | null): string {
  if (!timestamp) return 'n/a';

  try {
    return new Date(timestamp).toLocaleString();
  } catch {
    return timestamp;
  }
}

function formatStatus(status: EnrichmentLaneSnapshot['status']) {
  if (status === 'queued') return 'Queued';
  if (status === 'running' || status === 'active') return 'Running';
  if (status === 'completed') return 'Completed';
  if (status === 'failed' || status === 'degraded') return 'Blocked';
  return 'Idle';
}

function isLiveStatus(status: EnrichmentLaneSnapshot['status']) {
  return status === 'queued' || status === 'running' || status === 'active';
}

export default function EntityEnrichmentDashboard() {
  const [snapshot, setSnapshot] = useState<EnrichmentLaneSnapshot | null>(null);
  const [queuedRequest, setQueuedRequest] = useState<QueueRequest | null>(null);
  const [loading, setLoading] = useState(false);
  const [queueing, setQueueing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchSnapshot = useCallback(async () => {
    try {
      const response = await fetch('/api/discovery-lanes/enrichment', { cache: 'no-store' });
      const data = await response.json();

      if (data.success) {
        setSnapshot(data.data);
        setError(null);
      } else {
        setError(data.error || 'Unable to load the enrichment lane');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load the enrichment lane');
    } finally {
      setLoading(false);
    }
  }, []);

  const queueEnrichment = useCallback(async () => {
    setQueueing(true);
    try {
      const response = await fetch('/api/discovery-lanes/enrichment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          objective: 'Refresh the OpenCode enrichment lane for sports entities',
          source_lane: 'scout',
        }),
      });
      const data = await response.json();

      if (data.success) {
        setQueuedRequest(data.data?.request ?? null);
        await fetchSnapshot();
      } else {
        setError(data.error || 'Unable to queue enrichment');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to queue enrichment');
    } finally {
      setQueueing(false);
    }
  }, [fetchSnapshot]);

  useEffect(() => {
    setLoading(true);
    void fetchSnapshot();
  }, [fetchSnapshot]);

  useEffect(() => {
    const live = snapshot ? isLiveStatus(snapshot.status) : false;

    if (!autoRefresh || !live) {
      return;
    }

    const interval = window.setInterval(fetchSnapshot, 5000);
    return () => window.clearInterval(interval);
  }, [autoRefresh, snapshot, fetchSnapshot]);

  const completionPercentage = useMemo(() => {
    if (!snapshot) return 0;

    const total = snapshot.summary?.total_candidates ?? 0;
    const enriched = snapshot.summary?.enriched ?? 0;
    if (total <= 0) return 0;

    return Math.min(100, Math.round((enriched / total) * 100));
  }, [snapshot]);

  const summaryCards = useMemo(() => {
    const totalCandidates = snapshot?.summary?.total_candidates ?? 0;
    const enriched = snapshot?.summary?.enriched ?? 0;
    const companyMatches = snapshot?.summary?.company_matches ?? 0;
    const contactMatches = snapshot?.summary?.contact_matches ?? 0;

    return [
      { label: 'Candidates', value: String(totalCandidates), detail: 'From the current OpenCode queue.' },
      { label: 'Enriched', value: String(enriched), detail: 'Candidates with company context attached.' },
      { label: 'Company matches', value: String(companyMatches), detail: 'Company-level enrichment hits.' },
      { label: 'Contact matches', value: String(contactMatches), detail: 'Decision-maker and contact matches.' },
    ];
  }, [snapshot]);

  const latestArtifact = snapshot?.artifact ?? null;

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="border-fuchsia-400/20 bg-fuchsia-500/10 text-fuchsia-100">OpenCode</Badge>
            <Badge className="border-cyan-400/20 bg-cyan-500/10 text-cyan-100">BrightData MCP</Badge>
            <Badge className="border-emerald-400/20 bg-emerald-500/10 text-emerald-100">LeadIQ</Badge>
          </div>
          <h1 className="text-2xl font-bold">Entity Enrichment Lane</h1>
          <p className="max-w-3xl text-muted-foreground">
            This surface now follows the discovery-lane workflow. It queues OpenCode enrichment work, captures BrightData MCP evidence,
            and expands candidate context with LeadIQ. The legacy batch path is no longer the source of truth here.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="autoRefresh"
              checked={autoRefresh}
              onChange={(event) => setAutoRefresh(event.target.checked)}
              className="rounded"
            />
            <label htmlFor="autoRefresh" className="text-sm">
              Auto-refresh
            </label>
          </div>

          <Button onClick={queueEnrichment} disabled={queueing}>
            {queueing ? 'Queueing...' : 'Queue Enrichment'}
          </Button>

          <Button onClick={fetchSnapshot} disabled={loading} variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-700">Error: {error}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                Enrichment status
                <Badge variant={isLiveStatus(snapshot?.status ?? 'inactive') ? 'default' : 'secondary'}>
                  {formatStatus(snapshot?.status ?? 'inactive')}
                </Badge>
              </CardTitle>
              <CardDescription>
                {snapshot?.summary?.message || 'No enrichment batch is currently queued.'}
              </CardDescription>
            </div>

            <div className="text-right text-sm text-muted-foreground">
              <div>Updated: {formatTimestamp(snapshot?.updated_at ?? null)}</div>
              <div>Artifact: {snapshot?.file_path ?? 'n/a'}</div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progress</span>
              <span>{completionPercentage}%</span>
            </div>
            <Progress value={completionPercentage} className="w-full" />
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>
                {snapshot?.summary?.enriched ?? 0} / {snapshot?.summary?.total_candidates ?? 0} candidates enriched
              </span>
              <span>{latestArtifact?.source_lane ? `Source lane: ${latestArtifact.source_lane}` : 'Waiting for the next artifact'}</span>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map((item) => (
              <div key={item.label} className="rounded-xl border border-border bg-muted/35 p-4">
                <div className="text-xs uppercase tracking-[0.28em] text-muted-foreground">{item.label}</div>
                <div className="mt-2 text-3xl font-semibold">{item.value}</div>
                <div className="mt-2 text-sm text-muted-foreground">{item.detail}</div>
              </div>
            ))}
          </div>

          {queuedRequest && (
            <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-4">
              <div className="font-medium text-cyan-950">Queued request</div>
              <div className="mt-1 text-sm text-cyan-900">{queuedRequest.requestId}</div>
              <div className="mt-1 text-xs text-cyan-800">{queuedRequest.filePath}</div>
            </div>
          )}

          {latestArtifact && (
            <div className="rounded-xl border border-border bg-muted/35 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium">Latest artifact</div>
                  <div className="text-sm text-muted-foreground">
                    {latestArtifact.system?.toUpperCase() ?? 'OpenCode'} · {latestArtifact.status ?? 'unknown'}
                  </div>
                </div>
                <Badge variant="outline">{latestArtifact.id ?? 'artifact'}</Badge>
              </div>
              <div className="mt-3 text-sm text-muted-foreground">
                {latestArtifact.summary
                  ? `${latestArtifact.summary.enriched ?? 0} candidates enriched · ${latestArtifact.summary.company_matches ?? 0} company matches · ${latestArtifact.summary.contact_matches ?? 0} contact matches`
                  : 'No artifact summary available yet.'}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {latestArtifact?.enriched_candidates && latestArtifact.enriched_candidates.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent enrichment output</CardTitle>
            <CardDescription>Latest candidates produced by the OpenCode lane</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-56">
              <div className="space-y-2">
                {latestArtifact.enriched_candidates.slice(0, 5).map((candidate, index) => (
                  <div key={candidate.id ?? index} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <span className="font-medium">{candidate.company?.name ?? 'Unknown company'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{candidate.contacts?.length ?? 0} contacts</span>
                      <span>{candidate.decision_makers?.length ?? 0} decision makers</span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>How it works now</CardTitle>
          <CardDescription>Current enrichment flow for the OpenCode lane</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-border bg-muted/35 p-4">
              <div className="text-2xl mb-2">🔍</div>
              <h3 className="font-medium mb-1">BrightData MCP evidence</h3>
              <p className="text-sm text-muted-foreground">
                Capture source-backed web evidence before enrichment expands the candidate.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-muted/35 p-4">
              <div className="text-2xl mb-2">🧩</div>
              <h3 className="font-medium mb-1">OpenCode enrichment</h3>
              <p className="text-sm text-muted-foreground">
                Build structured candidate context from the scout output and queued requests.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-muted/35 p-4">
              <div className="text-2xl mb-2">👥</div>
              <h3 className="font-medium mb-1">LeadIQ expansion</h3>
              <p className="text-sm text-muted-foreground">
                Expand company and people context so downstream dossier decisions stay grounded.
              </p>
            </div>
          </div>

          <Separator />

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center gap-2 font-medium text-amber-950">
              <Clock3 className="h-4 w-4" />
              Before you queue another run
            </div>
            <ul className="mt-2 space-y-1 text-sm text-amber-900">
              <li>• Use the discovery-lane snapshot as the source of truth for enrichment status.</li>
              <li>• Queue work only when there is scout output to enrich.</li>
              <li>• Treat the old batch service as legacy; this page does not depend on it.</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between rounded-xl border border-border bg-muted/35 p-4">
        <div>
          <div className="font-medium">Need the lane-only view?</div>
          <div className="text-sm text-muted-foreground">The discovery workspace keeps the same OpenCode enrichment lane in a lighter layout.</div>
        </div>
        <Button asChild variant="outline">
          <Link href="/enrichment">
            Open lane view
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
