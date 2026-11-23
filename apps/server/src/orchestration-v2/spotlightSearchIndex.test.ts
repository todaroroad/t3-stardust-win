// @effect-diagnostics nodeBuiltinImport:off - real synchronous worker index fixtures.
import { expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as ServerConfig from "../config.ts";
import * as SpotlightSearch from "./SpotlightSearch.ts";
import * as NodeSqlite from "node:sqlite";
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import { SpotlightIndex } from "./spotlightSearchIndex.ts";
function fixture() {
  const dir = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "spotlight-test-")),
    file = NodePath.join(dir, "source.sqlite");
  const db = new NodeSqlite.DatabaseSync(file);
  db.exec(`CREATE TABLE projection_projects(project_id TEXT PRIMARY KEY,title TEXT,deleted_at TEXT);
 CREATE TABLE orchestration_v2_projection_threads(thread_id TEXT PRIMARY KEY,project_id TEXT,title TEXT,updated_at TEXT,archived_at TEXT,deleted_at TEXT,payload_json TEXT);
 CREATE TABLE orchestration_v2_projection_messages(message_id TEXT PRIMARY KEY,thread_id TEXT,role TEXT,streaming INTEGER,created_at TEXT,updated_at TEXT,payload_json TEXT,search_text TEXT);
 INSERT INTO projection_projects VALUES('p','自媒体',NULL);`);
  const thread = (
    id: string,
    title: string,
    meta: { archived?: boolean; deleted?: boolean; parent?: string; continuation?: string } = {},
  ) =>
    db.prepare("INSERT INTO orchestration_v2_projection_threads VALUES(?,?,?,?,?,?,?)").run(
      id,
      "p",
      title,
      "2026-10-27T00:00:00Z",
      meta.archived ? "2026-10-26T00:00:00Z" : null,
      meta.deleted ? "2026-10-26T00:00:00Z" : null,
      JSON.stringify({
        lineage: {
          parentThreadId: meta.parent ?? null,
          relationshipToParent: meta.parent ? "subagent" : null,
        },
        ...(meta.continuation ? { continuedFromThreadId: meta.continuation } : {}),
      }),
    );
  let serial = 0;
  const message = (id: string, text: string, role = "user", streaming = 0) =>
    db
      .prepare("INSERT INTO orchestration_v2_projection_messages VALUES(?,?,?,?,?,?,?,?)")
      .run(
        `m${++serial}`,
        id,
        role,
        streaming,
        "2026-10-26T00:00:00Z",
        "2026-10-26T00:00:00Z",
        JSON.stringify({ text }),
        text,
      );
  const index = new SpotlightIndex(file, NodePath.join(dir, "index.sqlite"));
  return {
    thread,
    message,
    index,
    db,
    file,
    [Symbol.dispose]() {
      index.close();
      db.close();
      NodeFS.rmSync(dir, { recursive: true, force: true });
    },
  };
}
it("finds two-character Chinese, punctuation, pinyin and initials", () => {
  using f = fixture();
  f.thread("t", "审阅《喊妈》新版剧本");
  f.message("t", "制作《有事，先找妈》全片。");
  expect(f.index.search("喊妈")[0]?.threadId).toBe("t");
  expect(f.index.search("有事先找妈")[0]?.threadId).toBe("t");
  expect(f.index.search("hanma")[0]?.threadId).toBe("t");
  expect(f.index.search("syhm")[0]?.threadId).toBe("t");
});
it("recalls one-character variation of quoted work without hardcoded aliases", () => {
  using f = fixture();
  f.thread("t", "审阅剧本");
  f.message("t", "制作《有事，先找妈》全片。");
  expect(f.index.search("有事就找妈")[0]?.threadId).toBe("t");
  expect(f.index.search("完全不同的故事")).toEqual([]);
});
it("ranks sustained topic work above incidental query mentions", () => {
  using f = fixture();
  f.thread("work", "小红书项目记录");
  f.thread("incidental", "排查搜索");
  f.message("work", "给我小红书运营方案");
  f.message("work", "小红书运营规则请整理");
  f.message("incidental", "比如搜索“小红书运营”这个词");
  expect(f.index.search("小红书运营")[0]?.threadId).toBe("work");
});
it("includes archived history but excludes deleted, system and streaming text", () => {
  using f = fixture();
  f.thread("old", "早期创作", { archived: true });
  f.thread("deleted", "删除记录", { deleted: true });
  f.thread("stream", "进行中");
  f.message("old", "最初针线脚本");
  f.message("deleted", "针线");
  f.message("stream", "针线", "assistant", 1);
  f.message("stream", "针线", "system");
  const r = f.index.search("针线");
  expect(r.map((x) => x.threadId)).toEqual(["old"]);
  expect(r[0]?.archivedAt).not.toBeNull();
  f.db.exec("UPDATE projection_projects SET deleted_at='2026-10-27T00:00:00Z'");
  expect(f.index.search("针线")).toEqual([]);
});
it("refreshes edits and deletes without writing to the source", () => {
  using f = fixture();
  f.thread("t", "创作");
  f.message("t", "甲乙版本");
  const before = NodeFS.readFileSync(f.file);
  expect(f.index.search("甲乙")).toHaveLength(1);
  expect(NodeFS.readFileSync(f.file)).toEqual(before);
  f.db
    .prepare(
      "UPDATE orchestration_v2_projection_messages SET payload_json=?,updated_at=?,search_text=?",
    )
    .run(JSON.stringify({ text: "丙丁版本" }), "2026-10-27T00:00:00Z", "丙丁版本");
  expect(f.index.search("甲乙")).toHaveLength(0);
  expect(f.index.search("丙丁")).toHaveLength(1);
  f.db.exec("DELETE FROM orchestration_v2_projection_messages");
  expect(f.index.search("丙丁")).toHaveLength(0);
});
it("groups continuations and children into their parent family", () => {
  using f = fixture();
  f.thread("root", "视频发布方案");
  f.thread("next", "视频发布方案（续2）", { continuation: "root" });
  f.thread("child", "视觉复核", { parent: "next" });
  for (const t of ["root", "next", "child"]) f.message(t, "制作杆子影片");
  const r = f.index.search("杆子");
  expect(new Set(r.map((x) => x.familyKey)).size).toBe(1);
  expect(r.find((x) => x.threadId === "child")?.isSubagent).toBe(true);
  expect(r.find((x) => x.threadId === "root")?.isSubagent).toBe(false);
});
it("requires all explicit query words and handles punctuation safely", () => {
  using f = fixture();
  f.thread("both", "发布方案");
  f.thread("one", "发布方案2");
  f.message("both", "小红书上的运营计划");
  f.message("one", "小红书封面");
  expect(f.index.search("小红书 运营").map((x) => x.threadId)).toEqual(["both"]);
  expect(f.index.search('" OR *')).toEqual([]);
});

