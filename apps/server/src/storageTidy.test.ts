// @effect-diagnostics nodeBuiltinImport:off globalDate:off - disposable temp-dir fixtures; nothing outside them is touched, and `mo` is faked.
import * as NodeChildProcess from "node:child_process";
import * as NodeFSP from "node:fs/promises";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import * as DateTime from "effect/DateTime";
import { expect, it } from "vite-plus/test";

import type { StorageTidyItem } from "@t3tools/contracts";
import { createStorageTidyEngine, type TidyDeps } from "./storageTidy.ts";
import { runGit, runTar } from "./storageTidyFs.ts";

const DAY = 86_400_000;
const now = () => DateTime.toEpochMillis(DateTime.nowUnsafe());
const exists = (p: string) => NodeFSP.lstat(p).then(() => true, () => false);

async function write(path: string, body = "x".repeat(4096), ageDays = 30) {
  await NodeFSP.mkdir(NodePath.dirname(path), { recursive: true });
  await NodeFSP.writeFile(path, body);
  const t = (now() - ageDays * DAY) / 1000;
  await NodeFSP.utimes(path, t, t);
}
async function age(path: string, days: number) {
  const t = (now() - days * DAY) / 1000;
  const st = await NodeFSP.lstat(path);
  if (st.isDirectory()) for (const n of await NodeFSP.readdir(path)) await age(NodePath.join(path, n), days);
  await NodeFSP.lutimes(path, t, t);
}
function git(cwd: string, ...args: string[]) {
  const old = new Date(now() - 30 * DAY).toISOString();
  NodeChildProcess.execFileSync(
    "git",
    ["-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", ...args],
    { cwd, stdio: "pipe", env: { ...process.env, GIT_AUTHOR_DATE: old, GIT_COMMITTER_DATE: old } },
  );
}

async function fixture(
  options: {
    mole?: (home: string, dir: string) => ReturnType<TidyDeps["mole"]>;
    now?: () => number;
    buildDirectory?: string;
    freeBytes?: () => Promise<number>;
  } = {},
) {
  const dir = await NodeFSP.realpath(await NodeFSP.mkdtemp(NodePath.join(NodeOS.tmpdir(), "tidy-")));
  const home = NodePath.join(dir, "home");
  const roots = {
    home,
    applications: NodePath.join(dir, "Applications"),
    tmp: NodePath.join(dir, "tmp"),
    stateDir: NodePath.join(dir, "state"),
    rescueRoot: NodePath.join(home, "Documents", "T3 Stardust 抢救"),
    codexSessions: NodePath.join(home, ".codex/sessions"),
    claudeProjects: NodePath.join(home, ".claude/projects"),
    t3Data: [NodePath.join(dir, "state/db.sqlite")],
    stagingDir: "",
  };
  const worktrees = NodePath.join(dir, "worktrees");
  for (const d of [home, `${home}/.Trash`, roots.applications, roots.tmp, roots.stateDir, worktrees])
    await NodeFSP.mkdir(d, { recursive: true });
  let opened = "";
  const engine = createStorageTidyEngine({
    roots,
    now: options.now ?? now,
    uid: process.getuid!(),
    git: runGit,
    tar: runTar,
    ...(options.freeBytes ? { freeBytes: options.freeBytes } : {}),
    mole: () => (options.mole ? options.mole(home, dir) : Promise.resolve({ status: "missing" as const })),
    devCaches: async () => [],
    volumes: async () => [
      { id: "v", name: "Test", path: dir, totalBytes: 500e9, freeBytes: 40e9, internal: true },
    ],
    worktreeDirs: async () => [worktrees],
    openPath: async (p) => void (opened = p),
  });
  return { dir, home, roots, worktrees, engine, opened: () => opened };
}
const itemsOf = async (engine: Awaited<ReturnType<typeof fixture>>["engine"]) => {
  await engine.scan();
  return (await engine.state()).scan!.items;
};
const find = (items: ReadonlyArray<StorageTidyItem>, kind: string, name?: string) =>
  items.find((i) => i.kind === kind && (name === undefined || i.name === name));

