// @effect-diagnostics globalDate:off
import type {
  UsageModelFilter,
  UsageModelSelector,
  UsageProviderKind,
  UsageThroughput,
} from "@t3tools/contracts";
import * as NodeSqliteClient from "@t3tools/shared/nodeSqliteClient";
import { evaluateThroughputTurn } from "@t3tools/shared/usageMerge";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import type * as SqlClient from "effect/sql/SqlClient";

export class UsageThroughputReadError extends Schema.TaggedError<UsageThroughputReadError>()(
  "UsageThroughputReadError",
  { cause: Schema.Defect() },
) {
  override get message(): string {
    return "Could not read provider turn throughput from orchestration storage.";
  }
}

export interface ReadUsageThroughputOptions {
  readonly timeZone: string;
  readonly sinceDay: string;
  readonly untilDay: string;
  readonly hourlyWindow: { readonly sinceTimeMs: number; readonly untilTimeMs: number } | null;
  readonly windowStartMs: number;
  readonly windowEndMs: number;
  readonly providerByDriver: ReadonlyMap<string, UsageProviderKind>;
  readonly modelAliases?: ReadonlyMap<string, string>;
  readonly modelFilter?: UsageModelFilter;
  /** Tool intervals of settled turns, keyed by provider turn id. Read first, then filled. */
  readonly toolIntervalCache?: ToolIntervalCache;
  /** Turns completed before this instant are settled: their tool items no longer change. */
  readonly settledBeforeMs?: number;
}

export interface CachedTurnIntervals {
  readonly completedAtMs: number;
  readonly intervals: ReadonlyArray<readonly [number, number]>;
}

/** Merged tool intervals per completed turn; turn items are only read for turns missing here. */
export type ToolIntervalCache = Map<string, CachedTurnIntervals>;

/** Wait this long after a turn completes before caching it, so late tool item updates still count. */
export const THROUGHPUT_SETTLE_MS = 15 * 60 * 1000;

/** Sort and merge overlapping intervals. The union length, also after clipping, is unchanged. */
export function mergeToolIntervals(
  intervals: ReadonlyArray<readonly [number, number]>,
): Array<readonly [number, number]> {
  const sorted = intervals
    .filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b) && b > a)
    .toSorted((x, y) => x[0] - y[0]);
  const merged: Array<[number, number]> = [];
  for (const [a, b] of sorted) {
    const last = merged.at(-1);
    if (last !== undefined && a <= last[1]) last[1] = Math.max(last[1], b);
    else merged.push([a, b]);
  }
  return merged;
}

const encodeTurnIds = Schema.encodeSync(Schema.fromJsonString(Schema.Array(Schema.String)));