it("places system-generated audit records after substantive work", () => {
  using f = fixture();
  f.thread("system", "自动审批 · 2026-10-27");
  f.thread("work", "内容创作");
  f.message("system", "小红书运营 小红书运营 小红书运营");
  f.message("work", "小红书运营");
  f.db.exec(
    "UPDATE orchestration_v2_projection_threads SET payload_json=json_set(payload_json,'$.createdBy','system') WHERE thread_id='system'",
  );
  expect(f.index.search("小红书运营")[0]?.threadId).toBe("work");
});

it("uses only exact user-confirmed aliases and tolerates invalid optional alias files", () => {
  using f = fixture();
  f.thread("work", "《杆子》制作");
  f.message("work", "杆子视频交付");
  const aliases = NodePath.join(f.file, "..", "aliases.json");
  NodeFS.writeFileSync(aliases, JSON.stringify([{ from: "一一杆儿", to: "杆子" }]));
  const index = new SpotlightIndex(f.file, ":memory:", aliases);
  try {
    expect(index.search("一一杆儿")[0]?.threadId).toBe("work");
    NodeFS.writeFileSync(aliases, "invalid json");
    expect(index.search("杆子")[0]?.threadId).toBe("work");
  } finally {
    index.close();
  }
});

it("keeps unrelated same-title conversations separate", () => {
  using f = fixture();
  f.thread("a", "新会话");
  f.thread("b", "新会话");
  f.message("a", "杆子制作");
  f.message("b", "杆子构想");
  expect(new Set(f.index.search("杆子").map((r) => r.familyKey)).size).toBe(2);
});

