// @effect-diagnostics nodeBuiltinImport:off globalDate:off globalTimers:off - fixtures run a fake `mo` script in a temp dir; no real Mole and no network.
import * as NodeFSP from "node:fs/promises";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import * as NodeEvents from "node:events";
import { expect, it } from "vite-plus/test";

import {
  MOLE_DRY_RUN_ARGS,
  findMoleBinary,
  moleCleanListPath,
  parseMoleCleanList,
  previewWithMole,
  runMoleDryRun,
} from "./storageMoleList.ts";

const SAMPLE = `# Mole Cleanup Preview - 2026-11-22 07:34:20
#
# How to protect files:
#   /Users/*/Library/Caches/com.example.app

=== User essentials ===
/Users/me/Library/Caches/Homebrew  # 47.9MB
~/Library/Caches/WeType  # 27.1MB
/Users/me/Library/Caches/with space/inner  # 4KB
/Users/me/Library/Caches/no-size-label

=== Developer tools ===
~/.npm/_cacache/content-v2  # 190.4MB
relative/path  # 1KB
/Users/me/Library/Caches/has # hash  # 9KB
`;

it("parses sections, comments, tilde paths and size markers", () => {
  expect(parseMoleCleanList(SAMPLE, "/Users/me")).toEqual([
    { section: "User essentials", path: "/Users/me/Library/Caches/Homebrew" },
    { section: "User essentials", path: "/Users/me/Library/Caches/WeType" },
    { section: "User essentials", path: "/Users/me/Library/Caches/with space/inner" },
    { section: "User essentials", path: "/Users/me/Library/Caches/no-size-label" },
    { section: "Developer tools", path: "/Users/me/.npm/_cacache/content-v2" },
    { section: "Developer tools", path: "/Users/me/Library/Caches/has # hash" },
  ]);
});

it("ignores blank lines, control characters and a bare tilde", () => {
  expect(parseMoleCleanList("\n~\n/a\u0007b  # 1KB\r\n=== X ===\r\n/ok  # 1B\r\n", "/h")).toEqual([
    { section: "X", path: "/ok" },
  ]);
});

async function fakeHome() {
  const dir = await NodeFSP.realpath(await NodeFSP.mkdtemp(NodePath.join(NodeOS.tmpdir(), "tidy-mole-")));
  await NodeFSP.mkdir(NodePath.join(dir, ".local/bin"), { recursive: true });
  return dir;
}
async function fakeMo(home: string, body: string) {
  const path = NodePath.join(home, ".local/bin/mo");
  await NodeFSP.writeFile(path, `#!/bin/sh\n${body}\n`, { mode: 0o755 });
  return path;
}

it("finds mo on PATH, in ~/.local/bin and in /opt/homebrew/bin, and nowhere else", async () => {
  const home = await fakeHome();
  expect(await findMoleBinary({ PATH: "/nonexistent" }, home)).toBeNull();
  const local = await fakeMo(home, "exit 0");
  expect(await findMoleBinary({ PATH: "/nonexistent" }, home)).toBe(local);
  const onPath = NodePath.join(home, "bin");
  await NodeFSP.mkdir(onPath);
  await NodeFSP.writeFile(NodePath.join(onPath, "mo"), "#!/bin/sh\n", { mode: 0o755 });
  expect(await findMoleBinary({ PATH: onPath }, home)).toBe(NodePath.join(onPath, "mo"));
  await NodeFSP.chmod(local, 0o644);
  await NodeFSP.rm(NodePath.join(onPath, "mo"));
  expect(await findMoleBinary({ PATH: "" }, home)).toBeNull();
});

it("only ever runs `mo clean --dry-run` with stdin closed", async () => {
  expect(MOLE_DRY_RUN_ARGS).toEqual(["clean", "--dry-run"]);
  const calls: Array<{ file: string; args: ReadonlyArray<string>; stdio: unknown }> = [];
  const spawn = ((file: string, args: ReadonlyArray<string>, options: { stdio: unknown }) => {
    calls.push({ file, args, stdio: options.stdio });
    const child = Object.assign(new NodeEvents.EventEmitter(), {
      stderr: new NodeEvents.EventEmitter(),
      kill: () => true,
    });
    queueMicrotask(() => child.emit("close", 0));
    return child;
  }) as unknown as typeof import("node:child_process").spawn;
  expect(await runMoleDryRun("/x/mo", { spawn })).toEqual({ ok: true });
  expect(calls).toHaveLength(1);
  expect(calls[0]!.file).toBe("/x/mo");
  expect(calls[0]!.args).toEqual(["clean", "--dry-run"]);
  expect((calls[0]!.stdio as unknown[])[0]).toBe("ignore");
});

it("reads the list a preview run just wrote, and reports failures and timeouts calmly", async () => {
  const home = await fakeHome();
  const list = moleCleanListPath(home);
  await NodeFSP.mkdir(NodePath.dirname(list), { recursive: true });
  await fakeMo(
    home,
    `[ "$1" = clean ] && [ "$2" = --dry-run ] && [ -z "$3" ] || exit 9\ncat > "${list}" <<'EOF2'\n=== App caches ===\n/Users/x/Library/Caches/a  # 1KB\nEOF2`,
  );
  const found = await previewWithMole({ home, env: { PATH: "" } });
  expect(found).toMatchObject({ status: "found", items: [{ section: "App caches" }] });

  await fakeMo(home, "echo boom >&2; exit 3");
  expect(await previewWithMole({ home, env: { PATH: "" } })).toMatchObject({
    status: "failed",
    message: expect.stringContaining("boom"),
  });

  await fakeMo(home, "exit 0"); // succeeds but never rewrites the list
  await NodeFSP.utimes(list, 1, 1);
  expect(await previewWithMole({ home, env: { PATH: "" } })).toMatchObject({ status: "failed" });

  await fakeMo(home, "sleep 30");
  expect(await previewWithMole({ home, env: { PATH: "" }, timeoutMs: 300 })).toMatchObject({
    status: "failed",
    message: expect.stringContaining("300"),
  });
  expect(await previewWithMole({ home: await fakeHome(), env: { PATH: "" } })).toEqual({
    status: "missing",
  });
});
