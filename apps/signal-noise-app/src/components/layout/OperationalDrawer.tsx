"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
// prettier-ignore
import { AlertCircle, ListChecks, Loader2 } from 'lucide-react';

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getCachedOperationalDrilldownPayload,
  loadOperationalDrilldownPayload,
  type OperationalDrilldownPayload,
} from "@/lib/operational-drilldown-client";
import {
  buildOperationalDrawerViewModel,
  type OperationalDrawerPayload,
} from "@/lib/operational-view-model";

interface OperationalDrawerProps {
  open: boolean;
  activeSection: "running" | "blocked" | "completed" | "entities";
  onSelectSection: (
    section: "running" | "blocked" | "completed" | "entities",
  ) => void;
}

const fallbackDashboard: OperationalDrawerPayload = {
  control: {
    is_paused: false,
    pause_reason: null,
    updated_at: null,
  },
  loop_status: {
    total_scheduled: 0,
    completed: 0,
    failed: 0,
    retryable_failures: 0,
    quality_counts: {
      partial: 0,
      blocked: 0,
      complete: 0,
      client_ready: 0,
    },
    runtime_counts: {
      running: 0,
      stalled: 0,
      retryable: 0,
      resume_needed: 0,
    },
  },
  queue: {
    in_progress_entity: null,
    running_entities: [],
    stale_active_rows: [],
    completed_entities: [],
    resume_needed_entities: [],
    upcoming_entities: [],
  },
  playlist_sort_key: [],
  dossier_quality: {
    incomplete_entities: [],
  },
};

function EntityListCard({
  title,
  icon,
  items,
  emptyLabel,
}: {
  title: string;
  icon: React.ReactNode;
  items: Array<{
    key: string;
    title: string;
    subtitle: string;
    detail: string;
    href?: string | null;
    badge?: string | null;
    meta?: string | null;
    facts?: string[];
  }>;
  emptyLabel: string;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-custom-border bg-custom-bg/70 p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-white">
        {icon}
        {title}
      </div>
      <div className="space-y-2">
        {items.length > 0 ? (
          items.map((item) => (
            <div
              key={item.key}
              className="rounded-lg border border-custom-border/80 bg-custom-box/60 p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-medium text-white">{item.title}</div>
                  <div className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">
                    {item.subtitle}
                  </div>
                </div>
                {item.badge ? (
                  <Badge
                    variant="outline"
                    className="border-sky-500/30 text-sky-300"
                  >
                    {item.badge}
                  </Badge>
                ) : null}
              </div>
              <div className="mt-2 text-sm text-fm-light-grey">
                {item.detail}
              </div>
              {item.facts && item.facts.length > 0 ? (
                <div className="mt-2 space-y-1 text-xs text-slate-300">
                  {item.facts.map((fact) => (
                    <div key={fact}>{fact}</div>
                  ))}
                </div>
              ) : null}
              {item.meta ? (
                <div className="mt-2 text-xs text-slate-400">{item.meta}</div>
              ) : null}
              {item.href ? (
                <div className="mt-3">
                  <Link
                    href={item.href}
                    className="text-sm text-sky-300 underline"
                  >
                    Open dossier
                  </Link>
                </div>
              ) : null}
            </div>
          ))
        ) : (
          <div className="rounded-lg border border-custom-border/80 bg-custom-box/60 p-3 text-sm text-fm-light-grey">
            {emptyLabel}
          </div>
        )}
      </div>
    </div>
  );
}

export function OperationalDrawer({
  open,
  activeSection,
  onSelectSection,
}: OperationalDrawerProps) {
  const [dashboard, setDashboard] =
    useState<OperationalDrawerPayload>(fallbackDashboard);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function loadData() {
      if (!cancelled) {
        setIsLoading(true);
        setLoadError(null);
        const cachedPayload = getCachedOperationalDrilldownPayload();
        if (cachedPayload) {
          setDashboard(cachedPayload as OperationalDrawerPayload);
        }
      }
      try {
        const dashboardPayload = await loadOperationalDrilldownPayload();
        if (!cancelled) {
          setDashboard(dashboardPayload as OperationalDrawerPayload);
          setIsLoading(false);
        }
      } catch {
        if (!cancelled) {
          setLoadError("Live run details are taking too long to load.");
          setIsLoading(false);
        }
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, [open]);

  const drawerVm = useMemo(
    () => buildOperationalDrawerViewModel({ dashboard, activeSection }),
    [dashboard, activeSection],
  );

  if (!open) {
    return null;
  }

  return (
    <Card className="border-custom-border bg-custom-box shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ListChecks className="h-4 w-4 text-yellow-400" />
          Operational Snapshot
        </CardTitle>
        {isLoading ? (
          <div className="text-sm text-slate-400">
            Loading live run details…
          </div>
        ) : null}
        {loadError ? (
          <div className="text-sm text-amber-300">{loadError}</div>
        ) : null}
        <div className="text-sm text-slate-300">
          {drawerVm.intakeStatusLabel}
          {dashboard.control?.pause_reason
            ? ` · ${dashboard.control.pause_reason}`
            : ""}
        </div>
        {drawerVm.stopReason ? (
          <div className="text-xs uppercase tracking-[0.14em] text-amber-300">
            Stop reason: {drawerVm.stopReason.replaceAll("_", " ")}
          </div>
        ) : null}
        <div className="text-xs uppercase tracking-[0.14em] text-slate-400">
          Queue order: {drawerVm.playlistSortKeyLabel}
        </div>
      </CardHeader>
      <CardContent className="max-h-[calc(100vh-14rem)] space-y-4 overflow-y-auto pr-2">
        <div className="grid gap-4 lg:grid-cols-4">
          <EntityListCard
            title="Queue"
            icon={<AlertCircle className="h-4 w-4 text-amber-300" />}
            items={drawerVm.queueItems}
            emptyLabel="Waiting for claimable work."
          />
          <EntityListCard
            title="Running entities"
            icon={<Loader2 className="h-4 w-4 text-sky-300" />}
            items={drawerVm.runningItems}
            emptyLabel="Nothing is running right now."
          />
          <EntityListCard
            title="Stale / blocked"
            icon={<AlertCircle className="h-4 w-4 text-amber-300" />}
            items={drawerVm.stoppedItems}
            emptyLabel="No stale or blocked entities right now."
          />
          <EntityListCard
            title="Completed"
            icon={<ListChecks className="h-4 w-4 text-emerald-300" />}
            items={drawerVm.completedItems}
            emptyLabel="No completed entities yet."
          />
        </div>
      </CardContent>
    </Card>
  );
}