it("does not penalize imported conversations created by the system", () => {
  using f = fixture();
  f.thread("work", "小红书项目记录");
  f.thread("other", "排查搜索");
  f.message("work", "小红书运营方案");
  f.message("other", "搜索小红书运营");
  f.db.exec(
    "UPDATE orchestration_v2_projection_threads SET payload_json=json_set(payload_json,'$.createdBy','system') WHERE thread_id='work'",
  );
  expect(f.index.search("小红书运营")[0]?.threadId).toBe("work");
});

it("retains the main conversation when many child titles match", () => {
  using f = fixture();
  f.thread("root", "动画制作");
  f.message("root", "制作《杆子》完整视频");
  for (let n = 0; n < 12; n++) {
    f.thread(`child${n}`, `《杆子》复核${n}`, { parent: "root" });
    f.message(`child${n}`, "杆子复核");
  }
  const result = f.index.search("杆子");
  expect(result.some((r) => r.threadId === "root")).toBe(true);
  expect(result.filter((r) => r.isSubagent).length).toBeLessThanOrEqual(3);
});

it("rebuilds a v1 cache from citation-aware search_text without changing the source", () => {
  using f = fixture();
  f.thread("citation", "验收记录");
  f.message("citation", '<t3-citation path="/hidden/private-label">标签正文</t3-citation>');
  f.db.prepare("UPDATE orchestration_v2_projection_messages SET search_text=?").run("标签正文");
  expect(f.index.search("标签正文")[0]?.threadId).toBe("citation");
  const before = NodeFS.readFileSync(f.file);
  const cachePath = NodePath.join(NodePath.dirname(f.file), "index.sqlite");
  const cache = new NodeSqlite.DatabaseSync(cachePath);
  cache.exec("PRAGMA user_version=1; UPDATE documents SET text='旧缓存',terms='旧缓存';");
  cache.close();
  const rebuilt = new SpotlightIndex(f.file, cachePath);
  try {
    expect(rebuilt.search("标签正文")[0]?.threadId).toBe("citation");
    expect(rebuilt.search("private-label")).toEqual([]);
    expect(NodeFS.readFileSync(f.file)).toEqual(before);
  } finally {
    rebuilt.close();
  }
});

it("indexes messages when search_text is NULL by falling back to payload_json text", () => {
  using f = fixture();
  f.thread("null-search", "正常会话标题");
  f.db
    .prepare("INSERT INTO orchestration_v2_projection_messages VALUES(?,?,?,?,?,?,?,?)")
    .run(
      "m-null-1",
      "null-search",
      "assistant",
      0,
      "2026-11-20T00:00:00Z",
      "2026-11-20T00:00:00Z",
      JSON.stringify({ text: "这段正文只有 payload_json 里有，search_text 是空的" }),
      null,
    );
  const hits = f.index.search("只有 payload_json");
  expect(hits[0]?.threadId).toBe("null-search");
  expect(hits[0]?.messageId).toBe("m-null-1");
});

it.live("searches through the isolated stdio worker and closes it with its scope", () =>
  Effect.gen(function* () {
    using f = fixture();
    f.thread("worker", "声音先行");
    f.message("worker", "迁移以后依然能检索中文正文");
    const root = NodePath.dirname(f.file);
    const service = SpotlightSearch.layer.pipe(
      Layer.provide(
        Layer.mock(ServerConfig.ServerConfig)({
          dbPath: f.file,
          providerStatusCacheDir: root,
          stateDir: root,
        } as ServerConfig.ServerConfig["Service"]),
      ),
      Layer.provide(NodeServices.layer),
    );
    yield* Effect.gen(function* () {
      const search = yield* SpotlightSearch.SpotlightSearch;
      const results = yield* Effect.all(
        [search.search("中文正文", 10), search.search("shengyinxianxing", 10)],
        { concurrency: 2 },
      );
      for (const result of results) expect(result.matches[0]?.threadId).toBe("worker");
    }).pipe(Effect.provide(service), Effect.scoped);
  }),
);
