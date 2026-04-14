import {
  formatElapsedDuration,
  formatHeartbeatAge,
  formatQuestionProgress,
  formatRunningDuration,
} from "@/lib/operational-formatters";
import type {
  OperationalDrilldownPayload,
  OperationalQueueEntity,
} from "@/lib/operational-drilldown-client";
import { formatPlaylistSortKey } from "@/lib/playlist-sort-key";

export type OperationalRuntimeEntity = OperationalQueueEntity & {
  repair_state?: string | null;
};

export type OperationalStatusViewModel = {
  pipelinePaused: boolean;
  operationalState: string;
  stopReason: string | null;
  canStartPipeline: boolean;
  playerStatusLabel: string;
  statusBadgeLabel: string;
  requestedStateLabel: string;
  workerStateLabel: string;
  activityStateLabel: string;
  primaryActionLabel: string;
  primaryActionTitle: string;
  primaryActionHint: string;
  isTransitioning: boolean;
  isRequestedRunning: boolean;
  isRequestedPaused: boolean;
  hasActiveWork: boolean;
  isStaleOrStopped: boolean;
  currentQuestionLabel: string;
  currentElapsedLabel: string;
  lastCompletedLabel: string;
  liveEntityTicker: string;
  sessionSummary: string | null;
  sessionCompactLine: string | null;
  statusHero: {
    headline: string;
    supportingLine: string;
    issueSummary: string | null;
    primaryActionRecommended: boolean;
    primaryActionLabel: string;
    primaryActionTitle: string;
    primaryActionHint: string;
    detailRows: Array<{
      label: string;
      value: string;
    }>;
    debugSummary: string | null;
    debugCompactLine: string | null;
  };
  statusItems: Array<{
    label: string;
    value: string;
    tone: string;
  }>;
};

export type OperationalCardItem = {
  key: string;
  entity_id: string;
  title: string;
  subtitle: string;
  detail: string;
  href: string | null;
  badge: string | null;
  current_question_id: string | null;
  current_action: string | null;
  current_stage: string | null;
  next_action: string;
  lifecycle_label: string | null;
  lifecycle_summary: string | null;
  movement_state: string | null;
  facts: string[];
  meta: string | null;
  next_repair_batch_href: string | null;
};

export type OperationalDrawerEntity = {
  entity_id: string;
  entity_name: string;
  entity_type: string;
  summary: string | null;
  generated_at: string | null;
  heartbeat_at?: string | null;
  active_question_id?: string | null;
  run_phase?: string | null;
  queue_position?: number | null;
  publication_status?: string | null;
  next_repair_question_id?: string | null;
  next_repair_status?: string | null;
  next_repair_batch_id?: string | null;
  current_question_id?: string | null;
  current_action?: string | null;
  next_action?: string | null;
  lifecycle_label?: string | null;
  lifecycle_summary?: string | null;
  movement_state?: string | null;
  browser_entity_id?: string | null;
  quality_summary?: string | null;
  quality_state?: string | null;
  current_stage?: string | null;
};

export type OperationalDrawerPayload = OperationalDrilldownPayload & {
  queue: {
    in_progress_entity: OperationalDrawerEntity | null;
    stale_active_rows?: OperationalDrawerEntity[];
    completed_entities: OperationalDrawerEntity[];
    resume_needed_entities: OperationalDrawerEntity[];
    upcoming_entities: OperationalDrawerEntity[];
  };
  playlist_sort_key: string[];
  dossier_quality: {
    incomplete_entities: Array<{
      entity_id: string;
      browser_entity_id: string;
      entity_name: string;
      entity_type: string;
      quality_state: string;
      quality_summary: string | null;
      generated_at: string | null;
      current_question_id?: string | null;
      current_action?: string | null;
      current_stage?: string | null;
      lifecycle_label?: string | null;
      lifecycle_summary?: string | null;
      movement_state?: string | null;
      next_action?: string | null;
      next_repair_batch_id?: string | null;
    }>;
  };
};

function formatDate(value: string | null | undefined) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export function toText(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value);
}

export function formatPublicationState(value: string | null | undefined) {
  if (value === "published_degraded") return "Published degraded";
  if (value === "published") return "Published healthy";
  return "Pending publication";
}

export function formatMovementState(value: string | null | undefined) {
  if (value === "moving") return "Moving";
  if (value === "queued") return "Queued";
  if (value === "stalled") return "Stopped";
  if (value === "review") return "Review needed";
  return "Blocked";
}

export function formatNextRepair(value: string | null | undefined) {
  if (value === "running") return "Next repair running";
  if (value === "queued") return "Next repair queued";
  if (value === "planned") return "Next repair planned";
  return null;
}

