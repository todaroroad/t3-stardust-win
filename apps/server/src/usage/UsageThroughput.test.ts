import { assert, describe, it } from "@effect/vitest";
import type { UsageProviderKind } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as SqlClient from "effect/sql/SqlClient";

import * as Sqlite from "../persistence/Sqlite.ts";
import {
  mergeToolIntervals,
  readUsageThroughput,
  type ToolIntervalCache,
} from "./UsageThroughput.ts";

const PROVIDER_BY_DRIVER = new Map<string, UsageProviderKind>([
  ["claudeAgent", "claude"],
  ["claude", "claude"],
  ["codex", "codex"],
  ["antigravity", "antigravity"],
  ["grok", "grok"],
]);

const BASE_OPTIONS = {
  timeZone: "UTC",
  sinceDay: "2026-08-01",
  untilDay: "2026-08-02",
  hourlyWindow: null,
  windowStartMs: Date.parse("2026-07-30T12:00:00Z"),
  windowEndMs: Date.parse("2026-08-04T12:00:00Z"),
  providerByDriver: PROVIDER_BY_DRIVER,
};

function insertProviderThread(
  sql: SqlClient.SqlClient,
  input: {
    readonly id: string;
    readonly threadId: string;
    readonly driver: string;
    readonly sessionId?: string | null;
    readonly model?: string;
  },
) {
  return sql`
    INSERT INTO orchestration_v2_projection_provider_threads (
      provider_thread_id,
      thread_id,
      owner_node_id,
      provider,
      driver,
      provider_instance_id,
      provider_session_id,
      status,
      updated_at,
      payload_json
    )
    VALUES (
      ${input.id},
      ${input.threadId},
      'node-1',
      ${input.driver},
      ${input.driver},
      ${input.driver},
      ${input.sessionId ?? null},
      'idle',
      '2026-08-01T10:00:00Z',
      ${JSON.stringify({
        driver: input.driver,
        ...(input.model === undefined
          ? {}
          : { nativeMetadata: { modelSelection: { model: input.model } } }),
      })}
    )
  `;
}

function insertProviderTurn(
  sql: SqlClient.SqlClient,
  input: {
    readonly id: string;
    readonly threadId: string;
    readonly providerThreadId: string;
    readonly ordinal: number;
    readonly status: string;
    readonly startedAt: string | null;
    readonly completedAt: string | null;
    readonly model?: string;
    readonly turnTokenUsage?: Record<string, unknown>;
    readonly runAttemptId?: string | null;
  },
) {
  const payload = {
    id: input.id,
    providerThreadId: input.providerThreadId,
    status: input.status,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
    ...(input.model === undefined ? {} : { model: input.model }),
    ...(input.turnTokenUsage === undefined ? {} : { turnTokenUsage: input.turnTokenUsage }),
  };
  return sql`
    INSERT INTO orchestration_v2_projection_provider_turns (
      provider_turn_id,
      thread_id,
      provider_thread_id,
      node_id,
      run_attempt_id,
      ordinal,
      status,
      started_at,
      completed_at,
      payload_json
    )
    VALUES (
      ${input.id},
      ${input.threadId},
      ${input.providerThreadId},
      'node-1',
      ${input.runAttemptId ?? null},
      ${input.ordinal},
      ${input.status},
      ${input.startedAt},
      ${input.completedAt},
      ${JSON.stringify(payload)}
    )
  `;
}

function insertTurnItem(
  sql: SqlClient.SqlClient,
  input: {
    readonly id: string;
    readonly threadId: string;
    readonly providerTurnId: string;
    readonly ordinal: number;
    readonly type: string;
    readonly startedAt: string;
    readonly completedAt: string;
  },
) {
  return sql`
    INSERT INTO orchestration_v2_projection_turn_items (
      turn_item_id,
      thread_id,
      provider_turn_id,
      ordinal,
      type,
      status,
      updated_at,
      payload_json
    )
    VALUES (
      ${input.id},
      ${input.threadId},
      ${input.providerTurnId},
      ${input.ordinal},
      ${input.type},
      'completed',
      ${input.completedAt},
      ${JSON.stringify({
        id: input.id,
        type: input.type,
        startedAt: input.startedAt,
        completedAt: input.completedAt,
      })}
    )
  `;
}

