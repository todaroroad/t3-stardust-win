#!/usr/bin/env node
/**
 * T3星辰版 Post-Build Bundle Enhancer (`stardust-win/patch-dist-bundle.mjs`)
 *
 * Runs directly against `apps/server/dist` right after `vp run build:desktop`, baking in:
 *  1. `0dc5bb41` (`t3code-quota-ui` v1.3.0):
 *     - Cosmic Warp-Drive Canvas Reasoning Effort Slider (`__T3EffortSlider`)
 *     - Topbar Multi-Account Quota Strip (`__T3TopbarQuotaPills`)
 *     - Model Picker `剩 XX%` Badges & Provider Mini Pills (`__T3MpQuotaBadge`)
 *     - Bottom-Center Floating Session Telemetry Pill (`__T3TelemetryPill`, flow-measured, 0 overlap)
 *     - Compact 2-Column Usage Limits Grid + Burn-Rate Forecast + Instant `¥/$` & `中/EN` toggles
 *     - Composer Pill Controls & Cosmic Orange Submit Button CSS
 *  2. `5ec2f7e0` (`stardust-enhancer.js` v3.3.0):
 *     - Telegram-style Left Vertical Project Folder Rail (68px)
 *     - Multi-surface Task Completion / Needs-Confirmation Notifications + 0-refresh Direct Jump
 *     - Turn-Fold & Working Row Model + Token Usage Pills + Hi-Res Vinyl Audio Deck CSS
 *  3. Syntax-checks every modified/injected JS & MJS file via `node --check`.
 */
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const serverDistDir = path.resolve(process.argv[2] || path.join(repoRoot, "apps/server/dist"));
const clientDir = path.join(serverDistDir, "client");
const clientAssetsDir = path.join(clientDir, "assets");
const enhancerSrcPath = path.join(__dirname, "assets/stardust-enhancer.js");

if (!fs.existsSync(path.join(clientDir, "index.html"))) {
  throw new Error(`[patch-dist-bundle] Missing ${path.join(clientDir, "index.html")}. Run build:desktop first.`);
}

