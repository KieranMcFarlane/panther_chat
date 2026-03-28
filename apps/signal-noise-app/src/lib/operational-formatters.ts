function parseTimestamp(value: string | null | undefined) {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

function formatDurationParts(elapsedMs: number) {
  const seconds = Math.floor(elapsedMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }

  return `${Math.max(1, seconds)}s`;
}

export function formatRunningDuration(value: string | null | undefined) {
  const timestamp = parseTimestamp(value);
  if (timestamp === null) return "running for unknown duration";
  const elapsedMs = Math.max(0, Date.now() - timestamp);
  return `running for ${formatDurationParts(elapsedMs)}`;
}

export function formatElapsedDuration(
  startedAt: string | null | undefined,
  completedAt?: string | null | undefined,
) {
  const startTimestamp = parseTimestamp(startedAt);
  if (startTimestamp === null) return "Unknown duration";

  const endTimestamp = parseTimestamp(completedAt) ?? Date.now();
  const elapsedMs = Math.max(0, endTimestamp - startTimestamp);
  return formatDurationParts(elapsedMs);
}

export function formatQuestionProgress(questionId: string | null | undefined) {
  if (!questionId) return "Question unavailable";
  const match = String(questionId).match(/q(\d+)/i);
  if (!match) return `Question ${questionId}`;
  return `Question ${Number(match[1])} of 15`;
}

export function formatHeartbeatAge(
  value: string | null | undefined,
  prefix = "Heartbeat",
) {
  const timestamp = parseTimestamp(value);
  if (timestamp === null) return `${prefix} unavailable`;
  const elapsedMs = Math.max(0, Date.now() - timestamp);
  return `${prefix} ${formatDurationParts(elapsedMs)} ago`;
}