async function makeWorktree(f: Awaited<ReturnType<typeof fixture>>, name: string, options: { dirty?: boolean; merged?: boolean }) {
  const repo = NodePath.join(f.home, "proj");
  if (!(await exists(repo))) {
    await NodeFSP.mkdir(repo, { recursive: true });
    git(repo, "init", "-b", "main");
    await NodeFSP.writeFile(NodePath.join(repo, "a.txt"), "a");
    git(repo, "add", ".");
    git(repo, "commit", "-m", "init");
    await NodeFSP.appendFile(NodePath.join(repo, ".git/info/exclude"), "node_modules\nshot.png\n");
  }
  const wt = NodePath.join(f.worktrees, "proj", name);
  await NodeFSP.mkdir(NodePath.dirname(wt), { recursive: true });
  git(repo, "worktree", "add", "-b", name, wt);
  if (options.merged === false) {
    await NodeFSP.writeFile(NodePath.join(wt, "b.txt"), "b");
    git(wt, "add", ".");
    git(wt, "commit", "-m", "work");
  }
  await NodeFSP.mkdir(NodePath.join(wt, "node_modules/pkg"), { recursive: true });
  await NodeFSP.writeFile(NodePath.join(wt, "node_modules/pkg/index.js"), "z".repeat(8192));
  await NodeFSP.symlink("../pkg", NodePath.join(wt, "node_modules/link"));
  await write(NodePath.join(wt, "shot.png"), "png");
  if (options.dirty) await NodeFSP.writeFile(NodePath.join(wt, "wip.txt"), "uncommitted");
  await age(wt, 20);
  return wt;
}

it("sorts agent worktrees: merged+clean 放心清, unmerged 看一眼, dirty 只提醒", async () => {
  const f = await fixture();
  const merged = await makeWorktree(f, "done", {});
  const unmerged = await makeWorktree(f, "wip", { merged: false });
  const dirty = await makeWorktree(f, "dirty", { dirty: true });
  const items = await itemsOf(f.engine);
  expect(find(items, "worktree", "done")).toMatchObject({ tier: "safe", disposal: "delete", dirtyFiles: 0 });
  expect(find(items, "worktree", "wip")).toMatchObject({ tier: "review", disposal: "trash" });
  expect(find(items, "worktree", "dirty")).toMatchObject({
    tier: "remind",
    disposal: "none",
    blocked: "dirty-worktree",
    dirtyFiles: 1,
  });
  expect(find(items, "worktree", "done")!.rescueAssets).toBe(1);

  // Executing: the safe one is deleted outright, the dirty one can never be removed.
  const ids = items.filter((i) => i.kind === "worktree").map((i) => i.id);
  await f.engine.execute(ids, true);
  const op = (await f.engine.state()).operation!;
  expect(op.phase).toBe("completed");
  expect(await exists(merged)).toBe(false);
  expect(await exists(unmerged)).toBe(false);
  expect(await exists(dirty)).toBe(true);
  expect(op.entries.find((e) => e.name === "dirty")).toMatchObject({ outcome: "skipped", reason: "dirty-worktree" });
  expect(op.deletedBytes).toBeGreaterThan(0);
  expect(op.trashedBytes).toBeGreaterThan(0);
  expect(op.recoverableUntil).not.toBeNull();
  expect(op.rescue!.assets).toBe(2);
  const rescued = await NodeFSP.readdir(op.rescue!.directory, { recursive: true });
  expect(rescued.some((p) => String(p).endsWith("shot.png"))).toBe(true);
  expect(rescued.some((p) => String(p).includes("node_modules"))).toBe(false);
  // git no longer lists the deleted worktree.
  const listing = NodeChildProcess.execFileSync("git", ["worktree", "list", "--porcelain"], { cwd: NodePath.join(f.home, "proj") }).toString();
  expect(listing).not.toContain("/done");
});

it("undo puts 看一眼 items back while they are still in the Trash", async () => {
  const f = await fixture();
  const wt = await makeWorktree(f, "wip", { merged: false });
  const items = await itemsOf(f.engine);
  await f.engine.execute([find(items, "worktree")!.id], false);
  expect(await exists(wt)).toBe(false);
  const op = (await f.engine.state()).operation!;
  const trash = await NodeFSP.readdir(NodePath.join(f.home, ".Trash"));
  expect(trash).toEqual([`T3 Stardust ${op.id}`]);
  await f.engine.undo(op.id);
  expect(await exists(wt)).toBe(true);
  expect((await f.engine.state()).operation!.undone).toBe(true);
  expect(await NodeFSP.readdir(NodePath.join(f.home, ".Trash"))).toEqual([]);
});

