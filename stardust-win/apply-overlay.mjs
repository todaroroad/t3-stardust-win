#!/usr/bin/env node
/**
 * Idempotently applies and verifies all T3星辰版 (Windows) customizations & guards:
 *  1. Purges any third-party telemetry (`StardustStats` / `CommunityUpdates` / `xiaoxin666.cn`).
 *  2. Ensures 3-star gradient `StardustThoughtIcon` & per-Thought `ThoughtUsageBadge` are wired.
 *  3. Rebrands visible desktop & web UI to `T3星辰版` while preserving ASCII `executableName`
 *     (`T3 Stardust`), `artifactName` (`T3-Stardust-${version}-${arch}.${ext}`), `stagePackageJson.name`
 *     (`t3-stardust`), and `appId` (`com.todaroroad.t3stardust`) for seamless `electron-updater` upgrades.
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
// 1. Privacy & Telemetry Purge (StardustStats + CommunityUpdates)
// ---------------------------------------------------------------------------
for (const dirRel of ["apps/web/src/state", "apps/web/src/components/settings"]) {
  const dirFull = path.join(repoRoot, dirRel);
  if (!fs.existsSync(dirFull)) continue;
  for (const name of fs.readdirSync(dirFull)) {
    if (/^(stardustStats|StardustStats|communityUpdates|CommunityUpdates)\b/.test(name)) {
      fs.unlinkSync(path.join(dirFull, name));
    }
  }
}

for (const rel of ["apps/web/src/routes/__root.tsx", "apps/web/src/components/settings/SettingsPanels.tsx"]) {
  if (!fs.existsSync(path.join(repoRoot, rel))) continue;
  let src = readText(rel);
  src = src.replace(/^import\s+\{\s*CommunityUpdateCoordinator\s*\}\s+from\s+"[^"]+";\r?\n/m, "");
  src = src.replace(/^import\s+\{\s*StardustStatsCoordinator\s*\}\s+from\s+"[^"]+";\r?\n/m, "");
  src = src.replace(/^import\s+\{\s*CommunityUpdateSettings\s*\}\s+from\s+"[^"]+";\r?\n/m, "");
  src = src.replace(/^\s*<CommunityUpdateCoordinator\s*\/>\r?\n/gm, "");
  src = src.replace(/^\s*<StardustStatsCoordinator\s*\/>\r?\n/gm, "");
  src = src.replace(/^\s*\{isElectron\s*&&\s*<CommunityUpdateSettings\s*\/>\}\r?\n/gm, "");
  if (
    src.includes("StardustStatsCoordinator") ||
    src.includes("CommunityUpdateCoordinator") ||
    src.includes("CommunityUpdateSettings")
  ) {
    throw new Error(`[apply-overlay] Failed to strip community/stats coordinators from ${rel}`);
  }
  writeText(rel, src);
}

// ---------------------------------------------------------------------------
// 2. Rebrand UI Copy & Translations (星尘 -> 星辰 / T3星辰版)
// ---------------------------------------------------------------------------
for (const rel of ["apps/web/src/i18n/catalog.ts", "apps/web/src/i18n/translations/zh.json"]) {
  const full = path.join(repoRoot, rel);
  if (!fs.existsSync(full)) continue;
  let src = readText(rel);
  src = src.replaceAll("xiaoxin666.cn", "removed.local");
  src = src.replaceAll("zds-xiaoxin/xiaoxin-t3code", TARGET_REPO);
  src = src.replaceAll("zds-xiaoxin/stardust", TARGET_REPO);
  src = src.replaceAll("T3 星尘版", DISPLAY_BRAND_NAME);
  src = src.replaceAll("T3 星尘", DISPLAY_BRAND_NAME);
  src = src.replaceAll("星尘版", "星辰版");
  src = src.replaceAll("星尘", "星辰");
  writeText(rel, src);
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
  assertIncludes(src, "StardustThoughtIcon", rel);
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
  assertIncludes(src, "ThoughtUsageBadge", rel);
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
// 4. Windows Side-by-Side T3星辰版 Branding, Icons & Native Auto-Updater Config
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
  pkg.productName = DISPLAY_BRAND_NAME;
  writeText(rel, `${JSON.stringify(pkg, null, 2)}\n`);
}

// 4b. apps/desktop/src/app/DesktopEnvironment.ts
{
  const rel = "apps/desktop/src/app/DesktopEnvironment.ts";
  let src = readText(rel);
  src = src.replace(
    'isDevelopment ? "com.t3tools.t3code.dev" : "com.t3tools.t3code"',
    `isDevelopment ? "${TARGET_APP_ID}.dev" : "${TARGET_APP_ID}"`,
  );
  if (src.includes("STARDUST_DISPLAY_NAME")) {
    src = src.replace(
      /export const STARDUST_DISPLAY_NAME = "[^"]+";/,
      `export const STARDUST_DISPLAY_NAME = "${DISPLAY_BRAND_NAME}";`,
    );
  } else {
    src = src.replace(
      /displayName:\s*`?\$\{APP_BASE_NAME\}\s*\(\$\{stageLabel\}\)`?,/,
      `displayName: stageLabel === "Dev" ? \`\${APP_BASE_NAME} (\${stageLabel})\` : "${DISPLAY_BRAND_NAME}",`,
    );
  }
  assertIncludes(src, TARGET_APP_ID, rel);
  assertIncludes(src, DISPLAY_BRAND_NAME, rel);
  writeText(rel, src);
}

// 4c. apps/web/src/components/desktopUpdate.logic.ts & DesktopStartupRecovery.ts & branding.ts
{
  const rel = "apps/web/src/components/desktopUpdate.logic.ts";
  if (fs.existsSync(path.join(repoRoot, rel))) {
    let src = readText(rel);
    src = src.replace(
      /const DEFAULT_DESKTOP_RELEASE_REPOSITORY = "[^"]+";/,
      `const DEFAULT_DESKTOP_RELEASE_REPOSITORY = "${TARGET_REPO}";`,
    );
    writeText(rel, src);
  }
}

for (const rel of [
  "apps/desktop/src/app/DesktopStartupRecovery.ts",
  "apps/web/src/branding.ts",
]) {
  if (fs.existsSync(path.join(repoRoot, rel))) {
    let src = readText(rel)
      .replaceAll("zds-xiaoxin/xiaoxin-t3code", TARGET_REPO)
      .replaceAll("zds-xiaoxin/stardust", TARGET_REPO)
      .replaceAll("https://t3.codes/download", `https://github.com/${TARGET_REPO}/releases`);
    if (rel === "apps/web/src/branding.ts") {
      src = src.replace(
        /export function appBaseName\(\): string \{[\s\S]*?\n\}/,
        `export function appBaseName(): string {\n  return "${DISPLAY_BRAND_NAME}";\n}`,
      );
      src = src.replace(
        /export function appDisplayName\(\): string \{[\s\S]*?\n\}/,
        `export function appDisplayName(): string {\n  return "${DISPLAY_BRAND_NAME}";\n}`,
      );
      if (!src.includes("export const APP_BASE_NAME")) {
        src += `\nexport const APP_BASE_NAME = "${DISPLAY_BRAND_NAME}";\n`;
      } else {
        src = src.replace(
          /export const APP_BASE_NAME = [^;]+;/,
          `export const APP_BASE_NAME = "${DISPLAY_BRAND_NAME}";`,
        );
      }
      if (!src.includes("export const APP_DISPLAY_NAME")) {
        src += `export const APP_DISPLAY_NAME = "${DISPLAY_BRAND_NAME}";\n`;
      } else {
        src = src.replace(
          /export const APP_DISPLAY_NAME = [^;]+;/,
          `export const APP_DISPLAY_NAME = "${DISPLAY_BRAND_NAME}";`,
        );
      }
    }
    writeText(rel, src);
  }
}

// 4d. SidebarChrome.tsx wordmark -> T3✦星辰版
{
  const rel = "apps/web/src/components/sidebar/SidebarChrome.tsx";
  if (fs.existsSync(path.join(repoRoot, rel))) {
    let src = readText(rel);
    if (!src.includes("星辰版")) {
      src = src.replace(
        /(<svg[\s\S]*?<\/svg>)\s*(<\/span>)/,
        '$1\n      <span className="ml-0.5 text-[12px] font-medium tracking-normal opacity-90">星辰版</span>\n    $2',
      );
      writeText(rel, src);
    }
  }
}

// 4e. scripts/build-desktop-artifact.ts
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

  src = src
    .replaceAll("https://github.com/zds-xiaoxin/xiaoxin-t3code", `https://github.com/${TARGET_REPO}`)
    .replaceAll("https://github.com/pingdotgg/t3code", `https://github.com/${TARGET_REPO}`);

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

  // NSIS Chinese shortcut name ("T3星辰版") + ASCII executableName ("T3 Stardust") for smooth Windows upgrades
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

console.log(`[apply-overlay] All ${DISPLAY_BRAND_NAME} customizations, guards & auto-updater settings verified.`);