function asArray<T>(value: T[] | null | undefined) {
  return Array.isArray(value) ? value : [];
}

function titleCaseWord(value: string) {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatControlStateLabel(
  value: string | null | undefined,
  fallback: string,
) {
  const normalized = toText(value).toLowerCase();
  if (!normalized) return fallback;
  return titleCaseWord(normalized.replaceAll("_", " "));
}

function buildLastCompletedLabel(entity: OperationalRuntimeEntity | null) {
  if (!entity) return "No recent completions";
  const questionId =
    toText(entity.last_completed_question) ||
    toText(entity.current_question_id) ||
    toText(entity.active_question_id);
  const questionLabel = questionId
    ? formatQuestionProgress(questionId)
    : toText(entity.current_action) ||
      toText(entity.run_phase) ||
      "Completed";
  return `${toText(entity.entity_name) || "Unknown entity"} · ${questionLabel}`;
}

function buildStatusHeroCopy(input: {
  isTransitioning: boolean;
  isRequestedPaused: boolean;
  isRequestedRunning: boolean;
  isWaiting: boolean;
  isActuallyPaused: boolean;
  isActuallyStopped: boolean;
  isStaleOrStopped: boolean;
  hasFreshActiveWork: boolean;
  hasStaleActiveWork: boolean;
  repairFocus: boolean;
  stopReason: string | null;
  stopDetails: Record<string, unknown> | null;
  activeEntity: OperationalRuntimeEntity | null;
  activeActionLabel: string | null;
  activeRunPhaseLabel: string | null;
  activeSessionLabel: string;
  currentQuestionLabel: string;
  currentElapsedLabel: string;
  lastCompletedLabel: string;
  requestedStateLabel: string;
  workerStateLabel: string;
  activityStateLabel: string;
  controlUpdatedLabel: string;
  controlUpdatedExactLabel: string;
}) {
  const {
    isTransitioning,
    isRequestedPaused,
    isWaiting,
    isActuallyPaused,
    isActuallyStopped,
    isStaleOrStopped,
    hasFreshActiveWork,
    hasStaleActiveWork,
    repairFocus,
    stopReason,
    stopDetails,
    activeEntity,
    activeActionLabel,
    activeRunPhaseLabel,
    activeSessionLabel,
    currentQuestionLabel,
    currentElapsedLabel,
    lastCompletedLabel,
    requestedStateLabel,
    workerStateLabel,
    activityStateLabel,
    controlUpdatedLabel,
    controlUpdatedExactLabel,
  } = input;

  const headline = isTransitioning
    ? workerStateLabel === "Starting"
      ? "Starting intake…"
      : "Stopping intake…"
    : isRequestedPaused
      ? isStaleOrStopped
        ? "Paused with a stale session…"
        : "Pipeline paused…"
      : hasFreshActiveWork
        ? repairFocus
          ? "Repairing active work…"
          : "Pipeline running…"
        : hasStaleActiveWork
          ? "Stale session detected…"
          : isWaiting
            ? "Waiting for claimable work…"
            : isActuallyStopped
              ? "Pipeline stopped…"
              : "Idle…";

  const supportingLine = isTransitioning
    ? workerStateLabel === "Starting"
      ? "Pipeline control is transitioning. Waiting for the worker to confirm the new state."
      : "Pipeline is safely shutting down. No new work is being accepted."
    : isRequestedPaused
      ? isStaleOrStopped
        ? "The pipeline is paused and the latest session needs recovery before it can continue."
        : "Pipeline intake is paused until you resume it."
      : hasFreshActiveWork
        ? repairFocus
          ? "The worker is repairing the active session and will continue once the repair step completes."
          : "The worker is processing active work."
        : hasStaleActiveWork
          ? "The latest session is stale and should be recovered before it can continue."
          : isWaiting
            ? "No entity is running right now, but the queue is ready."
            : isActuallyStopped
              ? "No new work is being processed until the pipeline is resumed."
              : "No active work is currently visible.";

  const issueSummary =
    isStaleOrStopped && activeEntity
      ? `Stale session detected for ${activeEntity.entity_name}.`
      : isActuallyPaused && stopReason
        ? `Pipeline paused because ${String(stopReason).replaceAll("_", " ")}.`
        : isActuallyStopped && stopReason
          ? `Pipeline stopped because ${String(stopReason).replaceAll("_", " ")}.`
          : null;

  const primaryActionRecommended =
    isRequestedPaused || isStaleOrStopped || isWaiting || isActuallyStopped;

  const primaryActionLabel = isRequestedPaused || isStaleOrStopped || isWaiting || isActuallyStopped
    ? "Resume pipeline"
    : "Pause pipeline";

  const primaryActionTitle = isRequestedPaused || isStaleOrStopped || isWaiting || isActuallyStopped
    ? "Resume pipeline intake"
    : isTransitioning
      ? "Pause pipeline intake while the worker is transitioning"
      : "Pause pipeline intake";

  const primaryActionHint = isRequestedPaused || isStaleOrStopped || isWaiting || isActuallyStopped
    ? isStaleOrStopped
      ? "Resume pipeline intake and recover the stale session if a target is available."
      : isWaiting
        ? "Resume pipeline intake and wait for the next claimable entity."
        : "Resume pipeline intake."
    : isTransitioning
      ? "Pause pipeline intake while the worker transition is still in flight."
      : "Pause pipeline intake after the current control request is applied.";

  const detailRows = [
    { label: "Requested", value: requestedStateLabel.replace("Requested ", "") },
    { label: "Worker", value: workerStateLabel },
    { label: "Activity", value: activityStateLabel },
    { label: "Current question", value: currentQuestionLabel },
    { label: "Elapsed", value: currentElapsedLabel },
    { label: "Last completed", value: lastCompletedLabel },
    { label: "Updated", value: `${controlUpdatedLabel}${controlUpdatedExactLabel ? ` · ${controlUpdatedExactLabel}` : ""}` },
  ];

  const debugSummary = activeEntity
    ? `${isStaleOrStopped ? "Stale session" : isActuallyPaused ? "Paused session" : isActuallyStopped ? "Stopped session" : "Current session"} — ${String(activeEntity.entity_name || "Unknown entity")} — ${activeActionLabel || activeRunPhaseLabel || "phase unavailable"} — ${activeSessionLabel}`
    : null;

  const debugCompactLine = activeEntity
    ? `Session: ${String(activeEntity.batch_id || activeEntity.entity_id)} · ${activeActionLabel || activeRunPhaseLabel || "phase unavailable"} · ${activeSessionLabel} · ${input.stopReason ? `reason ${String(input.stopReason).replaceAll("_", " ")}` : currentElapsedLabel}`
    : null;

  return {
    headline,
    supportingLine,
    issueSummary,
    primaryActionRecommended,
    primaryActionLabel,
    primaryActionTitle,
    primaryActionHint,
    detailRows,
    debugSummary,
    debugCompactLine,
  };
}

export function buildEntityDossierHref(entityId: string) {
  return `/entity-browser/${encodeURIComponent(entityId)}/dossier?from=1`;
}

export function buildRepairBatchHref(
  batchId: string | null | undefined,
  entityId: string,
) {
  if (!batchId) return null;
  return `/entity-import/${encodeURIComponent(batchId)}/${encodeURIComponent(entityId)}`;
}

export function buildEntityCardBase(
  entity: OperationalDrawerEntity,
  options?: {
    hrefEntityId?: string | null;
    badge?: string | null;
    detail?: string;
    nextAction?: string;
    facts?: string[];
    meta?: string | null;
    currentQuestion?: string | null;
    currentAction?: string | null;
    currentStage?: string | null;
    lifecycleLabel?: string | null;
    lifecycleSummary?: string | null;
    movementState?: string | null;
  },
): OperationalCardItem {
  const hrefEntityId = options?.hrefEntityId ?? entity.entity_id;
  const currentQuestion =
    options?.currentQuestion ?? (toText(entity.active_question_id) || null);
  const currentAction =
    options?.currentAction ??
    (toText(entity.current_action) || toText(entity.run_phase) || null);
  const currentStage =
    options?.currentStage ?? (toText(entity.run_phase) || null);
  const lifecycleLabel =
    options?.lifecycleLabel ?? (toText(entity.lifecycle_label) || null);
  const lifecycleSummary =
    options?.lifecycleSummary ?? (toText(entity.lifecycle_summary) || null);
  const movementState =
    options?.movementState ?? (toText(entity.movement_state) || null);
  const nextRepairBatchHref = buildRepairBatchHref(
    entity.next_repair_batch_id,
    entity.entity_id,
  );

  return {
    key: options?.meta
      ? `${entity.entity_id}-${options.meta}`
      : entity.entity_id,
    entity_id: entity.entity_id,
    title: entity.entity_name,
    subtitle: entity.entity_type,
    detail: options?.detail ?? (toText(entity.summary) || ""),
    href: hrefEntityId ? buildEntityDossierHref(hrefEntityId) : null,
    badge: options?.badge ?? null,
    current_question_id: currentQuestion,
    current_action: currentAction,
    current_stage: currentStage,
    next_action:
      options?.nextAction ?? (toText(entity.next_action) || "Not available"),
    lifecycle_label: lifecycleLabel,
    lifecycle_summary: lifecycleSummary,
    movement_state: movementState,
    facts: options?.facts ?? [],
    meta: options?.meta ?? null,
    next_repair_batch_href: nextRepairBatchHref,
  };
}

export function buildEntityFacts(
  entity: OperationalDrawerEntity,
  options: {
    currentQuestionFallback: string;
    runPhaseFallback: string;
    queueOrderLabel: string;
    includeCurrentAction?: boolean;
  },
) {
  const facts = [
    `Current question: ${toText(entity.active_question_id) || options.currentQuestionFallback}`,
  ];
  if (options.includeCurrentAction !== false) {
    facts.push(
      `Current action: ${toText(entity.current_action) || toText(entity.run_phase) || "n/a"}`,
    );
  }
  facts.push(
    `Run phase: ${toText(entity.run_phase) || options.runPhaseFallback}`,
    formatHeartbeatAge(toText(entity.heartbeat_at) || null),
    options.queueOrderLabel,
  );
  return facts;
}

export function buildOperationalStatusViewModel(input: {
  drilldown: OperationalDrilldownPayload | null;
  controlState: OperationalDrilldownPayload["control"] | null;
}) {
  const drilldown = input.drilldown;
  const controlState = input.controlState;
  const inProgressEntity =
    (drilldown?.queue?.in_progress_entity as OperationalRuntimeEntity | null) ??
    null;
  const staleActiveRows = asArray(drilldown?.queue?.stale_active_rows);
  const staleActiveEntity =
    staleActiveRows.length > 0
      ? (staleActiveRows[0] as OperationalRuntimeEntity)
      : null;
  const latestCompletedEntity =
    (asArray(drilldown?.queue?.completed_entities)[0] as
      | OperationalRuntimeEntity
      | null) ?? null;
  const requestedState =
    controlState?.requested_state === "paused" || controlState?.is_paused === true
      ? "paused"
      : "running";
  const transitionState =
    controlState?.transition_state ||
    controlState?.observed_state ||
    (requestedState === "paused" ? "paused" : "running");
  const observedState =
    controlState?.observed_state || transitionState || requestedState;
  const pipelinePaused = requestedState === "paused";
  const operationalState =
    drilldown?.operational_state ||
    (pipelinePaused
      ? "off"
      : staleActiveRows.length > 0
        ? "stopped"
        : "running");
  const stopReason =
    typeof drilldown?.stop_reason === "string" ? drilldown.stop_reason : null;
  const stopDetails =
    drilldown?.stop_details && typeof drilldown.stop_details === "object"
      ? drilldown.stop_details
      : null;
  const freshActiveEntity = inProgressEntity;
  const activeEntity = freshActiveEntity ?? staleActiveEntity;
  const hasFreshActiveWork = Boolean(freshActiveEntity);
  const hasStaleActiveWork = Boolean(staleActiveEntity);
  const repairFocus = Boolean(
    activeEntity &&
      (activeEntity.repair_state === "repairing" ||
        activeEntity.next_repair_status === "running"),
  );
  const isRequestedPaused = requestedState === "paused";
  const isRequestedRunning = requestedState === "running";
  const isTransitioning =
    transitionState === "starting" || transitionState === "stopping";
  const isWaiting =
    operationalState === "waiting" ||
    (!hasFreshActiveWork &&
      !hasStaleActiveWork &&
      !isRequestedPaused &&
      !isTransitioning);
  const isActuallyPaused = operationalState === "paused" || isRequestedPaused;
  const isActuallyStopped =
    operationalState === "stopped" ||
    (hasStaleActiveWork &&
      !hasFreshActiveWork &&
      !isTransitioning &&
      !isRequestedPaused) ||
    Boolean(stopReason);
  const isStaleOrStopped = Boolean(
    isActuallyStopped ||
      (hasStaleActiveWork &&
        !isTransitioning &&
        !isRequestedPaused &&
        !hasFreshActiveWork),
  );
  const hasActiveWork = hasFreshActiveWork;
  const canStartPipeline = isRequestedPaused || isActuallyStopped || isWaiting;
  const requestedStateLabel = isRequestedPaused
    ? "Requested paused"
    : "Requested running";
  const workerStateLabel = formatControlStateLabel(
    isTransitioning ? transitionState : observedState,
    isRequestedPaused ? "Paused" : "Running",
  );
  const activityStateLabel = hasActiveWork
    ? operationalState === "retrying"
      ? "Retrying"
      : operationalState === "skipping"
        ? "Skipping"
        : repairFocus
          ? "Repairing"
          : "Running"
    : isTransitioning
      ? transitionState === "starting"
        ? "Starting"
        : "Stopping"
      : hasStaleActiveWork
        ? "Stale"
        : isActuallyPaused
          ? "Paused"
          : isWaiting
            ? "Waiting"
            : isActuallyStopped
              ? "Stopped"
              : "Idle";
  const statusBadgeLabel = isTransitioning
    ? workerStateLabel
    : hasFreshActiveWork
      ? activityStateLabel
      : hasStaleActiveWork
        ? "Stale"
        : isActuallyPaused
          ? "Paused"
          : isWaiting
            ? "Waiting"
            : isActuallyStopped
              ? "Stopped"
              : "Idle";
  const playerStatusLabel = statusBadgeLabel;
  const primaryActionLabel = canStartPipeline
    ? "Resume pipeline"
    : "Pause pipeline";
  const primaryActionTitle = canStartPipeline
    ? "Resume pipeline intake"
    : isTransitioning
      ? "Pause pipeline intake while the worker is transitioning"
      : "Pause pipeline intake";
  const primaryActionHint = canStartPipeline
    ? isStaleOrStopped
      ? "Resume pipeline intake and recover the stale session if a target is available."
      : isWaiting
        ? "Resume pipeline intake and wait for the next claimable entity."
        : "Resume pipeline intake."
    : isTransitioning
      ? "Pause pipeline intake while the worker transition is still in flight."
      : "Pause pipeline intake after the current control request is applied.";
  const activeQuestionEntity = freshActiveEntity ?? staleActiveEntity;
  const activeQuestionLabel = activeQuestionEntity
    ? formatQuestionProgress(
        activeQuestionEntity.current_question_id || activeQuestionEntity.active_question_id,
      )
    : null;
  const activeRunPhaseLabel = activeQuestionEntity
    ? String(activeQuestionEntity.run_phase || "")
        .trim()
        .replaceAll("_", " ") || "phase unavailable"
    : null;
  const activeActionLabel = activeQuestionEntity
    ? String(
        activeQuestionEntity.current_action ||
          activeQuestionEntity.next_action ||
          activeRunPhaseLabel ||
          "",
      ).trim() || null
    : null;
  const activeSessionLabel =
    activeQuestionLabel ??
    activeActionLabel ??
    activeRunPhaseLabel ??
    (isActuallyPaused || isActuallyStopped
      ? "Session inactive"
      : isWaiting
        ? "Waiting for claimable work"
        : "Question unavailable");
  const activeHeartbeatLabel = activeQuestionEntity
    ? formatHeartbeatAge(
        activeQuestionEntity.heartbeat_at ||
          activeQuestionEntity.started_at ||
          activeQuestionEntity.generated_at,
        "heartbeat",
      )
    : "No active worker";
  const currentElapsedLabel = freshActiveEntity
    ? formatElapsedDuration(
        freshActiveEntity.started_at || freshActiveEntity.generated_at,
      )
    : staleActiveEntity
      ? formatElapsedDuration(
          staleActiveEntity.started_at || staleActiveEntity.generated_at,
          staleActiveEntity.heartbeat_at || staleActiveEntity.generated_at,
        )
        : latestCompletedEntity
        ? formatElapsedDuration(
            latestCompletedEntity.started_at || latestCompletedEntity.generated_at,
            latestCompletedEntity.generated_at,
          )
        : "Unknown duration";
  const lastCompletedLabel = buildLastCompletedLabel(latestCompletedEntity);
  const liveEntityTicker = isTransitioning
    ? transitionState === "starting"
      ? "Starting — waiting for fresh heartbeat"
      : "Stopping — pipeline intake is shutting down"
    : isRequestedPaused
      ? stopReason
        ? `Paused — ${String(stopDetails?.entity_name || "Pipeline")} — ${String(stopReason).replaceAll("_", " ")}`
        : "Paused — intake is waiting for resume"
      : freshActiveEntity
        ? `${activityStateLabel} — ${freshActiveEntity.entity_name} — ${activeActionLabel || activeRunPhaseLabel || "phase unavailable"} — ${activeHeartbeatLabel || formatRunningDuration(freshActiveEntity.started_at || freshActiveEntity.generated_at)}`
        : staleActiveEntity
          ? `Stale — ${String(staleActiveEntity.entity_name || "Unknown entity")} — ${
              String(staleActiveEntity.run_phase || "")
                .trim()
                .replaceAll("_", " ") || "phase unavailable"
            } — ${formatHeartbeatAge(String(staleActiveEntity.heartbeat_at || staleActiveEntity.started_at || staleActiveEntity.generated_at || ""), "heartbeat")}`
          : isActuallyStopped
            ? "Stopped — waiting for restart"
            : "Idle — waiting for claimable work";
  const sessionEntity = activeQuestionEntity ?? latestCompletedEntity;
  const sessionQuestionId = sessionEntity
    ? String(
        sessionEntity.current_question_id ||
          sessionEntity.active_question_id ||
          sessionEntity.last_completed_question ||
          sessionEntity.next_repair_question_id ||
          "",
      ).trim() || null
    : null;
  const currentQuestionLabel = activeQuestionLabel
    ? activeQuestionLabel
    : sessionQuestionId
      ? formatQuestionProgress(sessionQuestionId)
      : isActuallyPaused || isActuallyStopped
        ? "Session inactive"
        : isWaiting
          ? "Waiting for claimable work"
          : latestCompletedEntity
        ? formatQuestionProgress(
            latestCompletedEntity.last_completed_question ||
              latestCompletedEntity.current_question_id ||
              latestCompletedEntity.active_question_id,
          )
        : "Question unavailable";
  const sessionPhase = sessionEntity
    ? String(sessionEntity.run_phase || "").trim() || "Not available"
    : "Not available";
  const sessionBatchId = sessionEntity
    ? String(sessionEntity.batch_id || "").trim() || "Not available"
    : "Not available";
  const sessionStartedAt = sessionEntity
    ? String(
        sessionEntity.started_at || sessionEntity.generated_at || "",
      ).trim() || null
    : null;
  const sessionCompletedAt =
    sessionEntity && !freshActiveEntity
      ? String(sessionEntity.generated_at || "").trim() || null
      : null;
  const sessionQuestionLabel = activeQuestionEntity
    ? activeSessionLabel
    : sessionQuestionId
      ? formatQuestionProgress(sessionQuestionId)
      : sessionPhase;
  const sessionActionLabel = sessionEntity
    ? String(
        sessionEntity.current_action ||
          sessionEntity.next_action ||
          sessionPhase ||
          "",
      ).trim() || null
    : null;
  const sessionKindLabel = freshActiveEntity
    ? "Current session"
    : staleActiveEntity
      ? "Stale session"
      : isActuallyPaused
        ? "Paused session"
        : isActuallyStopped
          ? "Stopped session"
          : "Latest session";
  const sessionSummary = sessionEntity
    ? `${sessionKindLabel} — ${String(sessionEntity.entity_name || "Unknown entity")} — ${sessionActionLabel || sessionPhase} — ${sessionQuestionLabel}`
    : null;
  const sessionCompactLine = sessionEntity
    ? `Session: ${sessionBatchId} · ${sessionActionLabel || sessionPhase} · ${sessionQuestionLabel} · ${activeHeartbeatLabel || "No active worker"} · ${stopReason ? `reason ${stopReason.replaceAll("_", " ")}` : formatElapsedDuration(sessionStartedAt, sessionCompletedAt)}`
    : null;
  const controlUpdatedLabel = formatHeartbeatAge(
    controlState?.updated_at || drilldown?.control?.updated_at || null,
    "Updated",
  );
  const controlUpdatedExactLabel =
    controlState?.updated_at || drilldown?.control?.updated_at
      ? new Date(
          controlState?.updated_at || drilldown?.control?.updated_at || "",
        ).toLocaleString()
      : null;
  const statusHero = buildStatusHeroCopy({
    isTransitioning,
    isRequestedPaused,
    isRequestedRunning,
    isWaiting,
    isActuallyPaused,
    isActuallyStopped,
    isStaleOrStopped,
    hasFreshActiveWork,
    hasStaleActiveWork,
    repairFocus,
    stopReason,
    stopDetails,
    activeEntity,
    activeActionLabel,
    activeRunPhaseLabel,
    activeSessionLabel,
    currentQuestionLabel,
    currentElapsedLabel,
    lastCompletedLabel,
    requestedStateLabel,
    workerStateLabel,
    activityStateLabel,
    controlUpdatedLabel,
    controlUpdatedExactLabel,
  });
  const loopStatus = drilldown?.loop_status;
  const blockedOrPartialCount =
    Number(loopStatus?.quality_counts?.partial ?? 0) +
    Number(loopStatus?.quality_counts?.blocked ?? 0);
  const statusItems = [
    {
      label: "Universe",
      value: String(loopStatus?.universe_count ?? loopStatus?.total_scheduled ?? "…"),
      tone: "text-white",
    },
    {
      label: "Running now",
      value: String(loopStatus?.runtime_counts?.running ?? "…"),
      tone: "text-sky-300",
    },
    {
      label: "Blocked / partial",
      value: String(blockedOrPartialCount),
      tone: "text-amber-300",
    },
    {
      label: "Recent completions",
      value: String(loopStatus?.completed ?? "…"),
      tone: "text-emerald-300",
    },
  ] as const;

  return {
    pipelinePaused,
    operationalState,
    stopReason,
    canStartPipeline,
    playerStatusLabel,
    statusBadgeLabel,
    requestedStateLabel,
    workerStateLabel,
    activityStateLabel,
    primaryActionLabel,
    primaryActionTitle,
    primaryActionHint,
    isTransitioning,
    isRequestedRunning,
    isRequestedPaused,
    hasActiveWork,
    isStaleOrStopped,
    currentQuestionLabel,
    currentElapsedLabel,
    lastCompletedLabel,
    liveEntityTicker,
    sessionSummary,
    sessionCompactLine,
    statusHero,
    statusItems,
  };
}

export type OperationalDrawerViewModel = {
  queueItems: OperationalCardItem[];
  runningItems: OperationalCardItem[];
  waitingItems: OperationalCardItem[];
  stoppedItems: OperationalCardItem[];
  blockedItems: OperationalCardItem[];
  completedItems: OperationalCardItem[];
  staleItems: OperationalCardItem[];
  entityItems: OperationalCardItem[];
  focusEntity: OperationalCardItem | null;
  hasActiveEntity: boolean;
  hasStaleEntity: boolean;
  operationalState: string;
  stopReason: string | null;
  intakeStatusLabel: string;
  playlistSortKeyLabel: string;
};

export function buildOperationalDrawerViewModel(input: {
  dashboard: OperationalDrawerPayload;
  activeSection: "running" | "blocked" | "completed" | "entities";
}) {
  const dashboard = input.dashboard;
  const running = asArray(dashboard.queue.running_entities);
  const waiting = asArray(dashboard.queue.upcoming_entities);
  const resumeNeeded = asArray(dashboard.queue.resume_needed_entities);

  const runningSources = [
    ...(dashboard.queue.in_progress_entity ? [dashboard.queue.in_progress_entity] : []),
    ...running,
  ];
  const uniqueRunningSources = Array.from(
    new Map(runningSources.map((item) => [item.entity_id, item])).values(),
  );

  const runningItems = uniqueRunningSources.map((inProgress) =>
    buildEntityCardBase(inProgress, {
      detail: toText(inProgress.summary) || "Pipeline execution is active.",
      badge:
        formatNextRepair(inProgress.next_repair_status) ||
        formatPublicationState(inProgress.publication_status),
      nextAction: inProgress.next_repair_question_id
        ? `Repair question ${inProgress.next_repair_question_id}`
        : "Continue the active question",
      facts: buildEntityFacts(inProgress, {
        currentQuestionFallback: "n/a",
        runPhaseFallback: "n/a",
        queueOrderLabel: `Queue order: ${typeof inProgress.queue_position === "number" ? inProgress.queue_position : "now"}`,
      }),
        meta: inProgress.next_repair_batch_id
          ? `next repair batch: ${inProgress.next_repair_batch_id}`
          : null,
    }),
  );

  const queueItems = waiting.map((item) =>
    buildEntityCardBase(item, {
      detail: toText(item.summary) || "Waiting in the serialized live loop.",
      badge: "Waiting",
      nextAction: "Open the dossier when this entity is claimed",
      facts: buildEntityFacts(item, {
        currentQuestionFallback: "not started",
        runPhaseFallback: "queued",
        queueOrderLabel: `Queue order: ${typeof item.queue_position === "number" ? item.queue_position : "n/a"}`,
        includeCurrentAction: false,
      }),
    }),
  );

  const blockedItems = dashboard.dossier_quality.incomplete_entities
    .filter((item) => item.quality_state === "blocked")
    .slice(0, 8)
    .map((item) =>
      buildEntityCardBase(item, {
        hrefEntityId: item.browser_entity_id,
        detail: toText(item.quality_summary) || "Blocked dossier.",
        badge: "Blocked",
        nextAction: toText(item.next_action) || "Rerun dossier",
        currentQuestion: toText(item.current_question_id) || null,
        currentAction:
          toText(item.current_action) || toText(item.current_stage) || null,
        currentStage: toText(item.lifecycle_label) || null,
        lifecycleLabel: toText(item.lifecycle_label) || null,
        lifecycleSummary: toText(item.lifecycle_summary) || null,
        movementState: toText(item.movement_state) || null,
        meta: item.generated_at
          ? `updated ${formatDate(item.generated_at)}`
          : null,
      }),
    );

  const staleItems = asArray(dashboard.queue.stale_active_rows)
    .slice(0, 8)
    .map((item) =>
      buildEntityCardBase(item, {
        detail: toText(item.summary) || "Pipeline execution is stale.",
        badge: "Stale",
        nextAction: "Restart the pipeline",
        facts: [
          `Current question: ${toText(item.active_question_id) || "n/a"}`,
          `Run phase: ${toText(item.run_phase) || "stalled"}`,
          formatHeartbeatAge(toText(item.heartbeat_at) || null),
        ],
        meta: item.generated_at
          ? `updated ${formatDate(item.generated_at)}`
          : null,
        movementState: "stalled",
      }),
    );

  const resumeNeededItems = resumeNeeded
    .slice(0, 8)
    .map((item) =>
      buildEntityCardBase(item, {
        detail: toText(item.summary) || "Resume is required.",
        badge: "Resume needed",
        nextAction: item.next_repair_question_id
          ? `Repair question ${item.next_repair_question_id}`
          : "Resume the pipeline",
        facts: buildEntityFacts(item, {
          currentQuestionFallback: "n/a",
          runPhaseFallback: "resume_needed",
          queueOrderLabel: "Queue order: blocked until resumed",
        }),
        meta: item.next_repair_question_id
          ? `next repair root: ${item.next_repair_question_id}`
          : null,
      }),
    );

  const stoppedItems = [
    ...staleItems,
    ...resumeNeededItems,
    ...blockedItems,
  ];

  const completedItems = asArray(dashboard.queue.completed_entities)
    .slice(0, 8)
    .map((item) =>
      buildEntityCardBase(item, {
        detail: toText(item.summary) || "Completed dossier.",
        badge: formatPublicationState(item.publication_status),
        nextAction: "Open the completed dossier",
        facts: [
          `Current question: ${toText(item.active_question_id) || "completed"}`,
          `Run phase: ${toText(item.run_phase) || "completed"}`,
          formatHeartbeatAge(toText(item.heartbeat_at) || null),
        ],
        meta: item.generated_at
          ? `updated ${formatDate(item.generated_at)}`
          : null,
      }),
    );
  const waitingItems = queueItems;
  const entityItems = queueItems;

  const focusEntity =
    input.activeSection === "running"
      ? (runningItems[0] ?? stoppedItems[0] ?? null)
      : input.activeSection === "blocked"
        ? (blockedItems[0] ?? null)
        : input.activeSection === "completed"
          ? (completedItems[0] ?? null)
          : (entityItems[0] ?? null);
  const hasActiveEntity = Boolean(dashboard.queue?.in_progress_entity);
  const hasStaleEntity = asArray(dashboard.queue?.stale_active_rows).length > 0;
  const controlRequestedState = dashboard.control?.requested_state === "paused" || dashboard.control?.is_paused
    ? "paused"
    : "running";
  const controlObservedState = dashboard.control?.observed_state || dashboard.control?.transition_state || null;
  const operationalState =
    dashboard.operational_state ||
    (controlObservedState === "starting"
      ? "starting"
      : controlObservedState === "stopping"
        ? "stopping"
        : controlRequestedState === "paused"
          ? "paused"
          : hasStaleEntity
            ? "stopped"
            : hasActiveEntity
              ? "running"
              : "waiting");
  const stopReason =
    typeof dashboard.stop_reason === "string" ? dashboard.stop_reason : null;
  const intakeStatusLabel = operationalState === "starting"
    ? "Starting"
    : operationalState === "stopping"
      ? "Stopping"
      : operationalState === "paused"
        ? stopReason
          ? "Stopped"
          : "Paused"
        : operationalState === "stopped"
          ? "Stopped"
          : operationalState === "retrying"
            ? "Retrying"
            : operationalState === "skipping"
              ? "Skipping"
              : hasActiveEntity
                ? "Running"
                : hasStaleEntity
                  ? "Stale"
                  : "Idle — waiting for claimable work";
  const playlistSortKeyLabel = formatPlaylistSortKey(
    dashboard.playlist_sort_key,
  );

  return {
    queueItems,
    runningItems,
    waitingItems,
    stoppedItems,
    blockedItems,
    completedItems,
    staleItems,
    entityItems,
    focusEntity,
    hasActiveEntity,
    hasStaleEntity,
    operationalState,
    stopReason,
    intakeStatusLabel,
    playlistSortKeyLabel,
  };
}