it("empties only its own Trash batches after seven days", async () => {
  let clock = now();
  const f = await fixture({ now: () => clock });
  const wt = await makeWorktree(f, "wip", { merged: false });
  const userFile = NodePath.join(f.home, ".Trash", "mine.txt");
  await NodeFSP.writeFile(userFile, "keep me");
  const items = await itemsOf(f.engine);
  await f.engine.execute([find(items, "worktree")!.id], false);
  const op = (await f.engine.state()).operation!;
  clock += 6 * DAY;
  await f.engine.purgeExpired();
  expect(await NodeFSP.readdir(NodePath.join(f.home, ".Trash"))).toHaveLength(2);
  clock += 2 * DAY;
  await f.engine.purgeExpired();
  expect(await NodeFSP.readdir(NodePath.join(f.home, ".Trash"))).toEqual(["mine.txt"]);
  expect(await exists(userFile)).toBe(true);
  expect((await f.engine.state()).operation).toMatchObject({ id: op.id, purged: true, recoverableUntil: null });
  await expect(f.engine.undo(op.id)).rejects.toMatchObject({ code: "not-recoverable" });
  expect(await exists(wt)).toBe(false);
});

it("maps a Mole preview into 放心清 under its own allowlist, deleting only allowed paths", async () => {
  const f = await fixture({
    mole: async (home, dir) => ({
      status: "found",
      binary: "/fake/mo",
      items: [
        { section: "User essentials", path: `${home}/Library/Caches/com.example.app` },
        { section: "User essentials", path: `${home}/Library/Caches/com.example.busy` },
        { section: "Developer tools", path: `${home}/Projects/tool/__pycache__` },
        { section: "Developer tools", path: `${home}/Projects/repo/__pycache__` },
        { section: "Documents", path: `${home}/Documents/important.docx` },
        { section: "Application Support", path: `${home}/Library/Application Support/App/Login Data` },
        { section: "Other", path: `${dir}/elsewhere/cache` },
      ],
    }),
  });
  const cache = `${f.home}/Library/Caches/com.example.app`;
  const busy = `${f.home}/Library/Caches/com.example.busy`;
  const pyc = `${f.home}/Projects/tool/__pycache__`;
  const dirtyPyc = `${f.home}/Projects/repo/__pycache__`;
  const doc = `${f.home}/Documents/important.docx`;
  const login = `${f.home}/Library/Application Support/App/Login Data`;
  const outside = `${f.dir}/elsewhere/cache`;
  for (const p of [`${cache}/a.bin`, `${pyc}/m.pyc`, doc, login, outside, `${dirtyPyc}/m.pyc`]) await write(p);
  for (const dir of [cache, pyc, dirtyPyc]) await age(dir, 30);
  await write(`${busy}/live`, "live", 0);
  // An untracked __pycache__ in a repository with uncommitted changes must not be 放心清.
  git(`${f.home}/Projects/repo`, "init", "-b", "main");
  const items = await itemsOf(f.engine);
  const state = await f.engine.state();
  expect(state.scan!.mole).toMatchObject({ status: "found", binary: "/fake/mo", listed: 7 });
  const safe = items.filter((i) => i.tier === "safe");
  expect(safe.every((i) => i.kind === "mole-section" && i.disposal === "delete")).toBe(true);
  expect(safe.flatMap((i) => i.paths).toSorted()).toEqual([busy, cache, pyc].toSorted());
  expect(safe.map((i) => i.name).toSorted()).toEqual(["developer", "user"]);
  expect(find(items, "dirty-repo")).toMatchObject({ tier: "remind", blocked: "dirty-worktree" });
  expect(state.scan!.mole.ignored).toBe(3);

  await f.engine.execute(safe.map((i) => i.id), true);
  const op = (await f.engine.state()).operation!;
  expect(await exists(cache)).toBe(false);
  expect(await exists(pyc)).toBe(false);
  // Modified a moment ago: treated as in use and left alone.
  expect(await exists(busy)).toBe(true);
  for (const kept of [doc, login, outside, dirtyPyc]) expect(await exists(kept), kept).toBe(true);
  expect(op.deletedBytes).toBeGreaterThan(0);
  expect(op.trashedBytes).toBe(0);
  expect(op.recoverableUntil).toBeNull();
  expect(op.entries.find((e) => e.name === "user")).toMatchObject({ outcome: "deleted", reason: expect.stringContaining("in-use") });
});

