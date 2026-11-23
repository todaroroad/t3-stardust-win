import { UsageDay, type UsageSummaryInput } from "@t3tools/contracts";
export function previousUsageWindow(window: UsageSummaryInput): UsageSummaryInput {
  const day = 86400000;
  const duration = Date.parse(window.untilDay) - Date.parse(window.sinceDay) + day;
  const shiftDay = (value: string) =>
    new Date(Date.parse(value) - duration).toISOString().slice(0, 10);
  if (window.resolution === "hour" && window.sinceTime && window.untilTime) {
    const length = Date.parse(window.untilTime) - Date.parse(window.sinceTime);
    const start = new Date(Date.parse(window.sinceTime) - length).toISOString();
    const end = window.sinceTime;
    const localDay = (value: string) =>
      new Intl.DateTimeFormat("en-CA", {
        timeZone: window.timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(value));
    return {
      ...window,
      sinceTime: start,
      untilTime: end,
      sinceDay: UsageDay.make(localDay(start)),
      untilDay: UsageDay.make(localDay(end)),
    };
  }
  return {
    ...window,
    sinceDay: UsageDay.make(shiftDay(window.sinceDay)),
    untilDay: UsageDay.make(shiftDay(window.untilDay)),
  };
}
