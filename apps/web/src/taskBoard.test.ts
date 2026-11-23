import { testUiLocale } from "../test/uiLocale";
import { describe, expect, it, vi } from "vite-plus/test";
import {
  boardTaskMatchesFilter,
  boardSummaryDay,
  readBoardDelivery,
  shouldPresentBoardSummary,
  canPresentBoardTask,
  matchBoardTask,
  type BoardTask,
  boardCurrentStep,
  boardTaskGroup,
  boardTaskHeading,
  boardProgress,
  boardWaitDays,
  sortBoardTasks,
  boardLevelRank,
  boardApprovalsToday,
  boardEvidenceTarget,
} from "./taskBoard.logic";
const task: BoardTask = {
  folder: "/work/a",
  title: "Test",
  state: "user",
  notify_key: "a|user|one",
  snoozed: false,
  stale: false,
  age_days: 1,
  steps: [{ id: "review", name: "Review", who: "user", done: false }],
  missing: [],
  next: "Review",
  blocked: "",
  sessions: [],
  done_count: 0,
  total: 1,
};
const counts = { active: 1, user: 1, blocked: 0, agent: 0, stale: 0, done_week: 0, badge: 1 };
describe("task board attention", () => {
  it("keeps folder boundary matching and the service longest-folder rule", () => {
    using _locale = testUiLocale("zh-CN");
    expect(matchBoardTask([task], "/work/ab")).toBeNull();
    expect(matchBoardTask([task], "/work/a/nested")).toBe(task);
    const deeper = { ...task, folder: "/work/a/deeper" };
    expect(matchBoardTask([task, deeper], "/work")).toBeNull();
    expect(matchBoardTask([task], "/")).toBeNull();
    expect(matchBoardTask([{ ...task, folder: "/Users/test" }], "/Users/test/work")).toBeNull();
    const linked = { ...task, sessions: ["thread-a"] };
    expect(matchBoardTask([linked], null, "thread-a")).toBe(linked);
    expect(matchBoardTask([linked], "/unrelated", "thread-a")).toBe(linked);
    expect(matchBoardTask([linked], null, "thread-b")).toBeNull();
    expect(matchBoardTask([task, { ...linked, folder: "/other" }], "/work/a", "thread-a")).toEqual(
      expect.objectContaining({ folder: "/other" }),
    );
  });
  it("defers during quiet hours, focus or runs without consuming the key", () => {
    using _locale = testUiLocale("zh-CN");
    for (const hour of [0, 8, 23])
      expect(canPresentBoardTask(task, new Date(2026, 10, 11, hour), {}, {}, false)).toBe(false);
    const now = new Date(2026, 10, 11, 9);
    expect(canPresentBoardTask(task, now, {}, {}, true)).toBe(false);
    expect(canPresentBoardTask(task, now, {}, {}, false)).toBe(true);
    expect(canPresentBoardTask({ ...task, stale: true }, now, {}, {}, false)).toBe(false);
    expect(canPresentBoardTask({ ...task, snoozed: true }, now, {}, {}, false)).toBe(false);
    expect(canPresentBoardTask({ ...task, state: "agent" }, now, {}, {}, false)).toBe(false);
  });
  it("deduplicates keys across transitions and respects four hours per task", () => {
    using _locale = testUiLocale("zh-CN");
    const now = new Date(2026, 10, 11, 14);
    expect(canPresentBoardTask(task, now, { [task.notify_key]: 1 }, {}, false)).toBe(false);
    expect(
      canPresentBoardTask(task, now, {}, { [task.folder]: now.getTime() - 3600000 }, false),
    ).toBe(false);
    expect(
      canPresentBoardTask(task, now, {}, { [task.folder]: now.getTime() - 4 * 3600000 }, false),
    ).toBe(true);
  });
  it("excludes snoozed attention and handles missing completion timestamps", () => {
    using _locale = testUiLocale("zh-CN");
    expect(boardTaskMatchesFilter({ ...task, snoozed: true }, "user", 0)).toBe(false);
    expect(boardTaskMatchesFilter({ ...task, state: "done" }, "done_week", 0)).toBe(false);
  });
});
describe("daily summary persistence", () => {
  it("recovers corrupt or partial delivery records", () => {
    using _locale = testUiLocale("zh-CN");
    for (const raw of ["{", "{}", "null", '{"seen":null,"last":{},"summary":""}'])
      expect(readBoardDelivery(raw)).toEqual({ seen: {}, last: {}, summary: "" });
    expect(readBoardDelivery('{"seen":{"key":123},"last":{},"summary":"day"}').seen.key).toBe(123);
  });
  it("delivers once after 09:30 and catches up on a later foreground session", () => {
    using _locale = testUiLocale("zh-CN");
    const at = (hour: number, minute = 0) => new Date(2026, 10, 11, hour, minute);
    expect(shouldPresentBoardSummary(at(9, 29), "")).toBe(false);
    expect(shouldPresentBoardSummary(at(9, 30), "")).toBe(true);
    expect(shouldPresentBoardSummary(at(14), "")).toBe(true);
    expect(shouldPresentBoardSummary(at(14), boardSummaryDay(at(9, 30)))).toBe(false);
    expect(shouldPresentBoardSummary(at(23), "")).toBe(false);
    expect(
      shouldPresentBoardSummary(new Date(2026, 10, 12, 9, 30), boardSummaryDay(at(9, 30))),
    ).toBe(true);
  });
});
describe("task board HTTP snapshot", () => {
  it("preserves identity across generated timestamps and shares concurrent requests", async () => {
    using _locale = testUiLocale("zh-CN");
    const { refreshTaskBoard, useTaskBoard } = await import("./taskBoard");
    useTaskBoard.setState({ data: null, error: null, cwd: null, dataCwd: null, loading: true });
    using request = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(
        async () =>
          new Response(JSON.stringify({ tasks: [task], counts, generated_at: Math.random() })),
      );
    await Promise.all([refreshTaskBoard(), refreshTaskBoard()]);
    expect(request).toHaveBeenCalledTimes(1);
    const initial = useTaskBoard.getState();
    await refreshTaskBoard();
    expect(useTaskBoard.getState()).toBe(initial);
  });
  it("refreshes after writes and leaves a clear failure when readback is unavailable", async () => {
    using _locale = testUiLocale("zh-CN");
    const { mutateTaskBoard, useTaskBoard } = await import("./taskBoard");
    using request = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("{}"))
      .mockResolvedValueOnce(new Response("down", { status: 503 }));
    await expect(
      mutateTaskBoard("toggle", { folder: task.folder, step: "review" }),
    ).rejects.toThrow("已提交");
    expect(useTaskBoard.getState().error).toBe("看板服务没开");
    expect(request.mock.calls[0]?.[1]?.credentials).toBe("omit");
  });
});

