import * as NodeFS from "node:fs";
import * as NodeModule from "node:module";
import * as NodePath from "node:path";

import type { AntigravitySettings, ServerProviderUsageWindow } from "@t3tools/contracts";
import * as HostProcess from "@t3tools/shared/HostProcess";
import * as Clock from "effect/Clock";
import * as Digest from "effect/crypto/Digest";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";
import { FetchHttpClient, HttpClient, HttpClientRequest, HttpClientResponse } from "effect/http";

import {
  makeUnavailableUsageLimits,
  makeUsageLimits,
} from "@t3tools/provider-core/server/usageLimits";

export function antigravityUserAgent(platform: NodeJS.Platform, architecture: NodeJS.Architecture) {
  return `antigravity/hub/2.24.0 (aidev_client; os_type=${platform}; arch=${architecture}; cl=963137146)`;
}

export const ANTIGRAVITY_REFRESH_HINT_ZH =
  "配额暂未同步或登录态已过期 · 请使用该模型发送消息以刷新使用量";

const DAILY_ENDPOINT = "https://daily-cloudcode-pa.googleapis.com";
const PROD_ENDPOINT = "https://cloudcode-pa.googleapis.com";
const ENDPOINTS = {
  "oauth-personal": [DAILY_ENDPOINT, PROD_ENDPOINT],
  "oauth-business": [PROD_ENDPOINT, DAILY_ENDPOINT],
};
const SUMMARY_WINDOW_MINS = new Map([
  ["5h", 5 * 60],
  ["weekly", 7 * 24 * 60],
]);
const MANUAL_REDIRECT: RequestInit = { redirect: "manual" };

const TokenFile = Schema.Struct({
  client_id: Schema.NonEmptyString,
  client_secret: Schema.NonEmptyString,
  refresh_token: Schema.NonEmptyString,
  project_id: Schema.optional(Schema.String),
});

const CliToken = Schema.Struct({
  token: Schema.Struct({
    access_token: Schema.NonEmptyString,
    refresh_token: Schema.optional(Schema.String),
    expiry: Schema.optional(Schema.String),
  }),
});

const TokenResponse = Schema.Struct({
  access_token: Schema.NonEmptyString,
  expires_in: Schema.Number.check(Schema.isGreaterThan(0)),
});

const UserInfo = Schema.Struct({ id: Schema.NonEmptyString });
const Quota = Schema.Struct({
  remainingFraction: Schema.optional(Schema.Number),
  resetTime: Schema.optional(Schema.String),
});
const Bucket = Schema.Struct({
  ...Quota.fields,
  bucketId: Schema.NonEmptyString,
  window: Schema.optional(Schema.String),
  displayName: Schema.optional(Schema.String),
  description: Schema.optional(Schema.String),
  disabled: Schema.optional(Schema.Boolean),
});
const Summary = Schema.Struct({
  groups: Schema.optional(
    Schema.Array(
      Schema.Struct({
        displayName: Schema.optional(Schema.String),
        buckets: Schema.optional(Schema.Array(Bucket)),
      }),
    ),
  ),
  buckets: Schema.optional(Schema.Array(Bucket)),
});
const Models = Schema.Struct({
  models: Schema.Record(
    Schema.String,
    Schema.Struct({
      modelProvider: Schema.optional(Schema.String),
      quotaInfo: Schema.optional(Quota),
      weeklyQuotaInfo: Schema.optional(Quota),
    }),
  ),
});

const decodeTokenFile = Schema.decodeEffect(Schema.fromJsonString(TokenFile));
const decodeCliToken = Schema.decodeEffect(Schema.fromJsonString(CliToken));
const decodeTokenResponse = Schema.decodeUnknownEffect(TokenResponse);
const decodeUserInfo = Schema.decodeUnknownEffect(UserInfo);
const decodeSummary = Schema.decodeUnknownEffect(Summary);
const decodeModels = Schema.decodeUnknownEffect(Models);

let cachedLocalOAuthClient: { readonly id: string; readonly secret: string } | null | undefined;

