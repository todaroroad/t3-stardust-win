import { expect, it } from "vite-plus/test";
import type { DiskSpaceReport, StorageInspection } from "@t3tools/contracts";
import { storagePresentation } from "./storagePresentation";
import { cleanupRisk, selectedCleanupEntry } from "./cleanupModel";
const data: StorageInspection = {
  checkedAt: "2026-11-16",
  entries: [
    {
      id: "protected",
      name: "受保护",
      path: "/data",
      kind: "protected",
      reason: "protected",
      bytes: 100,
      canRelease: false,
    },
  ],
  archives: [],
  operations: [],
  volumes: [
    { id: "internal", name: "内盘", path: "/", freeBytes: 40, totalBytes: 500, internal: true },
    { id: "external", name: "外盘", path: "/external", freeBytes: 60, totalBytes: 1000 },
  ],
};
const report: DiskSpaceReport = {
  measuredAt: "2026-11-16",
  measuring: false,
  volume: { freeBytes: 60, totalBytes: 1000 },
  backupsToKeep: 1,
  categories: [
    { kind: "database", path: "/data/state", bytes: 70, items: [], unlistedItemCount: 0 },
    { kind: "attachments", path: "/data/attachments", bytes: 20, items: [], unlistedItemCount: 0 },
  ],
  history: [{ at: "2026-11-15", freeBytes: 60, bytesByKind: {} }],
};
it("splits only measured protected categories, preserves total bytes and never makes them selectable", () => {
  const result = storagePresentation(data, report);
  expect(result.entries.map((e) => e.bytes)).toEqual([70, 20, 10]);
  expect(result.entries.every((e) => cleanupRisk(e) === "locked")).toBe(true);
  expect(selectedCleanupEntry(result.entries, undefined)).toBeUndefined();
  expect(data.entries).toHaveLength(1);
});
it("does not double count listed descendants or invent negative remainders", () => {
  const child = { ...data.entries[0]!, id: "child", path: "/data/state", bytes: 70 };
  expect(
    storagePresentation({ ...data, entries: [...data.entries, child] }, report).entries,
  ).toEqual([...data.entries, child]);
  expect(
    storagePresentation({ ...data, entries: [{ ...data.entries[0]!, bytes: 10 }] }, report).entries,
  ).toEqual([{ ...data.entries[0]!, bytes: 10 }]);
});
it("attaches disk-space history only to the matching volume and preserves existing samples", () => {
  const result = storagePresentation(data, report);
  expect(result.volumes[0]?.history).toBeUndefined();
  expect(result.volumes[1]?.history).toEqual([{ at: "2026-11-15", freeBytes: 60 }]);
  const own = [
    { at: "a", freeBytes: 1 },
    { at: "b", freeBytes: 2 },
  ];
  expect(
    storagePresentation({ ...data, volumes: [{ ...data.volumes[1]!, history: own }] }, report)
      .volumes[0]?.history,
  ).toEqual(own);
});
