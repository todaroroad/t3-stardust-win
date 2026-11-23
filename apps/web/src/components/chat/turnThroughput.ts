import type { ThreadStructure } from "@t3tools/client-runtime/state/shell";
import { latestProviderTurnForAttempt } from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";

export const terminalRunStatuses = new Set([
  "completed",
  "failed",
  "cancelled",
  "interrupted",
  "rolled_back",
]);
const active = new Set(["pending", "running", "waiting"]);
const tools = new Set([
  "command_execution",
  "dynamic_tool",
  "file_change",
  "file_search",
  "web_search",
  "subagent",
]);

/** Same statuses client-runtime treats as owning live provider work (threadExecution.ts). */
const working = new Set(["preparing", "starting", "running", "waiting"]);

export function selectWorkingRun(runs: ThreadStructure["runs"]) {
  return runs.reduce<(typeof runs)[number] | undefined>(
    (latest, run) =>
      working.has(run.status) && (!latest || run.ordinal > latest.ordinal) ? run : latest,
    undefined,
  );
}

const awaitingUserTypes = new Set(["approval_request", "user_input_request", "secret_request"]);

/** Follow active provider work; keep a completed reading frozen without treating context size as generated tokens. */
export function selectTurnThroughput(projection: ThreadStructure) {
  const newest = (runs: typeof projection.runs) =>
    runs.reduce<(typeof projection.runs)[number] | undefined>(
      (latest, r) => (!latest || r.ordinal > latest.ordinal ? r : latest),
      undefined,
    );
  const latest = newest(projection.runs);
  const run =
    selectWorkingRun(projection.runs) ??
    (latest && terminalRunStatuses.has(latest.status) && latest.completedAt ? latest : undefined);
  if (!run) return null;
  const attempt = projection.attempts
    .filter((a) => a.runId === run.id)
    .reduce<(typeof projection.attempts)[number] | undefined>(
      (latest, a) => (!latest || a.attemptOrdinal > latest.attemptOrdinal ? a : latest),
      undefined,
    );
  const turn = latestProviderTurnForAttempt(
    projection.providerTurns,
    run.activeAttemptId ?? attempt?.id,
  );
  const running = !terminalRunStatuses.has(run.status);
  const sampling = running && turn?.status === "running";
  const start = turn?.startedAt ?? run.startedAt ?? run.requestedAt;
  const startMs = DateTime.toEpochMillis(start);
  const end = turn?.completedAt ?? run.completedAt;
  const usage = turn?.turnTokenUsage;
  const count = usage?.usageStatus !== "unavailable" ? usage?.outputTokens : undefined;
  const outputTokens =
    typeof count === "number" && Number.isFinite(count) && count >= 0 ? count : null;
  // The context-window snapshot time only dates a usage report when turn usage exists.
  const reportAt = outputTokens === null ? undefined : turn?.tokenUsage?.updatedAt;
  const reportMs = reportAt ? Date.parse(reportAt) : NaN;
  let lastActivityMs = startMs;
  let lastType: string | null = null;
  let lastActiveMs = -Infinity;
  // Only this run/turn's activity: inherited history and child agents cannot impersonate this model.
  for (const item of projection.turnItems) {
    if (item.runId !== run.id || (turn && item.providerTurnId !== turn.id)) continue;
    const updated = DateTime.toEpochMillis("updatedAt" in item ? item.updatedAt : start);
    if (item.type !== "user_message") lastActivityMs = Math.max(lastActivityMs, updated);
    if (active.has(item.status) && updated >= lastActiveMs) {
      lastActiveMs = updated;
      lastType = item.type;
    }
  }
  if (Number.isFinite(reportMs) && reportMs >= startMs)
    lastActivityMs = Math.max(lastActivityMs, reportMs);
  const terminalLabels: Readonly<Record<string, string>> = {
    completed: "Completed",
    failed: "Failed",
    cancelled: "Cancelled",
    interrupted: "Interrupted",
    rolled_back: "Rolled back",
  };
  let phase = "Waiting for model activity";
  if (!running) phase = terminalLabels[run.status] ?? run.status;
  else if (run.status === "preparing" || run.status === "starting") phase = "Preparing";
  else if (lastType !== null && awaitingUserTypes.has(lastType)) phase = "Waiting for your input";
  else if (
    projection.turnItems.some(
      (item) => item.runId === run.id && item.type === "compaction" && active.has(item.status),
    )
  )
    phase = "Compacting context";
  else if (lastType && tools.has(lastType)) phase = "Running tools or subtasks";
  else if (lastType === "reasoning") phase = "Thinking";
  else if (lastType === "assistant_message" || lastType === "proposed_plan")
    phase = "Generating output";
  else if (run.status === "waiting") phase = "Waiting";
  else if (turn && terminalRunStatuses.has(turn.status))
    phase = "Waiting for follow-up or completion";
  return {
    key: `${run.id}:${turn?.id ?? "pending"}`,
    // Run selection is fixed at dispatch; the composer's selection can already be the next model.
    model: run.modelSelection.model,
    provider: String(run.providerInstanceId),
    running,
    sampling,
    phase,
    startMs,
    endMs: end ? DateTime.toEpochMillis(end) : null,
    outputTokens,
    partial: usage?.usageStatus === "partial",
    // Waiting on the user or still preparing is not model silence; no "无新活动" timer then.
    quietApplies:
      running &&
      run.status !== "preparing" &&
      run.status !== "starting" &&
      !(lastType !== null && awaitingUserTypes.has(lastType)),
    reportMs: Number.isFinite(reportMs) && reportMs >= startMs ? reportMs : null,
    lastActivityMs,
  };
}
export type TurnThroughputSnapshot = NonNullable<ReturnType<typeof selectTurnThroughput>>;

export function throughputReading(snapshot: TurnThroughputSnapshot, now: number) {
  const end = snapshot.endMs ?? now;
  const elapsedMs = Math.max(0, end - snapshot.startMs);
  // Partial counters are lower bounds until the next provider report, never inferred from characters.
  const rate =
    snapshot.outputTokens !== null && elapsedMs >= 1000
      ? snapshot.outputTokens / (elapsedMs / 1000)
      : null;
  return {
    rate,
    elapsedMs,
    quietMs: Math.max(0, end - snapshot.lastActivityMs),
    reportAgeMs: snapshot.reportMs === null ? null : Math.max(0, end - snapshot.reportMs),
  };
}
