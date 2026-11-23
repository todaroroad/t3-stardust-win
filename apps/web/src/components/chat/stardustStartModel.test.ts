import { describe, it, expect } from "vite-plus/test";
import {
  skillFrequency,
  recentProjectThreads,
  startThreadStatus,
  startRelativeTime,
} from "./stardustStartModel";
describe("recent project starters", () => {
  it("counts only explicit user skill mentions and excludes unknown skills and assistant examples", () => {
    expect(
      skillFrequency(
        [
          { role: "user", text: "$cover $cover and $video" },
          { role: "assistant", text: "$video $video $video" },
          { role: "user", text: "$unknown and $cover-extra $video" },
        ],
        new Set(["cover", "video"]),
      ),
    ).toEqual([
      ["cover", 2],
      ["video", 2],
    ]);
    expect(skillFrequency([], new Set(["cover"]))).toEqual([]);
  });
});

it("finds unfinished work even when newer completed conversations occupy the latest twelve slots", () => {
  const threads = Array.from({ length: 14 }, (_, i) => ({
    environmentId: "env",
    projectId: "project",
    id: String(i),
    updatedAt: new Date(2026, 0, i + 1).toISOString(),
    settledAt: i === 0 ? null : "2026-01-20",
    lastVisitedAt: i === 0 ? "2026-01-18" : "2026-01-20",
    lineage: { relationshipToParent: null },
    pendingBackgroundTasks: [],
    latestRun: { status: "completed", completedAt: "2026-01-19" },
  })) as unknown as Parameters<typeof recentProjectThreads>[0];
  const found = recentProjectThreads(threads, {
    environmentId: "env",
    projectId: "project",
  } as Parameters<typeof recentProjectThreads>[1]).filter((t) => startThreadStatus(t, []) !== null);
  expect(found.map((t) => t.id)).toEqual(["0"]);
});

it("uses the sidebar result reason and never invents a review for a read result", () => {
  const thread = {
    environmentId: "env",
    id: "thread",
    lineage: { relationshipToParent: null },
    pendingBackgroundTasks: [],
    latestRun: { status: "completed", completedAt: "2026-11-04" },
    lastVisitedAt: "2026-11-05",
    settledAt: null,
  } as unknown as Parameters<typeof startThreadStatus>[0];
  expect(startThreadStatus(thread, [])).toBeNull();
  expect(startThreadStatus({ ...thread, lastVisitedAt: "2026-11-03" }, [])).toBe("有新结果");
  expect(
    startThreadStatus(
      thread,
      [],
      [{ ref: { environmentId: thread.environmentId, threadId: thread.id }, reason: "有新结果" }],
    ),
  ).toBe("有新结果");
  const board = {
    state: "blocked",
    folder: "/task",
    sessions: [thread.id],
    snoozed: false,
  } as unknown as Parameters<typeof startThreadStatus>[1][number];
  expect(startThreadStatus(thread, [board])).toBe("需要解锁");
  expect(
    startThreadStatus(
      thread,
      [board],
      [{ ref: { environmentId: thread.environmentId, threadId: thread.id }, reason: "有新结果" }],
    ),
  ).toBe("有新结果");
  expect(startThreadStatus(thread, [{ ...board, state: "user", kind: "review" }])).toBe("待验收");
});
it("formats the same elapsed time through the app translation rather than host English", () => {
  const labels: Record<string, string> = {
    "{count} minutes ago": "分钟前",
    "{count} hours ago": "小时前",
    "{count} days ago": "天前",
  };
  const text = (key: string, values?: Record<string, number>) =>
    labels[key] ? `${values?.count} ${labels[key]}` : key;
  const start = "2026-11-16T00:00:00Z";
  expect(startRelativeTime(start, Date.parse(start) + 52 * 60000, text)).toBe("52 分钟前");
  expect(startRelativeTime(start, Date.parse(start) + 10 * 3600000, text)).toBe("10 小时前");
  expect(startRelativeTime(start, Date.parse(start) + 86400000, text)).toBe("1 天前");
});
