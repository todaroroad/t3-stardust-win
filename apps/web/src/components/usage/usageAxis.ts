import { readUiLocale } from "~/i18n";
export function usageHourTicks(
  periods: readonly string[],
  timeZone: string,
  stepHours = 4,
  includeLastBucket = false,
) {
  const start = Date.parse(periods[0] ?? ""),
    last = Date.parse(periods.at(-1) ?? "");
  const end = last + (includeLastBucket ? 3600000 : 0);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return [];
  const format = new Intl.DateTimeFormat(readUiLocale(), {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = format.formatToParts(start),
    minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0),
    second = Number(parts.find((p) => p.type === "second")?.value ?? 0);
  const first = start - minute * 60000 - second * 1000;
  const ticks = [];
  for (let at = first; at <= end; at += 3600000) {
    if (at < start) continue;
    const label = format.format(at).slice(0, 5);
    if (Number(label.slice(0, 2)) % stepHours === 0)
      ticks.push({ at, label, position: (at - start) / (end - start) });
  }
  return ticks;
}
