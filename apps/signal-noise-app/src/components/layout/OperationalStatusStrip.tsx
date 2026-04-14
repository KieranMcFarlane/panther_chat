"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ListChecks,
  Loader2,
  PauseCircle,
  PlayCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getCachedOperationalDrilldownPayload,
  refreshOperationalDrilldownPayload,
  type OperationalDrilldownPayload,
} from "@/lib/operational-drilldown-client";
import { formatQuestionProgress } from "@/lib/operational-formatters";
import {
  buildOperationalDrawerViewModel,
  buildOperationalStatusViewModel,
  type OperationalDrawerPayload,
} from "@/lib/operational-view-model";
import {
  resolvePipelineStartTarget,
  type OperationalStartSection,
} from "@/lib/operational-start-target";

interface OperationalStatusStripProps {
  drawerOpen: boolean;
  activeSection: OperationalStartSection;
  onToggleDrawer: () => void;
}

const fallbackDrawerPayload: OperationalDrawerPayload = {
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
                  <a
                    href={item.href}
                    className="text-sm text-sky-300 underline"
                  >
                    Open dossier
                  </a>
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

function formatSessionTimestamp(value: string | null | undefined) {
  if (!value) return "Not available";
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) return value;
  return timestamp.toLocaleString();
}

function describeStartTarget(
  target: ReturnType<typeof resolvePipelineStartTarget>,
  drilldown: OperationalDrilldownPayload | null,
) {
  if (!target) return null;
  const queueItems = [
    drilldown?.queue?.in_progress_entity,
    ...(drilldown?.queue?.running_entities ?? []),
    ...(drilldown?.queue?.stale_active_rows ?? []),
    ...(drilldown?.queue?.completed_entities ?? []),
    ...(drilldown?.queue?.resume_needed_entities ?? []),
    ...(drilldown?.queue?.upcoming_entities ?? []),
    ...(drilldown?.dossier_quality?.incomplete_entities ?? []),
  ];
  const match = queueItems.find(
    (item) => item && String(item.entity_id || "").trim() === target.entityId,
  );
  const entityName = String(match?.entity_name || target.entityId).trim();
  if (target.mode === "question" && target.questionId) {
    return `${entityName} · ${formatQuestionProgress(target.questionId)}`;
  }
  return `${entityName} · full rerun`;
}

