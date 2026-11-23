import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import { expect, it } from "@effect/vitest";
import {
  EnvironmentId,
  ProviderDriverKind,
  ProviderInstanceId,
  ThreadId,
  UsageLimitSourceId,
  OrchestratorMcpUsageLimitsResult,
  type ServerProvider,
  type ServerProviderUsageLimits,
} from "@t3tools/contracts";
import { quotaAccounts, quotaReadingStale } from "@t3tools/shared/usageLimits";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as TestClock from "effect/testing/TestClock";
import { McpSchema, McpServer } from "effect/ai";
import * as ProviderRegistry from "../provider/ProviderRegistry.ts";
import * as ProviderAdapterRegistry from "../orchestration-v2/ProviderAdapterRegistry.ts";
import * as ThreadManagement from "../orchestration-v2/ThreadManagementService.ts";
import * as ThreadLaunchService from "../orchestration-v2/ThreadLaunchService.ts";
import * as GitVcsDriver from "../vcs/GitVcsDriver.ts";
import * as ProjectService from "../project/ProjectService.ts";
import * as ScheduledTaskService from "../scheduledTasks/ScheduledTaskService.ts";
import * as SecretRequests from "../secrets/SecretRequests.ts";
import * as ServerSettings from "../serverSettings.ts";
import * as UsageLimitSources from "../usage/UsageLimitSources.ts";
import * as PeerForwarding from "../peer/PeerForwarding.ts";
import * as PeerLinkRequests from "../peer/PeerLinkRequests.ts";
import * as PeerLinks from "../peer/PeerLinks.ts";
import * as RemoteDelegation from "../peer/RemoteDelegation.ts";
import * as McpHttpServer from "./McpHttpServer.ts";
import * as McpInvocationContext from "./McpInvocationContext.ts";
import { idleThreadProjection, liveThreadShell } from "./McpToolAccess.testkit.ts";
import { OrchestratorToolkit } from "./toolkits/orchestrator/tools.ts";
import * as McpToolExposure from "./McpToolExposure.ts";

const checkedAt = "2026-11-17T12:00:00.000Z";
const resetAt = "2026-11-18T12:00:00.000Z";
const environmentId = EnvironmentId.make("usage-fixture");
const threadId = ThreadId.make("usage-thread");
const scope: McpInvocationContext.McpInvocationScope = {
  environmentId,
  capabilities: new Set(["orchestration"]),
  issuedAt: 0,
  requestNamespace: "usage-test",
  client: undefined,
  thread: {
    threadId,
    providerSessionId: "usage-test",
    providerInstanceId: ProviderInstanceId.make("codex"),
  },
};
const client = McpSchema.McpServerClient.of({
  clientId: 1,
  protocolVersion: "2025-06-18",
  clientCapabilities: {},
  clientInfo: { name: "usage-test", version: "1" },
  initializePayload: {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "usage-test", version: "1" },
  },
  getClient: Effect.die("unused"),
});
function provider(driver: string, usageLimits: ServerProviderUsageLimits): ServerProvider {
  return {
    instanceId: ProviderInstanceId.make(driver),
    driver: ProviderDriverKind.make(driver),
    displayName: driver === "codex" ? "Work" : "Personal",
    enabled: true,
    installed: true,
    version: null,
    status: "ready",
    auth: { status: "authenticated" },
    checkedAt,
    models: [],
    slashCommands: [],
    skills: [],
    usageLimits,
  };
}
const fixtures = {
  providers: [
    provider("codex", {
      checkedAt,
      windows: [
        {
          id: "secondary",
          kind: "weekly",
          label: "Weekly",
          usedPercent: 35,
          resetsAt: resetAt,
          windowDurationMins: 10080,
        },
      ],
    }),
    provider("claudeAgent", {
      checkedAt,
      windows: [
        { id: "5h", kind: "session", label: "5 hours", usedPercent: 20, windowDurationMins: 300 },
        {
          id: "week",
          kind: "weekly",
          label: "Weekly",
          usedPercent: 60,
          resetsAt: resetAt,
          windowDurationMins: 10080,
        },
      ],
    }),
    provider("cursor", { checkedAt, windows: [], unavailable: { reason: "probeFailed" } }),
  ],
  usageLimitSources: [
    {
      id: UsageLimitSourceId.make("hub"),
      kind: "cliproxy" as const,
      label: "Pool",
      checkedAt,
      accounts: [
        {
          id: "pool.json",
          driver: ProviderDriverKind.make("antigravity"),
          plan: "Pro",
          usageLimits: {
            checkedAt,
            windows: ["Gemini Pro", "Gemini Flash", "Claude", "GPT"].map((label, index) => ({
              id: String(index),
              label,
              kind: "other" as const,
              usedPercent: index * 25,
              resetsAt: resetAt,
            })),
          },
        },
      ],
    },
  ],
};
function layerTest(
  refresh: Effect.Effect<void> = Effect.void,
  refreshProviders: Effect.Effect<ReadonlyArray<ServerProvider>> = Effect.succeed(
    fixtures.providers,
  ),
  currentProviders: Effect.Effect<ReadonlyArray<ServerProvider>> = Effect.succeed(
    fixtures.providers,
  ),
) {
  return McpHttpServer.layerOrchestratorToolkit.pipe(
    Layer.provideMerge(McpHttpServer.layerInProcessMcpServer),
    Layer.provide(
      Layer.mergeAll(
        Layer.mock(ThreadManagement.ThreadManagementService)({
          getThreadRecords: () =>
            Effect.succeed(
              idleThreadProjection(
                liveThreadShell(threadId, {
                  runtimeMode: "approval-required",
                  interactionMode: "plan",
                }),
              ),
            ),
        }),
        Layer.mock(ProviderRegistry.ProviderRegistry)({
          getProviders: currentProviders,
          refresh: () => refreshProviders,
        }),
        Layer.mock(UsageLimitSources.UsageLimitSources)({
          current: Effect.succeed(fixtures.usageLimitSources),
          refresh,
        }),
        Layer.mock(ThreadLaunchService.ThreadLaunchService)({}),
        Layer.mock(GitVcsDriver.GitVcsDriver)({}),
        Layer.mock(ProviderAdapterRegistry.ProviderAdapterRegistryV2)({}),
        Layer.mock(ProjectService.ProjectService)({}),
        Layer.mock(ScheduledTaskService.ScheduledTaskService)({}),
        Layer.mock(SecretRequests.SecretRequests)({}),
        Layer.mock(PeerForwarding.PeerForwarding)({}),
        Layer.mock(PeerLinkRequests.PeerLinkRequests)({}),
        Layer.mock(PeerLinks.PeerLinks)({}),
        Layer.mock(RemoteDelegation.RemoteDelegation)({}),
        ServerSettings.layerTest(),
        NodeCrypto.layer,
      ),
    ),
  );
}
const decodeUsageLimits = Schema.decodeUnknownEffect(OrchestratorMcpUsageLimitsResult);

