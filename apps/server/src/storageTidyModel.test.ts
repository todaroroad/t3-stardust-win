// @effect-diagnostics nodeBuiltinImport:off globalDate:off - pure rule tests.
import { expect, it } from "vite-plus/test";

import {
  DAY_MS,
  backupFamily,
  backupFileFamily,
  buildFamily,
  classifyWorktree,
  isAgentTmpName,
  isMoleRemovable,
  isRescueAsset,
  moleSectionKey,
  pruneNestedPaths,
  recoverableUntil,
  splitKeepNewest,
} from "./storageTidyModel.ts";

const HOME = "/Users/me";

it("allows Mole results only inside rebuildable cache locations under the home folder", () => {
  for (const ok of [
    `${HOME}/Library/Caches/Google`,
    `${HOME}/Library/Logs/Foo/x.log`,
    `${HOME}/.npm/_cacache/content-v2`,
    `${HOME}/.cache/pip/http`,
    `${HOME}/Projects/app/.next/cache/swc`,
    `${HOME}/Projects/app/src/__pycache__`,
    `${HOME}/Documents/x/__pycache__`,
    `${HOME}/Library/Application Support/Google/Chrome/Default/Cache/Cache_Data/index`,
    `${HOME}/Library/Group Containers/ABC.com.x/Library/Caches/ComputerUse`,
    `${HOME}/Library/Application Support/Google/GoogleUpdater/updater.log.old`,
  ])
    expect(isMoleRemovable(ok, HOME), ok).toBe(true);
  for (const no of [
    `${HOME}`,
    `${HOME}/Documents/Report.docx`,
    `${HOME}/Library/Caches`,
    `${HOME}/Library`,
    `${HOME}/Library/Application Support/Google/Chrome/Default/Login Data`,
    `${HOME}/.zcompdump`,
    `${HOME}/Library/Keychains/login.keychain-db`,
    `/opt/homebrew/var/homebrew/locks/x.lock`,
    `/Library/Caches/com.apple.x`,
    `${HOME}/Library/Caches/../Documents/x`,
    `Library/Caches/relative`,
  ])
    expect(isMoleRemovable(no, HOME), no).toBe(false);
});

it("keeps only the outermost path of nested duplicates", () => {
  expect(
    pruneNestedPaths(["/a/b/c", "/a/b", "/a/b", "/a/x", "/a/bc"]).toSorted(),
  ).toEqual(["/a/b", "/a/bc", "/a/x"]);
});

it("maps Mole sections to stable keys", () => {
  expect(moleSectionKey("User essentials")).toBe("user");
  expect(moleSectionKey("Developer tools")).toBe("developer");
  expect(moleSectionKey("Something new")).toBe("other");
});

it("puts only merged, clean and idle worktrees in 放心清; dirty or unreadable ones are 只提醒", () => {
  const now = 100 * DAY_MS;
  const idle = now - 10 * DAY_MS;
  expect(classifyWorktree({ dirtyFiles: 0, merged: true, lastUsedMs: idle, nowMs: now })).toEqual({
    tier: "safe",
    blocked: null,
  });
  expect(classifyWorktree({ dirtyFiles: 3, merged: true, lastUsedMs: idle, nowMs: now })).toEqual({
    tier: "remind",
    blocked: "dirty-worktree",
  });
  expect(classifyWorktree({ dirtyFiles: null, merged: true, lastUsedMs: idle, nowMs: now }).tier).toBe(
    "remind",
  );
  expect(classifyWorktree({ dirtyFiles: 0, merged: false, lastUsedMs: idle, nowMs: now }).tier).toBe(
    "review",
  );
  expect(classifyWorktree({ dirtyFiles: 0, merged: null, lastUsedMs: idle, nowMs: now }).tier).toBe(
    "review",
  );
  expect(
    classifyWorktree({ dirtyFiles: 0, merged: true, lastUsedMs: now - DAY_MS, nowMs: now }).tier,
  ).toBe("review");
});

it("recognises backup copies, bak/orig files and build generations", () => {
  expect(backupFamily("T3 Code (Alpha).before-C98.app")).toBe("T3 Code (Alpha)");
  expect(backupFamily("MyApp backup 2026-10-01.app")).toBe("MyApp");
  expect(backupFamily("tool-rollback-3")).toBe("tool");
  expect(backupFamily("beforehand.app")).toBeNull();
  expect(backupFamily("backup-notes")).toBeNull();
  expect(backupFileFamily("config.json.bak-pre-c97")).toBe("config.json");
  expect(backupFileFamily("schema.sql.orig")).toBe("schema.sql");
  expect(backupFileFamily("original.txt")).toBeNull();
  expect(buildFamily("c97-build")).toBe("c#-build");
  expect(buildFamily("c104-build")).toBe("c#-build");
  expect(buildFamily("notes")).toBeNull();
});

it("keeps the newest N of each family and lists the rest", () => {
  const entries = [
    { name: "c1-build", family: "c#-build", mtime: 1 },
    { name: "c2-build", family: "c#-build", mtime: 2 },
    { name: "c3-build", family: "c#-build", mtime: 3 },
    { name: "c4-build", family: "c#-build", mtime: 4 },
    { name: "x1", family: "x#", mtime: 9 },
  ];
  const { kept, older } = splitKeepNewest(entries, {
    family: (e) => e.family,
    mtime: (e) => e.mtime,
    name: (e) => e.name,
    keep: 2,
  });
  expect(kept.map((e) => e.name).toSorted()).toEqual(["c3-build", "c4-build", "x1"]);
  expect(older.map((e) => e.name).toSorted()).toEqual(["c1-build", "c2-build"]);
});

it("matches agent temp folders by name only", () => {
  for (const ok of ["t3-run-abc", "codex-xyz", "claude-1234", "playwright_chromiumdev_profile-x"])
    expect(isAgentTmpName(ok), ok).toBe(true);
  for (const no of ["com.apple.launchd.x", "my-project", "tmpfile", "agentless_thing/x"])
    expect(isAgentTmpName(no), no).toBe(false);
});

it("rescues visual assets and components but never from node_modules or .git", () => {
  expect(isRescueAsset("src/shot.png")).toBe(true);
  expect(isRescueAsset("src/Card.tsx")).toBe(true);
  expect(isRescueAsset("preview/index.html")).toBe(true);
  expect(isRescueAsset("node_modules/pkg/logo.svg")).toBe(false);
  expect(isRescueAsset("a/.git/x.png")).toBe(false);
  expect(isRescueAsset("src/main.ts")).toBe(false);
});

it("dates the Trash release seven days out", () => {
  expect(Date.parse(recoverableUntil(0))).toBe(7 * DAY_MS);
});