export function OperationalStatusStrip({
  drawerOpen,
  activeSection,
  onToggleDrawer,
}: OperationalStatusStripProps) {
  const [drilldown, setDrilldown] =
    useState<OperationalDrilldownPayload | null>(null);
  const [controlState, setControlState] = useState<
    OperationalDrilldownPayload["control"] | null
  >(null);
  const [isTogglingPipeline, setIsTogglingPipeline] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [, setHeartbeatTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function syncLiveOpsState() {
      try {
        const [controlResponse, payload] = await Promise.all([
          fetch("/api/home/pipeline-control", { cache: "no-store" }).then(
            async (response) => {
              if (!response.ok) return null;
              const data = await response.json();
              return data?.control ?? null;
            },
          ),
          refreshOperationalDrilldownPayload(),
        ]);

        if (cancelled) return;
        setDrilldown(payload);
        setControlState(controlResponse ?? payload.control ?? null);
      } catch {
        if (cancelled) return;
        // keep the last visible state on intermittent refresh failures
      }
    }

    const cachedPayload = getCachedOperationalDrilldownPayload();
    if (cachedPayload && !cancelled) {
      setDrilldown(cachedPayload);
      setControlState(cachedPayload.control ?? null);
    }
    void syncLiveOpsState();
    const intervalId = window.setInterval(() => {
      void syncLiveOpsState();
    }, 5000);
    const heartbeatIntervalId = window.setInterval(() => {
      setHeartbeatTick((current) => current + 1);
    }, 1000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.clearInterval(heartbeatIntervalId);
    };
  }, []);

  const statusVm = buildOperationalStatusViewModel({ drilldown, controlState });
  const snapshotVm = useMemo(
    () =>
      buildOperationalDrawerViewModel({
        dashboard: (drilldown ??
          fallbackDrawerPayload) as OperationalDrawerPayload,
        activeSection,
      }),
    [drilldown, activeSection],
  );
  const currentStartTarget = resolvePipelineStartTarget({
    activeSection,
    drilldown,
  });
  const currentStartTargetHint = describeStartTarget(
    currentStartTarget,
    drilldown,
  );
  const primaryActionTitle =
    statusVm.primaryActionLabel === "Resume pipeline" && currentStartTargetHint
      ? `Resume pipeline and rerun target: ${currentStartTargetHint}`
      : statusVm.primaryActionTitle;
  const primaryActionHint =
    statusVm.primaryActionLabel === "Resume pipeline" && currentStartTargetHint
      ? `Resume will also queue ${currentStartTargetHint}.`
      : statusVm.primaryActionHint;

  async function togglePipelinePaused() {
    setIsTogglingPipeline(true);
    try {
      const refreshedBeforeAction = await refreshOperationalDrilldownPayload();
      const refreshedControlState =
        refreshedBeforeAction.control ?? controlState ?? null;
      const actionVm = buildOperationalStatusViewModel({
        drilldown: refreshedBeforeAction,
        controlState: refreshedControlState,
      });
      setDrilldown(refreshedBeforeAction);
      setControlState(refreshedControlState);

      let controlResponse: Response | null = null;
      const startTarget = resolvePipelineStartTarget({
        activeSection,
        drilldown: refreshedBeforeAction,
      });
      const shouldResume = actionVm.primaryActionLabel === "Resume pipeline";
      const shouldRestartStoppedRun = actionVm.isStaleOrStopped;

      if (shouldResume) {
        if (shouldRestartStoppedRun) {
          const stopResponse = await fetch("/api/home/pipeline-control", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              action: "stop",
              is_paused: true,
              pause_reason: "Restarted from Live Ops",
            }),
          });
          if (!stopResponse.ok) {
            throw new Error(
              `Failed to stop pipeline before restart (${stopResponse.status})`,
            );
          }
        }

        if (startTarget) {
          const response = await fetch(
            `/api/entities/${encodeURIComponent(startTarget.entityId)}/dossier/rerun`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                mode: startTarget.mode,
                question_id: startTarget.questionId,
                cascade_dependents: true,
                rerun_reason: shouldRestartStoppedRun
                  ? "Pipeline restart from Live Ops"
                  : "Pipeline resume from Live Ops",
              }),
            },
          );
          if (!response.ok) {
            throw new Error(
              `Failed to queue start target (${response.status})`,
            );
          }
        }
        controlResponse = await fetch("/api/home/pipeline-control", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "start",
            is_paused: false,
            pause_reason: null,
          }),
        });
        if (!controlResponse.ok) {
          throw new Error(
            `Failed to update pipeline control (${controlResponse.status})`,
          );
        }
      } else {
        controlResponse = await fetch("/api/home/pipeline-control", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "stop",
            is_paused: true,
            pause_reason: "Paused from Live Ops",
          }),
        });
        if (!controlResponse.ok) {
          throw new Error(
            `Failed to update pipeline control (${controlResponse.status})`,
          );
        }
      }
      const payload = controlResponse ? await controlResponse.json() : null;
      const refreshedPayload = await refreshOperationalDrilldownPayload();
      setDrilldown(refreshedPayload);
      setControlState(refreshedPayload.control ?? payload?.control ?? null);
    } catch (error) {
      console.error("Failed to toggle pipeline pause state", error);
    } finally {
      setIsTogglingPipeline(false);
    }
  }

  return (
    <section
      className="overflow-hidden rounded-2xl border border-custom-border bg-custom-box shadow-sm transition-[max-height] duration-300 ease-out"
      style={{ maxHeight: isExpanded ? "40rem" : "7rem", padding: "0.7rem" }}
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4 xl:justify-items-start">
            {statusVm.statusItems.map((item) => (
              <button
                key={item.label}
                type="button"
                className="min-w-[140px] rounded-lg border border-custom-border bg-custom-bg/70 px-2.5 py-2 text-left transition hover:border-white/30"
              >
                <div className="text-[0.55rem] uppercase tracking-[0.14em] text-slate-300">
                  {item.label}
                </div>
                <div
                  className={`mt-0.5 text-lg font-semibold leading-none ${item.tone}`}
                >
                  {item.value}
                </div>
              </button>
            ))}
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-2 xl:flex-row xl:items-center xl:justify-end">
            <div className="mr-[6px] flex items-center gap-1.5 overflow-hidden rounded-[8px] border border-custom-border bg-custom-bg/70 px-4 py-[0.8rem]">
              <Badge
                variant="outline"
                className="shrink-0 border-sky-500/30 text-sky-300"
              >
                {statusVm.statusBadgeLabel}
              </Badge>
              <div className="min-w-0 overflow-hidden">
                <div className="animate-marquee flex min-w-max items-center whitespace-nowrap text-[0.72rem] font-medium uppercase tracking-[0.12em] text-fm-light-grey">
                  <div className="flex shrink-0 items-center gap-8 pr-6 sm:pr-8">
                    <span>{statusVm.liveEntityTicker}</span>
                  </div>
                  <div
                    className="flex shrink-0 items-center gap-8 pr-6 sm:pr-8"
                    aria-hidden="true"
                  >
                    <span>{statusVm.liveEntityTicker}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex w-full flex-nowrap items-center justify-end gap-1.5 xl:w-auto xl:max-w-[181px]">
              <Button
                variant="outline"
                className="h-9 shrink-0 border-custom-border px-2 py-1.5 text-[0.72rem] sm:px-3 sm:text-sm"
                onClick={togglePipelinePaused}
                disabled={isTogglingPipeline}
                aria-label={primaryActionTitle}
                title={primaryActionTitle}
              >
                {statusVm.primaryActionLabel === "Resume pipeline" ? (
                  <PlayCircle className="mr-1 h-3.5 w-3.5 sm:mr-2 sm:h-4 sm:w-4" />
                ) : (
                  <PauseCircle className="mr-1 h-3.5 w-3.5 sm:mr-2 sm:h-4 sm:w-4" />
                )}
                {statusVm.primaryActionLabel}
              </Button>
              <Button
                variant="outline"
                className="h-9 shrink-0 border-custom-border px-2 py-1.5 text-[0.72rem] sm:px-3 sm:text-sm"
                onClick={() => setIsExpanded((current) => !current)}
                aria-expanded={isExpanded}
                aria-label={
                  isExpanded
                    ? "Minimize live ops header"
                    : "Expand live ops header"
                }
                title={isExpanded ? "Minimize" : "Expand"}
              >
                {isExpanded ? (
                  <ChevronUp className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                )}
                <span className="sr-only">
                  {isExpanded ? "Minimize" : "Expand"}
                </span>
              </Button>
            </div>
          </div>
        </div>

        {isExpanded ? (
          <div className="rounded-xl border border-custom-border bg-black/20 p-4 text-[0.72rem] text-fm-light-grey">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 space-y-2">
                <div className="text-xs uppercase tracking-[0.14em] text-slate-400">
                  {statusVm.statusBadgeLabel} · Status
                </div>
                <div className="text-lg font-semibold tracking-tight text-white sm:text-xl">
                  {statusVm.statusHero.headline}
                </div>
                <div className="max-w-3xl text-sm leading-6 text-slate-300">
                  {statusVm.statusHero.supportingLine}
                </div>
                {statusVm.statusHero.issueSummary ? (
                  <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                    <div className="font-medium">
                      {statusVm.statusHero.issueSummary}
                    </div>
                    {currentStartTargetHint ? (
                      <div className="mt-1 text-xs uppercase tracking-[0.12em] text-amber-100/80">
                        Resume will queue {currentStartTargetHint}.
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="flex min-w-[16rem] flex-col gap-2 lg:items-end">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    className={`h-9 shrink-0 border-custom-border px-2 py-1.5 text-[0.72rem] sm:px-3 sm:text-sm ${
                      statusVm.statusHero.primaryActionRecommended
                        ? "border-amber-300/40 bg-amber-500/10 text-amber-100 hover:bg-amber-500/15"
                        : ""
                    }`}
                    onClick={togglePipelinePaused}
                    disabled={isTogglingPipeline}
                    aria-label={primaryActionTitle}
                    title={primaryActionTitle}
                  >
                    {statusVm.primaryActionLabel === "Resume pipeline" ? (
                      <PlayCircle className="mr-1 h-3.5 w-3.5 sm:mr-2 sm:h-4 sm:w-4" />
                    ) : (
                      <PauseCircle className="mr-1 h-3.5 w-3.5 sm:mr-2 sm:h-4 sm:w-4" />
                    )}
                    {statusVm.primaryActionLabel}
                  </Button>
                  {statusVm.statusHero.primaryActionRecommended ? (
                    <Badge
                      variant="outline"
                      className="border-amber-300/40 text-amber-100"
                    >
                      Recommended
                    </Badge>
                  ) : null}
                </div>
                <div className="max-w-md text-right text-xs leading-5 text-slate-300">
                  {statusVm.statusHero.primaryActionHint}
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {statusVm.statusHero.detailRows.map((row) => (
                <div
                  key={row.label}
                  className="rounded-lg border border-custom-border/80 bg-custom-box/60 px-3 py-2"
                >
                  <div className="text-[0.55rem] uppercase tracking-[0.14em] text-slate-400">
                    {row.label}
                  </div>
                  <div className="mt-1 text-sm font-medium text-white">
                    {row.value}
                  </div>
                </div>
              ))}
            </div>

            {statusVm.statusHero.debugSummary ||
            statusVm.statusHero.debugCompactLine ? (
              <div className="mt-3 border-t border-white/10 pt-3 text-[0.68rem] tracking-[0.1em] text-slate-300">
                <div className="uppercase tracking-[0.14em] text-slate-400">
                  Debug details
                </div>
                {statusVm.statusHero.debugSummary ? (
                  <div className="mt-1">{statusVm.statusHero.debugSummary}</div>
                ) : null}
                {statusVm.statusHero.debugCompactLine ? (
                  <div>{statusVm.statusHero.debugCompactLine}</div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {isExpanded ? (
          <Card className="border-custom-border bg-custom-box shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ListChecks className="h-4 w-4 text-yellow-400" />
                Operational Snapshot
              </CardTitle>
              <div className="text-sm text-slate-300">
                {snapshotVm.intakeStatusLabel}
                {drilldown?.control?.pause_reason
                  ? ` · ${drilldown.control.pause_reason}`
                  : ""}
              </div>
              {snapshotVm.stopReason ? (
                <div className="text-xs uppercase tracking-[0.14em] text-amber-300">
                  Stop reason: {snapshotVm.stopReason.replaceAll("_", " ")}
                </div>
              ) : null}
              <div className="text-xs uppercase tracking-[0.14em] text-slate-400">
                Queue order: {snapshotVm.playlistSortKeyLabel}
              </div>
            </CardHeader>
            <CardContent className="max-h-[calc(100vh-14rem)] space-y-4 overflow-y-auto pr-2">
              <div className="grid gap-4 lg:grid-cols-4">
                <EntityListCard
                  title="Queue"
                  icon={<AlertCircle className="h-4 w-4 text-amber-300" />}
                  items={snapshotVm.queueItems}
                  emptyLabel="Waiting for claimable work."
                />
                <EntityListCard
                  title="Running entities"
                  icon={<Loader2 className="h-4 w-4 text-sky-300" />}
                  items={snapshotVm.runningItems}
                  emptyLabel="Nothing is running right now."
                />
                <EntityListCard
                  title="Stale / blocked"
                  icon={<AlertCircle className="h-4 w-4 text-amber-300" />}
                  items={snapshotVm.stoppedItems}
                  emptyLabel="No stale or blocked entities right now."
                />
                <EntityListCard
                  title="Completed"
                  icon={<ListChecks className="h-4 w-4 text-emerald-300" />}
                  items={snapshotVm.completedItems}
                  emptyLabel="No completed entities yet."
                />
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </section>
  );
}