describe("schema 2 task inbox", () => {
  it("routes blocked reviews to unlock and uses judgment text before step names", () => {
    using _locale = testUiLocale("zh-CN");
    const reviewing: BoardTask = {
      ...task,
      kind: "review",
      judge: "Can this ship?",
      blocked: "Login needed",
    };
    expect(boardTaskGroup(reviewing)).toBe("judge");
    expect(boardTaskHeading(reviewing)).toBe("Can this ship?");
    expect(boardTaskGroup({ ...reviewing, state: "blocked" })).toBe("blocked");
    expect(boardTaskGroup({ ...task, kind: "decide" })).toBe("judge");
    expect(boardTaskHeading({ ...task, judge: "", blocked: "Login needed" })).toBe("Login needed");
    expect(boardTaskHeading(task)).toBe("Review，你来做");
  });
  it("uses authoritative current id and preserves human gates after partial review", () => {
    using _locale = testUiLocale("zh-CN");
    const reviewed: BoardTask = {
      ...task,
      current_id: "gate",
      steps: [
        { id: "draft", name: "Draft", who: "agent", done: true, level: "self", required: "self" },
        { id: "gate", name: "Review", who: "user", done: false, level: "review", required: "user" },
        {
          id: "publish",
          name: "Publish",
          who: "user",
          done: false,
          level: "none",
          required: "user",
        },
      ],
    };
    expect(boardCurrentStep(reviewed)?.id).toBe("gate");
    expect(boardProgress(reviewed)).toEqual({ currentIndex: 1, nextGateDistance: 1 });
    expect(boardLevelRank(reviewed.steps[1]!)).toBe(2);
    expect(boardLevelRank({ ...reviewed.steps[0]!, legacy: true })).toBe(3);
    expect(
      boardProgress({ ...task, steps: task.steps.map((step) => ({ ...step, done: true })) }),
    ).toEqual({ currentIndex: -1, nextGateDistance: null });
  });
  it("sorts wait duration by state transition rather than recent project edits", () => {
    using _locale = testUiLocale("zh-CN");
    const now = Date.parse("2026-11-11T12:00:00Z");
    const older = { ...task, state_since: "2026-11-09T12:00:00Z", age_days: 0 };
    const newer = { ...task, state_since: "2026-11-10T12:00:00Z", age_days: 50 };
    expect(sortBoardTasks([newer, task, older])).toEqual([older, newer, task]);
    expect(boardWaitDays(older, now)).toBe(2);
    expect(boardWaitDays(task, now)).toBeNull();
    expect(boardWaitDays({ ...task, state_since: "2026-11-12T12:00:00Z" }, now)).toBe(0);
  });
  it("only counts actual human approvals today and omits an unavailable total", () => {
    using _locale = testUiLocale("zh-CN");
    const now = new Date(2026, 10, 11, 13);
    expect(boardApprovalsToday([task], now)).toBeNull();
    const result = {
      ...task,
      steps: [
        { ...task.steps[0]!, done: true, done_by: "user", done_at: "2026-11-11" },
        { ...task.steps[0]!, done: true, done_by: "agent", done_at: "2026-11-11" },
        { ...task.steps[0]!, done: false, done_by: "user", done_at: "2026-11-11" },
        { ...task.steps[0]!, done: true, done_by: "user", done_at: "2026-11-10" },
      ],
    };
    expect(boardApprovalsToday([result], now)).toBe(1);
  });
  it("routes local media to the file preview and rejects executable URL schemes", () => {
    using _locale = testUiLocale("zh-CN");
    expect(boardEvidenceTarget("/work/a", "frames/cover.png")).toEqual({
      kind: "file",
      value: "/work/a/frames/cover.png",
    });
    expect(boardEvidenceTarget("/work/a", "/work/b/movie.mp4")).toEqual({
      kind: "file",
      value: "/work/b/movie.mp4",
    });
    expect(boardEvidenceTarget("/work/a", "https://example.com/preview")).toEqual({
      kind: "url",
      value: "https://example.com/preview",
    });
    expect(boardEvidenceTarget("/work/a", "javascript:alert(1)")).toBeNull();
    expect(boardEvidenceTarget("/work/a", "data:text/html,test")).toBeNull();
  });
  it("requires a rejection reason before posting and reads back approve/reject results", async () => {
    using _locale = testUiLocale("zh-CN");
    const { mutateTaskBoard, useTaskBoard } = await import("./taskBoard");
    useTaskBoard.setState({ data: null, error: null, cwd: null, dataCwd: null, loading: true });
    using request = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => new Response(JSON.stringify({ tasks: [task], counts })));
    await expect(
      mutateTaskBoard("review", {
        folder: task.folder,
        step: "review",
        decision: "reject",
        reason: "  ",
      }),
    ).rejects.toThrow("打回需要写一句原因");
    expect(request).not.toHaveBeenCalled();
    await mutateTaskBoard("review", {
      folder: task.folder,
      step: "review",
      decision: "reject",
      reason: "Fix title",
    });
    expect(request.mock.calls[0]?.[0]).toBe("http://127.0.0.1:8765/api/review");
    expect(JSON.parse(String(request.mock.calls[0]?.[1]?.body))).toEqual({
      folder: task.folder,
      step: "review",
      decision: "reject",
      reason: "Fix title",
    });
    expect(request.mock.calls[1]?.[0]).toBe("http://127.0.0.1:8765/api/tasks");
    await mutateTaskBoard("review", { folder: task.folder, step: "review", decision: "approve" });
    expect(JSON.parse(String(request.mock.calls[2]?.[1]?.body)).decision).toBe("approve");
    expect(useTaskBoard.getState().error).toBeNull();
  });
});
