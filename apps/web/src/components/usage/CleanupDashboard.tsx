import { serverCopy } from "~/i18n/serverCopy";
import { uiText } from "../../i18n";
import { Tooltip, TooltipTrigger, TooltipPopup } from "../ui/tooltip";
import type { StorageInspection } from "@t3tools/contracts";
import { UsageCount } from "./UsageMotion";
import { GIB } from "./cleanupModel";
import { UsageSparkline } from "./UsageSummaryCards";
import { cleanupRisk } from "./cleanupModel";

const number = (n: number) => n.toFixed(1);
export function CleanupDashboard({
  data,
  releaseBytes,
  volumePath,
  onVolumeChange,
}: {
  readonly data: StorageInspection;
  readonly releaseBytes: number;
  readonly volumePath: string;
  readonly onVolumeChange: (path: string) => void;
}) {
  const volume = data.volumes.find((v) => v.path === volumePath) ?? data.volumes[0];
  if (!volume) return null;
  const measured = data.entries.filter(
    (e) =>
      e.bytes != null &&
      (e.volumePath ?? "/") === volume.path &&
      !data.entries.some(
        (p) => !p.id.endsWith(":remainder") && p.id !== e.id && e.path.startsWith(p.path + "/"),
      ),
  );
  const total = measured.reduce((sum, e) => sum + (e.bytes ?? 0), 0);
  const protectedBytes = measured
    .filter((e) => cleanupRisk(e) === "locked")
    .reduce((sum, e) => sum + (e.bytes ?? 0), 0);
  const safeBytes = measured
    .filter((e) => cleanupRisk(e) === "safe")
    .reduce((n, e) => n + (e.bytes ?? 0), 0);
  const reviewBytes = measured
    .filter((e) => cleanupRisk(e) === "review")
    .reduce((n, e) => n + (e.bytes ?? 0), 0);
  const used = Math.max(0, (volume.totalBytes ?? 0) - volume.freeBytes);
  const hasMeasurement = measured.length > 0;
  const categoryKnown = (risk: string) => measured.some((entry) => cleanupRisk(entry) === risk);
  const segments = [
    { label: uiText("Safe to free"), bytes: safeBytes, known: categoryKnown("safe"), tone: "safe" },
    {
      label: uiText("Confirmation needed"),
      bytes: reviewBytes,
      known: categoryKnown("review"),
      tone: "review",
    },
    {
      label: uiText("Protected data"),
      bytes: protectedBytes,
      known: categoryKnown("locked"),
      tone: "locked",
    },
    {
      label: uiText("System and other"),
      bytes: Math.max(0, used - total),
      known: true,
      tone: "other",
    },
  ];
  const overlaps = total > used;
  const margin = volume.freeBytes / GIB - (volume.reserveGiB ?? 40);
  const metrics = [
    {
      id: "free",
      label: uiText("Available space"),
      value: volume.freeBytes / GIB,
      known: true,
      note: serverCopy(volume.name),
    },
    {
      id: "measured",
      label: uiText("Measured items"),
      value: total / GIB,
      known: hasMeasurement,
      note:
        measured.length === 1
          ? uiText("{count} item · Excludes unmeasured folders", { count: measured.length })
          : uiText("{count} items · Excludes unmeasured folders", { count: measured.length }),
    },
    {
      id: "selected",
      label: uiText("Selected to free"),
      value: releaseBytes / GIB,
      known: true,
      note: uiText("Runs after you confirm the plan"),
    },
    {
      id: "protected",
      label: uiText("Protected items"),
      value: protectedBytes / GIB,
      known: categoryKnown("locked"),
      note: uiText("Excluded from cleanup"),
    },
  ];
  return (
    <div className="usage-clean-summary">
      <p className="usage-clean-eyebrow">
        {serverCopy(volume.name)} {uiText(" · Measures files without deleting them")}
      </p>
      <h2>
        {uiText("Free: ")}
        <UsageCount value={volume.freeBytes / GIB} format={number} />
        {uiText(" GiB, ")}
        {margin < 0
          ? uiText("below the {count} GiB reserve by ", { count: volume.reserveGiB ?? 40 })
          : margin < 5
            ? uiText("above the {count} GiB reserve by ", { count: volume.reserveGiB ?? 40 })
            : uiText("above the reserve by ")}
        <em>{Math.abs(margin).toFixed(1)} GiB</em>
      </h2>
      <p>
        {uiText("Cleanup pauses below the reserve. ")}
        {measured.length
          ? safeBytes > 0
            ? uiText("Measured items include {count} GiB that can be safely freed.", {
                count: (safeBytes / GIB).toFixed(1),
              })
            : uiText("No measured items are ready to free.")
          : uiText("Scan sizes to see what you can free.")}
      </p>
      {volume.totalBytes ? (
        <section data-usage-card className="usage-clean-capacity">
          <div className="usage-card-title">
            <strong>
              {data.volumes.length > 1 ? uiText("Disk capacity") : serverCopy(volume.name)}
            </strong>
            {data.volumes.length > 1 ? (
              <div
                className="usage-disk-segments"
                role="group"
                aria-label={uiText("Choose a disk")}
              >
                {data.volumes.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    aria-pressed={v.id === volume.id}
                    onClick={() => onVolumeChange(v.path)}
                  >
                    {serverCopy(v.name)}
                  </button>
                ))}
              </div>
            ) : null}
            <span>
              {(volume.freeBytes / GIB).toFixed(1)} {uiText(" GiB free / ")}{" "}
              {(volume.totalBytes / GIB).toFixed(0)} GiB
            </span>
          </div>
          <div className="usage-capacity-track">
            <div
              className="usage-capacity-segments"
              style={{ width: `${(used / volume.totalBytes) * 100}%` }}
            >
              {segments.map((segment) => (
                <Tooltip key={segment.tone}>
                  <TooltipTrigger
                    render={<span />}
                    data-tone={segment.tone}
                    style={{
                      width: `${(segment.bytes / (volume.totalBytes ?? 1)) * 100}%`,
                      flexBasis: `${(segment.bytes / Math.max(1, used)) * 100}%`,
                      flexShrink: 0,
                    }}
                  />
                  <TooltipPopup data-usage-portal>
                    {segment.label}{" "}
                    {segment.known
                      ? `${(segment.bytes / GIB).toFixed(1)} GiB`
                      : uiText("Unscanned / Unknown")}
                    {overlaps
                      ? uiText(
                          " · Measured categories exceed used space. Shared blocks, hard links, or scan timing may explain this. Values show measured bytes.",
                        )
                      : ""}
                  </TooltipPopup>
                </Tooltip>
              ))}
            </div>
            <i
              style={{ right: `${(((volume.reserveGiB ?? 40) * GIB) / volume.totalBytes) * 100}%` }}
            >
              <b>{uiText("Reserve ")}</b>
            </i>
          </div>
          <div className="usage-capacity-legend">
            {segments.map((segment) => (
              <span key={segment.tone}>
                <i data-tone={segment.tone} />
                {segment.label}
                <b>
                  {segment.known
                    ? `${(segment.bytes / GIB).toFixed(1)} GiB`
                    : uiText("Unscanned / Unknown")}
                </b>
              </span>
            ))}
            <span>
              <i data-tone="free" />
              {uiText("Free: ")}
              <b>{(volume.freeBytes / GIB).toFixed(1)} GiB</b>
            </span>
          </div>
          <p>
            {uiText("Reserve ")}
            {volume.reserveGiB ?? 40} GiB
            {data.volumes
              .filter((v) => v.id !== volume.id)
              .map((v) =>
                uiText(" · {name}: {total} GiB free", {
                  name: serverCopy(v.name),
                  total: (v.freeBytes / GIB).toFixed(1),
                }),
              )
              .join("")}
          </p>
        </section>
      ) : null}
      <div className="usage-kpis">
        {metrics.map((m) => (
          <div data-usage-card className="usage-kpi" key={m.label}>
            <div className="usage-card-title">
              {m.label}
              <span className="usage-tag">
                {m.id === "free"
                  ? margin >= 0
                    ? uiText("Above reserve")
                    : uiText("Below reserve")
                  : m.id === "selected"
                    ? uiText("selected")
                    : !m.known
                      ? uiText("Scan needed")
                      : uiText("Measured")}
              </span>
            </div>
            <div className="usage-kpi-value">
              <strong>
                {m.id === "measured" || m.id === "protected" ? (
                  m.known ? (
                    <UsageCount value={m.value} format={number} />
                  ) : (
                    uiText("Unscanned")
                  )
                ) : (
                  <UsageCount value={m.value} format={number} />
                )}
                {m.known ? <small> GiB</small> : null}
              </strong>
              {m.id === "free" ? (
                <UsageSparkline values={(volume.history ?? []).map((s) => s.freeBytes / GIB)} />
              ) : null}
            </div>
            <p>{m.note}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CleanupHistory({ data }: { readonly data: StorageInspection }) {
  const volumes = data.volumes.filter((v) => (v.history?.length ?? 0) > 1);

  return (
    <section data-usage-card className="usage-clean-history">
      <h3>{uiText("Free space history")}</h3>
      {!volumes.length ? (
        <p>{uiText("Scan to start tracking free space · 40 GiB reserve")}</p>
      ) : null}
      {volumes.map((v) => {
        const samples = v.history!;
        const reserve = v.reserveGiB ?? 40;
        const values = samples.map((s) => s.freeBytes / GIB);
        const min = Math.max(0, Math.min(reserve, ...values) - 4);
        const max = Math.max(reserve, ...values) + 4;
        const y = (n: number) => 180 - ((n - min) / (max - min)) * 150;
        return (
          <div key={v.id}>
            <p>
              {serverCopy(v.name)} {uiText(" · Measured history")}
            </p>
            <svg
              viewBox="0 0 1440 216"
              role="img"
              aria-label={uiText("{name} free space history, {reserve} GiB reserve", {
                name: serverCopy(v.name),
                reserve,
              })}
            >
              <line
                x1="40"
                y1={y(reserve)}
                x2="1400"
                y2={y(reserve)}
                stroke="var(--foreground)"
                strokeDasharray="4 4"
              />
              <text x="40" y={y(reserve) - 8}>
                {uiText("Reserve ")}
                {reserve} GiB
              </text>
              <defs>
                <linearGradient id={`usage-free-fill-${v.id}`} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.16} />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <polygon
                fill={`url(#usage-free-fill-${v.id})`}
                points={`40,180 ${values
                  .map((n, i) => `${40 + (i / (values.length - 1)) * 1360},${y(n)}`)
                  .join(" ")} 1400,180`}
              />
              <polyline
                data-usage-lines
                fill="none"
                stroke="var(--primary)"
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
                points={values
                  .map((n, i) => `${40 + (i / (values.length - 1)) * 1360},${y(n)}`)
                  .join(" ")}
              />
              {values.map((n, i) =>
                n < reserve ? (
                  <circle
                    key={samples[i]!.at}
                    cx={40 + (i / (values.length - 1)) * 1360}
                    cy={y(n)}
                    r="4"
                    fill="var(--destructive)"
                  />
                ) : null,
              )}
              <text x="4" y="34">
                {max.toFixed(0)}G
              </text>
              <text x="4" y="180">
                {min.toFixed(0)}G
              </text>
              <text x="40" y="210">
                {samples.length} {uiText(" samples")}
              </text>
              <text x="1400" y="210" textAnchor="end">
                {uiText("Newest ")}
                {values.at(-1)!.toFixed(1)} GiB
              </text>
            </svg>
          </div>
        );
      })}
    </section>
  );
}
