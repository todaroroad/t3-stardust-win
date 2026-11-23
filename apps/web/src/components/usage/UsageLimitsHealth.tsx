import { ProviderDriverKind } from "@t3tools/contracts";
import { type CSSProperties, useRef, useState } from "react";
import { useUiText } from "~/i18n/useUiText";
import { ProviderInstanceIcon } from "../chat/ProviderInstanceIcon";
import {
  gapParts,
  type LimitsHealthSummary,
  type PoolHealth,
  pooledRemaining,
} from "./limitsHealthModel";

type UiText = ReturnType<typeof useUiText>;

export function gapText(text: UiText, ms: number): string {
  const { unit, count } = gapParts(ms);
  return unit === "day"
    ? text(count === 1 ? "{count} day gap" : "{count} days gap", { count })
    : text(count === 1 ? "{count} hour gap" : "{count} hours gap", { count });
}

/** V13 hero sentence, e.g. "2 accounts need attention; 3 last until reset". */
export function healthSentence(
  text: UiText,
  summary: LimitsHealthSummary,
): { readonly alert: string | null; readonly rest: string | null } {
  if (summary.attention + summary.lasting === 0) return { alert: null, rest: null };
  if (summary.attention === 0) {
    return {
      alert: null,
      rest: text(
        summary.lasting === 1
          ? "{count} account lasts until reset"
          : "All {count} accounts last until reset",
        { count: summary.lasting },
      ),
    };
  }
  return {
    alert: text(
      summary.attention === 1
        ? "{count} account needs attention"
        : "{count} accounts need attention",
      { count: summary.attention },
    ),
    rest:
      summary.lasting > 0
        ? text(summary.lasting === 1 ? "{count} lasts until reset" : "{count} last until reset", {
            count: summary.lasting,
          })
        : null,
  };
}

/**
 * V9 / V4 creative A: the stardust orbit energy meter, a liquid-glass 3D flip card that flips
 * 180° to routing suggestions. Every figure is a live reading: the ring is the mean of each
 * subscription's lowest remaining quota, and the nodes on the orbit are the subscriptions.
 */
