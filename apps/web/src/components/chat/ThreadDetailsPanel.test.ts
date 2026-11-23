import { expect, it } from "vite-plus/test";
import { availableInspectorTabs, hasContinuationRecords } from "./threadDetailsTabs";
import { parseInspectorTab, resolveInspectorTab } from "../../inspectorTabs";
it("hides empty sections and falls back from old or unavailable tabs to artifacts", () => {
  const available = availableInspectorTabs({
    hasArtifacts: true,
    hasHistory: false,
    hasSubtasks: false,
    hasProject: false,
  });
  expect(available).toEqual(["artifacts"]);
  expect(parseInspectorTab("run")).toBe("artifacts");
  expect(resolveInspectorTab("subtasks", available)).toBe("artifacts");
  expect(resolveInspectorTab("history", available)).toBe("artifacts");
  expect(
    availableInspectorTabs({
      hasArtifacts: true,
      hasHistory: true,
      hasSubtasks: true,
      hasProject: true,
    }),
  ).toEqual(["artifacts", "history", "subtasks", "project"]);
});

it("keeps archived continuation records discoverable but excludes deleted children and forks", () => {
  const root = { id: "root", lineage: { relationshipToParent: null }, deletedAt: null };
  const child = { ...root, id: "child", continuedFromThreadId: "root", archivedAt: "2026-01-01" };
  expect(hasContinuationRecords(root, [])).toBe(false);
  expect(hasContinuationRecords(root, [child])).toBe(true);
  expect(hasContinuationRecords(child, [])).toBe(true);
  expect(hasContinuationRecords(root, [{ ...child, deletedAt: "2026-01-02" }])).toBe(false);
  expect(hasContinuationRecords(root, [{ ...child, forkedFrom: "root" }])).toBe(false);
});
