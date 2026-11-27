/**
 * T3星辰版 Built-in Enhancer Suite v3.3.0 (Desktop Electron + Web + Installed PWA)
 *
 * Built-in port of `t3-web-enhancer.user.js` (5ec2f7e0):
 *  1) Telegram-style Left Vertical Project Folder Rail (68px, pinned divider, dual-color live badges)
 *  2) Multi-surface Task Completion / Needs-Confirmation Notifications + 0-refresh Direct Jump
 *     (OS Desktop Notification with 16-char FNV-1a tag + Top-Center Dynamic Island Toast + Soft Audio Chime
 *      + Electron/PWA Taskbar Badge + Left-Rail Bell Inbox)
 *  3) Turn-Fold & Live Working Row Model + Token Usage Pills
 *  4) Web Context Menu "Filter by Project" auto-pinned to #1 + Hi-Res Vinyl Glass Audio Preview Deck CSS
 */
(() => {
  'use strict';

  const initEnhancer = () => {
    if (window.__T3_WEB_ENHANCER_CLEANUP__) {
      try {
        window.__T3_WEB_ENHANCER_CLEANUP__();
      } catch {}
    }

    const RAIL_WIDTH = 68;
    const NOTIF_PREF_KEY = 't3code:web-enhancer:notify:v1';
    const IS_ELECTRON = Boolean(window.desktopBridge);

    const MODEL_NAMES = {
      'gemini-4-carbon': 'Gemini 4 Carbon',
      'gemini-4-neon': 'Gemini 4 Neon',
      'gemini-4-argon': 'Gemini 4 Argon',
      'claude-opus-4-7': 'Claude Opus 4.7',
      'claude-opus-4-6': 'Claude Opus 4.6',
      'claude-sonnet-4-6': 'Claude Sonnet 4.6',
      'gpt-5.4': 'GPT-5.4',
      'gpt-5.3-codex': 'GPT-5.3 Codex',
    };

    const EFFORT_NAMES = {
      minimal: 'Minimal',
      low: 'Low',
      medium: 'Medium',
      high: 'High',
      xhigh: 'XHigh',
      max: 'Max',
      ultrathink: 'Ultrathink',
    };

    const COLOR_MAP = {
      emerald: '#10b981',
      green: '#22c55e',
      lime: '#84cc16',
      teal: '#14b8a6',
      cyan: '#06b6d4',
      sky: '#38bdf8',
      blue: '#3b82f6',
      indigo: '#6366f1',
      violet: '#8b5cf6',
      purple: '#a855f7',
      fuchsia: '#d946ef',
      pink: '#ec4899',
      rose: '#f43f5e',
      red: '#ef4444',
      orange: '#f97316',
      amber: '#f59e0b',
      yellow: '#eab308',
      gray: '#94a3b8',
    };

    const FALLBACK_PALETTE = [
      'sky',
      'emerald',
      'purple',
      'amber',
      'rose',
      'cyan',
      'lime',
      'indigo',
      'orange',
      'teal',
      'pink',
      'blue',
    ];

    const LUCIDE_SVGS = {
      all: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 9h8"/><path d="M8 13h5"/>',
      'folder-code':
        '<path d="M10 10.5 8 13l2 2.5"/><path d="m14 10.5 2 2.5-2 2.5"/><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z"/>',
      server:
        '<rect width="20" height="8" x="2" y="2" rx="2" ry="2"/><rect width="20" height="8" x="2" y="14" rx="2" ry="2"/><line x1="6" x2="6.01" y1="6" y2="6"/><line x1="6" x2="6.01" y1="18" y2="18"/>',
      'message-square-dashed':
        '<path d="M10 17H7l-4 4v-7"/><path d="M14 17h1"/><path d="M14 3h1"/><path d="M19 3a2 2 0 0 1 2 2"/><path d="M21 14v1a2 2 0 0 1-2 2"/><path d="M21 9v1"/><path d="M3 9v1"/><path d="M5 3a2 2 0 0 0-2 2"/><path d="M9 3h1"/>',
      folder:
        '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
      code: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
      terminal: '<polyline points="4 17 10 11 4 5"/><line x1="12" x2="20" y1="19" y2="19"/>',
      globe:
        '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
      cpu: '<rect width="16" height="16" x="4" y="4" rx="2"/><rect width="6" height="6" x="9" y="9" rx="1"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/>',
      database:
        '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/>',
      'book-open':
        '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
      music:
        '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
      video:
        '<path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5"/><rect x="2" y="6" width="14" height="12" rx="2"/>',
      archive:
        '<rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/>',
      sparkles:
        '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>',
      'sliders-horizontal':
        '<line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><line x1="14" x2="14" y1="2" y2="6"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="16" x2="16" y1="18" y2="22"/>',
      'folder-plus':
        '<path d="M12 10v6"/><path d="M9 13h6"/><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
      bell: '<path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/>',
      'bell-off':
        '<path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M17 17H4a1 1 0 0 1-.74-1.673C4.59 13.956 6 12.499 6 8a6 6 0 0 1 .258-1.742"/><path d="m2 2 20 20"/><path d="M8.668 3.01A6 6 0 0 1 18 8c0 2.687.77 4.653 1.707 6.05"/>',
      'check-circle':
        '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
      'alert-circle':
        '<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>',
      'arrow-up-right':
        '<path d="M7 7h10v10"/><path d="M7 17 17 7"/>',
      x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    };

    function svgIcon(name, size = 16) {
      const inner = LUCIDE_SVGS[name] || LUCIDE_SVGS.folder;
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
    }

    function hashString(str) {
      let h = 2166136261;
      for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      return h >>> 0;
    }

    /** 16-char FNV-1a 64-bit tag matching official threadNotifications.ts so Windows never drops 73-char tags */
    function threadTag16(environmentId, threadId) {
      const key = `${environmentId}:${threadId}`;
      let hash = 0xcbf29ce484222325n;
      const prime = 0x100000001b3n;
      const mask = 0xffffffffffffffffn;
      for (let i = 0; i < key.length; i++) {
        hash ^= BigInt(key.charCodeAt(i));
        hash = (hash * prime) & mask;
      }
      return hash.toString(16).padStart(16, '0');
    }

    function pickMonogramGlyph(title) {
      if (!title) return 'P';
      const cleaned = title.trim();
      const first = [...cleaned][0] || 'P';
      if (/^[a-z]$/i.test(first)) {
        const two = cleaned.slice(0, 2);
        return /^[a-z]{2}$/i.test(two) ? two.toUpperCase() : first.toUpperCase();
      }
      return first;
    }

    function shortRailLabel(label) {
      if (!label) return '';
      if (label === 'No project' || label === '无项目') return '未归类';
      if (label === 'Downloads') return '下载';
      if (label === 'Dropbox下载') return 'Dropbox';
      return label;
    }

    function fmtTok(n) {
      if (typeof n !== 'number' || !Number.isFinite(n)) return null;
      if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2).replace(/\.?0+$/, '')}M`;
      if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
      return String(Math.round(n));
    }

    function fmtDuration(startedAt, completedAt) {
      if (!startedAt) return '';
      const t0 = Date.parse(startedAt);
      const t1 = completedAt ? Date.parse(completedAt) : Date.now();
      if (!Number.isFinite(t0) || !Number.isFinite(t1) || t1 <= t0) return '';
      const sec = Math.max(1, Math.round((t1 - t0) / 1000));
      if (sec < 60) return `${sec}s`;
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      if (m < 60) return s > 0 ? `${m}m ${s}s` : `${m}m`;
      const h = Math.floor(m / 60);
      return `${h}h ${m % 60}m`;
    }

    function fmtClockTime(ts) {
      try {
        const d = new Date(ts);
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      } catch {
        return '';
      }
    }

    function formatModelLabel(run) {
      if (!run) return null;
      const rawSlug = run.executedModel || run.modelSelection?.model || run.model || null;
      if (!rawSlug) return null;
      const base = MODEL_NAMES[rawSlug] || rawSlug;
      const opts = Array.isArray(run.modelSelection?.options) ? run.modelSelection.options : [];
      const effortOpt = opts.find(
        (o) => o && (o.id === 'thought_level' || o.id === 'effort' || o.id === 'reasoningEffort')
      );
      const rawEffort = effortOpt?.value ? String(effortOpt.value) : null;
      const effort = rawEffort ? EFFORT_NAMES[rawEffort.toLowerCase()] || rawEffort : null;
      return effort ? `${base} (${effort})` : base;
    }

    // ==================== Notification Preferences & Audio Chime ====================
    function loadNotifPrefs() {
      const defaults = {
        enabled: true,
        osBanner: true,
        inAppToast: true,
        sound: true,
      };
      try {
        const raw = localStorage.getItem(NOTIF_PREF_KEY);
        if (!raw) return defaults;
        return { ...defaults, ...JSON.parse(raw) };
      } catch {
        return defaults;
      }
    }

    let notifPrefs = loadNotifPrefs();

    function saveNotifPrefs() {
      try {
        localStorage.setItem(NOTIF_PREF_KEY, JSON.stringify(notifPrefs));
      } catch {}
    }

    let sharedAudioCtx = null;
    function getAudioCtx() {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      if (!sharedAudioCtx) {
        try {
          sharedAudioCtx = new Ctx();
        } catch {
          return null;
        }
      }
      if (sharedAudioCtx.state === 'suspended') {
        sharedAudioCtx.resume().catch(() => {});
      }
      return sharedAudioCtx;
    }

    if (IS_ELECTRON) {
      getAudioCtx();
    } else {
      const unlockAudioOnce = () => {
        getAudioCtx();
      };
      window.addEventListener('pointerdown', unlockAudioOnce, { once: true, passive: true });
      window.addEventListener('keydown', unlockAudioOnce, { once: true, passive: true });
    }

    function playNotificationChime(kind = 'completed') {
      if (!notifPrefs.enabled || !notifPrefs.sound) return;
      const ctx = getAudioCtx();
      if (!ctx) return;
      try {
        const now = ctx.currentTime;
        const notes =
          kind === 'failed'
            ? [
                { freq: 440, start: 0, dur: 0.14, gain: 0.09 },
                { freq: 349.23, start: 0.11, dur: 0.2, gain: 0.09 },
              ]
            : kind === 'attention'
              ? [
                  { freq: 587.33, start: 0, dur: 0.12, gain: 0.09 },
                  { freq: 783.99, start: 0.1, dur: 0.12, gain: 0.09 },
                  { freq: 987.77, start: 0.2, dur: 0.22, gain: 0.1 },
                ]
              : [
                  { freq: 587.33, start: 0, dur: 0.16, gain: 0.095 },
                  { freq: 880.0, start: 0.1, dur: 0.28, gain: 0.11 },
                ];

        for (const n of notes) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(n.freq, now + n.start);
          gain.gain.setValueAtTime(0.0001, now + n.start);
          gain.gain.linearRampToValueAtTime(n.gain, now + n.start + 0.015);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + n.start + n.dur);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + n.start);
          osc.stop(now + n.start + n.dur + 0.02);
        }
      } catch {}
    }

    const iconCache = new Map();
    function buildOsNotificationIcon(colorHex = '#10b981', kind = 'completed') {
      const key = `${colorHex}:${kind}`;
      if (iconCache.has(key)) return iconCache.get(key);
      try {
        const c = document.createElement('canvas');
        c.width = 128;
        c.height = 128;
        const g = c.getContext('2d');
        g.fillStyle = '#0f172a';
        g.beginPath();
        g.roundRect(8, 8, 112, 112, 28);
        g.fill();

        g.fillStyle = colorHex;
        g.beginPath();
        g.arc(64, 64, 34, 0, Math.PI * 2);
        g.fill();

        g.strokeStyle = '#ffffff';
        g.lineWidth = 8;
        g.lineCap = 'round';
        g.lineJoin = 'round';
        g.beginPath();
        if (kind === 'failed') {
          g.moveTo(64, 48);
          g.lineTo(64, 68);
          g.moveTo(64, 80);
          g.lineTo(64.1, 80);
        } else {
          g.moveTo(49, 65);
          g.lineTo(59, 75);
          g.lineTo(80, 54);
        }
        g.stroke();

        const url = c.toDataURL('image/png');
        iconCache.set(key, url);
        return url;
      } catch {
        return undefined;
      }
    }

    function buildWindowsOverlayBadge(count) {
      if (count <= 0) return null;
      try {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 64;
        const context = canvas.getContext('2d');
        if (!context) return null;
        context.fillStyle = '#10b981';
        context.beginPath();
        context.arc(32, 32, 28, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = '#ffffff';
        context.font = `600 ${count > 9 ? 30 : 40}px "Segoe UI", sans-serif`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(count > 9 ? '9+' : String(count), 32, 34);
        return canvas.toDataURL('image/png');
      } catch {
        return null;
      }
    }

    // ==================== Router & Direct Thread Jump ====================
    function findTanStackRouter() {
      const rootEl = document.getElementById('root');
      if (!rootEl) return null;
      const rfk = Object.keys(rootEl).find(
        (k) => k.startsWith('__reactContainer$') || k.startsWith('__reactFiber$')
      );
      if (!rfk) return null;
      const q = [rootEl[rfk]];
      let seen = 0;
      while (q.length && seen < 350) {
        const n = q.shift();
        if (!n) continue;
        seen++;
        const mp = n.memoizedProps;
        if (mp?.router && typeof mp.router.navigate === 'function') return mp.router;
        if (mp?.value?.router && typeof mp.value.router.navigate === 'function') return mp.value.router;
        if (n.child) q.push(n.child);
        if (n.sibling) q.push(n.sibling);
      }
      return null;
    }

    const notifHistory = [];
    const activeOsNotifs = new Map();
    let baseDocTitle = document.title.replace(/^\(\d+\s*条待查看\)\s*/, '');

    function syncUnreadBadgesAndTitle() {
      const unreadCount = notifHistory.filter((n) => n.unread).length;

      // 1. Update Taskbar Icon Badge (Desktop Electron + Installed PWA)
      try {
        if (window.desktopBridge?.setNotificationBadge) {
          const image = unreadCount > 0 ? buildWindowsOverlayBadge(unreadCount) : null;
          window.desktopBridge.setNotificationBadge({ count: unreadCount, image }).catch(() => {});
        } else if (unreadCount > 0 && typeof navigator.setAppBadge === 'function') {
          navigator.setAppBadge(unreadCount).catch(() => {});
        } else if (unreadCount === 0 && typeof navigator.clearAppBadge === 'function') {
          navigator.clearAppBadge().catch(() => {});
        }
      } catch {}

      // 2. Update Window / Tab title prefix
      const cleanCurrent = document.title.replace(/^\(\d+\s*条待查看\)\s*/, '');
      if (cleanCurrent) baseDocTitle = cleanCurrent;
      const targetTitle = unreadCount > 0 ? `(${unreadCount} 条待查看) ${baseDocTitle}` : baseDocTitle;
      if (targetTitle && document.title !== targetTitle) {
        document.title = targetTitle;
      }

      // 3. Refresh left rail & open popover
      lastRailSignature = '';
      renderProjectRail();
      if (document.getElementById('t3-notif-popover')?.getAttribute('data-open') === '1') {
        renderNotifPopoverContent();
      }
    }

    function markThreadNotificationsRead(threadId) {
      if (!threadId) return;
      let changed = false;
      for (const n of notifHistory) {
        if (n.threadId === threadId && n.unread) {
          n.unread = false;
          changed = true;
        }
      }
      const osN = activeOsNotifs.get(threadId);
      if (osN) {
        try {
          osN.close();
        } catch {}
        activeOsNotifs.delete(threadId);
      }
      if (changed) syncUnreadBadgesAndTitle();
    }

    function jumpToTask(environmentId, threadId, projectValue) {
      if (!environmentId || !threadId) return;
      try {
        window.focus();
      } catch {}

      const ctx = findSidebarState() || latestSidebarCtx;
      if (ctx?.cbProps) {
        const curVal = ctx.cbProps.value;
        const curKey = !Array.isArray(curVal) ? curVal?.value : null;
        if (curKey && curKey !== 'all' && projectValue && curKey !== projectValue) {
          invokeProjectSelection(projectValue, new MouseEvent('click'));
        }
      }

      const targetPath = `/${environmentId}/${threadId}`;
      const router = findTanStackRouter();
      if (router) {
        Promise.resolve(router.navigate({ to: targetPath })).then(() => {
          setTimeout(() => {
            const row = document.querySelector(`[data-sidebar-row="${environmentId}:${threadId}"]`);
            row?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
          }, 120);
        });
      } else {
        window.location.assign(targetPath);
      }

      markThreadNotificationsRead(threadId);
      closeNotifPopover();
    }

    // ==================== React Fiber Readers ====================
    function findProjectionFromDom() {
      const anchor =
        document.querySelector('[data-timeline-row-kind="turn-fold"]') ||
        document.querySelector('[data-timeline-row-kind="working"]') ||
        document.querySelector('[data-timeline-root="true"]');
      if (!anchor) return null;

      const fk = Object.keys(anchor).find((k) => k.startsWith('__reactFiber$'));
      if (!fk) return null;

      let cur = anchor[fk];
      let projection = null;
      let latestRunId = null;
      let depth = 0;

      while (cur && depth < 75) {
        const mp = cur.memoizedProps;
        if (mp?.value && typeof mp.value === 'object' && 'latestRunId' in mp.value && !latestRunId) {
          latestRunId = mp.value.latestRunId;
        }
        let st = cur.memoizedState;
        let h = 0;
        while (st && h < 45) {
          const ms = st.memoizedState;
          if (ms && typeof ms === 'object' && ms.projection?.runs && ms.projection?.providerTurns) {
            projection = ms.projection;
            break;
          }
          st = st.next;
          h++;
        }
        if (projection) break;
        cur = cur.return;
        depth++;
      }

      return projection ? { projection, latestRunId } : null;
    }

    function findSidebarState() {
      const sidebar = document.querySelector('[data-slot="sidebar"]');
      if (!sidebar) return null;

      const triggerBtn = sidebar.querySelector('[data-slot="combobox-trigger"]');
      if (!triggerBtn) return null;

      const fk = Object.keys(triggerBtn).find((k) => k.startsWith('__reactFiber$'));
      if (!fk) return null;

      let cur = triggerBtn[fk];
      let cbProps = null;
      let pvProps = null;
      let projects = null;
      let threads = null;
      let d = 0;

      while (cur && d < 42) {
        const mp = cur.memoizedProps;
        if (mp && Array.isArray(mp.items) && typeof mp.onValueChange === 'function') {
          cbProps = mp;
        }
        if (mp && 'projectScope' in mp && typeof mp.onNewThread === 'function' && !pvProps) {
          pvProps = mp;
        }

        let st = cur.memoizedState;
        let hi = 0;
        while (st && hi < 55) {
          const ms = st.memoizedState;
          if (Array.isArray(ms) && ms.length > 0 && ms[0] && typeof ms[0] === 'object') {
            const k0 = Object.keys(ms[0]);
            if (!projects && k0.includes('workspaceRoot') && k0.includes('id')) {
              projects = ms;
            } else if (!threads && k0.includes('projectId') && k0.includes('environmentId')) {
              threads = ms;
            }
          }
          st = st.next;
          hi++;
        }

        cur = cur.return;
        d++;
      }

      if (!cbProps) return null;
      return { sidebar, triggerBtn, cbProps, pvProps, projects: projects || [], threads: threads || [] };
    }

    function matchProjectRecord(item, projects) {
      if (!item || !projects?.length) return null;
      const valLower = String(item.value || '').toLowerCase();
      for (const p of projects) {
        if (!p || p.deletedAt || p.archivedAt) continue;
        if (p.repositoryIdentity?.canonicalKey && p.repositoryIdentity.canonicalKey === item.value) {
          return p;
        }
        if (p.workspaceRoot && valLower.endsWith(':' + String(p.workspaceRoot).toLowerCase())) {
          return p;
        }
      }
      return projects.find((p) => p && !p.deletedAt && p.title === item.label) || null;
    }

    function resolveProjectVisual(projectId, projects, cbItems) {
      const p = projects.find((x) => x && x.id === projectId) || null;
      const projectTitle = p?.title || '未归类';
      const iconObj = p?.projectIcon || null;
      const colorKey =
        (iconObj?.color && COLOR_MAP[iconObj.color] ? iconObj.color : null) ||
        FALLBACK_PALETTE[hashString(p?.id || projectTitle) % FALLBACK_PALETTE.length];
      const colorHex = COLOR_MAP[colorKey] || COLOR_MAP.emerald;

      let projectValue = null;
      if (p && Array.isArray(cbItems)) {
        const hit = cbItems.find((it) => {
          if (!it || it.value === 'all' || it.value === 'add-project') return false;
          if (p.repositoryIdentity?.canonicalKey && it.value === p.repositoryIdentity.canonicalKey) return true;
          if (p.workspaceRoot && String(it.value).toLowerCase().endsWith(':' + String(p.workspaceRoot).toLowerCase())) {
            return true;
          }
          return it.label === p.title;
        });
        projectValue = hit?.value || null;
      }
      return { projectTitle, projectValue, colorHex };
    }

    function computeProjectStats(projects, threads) {
      const byProjectId = new Map();
      let totalActive = 0;
      let totalRunning = 0;

      for (const t of threads) {
        if (!t || t.deletedAt || t.archivedAt || t.settledAt) continue;
        if (t.lineage?.parentThreadId) continue;

        const isRunning =
          t.latestRun?.status === 'running' ||
          t.latestRun?.status === 'starting' ||
          t.runtime?.activeRunId != null ||
          Boolean(t.hasPendingApprovals) ||
          Boolean(t.hasPendingUserInput);

        totalActive++;
        if (isRunning) totalRunning++;

        if (t.projectId) {
          let rec = byProjectId.get(t.projectId);
          if (!rec) {
            rec = { active: 0, running: 0 };
            byProjectId.set(t.projectId, rec);
          }
          rec.active++;
          if (isRunning) rec.running++;
        }
      }

      return { byProjectId, totalActive, totalRunning };
    }

    // ==================== In-App Toast & OS Notification Dispatcher ====================
    function ensureToastStack() {
      let stack = document.getElementById('t3-task-toast-stack');
      if (!stack) {
        stack = document.createElement('div');
        stack.id = 't3-task-toast-stack';
        stack.setAttribute('data-quota-ui-managed', 'true');
        stack.setAttribute('aria-live', 'polite');
        document.body.appendChild(stack);
      }
      return stack;
    }

    function dismissToastCard(uid) {
      const el = document.querySelector(`#t3-task-toast-stack [data-toast-uid="${uid}"]`);
      if (!el) return;
      el.setAttribute('data-leaving', '1');
      setTimeout(() => el.remove(), 180);
    }

    function spawnInAppToast(entry) {
      if (!notifPrefs.enabled || !notifPrefs.inAppToast) return;
      const stack = ensureToastStack();

      const existing = [...stack.querySelectorAll('.t3-task-toast')];
      if (existing.length >= 3) {
        existing[0].remove();
      }

      const card = document.createElement('div');
      card.className = `t3-task-toast t3-task-toast--${entry.kind}`;
      card.setAttribute('role', 'status');
      card.setAttribute('tabindex', '0');
      card.setAttribute('data-toast-uid', entry.uid);

      const statusLabel =
        entry.kind === 'failed'
          ? '任务执行异常'
          : entry.kind === 'attention'
            ? '等待你的确认'
            : '任务已完成';
      const statusIcon =
        entry.kind === 'failed'
          ? svgIcon('alert-circle', 18)
          : entry.kind === 'attention'
            ? svgIcon('bell', 18)
            : svgIcon('check-circle', 18);

      card.innerHTML = `
        <div class="t3-toast-status-icon">${statusIcon}</div>
        <div class="t3-toast-body">
          <div class="t3-toast-meta">
            <span class="t3-toast-status-text">${statusLabel}</span>
            <span class="t3-toast-proj" style="--proj-color:${entry.colorHex}"></span>
            ${entry.durationStr ? `<span class="t3-toast-dur">${entry.durationStr}</span>` : ''}
          </div>
          <div class="t3-toast-title"></div>
          <div class="t3-toast-cta">点击直达该任务 ${svgIcon('arrow-up-right', 12)}</div>
        </div>
        <button type="button" class="t3-toast-close" aria-label="关闭提醒">${svgIcon('x', 14)}</button>
      `;

      card.querySelector('.t3-toast-proj').textContent = entry.projectTitle;
      card.querySelector('.t3-toast-title').textContent = entry.title || '未命名会话';

      card.querySelector('.t3-toast-close').addEventListener('click', (e) => {
        e.stopPropagation();
        dismissToastCard(entry.uid);
      });

      const handleJump = () => {
        dismissToastCard(entry.uid);
        jumpToTask(entry.environmentId, entry.threadId, entry.projectValue);
      };
      card.addEventListener('click', handleJump);
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleJump();
        }
      });

      stack.appendChild(card);

      let timer = setTimeout(() => dismissToastCard(entry.uid), 12000);
      card.addEventListener('pointerenter', () => clearTimeout(timer));
      card.addEventListener('pointerleave', () => {
        clearTimeout(timer);
        timer = setTimeout(() => dismissToastCard(entry.uid), 6000);
      });
    }

    function spawnOsNotification(entry, forceEvenFocused = false) {
      if (!notifPrefs.enabled || !notifPrefs.osBanner) return;
      if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

      const isViewingExactSameThread =
        document.visibilityState === 'visible' &&
        document.hasFocus() &&
        window.location.pathname.includes(entry.threadId);

      if (isViewingExactSameThread && !forceEvenFocused) return;

      const statusPrefix =
        entry.kind === 'failed'
          ? '任务异常'
          : entry.kind === 'attention'
            ? '等待确认'
            : '任务已完成';

      try {
        const prev = activeOsNotifs.get(entry.threadId);
        if (prev) {
          try {
            prev.close();
          } catch {}
        }

        const n = new Notification(`${statusPrefix} · ${entry.projectTitle}`, {
          body: `${entry.title || '未命名会话'}${entry.durationStr ? `（耗时 ${entry.durationStr}）` : ''}\n点击直接跳转到该任务`,
          tag: threadTag16(entry.environmentId, entry.threadId),
          renotify: true,
          icon: buildOsNotificationIcon(
            entry.kind === 'failed' ? '#ef4444' : entry.kind === 'attention' ? '#f59e0b' : entry.colorHex,
            entry.kind
          ),
        });

        activeOsNotifs.set(entry.threadId, n);
        n.onclick = (ev) => {
          try {
            ev.preventDefault();
          } catch {}
          try {
            window.focus();
          } catch {}
          dismissToastCard(entry.uid);
          jumpToTask(entry.environmentId, entry.threadId, entry.projectValue);
          try {
            n.close();
          } catch {}
        };
        n.onclose = () => {
          if (activeOsNotifs.get(entry.threadId) === n) {
            activeOsNotifs.delete(entry.threadId);
          }
        };
      } catch {}
    }

    function emitTaskNotification(entry, opts = {}) {
      if (!notifPrefs.enabled && !opts.force) return;

      const isViewingSame =
        !opts.force &&
        document.visibilityState === 'visible' &&
        document.hasFocus() &&
        window.location.pathname.includes(entry.threadId);

      const record = {
        ...entry,
        uid: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        createdAt: Date.now(),
        unread: !isViewingSame,
      };

      notifHistory.unshift(record);
      if (notifHistory.length > 20) notifHistory.length = 20;

      playNotificationChime(record.kind);
      spawnInAppToast(record);
      spawnOsNotification(record, Boolean(opts.forceOs));
      syncUnreadBadgesAndTitle();
    }

    // ==================== Background-Safe Task Completion Watcher ====================
    const threadSnapshotMap = new Map();
    let hasBootstrappedThreads = false;

    function checkTaskTransitions() {
      if (document.visibilityState === 'visible') {
        for (const n of notifHistory) {
          if (n.unread && window.location.pathname.includes(n.threadId)) {
            markThreadNotificationsRead(n.threadId);
          }
        }
      }

      const ctx = findSidebarState() || latestSidebarCtx;
      if (!ctx || !ctx.threads?.length) return;
      const { threads, projects, cbProps } = ctx;
      const cbItems = Array.isArray(cbProps?.items) ? cbProps.items : [];

      for (const t of threads) {
        if (!t || !t.id || t.deletedAt || t.archivedAt) continue;
        if (t.lineage?.parentThreadId) continue;

        const runId = t.latestRun?.runId || t.runtime?.activeRunId || null;
        const runStatus = t.latestRun?.status || null;
        const isRunning =
          runStatus === 'running' ||
          runStatus === 'starting' ||
          t.runtime?.activeRunId != null;
        const needsAttention = Boolean(
          t.hasPendingApprovals || t.hasPendingUserInput || t.hasActionableProposedPlan
        );

        const prev = threadSnapshotMap.get(t.id);
        threadSnapshotMap.set(t.id, { isRunning, runId, runStatus, needsAttention });

        if (!hasBootstrappedThreads) continue;
        if (!prev) continue;

        const projVis = resolveProjectVisual(t.projectId, projects, cbItems);
        const durationStr = fmtDuration(t.latestRun?.startedAt, t.latestRun?.completedAt);

        if (!prev.needsAttention && needsAttention) {
          emitTaskNotification({
            kind: 'attention',
            environmentId: t.environmentId,
            threadId: t.id,
            title: t.title || '未命名会话',
            projectTitle: projVis.projectTitle,
            projectValue: projVis.projectValue,
            colorHex: '#f59e0b',
            durationStr: '',
          });
          continue;
        }

        const finishedJustNow =
          (prev.isRunning && !isRunning && (runStatus === 'completed' || runStatus === 'failed')) ||
          (!prev.isRunning &&
            !isRunning &&
            runId &&
            prev.runId !== runId &&
            runStatus === 'completed' &&
            t.latestRun?.completedAt &&
            Date.now() - Date.parse(t.latestRun.completedAt) < 15000);

        if (finishedJustNow) {
          emitTaskNotification({
            kind: runStatus === 'failed' ? 'failed' : 'completed',
            environmentId: t.environmentId,
            threadId: t.id,
            title: t.title || '未命名会话',
            projectTitle: projVis.projectTitle,
            projectValue: projVis.projectValue,
            colorHex: projVis.colorHex,
            durationStr,
          });
        }
      }

      hasBootstrappedThreads = true;
    }

    // ==================== Notification Center Popover (Left Rail Bell) ====================
    const onDocPointerDown = (e) => {
      const pop = document.getElementById('t3-notif-popover');
      if (!pop || pop.getAttribute('data-open') !== '1') return;
      if (pop.contains(e.target) || e.target?.closest?.('[data-rail-value="__notify__"]')) return;
      closeNotifPopover();
    };
    document.addEventListener('pointerdown', onDocPointerDown);

    function ensureNotifPopover() {
      let pop = document.getElementById('t3-notif-popover');
      if (!pop) {
        pop = document.createElement('div');
        pop.id = 't3-notif-popover';
        pop.setAttribute('data-quota-ui-managed', 'true');
        pop.setAttribute('aria-label', '任务完成提醒中心');
        pop.setAttribute('data-open', '0');
        document.body.appendChild(pop);
      }
      return pop;
    }

    function closeNotifPopover() {
      const pop = document.getElementById('t3-notif-popover');
      if (pop) pop.setAttribute('data-open', '0');
    }

    function triggerSampleTestNotification() {
      const ctx = findSidebarState() || latestSidebarCtx;
      const threads = ctx?.threads || [];
      const projects = ctx?.projects || [];
      const cbItems = Array.isArray(ctx?.cbProps?.items) ? ctx.cbProps.items : [];

      const candidate =
        threads.find(
          (t) =>
            t &&
            !t.deletedAt &&
            !t.archivedAt &&
            !t.lineage?.parentThreadId &&
            !window.location.pathname.includes(t.id)
        ) ||
        threads.find((t) => t && !t.deletedAt && !t.archivedAt && !t.lineage?.parentThreadId);

      if (!candidate) return;
      const projVis = resolveProjectVisual(candidate.projectId, projects, cbItems);
      closeNotifPopover();
      emitTaskNotification(
        {
          kind: 'completed',
          environmentId: candidate.environmentId,
          threadId: candidate.id,
          title: candidate.title || '示例任务',
          projectTitle: projVis.projectTitle,
          projectValue: projVis.projectValue,
          colorHex: projVis.colorHex,
          durationStr: '18s',
        },
        { force: true, forceOs: true }
      );
    }

    function renderNotifPopoverContent() {
      const pop = ensureNotifPopover();
      const perm = typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';
      const isStandalonePwa =
        IS_ELECTRON ||
        window.matchMedia?.('(display-mode: standalone), (display-mode: window-controls-overlay)')?.matches ||
        false;

      pop.innerHTML = '';

      const header = document.createElement('div');
      header.className = 't3-np-header';
      header.innerHTML = `
        <div class="t3-np-title-wrap">
          <span class="t3-np-title">任务完成提醒</span>
          ${isStandalonePwa ? `<span class="t3-np-pwa-tag">${IS_ELECTRON ? '桌面端' : '应用模式'}</span>` : ''}
        </div>
        <div class="t3-np-actions">
          <button type="button" class="t3-np-link-btn" data-act="test">测试跳转</button>
          <button type="button" class="t3-np-link-btn" data-act="clear">全部已读</button>
        </div>
      `;
      header.querySelector('[data-act="test"]').addEventListener('click', () => {
        triggerSampleTestNotification();
      });
      header.querySelector('[data-act="clear"]').addEventListener('click', () => {
        notifHistory.forEach((n) => {
          n.unread = false;
        });
        syncUnreadBadgesAndTitle();
      });
      pop.appendChild(header);

      if (perm === 'default') {
        const permBar = document.createElement('button');
        permBar.type = 'button';
        permBar.className = 't3-np-perm-btn';
        permBar.innerHTML = `${svgIcon('bell', 14)} <span>点击开启 Windows 系统桌面弹窗通知（网页与应用通用）</span>`;
        permBar.addEventListener('click', async () => {
          try {
            await Notification.requestPermission();
          } catch {}
          renderNotifPopoverContent();
        });
        pop.appendChild(permBar);
      } else if (perm === 'denied') {
        const deniedBar = document.createElement('div');
        deniedBar.className = 't3-np-perm-hint';
        deniedBar.textContent = '系统通知已被禁用，请在设置中允许通知（页内横幅与提示音仍正常生效）。';
        pop.appendChild(deniedBar);
      }

      const toggles = document.createElement('div');
      toggles.className = 't3-np-toggles';
      const defs = [
        { key: 'enabled', label: '总开关' },
        { key: 'inAppToast', label: '页内浮窗' },
        { key: 'osBanner', label: '系统弹窗' },
        { key: 'sound', label: '提示音' },
      ];
      for (const d of defs) {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = `t3-np-chip${notifPrefs[d.key] ? ' is-on' : ''}`;
        chip.setAttribute('aria-pressed', notifPrefs[d.key] ? 'true' : 'false');
        chip.textContent = d.label;
        chip.addEventListener('click', async () => {
          notifPrefs[d.key] = !notifPrefs[d.key];
          saveNotifPrefs();
          if (d.key === 'osBanner' && notifPrefs.osBanner && typeof Notification !== 'undefined' && Notification.permission === 'default') {
            try {
              await Notification.requestPermission();
            } catch {}
          }
          if (d.key === 'sound' && notifPrefs.sound) {
            playNotificationChime('completed');
          }
          lastRailSignature = '';
          renderProjectRail();
          renderNotifPopoverContent();
        });
        toggles.appendChild(chip);
      }
      pop.appendChild(toggles);

      const list = document.createElement('div');
      list.className = 't3-np-list';
      if (!notifHistory.length) {
        const empty = document.createElement('div');
        empty.className = 't3-np-empty';
        empty.textContent = '暂无最近完成记录 · 任务完成后将在此汇总，点击任意条目即可直达会话';
        list.appendChild(empty);
      } else {
        for (const item of notifHistory) {
          const row = document.createElement('button');
          row.type = 'button';
          row.className = `t3-np-item${item.unread ? ' is-unread' : ''}`;
          row.innerHTML = `
            <span class="t3-np-item-dot" style="--dot-color:${item.kind === 'failed' ? '#ef4444' : item.colorHex}"></span>
            <span class="t3-np-item-main">
              <span class="t3-np-item-top">
                <span class="t3-np-item-proj">${item.projectTitle}</span>
                <span class="t3-np-item-time">${item.durationStr ? `${item.durationStr} · ` : ''}${fmtClockTime(item.createdAt)}</span>
              </span>
              <span class="t3-np-item-title"></span>
            </span>
            <span class="t3-np-item-go">${svgIcon('arrow-up-right', 14)}</span>
          `;
          row.querySelector('.t3-np-item-title').textContent = item.title;
          row.addEventListener('click', () => {
            jumpToTask(item.environmentId, item.threadId, item.projectValue);
          });
          list.appendChild(row);
        }
      }
      pop.appendChild(list);
    }

    function toggleNotifPopover(anchorBtn) {
      const pop = ensureNotifPopover();
      if (pop.getAttribute('data-open') === '1') {
        closeNotifPopover();
        return;
      }
      renderNotifPopoverContent();
      const r = anchorBtn.getBoundingClientRect();
      pop.style.left = `${Math.round(r.right + 10)}px`;
      pop.style.bottom = `${Math.max(12, Math.round(window.innerHeight - r.bottom))}px`;
      pop.setAttribute('data-open', '1');
    }

    // ==================== Turn Usage Helpers ====================
    function aggregateRunUsage(projection, runId) {
      if (!projection || !runId) return null;
      const baseRunId = runId.includes(':steer:') ? runId.split(':steer:')[0] : runId;
      const attempts = Array.isArray(projection.attempts) ? projection.attempts : [];
      const attemptIds = new Set(attempts.filter((a) => a.runId === baseRunId).map((a) => a.id));

      const turns = Array.isArray(projection.providerTurns) ? projection.providerTurns : [];
      const matched = turns.filter((pt) => {
        if (!pt?.turnTokenUsage || pt.turnTokenUsage.usageStatus === 'unavailable') return false;
        if (pt.runAttemptId && attemptIds.has(pt.runAttemptId)) return true;
        if (typeof pt.runAttemptId === 'string' && pt.runAttemptId.includes(encodeURIComponent(baseRunId))) return true;
        return false;
      });

      if (!matched.length) return null;

      let inputTokens = 0;
      let cachedInputTokens = 0;
      let outputTokens = 0;
      let reasoningTokens = 0;
      let hasIn = false;
      let hasOut = false;

      for (const pt of matched) {
        const u = pt.turnTokenUsage;
        if (typeof u.inputTokens === 'number') {
          inputTokens += u.inputTokens;
          hasIn = true;
        }
        if (typeof u.cachedInputTokens === 'number') {
          cachedInputTokens += u.cachedInputTokens;
        }
        if (typeof u.outputTokens === 'number') {
          outputTokens += u.outputTokens;
          hasOut = true;
        }
        if (typeof u.reasoningTokens === 'number') {
          reasoningTokens += u.reasoningTokens;
        }
      }

      return {
        inputTokens: hasIn ? inputTokens : null,
        cachedInputTokens: hasIn ? cachedInputTokens : null,
        outputTokens: hasOut ? outputTokens : null,
        reasoningTokens: reasoningTokens > 0 ? reasoningTokens : null,
      };
    }

    function buildTurnFoldBadge(projection, rawRunId) {
      if (!projection || !rawRunId) return null;
      const baseRunId = rawRunId.includes(':steer:') ? rawRunId.split(':steer:')[0] : rawRunId;
      const runs = Array.isArray(projection.runs) ? projection.runs : [];
      const run = runs.find((r) => r.id === baseRunId) || null;
      const usage = aggregateRunUsage(projection, baseRunId);

      const parts = [];
      const modelLabel = formatModelLabel(run);
      if (modelLabel) parts.push(modelLabel);

      if (usage) {
        if (usage.inputTokens != null) {
          const pct =
            usage.inputTokens > 0 && usage.cachedInputTokens != null
              ? Math.round(Math.min(1, usage.cachedInputTokens / usage.inputTokens) * 100)
              : null;
          parts.push(`入 ${fmtTok(usage.inputTokens)}${pct !== null ? ` (${pct}%缓存)` : ''}`);
        }
        if (usage.outputTokens != null) {
          parts.push(`出 ${fmtTok(usage.outputTokens)}`);
        }
        if (usage.reasoningTokens != null) {
          parts.push(`思 ${fmtTok(usage.reasoningTokens)}`);
        }
      }

      return parts.length ? { short: parts.join(' · '), run, usage } : null;
    }

    function buildWorkingBadge(projection, latestRunId) {
      if (!projection) return null;
      const runs = Array.isArray(projection.runs) ? projection.runs : [];
      const run =
        (latestRunId && runs.find((r) => r.id === latestRunId)) ||
        [...runs].reverse().find((r) => r.status === 'running' || r.status === 'starting') ||
        runs.at(-1) ||
        null;

      const parts = [];
      const modelLabel = formatModelLabel(run);
      if (modelLabel) parts.push(modelLabel);

      const pThreads = Array.isArray(projection.providerThreads) ? projection.providerThreads : [];
      const pThread =
        (run?.providerThreadId && pThreads.find((t) => t.id === run.providerThreadId)) ||
        pThreads.at(-1) ||
        null;

      const ctx = pThread?.contextUsage;
      if (ctx && typeof ctx.usedTokens === 'number') {
        const pct =
          typeof ctx.maxTokens === 'number' && ctx.maxTokens > 0
            ? ` (${Math.round((ctx.usedTokens / ctx.maxTokens) * 100)}%)`
            : '';
        const maxStr = typeof ctx.maxTokens === 'number' && ctx.maxTokens > 0 ? ` / ${fmtTok(ctx.maxTokens)}` : '';
        parts.push(`上下文 ${fmtTok(ctx.usedTokens)}${maxStr}${pct}`);
      }

      return parts.length ? parts.join(' · ') : null;
    }

    // ==================== Styles ====================
    function ensureStyles() {
      if (document.getElementById('t3-stardust-enhancer-v330-style')) return;
      const style = document.createElement('style');
      style.id = 't3-stardust-enhancer-v330-style';
      style.textContent = `
        :root {
          --t3-rail-width: ${RAIL_WIDTH}px;
          --t3-rail-bg: color-mix(in srgb, var(--sidebar) 90%, var(--foreground) 4%);
          --t3-rail-border: color-mix(in srgb, var(--sidebar-border, var(--border)) 78%, transparent);
          --t3-rail-hover: color-mix(in srgb, var(--sidebar-foreground, var(--foreground)) 6.5%, transparent);
          --t3-rail-active-bg: color-mix(in srgb, var(--primary) 14%, transparent);
          --t3-rail-badge-muted-bg: color-mix(in srgb, var(--sidebar-foreground, var(--foreground)) 16%, var(--sidebar));
          --t3-rail-badge-muted-fg: var(--sidebar-foreground, var(--foreground));
          --t3-float-bg: #ffffff;
          --t3-float-border: rgba(15, 23, 42, 0.14);
        }
        .dark {
          --t3-rail-bg: color-mix(in srgb, var(--sidebar) 82%, #000000 18%);
          --t3-rail-border: color-mix(in srgb, var(--sidebar-border, var(--border)) 72%, transparent);
          --t3-rail-hover: color-mix(in srgb, #ffffff 6%, transparent);
          --t3-rail-active-bg: color-mix(in srgb, var(--primary) 15%, rgba(255, 255, 255, 0.03));
          --t3-rail-badge-muted-bg: color-mix(in srgb, var(--sidebar-foreground, #e2e8f0) 20%, #0f172a);
          --t3-float-bg: #131d31;
          --t3-float-border: rgba(255, 255, 255, 0.15);
        }

        @media (min-width: 768px) {
          [data-slot="sidebar"][data-rail-mounted="1"][data-state="expanded"] > [data-slot="sidebar-gap"] {
            width: calc(var(--sidebar-width) + var(--t3-rail-width)) !important;
          }
          [data-slot="sidebar"][data-rail-mounted="1"][data-state="expanded"] > [data-slot="sidebar-container"] {
            width: calc(var(--sidebar-width) + var(--t3-rail-width)) !important;
          }
          [data-slot="sidebar"][data-rail-mounted="1"][data-state="collapsed"][data-collapsible="offcanvas"] > [data-slot="sidebar-container"] {
            width: calc(var(--sidebar-width) + var(--t3-rail-width)) !important;
            left: calc((var(--sidebar-width) + var(--t3-rail-width)) * -1) !important;
          }
          [data-slot="sidebar"][data-rail-mounted="1"] [data-slot="sidebar-inner"] {
            flex: 1 1 0% !important;
            min-width: 0 !important;
          }
          [data-slot="sidebar"][data-rail-mounted="1"] [data-slot="sidebar-inner"] > div > div:first-child > div:first-child:empty {
            width: 10px !important;
            min-width: 10px !important;
            flex-basis: 10px !important;
          }
        }

        /* Telegram-style Vertical Project Folder Rail */
        #t3-project-rail {
          position: relative;
          width: var(--t3-rail-width);
          min-width: var(--t3-rail-width);
          max-width: var(--t3-rail-width);
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: stretch;
          background: var(--t3-rail-bg);
          border-right: 1px solid var(--t3-rail-border);
          user-select: none;
          -webkit-app-region: no-drag;
          z-index: 12;
          box-sizing: border-box;
        }

        .t3-rail-drag-cap {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: var(--workspace-topbar-height, 48px);
          -webkit-app-region: drag;
          pointer-events: none;
        }

        .t3-rail-top {
          padding: calc(var(--workspace-topbar-height, 48px) + 2px) 4px 2px;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .t3-rail-scroll {
          flex: 1 1 0%;
          min-height: 0;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 6px 4px 10px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          scrollbar-width: none;
          overscroll-behavior: contain;
          -webkit-mask-image: linear-gradient(to bottom, transparent 0, #000 6px, #000 calc(100% - 10px), transparent 100%);
          mask-image: linear-gradient(to bottom, transparent 0, #000 6px, #000 calc(100% - 10px), transparent 100%);
        }
        .t3-rail-scroll::-webkit-scrollbar {
          display: none;
        }

        .t3-rail-bottom {
          padding: 4px 4px 7px;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1px;
          border-top: 1px solid color-mix(in srgb, var(--t3-rail-border) 70%, transparent);
          background: var(--t3-rail-bg);
        }

        .t3-rail-divider {
          width: 28px;
          height: 1px;
          margin: 4px auto;
          flex-shrink: 0;
          background: color-mix(in srgb, var(--sidebar-foreground, var(--foreground)) 11%, transparent);
          border-radius: 1px;
        }

        .t3-rail-btn {
          position: relative;
          flex-shrink: 0;
          width: 62px;
          min-height: 54px;
          padding: 6px 2px 5px;
          border: 0;
          border-radius: 11px;
          background: transparent;
          color: var(--sidebar-muted-foreground, var(--muted-foreground));
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-start;
          gap: 3px;
          cursor: pointer;
          outline: none;
          box-sizing: border-box;
          -webkit-app-region: no-drag;
          transition: background-color 140ms ease, color 140ms ease, transform 90ms cubic-bezier(0.23, 1, 0.32, 1);
        }

        .t3-rail-btn.t3-rail-btn--compact {
          min-height: 40px;
          padding: 4px 2px 3px;
          gap: 2px;
        }

        .t3-rail-btn:hover {
          background: var(--t3-rail-hover);
          color: var(--sidebar-foreground, var(--foreground));
        }

        .t3-rail-btn:active {
          transform: scale(0.95);
        }

        .t3-rail-btn:focus-visible {
          box-shadow: 0 0 0 2px var(--focus, var(--primary));
        }

        .t3-rail-btn[aria-selected="true"] {
          background: var(--t3-rail-active-bg);
          color: var(--sidebar-foreground, var(--foreground));
        }

        .t3-rail-btn[aria-selected="true"]::before {
          content: "";
          position: absolute;
          left: -3px;
          top: 50%;
          transform: translateY(-50%);
          width: 3px;
          height: 22px;
          border-radius: 0 3px 3px 0;
          background: var(--primary);
        }

        .t3-rail-icon-wrap {
          position: relative;
          width: 27px;
          height: 27px;
          border-radius: 8px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          background: color-mix(in srgb, var(--item-color, currentColor) 13%, transparent);
          color: var(--item-color, currentColor);
          box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--item-color, currentColor) 20%, transparent);
          transition: background-color 140ms ease, box-shadow 140ms ease;
        }

        .t3-rail-btn--utility .t3-rail-icon-wrap {
          width: 21px;
          height: 21px;
          background: transparent;
          box-shadow: none;
          color: inherit;
        }

        .t3-rail-btn[data-notif-active="1"] {
          color: var(--sidebar-foreground, var(--foreground));
        }

        .t3-rail-btn[aria-selected="true"] .t3-rail-icon-wrap {
          background: color-mix(in srgb, var(--item-color, var(--primary)) 22%, transparent);
          box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--item-color, var(--primary)) 36%, transparent);
        }

        .t3-rail-monogram {
          font-family: var(--font-sans, system-ui, -apple-system, sans-serif);
          font-size: 12.5px;
          font-weight: 650;
          line-height: 1;
          letter-spacing: -0.02em;
        }

        .t3-rail-label {
          display: block;
          flex-shrink: 0;
          width: 74px;
          font-size: 12px;
          line-height: 1.42;
          padding-bottom: 1px;
          font-weight: 500;
          letter-spacing: -0.01em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          text-align: center;
          transform: scale(0.80);
          transform-origin: center top;
          margin-bottom: -3px;
        }

        .t3-rail-btn[aria-selected="true"] .t3-rail-label {
          font-weight: 600;
          color: var(--sidebar-foreground, var(--foreground));
        }

        .t3-rail-badge {
          position: absolute;
          top: -5px;
          right: -7px;
          min-width: 19px;
          height: 19px;
          padding: 0 5px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 650;
          line-height: 1;
          font-variant-numeric: tabular-nums;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: var(--t3-rail-badge-muted-bg);
          color: var(--t3-rail-badge-muted-fg);
          border: 1.5px solid var(--t3-rail-bg);
          box-sizing: border-box;
          pointer-events: none;
          transform: scale(0.78);
          transform-origin: top right;
        }

        .t3-rail-badge--running {
          background: var(--primary);
          color: var(--primary-foreground, #111827);
        }

        .t3-rail-badge--done {
          background: #10b981;
          color: #ffffff;
        }

        #t3-rail-tooltip {
          position: fixed;
          z-index: 2147483645;
          padding: 5px 10px;
          border-radius: 8px;
          font-size: 12px;
          line-height: 1.35;
          font-weight: 500;
          color: var(--foreground);
          background: var(--t3-float-bg);
          border: 1px solid var(--t3-float-border);
          box-shadow: 0 10px 28px rgba(0, 0, 0, 0.42);
          -webkit-backdrop-filter: blur(18px) saturate(1.4);
          backdrop-filter: blur(18px) saturate(1.4);
          pointer-events: none;
          opacity: 0;
          transform: translateX(-4px);
          transition: opacity 110ms ease-out, transform 110ms cubic-bezier(0.23, 1, 0.32, 1);
          white-space: nowrap;
        }
        #t3-rail-tooltip[data-visible="1"] {
          opacity: 1;
          transform: translateX(0);
        }
        #t3-rail-tooltip .t3-rail-tip-sub {
          margin-left: 6px;
          font-size: 11px;
          font-weight: 400;
          color: var(--muted-foreground);
        }

        #t3-task-toast-stack {
          position: fixed;
          top: 12px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 2147483644;
          display: flex;
          flex-direction: column;
          gap: 8px;
          width: min(356px, calc(100vw - 32px));
          pointer-events: none;
          -webkit-app-region: no-drag;
        }

        .t3-task-toast {
          pointer-events: auto;
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 11px 13px;
          border-radius: 15px;
          background: var(--t3-float-bg);
          border: 1px solid var(--t3-float-border);
          box-shadow: 0 16px 40px -8px rgba(0, 0, 0, 0.52), inset 0 1px 0 rgba(255, 255, 255, 0.08);
          -webkit-backdrop-filter: blur(24px) saturate(1.5);
          backdrop-filter: blur(24px) saturate(1.5);
          cursor: pointer;
          outline: none;
          animation: t3ToastIn 210ms cubic-bezier(0.23, 1, 0.32, 1) both;
          transition: transform 140ms cubic-bezier(0.23, 1, 0.32, 1), opacity 160ms ease, border-color 140ms ease;
        }
        .t3-task-toast:hover {
          transform: translateY(-1px);
          border-color: color-mix(in srgb, var(--primary) 50%, var(--t3-float-border));
        }
        .t3-task-toast:active {
          transform: scale(0.98);
        }
        .t3-task-toast:focus-visible {
          box-shadow: 0 0 0 2px var(--focus, var(--primary)), 0 16px 40px -8px rgba(0, 0, 0, 0.52);
        }
        .t3-task-toast[data-leaving="1"] {
          opacity: 0;
          transform: translateY(-8px) scale(0.97);
        }

        @keyframes t3ToastIn {
          from { transform: translateY(-8px) scale(0.97); }
          to { transform: translateY(0) scale(1); }
        }

        .t3-toast-status-icon {
          width: 30px;
          height: 30px;
          border-radius: 9px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          color: #10b981;
          background: color-mix(in srgb, #10b981 15%, transparent);
        }
        .t3-task-toast--attention .t3-toast-status-icon {
          color: #f59e0b;
          background: color-mix(in srgb, #f59e0b 16%, transparent);
        }
        .t3-task-toast--failed .t3-toast-status-icon {
          color: #ef4444;
          background: color-mix(in srgb, #ef4444 16%, transparent);
        }

        .t3-toast-body {
          flex: 1 1 0%;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        .t3-toast-meta {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          line-height: 1.3;
        }
        .t3-toast-status-text {
          font-weight: 650;
          color: var(--foreground);
        }
        .t3-toast-proj {
          padding: 1px 6px;
          border-radius: 999px;
          font-size: 10.5px;
          font-weight: 500;
          color: var(--proj-color, var(--primary));
          background: color-mix(in srgb, var(--proj-color, var(--primary)) 14%, transparent);
          max-width: 120px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .t3-toast-dur {
          margin-left: auto;
          font-size: 10.5px;
          color: var(--muted-foreground);
          font-variant-numeric: tabular-nums;
        }
        .t3-toast-title {
          font-size: 12.5px;
          line-height: 1.38;
          font-weight: 500;
          color: var(--foreground);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .t3-toast-cta {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          font-size: 11px;
          font-weight: 500;
          color: var(--primary);
          margin-top: 1px;
        }
        .t3-toast-close {
          width: 22px;
          height: 22px;
          border: 0;
          border-radius: 6px;
          background: transparent;
          color: var(--muted-foreground);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          flex-shrink: 0;
          padding: 0;
        }
        .t3-toast-close:hover {
          background: color-mix(in srgb, var(--foreground) 10%, transparent);
          color: var(--foreground);
        }

        #t3-notif-popover {
          position: fixed;
          z-index: 2147483643;
          width: 326px;
          max-height: min(460px, calc(100vh - 32px));
          display: none;
          flex-direction: column;
          border-radius: 15px;
          background: var(--t3-float-bg);
          border: 1px solid var(--t3-float-border);
          box-shadow: 0 20px 46px -10px rgba(0, 0, 0, 0.58), inset 0 1px 0 rgba(255, 255, 255, 0.08);
          color: var(--foreground);
          overflow: hidden;
          -webkit-app-region: no-drag;
        }
        #t3-notif-popover[data-open="1"] {
          display: flex;
        }

        .t3-np-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 11px 13px 9px;
          border-bottom: 1px solid color-mix(in srgb, var(--border) 75%, transparent);
        }
        .t3-np-title-wrap {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .t3-np-title {
          font-size: 13px;
          font-weight: 650;
        }
        .t3-np-pwa-tag {
          font-size: 10px;
          font-weight: 600;
          padding: 1px 6px;
          border-radius: 999px;
          color: #10b981;
          background: color-mix(in srgb, #10b981 15%, transparent);
        }
        .t3-np-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .t3-np-link-btn {
          border: 0;
          background: transparent;
          padding: 2px 4px;
          border-radius: 5px;
          font-size: 11.5px;
          font-weight: 500;
          color: var(--primary);
          cursor: pointer;
        }
        .t3-np-link-btn:hover {
          background: color-mix(in srgb, var(--primary) 12%, transparent);
        }

        .t3-np-perm-btn {
          margin: 8px 10px 2px;
          padding: 7px 10px;
          border-radius: 9px;
          border: 1px solid color-mix(in srgb, var(--primary) 35%, transparent);
          background: color-mix(in srgb, var(--primary) 12%, transparent);
          color: var(--foreground);
          font-size: 11.5px;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          text-align: left;
        }
        .t3-np-perm-btn:hover {
          background: color-mix(in srgb, var(--primary) 18%, transparent);
        }
        .t3-np-perm-hint {
          margin: 8px 12px 2px;
          font-size: 11px;
          line-height: 1.4;
          color: var(--muted-foreground);
        }

        .t3-np-toggles {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 5px;
          padding: 8px 10px;
          border-bottom: 1px solid color-mix(in srgb, var(--border) 65%, transparent);
        }
        .t3-np-chip {
          padding: 5px 4px;
          border-radius: 8px;
          border: 1px solid color-mix(in srgb, var(--foreground) 10%, transparent);
          background: color-mix(in srgb, var(--foreground) 4%, transparent);
          color: var(--muted-foreground);
          font-size: 11px;
          font-weight: 500;
          cursor: pointer;
          transition: background-color 120ms ease, color 120ms ease, border-color 120ms ease;
        }
        .t3-np-chip.is-on {
          color: var(--foreground);
          background: color-mix(in srgb, var(--primary) 16%, transparent);
          border-color: color-mix(in srgb, var(--primary) 42%, transparent);
          font-weight: 600;
        }

        .t3-np-list {
          flex: 1 1 0%;
          min-height: 0;
          overflow-y: auto;
          padding: 6px;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .t3-np-empty {
          padding: 22px 14px;
          text-align: center;
          font-size: 11.5px;
          line-height: 1.5;
          color: var(--muted-foreground);
        }
        .t3-np-item {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 8px 9px;
          border: 0;
          border-radius: 10px;
          background: transparent;
          color: var(--foreground);
          text-align: left;
          cursor: pointer;
          transition: background-color 120ms ease, transform 90ms ease;
        }
        .t3-np-item:hover {
          background: color-mix(in srgb, var(--foreground) 7%, transparent);
        }
        .t3-np-item:active {
          transform: scale(0.985);
        }
        .t3-np-item.is-unread {
          background: color-mix(in srgb, #10b981 8%, transparent);
        }
        .t3-np-item-dot {
          width: 7px;
          height: 7px;
          border-radius: 999px;
          flex-shrink: 0;
          background: var(--dot-color, #10b981);
          opacity: 0.35;
        }
        .t3-np-item.is-unread .t3-np-item-dot {
          opacity: 1;
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--dot-color, #10b981) 22%, transparent);
        }
        .t3-np-item-main {
          flex: 1 1 0%;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .t3-np-item-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 6px;
          font-size: 10.5px;
          color: var(--muted-foreground);
        }
        .t3-np-item-proj {
          font-weight: 600;
          color: var(--foreground);
          opacity: 0.85;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .t3-np-item-time {
          flex-shrink: 0;
          font-variant-numeric: tabular-nums;
        }
        .t3-np-item-title {
          font-size: 12px;
          line-height: 1.35;
          font-weight: 500;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .t3-np-item-go {
          color: var(--muted-foreground);
          flex-shrink: 0;
        }
        .t3-np-item:hover .t3-np-item-go {
          color: var(--primary);
        }

        @media (prefers-reduced-motion: reduce) {
          .t3-rail-btn,
          .t3-rail-icon-wrap,
          #t3-rail-tooltip,
          .t3-task-toast,
          #t3-notif-popover {
            transition: none !important;
            animation: none !important;
          }
        }

        /* Turn-fold & Working usage pills */
        .t3-turn-usage-pill {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          margin-left: 6px;
          padding: 1px 8px;
          border-radius: 999px;
          font-size: 11px;
          line-height: 1.45;
          font-variant-numeric: tabular-nums;
          color: var(--muted-foreground);
          background: color-mix(in srgb, var(--foreground) 5.5%, transparent);
          border: 1px solid color-mix(in srgb, var(--foreground) 9%, transparent);
          white-space: nowrap;
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          transition: color 150ms ease, background 150ms ease;
        }
        .t3-turn-usage-pill:hover {
          color: var(--foreground);
          background: color-mix(in srgb, var(--foreground) 9%, transparent);
        }

        /* Stardust Hi-Res Audio Preview Vinyl Glass Deck */
        html:root div:has(> audio[controls][preload="metadata"]) {
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 0 !important;
          padding: 14px !important;
          position: relative;
          isolation: isolate;
          overflow: hidden;
          background-image: radial-gradient(
            circle at 50% 42%,
            color-mix(in srgb, var(--primary) 15%, transparent) 0%,
            color-mix(in srgb, var(--primary) 4%, transparent) 38%,
            transparent 68%
          );
        }
        html:root div:has(> audio[controls][preload="metadata"])::before {
          content: "";
          box-sizing: border-box !important;
          order: 1;
          width: min(100%, 540px);
          height: 196px;
          border-radius: 22px 22px 0 0;
          background-color: color-mix(in srgb, var(--card) 92%, transparent);
          border: 1px solid color-mix(in srgb, var(--foreground) 10%, transparent);
          border-bottom: 0;
          box-shadow: inset 0 1px 0 color-mix(in srgb, #ffffff 45%, transparent);
          -webkit-backdrop-filter: blur(28px) saturate(1.6);
          backdrop-filter: blur(28px) saturate(1.6);
          background-repeat: no-repeat;
          background-position: center 54%, center 54%, center 54%;
          background-size: 240px 190px, 240px 190px, 100% 100%;
          background-image:
            url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 240 190' fill='none'%3E%3Cdefs%3E%3ClinearGradient id='vs' x1='44' y1='22' x2='176' y2='168' gradientUnits='userSpaceOnUse'%3E%3Cstop offset='0' stop-color='%23ffffff' stop-opacity='0.17'/%3E%3Cstop offset='0.44' stop-color='%23ffffff' stop-opacity='0.01'/%3E%3Cstop offset='0.56' stop-color='%23ffffff' stop-opacity='0.01'/%3E%3Cstop offset='1' stop-color='%23ffffff' stop-opacity='0.13'/%3E%3C/linearGradient%3E%3ClinearGradient id='arm' x1='190' y1='26' x2='158' y2='136' gradientUnits='userSpaceOnUse'%3E%3Cstop offset='0' stop-color='%23f1f5f9'/%3E%3Cstop offset='0.5' stop-color='%2394a3b8'/%3E%3Cstop offset='1' stop-color='%23e2e8f0'/%3E%3C/linearGradient%3E%3C/defs%3E%3Ccircle cx='112' cy='96' r='76' fill='%2305070b' fill-opacity='0.36'/%3E%3Ccircle cx='112' cy='96' r='73.5' stroke='%2394a3b8' stroke-opacity='0.32' stroke-width='1.2'/%3E%3Cpath fill-rule='evenodd' clip-rule='evenodd' d='M112 168A72 72 0 1 0 112 24a72 72 0 0 0 0 144Zm0-48a24 24 0 1 0 0-48 24 24 0 0 0 0 48Z' fill='%230c0f17'/%3E%3Cpath fill-rule='evenodd' clip-rule='evenodd' d='M112 168A72 72 0 1 0 112 24a72 72 0 0 0 0 144Zm0-48a24 24 0 1 0 0-48 24 24 0 0 0 0 48Z' fill='url(%23vs)'/%3E%3Ccircle cx='112' cy='96' r='64' stroke='%23ffffff' stroke-opacity='0.06' stroke-width='0.75'/%3E%3Ccircle cx='112' cy='96' r='56' stroke='%23ffffff' stroke-opacity='0.045' stroke-width='0.75'/%3E%3Ccircle cx='112' cy='96' r='48' stroke='%23ffffff' stroke-opacity='0.065' stroke-width='0.75'/%3E%3Ccircle cx='112' cy='96' r='40' stroke='%23ffffff' stroke-opacity='0.045' stroke-width='0.75'/%3E%3Ccircle cx='112' cy='96' r='32' stroke='%23ffffff' stroke-opacity='0.065' stroke-width='0.75'/%3E%3Ccircle cx='112' cy='96' r='24.5' stroke='%23080a10' stroke-width='2.2'/%3E%3Ccircle cx='112' cy='96' r='18.5' stroke='%23080a10' stroke-opacity='0.3' stroke-width='0.85' stroke-dasharray='2 2'/%3E%3Ccircle cx='112' cy='96' r='4' fill='%230b0e14' stroke='%23ffffff' stroke-opacity='0.7' stroke-width='1.1'/%3E%3Ccircle cx='194' cy='36' r='12.5' fill='%231e293b' fill-opacity='0.72' stroke='%2394a3b8' stroke-opacity='0.42' stroke-width='1.2'/%3E%3Ccircle cx='194' cy='36' r='5' fill='%23e2e8f0'/%3E%3Cpath d='M194 36 L186 104 Q185 114 176 121 L162 131' stroke='url(%23arm)' stroke-width='3' stroke-linecap='round'/%3E%3Crect x='154' y='127' width='11.5' height='6.5' rx='1.8' transform='rotate(-34 159.7 130.2)' fill='%23f1f5f9'/%3E%3Ccircle cx='42' cy='158' r='2.8' fill='%2334d399'/%3E%3Ccircle cx='42' cy='158' r='6' fill='%2334d399' fill-opacity='0.22'/%3E%3C/svg%3E"),
            radial-gradient(circle at 112px 96px, #0b0e14 0 3.5px, var(--primary) 4px 24.5px, transparent 25px),
            radial-gradient(circle at 47% 52%, color-mix(in srgb, var(--primary) 22%, transparent) 0%, transparent 64%);
        }
        html:root.dark div:has(> audio[controls][preload="metadata"])::before {
          background-color: color-mix(in srgb, var(--card) 86%, transparent);
          border-color: color-mix(in srgb, var(--foreground) 11%, transparent);
          box-shadow: inset 0 1px 0 color-mix(in srgb, #ffffff 14%, transparent);
        }
        html:root div:has(> audio[controls][preload="metadata"])::after {
          content: "HI-RES LOSSLESS  ·  STUDIO DECK";
          box-sizing: border-box !important;
          order: 2;
          width: min(100%, 540px);
          padding: 2px 14px 8px;
          text-align: center;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.15em;
          color: var(--muted-foreground);
          background-color: color-mix(in srgb, var(--card) 92%, transparent);
          border-left: 1px solid color-mix(in srgb, var(--foreground) 10%, transparent);
          border-right: 1px solid color-mix(in srgb, var(--foreground) 10%, transparent);
          -webkit-backdrop-filter: blur(28px) saturate(1.6);
          backdrop-filter: blur(28px) saturate(1.6);
        }
        html:root.dark div:has(> audio[controls][preload="metadata"])::after {
          background-color: color-mix(in srgb, var(--card) 86%, transparent);
          border-color: color-mix(in srgb, var(--foreground) 11%, transparent);
        }
        html:root div > audio[controls][preload="metadata"] {
          box-sizing: border-box !important;
          order: 3;
          width: min(100%, 540px) !important;
          max-width: 540px !important;
          height: 76px !important;
          padding: 2px 12px 12px !important;
          margin: 0 !important;
          border-radius: 0 0 22px 22px !important;
          background-color: color-mix(in srgb, var(--card) 92%, transparent) !important;
          border: 1px solid color-mix(in srgb, var(--foreground) 10%, transparent) !important;
          border-top: 0 !important;
          box-shadow: 0 20px 36px -18px rgba(15, 23, 42, 0.16) !important;
          -webkit-backdrop-filter: blur(28px) saturate(1.6);
          backdrop-filter: blur(28px) saturate(1.6);
          color-scheme: light;
          outline: none !important;
        }
        html:root.dark div > audio[controls][preload="metadata"] {
          background-color: color-mix(in srgb, var(--card) 86%, transparent) !important;
          border-color: color-mix(in srgb, var(--foreground) 11%, transparent) !important;
          box-shadow: 0 24px 38px -18px rgba(0, 0, 0, 0.58) !important;
          color-scheme: dark;
        }
        html:root div > audio[controls][preload="metadata"]::-webkit-media-controls-enclosure {
          border-radius: 14px !important;
          background: color-mix(in srgb, var(--foreground) 5.5%, transparent) !important;
          border: 1px solid color-mix(in srgb, var(--foreground) 8%, transparent) !important;
          max-height: 62px !important;
          height: 62px !important;
        }
        html:root.dark div > audio[controls][preload="metadata"]::-webkit-media-controls-enclosure {
          background: color-mix(in srgb, var(--foreground) 6.5%, transparent) !important;
          border-color: color-mix(in srgb, var(--foreground) 9%, transparent) !important;
        }
        html:root div > audio[controls][preload="metadata"]::-webkit-media-controls-panel {
          box-sizing: border-box !important;
          display: flex !important;
          flex-direction: row !important;
          flex-wrap: wrap !important;
          align-items: center !important;
          align-content: center !important;
          height: 62px !important;
          padding: 6px 8px 2px !important;
          background: transparent !important;
        }
        html:root div > audio[controls][preload="metadata"]::-webkit-media-controls-timeline {
          box-sizing: border-box !important;
          order: -1 !important;
          flex: 1 0 calc(100% - 16px) !important;
          width: calc(100% - 16px) !important;
          min-width: calc(100% - 16px) !important;
          margin: 0 8px !important;
          padding: 0 !important;
        }
        html:root div > audio[controls][preload="metadata"]::-webkit-media-controls-time-remaining-display {
          margin-right: auto !important;
        }
        html:root div > audio[controls][preload="metadata"]::-webkit-media-controls-current-time-display,
        html:root div > audio[controls][preload="metadata"]::-webkit-media-controls-time-remaining-display {
          font-variant-numeric: tabular-nums !important;
          font-size: 12px !important;
          font-weight: 500 !important;
          text-shadow: none !important;
        }
      `;
      (document.head || document.documentElement).appendChild(style);
    }

    let latestSidebarCtx = null;
    let lastRailSignature = '';

    function ensureTooltipEl() {
      let tip = document.getElementById('t3-rail-tooltip');
      if (!tip) {
        tip = document.createElement('div');
        tip.id = 't3-rail-tooltip';
        tip.setAttribute('data-quota-ui-managed', 'true');
        tip.setAttribute('role', 'tooltip');
        document.body.appendChild(tip);
      }
      return tip;
    }

    function showRailTooltip(btn) {
      const title = btn.getAttribute('data-tip-title');
      if (!title) return;
      const sub = btn.getAttribute('data-tip-sub') || '';
      const tip = ensureTooltipEl();
      tip.innerHTML = '';
      const mainSpan = document.createElement('span');
      mainSpan.textContent = title;
      tip.appendChild(mainSpan);
      if (sub) {
        const subSpan = document.createElement('span');
        subSpan.className = 't3-rail-tip-sub';
        subSpan.textContent = sub;
        tip.appendChild(subSpan);
      }
      const rect = btn.getBoundingClientRect();
      tip.style.left = `${Math.round(rect.right + 8)}px`;
      tip.style.top = `${Math.round(rect.top + rect.height / 2 - 14)}px`;
      tip.setAttribute('data-visible', '1');
    }

    function hideRailTooltip() {
      const tip = document.getElementById('t3-rail-tooltip');
      if (tip) tip.setAttribute('data-visible', '0');
    }

    function invokeProjectSelection(targetValue, mouseEvent) {
      const ctx = findSidebarState() || latestSidebarCtx;
      if (!ctx?.cbProps) return;
      const { cbProps } = ctx;
      const items = Array.isArray(cbProps.items) ? cbProps.items : [];
      const item = items.find((it) => it && it.value === targetValue);
      if (!item) return;

      const currentVal = cbProps.value;
      const isSingleSelected =
        !Array.isArray(currentVal) &&
        currentVal?.value === targetValue &&
        targetValue !== 'all' &&
        targetValue !== 'add-project' &&
        !(mouseEvent && mouseEvent.shiftKey);

      const finalItem = isSingleSelected
        ? items.find((it) => it && it.value === 'all') || item
        : item;

      const syntheticEvent =
        mouseEvent instanceof MouseEvent
          ? mouseEvent
          : new MouseEvent('click', { shiftKey: Boolean(mouseEvent?.shiftKey) });

      cbProps.onValueChange(finalItem, {
        event: syntheticEvent,
        reason: 'item-press',
        cancel: () => {},
        allowPropagation: () => {},
      });
    }

    function createRailButton(cfg) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `t3-rail-btn${cfg.compact ? ' t3-rail-btn--compact' : ''}${cfg.utility ? ' t3-rail-btn--utility' : ''}`;
      if (cfg.role) btn.setAttribute('role', cfg.role);
      if (cfg.selected != null) btn.setAttribute('aria-selected', cfg.selected ? 'true' : 'false');
      if (cfg.notifActive) btn.setAttribute('data-notif-active', '1');
      btn.setAttribute('aria-label', cfg.ariaLabel || cfg.label);
      btn.setAttribute('data-rail-value', cfg.value);
      btn.setAttribute('data-tip-title', cfg.tipTitle || cfg.label);
      if (cfg.tipSub) btn.setAttribute('data-tip-sub', cfg.tipSub);
      if (cfg.colorHex) btn.style.setProperty('--item-color', cfg.colorHex);

      const iconWrap = document.createElement('span');
      iconWrap.className = 't3-rail-icon-wrap';
      if (cfg.iconSvg) {
        iconWrap.innerHTML = cfg.iconSvg;
      } else {
        const mono = document.createElement('span');
        mono.className = 't3-rail-monogram';
        mono.setAttribute('aria-hidden', 'true');
        mono.textContent = cfg.monogram || 'P';
        iconWrap.appendChild(mono);
      }

      if (cfg.badgeCount > 0) {
        const badge = document.createElement('span');
        const variantCls = cfg.badgeVariant
          ? ` t3-rail-badge--${cfg.badgeVariant}`
          : cfg.badgeRunning
            ? ' t3-rail-badge--running'
            : '';
        badge.className = `t3-rail-badge${variantCls}`;
        badge.setAttribute('aria-hidden', 'true');
        badge.textContent = cfg.badgeCount > 99 ? '99+' : String(cfg.badgeCount);
        iconWrap.appendChild(badge);
      }

      const labelEl = document.createElement('span');
      labelEl.className = 't3-rail-label';
      labelEl.textContent = cfg.shortLabel || cfg.label;

      btn.appendChild(iconWrap);
      btn.appendChild(labelEl);

      btn.addEventListener('pointerenter', (e) => {
        if (e.buttons === 0) showRailTooltip(btn);
      });
      btn.addEventListener('pointerleave', hideRailTooltip);
      btn.addEventListener('pointerdown', hideRailTooltip);
      btn.addEventListener('focus', () => {
        try {
          if (btn.matches(':focus-visible')) showRailTooltip(btn);
        } catch {}
      });
      btn.addEventListener('blur', hideRailTooltip);
      btn.addEventListener('click', (e) => {
        hideRailTooltip();
        cfg.onClick(e, btn);
      });

      return btn;
    }

    function unmountRailCleanly() {
      const existing = document.getElementById('t3-project-rail');
      if (existing) existing.remove();
      document.querySelectorAll('[data-slot="sidebar"][data-rail-mounted="1"]').forEach((el) => {
        el.removeAttribute('data-rail-mounted');
      });
      hideRailTooltip();
      lastRailSignature = '';
    }

    function renderProjectRail() {
      const ctx = findSidebarState();
      if (!ctx) {
        unmountRailCleanly();
        return;
      }
      latestSidebarCtx = ctx;

      const { sidebar, triggerBtn, cbProps, projects, threads } = ctx;
      const container = sidebar.querySelector('[data-slot="sidebar-container"]');
      if (!container) return;

      const items = Array.isArray(cbProps.items) ? cbProps.items : [];
      const projectItems = items.filter((it) => it && it.value !== 'all' && it.value !== 'add-project');
      if (!projectItems.length) {
        unmountRailCleanly();
        return;
      }

      const selectedSet = new Set();
      if (Array.isArray(cbProps.value)) {
        for (const v of cbProps.value) {
          if (v && typeof v === 'object' && v.value) selectedSet.add(v.value);
          else if (typeof v === 'string') selectedSet.add(v);
        }
      } else if (cbProps.value?.value) {
        selectedSet.add(cbProps.value.value);
      }
      if (selectedSet.size === 0) selectedSet.add('all');

      const stats = computeProjectStats(projects, threads);
      const unreadNotifCount = notifHistory.filter((n) => n.unread).length;

      const enriched = projectItems.map((it) => {
        const rec = matchProjectRecord(it, projects);
        const st = (rec?.id && stats.byProjectId.get(rec.id)) || { active: 0, running: 0 };
        const pinned = Boolean(rec?.pinnedAt);
        const iconObj = rec?.projectIcon || null;
        const colorKey =
          (iconObj?.color && COLOR_MAP[iconObj.color] ? iconObj.color : null) ||
          FALLBACK_PALETTE[hashString(rec?.id || it.value) % FALLBACK_PALETTE.length];
        const colorHex = COLOR_MAP[colorKey] || COLOR_MAP.sky;
        const iconSvg =
          iconObj?.kind === 'lucide' && iconObj.name ? svgIcon(iconObj.name, 16) : null;
        const monogram = !iconSvg ? pickMonogramGlyph(iconObj?.text || it.label) : null;

        return {
          value: it.value,
          label: it.label,
          shortLabel: shortRailLabel(it.label),
          pinned,
          colorHex,
          iconSvg,
          monogram,
          activeCount: st.active,
          runningCount: st.running,
          selected: selectedSet.has(it.value),
        };
      });

      const sig = JSON.stringify({
        sel: [...selectedSet],
        totalA: stats.totalActive,
        totalR: stats.totalRunning,
        unreadN: unreadNotifCount,
        notifOn: notifPrefs.enabled,
        list: enriched.map((e) => [e.value, e.label, e.pinned ? 1 : 0, e.colorHex, e.activeCount, e.runningCount]),
      });

      let rail = document.getElementById('t3-project-rail');
      if (rail && rail.parentElement === container && sig === lastRailSignature) {
        sidebar.setAttribute('data-rail-mounted', '1');
        return;
      }
      lastRailSignature = sig;

      if (!rail) {
        rail = document.createElement('nav');
        rail.id = 't3-project-rail';
        rail.setAttribute('data-quota-ui-managed', 'true');
        rail.setAttribute('aria-label', '项目垂直导航栏');
        rail.addEventListener('keydown', (e) => {
          if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
          const btns = [...rail.querySelectorAll('button.t3-rail-btn')];
          const idx = btns.indexOf(document.activeElement);
          if (idx < 0) return;
          e.preventDefault();
          let nextIdx = idx;
          if (e.key === 'ArrowDown') nextIdx = (idx + 1) % btns.length;
          else if (e.key === 'ArrowUp') nextIdx = (idx - 1 + btns.length) % btns.length;
          else if (e.key === 'Home') nextIdx = 0;
          else if (e.key === 'End') nextIdx = btns.length - 1;
          btns[nextIdx]?.focus();
        });
      }

      if (rail.parentElement !== container || container.firstElementChild !== rail) {
        container.prepend(rail);
      }
      sidebar.setAttribute('data-rail-mounted', '1');

      const prevScrollTop = rail.querySelector('.t3-rail-scroll')?.scrollTop || 0;
      rail.innerHTML = '';

      if (IS_ELECTRON) {
        const dragCap = document.createElement('div');
        dragCap.className = 't3-rail-drag-cap';
        dragCap.setAttribute('aria-hidden', 'true');
        rail.appendChild(dragCap);
      }

      // 1. Top sticky "所有项目"
      const topBox = document.createElement('div');
      topBox.className = 't3-rail-top';
      const allSelected = selectedSet.has('all');
      const allStatusText =
        stats.totalRunning > 0
          ? `${stats.totalActive} 个活跃 · ${stats.totalRunning} 个运行中`
          : stats.totalActive > 0
            ? `${stats.totalActive} 个活跃会话`
            : '全部项目';
      topBox.appendChild(
        createRailButton({
          value: 'all',
          label: '所有项目',
          shortLabel: '所有项目',
          ariaLabel: `所有项目，${allStatusText}`,
          tipTitle: '所有项目',
          tipSub: allStatusText,
          role: 'tab',
          selected: allSelected,
          colorHex: '#38bdf8',
          iconSvg: svgIcon('all', 16),
          badgeCount: stats.totalActive,
          badgeRunning: stats.totalRunning > 0,
          onClick: (e) => invokeProjectSelection('all', e),
        })
      );
      const topDiv = document.createElement('div');
      topDiv.className = 't3-rail-divider';
      topBox.appendChild(topDiv);
      rail.appendChild(topBox);

      // 2. Scrollable project list
      const scrollBox = document.createElement('div');
      scrollBox.className = 't3-rail-scroll';
      scrollBox.setAttribute('role', 'tablist');
      scrollBox.setAttribute('aria-orientation', 'vertical');

      let sawPinned = false;
      let insertedUnpinnedDivider = false;

      for (const item of enriched) {
        if (item.pinned) {
          sawPinned = true;
        } else if (sawPinned && !insertedUnpinnedDivider) {
          insertedUnpinnedDivider = true;
          const div = document.createElement('div');
          div.className = 't3-rail-divider';
          scrollBox.appendChild(div);
        }

        const subParts = [];
        if (item.pinned) subParts.push('已置顶');
        if (item.runningCount > 0) subParts.push(`${item.runningCount} 运行中`);
        else if (item.activeCount > 0) subParts.push(`${item.activeCount} 活跃`);
        subParts.push('Shift+点击可多选');

        scrollBox.appendChild(
          createRailButton({
            value: item.value,
            label: item.label,
            shortLabel: item.shortLabel,
            ariaLabel: `${item.label}${item.activeCount > 0 ? `，${item.activeCount} 个活跃会话` : ''}`,
            tipTitle: item.label,
            tipSub: subParts.join(' · '),
            role: 'tab',
            selected: item.selected,
            colorHex: item.colorHex,
            iconSvg: item.iconSvg,
            monogram: item.monogram,
            badgeCount: item.activeCount,
            badgeRunning: item.runningCount > 0,
            onClick: (e) => invokeProjectSelection(item.value, e),
          })
        );
      }

      rail.appendChild(scrollBox);
      if (prevScrollTop > 0) scrollBox.scrollTop = prevScrollTop;

      // 3. Bottom sticky utility actions ("提醒" + "管理" + "添加")
      const bottomBox = document.createElement('div');
      bottomBox.className = 't3-rail-bottom';

      const permState = typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';
      const notifTipSub = !notifPrefs.enabled
        ? '已关闭 · 点击配置'
        : unreadNotifCount > 0
          ? `${unreadNotifCount} 条新完成 · 点击查看并直达`
          : permState === 'default'
            ? '点击开启系统桌面弹窗通知'
            : '已开启 · 完成后点击通知直达任务';

      bottomBox.appendChild(
        createRailButton({
          value: '__notify__',
          label: '提醒',
          shortLabel: '提醒',
          ariaLabel: `任务完成提醒${unreadNotifCount > 0 ? `，${unreadNotifCount} 条未读` : ''}`,
          tipTitle: '任务完成提醒',
          tipSub: notifTipSub,
          compact: true,
          utility: true,
          notifActive: notifPrefs.enabled && unreadNotifCount > 0,
          iconSvg: svgIcon(notifPrefs.enabled ? 'bell' : 'bell-off', 16),
          badgeCount: unreadNotifCount,
          badgeVariant: 'done',
          onClick: (_e, btnEl) => toggleNotifPopover(btnEl),
        })
      );

      bottomBox.appendChild(
        createRailButton({
          value: '__manage__',
          label: '管理',
          shortLabel: '管理',
          ariaLabel: '搜索、置顶与管理项目',
          tipTitle: '搜索与管理项目',
          tipSub: '置顶排序 · 项目设置',
          compact: true,
          utility: true,
          iconSvg: svgIcon('sliders-horizontal', 16),
          badgeCount: 0,
          onClick: () => {
            const curTrigger =
              document.querySelector('[data-slot="sidebar"] [data-slot="combobox-trigger"]') || triggerBtn;
            curTrigger?.click();
          },
        })
      );

      bottomBox.appendChild(
        createRailButton({
          value: 'add-project',
          label: '添加',
          shortLabel: '添加',
          ariaLabel: '添加新项目',
          tipTitle: '添加项目',
          tipSub: '注册本地目录或克隆仓库',
          compact: true,
          utility: true,
          iconSvg: svgIcon('folder-plus', 16),
          badgeCount: 0,
          onClick: (e) => invokeProjectSelection('add-project', e),
        })
      );

      rail.appendChild(bottomBox);
    }

    function renderAll() {
      ensureStyles();
      renderProjectRail();
      checkTaskTransitions();

      // Reorder Web Context Menu ("按 xx 筛选" -> DOM #1)
      document.querySelectorAll('[data-context-menu="true"] > div').forEach((menuInner) => {
        if (menuInner.dataset.filterPinned === '1') return;
        const filterBtn = [...menuInner.querySelectorAll(':scope > button[role="menuitem"]')].find((btn) =>
          btn.querySelector('svg path[d^="M20 10a1 1 0 0 0 1-1V6"]')
        );
        if (filterBtn && menuInner.firstElementChild !== filterBtn) {
          menuInner.dataset.filterPinned = '1';
          const sep = document.createElement('div');
          sep.setAttribute('role', 'separator');
          sep.style.cssText = 'height:1px;margin:0.25rem 0.5rem;background:var(--contrast-border, var(--border));';
          menuInner.prepend(sep);
          menuInner.prepend(filterBtn);
        }
      });

      // Render model & token usage pills on timeline rows
      const found = findProjectionFromDom();
      if (!found) return;
      const { projection, latestRunId } = found;

      document.querySelectorAll('[data-timeline-row-kind="turn-fold"]').forEach((row) => {
        const rawAttr = row.getAttribute('data-timeline-row-id') || '';
        const runId = rawAttr.startsWith('turn-fold:') ? rawAttr.slice('turn-fold:'.length) : null;
        const info = buildTurnFoldBadge(projection, runId);
        if (!info) return;
        const btn = row.querySelector('button');
        if (!btn || !btn.parentElement) return;
        let pill = row.querySelector('.t3-turn-usage-pill');
        if (!pill) {
          pill = document.createElement('span');
          pill.className = 't3-turn-usage-pill';
          pill.setAttribute('data-quota-ui-managed', 'true');
          btn.insertAdjacentElement('afterend', pill);
        }
        if (pill.textContent !== info.short) {
          pill.textContent = info.short;
          if (info.usage) {
            const detail = [
              info.usage.inputTokens != null ? `总输入: ${info.usage.inputTokens.toLocaleString()} tok` : null,
              info.usage.cachedInputTokens != null
                ? `缓存命中: ${info.usage.cachedInputTokens.toLocaleString()} tok`
                : null,
              info.usage.outputTokens != null ? `总输出: ${info.usage.outputTokens.toLocaleString()} tok` : null,
              info.usage.reasoningTokens != null ? `思考消耗: ${info.usage.reasoningTokens.toLocaleString()} tok` : null,
            ]
              .filter(Boolean)
              .join(' | ');
            if (detail) pill.title = detail;
          }
        }
      });

      document.querySelectorAll('[data-timeline-row-kind="working"]').forEach((row) => {
        const text = buildWorkingBadge(projection, latestRunId);
        if (!text) return;
        const host = row.querySelector('.flex.items-baseline') || row.firstElementChild;
        if (!host) return;
        let pill = row.querySelector('.t3-turn-usage-pill');
        if (!pill) {
          pill = document.createElement('span');
          pill.className = 't3-turn-usage-pill';
          pill.setAttribute('data-quota-ui-managed', 'true');
          host.appendChild(pill);
        }
        if (pill.textContent !== text) pill.textContent = text;
      });
    }

    let rafId = 0;
    const schedule = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        renderAll();
      });
    };

    const obs = new MutationObserver(schedule);
    obs.observe(document.documentElement, { childList: true, subtree: true });
    renderAll();
    const initTimer = setTimeout(renderAll, 500);
    const pollTimer = setInterval(() => {
      checkTaskTransitions();
      if (document.visibilityState === 'visible') {
        renderAll();
      }
    }, 1200);

    const onVisChange = () => {
      if (document.visibilityState === 'visible') {
        renderAll();
      }
    };
    document.addEventListener('visibilitychange', onVisChange);

    window.__T3_WEB_ENHANCER_CLEANUP__ = () => {
      obs.disconnect();
      clearTimeout(initTimer);
      clearInterval(pollTimer);
      document.removeEventListener('visibilitychange', onVisChange);
      document.removeEventListener('pointerdown', onDocPointerDown);
      if (rafId) cancelAnimationFrame(rafId);
      hideRailTooltip();
      closeNotifPopover();
    };
  };

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', initEnhancer, { once: true });
  } else {
    initEnhancer();
  }
})();