function buildInjectedHeadBlock(defaultLang = "zh") {
  const safeDefaultLang = defaultLang === "en" ? "en" : "zh";
  const styleBlock = `<style id="t3-quota-ui-styles">
/* T3星辰版 Quota & Cosmic UI Styles */
.t3-quota-sections {
  display: grid !important;
  grid-template-columns: minmax(0, 1fr) !important;
  column-gap: 0.75rem !important;
  row-gap: 0.875rem !important;
  align-items: start !important;
}
@media (min-width: 768px) {
  .t3-quota-sections {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    grid-auto-flow: row dense !important;
  }
  .t3-quota-sections > :not(.t3-quota-col-1) {
    grid-column: 1 / -1 !important;
  }
  .t3-quota-sections > .t3-quota-col-1 {
    grid-column: span 1 / span 1 !important;
  }
}
.t3-quota-section {
  display: flex !important;
  flex-direction: column !important;
  gap: 0.375rem !important;
  min-width: 0 !important;
}
.t3-quota-grid {
  display: grid !important;
  grid-template-columns: minmax(0, 1fr) !important;
  gap: 0.5rem !important;
}
@media (min-width: 768px) {
  .t3-quota-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }
}
.t3-quota-grid-1 {
  display: grid !important;
  grid-template-columns: minmax(0, 1fr) !important;
  gap: 0.5rem !important;
}
.t3-quota-card {
  display: grid !important;
  align-items: center !important;
  column-gap: 0.75rem !important;
  row-gap: 0.375rem !important;
  padding: 0.5rem 0.75rem !important;
  grid-template-columns: 8.5rem minmax(0, 1fr) !important;
}
.t3-usage-yaxis {
  width: 4.25rem !important;
}
.t3-usage-xaxis {
  padding-left: 4.75rem !important;
}
[data-chat-header]:has(> .t3-topbar-quota-strip) > div.flex-1 {
  padding-right: 0.375rem !important;
}
[data-header-drag-spacer] {
  -webkit-app-region: drag !important;
  pointer-events: auto !important;
}
[data-slot="popover-positioner"]:not(:has([data-open])),
[data-slot="tooltip-positioner"]:not(:has([data-open])) {
  -webkit-app-region: initial !important;
}
.t3-topbar-quota-strip {
  -webkit-app-region: no-drag;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 0.28rem;
  margin-left: 0.375rem;
  margin-right: 0.5rem;
  flex: 0 0 auto;
  min-width: 0;
  width: max-content;
  max-width: min(420px, calc(100% - 13rem));
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
  overscroll-behavior-x: contain;
  padding: 1px 2px;
}
.t3-topbar-quota-strip[data-overflowing="1"] {
  -webkit-mask-image: linear-gradient(to right, transparent 0, #000 8px, #000 calc(100% - 8px), transparent 100%);
  mask-image: linear-gradient(to right, transparent 0, #000 8px, #000 calc(100% - 8px), transparent 100%);
  padding-left: 6px;
  padding-right: 6px;
}
.t3-topbar-quota-strip::-webkit-scrollbar {
  display: none;
}
.t3-topbar-pill {
  -webkit-app-region: no-drag;
  display: inline-flex;
  align-items: center;
  gap: 0.24rem;
  height: 1.35rem;
  padding: 0 0.44rem;
  border-radius: 9999px;
  border: 1px solid color-mix(in oklab, var(--border) 82%, transparent);
  background: color-mix(in oklab, var(--muted) 56%, transparent);
  color: var(--foreground);
  font-size: 10.5px;
  line-height: 1;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  flex-shrink: 0;
  cursor: pointer;
  transition: background-color 140ms ease, border-color 140ms ease;
}
.t3-topbar-pill:hover {
  background: color-mix(in oklab, var(--muted) 92%, transparent);
  border-color: color-mix(in oklab, var(--foreground) 28%, var(--border));
}
.t3-topbar-pill-dot {
  width: 5.5px;
  height: 5.5px;
  border-radius: 9999px;
  flex-shrink: 0;
}
.t3-topbar-pill-name {
  opacity: 0.85;
  font-weight: 600;
}
.t3-topbar-pill-pct {
  display: inline-flex;
  align-items: center;
  font-weight: 700;
}
.t3-topbar-pill-sep {
  opacity: 0.45;
  margin: 0 1px;
  font-weight: 500;
  color: var(--muted-foreground);
}
.t3-topbar-pill-reset {
  opacity: 0.62;
  font-size: 9.5px;
}
.t3-q-ok { color: #10b981; }
.t3-q-warn { color: #f59e0b; }
.t3-q-danger { color: #ef4444; }
.t3-q-dot-ok { background: #10b981; }
.t3-q-dot-warn { background: #f59e0b; }
.t3-q-dot-danger { background: #ef4444; }
.t3-mp-quota-badge {
  display: inline-flex;
  align-items: center;
  height: 1.22rem;
  padding: 0 0.44rem;
  border-radius: 9999px;
  font-size: 11px;
  line-height: 1;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  flex-shrink: 0;
  border: 1px solid transparent;
}
.t3-mp-quota-ok {
  color: #10b981;
  background: color-mix(in oklab, #10b981 18%, transparent);
  border-color: color-mix(in oklab, #10b981 42%, transparent);
}
.t3-mp-quota-warn {
  color: #f59e0b;
  background: color-mix(in oklab, #f59e0b 20%, transparent);
  border-color: color-mix(in oklab, #f59e0b 45%, transparent);
}
.t3-mp-quota-danger {
  color: #ef4444;
  background: color-mix(in oklab, #ef4444 20%, transparent);
  border-color: color-mix(in oklab, #ef4444 48%, transparent);
}
.t3-mp-provider-pill {
  position: absolute;
  top: 0px;
  right: 0px;
  z-index: 40;
  pointer-events: none;
  padding: 0 3px;
  height: 12px;
  line-height: 12px;
  border-radius: 9999px;
  font-size: 8.5px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  background: var(--background);
  box-shadow: 0 0 0 1px color-mix(in oklab, currentColor 42%, var(--border));
}
.t3-burn-row {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding-top: 0.25rem;
  margin-top: 0.1rem;
  border-top: 1px dashed color-mix(in oklab, var(--border) 62%, transparent);
}
.t3-burn-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  max-width: 100%;
  padding: 0.16rem 0.5rem;
  border-radius: 0.4rem;
  border: 1px solid transparent;
  font-size: 11px;
  line-height: 1.3;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.t3-burn-ok {
  color: #10b981;
  background: color-mix(in oklab, #10b981 14%, transparent);
  border-color: color-mix(in oklab, #10b981 30%, transparent);
}
.t3-burn-warn {
  color: #f59e0b;
  background: color-mix(in oklab, #f59e0b 15%, transparent);
  border-color: color-mix(in oklab, #f59e0b 34%, transparent);
}
.t3-burn-danger {
  color: #ef4444;
  background: color-mix(in oklab, #ef4444 16%, transparent);
  border-color: color-mix(in oklab, #ef4444 38%, transparent);
}
.t3-burn-muted {
  color: var(--muted-foreground);
  background: color-mix(in oklab, var(--muted) 65%, transparent);
  border-color: color-mix(in oklab, var(--border) 70%, transparent);
}
.t3-cosmic-wrap {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  padding: 0.55rem 0.6rem 0.6rem;
  border-radius: 0.72rem;
  border: 1px solid color-mix(in oklab, var(--border) 82%, transparent);
  background: color-mix(in oklab, var(--background) 72%, var(--muted));
  user-select: none;
}
.t3-cosmic-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.4rem;
}
.t3-cosmic-title-row {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 12px;
  font-weight: 700;
  color: var(--foreground);
  line-height: 1.2;
}
.t3-cosmic-dot {
  width: 7px;
  height: 7px;
  border-radius: 9999px;
  background: var(--t3-ef-c, #38bdf8);
  box-shadow: 0 0 8px var(--t3-ef-c, #38bdf8);
  flex-shrink: 0;
}
.t3-cosmic-sub {
  margin-top: 2px;
  font-size: 10.5px;
  color: var(--muted-foreground);
  line-height: 1.25;
}
.t3-cosmic-tiers {
  font-size: 10.5px;
  font-weight: 600;
  color: var(--muted-foreground);
  white-space: nowrap;
  padding: 0.1rem 0.35rem;
  border-radius: 9999px;
  background: color-mix(in oklab, var(--foreground) 7%, transparent);
}
.t3-cosmic-canvas-box {
  position: relative;
  height: 38px;
  width: 100%;
  border-radius: 9999px;
  overflow: hidden;
  cursor: pointer;
  touch-action: none;
  background: #070913;
  border: 1px solid color-mix(in oklab, var(--t3-ef-c, #38bdf8) 38%, rgba(255, 255, 255, 0.12));
  box-shadow: inset 0 2px 10px rgba(0, 0, 0, 0.72), 0 0 14px color-mix(in oklab, var(--t3-ef-c, #38bdf8) 22%, transparent);
}
.t3-cosmic-canvas {
  display: block;
  width: 100%;
  height: 100%;
}
.t3-cosmic-stops {
  display: grid;
  gap: 0.18rem;
}
.t3-cosmic-stop {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 1.45rem;
  padding: 0 0.2rem;
  border-radius: 0.42rem;
  border: 1px solid transparent;
  background: transparent;
  color: var(--muted-foreground);
  font-size: 10.5px;
  font-weight: 500;
  line-height: 1;
  cursor: pointer;
  transition: color 140ms ease, background-color 140ms ease, border-color 140ms ease;
  min-width: 0;
  white-space: nowrap;
}
.t3-cosmic-stop:hover:not(:disabled) {
  color: var(--foreground);
  background: color-mix(in oklab, var(--foreground) 7%, transparent);
}
.t3-cosmic-stop[aria-checked="true"] {
  color: var(--foreground);
  font-weight: 700;
  background: color-mix(in oklab, var(--foreground) 14%, transparent);
  border-color: color-mix(in oklab, var(--t3-ef-c, #38bdf8) 45%, var(--border));
  box-shadow: 0 0 8px color-mix(in oklab, var(--t3-ef-c, #38bdf8) 22%, transparent);
}
.t3-cosmic-stop:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
[data-chat-composer-footer="true"] [data-chat-composer-actions="right"] button[type="submit"]:not(:disabled),
button[data-chat-composer-transition-actions="true"]:not(:disabled) {
  background: linear-gradient(135deg, #f97316 0%, #ea580c 100%) !important;
  color: #ffffff !important;
  border-color: transparent !important;
  box-shadow: 0 2px 12px rgba(249, 115, 22, 0.42) !important;
  transition: transform 120ms ease, box-shadow 140ms ease, filter 140ms ease !important;
}
[data-chat-composer-footer="true"] [data-chat-composer-actions="right"] button[type="submit"]:not(:disabled):hover,
button[data-chat-composer-transition-actions="true"]:not(:disabled):hover {
  filter: brightness(1.08);
  box-shadow: 0 3px 16px rgba(249, 115, 22, 0.58) !important;
  transform: translateY(-0.5px);
}
[data-chat-provider-model-picker] button,
[data-composer-model],
[data-composer-model-trigger],
[data-composer-permissions-trigger] {
  border-radius: 9999px !important;
  border: 1px solid color-mix(in oklab, var(--border) 78%, transparent) !important;
  background: color-mix(in oklab, var(--muted) 48%, transparent) !important;
}
[data-chat-provider-model-picker] button:hover,
[data-composer-model]:hover,
[data-composer-model-trigger]:hover,
[data-composer-permissions-trigger]:hover {
  background: color-mix(in oklab, var(--muted) 82%, transparent) !important;
  border-color: color-mix(in oklab, var(--foreground) 22%, var(--border)) !important;
}
.t3-telemetry-dock {
  display: flex;
  justify-content: center;
  padding: 0.28rem 0 0.12rem;
  pointer-events: none;
}
.t3-telemetry-pill {
  pointer-events: auto;
  display: inline-flex;
  align-items: center;
  gap: 0.42rem;
  height: 1.45rem;
  padding: 0 0.65rem;
  border-radius: 9999px;
  border: 1px solid color-mix(in oklab, var(--border) 82%, transparent);
  background: color-mix(in oklab, var(--muted) 56%, var(--background));
  color: var(--muted-foreground);
  font-size: 11px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.14);
}
.t3-telemetry-dot {
  width: 6px;
  height: 6px;
  border-radius: 9999px;
  background: #10b981;
  box-shadow: 0 0 6px rgba(16, 185, 129, 0.7);
  flex-shrink: 0;
}
.t3-telemetry-strong {
  color: var(--foreground);
  font-weight: 600;
}
.t3-telemetry-sep {
  width: 1px;
  height: 10px;
  background: color-mix(in oklab, var(--border) 90%, transparent);
}
[data-slot="right-panel"] [role="tablist"],
[data-right-panel] [role="tablist"] {
  border-radius: 0.55rem;
  padding: 2px;
  background: color-mix(in oklab, var(--muted) 60%, transparent);
  border: 1px solid color-mix(in oklab, var(--border) 72%, transparent);
}
[data-slot="right-panel"] [data-slot="card"],
[data-right-panel] [data-slot="card"] {
  border-radius: 0.65rem !important;
  border-color: color-mix(in oklab, var(--border) 82%, transparent) !important;
  background: color-mix(in oklab, var(--card, var(--muted)) 72%, var(--background)) !important;
}
@media (max-width: 960px) {
  .t3-topbar-pill-reset {
    display: none;
  }
}
@media (max-width: 720px) {
  .t3-topbar-quota-strip {
    display: none;
  }
}
</style>`;

  const runtimeScript = `<script id="t3-quota-ui-i18n">
(function(){
  const LANG_KEY = "t3code:quota-ui-lang";
  const CURR_KEY = "t3code:quota-ui-currency";
  const RATE_KEY = "t3code:quota-ui-fx-rate";
  const DEFAULT_LANG = "${safeDefaultLang}";
  const DEFAULT_RATE = 7.25;

  const WINDOW_LABELS_ZH = {
    "Session": "当前会话",
    "Weekly": "每周额度",
    "Monthly": "每月额度",
    "Monthly spend": "月度消费",
    "Monthly credit limit": "月度额度上限",
    "Overall": "总配额",
    "Cursor Models": "Cursor 模型",
    "Other Models": "第三方模型",
    "Custom API": "自定义 API",
    "Go · Session": "Go · 当前会话",
    "Go · Weekly": "Go · 每周额度",
    "Go · Monthly": "Go · 每月额度",
    "5-hour window": "5小时窗口",
    "7-day window": "7天窗口",
    "5-hour reset": "5小时重置券",
    "Weekly reset": "每周重置券",
    "Full reset": "全量重置券"
  };

  function getLang() {
    try {
      const v = window.localStorage.getItem(LANG_KEY);
      if (v === "zh" || v === "en") return v;
    } catch {}
    return DEFAULT_LANG;
  }

  function getCurrency() {
    try {
      const v = window.localStorage.getItem(CURR_KEY);
      if (v === "CNY" || v === "USD") return v;
    } catch {}
    return "USD";
  }

  function getRate() {
    try {
      const raw = window.localStorage.getItem(RATE_KEY);
      if (raw !== null) {
        const n = Number(raw);
        if (Number.isFinite(n) && n > 0) return n;
      }
    } catch {}
    return DEFAULT_RATE;
  }

  function translateWindowLabel(label) {
    if (!label || typeof label !== "string" || getLang() !== "zh") return label;
    if (label in WINDOW_LABELS_ZH) return WINDOW_LABELS_ZH[label];
    let out = label;
    out = out.replace(/Claude\\s*&\\s*GPT\\s*\\(shared\\)/gi, "Claude / GPT 共享");
    out = out.replace(/^Weekly\\s*·\\s*/, "每周额度 · ");
    out = out.replace(/^Session\\s*·\\s*/, "当前会话 · ");
    out = out.replace(/\\s*·\\s*5-hour$/i, " · 5小时");
    out = out.replace(/\\s*·\\s*5h$/i, " · 5小时");
    out = out.replace(/\\s*·\\s*7-day$/i, " · 7天");
    out = out.replace(/\\s*·\\s*7d$/i, " · 7天");
    out = out.replace(/\\s*·\\s*Weekly$/i, " · 每周");
    out = out.replace(/\\s*·\\s*Monthly$/i, " · 每月");
    out = out.replace(/\\s*·\\s*Quota$/i, " · 配额");
    return out;
  }

  function syncDataset() {
    document.documentElement.dataset.quotaUiLang = getLang();
    document.documentElement.dataset.quotaUiCurrency = getCurrency();
  }

  function emitChange() {
    syncDataset();
    window.dispatchEvent(
      new CustomEvent("t3-quota-ui:change", {
        detail: { lang: getLang(), currency: getCurrency(), rate: getRate() }
      })
    );
  }

  function fmtDurShort(ms) {
    if (!Number.isFinite(ms) || ms <= 0) return "";
    const zh = getLang() === "zh";
    const mins = Math.max(1, Math.round(ms / 60000));
    if (mins < 60) return zh ? mins + "分" : mins + "m";
    const hrs = Math.round(mins / 60);
    if (hrs < 48) return hrs + "h";
    const days = Math.round(hrs / 24);
    return zh ? days + "天" : days + "d";
  }

  function fmtDurLong(ms) {
    if (!Number.isFinite(ms) || ms <= 0) return "";
    const zh = getLang() === "zh";
    const totalMins = Math.max(1, Math.round(ms / 60000));
    if (totalMins < 60) return zh ? totalMins + "分钟" : totalMins + "m";
    const totalHrs = Math.floor(totalMins / 60);
    const remMins = totalMins % 60;
    if (totalHrs < 24) {
      if (zh) return remMins > 0 ? totalHrs + "小时" + remMins + "分" : totalHrs + "小时";
      return remMins > 0 ? totalHrs + "h " + remMins + "m" : totalHrs + "h";
    }
    const days = Math.floor(totalHrs / 24);
    const remHrs = totalHrs % 24;
    if (zh) return remHrs > 0 ? days + "天" + remHrs + "小时" : days + "天";
    return remHrs > 0 ? days + "d " + remHrs + "h" : days + "d";
  }

  function inferWindowDurationMs(win, remMs) {
    if (win && Number.isFinite(win.windowDurationMs) && win.windowDurationMs > 0) return win.windowDurationMs;
    const kind = String(win?.kind || "").toLowerCase();
    const lbl = String(win?.label || "").toLowerCase();
    if (kind === "session" || /5[- ]?hour|5h|session|会话/.test(lbl)) return 5 * 3600000;
    if (kind === "weekly" || /7[- ]?day|7d|weekly|每周/.test(lbl)) return 7 * 86400000;
    if (kind === "monthly" || /month|每月|月度/.test(lbl)) return 30 * 86400000;
    if (Number.isFinite(remMs) && remMs > 0) {
      if (remMs <= 6 * 3600000) return 5 * 3600000;
      if (remMs <= 8 * 86400000) return 7 * 86400000;
      if (remMs <= 32 * 86400000) return 30 * 86400000;
    }
    return 0;
  }

  function computeBurnForecast(poolOrWin, nowInput) {
    if (!poolOrWin) return null;
    const zh = getLang() === "zh";
    const now = Number.isFinite(nowInput) ? nowInput : Date.now();
    const firstWin = Array.isArray(poolOrWin.columns)
      ? (poolOrWin.columns.find((c) => c && c.window)?.window || null)
      : poolOrWin;
    const rawRem = Number.isFinite(poolOrWin.remainingPercent)
      ? poolOrWin.remainingPercent
      : (firstWin && Number.isFinite(firstWin.usedPercent) ? Math.round(100 - firstWin.usedPercent) : null);
    if (rawRem === null || !Number.isFinite(rawRem)) return null;
    const remaining = Math.max(0, Math.min(100, rawRem));
    const used = 100 - remaining;

    if (firstWin && firstWin.id === "custom_api") return null;
    if (remaining >= 99) {
      return {
        tone: "ok",
        text: zh ? "满血可用" : "Full capacity",
        title: zh ? "当前窗口额度几乎未消耗" : "Window quota is at full capacity"
      };
    }
    if (remaining <= 0) {
      return {
        tone: "danger",
        text: zh ? "已触顶 · 等待重置" : "Depleted · awaiting reset",
        title: zh ? "当前窗口额度已耗尽" : "Window quota is depleted"
      };
    }

    const resetsAtMs = firstWin?.resetsAt ? Date.parse(firstWin.resetsAt) : NaN;
    const remMs = Number.isFinite(resetsAtMs) ? resetsAtMs - now : NaN;
    const durMs = inferWindowDurationMs({
      windowDurationMs: firstWin?.windowDurationMs,
      kind: poolOrWin.kind || firstWin?.kind,
      label: poolOrWin.label || firstWin?.label
    }, remMs);

    if (!Number.isFinite(remMs) || remMs <= 0 || !durMs || durMs <= remMs) {
      const tone = remaining >= 50 ? "ok" : remaining >= 20 ? "warn" : "danger";
      return {
        tone,
        text: zh ? (remaining >= 50 ? "节奏平稳 · 余量充足" : remaining >= 20 ? "注意消耗节奏" : "余量偏低") : (remaining >= 50 ? "Healthy headroom" : remaining >= 20 ? "Watch pace" : "Low quota"),
        title: ""
      };
    }

    const elapsedMs = durMs - remMs;
    if (elapsedMs < 120000) {
      return {
        tone: "ok",
        text: zh ? "新窗口刚重置" : "Fresh window",
        title: zh ? "窗口刚刚开始，暂无足够消耗样本" : "Window just reset"
      };
    }

    const ratePerMs = used / elapsedMs;
    const ttfMs = ratePerMs > 0 ? remaining / ratePerMs : Infinity;
    if (ttfMs < remMs * 0.92) {
      const durStr = fmtDurLong(ttfMs);
      const tone = ttfMs < remMs * 0.5 || remaining <= 20 ? "danger" : "warn";
      return {
        tone,
        text: zh ? "消耗偏快 · 约 " + durStr + " 后触顶" : "Fast · ~" + durStr + " to cap",
        title: zh
          ? "按当前消耗速率，预计将在重置前约 " + durStr + " 耗尽额度"
          : "At current burn rate, quota will hit 0% in ~" + durStr + " before reset"
      };
    }

    const projectedLeft = Math.max(0, Math.min(100, Math.round(remaining - ratePerMs * remMs)));
    return {
      tone: "ok",
      text: zh ? "节奏平稳 · 重置前够用 (余~" + projectedLeft + "%)" : "Steady · ~" + projectedLeft + "% at reset",
      title: zh
        ? "按当前速率，窗口重置时预计仍剩约 " + projectedLeft + "%"
        : "At current burn rate, ~" + projectedLeft + "% will remain at reset"
    };
  }

  function toneForRemaining(rem) {
    return rem >= 50 ? "ok" : rem >= 20 ? "warn" : "danger";
  }

  function extractWindows(entry) {
    const ul = entry?.usageLimits || entry?.snapshot?.usageLimits;
    if (!ul || ul.unavailable || !Array.isArray(ul.windows)) return [];
    return ul.windows.filter((w) => w && w.id !== "custom_api" && Number.isFinite(w.usedPercent));
  }

  function pickWindowForModel(windows, modelSlug) {
    if (!windows || windows.length === 0) return null;
    let pool = windows;
    if (modelSlug) {
      const slugLower = String(modelSlug).toLowerCase();
      const matched = windows.filter((w) => Array.isArray(w.modelIds) && w.modelIds.some((m) => String(m).toLowerCase() === slugLower || slugLower.includes(String(m).toLowerCase())));
      if (matched.length > 0) pool = matched;
    }
    return pool.reduce((best, cur) => (!best || cur.usedPercent > best.usedPercent ? cur : best), null);
  }

  function getProviderQuota(entry, modelSlug, nowInput) {
    const wins = extractWindows(entry);
    if (wins.length === 0) return null;
    const now = Number.isFinite(nowInput) ? nowInput : Date.now();
    const target = pickWindowForModel(wins, modelSlug);
    if (!target) return null;
    const remaining = Math.max(0, Math.min(100, Math.round(100 - target.usedPercent)));
    const remMs = target.resetsAt ? Date.parse(target.resetsAt) - now : NaN;
    const resetShort = Number.isFinite(remMs) && remMs > 0 ? fmtDurShort(remMs) : "";
    const zh = getLang() === "zh";
    const lines = wins.map((w) => {
      const r = Math.max(0, Math.min(100, Math.round(100 - w.usedPercent)));
      const wRemMs = w.resetsAt ? Date.parse(w.resetsAt) - now : NaN;
      const wReset = Number.isFinite(wRemMs) && wRemMs > 0 ? " · ↻ " + fmtDurLong(wRemMs) : "";
      const fc = computeBurnForecast(w, now);
      const fcTxt = fc ? " (" + fc.text + ")" : "";
      return translateWindowLabel(w.label || w.kind || w.id) + ": " + r + "%" + (zh ? " 剩余" : " left") + wReset + fcTxt;
    });
    return {
      remaining,
      tone: toneForRemaining(remaining),
      resetShort,
      tooltip: (entry.displayName || entry.driverKind || entry.provider || "") + "\\n" + lines.join("\\n")
    };
  }

  function buildTopbarPills(providers, nowInput) {
    if (!Array.isArray(providers) || providers.length === 0) return [];
    const now = Number.isFinite(nowInput) ? nowInput : Date.now();
    const active = providers
      .filter((p) => p && extractWindows(p).length > 0)
      .slice()
      .sort((a, b) => {
        const da = /antigravity/i.test(String(a.driverKind || a.driver || a.provider || "")) ? 1 : 0;
        const db = /antigravity/i.test(String(b.driverKind || b.driver || b.provider || "")) ? 1 : 0;
        return da - db;
      });
    if (active.length === 0) return [];
    const driverTotals = {};
    const driverSeen = {};
    for (const p of active) {
      const dk = String(p.driverKind || p.driver || p.provider || "other");
      driverTotals[dk] = (driverTotals[dk] || 0) + 1;
    }
    const pills = [];
    for (const p of active) {
      const dk = String(p.driverKind || p.driver || p.provider || "other");
      driverSeen[dk] = (driverSeen[dk] || 0) + 1;
      const idx = driverSeen[dk];
      const total = driverTotals[dk];
      const isAg = /antigravity/i.test(dk);
      let base = dk;
      if (isAg) base = "AG";
      else if (/claude/i.test(dk)) base = "Claude";
      else if (/codex|openai/i.test(dk)) base = "Codex";
      else if (/cursor/i.test(dk)) base = "Cursor";
      else if (/grok|xai/i.test(dk)) base = "Grok";
      else if (/gemini/i.test(dk)) base = "Gemini";
      else base = String(p.displayName || dk).split(/\\s+/)[0].slice(0, 8);
      const shortLabel = total > 1 ? base + idx : base;
      const q = getProviderQuota(p, null, now);
      if (!q) continue;

      const wins = extractWindows(p);
      const geminiWins = isAg
        ? wins.filter((w) => /^gemini/i.test(String(w.id || "")) || /^gemini/i.test(String(w.label || "")))
        : [];
      const poolWins = geminiWins.length > 0 ? geminiWins : wins;
      const sessionWin =
        poolWins.find((w) => w.kind === "session" || /5[- ]?hour|\\b5h\\b|session/i.test(String(w.label || ""))) ||
        null;
      const weeklyWin =
        poolWins.find((w) => w.kind === "weekly" || /weekly|7[- ]?day|\\b7d\\b/i.test(String(w.label || ""))) ||
        null;

      if (sessionWin && weeklyWin) {
        const rem5h = Math.max(0, Math.min(100, Math.round(100 - sessionWin.usedPercent)));
        const remWk = Math.max(0, Math.min(100, Math.round(100 - weeklyWin.usedPercent)));
        const minRem = Math.min(rem5h, remWk);
        const ms5h = sessionWin.resetsAt ? Date.parse(sessionWin.resetsAt) - now : NaN;
        const msWk = weeklyWin.resetsAt ? Date.parse(weeklyWin.resetsAt) - now : NaN;
        const rst5h = Number.isFinite(ms5h) && ms5h > 0 ? fmtDurShort(ms5h) : "";
        const rstWk = Number.isFinite(msWk) && msWk > 0 ? fmtDurShort(msWk) : "";
        const resetDual = rst5h || rstWk ? (rst5h || "-") + "/" + (rstWk || "-") : "";
        pills.push({
          id: p.instanceId || p.id || dk + ":" + idx,
          shortLabel,
          dual: true,
          rem5h,
          remWk,
          tone5h: toneForRemaining(rem5h),
          toneWk: toneForRemaining(remWk),
          remaining: minRem,
          tone: toneForRemaining(minRem),
          resetShort: resetDual,
          tooltip: q.tooltip
        });
      } else {
        pills.push({
          id: p.instanceId || p.id || dk + ":" + idx,
          shortLabel,
          dual: false,
          remaining: q.remaining,
          tone: q.tone,
          resetShort: q.resetShort,
          tooltip: q.tooltip
        });
      }
    }
    return pills;
  }

  const api = {
    getLang,
    isZh: () => getLang() === "zh",
    setLang: (next) => {
      const v = next === "en" ? "en" : "zh";
      try { window.localStorage.setItem(LANG_KEY, v); } catch {}
      emitChange();
    },
    toggleLang: () => api.setLang(getLang() === "zh" ? "en" : "zh"),
    getCurrency,
    isCny: () => getCurrency() === "CNY",
    getRate,
    setCurrency: (next) => {
      const v = next === "CNY" ? "CNY" : "USD";
      try { window.localStorage.setItem(CURR_KEY, v); } catch {}
      emitChange();
    },
    toggleCurrency: () => api.setCurrency(getCurrency() === "CNY" ? "USD" : "CNY"),
    translateWindowLabel,
    fmtDurShort,
    fmtDurLong,
    computeBurnForecast,
    getProviderQuota,
    buildTopbarPills,
    subscribe: (listener) => {
      const onUpdate = () => listener({ lang: getLang(), currency: getCurrency(), rate: getRate() });
      window.addEventListener("t3-quota-ui:change", onUpdate);
      window.addEventListener("storage", onUpdate);
      return () => {
        window.removeEventListener("t3-quota-ui:change", onUpdate);
        window.removeEventListener("storage", onUpdate);
      };
    }
  };

  window.__t3QuotaUi = api;
  syncDataset();
})();
</script>`;

  return `<!-- T3_QUOTA_UI_START -->\n${styleBlock}\n${runtimeScript}\n<!-- T3_QUOTA_UI_END -->`;
}