const call = (input: { refresh?: boolean } = {}, invocation = scope) =>
  Effect.gen(function* () {
    const server = yield* McpServer.McpServer;
    const response = yield* server
      .callTool({ name: "usage_limits", arguments: input })
      .pipe(
        Effect.provideService(McpInvocationContext.McpInvocationContext, invocation),
        Effect.provideService(McpSchema.McpServerClient, client),
      );
    expect(response.isError).not.toBe(true);
    return yield* decodeUsageLimits(response.structuredContent);
  });

it.effect("lists usage_limits as read-only and exposes quota search", () =>
  Effect.gen(function* () {
    const server = yield* McpServer.McpServer;
    const names = server.tools.map(({ tool }) => tool.name);
    expect(names.sort()).toEqual(Object.keys(OrchestratorToolkit.tools).sort());
    expect(
      server.tools.find(({ tool }) => tool.name === "usage_limits")?.tool.annotations,
    ).toMatchObject({ readOnlyHint: true, destructiveHint: false });
    const exposure = McpToolExposure.make(
      () =>
        server.tools.map(({ tool }) => ({ name: tool.name, description: tool.description ?? "" })),
      () => Effect.void,
    );
    expect((yield* exposure.search("agent", "usage_limits")).map((tool) => tool.name)).toContain(
      "usage_limits",
    );
  }).pipe(Effect.provide(layerTest())),
);

it.effect.each([{}, { refresh: false }])(
  "returns the popover accounts without refreshing %j",
  (input) => {
    let sourceRefreshes = 0;
    let providerRefreshes = 0;
    return Effect.gen(function* () {
      yield* TestClock.setTime(Date.parse(checkedAt));
      const result = yield* call(input);
      expect(result.checkedAt).toBe(checkedAt);
      expect(
        result.accounts.map((account) => [
          account.provider,
          account.remainingPercent,
          account.windows.length,
          account.connected,
          account.stale,
        ]),
      ).toEqual([
        ["codex", 65, 1, true, false],
        ["claudeAgent", 40, 2, true, false],
        ["antigravity", 25, 4, true, false],
        ["cursor", null, 0, true, true],
      ]);
      expect(result.accounts[0]).toMatchObject({
        label: "Codex",
        alias: "1 · Work",
        windows: [
          {
            label: "Weekly",
            kind: "weekly",
            remainingPercent: 65,
            windowDurationMins: 10080,
            resetsAt: resetAt,
          },
        ],
      });
      expect(result.accounts[1]?.windows[0]?.resetsAt).toBeNull();
      expect(result.accounts[3]?.unavailable).toEqual({ reason: "probeFailed" });
      expect(JSON.stringify(result)).not.toContain("credentialFingerprint");
      expect(sourceRefreshes).toBe(0);
      expect(providerRefreshes).toBe(0);
    }).pipe(
      Effect.provide(
        layerTest(
          Effect.sync(() => {
            sourceRefreshes++;
          }),
          Effect.sync(() => {
            providerRefreshes++;
            return fixtures.providers;
          }),
        ),
      ),
    );
  },
);

