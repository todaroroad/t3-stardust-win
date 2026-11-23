#!/usr/bin/env node
/**
 * Idempotently applies all T3 Stardust Windows customizations on top of a fresh
 * `zds-xiaoxin/xiaoxin-t3code` tree:
 *  1. Extracts upstream Stardust base version (`COMMUNITY_BASE_TAG`) into `.stardust-base-version`.
 *  2. Purges `StardustStats` (xiaoxin666.cn active-device ping) & `CommunityUpdates` background polling.
 *  3. Applies Stardust 3-star gradient `Thought` icon & per-Thought duration/token `ThoughtUsageBadge`.
 *  4. Configures Windows side-by-side `appId` (`com.todaroroad.t3stardust`), product branding,
 *     multi-size Stardust `.ico`, and native `electron-updater` (`todaroroad/t3-stardust-win`).
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
// 1. Record upstream Stardust base version before deleting communityUpdates
// ---------------------------------------------------------------------------
const communityLogicRel = "apps/web/src/state/communityUpdates.logic.ts";
if (fs.existsSync(path.join(repoRoot, communityLogicRel))) {
  const logicSrc = readText(communityLogicRel);
  const tagMatch = /COMMUNITY_BASE_TAG\s*=\s*"v?(\d+\.\d+\.\d+)"/.exec(logicSrc);
  if (tagMatch?.[1]) {
    writeText(".stardust-base-version", `${tagMatch[1]}\n`);
    console.log(`[apply-overlay] Extracted upstream base version: ${tagMatch[1]}`);
  }
}
if (!fs.existsSync(path.join(repoRoot, ".stardust-base-version"))) {
  writeText(".stardust-base-version", "1.2.3\n");
}

// ---------------------------------------------------------------------------
// 2. Privacy & Telemetry Purge (StardustStats + CommunityUpdates)
// ---------------------------------------------------------------------------
const telemetryFilesToRemove = [
  "apps/web/src/state/stardustStats.ts",
  "apps/web/src/state/stardustStats.logic.ts",
  "apps/web/src/state/stardustStats.logic.test.ts",
  "apps/web/src/components/settings/StardustStats.tsx",
  "apps/web/src/state/communityUpdates.ts",
  "apps/web/src/state/communityUpdates.logic.ts",
  "apps/web/src/state/communityUpdates.test.ts",
  "apps/web/src/components/settings/CommunityUpdates.tsx",
  "apps/web/src/components/settings/CommunityUpdates.browser.test.tsx",
];
for (const rel of telemetryFilesToRemove) {
  const full = path.join(repoRoot, rel);
  if (fs.existsSync(full)) {
    fs.unlinkSync(full);
  }
}

// Clean apps/web/src/routes/__root.tsx
{
  const rel = "apps/web/src/routes/__root.tsx";
  let src = readText(rel);
  src = src.replace(
    /^import\s+\{\s*CommunityUpdateCoordinator\s*\}\s+from\s+"[^"]+";\r?\n/m,
    "",
  );
  src = src.replace(
    /^import\s+\{\s*StardustStatsCoordinator\s*\}\s+from\s+"[^"]+";\r?\n/m,
    "",
  );
  src = src.replace(/^\s*<CommunityUpdateCoordinator\s*\/>\r?\n/gm, "");
  src = src.replace(/^\s*<StardustStatsCoordinator\s*\/>\r?\n/gm, "");
  if (src.includes("StardustStatsCoordinator") || src.includes("CommunityUpdateCoordinator")) {
    throw new Error(`[apply-overlay] Failed to strip coordinators from ${rel}`);
  }
  writeText(rel, src);
}

// Clean apps/web/src/components/settings/SettingsPanels.tsx
{
  const rel = "apps/web/src/components/settings/SettingsPanels.tsx";
  let src = readText(rel);
  src = src.replace(
    /^import\s+\{\s*CommunityUpdateSettings\s*\}\s+from\s+"\.\/CommunityUpdates";\r?\n/m,
    "",
  );
  src = src.replace(/^\s*\{isElectron\s*&&\s*<CommunityUpdateSettings\s*\/>\}\r?\n/gm, "");
  if (src.includes("CommunityUpdateSettings")) {
    throw new Error(`[apply-overlay] Failed to strip CommunityUpdateSettings from ${rel}`);
  }
  writeText(rel, src);
}

// Scrub xiaoxin666.cn from i18n catalogs so zero references enter the bundle
for (const rel of ["apps/web/src/i18n/catalog.ts", "apps/web/src/i18n/translations/zh.json"]) {
  const full = path.join(repoRoot, rel);
  if (fs.existsSync(full)) {
    const src = readText(rel);
    if (src.includes("xiaoxin666.cn")) {
      writeText(rel, src.replaceAll("xiaoxin666.cn", "removed.local"));
    }
  }
}

// ---------------------------------------------------------------------------
// 3. Stardust Thought Icon & Per-Thought Usage Badge
// ---------------------------------------------------------------------------
fs.copyFileSync(
  path.join(assetsDir, "ThoughtUsageBadge.tsx"),
  path.join(repoRoot, "apps/web/src/components/chat/ThoughtUsageBadge.tsx"),
);

// 3a. TimelineToolActivityIcon.tsx
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
}

// 3b. TimelineWorkEntryRow.tsx
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
  assertIncludes(src, "<ThoughtUsageBadge workEntry={workEntry} />", rel);
}

// 3c. TimelineWorkGroupRows.tsx
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
// 4. Windows Side-by-Side Branding, Icons & Native Auto-Updater Config
// ---------------------------------------------------------------------------
const icoSrc = path.join(assetsDir, "stardust-windows.ico");
if (fs.existsSync(icoSrc)) {
  fs.copyFileSync(icoSrc, path.join(repoRoot, "assets/prod/t3-black-windows.ico"));
  fs.mkdirSync(path.join(repoRoot, "apps/desktop/resources"), { recursive: true });
  fs.copyFileSync(icoSrc, path.join(repoRoot, "apps/desktop/resources/icon.ico"));
}

// 4a. apps/desktop/package.json
{
  const rel = "apps/desktop/package.json";
  const pkg = JSON.parse(readText(rel));
  pkg.productName = "T3 Stardust";
  writeText(rel, `${JSON.stringify(pkg, null, 2)}\n`);
}

// 4b. apps/desktop/src/app/DesktopEnvironment.ts (distinct Windows AppUserModelId)
{
  const rel = "apps/desktop/src/app/DesktopEnvironment.ts";
  let src = readText(rel);
  src = src.replace(
    'isDevelopment ? "com.t3tools.t3code.dev" : "com.t3tools.t3code"',
    `isDevelopment ? "${TARGET_APP_ID}.dev" : "${TARGET_APP_ID}"`,
  );
  assertIncludes(src, TARGET_APP_ID, rel);
  writeText(rel, src);
}

// 4c. apps/web/src/components/desktopUpdate.logic.ts & DesktopStartupRecovery.ts & branding.ts
{
  const rel = "apps/web/src/components/desktopUpdate.logic.ts";
  let src = readText(rel);
  src = src.replace(
    /const DEFAULT_DESKTOP_RELEASE_REPOSITORY = "[^"]+";/,
    `const DEFAULT_DESKTOP_RELEASE_REPOSITORY = "${TARGET_REPO}";`,
  );
  assertIncludes(src, `DEFAULT_DESKTOP_RELEASE_REPOSITORY = "${TARGET_REPO}"`, rel);
  writeText(rel, src);
}
for (const rel of [
  "apps/desktop/src/app/DesktopStartupRecovery.ts",
  "apps/web/src/branding.ts",
]) {
  if (fs.existsSync(path.join(repoRoot, rel))) {
    const src = readText(rel).replaceAll("zds-xiaoxin/xiaoxin-t3code", TARGET_REPO);
    writeText(rel, src);
  }
}

// 4d. scripts/build-desktop-artifact.ts
{
  const rel = "scripts/build-desktop-artifact.ts";
  let src = readText(rel);

  // Separate appId so NSIS installs & updates into %LOCALAPPDATA%\Programs\T3 Stardust without overwriting Official T3 Code
  src = src.replace(
    /const DESKTOP_APP_ID = "[^"]+";/,
    `const DESKTOP_APP_ID = "${TARGET_APP_ID}";`,
  );
  assertIncludes(src, `const DESKTOP_APP_ID = "${TARGET_APP_ID}";`, rel);

  // Windows packaged payload file limit
  src = src.replace(
    /export const WINDOWS_PACKAGED_PAYLOAD_FILE_LIMIT = \d+;/,
    "export const WINDOWS_PACKAGED_PAYLOAD_FILE_LIMIT = 200;",
  );
  assertIncludes(src, "WINDOWS_PACKAGED_PAYLOAD_FILE_LIMIT = 200;", rel);

  // Artifact name
  src = src.replace(
    /artifactName:\s*"T3-(?:Code|Stardust)-\$\{version\}-\$\{arch\}\.\$\{ext\}",/,
    'artifactName: "T3-Stardust-${version}-${arch}.${ext}",',
  );
  assertIncludes(src, 'artifactName: "T3-Stardust-${version}-${arch}.${ext}",', rel);

  // Homepage
  src = src.replaceAll(
    "https://github.com/zds-xiaoxin/xiaoxin-t3code",
    `https://github.com/${TARGET_REPO}`,
  );

  // Always bake GitHub Releases publish feed for electron-updater (generates app-update.yml + latest.yml + .blockmap)
  const publishSnippet = `  buildConfig.publish = [
    {
      provider: "github",
      owner: "${TARGET_OWNER}",
      repo: "${TARGET_REPO_NAME}",
      releaseType: "release",
    },
  ];`;
  if (!src.includes(`repo: "${TARGET_REPO_NAME}"`)) {
    // Match either upstream's conditional publish block or our previous `buildConfig.publish = null;`
    const upstreamPublishRe =
      /  \/\/ Missing publish config[^\n]*\r?\n  buildConfig\.publish = null;\r?\n  if \(!isDesktopPreviewVersion\(version\)\) \{[\s\S]*?\r?\n  \}/;
    const flatPublishRe =
      /  (?:\/\/[^\n]*\r?\n  )?buildConfig\.publish = null;/;
    if (upstreamPublishRe.test(src)) {
      src = src.replace(upstreamPublishRe, publishSnippet);
    } else if (flatPublishRe.test(src)) {
      src = src.replace(flatPublishRe, publishSnippet);
    } else {
      throw new Error(`[apply-overlay] Could not find buildConfig.publish block in ${rel}`);
    }
  }
  assertIncludes(src, `repo: "${TARGET_REPO_NAME}"`, rel);

  // Disable Authenticode Publisher check on unsigned GitHub Actions NSIS updates (SHA-512 from latest.yml still enforced)
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

console.log("[apply-overlay] All T3 Stardust Windows customizations & auto-updater settings applied successfully.");
