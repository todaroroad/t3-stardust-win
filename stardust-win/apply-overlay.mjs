#!/usr/bin/env node
/**
 * Idempotently applies and verifies T3星辰版 (Pure Official Base Edition) source customizations:
 *  1. Pure official pingdotgg/t3code base — zero xiaoxin-t3code macOS bloat.
 *  2. 3-star gradient `StardustThoughtIcon` & per-Thought `ThoughtUsageBadge`.
 *  3. Side-by-side Windows identity (`com.todaroroad.t3stardust`, `T3星辰版`, `T3 Stardust.exe`)
 *     for seamless electron-updater upgrades without touching official `T3 Code (Beta)`.
 *  4. Remote server (`gcp-tw-agent`) version-skew & self-update suppression (`1.13.x` <-> `0.1.13`).
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
const DISPLAY_BRAND_NAME = "T3星辰版";

function readText(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), "utf8");
}

function writeText(relPath, content) {
  const fullPath = path.join(repoRoot, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, "utf8");
}

function assertIncludes(haystack, needle, contextLabel) {
  if (!haystack.includes(needle)) {
    throw new Error(`[apply-overlay] Missing expected pattern in ${contextLabel}: ${needle}`);
  }
}

// ---------------------------------------------------------------------------
// 1. Stardust Thought Icon & Per-Thought Usage Badge
// ---------------------------------------------------------------------------
fs.copyFileSync(
  path.join(assetsDir, "ThoughtUsageBadge.tsx"),
  path.join(repoRoot, "apps/web/src/components/chat/ThoughtUsageBadge.tsx"),
);

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
// 2. Windows Side-by-Side T3星辰版 Branding, Icons & Native Auto-Updater Config
// ---------------------------------------------------------------------------
const icoSrc = path.join(assetsDir, "stardust-windows.ico");
if (fs.existsSync(icoSrc)) {
  fs.copyFileSync(icoSrc, path.join(repoRoot, "assets/prod/t3-black-windows.ico"));
  fs.mkdirSync(path.join(repoRoot, "apps/desktop/resources"), { recursive: true });
  fs.copyFileSync(icoSrc, path.join(repoRoot, "apps/desktop/resources/icon.ico"));
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
  assertIncludes(src, TARGET_APP_ID, rel);
  assertIncludes(src, DISPLAY_BRAND_NAME, rel);
  writeText(rel, src);
}

// 2c. apps/web/src/branding.ts & apps/web/vite.config.ts
{
  const rel = "apps/web/src/branding.ts";
  let src = readText(rel);
  src = src.replace(
    'export const APP_BASE_NAME = injectedDesktopAppBranding?.baseName ?? "T3 Code";',
    `export const APP_BASE_NAME = injectedDesktopAppBranding?.baseName ?? "${DISPLAY_BRAND_NAME}";`,
  );
  src = src.replace(
    /export const APP_DISPLAY_NAME =[\s\S]*?formatAppDisplayName\(\{\s*baseName:\s*APP_BASE_NAME,\s*stageLabel:\s*APP_STAGE_LABEL\s*\}\);/,
    `export const APP_DISPLAY_NAME = injectedDesktopAppBranding?.displayName ?? "${DISPLAY_BRAND_NAME}";`,
  );
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

// 2e. apps/web/src/components/sidebar/SidebarChrome.tsx -> T3 星辰版 wordmark
{
  const rel = "apps/web/src/components/sidebar/SidebarChrome.tsx";
  let src = readText(rel);
  if (!src.includes('"星辰版"')) {
    src = src.replace('{"Code"}', '{"星辰版"}');
    writeText(rel, src);
  }
  assertIncludes(src, '"星辰版"', rel);
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
// 4. scripts/build-desktop-artifact.ts (Windows NSIS & electron-updater)
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

console.log(`[apply-overlay] Successfully applied & verified ${DISPLAY_BRAND_NAME} overlay on pure official base (${TARGET_REPO}).`);
