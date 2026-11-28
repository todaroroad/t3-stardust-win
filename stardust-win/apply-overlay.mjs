#!/usr/bin/env node
/**
 * Idempotently applies and verifies T3M版 (Pure Official Base Edition) source customizations:
 *  1. Pure official pingdotgg/t3code base — zero third-party macOS bloat.
 *  2. Rebrand to `T3M版` + Deep-Navy Iridescent `T3✦` icons unpacked cleanly for Windows taskbar/exe/web.
 *  3. Antigravity (`反重力`) real-time quota probe + explicit refresh reminder when quota is expired/missing.
 *  4. `所有项目` 3-Tier Sidebar (`运行中 / 待处理 / 工作流` + `分类` + `已收尾`) + Custom Category & Starred-Models Dialog.
 *  5. 2-part `StardustSessionStatsBar` (`会话概览` + `令牌与缓存`) & zero-overlap `StardustLiveExecutionCapsule`.
 *  6. Side-by-side Windows identity (`com.todaroroad.t3stardust`, `T3M版`, `T3 Stardust.exe`) + remote version-skew suppression.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const assetsDir = path.join(__dirname, "assets");

const TARGET_OWNER = "todaroroad";
const TARGET_REPO_NAME = "t3-stardust-win";
const TARGET_REPO = `${TARGET_OWNER}/${TARGET_REPO_NAME}`;
const TARGET_APP_ID = "com.todaroroad.t3stardust";
const DISPLAY_BRAND_NAME = "T3M版";

function readText(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), "utf8");
}

function writeText(relPath, content) {
  const fullPath = path.join(repoRoot, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, "utf8");
}

function copyAsset(assetRel, destRel) {
  const srcPath = path.join(assetsDir, assetRel);
  const dstPath = path.join(repoRoot, destRel);
  fs.mkdirSync(path.dirname(dstPath), { recursive: true });
  fs.copyFileSync(srcPath, dstPath);
}

function assertIncludes(haystack, needle, contextLabel) {
  if (!haystack.includes(needle)) {
    throw new Error(`[apply-overlay] Missing expected pattern in ${contextLabel}: ${needle}`);
  }
}

// ---------------------------------------------------------------------------
// 1. Stardust Thought Icon & Per-Thought Usage Badge
// ---------------------------------------------------------------------------
copyAsset("ThoughtUsageBadge.tsx", "apps/web/src/components/chat/ThoughtUsageBadge.tsx");

// 1a. TimelineToolActivityIcon.tsx
{
  const rel = "apps/web/src/components/chat/TimelineToolActivityIcon.tsx";
  let src = readText(rel);
  if (!src.includes("function StardustThoughtIcon")) {
    src = src.replace(
      'import { use, useState } from "react";',
      'import { use, useId, useState } from "react";',
    );
    src = src.replace(/^\s*BrainIcon,\r?\n/m, "");
    const stardustIconFn = `function StardustThoughtIcon({ className }: { className: string }) {
  const { resolvedTheme } = use(TimelineRowCtx);
  const gradId = useId();
  const isDark = resolvedTheme === "dark";
  const primary = isDark ? "#FF6734" : "#E34717";
  const secondary = isDark ? "#FFB340" : "#FF9500";
  const tertiary = isDark ? "#A78BFA" : "#8B5CF6";
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <defs>
        <linearGradient id={gradId} x1="3.5" y1="4" x2="18.5" y2="18.5" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={secondary} />
          <stop offset="52%" stopColor={primary} />
          <stop offset="100%" stopColor={tertiary} />
        </linearGradient>
      </defs>
      <circle cx="10.5" cy="11" r="7" fill={primary} fillOpacity={isDark ? 0.16 : 0.12} />
      <path
        fill={\`url(#\${gradId})\`}
        d="M10.5 4C11 8.1 13.4 10.5 17.5 11C13.4 11.5 11 13.9 10.5 18C10 13.9 7.6 11.5 3.5 11C7.6 10.5 10 8.1 10.5 4Z"
      />
      <path
        fill={secondary}
        d="M18.5 2.3C18.74 4.12 19.88 5.26 21.7 5.5C19.88 5.74 18.74 6.88 18.5 8.7C18.26 6.88 17.12 5.74 15.3 5.5C17.12 5.26 18.26 4.12 18.5 2.3Z"
      />
      <path
        fill={tertiary}
        d="M17.5 16.2C17.68 17.5 18.5 18.32 19.8 18.5C18.5 18.68 17.68 19.5 17.5 20.8C17.32 19.5 16.5 18.68 15.2 18.5C16.5 18.32 17.32 17.5 17.5 16.2Z"
      />
    </svg>
  );
}

`;
    assertIncludes(src, "export function ToolActivityIconView", rel);
    src = src.replace(
      "export function ToolActivityIconView",
      `${stardustIconFn}export function ToolActivityIconView`,
    );
    src = src.replace(
      'const fallbackClassName = cn(props.className, props.muted && "opacity-70 light:brightness-60");',
      'const keepVivid = props.fallbackName === "brain";\n  const fallbackClassName = cn(\n    props.className,\n    props.muted && !keepVivid && "opacity-70 light:brightness-60",\n  );',
    );
    assertIncludes(src, "<BrainIcon", rel);
    src = src.replace(
      /<BrainIcon\s+className=\{className\}\s+aria-hidden\s*\/>/,
      "<StardustThoughtIcon className={className} />",
    );
    writeText(rel, src);
  }
  assertIncludes(src, "StardustThoughtIcon", rel);
}

// 1b. TimelineWorkEntryRow.tsx
{
  const rel = "apps/web/src/components/chat/TimelineWorkEntryRow.tsx";
  let src = readText(rel);
  if (!src.includes("ThoughtUsageBadge")) {
    src = `import { ThoughtUsageBadge } from "./ThoughtUsageBadge";\n${src}`;
    const trailingRe = /trailing=\{\r?\n(\s*)<>/;
    if (!trailingRe.test(src)) {
      throw new Error(`[apply-overlay] Missing trailing fragment in ${rel}`);
    }
    src = src.replace(
      trailingRe,
      "trailing={\n$1<>\n$1  {isReasoning ? <ThoughtUsageBadge workEntry={workEntry} /> : null}",
    );
    writeText(rel, src);
  }
  assertIncludes(src, "ThoughtUsageBadge", rel);
}

// 1c. TimelineWorkGroupRows.tsx
{
  const rel = "apps/web/src/components/chat/TimelineWorkGroupRows.tsx";
  let src = readText(rel);
  if (!src.includes("ThoughtUsageBadge")) {
    src = `import { ThoughtUsageBadge } from "./ThoughtUsageBadge";\n${src}`;
    const targetPattern =
      /(\{thoughtLine\s*\?\s*\(\s*<WorkLogRow[\s\S]*?<\/span>\s*\}\s*)(wrapLabel\s*\/>)/;
    if (!targetPattern.test(src)) {
      throw new Error(`[apply-overlay] Expected live thought WorkLogRow pattern not found in ${rel}`);
    }
    src = src.replace(
      targetPattern,
      "$1trailing={row.thought ? <ThoughtUsageBadge workEntry={row.thought} /> : undefined}\n          $2",
    );
    writeText(rel, src);
  }
  assertIncludes(src, "ThoughtUsageBadge", rel);
}

// ---------------------------------------------------------------------------
// 2. T3M版 Branding, Deep-Navy Iridescent `T3✦` Icons & Unpacked Windows Icon
// ---------------------------------------------------------------------------
const iconsDir = path.join(assetsDir, "icons");
if (fs.existsSync(iconsDir)) {
  for (const name of fs.readdirSync(iconsDir)) {
    fs.copyFileSync(path.join(iconsDir, name), path.join(repoRoot, "assets/prod", name));
  }
  const winIco = path.join(iconsDir, "t3-black-windows.ico");
  if (fs.existsSync(winIco)) {
    fs.copyFileSync(winIco, path.join(assetsDir, "stardust-windows.ico"));
    fs.mkdirSync(path.join(repoRoot, "apps/desktop/resources"), { recursive: true });
    fs.copyFileSync(winIco, path.join(repoRoot, "apps/desktop/resources/icon.ico"));
  }
}

// 2a. apps/desktop/package.json
{
  const rel = "apps/desktop/package.json";
  const pkg = JSON.parse(readText(rel));
  pkg.productName = DISPLAY_BRAND_NAME;
  writeText(rel, `${JSON.stringify(pkg, null, 2)}\n`);
}

// 2b. apps/desktop/src/app/DesktopEnvironment.ts
{
  const rel = "apps/desktop/src/app/DesktopEnvironment.ts";
  let src = readText(rel);
  src = src.replace(
    'isDevelopment ? "com.t3tools.t3code.dev" : "com.t3tools.t3code"',
    `isDevelopment ? "${TARGET_APP_ID}.dev" : "${TARGET_APP_ID}"`,
  );
  src = src.replace(
    /displayName:\s*`\$\{APP_BASE_NAME\}\s*\(\$\{stageLabel\}\)`/,
    `displayName: stageLabel === "Dev" ? \`\${APP_BASE_NAME} (\${stageLabel})\` : "${DISPLAY_BRAND_NAME}"`,
  );
  src = src.replaceAll('"T3星辰版"', `"${DISPLAY_BRAND_NAME}"`);
  assertIncludes(src, TARGET_APP_ID, rel);
  assertIncludes(src, DISPLAY_BRAND_NAME, rel);
  writeText(rel, src);
}

// 2c. apps/web/src/branding.ts & apps/web/vite.config.ts
{
  const rel = "apps/web/src/branding.ts";
  let src = readText(rel);
  src = src.replace(
    /export const APP_BASE_NAME = injectedDesktopAppBranding\?\.baseName \?\? "[^"]+";/,
    `export const APP_BASE_NAME = injectedDesktopAppBranding?.baseName ?? "${DISPLAY_BRAND_NAME}";`,
  );
  src = src.replace(
    /export const APP_DISPLAY_NAME =[\s\S]*?formatAppDisplayName\(\{\s*baseName:\s*APP_BASE_NAME,\s*stageLabel:\s*APP_STAGE_LABEL\s*\}\);/,
    `export const APP_DISPLAY_NAME = injectedDesktopAppBranding?.displayName ?? "${DISPLAY_BRAND_NAME}";`,
  );
  src = src.replaceAll('"T3星辰版"', `"${DISPLAY_BRAND_NAME}"`);
  src = src.replaceAll("https://t3.codes/download", `https://github.com/${TARGET_REPO}/releases`);
  assertIncludes(src, DISPLAY_BRAND_NAME, rel);
  writeText(rel, src);
}

{
  const rel = "apps/web/vite.config.ts";
  let src = readText(rel);
  src = src.replace(
    'const title = formatAppDisplayName({ baseName: "T3 Code", stageLabel });',
    `const title = development ? formatAppDisplayName({ baseName: "${DISPLAY_BRAND_NAME}", stageLabel }) : "${DISPLAY_BRAND_NAME}";`,
  );
  src = src.replaceAll('"T3星辰版"', `"${DISPLAY_BRAND_NAME}"`);
  assertIncludes(src, DISPLAY_BRAND_NAME, rel);
  writeText(rel, src);
}

// 2d. apps/web/src/components/desktopUpdate.logic.ts & test
{
  const rel = "apps/web/src/components/desktopUpdate.logic.ts";
  let src = readText(rel);
  src = src.replace(
    /const DEFAULT_DESKTOP_RELEASE_REPOSITORY = "[^"]+";/,
    `const DEFAULT_DESKTOP_RELEASE_REPOSITORY = "${TARGET_REPO}";`,
  );
  assertIncludes(src, TARGET_REPO, rel);
  writeText(rel, src);

  const testRel = "apps/web/src/components/desktopUpdate.logic.test.ts";
  if (fs.existsSync(path.join(repoRoot, testRel))) {
    let testSrc = readText(testRel);
    testSrc = testSrc.replaceAll(
      "https://github.com/pingdotgg/t3code/releases",
      `https://github.com/${TARGET_REPO}/releases`,
    );
    writeText(testRel, testSrc);
  }
}

// 2e. apps/web/src/components/sidebar/SidebarChrome.tsx -> T3 M版 wordmark
{
  const rel = "apps/web/src/components/sidebar/SidebarChrome.tsx";
  let src = readText(rel);
  src = src.replace('{"Code"}', '{"M版"}').replace('{"星辰版"}', '{"M版"}');
  assertIncludes(src, '{"M版"}', rel);
  writeText(rel, src);
}

// ---------------------------------------------------------------------------
// 3. Remote Server Version-Skew & Update Capsule Suppression (`gcp-tw-agent`)
// ---------------------------------------------------------------------------
{
  const rel = "apps/web/src/versionSkew.ts";
  let src = readText(rel);
  if (!src.includes("toOfficialCompatVersion")) {
    const helper = `function toOfficialCompatVersion(version: string): string {
  const m = /^1\\.(\\d+)\\.\\d+(?:[-+].*)?$/.exec(version.trim());
  return m ? \`0.1.\${m[1]}\` : version;
}

`;
    src = src.replace(
      "export function resolveVersionMismatch(",
      `${helper}export function resolveVersionMismatch(`,
    );
    src = src.replace(
      "const normalizedClientVersion = normalizeVersion(clientVersion);",
      "const normalizedClientVersion = normalizeVersion(clientVersion ? toOfficialCompatVersion(clientVersion) : clientVersion);",
    );
    src = src.replace(
      /export function resolveServerSelfUpdateCapability\([\s\S]*?\): ServerSelfUpdateCapability \| null \{\r?\n  return [^\n]+\r?\n\}/,
      `export function resolveServerSelfUpdateCapability(\n  _serverConfig: Pick<ServerConfig, "environment"> | null | undefined,\n): ServerSelfUpdateCapability | null {\n  return null;\n}`,
    );
    writeText(rel, src);
  }
  assertIncludes(src, "toOfficialCompatVersion", rel);
}

{
  const rel = "apps/web/src/components/sidebar/useUpdateEverything.ts";
  let src = readText(rel);
  if (!src.includes("// stardust: remote server updates suppressed")) {
    src = src.replace(
      /const \{ targets: servers, skipped \} = channelSwitch\r?\n\s*\? collectChannelSwitchTargets\(machines, channelSwitch, resolve\)\r?\n\s*: collectServerUpdateTargets\(machines, targetVersion, resolve\);/,
      `// stardust: remote server updates suppressed\n  void channelSwitch;\n  void targetVersion;\n  void collectChannelSwitchTargets;\n  void collectServerUpdateTargets;\n  const { targets: servers, skipped } = { targets: [] as ReturnType<typeof collectServerUpdateTargets>["targets"], skipped: [] as ReturnType<typeof collectServerUpdateTargets>["skipped"] };`,
    );
    writeText(rel, src);
  }
  assertIncludes(src, "stardust: remote server updates suppressed", rel);
}

{
  const rel = "apps/web/src/components/sidebar/SidebarUpdatePill.tsx";
  let src = readText(rel);
  if (!src.includes("stardust: suppress remote server update capsule")) {
    src = src.replace(
      "const run = useUpdateEverythingRun();",
      "// stardust: suppress remote server update capsule\n  void useUpdateEverythingRun;\n  const run = null as UpdateEverythingRun | null;",
    );
    writeText(rel, src);
  }
  assertIncludes(src, "stardust: suppress remote server update capsule", rel);
}

// ---------------------------------------------------------------------------
// 4. Antigravity Quota Probe + Missing-Quota Refresh Reminder
// ---------------------------------------------------------------------------
copyAsset("antigravityUsageLimits.ts", "apps/server/src/provider/antigravityUsageLimits.ts");

// 4a. apps/server/src/provider/AntigravityProvider.ts
{
  const rel = "apps/server/src/provider/AntigravityProvider.ts";
  let src = readText(rel);
  if (!src.includes("usageProbe?:")) {
    src = src.replace(
      "  readonly rememberRuntimeModes?: (modes: ReadonlyArray<RuntimeMode>) => Effect.Effect<void>;\n}",
      `  readonly rememberRuntimeModes?: (modes: ReadonlyArray<RuntimeMode>) => Effect.Effect<void>;
  readonly usageProbe?: {
    readonly probe: Effect.Effect<ServerProvider["usageLimits"]>;
    readonly clear: Effect.Effect<void>;
  };
}`,
    );
    src = src.replace(
      "    const supportsTextGeneration =\n      initialized !== undefined ? yield* options.supportsTextGeneration : false;\n    const updatedAt = DateTime.formatIso(yield* DateTime.now);",
      `    const supportsTextGeneration =
      initialized !== undefined ? yield* options.supportsTextGeneration : false;
    const probedUsageLimits =
      initialized !== undefined && options.usageProbe
        ? yield* options.usageProbe.probe
        : undefined;
    const updatedAt = DateTime.formatIso(yield* DateTime.now);`,
    );
    src = src.replace(
      "          checkedAt: updatedAt,",
      `          checkedAt: updatedAt,
          ...(probedUsageLimits ? { usageLimits: probedUsageLimits } : {}),`,
    );
    src = src.replace(
      "    checkProvider: checkProvider(),",
      `    checkProvider: checkProvider(),
    ...(options.usageProbe
      ? {
          checkUsageLimits: options.usageProbe.probe,
          invalidateUsageCache: options.usageProbe.clear,
        }
      : {}),`,
    );
    src = src.replace(
      "    yield* rememberRuntimeModes(previousModes, supportedRuntimeModes);\n  });",
      `    yield* rememberRuntimeModes(previousModes, supportedRuntimeModes);
    if (options.usageProbe) {
      yield* options.usageProbe.clear.pipe(
        Effect.andThen(options.usageProbe.probe),
        Effect.flatMap((limits) =>
          limits
            ? SubscriptionRef.update(metadata, (st) => ({
                ...st,
                draft: { ...st.draft, usageLimits: limits },
              }))
            : Effect.void,
        ),
        Effect.forkDetach,
      );
    }
  });`,
    );
    src = src.replace(
      "    const updatedAt = DateTime.formatIso(yield* DateTime.now);\n    const previousModes = yield* SubscriptionRef.modify(metadata, (state) => [",
      `    if (options.usageProbe) {
      yield* options.usageProbe.clear;
    }
    const updatedAt = DateTime.formatIso(yield* DateTime.now);
    const previousModes = yield* SubscriptionRef.modify(metadata, (state) => {
      const { usageLimits: _prevUsageLimits, ...clearedDraft } = state.draft;
      return [`,
    );
    src = src.replace(
      "        authRevision: state.authRevision + 1,\n        draft: {\n          ...state.draft,",
      "        authRevision: state.authRevision + 1,\n        draft: {\n          ...clearedDraft,",
    );
    src = src.replace(
      "          supportsTextGeneration: false,\n        },\n      } satisfies AntigravityProviderState,\n    ]);",
      `          supportsTextGeneration: false,
        },
      } satisfies AntigravityProviderState,
      ] as const;
    });`,
    );
    writeText(rel, src);
  }
  assertIncludes(src, "usageProbe?:", rel);
}

// 4a-2. apps/server/src/provider/antigravityAuthSupport.ts -> Clean lightweight GEMINI_HOME for textGeneration
{
  const rel = "apps/server/src/provider/antigravityAuthSupport.ts";
  let src = readText(rel);
  if (!src.includes("syncAntigravityTextHelperProfile")) {
    src = src.replace(
      `export interface AntigravityInstanceDirectories {
  readonly profile: string;
  /** Keep beside the profile: 120-character archive members under its longer name would exceed Windows' 260-character limit. */
  readonly runtimeTemp: string;
}`,
      `export interface AntigravityInstanceDirectories {
  readonly profile: string;
  /** Keep beside the profile: 120-character archive members under its longer name would exceed Windows' 260-character limit. */
  readonly runtimeTemp: string;
  /** Clean lightweight GEMINI_HOME for headless JSON textGeneration without MCP subprocesses or user rules. */
  readonly textHelperProfile: string;
}`,
    );
    src = src.replace(
      `    profile: path.join(stateDir, "providers", "antigravity", key),
    runtimeTemp: path.join(stateDir, "antigravity-tmp", key.slice(0, 12)),
  } satisfies AntigravityInstanceDirectories;`,
      `    profile: path.join(stateDir, "providers", "antigravity", key),
    runtimeTemp: path.join(stateDir, "antigravity-tmp", key.slice(0, 12)),
    textHelperProfile: path.join(stateDir, "antigravity-text", key.slice(0, 12)),
  } satisfies AntigravityInstanceDirectories;`,
    );
    src = src.replace(
      `export const prepareAntigravityProfile = Effect.fn("prepareAntigravityProfile")(function* (input: {
  readonly profileDirectory: string;
  readonly baseEnv?: NodeJS.ProcessEnv;
  readonly runtimeExecutablePath?: string;
  readonly platform?: NodeJS.Platform;
  readonly auth?: AntigravityAuthConfig;
  readonly userHome?: string;
  readonly tempDirectory?: string;
}) {`,
      `export const syncAntigravityTextHelperProfile = Effect.fn("syncAntigravityTextHelperProfile")(
  function* (input: {
    readonly sourceProfileDirectory: string;
    readonly helperProfileDirectory: string;
  }): Effect.fn.Return<void, never, FileSystem.FileSystem | Path.Path> {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const copyIfNewer = (srcFile: string, dstFile: string) =>
      Effect.tryPromise(async () => {
        const srcStat = await NodeFSP.stat(srcFile).catch(() => undefined);
        if (!srcStat || !srcStat.isFile()) return;
        const dstStat = await NodeFSP.stat(dstFile).catch(() => undefined);
        if (dstStat && dstStat.isFile() && dstStat.mtimeMs >= srcStat.mtimeMs) return;
        await NodeFSP.mkdir(path.dirname(dstFile), { recursive: true, mode: 0o700 });
        await NodeFSP.copyFile(srcFile, dstFile);
      }).pipe(Effect.ignore);

    const configDir = path.join(input.helperProfileDirectory, "config");
    const acpDir = path.join(input.helperProfileDirectory, "antigravity-acp");
    yield* fs.makeDirectory(configDir, { recursive: true, mode: 0o700 }).pipe(Effect.ignore);
    yield* fs.makeDirectory(acpDir, { recursive: true, mode: 0o700 }).pipe(Effect.ignore);
    yield* fs.writeFileString(path.join(configDir, ".migrated"), "").pipe(Effect.ignore);
    yield* fs
      .writeFileString(path.join(configDir, "mcp_config.json"), '{"mcpServers":{}}\\n')
      .pipe(Effect.ignore);
    yield* fs
      .writeFileString(path.join(configDir, "hooks.json"), '{"hooks":{}}\\n')
      .pipe(Effect.ignore);
    for (const unwanted of [
      path.join(input.helperProfileDirectory, "GEMINI.md"),
      path.join(input.helperProfileDirectory, "AGENTS.md"),
      path.join(configDir, "skills"),
      path.join(configDir, "skills.json"),
    ]) {
      yield* fs.remove(unwanted, { recursive: true, force: true }).pipe(Effect.ignore);
    }

    for (const rel of [
      ["antigravity-acp", "antigravity-oauth-token"],
      ["antigravity-acp", "acp_token.json"],
      ["antigravity-acp", "installation_id"],
      ["antigravity-acp", "jetski_state.pbtxt"],
    ] as const) {
      yield* copyIfNewer(
        path.join(input.sourceProfileDirectory, ...rel),
        path.join(input.helperProfileDirectory, ...rel),
      );
    }

    const srcCliDir = path.join(input.sourceProfileDirectory, "antigravity-cli");
    if (yield* fs.exists(srcCliDir).pipe(Effect.orElseSucceed(() => false))) {
      const entries = yield* fs.readDirectory(srcCliDir).pipe(Effect.orElseSucceed(() => []));
      for (const name of entries) {
        yield* copyIfNewer(
          path.join(srcCliDir, name),
          path.join(input.helperProfileDirectory, "antigravity-cli", name),
        );
      }
    }
  },
);

export const prepareAntigravityProfile = Effect.fn("prepareAntigravityProfile")(function* (input: {
  readonly profileDirectory: string;
  readonly baseEnv?: NodeJS.ProcessEnv;
  readonly runtimeExecutablePath?: string;
  readonly platform?: NodeJS.Platform;
  readonly auth?: AntigravityAuthConfig;
  readonly userHome?: string;
  readonly tempDirectory?: string;
  readonly skipUserConfig?: boolean;
}) {`,
    );
    src = src.replace(
      `  yield* linkAntigravityUserConfig({ profileDirectory: geminiHome, userHome, platform });
  if (platform === "win32") {
    yield* copyAntigravityUserConfigFiles({ profileDirectory: geminiHome, userHome });
  }
  return profile;`,
      `  if (!input.skipUserConfig) {
    yield* linkAntigravityUserConfig({ profileDirectory: geminiHome, userHome, platform });
    if (platform === "win32") {
      yield* copyAntigravityUserConfigFiles({ profileDirectory: geminiHome, userHome });
    }
  }
  return profile;`,
    );
    writeText(rel, src);
  }
  assertIncludes(src, "syncAntigravityTextHelperProfile", rel);
}

// 4b. apps/server/src/provider/Drivers/AntigravityDriver.ts
{
  const rel = "apps/server/src/provider/Drivers/AntigravityDriver.ts";
  let src = readText(rel);
  if (!src.includes("makeAntigravityUsageProbe")) {
    src = src.replace(
      'import { makeAntigravityProvider } from "../AntigravityProvider.ts";',
      'import { makeAntigravityProvider } from "../AntigravityProvider.ts";\nimport { makeAntigravityUsageProbe } from "../antigravityUsageLimits.ts";',
    );
    src = src.replace(
      "    const provider = yield* makeAntigravityProvider(settings, {",
      `    const usageProbe = yield* makeAntigravityUsageProbe({
      profileDirectory,
      authMethod: settings.authMethod,
    }).pipe(
      Effect.provideService(FileSystem.FileSystem, fileSystem),
      Effect.provideService(Path.Path, path),
      Effect.provideService(Digest.Digest, digest),
    );

    const provider = yield* makeAntigravityProvider(settings, {
      usageProbe,`,
    );
    writeText(rel, src);
  }
  if (!src.includes("syncAntigravityTextHelperProfile")) {
    src = src.replace(
      "  resolveAntigravityInstanceDirectories,\n  type AntigravityAuthConfig,",
      "  resolveAntigravityInstanceDirectories,\n  syncAntigravityTextHelperProfile,\n  type AntigravityAuthConfig,",
    );
    src = src.replace(
      `    for (const directory of [
      directories.runtimeTemp,
      path.join(profileDirectory, "antigravity-acp", "tmp"),
    ]) {`,
      `    for (const directory of [
      directories.runtimeTemp,
      path.join(profileDirectory, "antigravity-acp", "tmp"),
      path.join(directories.textHelperProfile, "antigravity-acp", "tmp"),
    ]) {`,
    );
    src = src.replace(
      `    const prepareSpawn = Effect.fn("AntigravityDriver.prepareSpawn")(function* (
      cwd: string,
      baseEnv: NodeJS.ProcessEnv,
    ): Effect.fn.Return<`,
      `    const prepareSpawn = Effect.fn("AntigravityDriver.prepareSpawn")(function* (
      cwd: string,
      baseEnv: NodeJS.ProcessEnv,
      spawnOptions?: {
        readonly profileDirectory?: string;
        readonly skipUserConfig?: boolean;
      },
    ): Effect.fn.Return<`,
    );
    src = src.replace(
      `      const profile = yield* prepareAntigravityProfile({
        profileDirectory,
        baseEnv: processEnvironment,
        auth,
        userHome,
        tempDirectory: directories.runtimeTemp,
      }).pipe(`,
      `      const targetProfileDirectory = spawnOptions?.profileDirectory ?? profileDirectory;
      if (spawnOptions?.skipUserConfig) {
        yield* syncAntigravityTextHelperProfile({
          sourceProfileDirectory: profileDirectory,
          helperProfileDirectory: targetProfileDirectory,
        }).pipe(
          Effect.provideService(FileSystem.FileSystem, fileSystem),
          Effect.provideService(Path.Path, path),
        );
      }
      const profile = yield* prepareAntigravityProfile({
        profileDirectory: targetProfileDirectory,
        baseEnv: processEnvironment,
        auth,
        userHome,
        tempDirectory: directories.runtimeTemp,
        ...(spawnOptions?.skipUserConfig ? { skipUserConfig: true } : {}),
      }).pipe(`,
    );
    src = src.replace(
      `    const makeRuntime = Effect.fn("AntigravityDriver.makeRuntime")(function* (
      input: AntigravityAdapterV2RuntimeInput,
    ): Effect.fn.Return<`,
      `    const makeRuntime = Effect.fn("AntigravityDriver.makeRuntime")(function* (
      input: AntigravityAdapterV2RuntimeInput,
      spawnOptions?: {
        readonly profileDirectory?: string;
        readonly skipUserConfig?: boolean;
      },
    ): Effect.fn.Return<`,
    );
    src = src.replace(
      `      const { executable, spawn } = yield* prepareSpawn(
        runtimeInput.cwd,
        threadEnvironment === undefined
          ? processEnvironment
          : { ...processEnvironment, ...threadEnvironment },
      );`,
      `      const { executable, spawn } = yield* prepareSpawn(
        runtimeInput.cwd,
        threadEnvironment === undefined
          ? processEnvironment
          : { ...processEnvironment, ...threadEnvironment },
        spawnOptions,
      );`,
    );
    src = src.replace(
      "      onSignedOut: Effect.suspend(() => provider.onSignedOut),",
      `      onSignedOut: Effect.suspend(() => provider.onSignedOut).pipe(
        Effect.andThen(
          fileSystem
            .remove(directories.textHelperProfile, { recursive: true, force: true })
            .pipe(Effect.ignore),
        ),
      ),`,
    );
    src = src.replace(
      `    const textGeneration = yield* makeAntigravityTextGeneration({
      profileDirectory,
      defaultModel,
      withProcess: authFlow.withProcess,
      makeRuntime: (cwd) =>
        makeRuntime({
          cwd,
          mcpServers: [],
        }),
    });`,
      `    const textGeneration = yield* makeAntigravityTextGeneration({
      profileDirectory: directories.textHelperProfile,
      defaultModel,
      withProcess: authFlow.withProcess,
      makeRuntime: (cwd) =>
        makeRuntime(
          {
            cwd,
            mcpServers: [],
          },
          {
            profileDirectory: directories.textHelperProfile,
            skipUserConfig: true,
          },
        ),
    });`,
    );
    writeText(rel, src);
  }
  assertIncludes(src, "makeAntigravityUsageProbe", rel);
  assertIncludes(src, "directories.textHelperProfile", rel);
}

// 4b-2. apps/server/src/textGeneration/AntigravityTextGeneration.ts -> Allow Antigravity profiles with MCP servers & default to lightweight thinking effort
{
  const rel = "apps/server/src/textGeneration/AntigravityTextGeneration.ts";
  let src = readText(rel);
  src = src.replace(
    'for (const name of ["hooks.json", "mcp_config.json"]) {',
    'for (const name of ["hooks.json"]) {',
  );
  if (!src.includes("preferredLight")) {
    src = src.replace(
      `            const savedOptions = input.modelSelection.options;
            if (savedOptions?.length) {
              const thinking = antigravityThinkingConfig(yield* runtime.getConfigOptions);
              const selected = savedOptions.find((option) => option.id === thinking?.id)?.value;
              if (
                thinking !== undefined &&
                typeof selected === "string" &&
                selected !== thinking.currentValue &&
                collectSessionConfigOptionValues(thinking).includes(selected)
              ) {
                yield* runtime.setConfigOption(thinking.id, selected).pipe(
                  Effect.catchTags({
                    AcpRequestError: (error) =>
                      error.code === -32602
                        ? Effect.logDebug("Antigravity rejected the saved thinking level", {
                            optionId: thinking.id,
                            value: selected,
                          })
                        : Effect.fail(error),
                  }),
                );
              }
            }`,
      `            const savedOptions = input.modelSelection.options;
            const thinking = antigravityThinkingConfig(yield* runtime.getConfigOptions);
            if (thinking !== undefined) {
              const allowedValues = collectSessionConfigOptionValues(thinking);
              const explicit = savedOptions?.find((option) => option.id === thinking.id)?.value;
              const preferredLight = ["minimal", "low", "none", "medium"].find((candidate) =>
                allowedValues.includes(candidate),
              );
              const selected = typeof explicit === "string" ? explicit : preferredLight;
              if (
                typeof selected === "string" &&
                selected !== thinking.currentValue &&
                allowedValues.includes(selected)
              ) {
                yield* runtime.setConfigOption(thinking.id, selected).pipe(
                  Effect.catchTags({
                    AcpRequestError: (error) =>
                      error.code === -32602
                        ? Effect.logDebug("Antigravity rejected the saved thinking level", {
                            optionId: thinking.id,
                            value: selected,
                          })
                        : Effect.fail(error),
                  }),
                );
              }
            }`,
    );
  }
  assertIncludes(src, 'for (const name of ["hooks.json"]) {', rel);
  assertIncludes(src, "preferredLight", rel);
  writeText(rel, src);
}

// 4c. apps/web/src/components/usage/UsageLimitsPooled.tsx -> Missing Antigravity Quota Refresh Reminder
{
  const rel = "apps/web/src/components/usage/UsageLimitsPooled.tsx";
  let src = readText(rel);
  if (!src.includes("collectMissingAntigravityQuotaReminders")) {
    const helperFn = `function collectMissingAntigravityQuotaReminders(
  presentations: Parameters<typeof collectLimitAccounts>[0],
): readonly string[] {
  const out: string[] = [];
  const multiEnv = presentations.size > 1;
  for (const presentation of presentations.values()) {
    const envLabel = presentation.entry.target.label;
    for (const provider of presentation.serverConfig?.providers ?? []) {
      if (provider.driver !== "antigravity" || !provider.enabled || !provider.installed) continue;
      const ul = provider.usageLimits;
      if (!ul) continue;
      const hasValidWindows = !ul.unavailable && ul.windows.length > 0;
      if (hasValidWindows) continue;
      const instName = provider.displayName?.trim() || "Antigravity";
      const prefix = multiEnv ? \`\${envLabel} · \${instName}\` : instName;
      out.push(\`\${prefix}：配额暂未同步或登录态已过期 · 请使用该模型发送消息以刷新使用量\`);
    }
  }
  return out;
}

`;
    assertIncludes(src, "export function UsageLimitsPooled(", rel);
    src = src.replace(
      "export function UsageLimitsPooled(",
      `${helperFn}export function UsageLimitsPooled(`,
    );
    src = src.replace(
      "  const notices = collectLimitNotices(presentations, m);",
      `  const baseNotices = collectLimitNotices(presentations, m);
  const agReminders = collectMissingAntigravityQuotaReminders(presentations);
  const notices = [
    ...baseNotices.filter((n) => !n.includes("请使用该模型发送消息以刷新使用量")),
    ...agReminders,
  ];`,
    );
    writeText(rel, src);
  } else if (src.includes("const hasValidWindows = Boolean(ul && !ul.unavailable && ul.windows.length > 0);")) {
    src = src.replace(
      "      const hasValidWindows = Boolean(ul && !ul.unavailable && ul.windows.length > 0);",
      "      if (!ul) continue;\n      const hasValidWindows = !ul.unavailable && ul.windows.length > 0;",
    );
    writeText(rel, src);
  }
  assertIncludes(src, "collectMissingAntigravityQuotaReminders", rel);
  assertIncludes(src, "if (!ul) continue;", rel);
}

// ---------------------------------------------------------------------------
// 5. Starred-Model Sidebar Category Suggestion RPC (`server.suggestSidebarCategories`)
// ---------------------------------------------------------------------------
copyAsset("sidebarCategoriesContract.ts", "packages/contracts/src/sidebarCategories.ts");
copyAsset("SidebarCategorySuggestions.ts", "apps/server/src/sidebar/SidebarCategorySuggestions.ts");

// 5a. packages/contracts/src/index.ts
{
  const rel = "packages/contracts/src/index.ts";
  let src = readText(rel);
  if (!src.includes('./sidebarCategories.ts')) {
    src = `${src.trimEnd()}\nexport * from "./sidebarCategories.ts";\n`;
    writeText(rel, src);
  }
  assertIncludes(src, './sidebarCategories.ts', rel);
}

// 5b. packages/contracts/src/rpc.ts
{
  const rel = "packages/contracts/src/rpc.ts";
  let src = readText(rel);
  if (!src.includes("serverSuggestSidebarCategories")) {
    src = `import {\n  SidebarCategorySuggestionError,\n  SidebarCategorySuggestionInput,\n  SidebarCategorySuggestionOutput,\n} from "./sidebarCategories.ts";\n${src}`;
    assertIncludes(src, '  serverListTextGeneratorModels: "server.listTextGeneratorModels",', rel);
    src = src.replace(
      '  serverListTextGeneratorModels: "server.listTextGeneratorModels",',
      '  serverListTextGeneratorModels: "server.listTextGeneratorModels",\n  serverSuggestSidebarCategories: "server.suggestSidebarCategories",',
    );
    assertIncludes(src, "export const WsSubscribeServerConfigRpc =", rel);
    src = src.replace(
      "export const WsSubscribeServerConfigRpc =",
      `export const WsServerSuggestSidebarCategoriesRpc = Rpc.make(WS_METHODS.serverSuggestSidebarCategories, {
  payload: SidebarCategorySuggestionInput,
  success: SidebarCategorySuggestionOutput,
  error: Schema.Union([SidebarCategorySuggestionError, EnvironmentAuthorizationError]),
});

export const WsSubscribeServerConfigRpc =`,
    );
    assertIncludes(src, "  WsSubscribeServerConfigRpc,", rel);
    src = src.replace(
      "  WsSubscribeServerConfigRpc,",
      "  WsServerSuggestSidebarCategoriesRpc,\n  WsSubscribeServerConfigRpc,",
    );
    writeText(rel, src);
  }
  assertIncludes(src, "serverSuggestSidebarCategories", rel);
}

// 5c. packages/contracts/src/clientRpcPermissions.ts
{
  const rel = "packages/contracts/src/clientRpcPermissions.ts";
  let src = readText(rel);
  if (!src.includes("serverSuggestSidebarCategories")) {
    assertIncludes(src, "[WS_METHODS.serverListTextGeneratorModels]: AuthSettingsWriteScope,", rel);
    src = src.replace(
      "[WS_METHODS.serverListTextGeneratorModels]: AuthSettingsWriteScope,",
      "[WS_METHODS.serverListTextGeneratorModels]: AuthSettingsWriteScope,\n  [WS_METHODS.serverSuggestSidebarCategories]: AuthOrchestrationOperateScope,",
    );
    writeText(rel, src);
  }
  assertIncludes(src, "serverSuggestSidebarCategories", rel);
}

// 5d. apps/server/src/auth/RpcAuthorization.ts
{
  const rel = "apps/server/src/auth/RpcAuthorization.ts";
  let src = readText(rel);
  if (!src.includes("serverSuggestSidebarCategories")) {
    assertIncludes(src, "[WS_METHODS.serverReportClientActivity]: AuthOrchestrationReadScope,", rel);
    src = src.replace(
      "[WS_METHODS.serverReportClientActivity]: AuthOrchestrationReadScope,",
      "[WS_METHODS.serverReportClientActivity]: AuthOrchestrationReadScope,\n  [WS_METHODS.serverSuggestSidebarCategories]: AuthOrchestrationOperateScope,",
    );
    writeText(rel, src);
  }
  assertIncludes(src, "serverSuggestSidebarCategories", rel);
}

// 5e. apps/server/src/observability/RpcInstrumentation.ts
{
  const rel = "apps/server/src/observability/RpcInstrumentation.ts";
  let src = readText(rel);
  if (!src.includes("serverSuggestSidebarCategories")) {
    assertIncludes(src, '[WS_METHODS.serverListTextGeneratorModels]: "server",', rel);
    src = src.replace(
      '[WS_METHODS.serverListTextGeneratorModels]: "server",',
      '[WS_METHODS.serverListTextGeneratorModels]: "server",\n  [WS_METHODS.serverSuggestSidebarCategories]: "server",',
    );
    writeText(rel, src);
  }
  assertIncludes(src, "serverSuggestSidebarCategories", rel);
}

// 5f. packages/client-runtime/src/state/server.ts
{
  const rel = "packages/client-runtime/src/state/server.ts";
  let src = readText(rel);
  if (!src.includes("suggestSidebarCategories:")) {
    assertIncludes(src, "    listTextGeneratorModels: createEnvironmentRpcCommand(runtime, {", rel);
    src = src.replace(
      "    listTextGeneratorModels: createEnvironmentRpcCommand(runtime, {",
      `    suggestSidebarCategories: createEnvironmentRpcCommand(runtime, {
      label: "environment-data:server:suggest-sidebar-categories",
      tag: WS_METHODS.serverSuggestSidebarCategories,
      concurrency: {
        mode: "singleFlight",
        key: ({ environmentId }) => environmentId,
      },
    }),
    listTextGeneratorModels: createEnvironmentRpcCommand(runtime, {`,
    );
    writeText(rel, src);
  }
  assertIncludes(src, "suggestSidebarCategories:", rel);
}

// 5g. apps/server/src/ws.ts
{
  const rel = "apps/server/src/ws.ts";
  let src = readText(rel);
  if (!src.includes("suggestSidebarCategories")) {
    src = `import { suggestSidebarCategories } from "./sidebar/SidebarCategorySuggestions.ts";\n${src}`;
    assertIncludes(
      src,
      "[WS_METHODS.serverListTextGeneratorModels]: (input) => textGenerators.listModels(input),",
      rel,
    );
    src = src.replace(
      "[WS_METHODS.serverListTextGeneratorModels]: (input) => textGenerators.listModels(input),",
      `[WS_METHODS.serverListTextGeneratorModels]: (input) => textGenerators.listModels(input),
        [WS_METHODS.serverSuggestSidebarCategories]: (input) =>
          Effect.flatMap(providerRegistry.getProviders, (providers) =>
            suggestSidebarCategories(input, providers, providerInstances, usage),
          ),`,
    );
    writeText(rel, src);
  }
  assertIncludes(src, "suggestSidebarCategories", rel);
}

// ---------------------------------------------------------------------------
// 6. ChatView Enhancements (`StardustSessionStatsBar` + `StardustLiveExecutionCapsule`)
// ---------------------------------------------------------------------------
copyAsset("StardustSessionStatsBar.tsx", "apps/web/src/components/chat/StardustSessionStatsBar.tsx");
copyAsset(
  "StardustLiveExecutionCapsule.tsx",
  "apps/web/src/components/chat/StardustLiveExecutionCapsule.tsx",
);

{
  const rel = "apps/web/src/components/ChatView.tsx";
  let src = readText(rel);
  if (!src.includes("StardustSessionStatsBar")) {
    src = `import { StardustLiveExecutionCapsule } from "./chat/StardustLiveExecutionCapsule";\nimport { StardustSessionStatsBar } from "./chat/StardustSessionStatsBar";\n${src}`;
    assertIncludes(src, "<ChildThreadApprovals threadRef={activeThreadRef} />", rel);
    src = src.replace(
      "<ChildThreadApprovals threadRef={activeThreadRef} />",
      `<StardustLiveExecutionCapsule
                      projection={serverProjection}
                      shell={activeThreadShell}
                      isDraftHeroState={isDraftHeroState}
                    />
                    <ChildThreadApprovals threadRef={activeThreadRef} />`,
    );
    assertIncludes(src, "</ComposerSurface.Shell>", rel);
    src = src.replace(
      "</ComposerSurface.Shell>",
      `</ComposerSurface.Shell>
                      {!isDraftHeroState ? (
                        <StardustSessionStatsBar
                          projection={serverProjection}
                          disconnected={Boolean(activeEnvironmentUnavailableState)}
                        />
                      ) : null}`,
    );
    writeText(rel, src);
  }
  assertIncludes(src, "StardustSessionStatsBar", rel);
  assertIncludes(src, "StardustLiveExecutionCapsule", rel);
}

// ---------------------------------------------------------------------------
// 7. `所有项目` 3-Tier Sidebar + Custom Category Modals + Centered Project Popup
// ---------------------------------------------------------------------------
copyAsset("stardustCategories.ts", "apps/web/src/components/sidebar/stardustCategories.ts");
copyAsset(
  "StardustSidebarCategoryModals.tsx",
  "apps/web/src/components/sidebar/StardustSidebarCategoryModals.tsx",
);
copyAsset(
  "StardustAllProjectsWorkbench.tsx",
  "apps/web/src/components/sidebar/StardustAllProjectsWorkbench.tsx",
);

// 7a. apps/web/src/components/threadActionMenu.logic.ts -> Right-Click "归入分类…"
{
  const rel = "apps/web/src/components/threadActionMenu.logic.ts";
  let src = readText(rel);
  if (!src.includes('"move-to-category"')) {
    src = src.replace(
      '  | "filter-by-project"',
      '  | "filter-by-project"\n  | "move-to-category"',
    );
    src = src.replace(
      '    "project-settings",',
      '    "move-to-category",\n    "project-settings",',
    );
    src = src.replace(
      '            : { id: "pin" as const, label: resolve(msg("Pin thread")), icon: "pin" },\n        ]\n      : []),',
      `            : { id: "pin" as const, label: resolve(msg("Pin thread")), icon: "pin" },
        ]
      : []),
    { id: "move-to-category" as const, label: "归入分类…", icon: "folder-tree" },`,
    );
    writeText(rel, src);
  }
  assertIncludes(src, '"move-to-category"', rel);
}

// 7b. apps/web/src/components/Sidebar.tsx
{
  const rel = "apps/web/src/components/Sidebar.tsx";
  let src = readText(rel);
  if (!src.includes("StardustAllProjectsTopWorkbench")) {
    src = `import {\n  openStardustThreadCategoryPicker,\n  useStardustCategorySettings,\n} from "./sidebar/stardustCategories";\nimport {\n  StardustAllProjectsCategories,\n  StardustAllProjectsTopWorkbench,\n} from "./sidebar/StardustAllProjectsWorkbench";\nimport { StardustSidebarCategoryModals } from "./sidebar/StardustSidebarCategoryModals";\n${src}`;

    // Enable native project folders when user selects preset === "project" in 所有项目
    assertIncludes(src, "  const {\n    workingShelfEnabled,", rel);
    src = src.replace(
      "  const {\n    workingShelfEnabled,",
      "  const stardustCatSettings = useStardustCategorySettings();\n  const {\n    workingShelfEnabled,",
    );
    src = src.replace(
      "    folderGroups: boringSidebarEnabled\n      ? scopedProjectGroups.length === 0",
      "    folderGroups: (boringSidebarEnabled || (scopedProjectGroups.length === 0 && stardustCatSettings.enabled && stardustCatSettings.preset === \"project\"))\n      ? scopedProjectGroups.length === 0",
    );

    // Handle right-click "move-to-category"
    assertIncludes(src, '          case "filter-by-project":', rel);
    src = src.replace(
      '          case "filter-by-project":',
      `          case "move-to-category":
            openStardustThreadCategoryPicker({
              threadKey,
              title: thread.title,
              projectName: threadProjectGroup?.displayName ?? null,
            });
            return;
          case "filter-by-project":`,
    );

    // Mark Project Scope ComboboxPopup so CSS centers it cleanly in the viewport
    src = src.replace(
      '                  <ComboboxPopup\n                    align="start"\n                    collisionAvoidance={{ side: "flip", align: "shift" }}',
      '                  <ComboboxPopup\n                    data-project-scope-popup="true"\n                    align="start"\n                    collisionAvoidance={{ side: "flip", align: "shift" }}',
    );

    // Inject Top Workbench (`运行中 / 待处理 / 工作流`) + Middle `分类` in `所有项目` mode
    assertIncludes(src, '                    const items: ReactNode[] = [', rel);
    src = src.replace(
      `                    const items: ReactNode[] = [
                      <SidebarDraftBlock
                        key="draft-sessions"
                        draftIds={draftIds}
                        routeDraftComposer={routeDraftComposer}
                        terminalLabels={draftTerminalLabels}
                        jumpLabelByDraftId={draftJumpLabelById}
                        projectByKey={projectByKey}
                        projectDisplayNameByKey={projectDisplayNameByKey}
                        routeDraftId={routeDraftIdForRows}
                        onNavigateToDraft={navigateToDraft}
                        onDraftContextMenu={handleDraftContextMenu}
                      />,
                    ];`,
      `                    const isAllProjectsWorkbench = projectScopeKeys.length === 0 && !isSearchingThreads;
                    const stardustCustomCatsActive =
                      isAllProjectsWorkbench &&
                      stardustCatSettings.enabled &&
                      stardustCatSettings.preset !== "project" &&
                      projectFolders === null;
                    const items: ReactNode[] = [
                      <SidebarDraftBlock
                        key="draft-sessions"
                        draftIds={draftIds}
                        routeDraftComposer={routeDraftComposer}
                        terminalLabels={draftTerminalLabels}
                        jumpLabelByDraftId={draftJumpLabelById}
                        projectByKey={projectByKey}
                        projectDisplayNameByKey={projectDisplayNameByKey}
                        routeDraftId={routeDraftIdForRows}
                        onNavigateToDraft={navigateToDraft}
                        onDraftContextMenu={handleDraftContextMenu}
                      />,
                      ...(isAllProjectsWorkbench
                        ? [
                            <StardustAllProjectsTopWorkbench
                              key="t3m-top-workbench"
                              allThreads={listedThreads}
                              connectedEnvironmentIds={connectedEnvironmentIds}
                              routeRowThreadKey={routeRowThreadKey}
                              projectDisplayNameByKey={projectDisplayNameByKey}
                              onNavigateToThread={navigateToThread}
                              onOpenWorkflows={(target) => {
                                if (isMobile) setOpenMobile(false);
                                void router.navigate({
                                  to: "/workflows",
                                  search: target ?? {},
                                });
                              }}
                              onSettleThread={attemptSettle}
                            />,
                          ]
                        : []),
                    ];`,
    );

    // Skip flat active rows when custom categories render them, and skip redundant bottom working rows in 所有项目
    src = src.replace(
      '                        // Folders draw active rows in their own place below.\n                        if (projectFolders !== null && item.section === "active") continue;',
      `                        // Folders or custom categories draw active rows in their own place below.
                        if ((projectFolders !== null || stardustCustomCatsActive) && item.section === "active") continue;
                        if (isAllProjectsWorkbench && item.section === "working") continue;`,
    );

    // Render custom categories at active-placeholder in 所有项目
    src = src.replace(
      '                        case "active-placeholder":\n                          items.push(',
      `                        case "active-placeholder":
                          if (stardustCustomCatsActive) {
                            items.push(
                              <StardustAllProjectsCategories
                                key="t3m-categories-workbench"
                                activeThreads={[...activeThreads, ...workingThreads]}
                                routeRowThreadKey={routeRowThreadKey}
                                projectDisplayNameByKey={projectDisplayNameByKey}
                                renderThreadRow={(t) => renderThreadRow(t, "active")}
                              />,
                            );
                          }
                          items.push(`,
    );

    // Hide bottom `working-header` in `所有项目` (top `运行中` replaces it) and preserve `mt-auto` on bottom `已延后` / `已收尾`
    src = src.replace(
      '                        case "working-header":\n                          items.push(',
      '                        case "working-header":\n                          if (isAllProjectsWorkbench) break;\n                          items.push(',
    );
    src = src.replace(
      '                              className={cn(workingThreads.length === 0 && "mt-auto")}',
      '                              className={cn((workingThreads.length === 0 || isAllProjectsWorkbench) && "mt-auto")}',
    );
    src = src.replace(
      '                              className={cn(\n                                workingThreads.length + snoozedThreads.length === 0 && "mt-auto",\n                              )}',
      '                              className={cn(\n                                (isAllProjectsWorkbench ? snoozedThreads.length === 0 : workingThreads.length + snoozedThreads.length === 0) && "mt-auto",\n                              )}',
    );

    // Mount StardustSidebarCategoryModals right before </SidebarFolderDrop>
    src = src.replace(
      "      <SidebarChromeFooter />\n    </SidebarFolderDrop>",
      `      <SidebarChromeFooter />
      <StardustSidebarCategoryModals
        activeThreads={[...activeThreads, ...workingThreads].map((t) => ({
          key: scopedThreadKey(scopeThreadRef(t.environmentId, t.id)),
          title: t.title,
          projectName: projectDisplayNameByKey.get(\`\${t.environmentId}:\${t.projectId}\`) ?? null,
        }))}
      />
    </SidebarFolderDrop>`,
    );

    writeText(rel, src);
  }
  assertIncludes(src, "const stardustCustomCatsActive =", rel);
  if (!src.includes("stardustCustomCatsDrag")) {
    const dragRe =
      /  const isContextDrag =\r?\n    projectFolders !== null \|\|\r?\n    dragState\?\.contextDrag === true \|\|\r?\n    dragState\?\.activeSection === "working";/;
    if (!dragRe.test(src)) {
      throw new Error(`[apply-overlay] Missing isContextDrag block in ${rel}`);
    }
    src = src.replace(
      dragRe,
      `  const stardustCustomCatsDrag =
    projectScopeKeys.length === 0 &&
    !isSearchingThreads &&
    stardustCatSettings.enabled &&
    stardustCatSettings.preset !== "project";
  const isContextDrag =
    projectFolders !== null ||
    stardustCustomCatsDrag ||
    dragState?.contextDrag === true ||
    dragState?.activeSection === "working";`,
    );
    writeText(rel, src);
  }
  assertIncludes(src, "StardustAllProjectsTopWorkbench", rel);
  assertIncludes(src, 'data-project-scope-popup="true"', rel);
}

// ---------------------------------------------------------------------------
// 8. scripts/build-desktop-artifact.ts (Windows NSIS, icon.ico extraResource & electron-updater)
// ---------------------------------------------------------------------------
{
  const rel = "scripts/build-desktop-artifact.ts";
  let src = readText(rel);

  src = src.replace(
    /const DESKTOP_APP_ID = "[^"]+";/,
    `const DESKTOP_APP_ID = "${TARGET_APP_ID}";`,
  );
  assertIncludes(src, `const DESKTOP_APP_ID = "${TARGET_APP_ID}";`, rel);

  src = src.replace(
    /export const WINDOWS_PACKAGED_PAYLOAD_FILE_LIMIT = \d+;/,
    "export const WINDOWS_PACKAGED_PAYLOAD_FILE_LIMIT = 200;",
  );
  assertIncludes(src, "WINDOWS_PACKAGED_PAYLOAD_FILE_LIMIT = 200;", rel);

  // Ensure icon.ico is placed on disk inside resources/icon.ico on Windows so BrowserWindow({ icon }) loads it outside app.asar
  if (!src.includes('from: "apps/desktop/resources/icon.ico"')) {
    assertIncludes(src, "export const DESKTOP_EXTRA_RESOURCES = [", rel);
    src = src.replace(
      "export const DESKTOP_EXTRA_RESOURCES = [",
      `export const DESKTOP_EXTRA_RESOURCES = [\n  {\n    from: "apps/desktop/resources/icon.ico",\n    to: "icon.ico",\n  },`,
    );
  }
  assertIncludes(src, 'from: "apps/desktop/resources/icon.ico"', rel);

  src = src.replace(
    /artifactName:\s*"[^"]*\$\{version\}-\$\{arch\}\.\$\{ext\}",/,
    'artifactName: "T3-Stardust-${version}-${arch}.${ext}",',
  );
  assertIncludes(src, 'artifactName: "T3-Stardust-${version}-${arch}.${ext}",', rel);

  src = src.replaceAll(
    "https://github.com/pingdotgg/t3code",
    `https://github.com/${TARGET_REPO}`,
  );

  const publishSnippet = `  buildConfig.publish = [
    {
      provider: "github",
      owner: "${TARGET_OWNER}",
      repo: "${TARGET_REPO_NAME}",
      releaseType: "release",
    },
  ];`;
  if (!src.includes(`repo: "${TARGET_REPO_NAME}"`)) {
    const upstreamPublishRe =
      /  (?:\/\/[^\n]*\r?\n  )*buildConfig\.publish = [\s\S]*?(?:\r?\n  \})?(?=\r?\n\r?\n  if \(platform === "mac"\))/;
    if (upstreamPublishRe.test(src)) {
      src = src.replace(upstreamPublishRe, publishSnippet);
    } else {
      throw new Error(`[apply-overlay] Could not find buildConfig.publish block in ${rel}`);
    }
  }
  assertIncludes(src, `repo: "${TARGET_REPO_NAME}"`, rel);

  src = src.replace(
    /const stagePackageJson: StagePackageJson = \{\r?\n    name: "[^"]+",/,
    'const stagePackageJson: StagePackageJson = {\n    name: "t3-stardust",',
  );
  assertIncludes(src, 'name: "t3-stardust",', rel);

  src = src.replace(/shortcutName:\s*"[^"]+",/, `shortcutName: "${DISPLAY_BRAND_NAME}",`);
  if (!src.includes(`shortcutName: "${DISPLAY_BRAND_NAME}"`)) {
    src = src.replace(
      'include: "apps/desktop/resources/installer.nsh",',
      `include: "apps/desktop/resources/installer.nsh",\n      shortcutName: "${DISPLAY_BRAND_NAME}",`,
    );
  }
  assertIncludes(src, `shortcutName: "${DISPLAY_BRAND_NAME}"`, rel);

  if (!src.includes('executableName: "T3 Stardust"')) {
    src = src.replace(
      'icon: "icon.ico",',
      'icon: "icon.ico",\n      executableName: "T3 Stardust",',
    );
  }
  assertIncludes(src, 'executableName: "T3 Stardust"', rel);

  src = src.replace(
    'appExecutableName: `${resolveDesktopProductName(appVersion)}.exe`,',
    'appExecutableName: "T3 Stardust.exe",',
  );
  assertIncludes(src, 'appExecutableName: "T3 Stardust.exe",', rel);

  if (!src.includes("verifyUpdateCodeSignature: false")) {
    assertIncludes(src, "signAndEditExecutable: true,", rel);
    src = src.replace(
      "signAndEditExecutable: true,",
      "signAndEditExecutable: true,\n      verifyUpdateCodeSignature: false,",
    );
  }
  assertIncludes(src, "verifyUpdateCodeSignature: false", rel);

  writeText(rel, src);
}

console.log(
  `[apply-overlay] Successfully applied & verified ${DISPLAY_BRAND_NAME} overlay on pure official base (${TARGET_REPO}).`,
);
