import type { OperationalDrilldownPayload } from "@/lib/operational-drilldown-client";

type ControlState = OperationalDrilldownPayload["control"] | null | undefined;
type RuntimeRunSnapshot = NonNullable<OperationalDrilldownPayload["runtime"]>["current_run"];

function toText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

export function formatOperationalStopReason(value: unknown): string | null {
  const text = toText(value);
  if (!text) return null;
  return text.replaceAll("_", " ");
}

export function getOperationalStopDetails(
  drilldown: OperationalDrilldownPayload | null | undefined,
  controlState: ControlState,
) {
  const stopReason =
    formatOperationalStopReason(controlState?.stop_reason ?? drilldown?.stop_reason) || null;
  const stopDetails =
    (controlState?.stop_details && typeof controlState.stop_details === "object"
      ? controlState.stop_details
      : drilldown?.stop_details && typeof drilldown.stop_details === "object"
        ? drilldown.stop_details
        : null) as Record<string, unknown> | null;
  const requestedState =
    controlState?.requested_state ?? (controlState?.is_paused === true ? "paused" : "running");

  return {
    stopReason,
    stopDetails,
    isSafetyStop: requestedState === "paused" && Boolean(stopReason),
  };
}

export function buildOperationalSafetyStopHint(input: {
  stopReason: string | null;
  stopDetails: Record<string, unknown> | null;
}) {
  const entityName = toText(input.stopDetails?.entity_name);
  const questionId = toText(input.stopDetails?.question_id);
  const attempts = toText(input.stopDetails?.attempts);
  const errorType = toText(input.stopDetails?.error_type).replaceAll("_", " ");
  const errorMessage = toText(input.stopDetails?.error_message);
  const errorLabel = errorType || errorMessage || input.stopReason || "the stop condition";

  if (entityName && questionId && attempts && errorLabel) {
    return `${entityName} failed on ${questionId} after ${attempts} attempts (${errorLabel}). Fix the stop condition before restarting.`;
  }
  if (entityName && questionId && errorLabel) {
    return `${entityName} failed on ${questionId} (${errorLabel}). Fix the stop condition before restarting.`;
  }
  if (entityName && errorLabel) {
    return `${entityName} failed (${errorLabel}). Fix the stop condition before restarting.`;
  }
  if (input.stopReason) {
    return `Fix the ${input.stopReason} stop condition before restarting.`;
  }
  return "Fix the stop condition before restarting.";
}

export function isFailedTerminalRuntimeCheckpoint(
  runtimeRun: RuntimeRunSnapshot | null | undefined,
) {
  if (!runtimeRun) return false;
  return runtimeRun.queue_state === "failed_terminal" || runtimeRun.retry_state === "failed";
}
