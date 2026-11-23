import { type ReactNode, useEffect, useRef, useState } from "react";
import { useUiText } from "~/i18n/useUiText";
import { observeResize } from "~/lib/observeResize";
import { cn } from "~/lib/utils";
import "./composerV9.css";
import {
  type StarshipParticle,
  type StarshipStoryBeat,
  createStarshipParticles,
  drawStarshipScene,
  prewarmStarshipParticles,
  sampleStarshipAccent,
  sampleStarshipFlash,
  starshipStoryAtRatio,
  stepStarshipParticles,
} from "./cosmicSliderScenes";

export interface CosmicEffortOption {
  readonly id: string;
  readonly label: string;
  readonly description?: string | undefined;
  readonly isDefault?: boolean | undefined;
}

// V18 Starship Launch Stack geometry: 50px canvas (+ 3px bevel = 56px track), 50x44 glass lens.
const TRACK_H = 50;
const PAD = 28;
const LENS_W = 50;
const LENS_H = 44;
const SNAP = 0.032;
// Idle open-popover repaint cadence (~24fps keeps fluid motion silky while staying light on GPU).
const IDLE_FRAME_MS = 1000 / 24;
// Auto-sleep the canvas loop after 2s of settled idle to drop idle GPU/CPU cost to zero.
const IDLE_SLEEP_MS = 2000;

/** Accent colour for the effort level, shared by the slider dot and composer model chip. */
export function cosmicColorAtRatio(ratio: number): string {
  return sampleStarshipAccent(ratio);
}

let sharedAudioCtx: AudioContext | null = null;
function playSubtleCosmicChime(ratio: number) {
  if (typeof window === "undefined") return;
  try {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const AudioCtor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return;
    if (!sharedAudioCtx) sharedAudioCtx = new AudioCtor();
    if (sharedAudioCtx.state === "suspended") void sharedAudioCtx.resume();
    const now = sharedAudioCtx.currentTime;
    const osc = sharedAudioCtx.createOscillator();
    const osc2 = sharedAudioCtx.createOscillator();
    const gain = sharedAudioCtx.createGain();
    osc.type = "sine";
    osc2.type = "triangle";
    const freq = 360 + ratio * 620;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.35, now + 0.045);
    osc2.frequency.setValueAtTime(freq * 1.5, now);
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.075);
    osc.connect(gain);
    osc2.connect(gain);
    gain.connect(sharedAudioCtx.destination);
    osc.start(now);
    osc2.start(now);
    osc.stop(now + 0.08);
    osc2.stop(now + 0.08);
  } catch {
    // Ignore audio context restrictions in headless/restricted environments.
  }
}

function applyShiftJuice(
  st: {
    hitstop: number;
    flash: number;
    shake: number;
    recoil: number;
    chroma: number;
    shock: number;
  },
  nextIdx: number,
  prevIdx: number,
): void {
  const up = nextIdx > prevIdx;
  if (up) {
    st.hitstop = 0.028;
    st.flash = 0.36;
    st.shake = 0.95;
    st.recoil = -5.5;
    st.chroma = 1;
    st.shock = 1;
  } else {
    st.hitstop = 0;
    st.flash = 0.1;
    st.shake = 0.22;
    st.recoil = 2.2;
    st.chroma = 0.3;
    st.shock = 0;
  }
}

/**
 * V18 "Starship Launch Stack" reasoning effort slider: one continuous cinematic Starship flight
 * from cold launchpad standby to deep-space warp with 180ms tactile upshift feedback. Level radios
 * are passed in as `children` and render under the track for keyboard and screen readers.
 */
