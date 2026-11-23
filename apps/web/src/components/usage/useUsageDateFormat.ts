import { useLocale } from "gt-react";
import * as format from "@t3tools/shared/usageFormat";

/** Keep the selected time zone and clock format while using the app language. */
export function useUsageDateFormat() {
  const zh = useLocale().startsWith("zh");
  const dateTime = (value: string, timeZone?: string, date = true) => {
    const instant = new Date(value);
    if (!Number.isFinite(instant.getTime())) return value;
    return new Intl.DateTimeFormat("zh-CN", {
      ...(timeZone ? { timeZone } : {}),
      ...(date ? ({ month: "numeric", day: "numeric" } as const) : {}),
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(instant);
  };
  // Axes and hour rows: the bucket's real local start ("19:05"), 24-hour, no zone name; the
  // selected zone is already shown in the page header and tooltips.
  const hourMinute = (value: string, timeZone?: string) => {
    const instant = new Date(value);
    if (!Number.isFinite(instant.getTime())) return value;
    return new Intl.DateTimeFormat("zh-CN", {
      ...(timeZone ? { timeZone } : {}),
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(instant);
  };
  return {
    formatDayShort: (day: string) => {
      if (!zh) return format.formatDayShort(day);
      const instant = new Date(`${day}T00:00:00Z`);
      return Number.isFinite(instant.getTime())
        ? new Intl.DateTimeFormat("zh-CN", {
            month: "2-digit",
            day: "2-digit",
            timeZone: "UTC",
          }).format(instant)
        : day;
    },
    formatHourShort: (value: string, zone?: string, hour12 = true) =>
      zh ? hourMinute(value, zone) : format.formatHourShort(value, zone, hour12),
    formatDateTimeShort: (value: string, zone?: string, hour12 = true) =>
      zh ? dateTime(value, zone) : format.formatDateTimeShort(value, zone, hour12),
    formatRelativeHourShort: (value: string, reference: string, zone?: string, hour12 = true) =>
      zh ? dateTime(value, zone) : format.formatRelativeHourShort(value, reference, zone, hour12),
  };
}