function makeDayFormatter(timeZone: string): (timestampMs: number) => string {
  let format: Intl.DateTimeFormat;
  try {
    format = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    format = new Intl.DateTimeFormat("en-CA", {
      timeZone: "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  }
  return (timestampMs) => format.format(new Date(timestampMs));
}

function keepsThroughputModel(
  filter: UsageModelFilter | undefined,
  provider: UsageProviderKind,
  model: string,
): boolean {
  if (filter === undefined) return true;
  const trimmed = model.trim();
  const matches = (selector: UsageModelSelector) =>
    selector.model === trimmed &&
    (selector.provider === undefined || selector.provider === provider);
  return (filter.include?.some(matches) ?? true) && !(filter.exclude?.some(matches) ?? false);
}

interface ProviderTurnRow {
  readonly providerTurnId: string;
  readonly status: string;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
  readonly driver: string | null;
  readonly model: string | null;
  readonly usageStatus: string | null;
  readonly localCommand: number | boolean | null;
  readonly outputTokens: number | null;
}

interface ToolItemRow {
  readonly providerTurnId: string;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
}

/**
 * Aggregate real output-token throughput per `(provider, model)` from T3's own
 * completed provider turns in SQLite, deducting overlapping tool execution intervals.
 */
export const readUsageThroughput = Effect.fn("UsageThroughput.read")(
  function* (sql: SqlClient.SqlClient, options: ReadUsageThroughputOptions) {
    const sqlSinceIso = DateTime.formatIso(DateTime.makeUnsafe(options.windowStartMs));
    const sqlUntilIso = DateTime.formatIso(DateTime.makeUnsafe(options.windowEndMs));

    const turnRows = yield* sql<ProviderTurnRow>`
    SELECT
      turn.provider_turn_id AS "providerTurnId",
      turn.status AS "status",
      COALESCE(turn.started_at, json_extract(turn.payload_json, '$.startedAt')) AS "startedAt",
      COALESCE(turn.completed_at, json_extract(turn.payload_json, '$.completedAt')) AS "completedAt",
      COALESCE(
        pt.driver,
        pt.provider,
        json_extract(turn.payload_json, '$.nativeTurnRef.driver')
      ) AS "driver",
      COALESCE(
        json_extract(turn.payload_json, '$.model'),
        json_extract(turn.payload_json, '$.turnTokenUsage.models[0]'),
        json_extract(run.payload_json, '$.modelSelection.model'),
        json_extract(pt.payload_json, '$.nativeMetadata.modelSelection.model'),
        ps.model
      ) AS "model",
      json_extract(turn.payload_json, '$.turnTokenUsage.usageStatus') AS "usageStatus",
      json_extract(turn.payload_json, '$.turnTokenUsage.localCommand') AS "localCommand",
      json_extract(turn.payload_json, '$.turnTokenUsage.outputTokens') AS "outputTokens"
    FROM orchestration_v2_projection_provider_turns AS turn
    LEFT JOIN orchestration_v2_projection_provider_threads AS pt
      ON pt.provider_thread_id = turn.provider_thread_id
    LEFT JOIN orchestration_v2_projection_provider_sessions AS ps
      ON ps.provider_session_id = pt.provider_session_id
    LEFT JOIN orchestration_v2_projection_run_attempts AS attempt
      ON attempt.attempt_id = turn.run_attempt_id
    LEFT JOIN orchestration_v2_projection_runs AS run
      ON run.run_id = attempt.run_id
    WHERE turn.status = 'completed'
      AND COALESCE(turn.started_at, json_extract(turn.payload_json, '$.startedAt')) IS NOT NULL
      AND COALESCE(turn.completed_at, json_extract(turn.payload_json, '$.completedAt')) IS NOT NULL
      AND COALESCE(turn.completed_at, json_extract(turn.payload_json, '$.completedAt')) >= ${sqlSinceIso}
      AND COALESCE(turn.completed_at, json_extract(turn.payload_json, '$.completedAt')) <= ${sqlUntilIso}
  `.pipe(NodeSqliteClient.readOnly);

    if (turnRows.length === 0) return [] as readonly UsageThroughput[];

    const toDay = options.hourlyWindow === null ? makeDayFormatter(options.timeZone) : null;
    const candidates: Array<{
      readonly providerTurnId: string;
      readonly provider: UsageProviderKind;
      readonly model: string;
      readonly status: string;
      readonly startedAtMs: number;
      readonly completedAtMs: number;
      readonly usageStatus: string;
      readonly localCommand: boolean;
      readonly outputTokens: number;
    }> = [];

    for (const row of turnRows) {
      if (row.driver === null || row.model === null) continue;
      const provider = options.providerByDriver.get(row.driver.trim());
      if (provider === undefined) continue;

      const rawModel = row.model.trim();
      if (rawModel.length === 0) continue;
      if (!keepsThroughputModel(options.modelFilter, provider, rawModel)) continue;
      const model = options.modelAliases?.get(rawModel) ?? rawModel;

      if (row.startedAt === null || row.completedAt === null) continue;
      const startedAtMs = Date.parse(row.startedAt);
      const completedAtMs = Date.parse(row.completedAt);
      if (!Number.isFinite(startedAtMs) || !Number.isFinite(completedAtMs)) continue;
      if (completedAtMs <= startedAtMs) continue;

      if (options.hourlyWindow !== null) {
        if (
          completedAtMs < options.hourlyWindow.sinceTimeMs ||
          completedAtMs >= options.hourlyWindow.untilTimeMs
        ) {
          continue;
        }
      } else if (toDay !== null) {
        const day = toDay(completedAtMs);
        if (day < options.sinceDay || day > options.untilDay) continue;
      }

      if (row.usageStatus === null || row.usageStatus === "unavailable") continue;
      const localCommand = row.localCommand === 1 || row.localCommand === true;
      if (localCommand) continue;
      if (
        typeof row.outputTokens !== "number" ||
        !Number.isFinite(row.outputTokens) ||
        row.outputTokens < 0
      ) {
        continue;
      }

      candidates.push({
        providerTurnId: row.providerTurnId,
        provider,
        model,
        status: row.status,
        startedAtMs,
        completedAtMs,
        usageStatus: row.usageStatus,
        localCommand,
        outputTokens: row.outputTokens,
      });
    }

    if (candidates.length === 0) return [] as readonly UsageThroughput[];

    // Tool items carry full command output in payload_json (hundreds of MB for a month), so only
    // turns without cached intervals are read.
    const cache = options.toolIntervalCache;
    const toolIntervalsByTurn = new Map<string, Array<readonly [number, number]>>();
    const missing = candidates.filter((candidate) => {
      const cached = cache?.get(candidate.providerTurnId);
      if (cached === undefined) return true;
      toolIntervalsByTurn.set(candidate.providerTurnId, [...cached.intervals]);
      return false;
    });
    const turnIdsJson = encodeTurnIds(missing.map((candidate) => candidate.providerTurnId));
    const toolRows =
      missing.length === 0
        ? ([] as readonly ToolItemRow[])
        : yield* sql<ToolItemRow>`
    SELECT
      provider_turn_id AS "providerTurnId",
      json_extract(payload_json, '$.startedAt') AS "startedAt",
      json_extract(payload_json, '$.completedAt') AS "completedAt"
    FROM orchestration_v2_projection_turn_items
    WHERE provider_turn_id IN (SELECT value FROM json_each(${turnIdsJson}))
      AND type IN (
        'command_execution',
        'dynamic_tool',
        'file_change',
        'file_search',
        'web_search',
        'subagent'
      )
      AND json_extract(payload_json, '$.startedAt') IS NOT NULL
      AND json_extract(payload_json, '$.completedAt') IS NOT NULL
  `.pipe(NodeSqliteClient.readOnly);

    for (const row of toolRows) {
      if (row.startedAt === null || row.completedAt === null) continue;
      const startMs = Date.parse(row.startedAt);
      const endMs = Date.parse(row.completedAt);
      if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) continue;
      const list = toolIntervalsByTurn.get(row.providerTurnId) ?? [];
      list.push([startMs, endMs]);
      toolIntervalsByTurn.set(row.providerTurnId, list);
    }
    if (cache !== undefined && options.settledBeforeMs !== undefined) {
      for (const candidate of missing) {
        if (candidate.completedAtMs >= options.settledBeforeMs) continue;
        cache.set(candidate.providerTurnId, {
          completedAtMs: candidate.completedAtMs,
          intervals: mergeToolIntervals(toolIntervalsByTurn.get(candidate.providerTurnId) ?? []),
        });
      }
    }

    const buckets = new Map<
      string,
      {
        provider: UsageProviderKind;
        model: string;
        outputTokens: number;
        modelMs: number;
        turns: number;
      }
    >();

    for (const candidate of candidates) {
      const evaluated = evaluateThroughputTurn({
        status: candidate.status,
        startedAtMs: candidate.startedAtMs,
        completedAtMs: candidate.completedAtMs,
        usageStatus: candidate.usageStatus,
        localCommand: candidate.localCommand,
        outputTokens: candidate.outputTokens,
        toolIntervals: toolIntervalsByTurn.get(candidate.providerTurnId) ?? [],
      });
      if (evaluated === null) continue;
      const key = `${candidate.provider}\u0000${candidate.model}`;
      const bucket = buckets.get(key) ?? {
        provider: candidate.provider,
        model: candidate.model,
        outputTokens: 0,
        modelMs: 0,
        turns: 0,
      };
      bucket.outputTokens += evaluated.outputTokens;
      bucket.modelMs += evaluated.modelMs;
      bucket.turns += 1;
      buckets.set(key, bucket);
    }

    return [...buckets.values()].toSorted(
      (a, b) => a.provider.localeCompare(b.provider) || a.model.localeCompare(b.model),
    ) as readonly UsageThroughput[];
  },
  Effect.mapError((cause) => new UsageThroughputReadError({ cause })),
);