export function CosmicEffortSlider(props: {
  readonly label: string;
  readonly options: ReadonlyArray<CosmicEffortOption>;
  readonly value: string | undefined;
  readonly disabled?: boolean;
  readonly onChange: (id: string) => void;
  readonly children?: ReactNode;
}) {
  const uiText = useUiText();
  const { options, value, disabled = false, onChange } = props;
  const wellRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<StarshipParticle[] | null>(null);

  const foundIndex = options.findIndex((o) => o.id === value);
  const selectedIndex = Math.max(0, foundIndex);
  const count = Math.max(1, options.length);
  const targetRatio = count <= 1 ? 0 : selectedIndex / (count - 1);

  const [dragging, setDragging] = useState(false);
  const [dragStory, setDragStory] = useState<StarshipStoryBeat | null>(null);

  const stateRef = useRef({
    val: targetRatio,
    target: targetRatio,
    dragging: false,
    lastIdx: selectedIndex,
    t: 2.4,
    hitstop: 0,
    flash: 0,
    shake: 0,
    recoil: 0,
    chroma: 0,
    shock: 0,
    lastIdlePaintMs: 0,
    lastActivityMs: 0,
    hasPainted: false,
  });

  const wakeLoopRef = useRef<(() => void) | null>(null);

  // Sync external selection changes into the spring target & upshift juice.
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- drives imperative Canvas 2D spring & shift juice when selection prop changes
  useEffect(() => {
    const st = stateRef.current;
    if (!st.dragging) {
      if (st.lastIdx !== selectedIndex) {
        applyShiftJuice(st, selectedIndex, st.lastIdx);
        st.lastIdx = selectedIndex;
      }
      st.target = targetRatio;
      wakeLoopRef.current?.();
    }
  }, [selectedIndex, targetRatio]);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- owns imperative Canvas 2D render loop & resize/visibility listeners
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (!offCanvasRef.current) offCanvasRef.current = document.createElement("canvas");
    const off = offCanvasRef.current;
    const octx = off.getContext("2d");
    if (!octx) return;

    if (!particlesRef.current) {
      const pool = createStarshipParticles(68);
      prewarmStarshipParticles(pool, stateRef.current.val);
      particlesRef.current = pool;
    }
    const particles = particlesRef.current;

    const reducedMotion =
      typeof window !== "undefined" &&
      Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);

    let raf = 0;
    let lastTs = performance.now();

    const drawFrame = (now: number) => {
      if (typeof document !== "undefined" && document.hidden) {
        raf = 0;
        canvas.dataset.renderState = "sleeping";
        return;
      }

      // Use untransformed layout clientWidth so CSS scale() popover open animations never resize/clear the canvas.
      const layoutW = wrap.clientWidth;
      if (layoutW < 2) {
        raf = 0;
        return;
      }

      const st = stateRef.current;
      const activeMotion =
        st.dragging ||
        st.hitstop > 0 ||
        st.flash > 0.01 ||
        st.shake > 0.02 ||
        Math.abs(st.recoil) > 0.08 ||
        st.chroma > 0.01 ||
        st.shock > 0.01 ||
        Math.abs(st.target - st.val) > 0.001;

      if (activeMotion) {
        st.lastActivityMs = now;
      } else if (!reducedMotion && st.hasPainted && now - st.lastActivityMs >= IDLE_SLEEP_MS) {
        // Settled & idle for 2s: stop scheduling frames until the user interacts again.
        raf = 0;
        canvas.dataset.renderState = "sleeping";
        return;
      }

      const cssW = Math.max(120, Math.min(720, Math.round(layoutW)));
      const cssH = TRACK_H;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const cw = Math.round(cssW * dpr);
      const ch = Math.round(cssH * dpr);
      const needsResize = canvas.width !== cw || canvas.height !== ch;

      if (
        !reducedMotion &&
        !activeMotion &&
        !needsResize &&
        st.hasPainted &&
        now - st.lastIdlePaintMs < IDLE_FRAME_MS
      ) {
        raf = window.requestAnimationFrame(drawFrame);
        return;
      }

      const dt = Math.min(0.05, Math.max(0.001, (now - lastTs) / 1000));
      lastTs = now;
      st.lastIdlePaintMs = now;

      if (needsResize) {
        canvas.width = cw;
        canvas.height = ch;
        off.width = cw;
        off.height = ch;
      }

      if (reducedMotion) {
        st.val = st.target;
        st.hitstop = 0;
        st.flash = 0;
        st.shake = 0;
        st.recoil = 0;
        st.chroma = 0;
        st.shock = 0;
      } else if (st.hitstop > 0) {
        st.hitstop = Math.max(0, st.hitstop - dt);
      } else {
        st.t += dt;
        st.val += (st.target - st.val) * (st.dragging ? 0.45 : 0.24);
        if (Math.abs(st.target - st.val) < 0.0005) st.val = st.target;
        st.flash = Math.max(0, st.flash - dt * 4.6);
        st.shake = Math.max(0, st.shake - dt * 6.4);
        st.recoil *= Math.pow(0.0008, dt);
        if (Math.abs(st.recoil) < 0.05) st.recoil = 0;
        st.chroma = Math.max(0, st.chroma - dt * 7.2);
        st.shock = Math.max(0, st.shock - dt * 4.5);
      }

      const well = wellRef.current;
      if (well) {
        if (!reducedMotion && st.shake > 0.02) {
          const dx = (Math.sin(now * 0.095) * 1.7 * st.shake).toFixed(2);
          const dy = (Math.cos(now * 0.13) * 1.2 * st.shake).toFixed(2);
          well.style.transform = `translate3d(${dx}px,${dy}px,0)`;
        } else if (well.style.transform) {
          well.style.transform = "";
        }
      }

      const kx = PAD + st.val * (cssW - PAD * 2) + st.recoil;
      const ky = cssH / 2;

      octx.setTransform(dpr, 0, 0, dpr, 0, 0);
      octx.clearRect(0, 0, cssW, cssH);
      const { nx, ny, angle } = drawStarshipScene(
        octx,
        cssW,
        cssH,
        st.val,
        kx,
        st.t,
        particles,
        st.shock,
      );
      if (!reducedMotion && st.hitstop <= 0) {
        stepStarshipParticles(particles, dt, st.val, nx, ny, angle, cssW);
      }

      // Detent dots along the lower rim, one per level.
      for (let i = 0; i < count; i++) {
        const dx = count <= 1 ? cssW / 2 : PAD + (i / (count - 1)) * (cssW - PAD * 2);
        octx.fillStyle = i <= st.lastIdx ? "rgba(255,255,255,0.88)" : "rgba(255,255,255,0.24)";
        octx.beginPath();
        octx.arc(dx, cssH - 4.2, i === st.lastIdx ? 1.8 : 1, 0, Math.PI * 2);
        octx.fill();
      }

      // Single-frame upshift exposure flash.
      if (!reducedMotion && st.flash > 0.01) {
        octx.save();
        octx.fillStyle = sampleStarshipFlash(st.val);
        octx.globalAlpha = st.flash;
        octx.fillRect(0, 0, cssW, cssH);
        octx.restore();
      }

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, cw, ch);
      ctx.drawImage(off, 0, 0);

      // Crystal-clear Liquid Glass capsule lens (thin rim highlight keeps the Starship sharp).
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const kw = LENS_W + st.chroma * 3;
      const kh = LENS_H - st.chroma * 1.4;
      const kr = kh / 2;

      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.42)";
      ctx.shadowBlur = st.dragging ? 14 : 9;
      ctx.shadowOffsetY = 2.5;
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.beginPath();
      ctx.roundRect(kx - kw / 2, ky - kh / 2, kw, kh, kr);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.beginPath();
      ctx.roundRect(kx - kw / 2, ky - kh / 2, kw, kh, kr);
      ctx.clip();
      const mag = st.dragging ? 1.32 : 1.22;
      const sw = (kw / mag) * dpr;
      const sh = (kh / mag) * dpr;
      const sx = Math.max(0, Math.min(cw - sw, kx * dpr - sw / 2));
      const sy = Math.max(0, Math.min(ch - sh, ky * dpr - sh / 2));
      ctx.drawImage(off, sx, sy, sw, sh, kx - kw / 2, ky - kh / 2, kw, kh);

      const disp = 1.2 + st.chroma * 2.6;
      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha = 0.18 + st.chroma * 0.25;
      ctx.drawImage(
        off,
        Math.max(0, sx - disp * dpr),
        sy,
        sw,
        sh,
        kx - kw / 2 - disp,
        ky - kh / 2,
        kw,
        kh,
      );
      ctx.drawImage(
        off,
        Math.min(cw - sw, sx + disp * dpr),
        sy,
        sw,
        sh,
        kx - kw / 2 + disp,
        ky - kh / 2,
        kw,
        kh,
      );
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;

      const gg = ctx.createLinearGradient(kx, ky - kh / 2, kx, ky + kh / 2);
      gg.addColorStop(0, "rgba(255,255,255,0.34)");
      gg.addColorStop(0.2, "rgba(255,255,255,0.02)");
      gg.addColorStop(0.84, "rgba(255,255,255,0.01)");
      gg.addColorStop(1, "rgba(255,255,255,0.22)");
      ctx.fillStyle = gg;
      ctx.fillRect(kx - kw / 2, ky - kh / 2, kw, kh);
      ctx.fillStyle = "rgba(255,255,255,0.68)";
      ctx.beginPath();
      ctx.ellipse(kx - 2, ky - kh * 0.36, kw * 0.28, kh * 0.06, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      const rg = ctx.createLinearGradient(kx, ky - kh / 2, kx, ky + kh / 2);
      rg.addColorStop(0, "rgba(255,255,255,0.92)");
      rg.addColorStop(0.5, "rgba(255,255,255,0.28)");
      rg.addColorStop(1, sampleStarshipAccent(st.val));
      ctx.strokeStyle = rg;
      ctx.lineWidth = st.dragging || st.chroma > 0.2 ? 1.8 : 1.3;
      ctx.beginPath();
      ctx.roundRect(kx - kw / 2 + 0.65, ky - kh / 2 + 0.65, kw - 1.3, kh - 1.3, kr);
      ctx.stroke();
      ctx.restore();

      st.hasPainted = true;
      canvas.dataset.renderState = reducedMotion ? "sleeping" : "active";
      raf = reducedMotion ? 0 : window.requestAnimationFrame(drawFrame);
    };

    const wake = () => {
      const now = performance.now();
      stateRef.current.lastActivityMs = now;
      canvas.dataset.renderState = reducedMotion ? "sleeping" : "active";
      if (!raf) {
        lastTs = now;
        raf = window.requestAnimationFrame(drawFrame);
      }
    };

    const onVisibilityChange = () => {
      if (!document.hidden) wake();
    };

    wakeLoopRef.current = wake;
    wake();
    const stopObserve = observeResize(wrap, wake);
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibilityChange);
    }

    return () => {
      wakeLoopRef.current = null;
      if (raf) window.cancelAnimationFrame(raf);
      if (wellRef.current) wellRef.current.style.transform = "";
      stopObserve();
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibilityChange);
      }
    };
  }, [count]);

  const pointerToIndex = (clientX: number): { ratio: number; idx: number } => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || count <= 1) return { ratio: targetRatio, idx: selectedIndex };
    let raw = Math.max(
      0,
      Math.min(1, (clientX - rect.left - PAD) / Math.max(20, rect.width - PAD * 2)),
    );
    for (let i = 0; i < count; i++) {
      const det = i / (count - 1);
      if (Math.abs(raw - det) < SNAP) {
        raw = det;
        break;
      }
    }
    return { ratio: raw, idx: Math.round(raw * (count - 1)) };
  };

  const commitIndex = (idx: number, withSound = true) => {
    const opt = options[idx];
    if (!opt || disabled) return;
    if (opt.id !== value) {
      if (withSound) playSubtleCosmicChime(count <= 1 ? 0 : idx / (count - 1));
      onChange(opt.id);
    }
  };

  const activeOpt = foundIndex >= 0 ? options[foundIndex] : undefined;
  const activeColor = sampleStarshipAccent(targetRatio);
  const levelLabel = activeOpt?.label ?? props.label;
  const storyKey = dragStory ?? starshipStoryAtRatio(targetRatio);

  return (
    <div
      data-cosmic-effort-slider
      data-cosmic-scene="starship"
      className={cn(disabled && "opacity-60")}
      onPointerEnter={() => wakeLoopRef.current?.()}
      onFocus={() => wakeLoopRef.current?.()}
    >
      <div data-cosmic-embed-head>
        <b>
          <span
            aria-hidden="true"
            data-cosmic-state-dot
            style={{ background: activeColor, boxShadow: `0 0 8px ${activeColor}` }}
          />
          <span className="truncate" data-cosmic-level-heading>
            {uiText("Reasoning effort · {level}", { level: uiText(levelLabel) })}
          </span>
        </b>
      </div>
      <div data-cosmic-sub-row>
        <span key={storyKey} className="truncate" data-cosmic-story={storyKey}>
          {uiText(storyKey)}
        </span>
        <span className="shrink-0 tabular-nums" data-cosmic-stage>
          {uiText("{count} levels", { count })}
        </span>
      </div>

      <div ref={wellRef} data-cosmic-stage-well>
        <div
          ref={wrapRef}
          role="slider"
          tabIndex={-1}
          aria-label={props.label}
          aria-valuemin={0}
          aria-valuemax={count - 1}
          aria-valuenow={selectedIndex}
          aria-valuetext={activeOpt?.label}
          aria-disabled={disabled || undefined}
          data-cosmic-track
          className={cn(
            disabled ? "pointer-events-none" : dragging ? "cursor-grabbing" : "cursor-grab",
          )}
          onPointerDown={(event) => {
            if (disabled || event.button !== 0) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            setDragging(true);
            stateRef.current.dragging = true;
            const { ratio, idx } = pointerToIndex(event.clientX);
            stateRef.current.target = ratio;
            stateRef.current.val = ratio;
            setDragStory(starshipStoryAtRatio(ratio));
            wakeLoopRef.current?.();
            if (idx !== stateRef.current.lastIdx) {
              applyShiftJuice(stateRef.current, idx, stateRef.current.lastIdx);
              stateRef.current.lastIdx = idx;
              commitIndex(idx, true);
            }
          }}
          onPointerMove={(event) => {
            if (!stateRef.current.dragging || disabled) return;
            const { ratio, idx } = pointerToIndex(event.clientX);
            stateRef.current.target = ratio;
            const nextStory = starshipStoryAtRatio(ratio);
            setDragStory((prev) => (prev === nextStory ? prev : nextStory));
            if (idx !== stateRef.current.lastIdx) {
              applyShiftJuice(stateRef.current, idx, stateRef.current.lastIdx);
              stateRef.current.lastIdx = idx;
              commitIndex(idx, true);
            }
          }}
          onPointerUp={() => {
            if (!stateRef.current.dragging) return;
            stateRef.current.dragging = false;
            setDragging(false);
            setDragStory(null);
            const idx = Math.round(stateRef.current.target * (count - 1));
            stateRef.current.target = count <= 1 ? 0 : idx / (count - 1);
            commitIndex(idx, false);
            wakeLoopRef.current?.();
          }}
          onPointerCancel={() => {
            if (!stateRef.current.dragging) return;
            stateRef.current.dragging = false;
            setDragging(false);
            setDragStory(null);
            stateRef.current.target = targetRatio;
            wakeLoopRef.current?.();
          }}
        >
          <canvas
            ref={canvasRef}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 block size-full rounded-full"
          />
        </div>
      </div>
      {props.children}
    </div>
  );
}