describe("UsageThroughput", () => {
  it.effect("subtracts overlapping tool execution time and ignores non-tool items", () =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      yield* insertProviderThread(sql, {
        id: "pt-codex",
        threadId: "t-1",
        driver: "codex",
      });
      // 10s turn minus 5s overlapping tools and 1s clipped subagent (reasoning stays counted) = 4000ms.
      yield* insertProviderTurn(sql, {
        id: "turn-1",
        threadId: "t-1",
        providerThreadId: "pt-codex",
        ordinal: 1,
        status: "completed",
        startedAt: "2026-08-01T10:00:00.000Z",
        completedAt: "2026-08-01T10:00:10.000Z",
        model: "gpt-5.4",
        turnTokenUsage: { usageStatus: "complete", outputTokens: 400, hasSubagents: false },
      });
      yield* insertTurnItem(sql, {
        id: "item-1",
        threadId: "t-1",
        providerTurnId: "turn-1",
        ordinal: 1,
        type: "command_execution",
        startedAt: "2026-08-01T10:00:01.000Z",
        completedAt: "2026-08-01T10:00:04.000Z",
      });
      yield* insertTurnItem(sql, {
        id: "item-2",
        threadId: "t-1",
        providerTurnId: "turn-1",
        ordinal: 2,
        type: "web_search",
        startedAt: "2026-08-01T10:00:03.000Z",
        completedAt: "2026-08-01T10:00:06.000Z",
      });
      yield* insertTurnItem(sql, {
        id: "item-3",
        threadId: "t-1",
        providerTurnId: "turn-1",
        ordinal: 3,
        type: "subagent",
        startedAt: "2026-08-01T10:00:09.000Z",
        completedAt: "2026-08-01T10:05:00.000Z",
      });
      yield* insertTurnItem(sql, {
        id: "item-4",
        threadId: "t-1",
        providerTurnId: "turn-1",
        ordinal: 4,
        type: "reasoning",
        startedAt: "2026-08-01T10:00:00.000Z",
        completedAt: "2026-08-01T10:00:02.000Z",
      });

      const rows = yield* readUsageThroughput(sql, BASE_OPTIONS);
      assert.deepStrictEqual(rows, [
        {
          provider: "codex",
          model: "gpt-5.4",
          outputTokens: 400,
          modelMs: 4000,
          turns: 1,
        },
      ]);
    }).pipe(Effect.provide(Sqlite.layerMemory)),
  );

  it("merges overlapping tool intervals without changing their union", () => {
    assert.deepStrictEqual(
      mergeToolIntervals([
        [5, 9],
        [1, 3],
        [2, 4],
        [9, 10],
        [7, 6],
      ]),
      [
        [1, 4],
        [5, 10],
      ],
    );
  });

  it.effect("reads tool items once for settled turns and keeps reading unsettled ones", () =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      yield* insertProviderThread(sql, { id: "pt-codex", threadId: "t-1", driver: "codex" });
      for (const [turnId, minute] of [
        ["turn-old", "10"],
        ["turn-new", "20"],
      ] as const) {
        yield* insertProviderTurn(sql, {
          id: turnId,
          threadId: "t-1",
          providerThreadId: "pt-codex",
          ordinal: minute === "10" ? 1 : 2,
          status: "completed",
          startedAt: `2026-08-01T10:${minute}:00.000Z`,
          completedAt: `2026-08-01T10:${minute}:10.000Z`,
          model: "gpt-5.4",
          turnTokenUsage: { usageStatus: "complete", outputTokens: 400, hasSubagents: false },
        });
        yield* insertTurnItem(sql, {
          id: `${turnId}-item`,
          threadId: "t-1",
          providerTurnId: turnId,
          ordinal: 1,
          type: "command_execution",
          startedAt: `2026-08-01T10:${minute}:01.000Z`,
          completedAt: `2026-08-01T10:${minute}:06.000Z`,
        });
      }
      const cache: ToolIntervalCache = new Map();
      const options = {
        ...BASE_OPTIONS,
        toolIntervalCache: cache,
        // Only turn-old completed before this instant.
        settledBeforeMs: Date.parse("2026-08-01T10:15:00Z"),
      };
      const first = yield* readUsageThroughput(sql, options);
      assert.deepStrictEqual(
        first.map((row) => row.modelMs),
        [10000],
      );
      assert.deepStrictEqual([...cache.keys()], ["turn-old"]);

      // Cached turns no longer read their items; unsettled turns still do.
      yield* sql`DELETE FROM orchestration_v2_projection_turn_items`;
      const second = yield* readUsageThroughput(sql, options);
      assert.deepStrictEqual(
        second.map((row) => [row.modelMs, row.turns]),
        [[15000, 2]],
      );
    }).pipe(Effect.provide(Sqlite.layerMemory)),
  );

  it.effect(
    "excludes incomplete, unavailable, localCommand, missing-output, and sub-1000ms turns",
    () =>
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        yield* insertProviderThread(sql, {
          id: "pt-claude",
          threadId: "t-1",
          driver: "claudeAgent",
          model: "claude-opus-4-6",
        });

        // Excluded: status = running
        yield* insertProviderTurn(sql, {
          id: "turn-running",
          threadId: "t-1",
          providerThreadId: "pt-claude",
          ordinal: 1,
          status: "running",
          startedAt: "2026-08-01T10:00:00.000Z",
          completedAt: "2026-08-01T10:00:10.000Z",
          turnTokenUsage: { usageStatus: "complete", outputTokens: 500 },
        });
        // Excluded: usageStatus = unavailable
        yield* insertProviderTurn(sql, {
          id: "turn-unavail",
          threadId: "t-1",
          providerThreadId: "pt-claude",
          ordinal: 2,
          status: "completed",
          startedAt: "2026-08-01T10:01:00.000Z",
          completedAt: "2026-08-01T10:01:10.000Z",
          turnTokenUsage: { usageStatus: "unavailable", outputTokens: 500 },
        });
        // Excluded: localCommand = true
        yield* insertProviderTurn(sql, {
          id: "turn-local",
          threadId: "t-1",
          providerThreadId: "pt-claude",
          ordinal: 3,
          status: "completed",
          startedAt: "2026-08-01T10:02:00.000Z",
          completedAt: "2026-08-01T10:02:10.000Z",
          turnTokenUsage: { usageStatus: "complete", outputTokens: 500, localCommand: true },
        });
        // Excluded: missing outputTokens
        yield* insertProviderTurn(sql, {
          id: "turn-no-out",
          threadId: "t-1",
          providerThreadId: "pt-claude",
          ordinal: 4,
          status: "completed",
          startedAt: "2026-08-01T10:03:00.000Z",
          completedAt: "2026-08-01T10:03:10.000Z",
          turnTokenUsage: { usageStatus: "partial" },
        });
        // Excluded: modelMs < 1000ms after tool deduction (2000ms total - 1500ms tool = 500ms)
        yield* insertProviderTurn(sql, {
          id: "turn-short",
          threadId: "t-1",
          providerThreadId: "pt-claude",
          ordinal: 5,
          status: "completed",
          startedAt: "2026-08-01T10:04:00.000Z",
          completedAt: "2026-08-01T10:04:02.000Z",
          turnTokenUsage: { usageStatus: "complete", outputTokens: 500 },
        });
        yield* insertTurnItem(sql, {
          id: "item-short",
          threadId: "t-1",
          providerTurnId: "turn-short",
          ordinal: 1,
          type: "file_change",
          startedAt: "2026-08-01T10:04:00.000Z",
          completedAt: "2026-08-01T10:04:01.500Z",
        });
        // Included: valid partial usage with numeric outputTokens and modelMs = 5000ms
        yield* insertProviderTurn(sql, {
          id: "turn-valid",
          threadId: "t-1",
          providerThreadId: "pt-claude",
          ordinal: 6,
          status: "completed",
          startedAt: "2026-08-01T10:05:00.000Z",
          completedAt: "2026-08-01T10:05:05.000Z",
          turnTokenUsage: { usageStatus: "partial", outputTokens: 250 },
        });

        const rows = yield* readUsageThroughput(sql, BASE_OPTIONS);
        assert.deepStrictEqual(rows, [
          {
            provider: "claude",
            model: "claude-opus-4-6",
            outputTokens: 250,
            modelMs: 5000,
            turns: 1,
          },
        ]);
      }).pipe(Effect.provide(Sqlite.layerMemory)),
  );

  it.effect("groups by provider and model and filters by day and hourly time windows", () =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      yield* insertProviderThread(sql, {
        id: "pt-codex",
        threadId: "t-1",
        driver: "codex",
      });
      yield* insertProviderThread(sql, {
        id: "pt-ag",
        threadId: "t-2",
        driver: "antigravity",
      });

      // Inside 2026-08-01 and inside hourly [10:00, 12:00)
      yield* insertProviderTurn(sql, {
        id: "t-c1",
        threadId: "t-1",
        providerThreadId: "pt-codex",
        ordinal: 1,
        status: "completed",
        startedAt: "2026-08-01T10:00:00.000Z",
        completedAt: "2026-08-01T10:00:10.000Z",
        model: "gpt-5.4",
        turnTokenUsage: { usageStatus: "complete", outputTokens: 700 },
      });
      // Inside 2026-08-01, outside hourly [10:00, 12:00)
      yield* insertProviderTurn(sql, {
        id: "t-c2",
        threadId: "t-1",
        providerThreadId: "pt-codex",
        ordinal: 2,
        status: "completed",
        startedAt: "2026-08-01T15:00:00.000Z",
        completedAt: "2026-08-01T15:00:20.000Z",
        model: "gpt-5.4",
        turnTokenUsage: { usageStatus: "complete", outputTokens: 1300 },
      });
      // Antigravity turn using turnTokenUsage.models fallback
      yield* insertProviderTurn(sql, {
        id: "t-ag1",
        threadId: "t-2",
        providerThreadId: "pt-ag",
        ordinal: 1,
        status: "completed",
        startedAt: "2026-08-01T11:00:00.000Z",
        completedAt: "2026-08-01T11:00:05.000Z",
        turnTokenUsage: {
          usageStatus: "complete",
          outputTokens: 600,
          models: ["gemini-2.5-flash"],
        },
      });
      // Outside window (2026-07-31)
      yield* insertProviderTurn(sql, {
        id: "t-old",
        threadId: "t-2",
        providerThreadId: "pt-ag",
        ordinal: 2,
        status: "completed",
        startedAt: "2026-07-31T23:00:00.000Z",
        completedAt: "2026-07-31T23:00:10.000Z",
        model: "gemini-2.5-flash",
        turnTokenUsage: { usageStatus: "complete", outputTokens: 9999 },
      });

      const dayRows = yield* readUsageThroughput(sql, BASE_OPTIONS);
      assert.deepStrictEqual(dayRows, [
        {
          provider: "antigravity",
          model: "gemini-2.5-flash",
          outputTokens: 600,
          modelMs: 5000,
          turns: 1,
        },
        {
          provider: "codex",
          model: "gpt-5.4",
          outputTokens: 2000,
          modelMs: 30_000,
          turns: 2,
        },
      ]);

      const hourlyRows = yield* readUsageThroughput(sql, {
        ...BASE_OPTIONS,
        hourlyWindow: {
          sinceTimeMs: Date.parse("2026-08-01T10:00:00.000Z"),
          untilTimeMs: Date.parse("2026-08-01T12:00:00.000Z"),
        },
      });
      assert.deepStrictEqual(hourlyRows, [
        {
          provider: "antigravity",
          model: "gemini-2.5-flash",
          outputTokens: 600,
          modelMs: 5000,
          turns: 1,
        },
        {
          provider: "codex",
          model: "gpt-5.4",
          outputTokens: 700,
          modelMs: 10_000,
          turns: 1,
        },
      ]);
    }).pipe(Effect.provide(Sqlite.layerMemory)),
  );
});
