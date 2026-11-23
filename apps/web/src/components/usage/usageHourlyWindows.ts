import { UsageDay, type UsageSummaryInput } from "@t3tools/contracts";

function dayBoundary(day: string, timeZone: string) {
  const target = Date.parse(`${day}T00:00:00Z`);
  const format = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  let instant = target;
  for (let pass = 0; pass < 4; pass++) {
    const parts = new Map(
      format.formatToParts(new Date(instant)).map((part) => [part.type, part.value]),
    );
    const wall = Date.UTC(
      Number(parts.get("year")),
      Number(parts.get("month")) - 1,
      Number(parts.get("day")),
      Number(parts.get("hour")),
      Number(parts.get("minute")),
      Number(parts.get("second")),
    );
    const next = instant + target - wall;
    if (next === instant) break;
    instant = next;
  }
  return instant;
}

/** The server caps hourly reads at seven elapsed days. Read a long calendar range in bounded chunks. */
export function modelHourlyWindows(
  days: readonly string[],
  timeZone: string,
): readonly UsageSummaryInput[] {
  const first = days[0],
    last = days.at(-1);
  if (!first || !last) return [];
  const nextDay = new Date(Date.parse(`${last}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
  const start = dayBoundary(first, timeZone),
    end = dayBoundary(nextDay, timeZone);
  const dayFormat = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const windows: UsageSummaryInput[] = [];
  for (let from = start; from < end; from += 7 * 86400000) {
    const until = Math.min(end, from + 7 * 86400000);
    windows.push({
      resolution: "hour",
      timeZone,
      sinceTime: new Date(from).toISOString(),
      untilTime: new Date(until).toISOString(),
      sinceDay: UsageDay.make(dayFormat.format(new Date(from))),
      untilDay: UsageDay.make(dayFormat.format(new Date(until - 1))),
    });
  }
  return windows;
}
