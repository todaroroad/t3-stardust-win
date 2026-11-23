import { expect, it } from "vite-plus/test";
import { enumerateDays } from "@t3tools/shared/usageFormat";
import { modelHourlyWindows } from "./usageHourlyWindows";
it("covers a real 90-day range with contiguous reads no longer than seven days", () => {
  const chunks = modelHourlyWindows(enumerateDays("2026-08-20", "2026-11-17"), "America/New_York");
  expect(chunks).toHaveLength(13);
  expect(chunks[0]?.sinceTime).toBe("2026-08-20T04:00:00.000Z");
  expect(chunks.at(-1)?.untilTime).toBe("2026-11-18T05:00:00.000Z");
  for (const [index, chunk] of chunks.entries()) {
    expect(Date.parse(chunk.untilTime!) - Date.parse(chunk.sinceTime!)).toBeLessThanOrEqual(
      7 * 86400000,
    );
    if (index > 0) expect(chunk.sinceTime).toBe(chunks[index - 1]?.untilTime);
  }
});
it("preserves offset minutes and both sides of DST when locating calendar boundaries", () => {
  expect(modelHourlyWindows(["2026-11-16"], "Asia/Kathmandu")[0]).toMatchObject({
    sinceTime: "2026-11-15T18:15:00.000Z",
    untilTime: "2026-11-16T18:15:00.000Z",
  });
  expect(modelHourlyWindows(["2026-11-01"], "America/New_York")[0]).toMatchObject({
    sinceTime: "2026-11-01T04:00:00.000Z",
    untilTime: "2026-11-02T05:00:00.000Z",
  });
  expect(modelHourlyWindows([], "UTC")).toEqual([]);
});