function patchUsageFormatBundle(src) {
  if (src.includes("__t3CnyFmt")) return src;
  let out = src;

  const helpers = `var __t3CnyFmt=new Intl.NumberFormat("zh-CN",{style:"currency",currency:"CNY",minimumFractionDigits:2,maximumFractionDigits:2});function __t3Zh(){return globalThis.__t3QuotaUi?globalThis.__t3QuotaUi.isZh():!0}function __t3Cny(){return globalThis.__t3QuotaUi?globalThis.__t3QuotaUi.isCny():!1}function __t3Rate(){return globalThis.__t3QuotaUi?globalThis.__t3QuotaUi.getRate():7.25}`;

  const v011Re = /function ([A-Za-z0-9_$]+)\(([A-Za-z0-9_$]+),([A-Za-z0-9_$]+)\)\{return ([A-Za-z0-9_$]+)\(([A-Za-z0-9_$]+)\(\3\),!0\)\.format\(\2\)\}/;
  if (v011Re.test(out)) {
    out = out.replace(
      v011Re,
      (_, fnName, amtArg, locArg, getFmtFn, normLocFn) =>
        `${helpers}function ${fnName}(${amtArg},${locArg}){const __v=Number.isFinite(${amtArg})?${amtArg}:0;return __t3Cny()?__t3CnyFmt.format(__v*__t3Rate()):${getFmtFn}(${normLocFn}(${locArg}),!0).format(__v)}`,
    );
  }
  return out;
}