function discoverLocalAntigravityOAuthClient(
  profileDirectory: string,
): ReadonlyArray<{ readonly id: string; readonly secret: string }> {
  if (cachedLocalOAuthClient) return [cachedLocalOAuthClient];
  if (cachedLocalOAuthClient === null) return [];
  try {
    const toolsRoot = NodePath.resolve(profileDirectory, "../../../..", "tools", "antigravity-acp");
    if (!NodeFS.existsSync(toolsRoot)) {
      cachedLocalOAuthClient = null;
      return [];
    }
    const stack = [toolsRoot];
    let cids: string[] = [];
    let csecs: string[] = [];
    while (stack.length > 0) {
      const cur = stack.pop()!;
      let entries: NodeFS.Dirent[];
      try {
        entries = NodeFS.readdirSync(cur, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const entry of entries) {
        const full = NodePath.join(cur, entry.name);
        if (entry.isDirectory()) {
          stack.push(full);
        } else if (entry.name === "agy.exe" || entry.name === "antigravity") {
          try {
            const raw = NodeFS.readFileSync(full, "latin1");
            cids = [
              ...new Set(raw.match(/\d{10,}-[a-z0-9]{20,}\.apps\.googleusercontent\.com/g) ?? []),
            ].filter((id) => !id.startsWith("8843549"));
            csecs = [...new Set(raw.match(/GOCSPX-[A-Za-z0-9_-]{28}/g) ?? [])];
            if (cids.length > 0 && csecs.length > 0) break;
          } catch {
            // Ignore unreadable binary
          }
        }
      }
      if (cids.length > 0 && csecs.length > 0) break;
    }
    const pairs: Array<{ readonly id: string; readonly secret: string }> = [];
    if (cids[1] && csecs[1]) pairs.push({ id: cids[1], secret: csecs[1] });
    for (const id of cids) {
      for (const secret of csecs) {
        if (!pairs.some((p) => p.id === id && p.secret === secret)) {
          pairs.push({ id, secret });
        }
      }
    }
    if (pairs.length === 0) cachedLocalOAuthClient = null;
    return pairs;
  } catch {
    return [];
  }
}

function iso(value: string | undefined): string | undefined {
  const parsed = value ? DateTime.make(value) : Option.none();
  return Option.isSome(parsed) ? DateTime.formatIso(parsed.value) : undefined;
}

function quotaWindow(
  id: string,
  label: string,
  quota: typeof Quota.Type,
  kind: ServerProviderUsageWindow["kind"] = "other",
  windowDurationMins?: number,
): ServerProviderUsageWindow | undefined {
  if (quota.remainingFraction === undefined || !Number.isFinite(quota.remainingFraction)) {
    return undefined;
  }
  const resetsAt = iso(quota.resetTime);
  return {
    id,
    label,
    kind,
    usedPercent: (1 - Math.max(0, Math.min(1, quota.remainingFraction))) * 100,
    ...(resetsAt ? { resetsAt } : {}),
    ...(windowDurationMins === undefined ? {} : { windowDurationMins }),
  };
}

function summaryResetTime(
  bucket: typeof Bucket.Type,
  windowDurationMins: number | undefined,
  requestedAt: number,
): string | undefined {
  const untouched =
    bucket.remainingFraction === 1 &&
    bucket.description === undefined &&
    windowDurationMins !== undefined &&
    Math.abs(Date.parse(bucket.resetTime ?? "") - requestedAt - windowDurationMins * 60_000) <=
      60_000;
  return untouched ? undefined : bucket.resetTime;
}

const sha256 = Effect.fnUntraced(function* (text: string) {
  const digest = yield* (yield* Digest.Digest).digest(
    Digest.sha256,
    new TextEncoder().encode(text),
  );
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
});

export function decodeGoKeyringSecret(secret: ArrayLike<number>): string {
  const text = new TextDecoder().decode(Uint8Array.from(secret));
  if (text.startsWith("go-keyring-base64:")) {
    return Buffer.from(text.slice("go-keyring-base64:".length), "base64").toString("utf8");
  }
  if (text.startsWith("go-keyring-encoded:")) {
    return Buffer.from(text.slice("go-keyring-encoded:".length), "hex").toString("utf8");
  }
  return text;
}

class AntigravityKeyringError extends Schema.TaggedError<AntigravityKeyringError>()(
  "AntigravityKeyringError",
  { cause: Schema.Defect() },
) {
  override get message(): string {
    return "Could not read the Antigravity sign-in from the system keyring.";
  }
}

const requireExternal = NodeModule.createRequire(import.meta.url);

export function readWindowsCliCredential(
  architecture: NodeJS.Architecture,
): Uint8Array | undefined {
  if (architecture !== "x64" && architecture !== "arm64") {
    throw new Error(`no credential access on ${architecture}`);
  }
  const { DataType, load, open } = requireExternal("ffi-rs") as typeof import("ffi-rs");
  open({ library: "t3-advapi32", path: "advapi32.dll" });
  open({ library: "t3-kernel32", path: "kernel32.dll" });
  const copy = (into: Buffer, from: bigint) =>
    load({
      library: "t3-kernel32",
      funcName: "RtlMoveMemory",
      retType: DataType.Void,
      paramsType: [DataType.U8Array, DataType.BigInt, DataType.BigInt],
      paramsValue: [into, from, BigInt(into.length)],
    });
  const out = Buffer.alloc(8);
  const read = load({
    library: "t3-advapi32",
    funcName: "CredReadW",
    retType: DataType.I32,
    paramsType: [DataType.WString, DataType.U32, DataType.U32, DataType.U8Array],
    paramsValue: ["gemini:antigravity", 1, 0, out],
    errno: true as const,
  });
  if (read.value === 0) {
    if (read.errnoCode === 1168) return undefined;
    throw new Error(`CredReadW failed with Windows error ${read.errnoCode}`);
  }
  const credential = out.readBigUInt64LE();
  try {
    const header = Buffer.alloc(48);
    copy(header, credential);
    const size = header.readUInt32LE(32);
    if (size === 0) return undefined;
    const blob = Buffer.alloc(size);
    copy(blob, header.readBigUInt64LE(40));
    return blob;
  } finally {
    load({
      library: "t3-advapi32",
      funcName: "CredFree",
      retType: DataType.Void,
      paramsType: [DataType.BigInt],
      paramsValue: [credential],
    });
  }
}

const readCliKeyringSecret = (platform: NodeJS.Platform, architecture: NodeJS.Architecture) =>
  Effect.tryPromise({
    try: async () => {
      const secret =
        platform === "win32"
          ? readWindowsCliCredential(architecture)
          : await new (
              requireExternal("@napi-rs/keyring") as typeof import("@napi-rs/keyring")
            ).AsyncEntry("gemini", "antigravity").getSecret();
      return secret ? decodeGoKeyringSecret(secret) : undefined;
    },
    catch: (cause) => new AntigravityKeyringError({ cause }),
  });

export const antigravityAccountFingerprint = (userInfo: unknown) =>
  decodeUserInfo(userInfo).pipe(Effect.flatMap((info) => sha256(`google-account\0${info.id}`)));

export const antigravitySummaryWindows = (response: unknown, requestedAt: number) =>
  decodeSummary(response).pipe(Effect.map((summary) => summaryWindows(summary, requestedAt)));

function antigravityFamilyOrder(window: ServerProviderUsageWindow): number {
  const id = window.id.toLowerCase();
  const label = window.label.toLowerCase();
  if (id === "gemini-5h" || id === "gemini-weekly" || label.startsWith("gemini ·")) return 0;
  if (id.startsWith("gemini") || label.startsWith("gemini")) return 1;
  if (
    id.startsWith("3p-") ||
    id.startsWith("claude") ||
    id.startsWith("gpt") ||
    label.includes("claude") ||
    label.includes("gpt")
  ) {
    return 2;
  }
  return 3;
}

function antigravityPeriodOrder(window: ServerProviderUsageWindow): number {
  if (window.kind === "session" || /5[- ]?hour|\b5h\b/i.test(window.label)) return 0;
  if (window.kind === "weekly" || /weekly|7[- ]?day/i.test(window.label)) return 1;
  if (window.kind === "monthly") return 2;
  return 3;
}

function sortAntigravityWindows(windows: ServerProviderUsageWindow[]): ServerProviderUsageWindow[] {
  return [...windows].sort(
    (a, b) =>
      antigravityFamilyOrder(a) - antigravityFamilyOrder(b) ||
      antigravityPeriodOrder(a) - antigravityPeriodOrder(b),
  );
}

function summaryWindows(summary: typeof Summary.Type, requestedAt: number) {
  const windows = new Map<string, ServerProviderUsageWindow>();
  const groups = summary.groups?.some((group) => group.buckets?.length)
    ? summary.groups
    : [{ buckets: summary.buckets }];
  for (const group of groups ?? []) {
    for (const bucket of group.buckets ?? []) {
      if (bucket.disabled) continue;
      const family = bucket.bucketId.startsWith("gemini-argon-")
        ? group.displayName?.trim() || "Gemini Argon"
        : bucket.bucketId.startsWith("gemini-carbon-")
          ? group.displayName?.trim() || "Gemini Carbon"
          : bucket.bucketId.startsWith("gemini-")
            ? "Gemini"
            : bucket.bucketId.startsWith("3p-")
              ? "Claude & GPT (shared)"
              : group.displayName?.trim() || bucket.bucketId;
      const weekly = bucket.window === "weekly";
      const session = bucket.window === "5h";
      const windowDurationMins = SUMMARY_WINDOW_MINS.get(bucket.window ?? "");
      const window = quotaWindow(
        bucket.bucketId,
        `${family} · ${weekly ? "Weekly" : session ? "5-hour" : bucket.displayName?.trim() || "Quota"}`,
        { ...bucket, resetTime: summaryResetTime(bucket, windowDurationMins, requestedAt) },
        weekly ? "weekly" : session ? "session" : "other",
        windowDurationMins,
      );
      if (window) windows.set(window.id, window);
    }
  }
  return sortAntigravityWindows([...windows.values()]);
}

function modelWindows(models: typeof Models.Type) {
  const windows = new Map<string, ServerProviderUsageWindow>();
  for (const [modelId, model] of Object.entries(models.models)) {
    const family =
      model.modelProvider === "MODEL_PROVIDER_GOOGLE" || modelId.startsWith("gemini-")
        ? "Gemini"
        : model.modelProvider === "MODEL_PROVIDER_ANTHROPIC" || modelId.startsWith("claude-")
          ? "Claude"
          : model.modelProvider === "MODEL_PROVIDER_OPENAI" || modelId.startsWith("gpt-")
            ? "GPT"
            : undefined;
    if (!family) continue;
    for (const [suffix, quota] of [
      ["quota", model.quotaInfo],
      ["weekly", model.weeklyQuotaInfo],
    ] as const) {
      if (!quota) continue;
      const window = quotaWindow(
        `${family.toLowerCase()}-${suffix}`,
        `${family} · ${suffix === "weekly" ? "Weekly" : "Reported quota"}`,
        quota,
        suffix === "weekly" ? "weekly" : "other",
        suffix === "weekly" ? 7 * 24 * 60 : undefined,
      );
      if (!window) continue;
      const previous = windows.get(window.id);
      if (!previous || window.usedPercent > previous.usedPercent) windows.set(window.id, window);
    }
  }
  return sortAntigravityWindows([...windows.values()]);
}

export const makeAntigravityUsageProbe = Effect.fn("makeAntigravityUsageProbe")(function* (input: {
  readonly profileDirectory: string;
  readonly authMethod: AntigravitySettings["authMethod"];
  readonly readKeyringSecret?: Effect.Effect<string | undefined, AntigravityKeyringError>;
}) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const crypto = yield* Digest.Digest;
  const platform = yield* HostProcess.Platform;
  const architecture = yield* HostProcess.Architecture;
  const tokenPath = path.join(input.profileDirectory, "antigravity-acp", "acp_token.json");
  const cliTokenPath = path.join(
    input.profileDirectory,
    "antigravity-acp",
    "antigravity-oauth-token",
  );
  const readKeyringSecret = input.readKeyringSecret ?? readCliKeyringSecret(platform, architecture);
  let cached:
    | { fingerprint: string; account: string; accessToken: string; expiresAt: number }
    | undefined;
  let generation = 0;

  const request = (req: HttpClientRequest.HttpClientRequest) =>
    Effect.gen(function* () {
      const client = (yield* HttpClient.HttpClient).pipe(HttpClient.filterStatusOk);
      return yield* client.execute(req).pipe(
        Effect.provideService(FetchHttpClient.RequestInit, MANUAL_REDIRECT),
        Effect.flatMap(HttpClientResponse.filterStatusOk),
        Effect.flatMap((response) => response.json),
        Effect.timeout("8 seconds"),
      );
    }).pipe(Effect.provide(FetchHttpClient.layer));

  const read = Effect.gen(function* () {
    const startedGeneration = generation;
    const checkedAt = DateTime.formatIso(yield* DateTime.now);
    if (input.authMethod !== "oauth-personal" && input.authMethod !== "oauth-business") {
      return makeUnavailableUsageLimits({ checkedAt, reason: "unsupported" });
    }
    const now = yield* Clock.currentTimeMillis;
    let accessToken: string | undefined;
    let account: string | undefined;
    let projectId: string | undefined;

    if (!(yield* fs.exists(tokenPath))) {
      const stored = (yield* fs.exists(cliTokenPath))
        ? yield* fs.readFileString(cliTokenPath)
        : input.authMethod === "oauth-business"
          ? yield* readKeyringSecret
          : undefined;
      if (stored === undefined) {
        return makeUnavailableUsageLimits({
          checkedAt,
          reason: "probeFailed",
          message: ANTIGRAVITY_REFRESH_HINT_ZH,
        });
      }
      const { token } = yield* decodeCliToken(stored);
      const cliFingerprint = yield* sha256(
        `antigravity-cli\0${token.refresh_token ?? token.access_token}`,
      );
      if (Date.parse(token.expiry ?? "") > now + 60_000) {
        accessToken = token.access_token;
      } else if (cached && cached.fingerprint === cliFingerprint && cached.expiresAt > now + 60_000) {
        accessToken = cached.accessToken;
        account = cached.account;
      } else if (token.refresh_token) {
        const candidates = discoverLocalAntigravityOAuthClient(input.profileDirectory);
        for (const cand of candidates) {
          const refreshed = yield* request(
            HttpClientRequest.post("https://oauth2.googleapis.com/token").pipe(
              HttpClientRequest.bodyUrlParams({
                client_id: cand.id,
                client_secret: cand.secret,
                refresh_token: token.refresh_token,
                grant_type: "refresh_token",
              }),
            ),
          ).pipe(
            Effect.flatMap(decodeTokenResponse),
            Effect.option,
          );
          if (Option.isSome(refreshed)) {
            cachedLocalOAuthClient = cand;
            accessToken = refreshed.value.access_token;
            const resolvedAcc = yield* request(
              HttpClientRequest.get("https://www.googleapis.com/oauth2/v2/userinfo").pipe(
                HttpClientRequest.setHeaders({ Authorization: `Bearer ${accessToken}` }),
              ),
            ).pipe(
              Effect.flatMap(antigravityAccountFingerprint),
              Effect.orElseSucceed(() => cliFingerprint),
            );
            account = resolvedAcc;
            if (generation === startedGeneration) {
              cached = {
                fingerprint: cliFingerprint,
                account: resolvedAcc,
                accessToken,
                expiresAt: now + refreshed.value.expires_in * 1000,
              };
            }
            break;
          }
        }
      }

      if (!accessToken) {
        return makeUnavailableUsageLimits({
          checkedAt,
          reason: "probeFailed",
          message: ANTIGRAVITY_REFRESH_HINT_ZH,
        });
      }
      if (!account) {
        account = yield* request(
          HttpClientRequest.get("https://www.googleapis.com/oauth2/v2/userinfo").pipe(
            HttpClientRequest.setHeaders({ Authorization: `Bearer ${accessToken}` }),
          ),
        ).pipe(
          Effect.flatMap(antigravityAccountFingerprint),
          Effect.catch(() => Effect.succeed(cliFingerprint)),
        );
      }
    } else {
      const token = yield* fs.readFileString(tokenPath).pipe(Effect.flatMap(decodeTokenFile));
      projectId = token.project_id;
      const fingerprint = yield* sha256(
        `${token.client_id}\0${token.refresh_token}\0${token.project_id ?? ""}`,
      );
      if (cached?.fingerprint !== fingerprint || cached.expiresAt <= now + 60_000) {
        cached = undefined;
        const refreshed = yield* request(
          HttpClientRequest.post("https://oauth2.googleapis.com/token").pipe(
            HttpClientRequest.bodyUrlParams({
              client_id: token.client_id,
              client_secret: token.client_secret,
              refresh_token: token.refresh_token,
              grant_type: "refresh_token",
            }),
          ),
        ).pipe(Effect.flatMap(decodeTokenResponse));
        accessToken = refreshed.access_token;
        account = yield* request(
          HttpClientRequest.get("https://www.googleapis.com/oauth2/v2/userinfo").pipe(
            HttpClientRequest.setHeaders({ Authorization: `Bearer ${accessToken}` }),
          ),
        ).pipe(
          Effect.flatMap(antigravityAccountFingerprint),
          Effect.orElseSucceed(() => fingerprint),
        );
        if (generation === startedGeneration) {
          cached = {
            fingerprint,
            account,
            accessToken,
            expiresAt: now + refreshed.expires_in * 1000,
          };
        }
      } else {
        accessToken = cached.accessToken;
        account = cached.account;
      }
    }

    const tokenForFetch = accessToken;
    const endpoints = ENDPOINTS[input.authMethod];
    const fetchWindows = Effect.fn("AntigravityUsageProbe.fetchWindows")(function* <E>(
      operation: string,
      parse: (
        response: unknown,
        requestedAt: number,
      ) => Effect.Effect<ServerProviderUsageWindow[], E>,
    ) {
      const responses = yield* Effect.forEach(
        endpoints,
        (endpoint) =>
          Effect.gen(function* () {
            const requestedAt = yield* Clock.currentTimeMillis;
            return yield* request(
              HttpClientRequest.post(`${endpoint}/v1internal:${operation}`).pipe(
                HttpClientRequest.setHeaders({
                  Authorization: `Bearer ${tokenForFetch}`,
                  "User-Agent": antigravityUserAgent(platform, architecture),
                }),
                HttpClientRequest.bodyJsonUnsafe(projectId ? { project: projectId } : {}),
              ),
            ).pipe(
              Effect.flatMap((response) => parse(response, requestedAt)),
              Effect.orElseSucceed(() => []),
            );
          }),
        { concurrency: "unbounded" },
      );
      const windows = new Map<string, ServerProviderUsageWindow>();
      for (const window of responses.flat()) {
        if (!windows.has(window.id)) windows.set(window.id, window);
      }
      return [...windows.values()];
    });

    const summary = yield* fetchWindows("retrieveUserQuotaSummary", antigravitySummaryWindows);
    const windows = summary.length
      ? summary
      : yield* fetchWindows("fetchAvailableModels", (response) =>
          decodeModels(response).pipe(Effect.map(modelWindows)),
        );
    if (windows.length === 0) {
      return makeUnavailableUsageLimits({
        checkedAt,
        reason: "probeFailed",
        message: ANTIGRAVITY_REFRESH_HINT_ZH,
      });
    }
    return { ...makeUsageLimits({ checkedAt, windows }), credentialFingerprint: account };
  });

  const probe = read.pipe(
    Effect.provideService(FileSystem.FileSystem, fs),
    Effect.provideService(Path.Path, path),
    Effect.provideService(Digest.Digest, crypto),
    Effect.timeout("10 seconds"),
    Effect.catch(() =>
      Effect.gen(function* () {
        return makeUnavailableUsageLimits({
          checkedAt: DateTime.formatIso(yield* DateTime.now),
          reason: "probeFailed",
          message: ANTIGRAVITY_REFRESH_HINT_ZH,
        });
      }),
    ),
  );

  return {
    probe,
    clear: Effect.sync(() => {
      cached = undefined;
      generation++;
    }),
  };
});
