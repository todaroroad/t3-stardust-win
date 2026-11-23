import { uiText } from "../../i18n";
import type { DiskSpaceReport, StorageInspection } from "@t3tools/contracts";
import { cleanupCategoryLabel } from "./cleanupText";
import { cleanupRisk } from "./cleanupModel";
export function storagePresentation(
  data: StorageInspection,
  report: DiskSpaceReport | null | undefined,
): StorageInspection {
  if (!report) return data;
  const entries = data.entries.flatMap((entry) => {
    if (cleanupRisk(entry) !== "locked" || entry.bytes == null) return [entry];
    const existing = data.entries.filter((e) => e.path.startsWith(entry.path + "/"));
    // A parent with already listed descendants keeps the original non-overlapping inventory.
    if (existing.length) return [entry];
    const children = report.categories.filter(
      (c) =>
        c.bytes !== null &&
        c.bytes > 0 &&
        c.path.startsWith(entry.path + "/") &&
        !data.entries.some((e) => e.path === c.path),
    );
    const total = children.reduce((n, c) => n + (c.bytes ?? 0), 0);
    if (!children.length || total > entry.bytes) return [entry];
    const parts = children.map((c) => ({
      ...entry,
      id: entry.id + ":" + c.kind,
      path: c.path,
      name: cleanupCategoryLabel(c.kind),
      kind: c.kind,
      category: c.kind,
      bytes: c.bytes,
      canRelease: false,
      canArchive: false,
      locked: true,
    }));
    return [
      ...parts,
      {
        ...entry,
        id: entry.id + ":remainder",
        name: entry.name + uiText(" · Other"),
        bytes: entry.bytes - total,
      },
    ];
  });
  return {
    ...data,
    entries,
    volumes: data.volumes.map((v) => {
      if (
        !report.volume ||
        v.totalBytes !== report.volume.totalBytes ||
        (v.history?.length ?? 0) > 1
      )
        return v;
      const samples = report.history.flatMap((s) =>
        s.freeBytes === null ? [] : [{ at: s.at, freeBytes: s.freeBytes }],
      );
      return { ...v, history: samples };
    }),
  };
}