it("reports a missing or failed Mole calmly and still scans everything else", async () => {
  const missing = await fixture();
  expect((await (async () => { await missing.engine.scan(); return missing.engine.state(); })()).scan!.mole).toMatchObject({ status: "missing", binary: null });
  const failed = await fixture({ mole: async () => ({ status: "failed", binary: "/x/mo", message: "boom" }) });
  await failed.engine.scan();
  expect((await failed.engine.state()).scan!.mole).toMatchObject({ status: "failed", message: "boom" });
});

it("offers old session transcripts as a compress-archive suggestion in 看一眼", async () => {
  const f = await fixture();
  for (const n of ["a", "b"]) await write(`${f.roots.codexSessions}/2026/01/01/${n}.jsonl`, "{}\n".repeat(200), 200);
  await write(`${f.roots.codexSessions}/2026/11/21/recent.jsonl`, "{}", 1);
  await write(`${f.roots.claudeProjects}/-proj/s1.jsonl`, "{}\n".repeat(50), 120);
  const items = await itemsOf(f.engine);
  const codex = find(items, "session-archive", "codex")!;
  expect(codex).toMatchObject({ tier: "review", compress: true, pathCount: 2, disposal: "trash" });
  expect(codex.detail.oldestDays).toBe("200");
  expect(find(items, "session-archive", "claude-code")).toMatchObject({ tier: "review", pathCount: 1 });

  await f.engine.execute([codex.id], true);
  const op = (await f.engine.state()).operation!;
  expect(op.entries[0]).toMatchObject({ outcome: "trashed" });
  expect(await exists(`${f.roots.codexSessions}/2026/01/01/a.jsonl`)).toBe(false);
  expect(await exists(`${f.roots.codexSessions}/2026/11/21/recent.jsonl`)).toBe(true);
  expect(op.rescue!.sessionArchives).toBe(1);
  const archive = (await NodeFSP.readdir(`${op.rescue!.directory}/会话归档`))[0]!;
  expect(archive).toMatch(/codex-sessions-.*\.tar\.gz$/);
  expect(op.writtenBytes).toBeGreaterThan(0);
  await f.engine.undo(op.id);
  expect(await exists(`${f.roots.codexSessions}/2026/01/01/a.jsonl`)).toBe(true);
});

it("treats /tmp agent folders as 放心清 only when idle", async () => {
  const f = await fixture();
  await write(`${f.roots.tmp}/codex-old/x`, "d".repeat(8192), 5);
  await age(`${f.roots.tmp}/codex-old`, 5);
  await write(`${f.roots.tmp}/codex-fresh/x`, "d", 0);
  await write(`${f.roots.tmp}/unrelated-old/x`, "d", 5);
  const items = await itemsOf(f.engine);
  const tmp = find(items, "agent-tmp")!;
  expect(tmp.tier).toBe("safe");
  expect(tmp.paths).toEqual([`${f.roots.tmp}/codex-old`]);
  await f.engine.execute([tmp.id], true);
  expect(await exists(`${f.roots.tmp}/codex-old`)).toBe(false);
  expect(await exists(`${f.roots.tmp}/codex-fresh`)).toBe(true);
  expect(await exists(`${f.roots.tmp}/unrelated-old`)).toBe(true);
});

