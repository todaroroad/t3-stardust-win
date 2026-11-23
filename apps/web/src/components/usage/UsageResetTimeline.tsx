import { useId, useState } from "react";
import { limitPoolId, type LimitPool } from "@t3tools/shared/usageLimits";
import { readUiLocale } from "~/i18n";
import { useUiText } from "~/i18n/useUiText";
import { limitPoolTitles } from "./limitPoolTitle";
import {
  quotaForecast,
  quotaReadingStale,
  quotaWindowLabel,
  t3LimitWindows,
} from "./usageQuotaPresentation";

export function resetTimelineGeometry(now: number, v9 = false) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const dates = Array.from({ length: 8 }, (_, i) => {
    const day = new Date(start);
    day.setDate(day.getDate() + i);
    return day.getTime();
  });
  const left = v9 ? 165 : 112;
  const width = v9 ? 850 : 952;
  const x = (at: number) => {
    let day = dates.findIndex((end, i) => i > 0 && at < end) - 1;
    if (day < 0) day = at < dates[0]! ? 0 : 6;
    const from = dates[day]!;
    const until = dates[day + 1]!;
    return left + ((day + (at - from) / (until - from)) / 7) * width;
  };
  return { dates, x, left, width };
}

export function UsageResetTimeline({
  pools,
  now,
  onHighlight,
  highlighted = null,
  openResetPoolId = null,
  v9 = false,
  resetPreview = null,
  onOpenResetPool,
}: {
  readonly pools: readonly LimitPool[];
  readonly now: number;
  readonly onHighlight: (driver: string | null) => void;
  readonly highlighted?: string | null;
  readonly openResetPoolId?: string | null;
  readonly v9?: boolean;
  readonly resetPreview?: {
    readonly poolId: string;
    readonly fillsGap: boolean;
    readonly label: string;
  } | null;
  readonly onOpenResetPool?: ((poolId: string) => void) | undefined;
}) {
  const text = useUiText();
  const id = useId();
  const gapLabel = (milliseconds: number) => {
    if (milliseconds >= 86_400_000) {
      const count = Math.round(milliseconds / 86_400_000);
      return text(
        count === 1 ? "About {count} day without quota" : "About {count} days without quota",
        { count },
      );
    }
    const count = Math.max(1, Math.round(milliseconds / 3_600_000));
    return text(
      count === 1 ? "About {count} hour without quota" : "About {count} hours without quota",
      { count },
    );
  };
  const [active, setActive] = useState<string | null>(null);
  const { dates, x, left, width } = resetTimelineGeometry(now, v9);
  const stamp = (at: number) =>
    new Date(at).toLocaleString(readUiLocale(), {
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
  const titles = limitPoolTitles(pools);
  const lanes = pools
    .map((pool) => ({
      pool,
      name: titles.get(limitPoolId(pool)) ?? String(pool.driver),
      events: t3LimitWindows(pool)
        .flatMap((group) =>
          group.members.flatMap((member) => {
            const at = Date.parse(member.window.resetsAt ?? "");
            if (!(at > now && at < dates[7]!)) return [];
            return [
              {
                key: `${group.id}:${member.account.key}`,
                at,
                kind: member.window.kind,
                label: quotaWindowLabel(group.label, readUiLocale() === "zh-CN"),
                remaining: group.remainingPercent,
                runOut: quotaReadingStale(member.account.limits, now)
                  ? null
                  : quotaForecast(member.window, now).runOutAt,
              },
            ];
          }),
        )
        .toSorted((a, b) => a.at - b.at),
    }))
    .filter((lane) => lane.events.length > 0);
  if (!lanes.length) return null;

  const activeId = active ?? highlighted;
  const selected = lanes.find((lane) => limitPoolId(lane.pool) === activeId);

  if (v9) {
    const L = left;
    const R = left + width;
    const W = width;
    const topY = 34;
    const rowH = 56;
    const height = Math.max(140, topY + 14 + lanes.length * rowH + 24);
    const nowX = x(now);

    return (
      <div data-reset-calendar data-lv9="gantt-wrap">
        <div data-lv9="card-title">
          <span>{text("Resets this week")}</span>
          <span data-lv9="sub">{text("Dots show resets. Stripes show time without quota.")}</span>
        </div>
        <div data-lv9="gantt-readout" role="status" data-usage-readout>
          {selected ? (
            <>
              <b>{selected.name}</b>
              {" · "}
              {selected.events
                .slice(0, 4)
                .map((event) =>
                  text("{percent}% remaining · {window} · resets {time}", {
                    window: event.label,
                    percent: Math.round(event.remaining),
                    time: stamp(event.at),
                  }),
                )
                .join("  ·  ")}
            </>
          ) : (
            text("Hover for details. Select a row to find its card above.")
          )}
        </div>
        <svg
          data-lv9="gantt-svg"
          viewBox={`0 0 1040 ${height}`}
          role="img"
          aria-label={text("Quota resets over the next seven days")}
        >
          <defs>
            <pattern
              id={id}
              width="7"
              height="7"
              patternTransform="rotate(45)"
              patternUnits="userSpaceOnUse"
            >
              <line
                x1="0"
                y1="0"
                x2="0"
                y2="7"
                stroke="var(--v9-red)"
                strokeWidth="2"
                opacity="0.45"
              />
            </pattern>
          </defs>
          <rect
            x={L}
            y={24}
            width={W / 7}
            height={lanes.length * rowH + 14}
            rx={8}
            fill="var(--fg)"
            opacity="0.035"
          />
          {dates.slice(0, 7).map((at, i) => {
            const colX = L + (i / 7) * W;
            const wd = new Date(at).toLocaleDateString(readUiLocale(), { weekday: "short" });
            return (
              <g key={at}>
                <line
                  x1={colX}
                  y1={24}
                  x2={colX}
                  y2={lanes.length * rowH + 36}
                  stroke="var(--hair)"
                />
                <text
                  x={colX + W / 14}
                  y={16}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight={i === 0 ? 700 : 500}
                  fill={i === 0 ? "var(--fg)" : "var(--fg-3)"}
                >
                  {i === 0 ? `${wd}(${text("Today")})` : wd}
                </text>
              </g>
            );
          })}
          <line
            data-timeline-now
            x1={nowX}
            y1={24}
            x2={nowX}
            y2={lanes.length * rowH + 36}
            stroke="var(--ac)"
            strokeWidth="1.5"
            strokeDasharray="3 3"
          />
          <rect x={nowX - 16} y={22} width={32} height={15} rx={7} fill="var(--ac)" />
          <text
            x={nowX}
            y={33}
            textAnchor="middle"
            fontSize="9.5"
            fontWeight="700"
            fill="var(--v9-on-ac)"
          >
            {text("Now")}
          </text>
          {lanes.map((lane, idx) => {
            const laneId = limitPoolId(lane.pool);
            const y = topY + 26 + idx * rowH;
            // Pick the primary (weekly, else furthest) event for the V9 single-bar lane.
            const primary = lane.events.find((e) => e.kind === "weekly") ?? lane.events.at(-1)!;
            const gapEvent =
              lane.events
                .filter((e) => e.runOut !== null && e.runOut < e.at)
                .toSorted((a, b) => b.at - b.runOut! - (a.at - a.runOut!))[0] ?? null;
            const main = gapEvent ?? primary;
            const hasGap = Boolean(
              gapEvent &&
              gapEvent.runOut !== null &&
              gapEvent.at > Math.max(now, gapEvent.runOut) + 1_800_000,
            );
            const runAt =
              hasGap && gapEvent?.runOut != null ? Math.max(now, gapEvent.runOut) : main.at;
            const runX = x(runAt);
            const resX = x(main.at);
            const laneCol = hasGap ? "var(--v9-red)" : "var(--v9-green)";
            const hi = activeId === laneId || openResetPoolId === laneId;
            const dim = activeId !== null && activeId !== laneId ? 0.35 : 1;
            const hasResetCredits = lane.pool.accounts.some(
              (account) => account.redeem && (account.limits.resetCredits?.availableCount ?? 0) > 0,
            );
            const showPreview = Boolean(
              resetPreview && resetPreview.poolId === laneId && resetPreview.fillsGap && hasGap,
            );
            const laneTitle =
              lane.pool.driver === "antigravity" ? lane.name : `${lane.name} · ${main.label}`;
            return (
              <g
                key={laneId}
                opacity={dim}
                style={{ cursor: "pointer" }}
                data-timeline-lane={laneId}
                role="button"
                tabIndex={0}
                aria-label={`${lane.name} · ${lane.events.map((e) => stamp(e.at)).join(" · ")}`}
                onMouseEnter={() => {
                  setActive(laneId);
                  onHighlight(laneId);
                }}
                onMouseLeave={() => {
                  setActive(null);
                  onHighlight(null);
                }}
                onFocus={() => {
                  setActive(laneId);
                  onHighlight(laneId);
                }}
                onBlur={() => {
                  setActive(null);
                  onHighlight(null);
                }}
                onClick={() =>
                  document
                    .getElementById(`usage-limit-${laneId}`)
                    ?.scrollIntoView({ behavior: "smooth", block: "nearest" })
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    document
                      .getElementById(`usage-limit-${laneId}`)
                      ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                  }
                }}
              >
                <text
                  x={L - 14}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="12"
                  fontWeight={hi ? 700 : 550}
                  fill="var(--fg)"
                >
                  {laneTitle}
                </text>
                <rect x={L} y={y - 7} width={W} height={14} rx={7} fill="var(--fill)" />
                <rect
                  x={nowX}
                  y={y - 7}
                  width={Math.max(8, runX - nowX)}
                  height={14}
                  rx={7}
                  fill={laneCol}
                  opacity={hi ? 1 : 0.86}
                />
                {hasGap && gapEvent && gapEvent.runOut !== null ? (
                  <>
                    <rect
                      data-timeline-gap
                      x={runX}
                      y={y - 7}
                      width={Math.max(0, resX - runX)}
                      height={14}
                      rx={4}
                      fill={`url(#${id})`}
                      stroke="var(--v9-red)"
                      strokeWidth="0.8"
                      strokeDasharray="3 2"
                      opacity={showPreview ? 0.28 : 1}
                    />
                    {showPreview && resetPreview ? (
                      <>
                        <rect
                          data-timeline-gap-preview
                          x={runX}
                          y={y - 7}
                          width={Math.max(8, resX - runX)}
                          height={14}
                          rx={5}
                          fill="var(--v9-green)"
                          fillOpacity="0.28"
                          stroke="var(--v9-green)"
                          strokeWidth="1.6"
                          strokeDasharray="4 3"
                        />
                        <text
                          x={(runX + resX) / 2}
                          y={y - 12}
                          textAnchor="middle"
                          fontSize="10.5"
                          fontWeight="680"
                          fill="var(--ok)"
                        >
                          {text("Preview: fill gap with {label}", { label: resetPreview.label })}
                        </text>
                      </>
                    ) : (
                      <text
                        x={(runX + resX) / 2}
                        y={y - 12}
                        textAnchor="middle"
                        fontSize="10.5"
                        fontWeight="650"
                        fill="var(--bad)"
                      >
                        {gapLabel(gapEvent.at - gapEvent.runOut)}
                      </text>
                    )}
                    {hasResetCredits && onOpenResetPool ? (
                      <g
                        data-timeline-rc-trigger={laneId}
                        style={{ cursor: "pointer" }}
                        onClick={(event) => {
                          event.stopPropagation();
                          onOpenResetPool(laneId);
                        }}
                      >
                        <circle
                          cx={runX}
                          cy={y}
                          r={7.5}
                          fill="var(--surface)"
                          stroke="var(--warn)"
                          strokeWidth="2"
                        />
                        <circle cx={runX} cy={y} r={3} fill="var(--warn)" />
                        <title>
                          {text("Click to choose a reset credit for {provider}", {
                            provider: lane.name,
                          })}
                        </title>
                      </g>
                    ) : null}
                  </>
                ) : null}
                <rect
                  x={resX}
                  y={y - 5}
                  width={Math.max(8, R - resX)}
                  height={10}
                  rx={5}
                  fill={laneCol}
                  opacity="0.22"
                />
                <circle
                  data-reset-point
                  data-reset-at={main.at}
                  cx={resX}
                  cy={y}
                  r={hi ? 7.5 : 6}
                  fill="var(--surface)"
                  stroke={laneCol}
                  strokeWidth="2.5"
                />
              </g>
            );
          })}
        </svg>
      </div>
    );
  }

  // Classic non-Apple layout preserved for non-Apple themes and existing UsageLimitsPooled/UsageC81 tests.
  const height = 42 + lanes.length * 64;
  return (
    <div data-reset-calendar className="usage-reset-timeline-wrap">
      <h2 className="usage-section-title">
        {text("Resets this week")}
        <span>{text("Dots show resets. Stripes show time without quota.")}</span>
      </h2>
      <section data-usage-card className="usage-reset-timeline">
        <div className="usage-timeline-readout" role="status" data-usage-readout>
          {selected ? (
            <>
              <b>{selected.name}</b>
              {selected.events.slice(0, 5).map((event) => (
                <span key={event.key}>
                  {text("{percent}% remaining · {window} · resets {time}", {
                    window: event.label,
                    percent: Math.round(event.remaining),
                    time: stamp(event.at),
                  })}
                </span>
              ))}
            </>
          ) : (
            text("Hover for details. Select a row to find its card above.")
          )}
        </div>
        <svg
          viewBox={`0 0 1080 ${height}`}
          role="img"
          aria-label={text("Quota resets over the next seven days")}
        >
          <defs>
            <pattern
              id={id}
              width="6"
              height="6"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <rect width="6" height="6" fill="var(--muted)" />
              <line
                x1="0"
                x2="0"
                y1="0"
                y2="6"
                stroke="var(--primary)"
                strokeWidth="1.6"
                opacity=".45"
              />
            </pattern>
          </defs>
          {dates.slice(0, 7).map((at, i) => (
            <g key={at}>
              {i === 0 ? (
                <rect x={112} y={0} width={136} height={height} rx={8} fill="var(--usage-today)" />
              ) : (
                <line x1={x(at)} x2={x(at)} y1={4} y2={height} stroke="var(--border)" />
              )}
              <text
                x={x(at) + 8}
                y={18}
                fill={i === 0 ? "var(--primary)" : "var(--muted-foreground)"}
              >
                {i === 0
                  ? text("Today")
                  : new Date(at).toLocaleDateString(readUiLocale(), { weekday: "short" })}
                <tspan dx={8}>
                  {new Date(at).toLocaleDateString(readUiLocale(), {
                    month: "numeric",
                    day: "numeric",
                  })}
                </tspan>
              </text>
            </g>
          ))}
          <line
            data-timeline-now
            x1={x(now)}
            x2={x(now)}
            y1={28}
            y2={height}
            stroke="var(--primary)"
            strokeWidth={1.5}
          />
          <text x={x(now) + 6} y={32} fill="var(--primary)">
            {text("Now")}{" "}
            {new Date(now).toLocaleTimeString(readUiLocale(), {
              hour: "2-digit",
              minute: "2-digit",
              hourCycle: "h23",
            })}
          </text>
          {lanes.map((lane, i) => {
            const laneId = limitPoolId(lane.pool);
            const cy = 42 + i * 64 + 28;
            let lastEnd = -Infinity;
            const early = lane.events
              .filter((e) => e.runOut !== null && e.runOut < e.at)
              .toSorted((a, b) => a.runOut! - b.runOut!)[0];
            const hasResetCredits = lane.pool.accounts.some(
              (account) => account.redeem && (account.limits.resetCredits?.availableCount ?? 0) > 0,
            );
            const showPreview = Boolean(
              resetPreview && resetPreview.poolId === laneId && resetPreview.fillsGap && early,
            );
            return (
              <g
                key={laneId}
                data-timeline-lane={laneId}
                role="button"
                tabIndex={0}
                aria-label={`${lane.name} · ${lane.events.map((e) => stamp(e.at)).join(" · ")}`}
                onMouseEnter={() => {
                  setActive(laneId);
                  onHighlight(laneId);
                }}
                onMouseLeave={() => {
                  setActive(null);
                  onHighlight(null);
                }}
                onFocus={() => {
                  setActive(laneId);
                  onHighlight(laneId);
                }}
                onBlur={() => {
                  setActive(null);
                  onHighlight(null);
                }}
                onClick={() =>
                  document
                    .getElementById(`usage-limit-${laneId}`)
                    ?.scrollIntoView({ block: "nearest" })
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    document
                      .getElementById(`usage-limit-${laneId}`)
                      ?.scrollIntoView({ block: "nearest" });
                  }
                }}
              >
                <rect
                  x={0}
                  y={cy - 26}
                  width={1080}
                  height={60}
                  rx={8}
                  fill={active === laneId ? "var(--muted)" : "transparent"}
                />
                <text x={0} y={cy - 2} className="usage-timeline-provider">
                  {lane.name}
                </text>
                <text x={0} y={cy + 14}>
                  {text("Lowest remaining {percent}%", {
                    percent: Math.round(Math.min(...lane.events.map((e) => e.remaining))),
                  })}
                </text>
                <line
                  x1={x(now)}
                  x2={1064}
                  y1={cy}
                  y2={cy}
                  stroke="var(--border)"
                  strokeWidth={6}
                  strokeLinecap="round"
                />
                <line
                  x1={x(now)}
                  x2={x(Math.max(now, early?.runOut ?? lane.events.at(-1)!.at))}
                  y1={cy}
                  y2={cy}
                  stroke="var(--usage-lane)"
                  strokeWidth={6}
                  strokeLinecap="round"
                />
                {early && early.runOut !== null ? (
                  <>
                    <rect
                      data-timeline-gap
                      x={x(Math.max(now, early.runOut))}
                      y={cy - 6}
                      width={Math.max(0, x(early.at) - x(Math.max(now, early.runOut)))}
                      height={12}
                      rx={3}
                      fill={`url(#${id})`}
                      opacity={showPreview ? 0.28 : 1}
                    />
                    {showPreview && resetPreview ? (
                      <>
                        <rect
                          data-timeline-gap-preview
                          className="usage-timeline-gap-preview"
                          x={x(Math.max(now, early.runOut))}
                          y={cy - 6}
                          width={Math.max(8, x(early.at) - x(Math.max(now, early.runOut)))}
                          height={12}
                          rx={4}
                        />
                        <text
                          className="usage-timeline-gap-preview-label"
                          x={(x(Math.max(now, early.runOut)) + x(early.at)) / 2}
                          y={cy + 30}
                          textAnchor="middle"
                        >
                          {text("Preview: fill gap with {label}", { label: resetPreview.label })}
                        </text>
                      </>
                    ) : (
                      <text
                        x={(x(Math.max(now, early.runOut)) + x(early.at)) / 2}
                        y={cy + 30}
                        textAnchor="middle"
                      >
                        {gapLabel(early.at - early.runOut)}
                      </text>
                    )}
                    {hasResetCredits && onOpenResetPool ? (
                      <g
                        data-timeline-rc-trigger={laneId}
                        className="usage-timeline-rc-dot"
                        onClick={(event) => {
                          event.stopPropagation();
                          onOpenResetPool(laneId);
                        }}
                      >
                        <title>
                          {text("Click to choose a reset credit for {provider}", {
                            provider: lane.name,
                          })}
                        </title>
                        <circle cx={x(Math.max(now, early.runOut))} cy={cy} r={7.5} />
                        <circle
                          className="usage-timeline-rc-core"
                          cx={x(Math.max(now, early.runOut))}
                          cy={cy}
                          r={3}
                        />
                      </g>
                    ) : null}
                  </>
                ) : null}
                {lane.events.map((e) => {
                  const right = x(e.at) > 930;
                  const below = x(e.at) < lastEnd + 12;
                  lastEnd = x(e.at) + 170;
                  return (
                    <g key={e.key}>
                      <circle
                        data-reset-point
                        data-reset-at={e.at}
                        cx={x(e.at)}
                        cy={cy}
                        r={6}
                        fill="var(--card)"
                        stroke="var(--primary)"
                        strokeWidth={2.5}
                      />
                      <text
                        x={x(e.at) + (right ? -10 : 10)}
                        y={below ? cy + 20 : cy - 12}
                        textAnchor={right ? "end" : "start"}
                        className="usage-timeline-event"
                      >
                        {stamp(e.at)} · {e.label}
                      </text>
                    </g>
                  );
                })}
              </g>
            );
          })}
        </svg>
      </section>
    </div>
  );
}
