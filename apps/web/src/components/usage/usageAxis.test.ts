import { expect, it } from "vite-plus/test";
import { usageHourTicks } from "./usageAxis";
it("positions whole-hour labels independently of partial-hour source buckets", () => {
  const ticks = usageHourTicks(["2026-11-17T08:14:00Z", "2026-11-17T20:14:00Z"], "UTC");
  expect(ticks.map((t) => t.label)).toEqual(["12:00", "16:00", "20:00"]);
  expect(ticks[0]!.position).toBeCloseTo((4 - 14 / 60) / 12, 5);
});
it("keeps exact positions through DST and minute-offset zones", () => {
  const ticks = usageHourTicks(
    ["2026-11-01T07:14:00Z", "2026-11-01T19:14:00Z"],
    "America/Los_Angeles",
    1,
  );
  expect(ticks.filter((t) => t.label === "01:00")).toHaveLength(2);
  for (const zone of ["Asia/Kathmandu", "America/Los_Angeles"]) {
    for (const t of usageHourTicks(["2026-11-17T08:14:00Z", "2026-11-17T20:14:00Z"], zone, 1))
      expect(
        new Intl.DateTimeFormat("en-US", { timeZone: zone, minute: "2-digit" }).format(t.at),
      ).toBe("0");
  }
});