function patchUsageLimitsShared(src) {
  let out = src;
  out = out.replace(
    /[A-Za-z0-9_$]+\([A-Za-z0-9_$]+\(([A-Za-z0-9_$]+)\)\)\?\?(`?\$\{[A-Za-z0-9_$]+\}:\$\{\1\.instanceId\}`?,\{key:`?\$\{[A-Za-z0-9_$]+\}:\$\{\1\.instanceId\}`?)/g,
    "$2",
  );
  out = out.replace(
    /([A-Za-z0-9_$]+)=[A-Za-z0-9_$]+\([A-Za-z0-9_$]+\(([A-Za-z0-9_$]+)\)\)\?\?(`instance:\$\{\2\.instanceId\}`)/g,
    "$1=$3",
  );

  if (!out.includes("splitAccount:")) {
    out = out.replace(
      /return\[\.\.\.([A-Za-z0-9_$]+)\]\.map\(\(\[([A-Za-z0-9_$]+),([A-Za-z0-9_$]+)\]\)(\s*=>\s*\{[\s\S]*?)return\{driver:\2,accounts:([A-Za-z0-9_$]+),windows:([A-Za-z0-9_$]+)\(\5,([A-Za-z0-9_$]+)\)\}\}\)/,
      (_, mapVar, drvVar, listVar, bodyPrefix, accsVar, zFn, nowArg) =>
        `return[...${mapVar}].sort(([__da],[__db])=>(__da==="antigravity"?1:0)-(__db==="antigravity"?1:0)).flatMap(([${drvVar},${listVar}])${bodyPrefix}const __ordered=[...${accsVar}].sort((x,y)=>{const xp=x.key.endsWith(":"+${drvVar})&&!x.displayName?0:1,yp=y.key.endsWith(":"+${drvVar})&&!y.displayName?0:1;return xp-yp||(x.displayName??x.key).localeCompare(y.displayName??y.key,void 0,{numeric:!0})});if(__ordered.length>1)return __ordered.map((__acc,__idx)=>({poolKey:\`\${${drvVar}}:\${__acc.key}\`,driver:${drvVar},splitAccount:__acc,splitIndex:__idx+1,splitTotal:__ordered.length,accounts:[__acc],windows:${zFn}([__acc],${nowArg})}));return[{poolKey:${drvVar},driver:${drvVar},accounts:__ordered,windows:${zFn}(__ordered,${nowArg})}]})`,
    );
  }
  return out;
}

function patchUsageLimitsView(src) {
  let out = src;
  out = out.replace(
    /([`"'])text-3xl font-semibold text-foreground tabular-nums\1/g,
    (_, q) => `${q}text-xl font-semibold text-foreground tabular-nums${q}`,
  );
  out = out.replace(
    /([`"'])(?:t3-quota-card\s+)?grid items-center gap-x-(?:6|3) gap-y-(?:3|1\.5) rounded-lg border border-border\/60 (?:p-4 md:grid-cols-\[11rem_minmax\(0,1fr\)\]|px-3 py-2 grid-cols-\[8\.5rem_minmax\(0,1fr\)\])\1/g,
    (_, q) =>
      `${q}t3-quota-card grid items-center gap-x-3 gap-y-1.5 rounded-lg border border-border/60 px-3 py-2 grid-cols-[8.5rem_minmax(0,1fr)]${q}`,
  );

  if (!out.includes("t3-quota-col-1")) {
    const v011SectionRe =
      /function ([A-Za-z0-9_$]+)\(([A-Za-z0-9_$]+)\)\{let ([A-Za-z0-9_$]+)=\(0,([A-Za-z0-9_$]+)\.c\)\(\d+\),\{pool:([A-Za-z0-9_$]+),now:([A-Za-z0-9_$]+)\}=\2,([A-Za-z0-9_$]+);\3\[0\]===\5\.driver\?\7=\3\[1\]:\(\7=([A-Za-z0-9_$]+)\(\5\.driver\),\3\[0\]=\5\.driver,\3\[1\]=\7\);let ([A-Za-z0-9_$]+)=\7,([A-Za-z0-9_$]+);\3\[2\]===\5\.driver\?\10=\3\[3\]:\(\10=([A-Za-z0-9_$]+)\.get\(\5\.driver\)\?\.label\?\?String\(\5\.driver\),\3\[2\]=\5\.driver,\3\[3\]=\10\);let ([A-Za-z0-9_$]+)=\10,([A-Za-z0-9_$]+)=([A-Za-z0-9_$]+)\(\5\),([A-Za-z0-9_$]+)=([A-Za-z0-9_$]+)\(\),([A-Za-z0-9_$]+);\3\[4\]!==\12\|\|\3\[5\]!==\5\.driver\?\(\17=\(0,([A-Za-z0-9_$]+)\.jsx\)\(([A-Za-z0-9_$]+),\{driverKind:\5\.driver,displayName:\12,indicatorBackground:[`"']var\(--background\)[`"'],className:[`"']size-5[`"'],iconClassName:[`"']size-4 text-foreground\/80[`"']\}\),\3\[4\]=\12,\3\[5\]=\5\.driver,\3\[6\]=\17\):\17=\3\[6\];([\s\S]*?)return \3\[15\]!==([A-Za-z0-9_$]+)\|\|\3\[16\]!==([A-Za-z0-9_$]+)\?\(([A-Za-z0-9_$]+)=\(0,\18\.jsxs\)\([`"']section[`"'],\{className:[`"']flex flex-col gap-3[`"'],children:\[\21,\22\]\}\),\3\[15\]=\21,\3\[16\]=\22,\3\[17\]=\23\):\23=\3\[17\],\23\}/;

    if (v011SectionRe.test(out)) {
      out = out.replace(
        v011SectionRe,
        (
          _,
          fnName,
          eArg,
          tMemo,
          uNs,
          nPool,
          rNow,
          _iVar,
          yeFn,
          aColor,
          _oVar,
          dMap,
          sLbl,
          lWins,
          zFn,
          uLocale,
          cHook,
          fIcon,
          jsxNs,
          ceIcon,
          midBlock,
          pH2,
          hCards,
        ) =>
          `function ${fnName}(${eArg}){let ${tMemo}=(0,${uNs}.c)(18),{pool:${nPool},now:${rNow}}=${eArg};let ${aColor}=${nPool}.splitAccount?.accentColor||${yeFn}(${nPool}.driver);const __baseLbl=${dMap}.get(${nPool}.driver)?.label??String(${nPool}.driver);let ${sLbl}=${nPool}.splitAccount?(${nPool}.splitAccount.displayName||(${nPool}.splitTotal>1?\`\${__baseLbl} \${${nPool}.splitIndex}\`:__baseLbl)):__baseLbl;let ${lWins}=${zFn}(${nPool}),${uLocale}=${cHook}();const __col1=!0;let ${fIcon}=(0,${jsxNs}.jsx)(${ceIcon},{driverKind:${nPool}.driver,displayName:${sLbl},accentColor:${nPool}.splitAccount?.accentColor,showBadge:Boolean(${nPool}.splitAccount?.accentColor),indicatorBackground:"var(--background)",className:"size-5",iconClassName:"size-4 text-foreground/80"});${midBlock}return(0,${jsxNs}.jsxs)("section",{className:__col1?"t3-quota-section t3-quota-col-1 flex flex-col gap-1.5":"t3-quota-section t3-quota-col-2 flex flex-col gap-1.5",children:[${pH2},(0,${jsxNs}.jsx)("div",{className:__col1?"t3-quota-grid-1 grid grid-cols-1 gap-2":"t3-quota-grid grid grid-cols-1 gap-2 md:grid-cols-2",children:${hCards}})]})}`,
      );
    }

    out = out.replace(
      /children:\(0,([A-Za-z0-9_$]+)\.jsx\)\(([A-Za-z0-9_$]+),\{pool:([A-Za-z0-9_$]+),now:([A-Za-z0-9_$]+)\}\)\},\3\.driver\)/g,
      "children:(0,$1.jsx)($2,{pool:$3,now:$4})},$3.poolKey??$3.driver)",
    );
  }

  out = out.replace(
    /([`"'])(?:t3-quota-sections\s+)?flex flex-col gap-(?:8|3\.5)\1/g,
    (_, q) => `${q}t3-quota-sections flex flex-col gap-3.5${q}`,
  );

  if (!out.includes("t3-burn-row")) {
    const reactMatch = out.match(/\(\s*0\s*,\s*([A-Za-z0-9_$]+)\.useState\s*\)/);
    const cardMatch = out.match(
      /function ([A-Za-z0-9_$]+)\(([A-Za-z0-9_$]+)\)\{let ([A-Za-z0-9_$]+)=\(0,([A-Za-z0-9_$]+)\.c\)\(\d+\),\{pool:([A-Za-z0-9_$]+),color:([A-Za-z0-9_$]+),now:([A-Za-z0-9_$]+),label:([A-Za-z0-9_$]+),description:([A-Za-z0-9_$]+)\}=\2([\s\S]{0,2800}?)\(0,([A-Za-z0-9_$]+)\.jsxs\)\([`"']div[`"'],\{className:[`"']t3-quota-card[^`"']*[`"'],children:\[([A-Za-z0-9_$]+),([A-Za-z0-9_$]+),([A-Za-z0-9_$]+)\]\}\)/,
    );
    if (reactMatch && cardMatch) {
      const reactNs = reactMatch[1];
      const jsxNs = cardMatch[11];
      const poolV = cardMatch[5];
      const nowV = cardMatch[7];
      out = out.replace(
        cardMatch[0],
        cardMatch[0].replace(
          `children:[${cardMatch[12]},${cardMatch[13]},${cardMatch[14]}]`,
          `children:[${cardMatch[12]},${cardMatch[13]},${cardMatch[14]},(0,${jsxNs}.jsx)(__T3BurnBadge,{pool:${poolV},now:${nowV}})]`,
        ),
      );
      const burnComp = `function __T3BurnBadge({pool,now}){const[,setTick]=(0,${reactNs}.useState)(0);(0,${reactNs}.useEffect)(()=>{if(!globalThis.__t3QuotaUi?.subscribe)return;return globalThis.__t3QuotaUi.subscribe(()=>setTick(x=>x+1))},[]);const fc=globalThis.__t3QuotaUi?.computeBurnForecast?.(pool,now);if(!fc||!fc.text)return null;return(0,${jsxNs}.jsx)("div",{className:"t3-burn-row","data-quota-ui-managed":"true",children:(0,${jsxNs}.jsx)("span",{className:"t3-burn-badge t3-burn-"+fc.tone,title:fc.title||fc.text,children:fc.text})})}`;
      out += `\n${burnComp}\n`;
    }
  }

  return out;
}

function patchChatUsageBundle(src, formatUsdExportKey = "u") {
  if (src.includes("__T3UsageRootWrapper")) return src;
  let out = src;

  const reactNsMatch = out.match(/\(\s*0\s*,\s*([A-Za-z0-9_$]+)\.useState\s*\)\([`"']model[`"']\)/);
  const segMatch =
    out.match(
      /\(0,([A-Za-z0-9_$]+)\.jsx\)\(([A-Za-z0-9_$]+),\{"aria-label":[A-Za-z0-9_$]+\([`"']Usage period[`"']\),variant:[`"']segmented[`"'],[\s\S]{0,220}?\(0,\1\.jsx\)\(([A-Za-z0-9_$]+),\{value:String\(/,
    ) ||
    out.match(
      /\.map\([A-Za-z0-9_$]+=>\(0,([A-Za-z0-9_$]+)\.jsx\)\(([A-Za-z0-9_$]+),\{value:[A-Za-z0-9_$]+\.value,title:[A-Za-z0-9_$]+\([A-Za-z0-9_$]+\),children:[A-Za-z0-9_$]+\([A-Za-z0-9_$]+\.label\)\}[^]*?\(0,\1\.jsx\)\(([A-Za-z0-9_$]+),\{"aria-label"/,
    );

  const fmtImportRe = new RegExp(
    `import\\{[^}]*\\b${formatUsdExportKey} as ([A-Za-z0-9_$]+)[^}]*\\}from[\`"']\\.\\/usageFormat-[^\`"']+[\`"']`,
  );
  const fmtUsdMatch =
    out.match(fmtImportRe) ||
    out.match(/import\{[^}]*\bd as ([A-Za-z0-9_$]+)[^}]*\}from[`"']\.\/usageFormat-[^`"']+[`"']/);

  if (!reactNsMatch || !segMatch || !fmtUsdMatch) {
    return out;
  }

  const reactNs = reactNsMatch[1];
  const jsxNs = segMatch[1];
  const toggleGroupIdent = segMatch[2];
  const toggleItemIdent = segMatch[3];
  void fmtUsdMatch[1];

  out = out.replace(
    new RegExp(
      `\\[([A-Za-z0-9_$]+),([A-Za-z0-9_$]+)\\]=\\(0,${reactNs.replace(/\$/g, "\\$")}\\.useState\\)\\([\`"']model[\`"']\\)`,
    ),
    (_, hVar, gVar) => `[${hVar},${gVar}]=__t3UseSavedBreakdown()`,
  );

  out = out.replace(
    /className:[`"']ms-auto hidden shrink-0 items-center justify-end gap-2 @4xl\/usage-header:flex[`"'],children:\[([A-Za-z0-9_$]+),([A-Za-z0-9_$]+),([A-Za-z0-9_$]+)\]/,
    (_, periodEl, metricEl, refreshEl) =>
      `className:"ms-auto hidden shrink-0 items-center justify-end gap-2 @4xl/usage-header:flex",children:[${periodEl},${metricEl},__t3RenderToolbarToggles(!1),${refreshEl}]`,
  );

  out = out.replace(
    /([A-Za-z0-9_$]+)=\(0,([A-Za-z0-9_$]+)\.jsxs\)\([`"']div[`"'],\{className:([A-Za-z0-9_$]+),children:\[([A-Za-z0-9_$]+),([A-Za-z0-9_$]+),([A-Za-z0-9_$]+)\]\}\)/g,
    (full, ltVar, jNs, stVar, cEl, mEl, iEl) => {
      if (
        !out.includes(`${stVar}=\`ms-auto flex shrink-0 items-center justify-end gap-1 @4xl/usage-header:hidden\``) &&
        !out.includes(`${stVar}="ms-auto flex shrink-0 items-center justify-end gap-1 @4xl/usage-header:hidden"`)
      ) {
        return full;
      }
      return `${ltVar}=(0,${jNs}.jsxs)("div",{className:${stVar},children:[${cEl},${mEl},__t3RenderToolbarToggles(!0),${iEl}]})`;
    },
  );

  out = out.replace(
    /function ([A-Za-z0-9_$]+)\(([A-Za-z0-9_$]+),([A-Za-z0-9_$]+)\)\{let ([A-Za-z0-9_$]+)=\2\.reduce\(\(([A-Za-z0-9_$]+),([A-Za-z0-9_$]+)\)=>\6\.bands\.reduce\(\(([A-Za-z0-9_$]+),([A-Za-z0-9_$]+)\)=>Math\.max\(\7,\8\.value\),\5\),0\);return \4===0&&\3\.size>0\?\{max:([A-Za-z0-9_$]+),ticks:([A-Za-z0-9_$]+),labeled:!1\}:\{\.\.\.([A-Za-z0-9_$]+)\(\4,\9\),labeled:!0\}\}/,
    (_, fnName, colsArg, loadArg, maxVar, a1, b1, a2, b2, wnIdent, pnIdent, nnIdent) =>
      `function ${fnName}(${colsArg},${loadArg},__metric){let ${maxVar}=${colsArg}.reduce((${a1},${b1})=>${b1}.bands.reduce((${a2},${b2})=>Math.max(${a2},${b2}.value),${a1}),0);if(${maxVar}===0&&${loadArg}.size>0)return{max:${wnIdent},ticks:${pnIdent},labeled:!1};if(__metric==="cost"&&__t3UsageCny()&&${maxVar}>0){const __r=__t3UsageRate(),__sc=${nnIdent}(${maxVar}*__r,${wnIdent});return{max:__sc.max/__r,ticks:__sc.ticks.map(v=>v/__r),labeled:!0}}return{...${nnIdent}(${maxVar},${wnIdent}),labeled:!0}}`,
  );
  out = out.replace(
    /function ([A-Za-z0-9_$]+)\(([A-Za-z0-9_$]+),([A-Za-z0-9_$]+),([A-Za-z0-9_$]+),([A-Za-z0-9_$]+),([A-Za-z0-9_$]+)\)\{let ([A-Za-z0-9_$]+)=([A-Za-z0-9_$]+)\(\2,\3,\4\),([A-Za-z0-9_$]+)=([A-Za-z0-9_$]+)\(\7,\6\)/,
    (_, lnName, pArg, mArg, metricArg, provArg, loadArg, aVar, onFn, oVar, fnFn) =>
      `function ${lnName}(${pArg},${mArg},${metricArg},${provArg},${loadArg}){let ${aVar}=${onFn}(${pArg},${mArg},${metricArg}),${oVar}=${fnFn}(${aVar},${loadArg},${metricArg})`,
  );

  out = out.replace(
    /className:[`"']relative h-56 w-14 shrink-0[`"']/g,
    'className:"t3-usage-yaxis relative h-56 w-14 shrink-0"',
  );
  out = out.replace(
    /className:[`"']flex justify-between pl-16 text-3xs text-muted-foreground uppercase[`"']/g,
    'className:"t3-usage-xaxis flex justify-between pl-16 text-3xs text-muted-foreground uppercase"',
  );

  const helperFooter = `
var __t3SavedBreakdown="model";
function __t3UsageZh(){return globalThis.__t3QuotaUi?globalThis.__t3QuotaUi.isZh():!0}
function __t3UsageCny(){return globalThis.__t3QuotaUi?globalThis.__t3QuotaUi.isCny():!1}
function __t3UsageRate(){return globalThis.__t3QuotaUi?globalThis.__t3QuotaUi.getRate():7.25}
function __t3UseSavedBreakdown(){
  const [s,setS]=(0,${reactNs}.useState)(()=>__t3SavedBreakdown);
  const update=(0,${reactNs}.useCallback)(v=>{
    const next=typeof v==="function"?v(__t3SavedBreakdown):v;
    __t3SavedBreakdown=next;
    setS(next);
  },[]);
  return [s,update];
}
function __t3RenderToolbarToggles(compact){
  const isZh=__t3UsageZh();
  const isCny=__t3UsageCny();
  const rate=__t3UsageRate();
  const __fxTip=isZh?\`切换人民币 / 美元实时换算（参考汇率 1 USD = \${rate} CNY）\`:\`Toggle CNY / USD conversion (Ref rate: 1 USD = \${rate} CNY)\`;
  const __currSeg=(0,${jsxNs}.jsxs)(${toggleGroupIdent},{
    "aria-label":isZh?"计价货币":"Currency",
    "data-quota-ui-managed":"true",
    variant:"segmented",
    value:[isCny?"CNY":"USD"],
    onValueChange:vals=>{
      const cur=__t3UsageCny()?"CNY":"USD";
      const next=vals[0]||(cur==="CNY"?"USD":"CNY");
      globalThis.__t3QuotaUi?.setCurrency(next);
    },
    children:[
      (0,${jsxNs}.jsx)(${toggleItemIdent},{value:"CNY",title:__fxTip,children:compact?"¥":"¥ CNY"},"CNY"),
      (0,${jsxNs}.jsx)(${toggleItemIdent},{value:"USD",title:__fxTip,children:compact?"$":"$ USD"},"USD")
    ]
  });
  return __currSeg;
}
`;

  out = out.replace(
    /var ([A-Za-z0-9_$]+)=([A-Za-z0-9_$]+);export\{\1 as component\};/,
    (_, expVar, innerComp) => `${helperFooter}
function __T3UsageRootWrapper(props){
  const [snap,setSnap]=(0,${reactNs}.useState)(()=>({
    lang:__t3UsageZh()?"zh":"en",
    curr:__t3UsageCny()?"CNY":"USD",
    rate:__t3UsageRate()
  }));
  (0,${reactNs}.useEffect)(()=>{
    if(!globalThis.__t3QuotaUi?.subscribe)return;
    return globalThis.__t3QuotaUi.subscribe(next=>{
      setSnap({lang:next.lang,curr:next.currency,rate:next.rate});
    });
  },[]);
  return (0,${jsxNs}.jsx)("div",{className:"contents",children:(0,${jsxNs}.jsx)(${innerComp},{...props},\`\${snap.lang}:\${snap.curr}:\${snap.rate}\`)});
}
var ${expVar}=__T3UsageRootWrapper;export{${expVar} as component};`,
  );

  return out;
}

function patchModelPickerBundle(src) {
  let out = src;
  if (out.includes("__T3MpQuotaBadge")) return out;

  const entriesMatch = out.match(
    /\{searchInputRef:[A-Za-z0-9_$]+,keybindings:[A-Za-z0-9_$]+,modelOptionsByInstance:[A-Za-z0-9_$]+,instanceEntries:([A-Za-z0-9_$]+),/,
  );
  const reactMatch = out.match(/\(\s*0\s*,\s*([A-Za-z0-9_$]+)\.useState\s*\)\([`"'][`"']\)/);
  const jsxMatch = out.match(
    /\(0,([A-Za-z0-9_$]+)\.jsxs\)\([`"']div[`"'],\{className:[`"']flex shrink-0 items-center gap-1\.5[`"'],children:\[([A-Za-z0-9_$]+),([A-Za-z0-9_$]+)\]\}\)/,
  );
  if (!reactMatch || !jsxMatch || !entriesMatch) return out;

  const entriesVar = entriesMatch[1];
  const reactNs = reactMatch[1];
  const jsxNs = jsxMatch[1];

  out = out.replace(
    /(\(0,[A-Za-z0-9_$]+\.jsx\)\([A-Za-z0-9_$]+,\{index:[A-Za-z0-9_$]+,slug:([A-Za-z0-9_$]+)\.slug,name:\2\.name,subProvider:\2\.subProvider,instanceId:\2\.instanceId,)/,
    `$1quotaEntry:${entriesVar}?.find(__x=>__x.instanceId===$2.instanceId)??null,`,
  );

  out = out.replace(
    /let ([A-Za-z0-9_$]+);([A-Za-z0-9_$]+)\[(\d+)\]!==([A-Za-z0-9_$]+)\|\|\2\[(\d+)\]!==([A-Za-z0-9_$]+)\?\(\1=\(0,([A-Za-z0-9_$]+)\.jsxs\)\([`"']div[`"'],\{className:[`"']flex shrink-0 items-center gap-1\.5[`"'],children:\[\4,\6\]\}\),\2\[\3\]=\4,\2\[\5\]=\6,\2\[(\d+)\]=\1\):\1=\2\[\8\];/,
    (_, teV, _tM, _s1, rV, _s2, zV, jNs) =>
      `let ${teV};${teV}=(0,${jNs}.jsxs)("div",{className:"flex shrink-0 items-center gap-1.5",children:[(0,${jNs}.jsx)(__T3MpQuotaBadge,{entry:e.quotaEntry,modelSlug:e.slug}),${rV},${zV}]});`,
  );

  out = out.replace(
    /(let ([A-Za-z0-9_$]+)=([A-Za-z0-9_$]+)\?([A-Za-z0-9_$]+)\(([A-Za-z0-9_$]+)(?:,[A-Za-z0-9_$]+)*\):([A-Za-z0-9_$]+)\?e\.getDisabledInstanceTooltip\?\.\(\5\)\?\?\5\.displayName:\5\.displayName,([A-Za-z0-9_$]+)=\(0,([A-Za-z0-9_$]+)\.jsx\)\(([A-Za-z0-9_$]+),\{[\s\S]{0,900}?children:\(0,\8\.jsx\)\(([A-Za-z0-9_$]+),\{driverKind:\5\.driverKind,[\s\S]{0,360}?\}\)\}\))/,
    (full, _all, _pVar, _nVar, _weFn, tVar, _iVar, _mVar, jNs) =>
      full.replace(
        new RegExp(`children:\\(0,${jNs}\\.jsx\\)\\(([A-Za-z0-9_$]+),(\\{driverKind:${tVar}\\.driverKind,[\\s\\S]{0,360}?\\})\\)`),
        `children:(0,${jNs}.jsxs)(${jNs}.Fragment,{children:[(0,${jNs}.jsx)($1,$2),(0,${jNs}.jsx)(__T3MpProviderMini,{entry:${tVar}})]})`,
      ),
  );

  out += `\nfunction __T3MpQuotaBadge({entry,modelSlug}){const[,setTick]=(0,${reactNs}.useState)(0);(0,${reactNs}.useEffect)(()=>{if(!globalThis.__t3QuotaUi?.subscribe)return;return globalThis.__t3QuotaUi.subscribe(()=>setTick(x=>x+1))},[]);const q=globalThis.__t3QuotaUi?.getProviderQuota?.(entry,modelSlug,Date.now());if(!q)return null;const zh=globalThis.__t3QuotaUi?globalThis.__t3QuotaUi.isZh():!0;return(0,${jsxNs}.jsx)("span",{className:"t3-mp-quota-badge t3-mp-quota-"+q.tone,"data-quota-ui-managed":"true",title:q.tooltip,children:(zh?"剩 ":"")+q.remaining+"%"})}\nfunction __T3MpProviderMini({entry}){const q=globalThis.__t3QuotaUi?.getProviderQuota?.(entry,null,Date.now());if(!q)return null;return(0,${jsxNs}.jsx)("span",{className:"t3-mp-provider-pill t3-q-"+q.tone,"data-quota-ui-managed":"true",title:q.tooltip,children:q.remaining})}\n`;
  return out;
}

function patchChatBundle(src) {
  let out = src;
  const reactMatch = out.match(
    /var [A-Za-z0-9_$]+=\(0,([A-Za-z0-9_$]+)\.memo\)\(function\([A-Za-z0-9_$]+\)\{let [A-Za-z0-9_$]+=\(0,[A-Za-z0-9_$]+\.c\)\(\d+\),\{activeThreadEnvironmentId:/,
  );
  const topbarCallMatch = out.match(
    /(\(0,([A-Za-z0-9_$]+)\.jsx\)\(([A-Za-z0-9_$]+),\{activeThreadEnvironmentId:[A-Za-z0-9_$]+\.environmentId,activeThreadId:[A-Za-z0-9_$]+\.id,[\s\S]{0,520}?rightPanelOpen:([A-Za-z0-9_$]+),[\s\S]{0,220}?\}\))\s*\]\}\)/,
  );
  if (!reactMatch || !topbarCallMatch) {
    return out;
  }

  const reactNs = reactMatch[1];
  const jsxNs = topbarCallMatch[2];
  const rightPanelVar = topbarCallMatch[4];

  const topbarPos = out.indexOf(topbarCallMatch[0]);
  const chatScope = out.slice(Math.max(0, topbarPos - 80000), topbarPos);
  const providersMatch = chatScope.match(/providerStatuses:([A-Za-z0-9_$]+),providerCatalogKnown:/);
  const navMatch = chatScope.match(/([A-Za-z0-9_$]+)\(\{to:[`"']\/projects\/\$projectKey[`"'],params:/);
  const providersVar = providersMatch ? providersMatch[1] : null;
  const navVar = navMatch ? navMatch[1] : null;

  // 1. Topbar Quota Pills
  if (providersVar && !out.includes("__T3TopbarQuotaPills")) {
    const openUsageExpr = navVar
      ? `()=>{try{const __k="t3code:usage-page-preferences:v1";const __cur=JSON.parse(window.localStorage.getItem(__k)||"{}");window.localStorage.setItem(__k,JSON.stringify({windowDays:30,...__cur,metric:"limits"}));}catch{} ${navVar}({to:"/usage"})}`
      : `()=>{window.location.hash="#/usage"}`;

    out = out.replace(
      topbarCallMatch[0],
      `${topbarCallMatch[1]},(0,${jsxNs}.jsx)(__T3TopbarQuotaPills,{providers:${providersVar},onOpenUsageLimits:${openUsageExpr},rightPanelOpen:${rightPanelVar}})]})`,
    );

    const topbarComp = `function __T3TopbarQuotaPills({providers,onOpenUsageLimits,rightPanelOpen}){const[now,setNow]=(0,${reactNs}.useState)(()=>Date.now());const[,setTick]=(0,${reactNs}.useState)(0);const[overflowing,setOverflowing]=(0,${reactNs}.useState)(!1);const stripRef=(0,${reactNs}.useRef)(null);(0,${reactNs}.useEffect)(()=>{const id=setInterval(()=>setNow(Date.now()),60000);const unsub=globalThis.__t3QuotaUi?.subscribe?.(()=>setTick(x=>x+1));return()=>{clearInterval(id);if(typeof unsub==="function")unsub()}},[]);const pills=globalThis.__t3QuotaUi?.buildTopbarPills?.(providers,now)||[];const pillsSig=pills.map(p=>p.id+":"+p.remaining+":"+(p.resetShort||"")).join("|");(0,${reactNs}.useEffect)(()=>{const el=stripRef.current;if(!el)return;const measure=()=>{setOverflowing(el.scrollWidth>el.clientWidth+2)};measure();const ro=typeof ResizeObserver==="function"?new ResizeObserver(measure):null;if(ro)ro.observe(el);const onWheel=ev=>{if(el.scrollWidth<=el.clientWidth+1)return;const delta=Math.abs(ev.deltaY)>=Math.abs(ev.deltaX)?ev.deltaY:ev.deltaX;if(delta===0)return;ev.preventDefault();el.scrollLeft+=delta};el.addEventListener("wheel",onWheel,{passive:!1});return()=>{if(ro)ro.disconnect();el.removeEventListener("wheel",onWheel)}},[pillsSig,rightPanelOpen]);if(pills.length===0)return null;const zh=globalThis.__t3QuotaUi?globalThis.__t3QuotaUi.isZh():!0;return(0,${jsxNs}.jsx)("div",{ref:stripRef,className:"t3-topbar-quota-strip","data-overflowing":overflowing?"1":"0",style:{marginRight:rightPanelOpen?"44px":"104px"},"data-quota-ui-managed":"true","aria-label":zh?"模型额度状态":"Model quota status",children:pills.map(p=>(0,${jsxNs}.jsxs)("button",{type:"button",className:"t3-topbar-pill",title:p.tooltip+(onOpenUsageLimits?(zh?"\\n点击查看完整配额面板":"\\nClick to open Usage -> Limits"):""),onClick:()=>{if(typeof onOpenUsageLimits==="function")onOpenUsageLimits()},children:[(0,${jsxNs}.jsx)("span",{className:"t3-topbar-pill-dot t3-q-dot-"+p.tone}),(0,${jsxNs}.jsx)("span",{className:"t3-topbar-pill-name",children:p.shortLabel}),p.dual?(0,${jsxNs}.jsxs)("span",{className:"t3-topbar-pill-pct",children:[(0,${jsxNs}.jsx)("span",{className:"t3-q-"+p.tone5h,children:p.rem5h+"%"}),(0,${jsxNs}.jsx)("span",{className:"t3-topbar-pill-sep",children:"/"}),(0,${jsxNs}.jsx)("span",{className:"t3-q-"+p.toneWk,children:p.remWk+"%"})]}):(0,${jsxNs}.jsx)("span",{className:"t3-topbar-pill-pct t3-q-"+p.tone,children:p.remaining+"%"}),p.resetShort?(0,${jsxNs}.jsx)("span",{className:"t3-topbar-pill-reset",children:"· "+p.resetShort}):null]},p.id))})}`;
    out += `\n${topbarComp}\n`;
  }

  // 2. Cosmic Warp-Drive Canvas Reasoning Effort Slider
  if (!out.includes("function __T3EffortSlider(")) {
    const xrRegex =
      /([A-Za-z0-9_$]+)=([A-Za-z0-9_$]+)\.map\(\(([A-Za-z0-9_$]+),([A-Za-z0-9_$]+)\)=>\(0,([A-Za-z0-9_$]+)\.jsx\)\(([A-Za-z0-9_$]+),\{label:\3\.label,selected:\3\.id===([A-Za-z0-9_$]+),tabStop:[A-Za-z0-9_$]+\?\3\.id===\7:\4===0,description:\3\.description,isDefault:\3\.isDefault,disabled:([A-Za-z0-9_$]+),onPick:\(\)=>([A-Za-z0-9_$]+)\.changeSelect\(([A-Za-z0-9_$]+)\.descriptor,\3\.id\)\},\3\.id\)\)/;
    if (xrRegex.test(out)) {
      out = out.replace(
        xrRegex,
        (full, fV, eOpts, _opt, _idx, jNs, _qR, selId, disV, traitsV, ctrlV) =>
          `${fV}=${eOpts}.length>=2?(0,${jNs}.jsx)(__T3EffortSlider,{options:${eOpts},selectedId:${selId},disabled:${disV},onPick:__id=>${traitsV}.changeSelect(${ctrlV}.descriptor,__id)}):${full.slice(fV.length + 1)}`,
      );
      const cosmicSliderFn = `function __T3EffortSlider({options,selectedId,disabled,onPick}){const[dragIdx,setDragIdx]=(0,${reactNs}.useState)(null);const[,setLangTick]=(0,${reactNs}.useState)(0);const boxRef=(0,${reactNs}.useRef)(null);const canvasRef=(0,${reactNs}.useRef)(null);const wakeUntilRef=(0,${reactNs}.useRef)(Date.now()+2200);const rafRef=(0,${reactNs}.useRef)(0);const starsRef=(0,${reactNs}.useRef)(null);(0,${reactNs}.useEffect)(()=>{if(!globalThis.__t3QuotaUi?.subscribe)return;return globalThis.__t3QuotaUi.subscribe(()=>setLangTick(x=>x+1))},[]);const count=options.length;if(count<2)return null;const curIdx=Math.max(0,options.findIndex(o=>o.id===selectedId));const activeIdx=dragIdx!==null?dragIdx:curIdx;const activeOpt=options[activeIdx]||options[0];const ratio=count>1?activeIdx/(count-1):0;const tierColor=ratio<=0.05?"#38bdf8":ratio<=0.42?"#34d399":ratio<=0.74?"#fbbf24":"#a855f7";const zh=globalThis.__t3QuotaUi?globalThis.__t3QuotaUi.isZh():!0;const shortLbl=o=>{const id=String(o.id||o.label||"").toLowerCase();if(!zh)return o.label;if(id==="none"||id==="off")return"关";if(id==="minimal")return"极低";if(id==="low")return"低";if(id==="medium")return"中";if(id==="high")return"高";if(id==="xhigh")return"超高";if(id==="max"||id==="ultra")return"Max";return o.label};const subTitle=()=>{if(zh){if(ratio<=0.05)return"轻载快响 · 极速响应";if(ratio<=0.42)return"均衡巡航 · 日常开发";if(ratio<=0.74)return"高能推进 · 深度推理";return"深空曲速巡航 · 满载任务"}if(ratio<=0.05)return"Light cruise · fast response";if(ratio<=0.42)return"Balanced cruise · daily coding";if(ratio<=0.74)return"High thrust · deep reasoning";return"Deep-space warp · full power"};const wake=(ms=2000)=>{wakeUntilRef.current=Math.max(wakeUntilRef.current,Date.now()+ms)};(0,${reactNs}.useEffect)(()=>{wake(2000);const cvs=canvasRef.current;if(!cvs)return;const ctx=cvs.getContext("2d");if(!ctx)return;if(!starsRef.current){const arr=[];for(let i=0;i<26;i++)arr.push({x:Math.random(),y:Math.random(),r:0.5+Math.random()*1.1,s:0.12+Math.random()*0.45,a:0.25+Math.random()*0.65});starsRef.current=arr}let alive=!0;const draw=ts=>{if(!alive)return;const dpr=Math.min(2,window.devicePixelRatio||1);const w=cvs.clientWidth||180,h=cvs.clientHeight||38;if(cvs.width!==Math.round(w*dpr)||cvs.height!==Math.round(h*dpr)){cvs.width=Math.round(w*dpr);cvs.height=Math.round(h*dpr)}ctx.save();ctx.scale(dpr,dpr);const bg=ctx.createLinearGradient(0,0,w,0);bg.addColorStop(0,"#050814");bg.addColorStop(0.55,"#0b1026");bg.addColorStop(1,"#130d24");ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);const cy=h/2,padL=18,padR=20,span=Math.max(20,w-padL-padR),tx=padL+span*ratio;const t=ts*0.001;const speed=0.4+ratio*2.2;for(const st of starsRef.current){const sx=((st.x-t*st.s*speed*0.18)%1+1)%1*w;const sy=st.y*h;ctx.fillStyle="rgba(220,235,255,"+st.a.toFixed(2)+")";ctx.beginPath();ctx.arc(sx,sy,st.r,0,Math.PI*2);ctx.fill()}const orbG=ctx.createRadialGradient(padL-2,cy,1,padL-2,cy,12);orbG.addColorStop(0,"#e0f2fe");orbG.addColorStop(0.35,"#38bdf8");orbG.addColorStop(1,"rgba(56,189,248,0)");ctx.fillStyle=orbG;ctx.beginPath();ctx.arc(padL-2,cy,12,0,Math.PI*2);ctx.fill();const beamW=Math.max(10,tx-padL+4);const outer=ctx.createLinearGradient(padL,cy,tx,cy);outer.addColorStop(0,"rgba(56,189,248,0.18)");outer.addColorStop(0.45,ratio>0.7?"rgba(168,85,247,0.58)":ratio>0.4?"rgba(245,158,11,0.52)":"rgba(52,211,153,0.48)");outer.addColorStop(1,ratio>0.7?"rgba(236,72,153,0.85)":"rgba(56,189,248,0.8)");ctx.fillStyle=outer;ctx.beginPath();ctx.roundRect(padL-2,cy-7.5,beamW,15,8);ctx.fill();const core=ctx.createLinearGradient(padL,cy,tx,cy);core.addColorStop(0,"rgba(186,230,253,0.55)");core.addColorStop(0.6,"rgba(255,255,255,0.88)");core.addColorStop(1,"#ffffff");ctx.fillStyle=core;ctx.beginPath();ctx.roundRect(padL,cy-2.4,beamW,4.8,3);ctx.fill();const streakCount=3+Math.round(ratio*4);ctx.lineWidth=1.1;for(let i=0;i<streakCount;i++){const phase=((t*speed*0.9+i/streakCount)%1);const lx=padL+phase*beamW;const len=10+ratio*16;const ly=cy+Math.sin(i*2.3+t*3)*5.2;ctx.strokeStyle="rgba(255,255,255,"+(0.28+0.45*(1-phase)).toFixed(2)+")";ctx.beginPath();ctx.moveTo(lx,ly);ctx.lineTo(Math.min(tx,lx+len),ly);ctx.stroke()}const cw=22,ch=15,cx=Math.max(padL,Math.min(w-padR,tx));const capG=ctx.createLinearGradient(cx,cy-ch/2,cx,cy+ch/2);capG.addColorStop(0,"#f8fafc");capG.addColorStop(0.45,"#94a3b8");capG.addColorStop(0.7,"#334155");capG.addColorStop(1,"#cbd5e1");ctx.fillStyle=capG;ctx.beginPath();ctx.roundRect(cx-cw/2,cy-ch/2,cw,ch,ch/2);ctx.fill();ctx.strokeStyle="rgba(255,255,255,0.8)";ctx.lineWidth=1;ctx.stroke();ctx.fillStyle="rgba(255,255,255,0.65)";ctx.beginPath();ctx.roundRect(cx-cw/2+3,cy-ch/2+2,cw-6,3.2,2);ctx.fill();ctx.restore();if(Date.now()<wakeUntilRef.current){rafRef.current=requestAnimationFrame(draw)}else{rafRef.current=0}};rafRef.current=requestAnimationFrame(draw);return()=>{alive=!1;if(rafRef.current)cancelAnimationFrame(rafRef.current)}},[ratio,dragIdx,selectedId]);const idxFromX=clientX=>{const el=boxRef.current;if(!el)return curIdx;const rect=el.getBoundingClientRect();const r=Math.max(0,Math.min(1,(clientX-rect.left-14)/Math.max(1,rect.width-28)));return Math.round(r*(count-1))};const commit=idx=>{wake(2000);const opt=options[idx];if(opt&&!disabled&&opt.id!==selectedId)onPick(opt.id)};const onPointerDown=ev=>{if(disabled)return;ev.preventDefault();wake(2500);try{ev.currentTarget.setPointerCapture(ev.pointerId)}catch{}const idx=idxFromX(ev.clientX);setDragIdx(idx);commit(idx)};const onPointerMove=ev=>{if(dragIdx===null||disabled)return;wake(2000);const idx=idxFromX(ev.clientX);if(idx!==dragIdx){setDragIdx(idx);commit(idx)}};const onPointerUp=ev=>{if(dragIdx===null)return;const idx=idxFromX(ev.clientX);setDragIdx(null);commit(idx);try{ev.currentTarget.releasePointerCapture(ev.pointerId)}catch{}};return(0,${jsxNs}.jsxs)("div",{className:"t3-cosmic-wrap",style:{"--t3-ef-c":tierColor},"data-quota-ui-managed":"true",onMouseEnter:()=>wake(2000),children:[(0,${jsxNs}.jsxs)("div",{className:"t3-cosmic-head",children:[(0,${jsxNs}.jsxs)("div",{children:[(0,${jsxNs}.jsxs)("div",{className:"t3-cosmic-title-row",children:[(0,${jsxNs}.jsx)("span",{className:"t3-cosmic-dot"}),(0,${jsxNs}.jsx)("span",{children:(zh?"推理强度 · ":"Reasoning · ")+shortLbl(activeOpt)})]}),(0,${jsxNs}.jsx)("div",{className:"t3-cosmic-sub",children:subTitle()})]}),(0,${jsxNs}.jsx)("span",{className:"t3-cosmic-tiers",children:zh?count+" 档":count+" tiers"})]}),(0,${jsxNs}.jsx)("div",{ref:boxRef,className:"t3-cosmic-canvas-box",onPointerDown,onPointerMove,onPointerUp,onPointerCancel:()=>setDragIdx(null),children:(0,${jsxNs}.jsx)("canvas",{ref:canvasRef,className:"t3-cosmic-canvas"})}),(0,${jsxNs}.jsx)("div",{className:"t3-cosmic-stops",style:{gridTemplateColumns:"repeat("+count+", minmax(0, 1fr))"},children:options.map((o,idx)=>(0,${jsxNs}.jsx)("button",{type:"button",role:"radio","aria-checked":idx===activeIdx,disabled,"data-effort-row":!0,"data-effort-level":!0,tabIndex:idx===activeIdx?0:-1,className:"t3-cosmic-stop",title:o.description||o.label,onClick:()=>commit(idx),children:shortLbl(o)},o.id))})]})}`;
      out += `\n${cosmicSliderFn}\n`;
    }
  }

  // 3. Session Stats Bar (`StardustSessionStatsBar.tsx`) is mounted natively in ChatView.tsx,
  //    so legacy `__T3TelemetryPill` injection is intentionally omitted here.

  return out;
}

function patchServerBundle(src) {
  let out = src;
  if (!out.includes('id: "custom_api"')) {
    out = out.replace(
      /usageLimits:\s*resetCredits\s*\?\s*\{\s*\.\.\.usageLimits,\s*resetCredits\s*\}\s*:\s*usageLimits/g,
      `usageLimits: resetCredits ? { ...usageLimits, resetCredits } : (customApiEndpoint && usageLimits.unavailable ? { checkedAt: usageCheckedAt, windows: [{ id: "custom_api", kind: "other", label: endpoint ? "API · " + endpoint.replace(/^https?:\\/\\//, "") : "Custom API", usedPercent: 0 }] } : usageLimits)`,
    );
  }
  return out;
}

function verifyJsFileSyntax(filePath) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "stardust-bundle-check-"));
  try {
    const ext = filePath.endsWith(".mjs") ? ".mjs" : ".mjs";
    const tmpFile = path.join(tmpDir, `check${ext}`);
    fs.copyFileSync(filePath, tmpFile);
    execFileSync(process.execPath, ["--check", tmpFile], { stdio: "pipe" });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

const modifiedFiles = [];

// 1. Copy stardust-enhancer.js into client/assets/
const enhancerTarget = path.join(clientAssetsDir, "stardust-enhancer.js");
fs.copyFileSync(enhancerSrcPath, enhancerTarget);
verifyJsFileSyntax(enhancerTarget);
modifiedFiles.push("client/assets/stardust-enhancer.js");

// 2. Patch index.html (Quota UI head block + stardust-enhancer.js script)
{
  const indexHtmlPath = path.join(clientDir, "index.html");
  let html = fs.readFileSync(indexHtmlPath, "utf8");
  html = html.replace(/<!-- T3_QUOTA_UI_START -->[\s\S]*?<!-- T3_QUOTA_UI_END -->\n?/g, "");
  html = html.replace(/<!-- T3_STARDUST_ENHANCER_START -->[\s\S]*?<!-- T3_STARDUST_ENHANCER_END -->\n?/g, "");
  html = html.replace("</head>", `${buildInjectedHeadBlock("zh")}\n  </head>`);
  const enhancerTag = `<!-- T3_STARDUST_ENHANCER_START -->\n    <script defer src="/assets/stardust-enhancer.js"></script>\n    <!-- T3_STARDUST_ENHANCER_END -->`;
  html = html.replace("</body>", `${enhancerTag}\n  </body>`);
  fs.writeFileSync(indexHtmlPath, html, "utf8");
  modifiedFiles.push("client/index.html");
}

// 3. Detect formatUsd export key & patch client JS bundles
const assetFiles = fs.readdirSync(clientAssetsDir).filter((f) => f.endsWith(".js") && f !== "stardust-enhancer.js");
let formatUsdExportKey = "u";
for (const file of assetFiles) {
  if (!file.startsWith("usageFormat-")) continue;
  const text = fs.readFileSync(path.join(clientAssetsDir, file), "utf8");
  const fnMatch = text.match(/function ([A-Za-z0-9_$]+)\([A-Za-z0-9_$]+,[A-Za-z0-9_$]+\)\{return [A-Za-z0-9_$]+\([A-Za-z0-9_$]+\([A-Za-z0-9_$]+\),!0\)\.format\(/);
  if (fnMatch) {
    const expMatch = text.match(new RegExp(`export\\{[^}]*\\b${fnMatch[1]} as ([A-Za-z0-9_$]+)`));
    if (expMatch) formatUsdExportKey = expMatch[1];
  }
}

for (const file of assetFiles) {
  const fullPath = path.join(clientAssetsDir, file);
  const orig = fs.readFileSync(fullPath, "utf8");
  let updated = orig;

  if (
    updated.includes("malformed or inconsistent usage record") &&
    updated.includes("minimumFractionDigits:2,maximumFractionDigits:2")
  ) {
    updated = patchUsageFormatBundle(updated);
  } else {
    if (
      updated.includes("grid-cols-[11rem_minmax(0,1fr)]") ||
      updated.includes("grid-cols-[8.5rem_minmax(0,1fr)]")
    ) {
      updated = patchUsageLimitsView(updated);
    }
    if (
      updated.includes("https://chatgpt.com/#settings/Usage") ||
      updated.includes("subscription_sharing_usage_limit_exceeded") ||
      updated.includes("totalPercentUsed")
    ) {
      updated = patchUsageLimitsShared(updated);
    }
    if (
      updated.includes("usage-page-preferences:v1") &&
      (updated.includes("Cost by type") || updated.includes("按类型费用"))
    ) {
      updated = patchChatUsageBundle(updated, formatUsdExportKey);
    }
    if (updated.includes("data-model-picker-sidebar") && updated.includes("Search models...")) {
      updated = patchModelPickerBundle(updated);
    }
    if (
      updated.includes("activeThreadEnvironmentId") &&
      updated.includes("workspace-topbar-height") &&
      updated.includes("changeSelect(")
    ) {
      updated = patchChatBundle(updated);
    }
  }

  if (updated !== orig) {
    fs.writeFileSync(fullPath, updated, "utf8");
    verifyJsFileSyntax(fullPath);
    modifiedFiles.push(`client/assets/${file}`);
  }
}

// 4. Patch server MJS chunks (custom Claude API endpoint visibility)
for (const file of fs.readdirSync(serverDistDir).filter((f) => f.endsWith(".mjs"))) {
  const fullPath = path.join(serverDistDir, file);
  const orig = fs.readFileSync(fullPath, "utf8");
  if (!orig.includes("customApiEndpoint")) continue;
  const updated = patchServerBundle(orig);
  if (updated !== orig) {
    fs.writeFileSync(fullPath, updated, "utf8");
    verifyJsFileSyntax(fullPath);
    modifiedFiles.push(file);
  }
}

console.log(`[patch-dist-bundle] Patched & syntax-verified ${modifiedFiles.length} bundle files in ${serverDistDir}:`);
for (const f of modifiedFiles) {
  console.log(`  - ${f}`);
}
