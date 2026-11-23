import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

export type DonutSegment = {
  readonly id: string;
  readonly value: number;
  /** A CSS color; hatched segments draw diagonal stripes in it. */
  readonly color: string;
  readonly hatched?: boolean;
  /** Dotted outline only, for capacity that is not occupied. */
  readonly outline?: boolean;
};

const SIZE = 300;
const CENTER = SIZE / 2;
const RADIUS = 104;
const STROKE = 40;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** A capacity ring. Segments start at 12 o'clock and run clockwise. */
export function StorageTidyDonut({
  segments,
  children,
  busy = false,
  progress,
  label,
  className,
}: {
  readonly segments: ReadonlyArray<DonutSegment>;
  readonly children?: ReactNode;
  readonly busy?: boolean;
  /** 0..1 progress ring drawn outside the segments while scanning. */
  readonly progress?: number;
  readonly label: string;
  readonly className?: string;
}) {
  const total = segments.reduce((sum, segment) => sum + Math.max(0, segment.value), 0);
  let offset = 0;
  return (
    <div
      className={cn("relative aspect-square w-full max-w-[300px] shrink-0", className)}
      data-testid="storage-tidy-donut"
    >
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label={label}
        className={cn("size-full -rotate-90", busy && "motion-safe:animate-pulse")}
      >
        <defs>
          {segments
            .filter((segment) => segment.hatched)
            .map((segment) => (
              <pattern
                key={segment.id}
                id={`tidy-hatch-${segment.id}`}
                width="7"
                height="7"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(45)"
              >
                <rect width="7" height="7" fill="var(--color-background)" opacity={0.7} />
                <rect width="3.5" height="7" fill={segment.color} />
              </pattern>
            ))}
        </defs>
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          fill="none"
          stroke="var(--muted)"
          strokeWidth={STROKE}
          opacity={0.55}
        />
        {total > 0
          ? segments.map((segment) => {
              const length = (Math.max(0, segment.value) / total) * CIRCUMFERENCE;
              if (length <= 0) return null;
              const start = offset;
              offset += length;
              const gap = length > 3 ? 1.5 : 0;
              return (
                <circle
                  key={segment.id}
                  data-segment={segment.id}
                  cx={CENTER}
                  cy={CENTER}
                  r={RADIUS}
                  fill="none"
                  stroke={segment.hatched ? `url(#tidy-hatch-${segment.id})` : segment.color}
                  strokeWidth={STROKE}
                  strokeDasharray={`${Math.max(0, length - gap)} ${CIRCUMFERENCE}`}
                  strokeDashoffset={-start}
                  opacity={segment.outline ? 0.18 : 1}
                />
              );
            })
          : null}
        {progress !== undefined ? (
          <circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS + STROKE / 2 + 12}
            fill="none"
            stroke="var(--primary)"
            strokeWidth={3}
            strokeLinecap="round"
            strokeDasharray={`${Math.max(0.01, Math.min(1, progress)) * 2 * Math.PI * (RADIUS + STROKE / 2 + 12)} 9999`}
          />
        ) : null}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}