export function StardustOrbitMeter({
  pools,
  onFocusPool,
}: {
  readonly pools: readonly PoolHealth[];
  readonly onFocusPool: (poolId: string) => void;
}) {
  const text = useUiText();
  const [flipped, setFlipped] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const read = pools.filter((pool) => pool.lowest !== null);
  const pooled = pooledRemaining(read);
  if (pooled === null) return null;
  const ranked = read.toSorted((a, b) => (b.lowest ?? 0) - (a.lowest ?? 0));
  const best = ranked[0]!;
  const fullBackups = ranked.filter((pool) => (pool.lowest ?? 0) >= 80).length;
  const circumference = 2 * Math.PI * 39;
  // Place highest-remaining node at 12 o'clock and lowest last so warning rings sit cleanly on the lower arc.
  const nodes = ranked.slice(0, 6);
  const tilt = (event: React.PointerEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    if (!card || flipped || event.pointerType !== "mouse") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const rect = card.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const px = (event.clientX - rect.left) / rect.width;
    const py = (event.clientY - rect.top) / rect.height;
    card.dataset.tilting = "";
    card.style.transform = `rotateX(${((0.5 - py) * 14).toFixed(1)}deg) rotateY(${((px - 0.5) * 16).toFixed(1)}deg) scale(1.018)`;
    card.style.setProperty("--mx", `${(px * 100).toFixed(1)}%`);
    card.style.setProperty("--my", `${(py * 100).toFixed(1)}%`);
    card.style.setProperty("--px", (px - 0.5).toFixed(2));
  };
  const untilt = () => {
    const card = cardRef.current;
    if (!card) return;
    delete card.dataset.tilting;
    card.style.transform = "";
  };
  const toggleFlip = () => {
    untilt();
    setFlipped((value) => !value);
  };
  return (
    <section data-usage-orbit-meter data-lv9="v4-orbit-compare-box">
      <div data-lv9="holo-scene">
        <div
          ref={cardRef}
          data-lv9="holo-card"
          data-flipped={flipped || undefined}
          onPointerMove={tilt}
          onPointerLeave={untilt}
          onClick={toggleFlip}
        >
          <div data-lv9="holo-face liquid-front" aria-hidden={flipped || undefined}>
            <div data-lv9="liquid-specular" aria-hidden="true" />
            <div data-lv9="holo-row">
              <span data-lv9="badge ac">{text("Stardust orbit")}</span>
              <span>{text("Tap to flip")}</span>
            </div>
            <div data-lv9="orbit-stage">
              <svg
                width="132"
                height="132"
                viewBox="0 0 132 132"
                role="img"
                aria-label={text("{percent}% left across all subscriptions", { percent: pooled })}
              >
                <circle
                  cx="66"
                  cy="66"
                  r="56"
                  fill="none"
                  stroke="var(--line)"
                  strokeWidth="1"
                  strokeDasharray="3 4"
                />
                <circle
                  cx="66"
                  cy="66"
                  r="39"
                  fill="none"
                  stroke="var(--ac)"
                  strokeOpacity="0.22"
                  strokeWidth="5"
                />
                <circle
                  cx="66"
                  cy="66"
                  r="39"
                  fill="none"
                  stroke="var(--ac)"
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeDasharray={`${((circumference * pooled) / 100).toFixed(1)} ${circumference.toFixed(1)}`}
                  transform="rotate(-90 66 66)"
                />
                <text
                  x="66"
                  y="64"
                  textAnchor="middle"
                  fill="var(--fg)"
                  data-lv9="orbit-figure num"
                >
                  {pooled}%
                </text>
                <text x="66" y="79" textAnchor="middle" fill="var(--fg-2)" data-lv9="orbit-caption">
                  {text("Pool remaining")}
                </text>
              </svg>
              {nodes.map((pool, index) => {
                // Place nodes evenly on the r=56 outer orbit, starting at 12 o'clock.
                // For 3 nodes, put index 1 on bottom-left (150°) and index 2 (lowest) on bottom-right (30°), matching V9.
                const angle =
                  nodes.length === 3
                    ? [-Math.PI / 2, (5 * Math.PI) / 6, Math.PI / 6][index]!
                    : -Math.PI / 2 + (index / nodes.length) * Math.PI * 2;
                const style = {
                  left: `calc(50% + ${(Math.cos(angle) * 56).toFixed(1)}px - 13px)`,
                  top: `calc(50% + ${(Math.sin(angle) * 56).toFixed(1)}px - 13px)`,
                } satisfies CSSProperties;
                const isLow = (pool.lowest ?? 100) <= 20;
                return (
                  <span
                    key={pool.id}
                    data-lv9={isLow ? "orbit-node low" : "orbit-node"}
                    data-low={isLow || undefined}
                    style={style}
                    aria-label={`${pool.label} ${Math.round(pool.lowest ?? 0)}%`}
                  >
                    <ProviderInstanceIcon
                      driverKind={ProviderDriverKind.make(pool.driver)}
                      displayName={pool.label}
                      className="size-3.5"
                      iconClassName="size-3.5"
                    />
                  </span>
                );
              })}
            </div>
            <div data-lv9="holo-foot">
              <span>
                {fullBackups > 0
                  ? text(
                      fullBackups === 1
                        ? "{count} near-full backup found"
                        : "{count} near-full backups found",
                      { count: fullBackups },
                    )
                  : text("No near-full backup right now")}
              </span>
              <b>{text("Flip for routing →")}</b>
            </div>
          </div>
          <div data-lv9="holo-face liquid-back" aria-hidden={!flipped || undefined}>
            <div data-lv9="holo-row">
              <b>{text("Routing suggestions")}</b>
              <span>{text("Flip back")}</span>
            </div>
            <div data-lv9="holo-recs">
              {ranked.slice(0, 3).map((pool) => {
                const tone = pool === best ? "ok" : pool.runsOutToday ? "bad" : undefined;
                return (
                  <button
                    key={pool.id}
                    type="button"
                    data-lv9="holo-rec-item"
                    tabIndex={flipped ? 0 : -1}
                    onClick={(event) => {
                      event.stopPropagation();
                      onFocusPool(pool.id);
                    }}
                  >
                    <span data-lv9="logo-chip">
                      <ProviderInstanceIcon
                        driverKind={ProviderDriverKind.make(pool.driver)}
                        displayName={pool.label}
                        className="size-3.5"
                        iconClassName="size-3.5"
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <b>
                        {pool.label} · {Math.round(pool.lowest ?? 0)}%
                      </b>
                      <small data-lv9={tone}>
                        {pool === best
                          ? pool.gapMs === null
                            ? text("Most quota left · no gap this week")
                            : text("Most quota left")
                          : pool.runsOutToday
                            ? text("Runs out today")
                            : pool.gapMs !== null
                              ? gapText(text, pool.gapMs)
                              : text("Lasts until reset")}
                      </small>
                    </span>
                    <span data-lv9="holo-go">{text("View")}</span>
                  </button>
                );
              })}
            </div>
            <div data-lv9="holo-note">{text("Live quota · nothing here is sample data")}</div>
          </div>
        </div>
      </div>
      <div data-lv9="v4-orbit-copy">
        <div data-lv9="v4-orbit-badges">
          <span data-lv9="badge ac">{text("Stardust orbit")}</span>
          <span data-lv9="badge muted">{text("Liquid glass 3D flip card")}</span>
        </div>
        <h2>{text("Stardust orbit energy meter")}</h2>
        <p>
          {text(
            "The ring is the average of each subscription's lowest remaining quota; nodes on the orbit are your subscriptions, ringed when 20% or less is left. Flip the card for which one to use next.",
          )}
        </p>
        <div data-lv9="v4-orbit-actions">
          <button type="button" data-lv9="chip-btn" onClick={toggleFlip}>
            {flipped ? text("Flip back") : text("Flip to see suggestions")}
          </button>
          <span data-lv9="v4-orbit-hint">
            {text("Move mouse for liquid-glass refraction; click card or button to flip 180°")}
          </span>
        </div>
      </div>
    </section>
  );
}