it("keeps the newest N build generations and old app copies, everything else goes to 看一眼", async () => {
  const f = await fixture();
  const builds = NodePath.join(f.dir, "builds");
  await f.engine.saveSettings({ buildDirectory: builds }).catch(() => undefined);
  await NodeFSP.mkdir(builds);
  await f.engine.saveSettings({ buildDirectory: builds, keepNewest: 2 });
  for (const [i, n] of [1, 2, 3, 4].entries()) {
    await write(`${builds}/c${n}-build/out.bin`, "b".repeat(8192), 40 - i * 5);
    await age(`${builds}/c${n}-build`, 40 - i * 5);
  }
  await write(`${builds}/notes/readme.txt`, "x", 90);
  await write(`${builds}/cfg/config.json.bak-pre-c1`, "1", 50);
  await write(`${builds}/cfg/config.json.bak-pre-c2`, "2", 40);
  await write(`${builds}/cfg/config.json.bak-pre-c3`, "3", 30);
  await write(`${builds}/cfg/config.json.orig`, "0", 60);
  for (const [i, name] of ["App.before-C1.app", "App.before-C2.app", "App.before-C3.app"].entries()) {
    await write(`${f.roots.applications}/${name}/Contents/x`, "a".repeat(4096), 30 - i * 5);
    await age(`${f.roots.applications}/${name}`, 30 - i * 5);
  }
  const items = await itemsOf(f.engine);
  const gen = find(items, "build-generation")!;
  expect(gen).toMatchObject({ tier: "review", disposal: "trash", name: "c#-build" });
  expect(gen.paths.map((p) => NodePath.basename(p)).toSorted()).toEqual(["c1-build", "c2-build"]);
  expect(find(items, "backup-file")!.pathCount).toBe(2);
  expect(find(items, "app-backup")).toMatchObject({ tier: "review", name: "App", pathCount: 1 });
  expect(items.filter((i) => ["build-generation", "backup-file", "app-backup"].includes(i.kind)).every((i) => i.tier === "review")).toBe(true);
  await f.engine.saveSettings({ keepNewest: 3 });
  const more = await itemsOf(f.engine);
  expect(find(more, "build-generation")!.pathCount).toBe(1);
});

it("rescues uncommitted work from a build folder before it moves to Trash, and refuses without rescue", async () => {
  const f = await fixture();
  const builds = NodePath.join(f.dir, "builds");
  await NodeFSP.mkdir(builds);
  await f.engine.saveSettings({ buildDirectory: builds, keepNewest: 1 });
  const port = `${builds}/c72-build`;
  await NodeFSP.mkdir(port, { recursive: true });
  git(port, "init", "-b", "main");
  await NodeFSP.writeFile(`${port}/app.css`, "a{}");
  git(port, "add", ".");
  git(port, "commit", "-m", "init");
  await NodeFSP.writeFile(`${port}/app.css`, "a{color:red}");
  await NodeFSP.writeFile(`${port}/new.txt`, "untracked");
  await write(`${port}/shot.png`, "png");
  await age(port, 30);
  await write(`${builds}/c73-build/x`, "x", 5);
  await age(`${builds}/c73-build`, 5);
  const items = await itemsOf(f.engine);
  const dirty = find(items, "dirty-repo")!;
  expect(dirty).toMatchObject({ tier: "review", dirtyFiles: 3 });
  await f.engine.execute([dirty.id], false);
  expect((await f.engine.state()).operation!.entries[0]).toMatchObject({ outcome: "skipped", reason: "uncommitted-needs-rescue" });
  expect(await exists(port)).toBe(true);
  const again = await itemsOf(f.engine);
  await f.engine.execute([find(again, "dirty-repo")!.id], true);
  const op = (await f.engine.state()).operation!;
  expect(await exists(port)).toBe(false);
  expect(op.rescue).toMatchObject({ patches: 1, untrackedArchives: 1 });
  expect(op.rescue!.dirtyRepos).toEqual([{ name: "c72-build", files: 3 }]);
  const files = (await NodeFSP.readdir(op.rescue!.directory, { recursive: true })).map(String);
  expect(files.some((n) => n.endsWith(".patch"))).toBe(true);
  expect(files.some((n) => n.endsWith("untracked.tgz"))).toBe(true);
  expect(files.some((n) => n.endsWith("shot.png"))).toBe(true);
  const patch = files.find((n) => n.endsWith(".patch"))!;
  expect(await NodeFSP.readFile(NodePath.join(op.rescue!.directory, patch), "utf8")).toContain("color:red");
  await f.engine.openArchive(op.id);
  expect(f.opened()).toBe(op.rescue!.directory);
});