it.effect("awaits both refreshes exactly once and reads the updated snapshot", () =>
  Effect.gen(function* () {
    yield* TestClock.setTime(Date.parse(checkedAt));
    const sourceStarted = yield* Deferred.make<void>();
    const providerStarted = yield* Deferred.make<void>();
    const release = yield* Deferred.make<void>();
    let sourceRefreshes = 0;
    let providerRefreshes = 0;
    let snapshot = fixtures.providers;
    const refresh = Effect.sync(() => {
      sourceRefreshes++;
    }).pipe(
      Effect.andThen(Deferred.succeed(sourceStarted, undefined)),
      Effect.andThen(Deferred.await(release)),
    );
    const providers = Effect.sync(() => {
      providerRefreshes++;
    }).pipe(
      Effect.andThen(Deferred.succeed(providerStarted, undefined)),
      Effect.andThen(Deferred.await(release)),
      Effect.andThen(
        Effect.sync(() => {
          snapshot = [
            provider("codex", {
              checkedAt: "2026-11-17T12:00:01.000Z",
              windows: [{ id: "week", kind: "weekly", label: "Weekly", usedPercent: 90 }],
            }),
          ];
          return snapshot;
        }),
      ),
    );
    const task = yield* call({ refresh: true }).pipe(
      Effect.provide(
        layerTest(
          refresh,
          providers,
          Effect.sync(() => snapshot),
        ),
      ),
      Effect.forkChild,
    );
    yield* Deferred.await(sourceStarted);
    yield* Deferred.await(providerStarted);
    yield* Deferred.succeed(release, undefined);
    const result = yield* Fiber.join(task);
    expect(result.accounts[0]?.remainingPercent).toBe(10);
    expect(result.checkedAt).toBe("2026-11-17T12:00:01.000Z");
    expect(sourceRefreshes).toBe(1);
    expect(providerRefreshes).toBe(1);
  }),
);

it.effect("bounds a stuck refresh to 20 seconds and returns stale cached windows", () =>
  Effect.gen(function* () {
    yield* TestClock.setTime(Date.parse(checkedAt));
    const sourceStarted = yield* Deferred.make<void>();
    const providerStarted = yield* Deferred.make<void>();
    let sourceRefreshes = 0;
    let providerRefreshes = 0;
    const refresh = Effect.sync(() => {
      sourceRefreshes++;
    }).pipe(
      Effect.andThen(Deferred.succeed(sourceStarted, undefined)),
      Effect.andThen(Effect.never),
    );
    const providers = Effect.sync(() => {
      providerRefreshes++;
    }).pipe(
      Effect.andThen(Deferred.succeed(providerStarted, undefined)),
      Effect.andThen(Effect.never),
    );
    const task = yield* call({ refresh: true }).pipe(
      Effect.provide(layerTest(refresh, providers)),
      Effect.forkChild,
    );
    yield* Deferred.await(sourceStarted);
    yield* Deferred.await(providerStarted);
    yield* TestClock.adjust("20 seconds");
    const result = yield* Fiber.join(task);
    expect(result.accounts.every((account) => account.stale)).toBe(true);
    expect(result.accounts[0]?.remainingPercent).toBe(65);
    expect(sourceRefreshes).toBe(1);
    expect(providerRefreshes).toBe(1);
  }),
);

it.effect("rejects callers lacking orchestration capability before refreshing", () =>
  Effect.gen(function* () {
    const server = yield* McpServer.McpServer;
    const response = yield* server
      .callTool({ name: "usage_limits", arguments: { refresh: true } })
      .pipe(
        Effect.provideService(McpInvocationContext.McpInvocationContext, {
          ...scope,
          capabilities: new Set<never>(),
        }),
        Effect.provideService(McpSchema.McpServerClient, client),
      );
    expect(response.isError).toBe(true);
    expect(response.content).toEqual([
      { type: "text", text: expect.stringContaining("capability_denied") },
    ]);
  }).pipe(
    Effect.provide(layerTest(Effect.die("must not refresh"), Effect.die("must not refresh"))),
  ),
);

it("shares stale boundaries and retains cached failed probes for native and pooled accounts", () => {
  const now = Date.parse(checkedAt);
  const limits = fixtures.providers[0]!.usageLimits!;
  expect(quotaReadingStale(limits, now + 600000)).toBe(false);
  expect(quotaReadingStale(limits, now + 600001)).toBe(true);
  expect(quotaReadingStale(limits, now, false)).toBe(true);
  const failed = { ...limits, unavailable: { reason: "probeFailed" as const } };
  const source = fixtures.usageLimitSources[0]!;
  const presentations = new Map([
    [
      environmentId,
      {
        entry: { target: { label: "Test" } },
        connection: { phase: "connected" },
        serverConfig: {
          providers: [provider("codex", failed)],
          usageLimitSources: [
            { ...source, accounts: [{ ...source.accounts[0]!, usageLimits: failed }] },
          ],
        },
      },
    ],
  ]);
  const accounts = quotaAccounts(presentations);
  expect(accounts).toHaveLength(2);
  expect(
    accounts.every(
      (account) => account.connected && account.failed && account.limits?.windows.length === 1,
    ),
  ).toBe(true);
});
