import { UsageDay } from "@t3tools/contracts";
import { expect, it } from "vite-plus/test";
import { previousUsageWindow } from "./usagePreviousWindow";
it("compares the adjacent equal-length day window", () => {
  expect(
    previousUsageWindow({
      sinceDay: UsageDay.make("2026-11-10"),
      untilDay: UsageDay.make("2026-11-16"),
      timeZone: "UTC",
      resolution: "day",
    }),
  ).toEqual({
    sinceDay: UsageDay.make("2026-11-03"),
    untilDay: UsageDay.make("2026-11-09"),
    timeZone: "UTC",
    resolution: "day",
  });
});
it("preserves exact elapsed duration for hourly windows", () => {
  const w = previousUsageWindow({
    sinceDay: UsageDay.make("2026-11-15"),
    untilDay: UsageDay.make("2026-11-16"),
    sinceTime: "2026-11-15T12:00:00Z",
    untilTime: "2026-11-16T12:00:00Z",
    timeZone: "UTC",
    resolution: "hour",
  });
  expect(w.sinceTime).toBe("2026-11-14T12:00:00.000Z");
  expect(w.untilTime).toBe("2026-11-15T12:00:00Z");
});