it("refuses links, outside paths and anything that changed after the scan", async () => {
  const f = await fixture();
  await write(`${f.roots.tmp}/codex-a/x`, "d".repeat(8192), 5);
  await age(`${f.roots.tmp}/codex-a`, 5);
  await write(`${f.roots.tmp}/codex-b/x`, "d".repeat(8192), 5);
  await age(`${f.roots.tmp}/codex-b`, 5);
  const target = NodePath.join(f.dir, "precious");
  await write(`${target}/keep`, "important", 50);
  await NodeFSP.symlink(target, `${f.roots.tmp}/codex-link`);
  const items = await itemsOf(f.engine);
  const tmp = find(items, "agent-tmp")!;
  expect(tmp.paths.some((p) => p.endsWith("codex-link"))).toBe(false);
  // Swap one folder for a symlink and touch the other after the scan.
  await NodeFSP.rm(`${f.roots.tmp}/codex-a`, { recursive: true });
  await NodeFSP.symlink(target, `${f.roots.tmp}/codex-a`);
  await write(`${f.roots.tmp}/codex-b/late`, "new", 1);
  await age(`${f.roots.tmp}/codex-b`, 0);
  await f.engine.execute([tmp.id], true);
  const op = (await f.engine.state()).operation!;
  expect(await exists(`${target}/keep`)).toBe(true);
  expect(await exists(`${f.roots.tmp}/codex-b/late`)).toBe(true);
  expect(op.entries[0]).toMatchObject({ outcome: "failed" });
  expect(op.deletedBytes).toBe(0);
});

it("executes only ids it produced and never a reminder", async () => {
  const f = await fixture();
  await makeWorktree(f, "dirty", { dirty: true });
  const items = await itemsOf(f.engine);
  await f.engine.execute(["/etc/passwd", "tidy-nonexistent", find(items, "worktree")!.id], true);
  const op = (await f.engine.state()).operation!;
  expect(op.entries.map((e) => e.outcome)).toEqual(["skipped", "skipped", "skipped"]);
  expect(op.entries.map((e) => e.reason)).toEqual(["unknown-item", "unknown-item", "dirty-worktree"]);
  await expect(f.engine.execute([], true)).rejects.toMatchObject({ code: "scan-required" });
});

it("validates the build directory setting", async () => {
  const f = await fixture();
  await expect(f.engine.saveSettings({ buildDirectory: "relative/dir" })).rejects.toMatchObject({ code: "build-directory-invalid" });
  await expect(f.engine.saveSettings({ buildDirectory: "/" })).rejects.toMatchObject({ code: "build-directory-invalid" });
  await expect(f.engine.saveSettings({ buildDirectory: f.home })).rejects.toMatchObject({ code: "build-directory-invalid" });
  await expect(f.engine.saveSettings({ buildDirectory: `${f.dir}/missing` })).rejects.toMatchObject({ code: "build-directory-invalid" });
  for (const unsafe of ["/Library", "/System/Library", NodePath.dirname(f.home), "/usr/local"])
    await expect(f.engine.saveSettings({ buildDirectory: unsafe })).rejects.toMatchObject({ code: "build-directory-invalid" });
  await NodeFSP.mkdir(`${f.dir}/builds`);
  await f.engine.saveSettings({ buildDirectory: `${f.dir}/builds`, keepNewest: 4, rescueFirst: false });
  expect((await f.engine.state()).settings).toEqual({ buildDirectory: `${f.dir}/builds`, keepNewest: 4, rescueFirst: false });
});

it("does not write rescue copies or archives when the disk is nearly full, and keeps the originals", async () => {
  const f = await fixture({ freeBytes: async () => 200 * 1024 ** 2 });
  const wt = await makeWorktree(f, "wip", { merged: false });
  await write(`${f.roots.codexSessions}/2026/01/01/a.jsonl`, "{}\n".repeat(200), 200);
  const items = await itemsOf(f.engine);
  await f.engine.execute([find(items, "worktree")!.id, find(items, "session-archive")!.id], true);
  const op = (await f.engine.state()).operation!;
  expect(op.entries.map((e) => [e.outcome, e.reason])).toEqual([["skipped", "low-disk"], ["skipped", "low-disk"]]);
  expect(await exists(wt)).toBe(true);
  expect(await exists(`${f.roots.codexSessions}/2026/01/01/a.jsonl`)).toBe(true);
  expect(op.rescue).toBeNull();
});
