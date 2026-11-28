/**
 * T3M版 Built-in Enhancer Suite v4.0.0 (Desktop Electron + Web + Installed PWA)
 *
 *  1) Telegram-style Left Vertical Project Folder Rail (68px, pinned divider, dual-color live badges)
 *  2) Bottom Utility Actions: 分组 (Custom Sidebar Categories Dialog) · 提醒 (Removable Completed List) · 管理 (Centered Project Popup) · 添加
 *  3) Native OS Notification Passthrough (zero custom OS/toast notification duplication so Windows click-to-jump works natively)
 *  4) Turn-Fold & Live Working Row Model + Token Usage Pills + Hi-Res Vinyl Glass Audio Preview Deck CSS
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
    const COMPLETED_LIST_KEY = 't3m:completed-threads:v1';
    const RAIL_ORDER_KEY = 't3m:project-rail-order:v1';
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
      layers:
        '<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
      'layers-3':
        '<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
      'folder-code':
        '<path d="M10 10.5 8 13l2 2.5"/><path d="m14 10.5 2 2.5-2 2.5"/><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z"/>',
      'folder-git-2':
        '<path d="M9 20H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H20a2 2 0 0 1 2 2v5"/><circle cx="13" cy="12" r="2"/><path d="M18 19c-2.8 0-5-2.2-5-5v8"/><circle cx="20" cy="19" r="2"/>',
      server:
        '<rect width="20" height="8" x="2" y="2" rx="2" ry="2"/><rect width="20" height="8" x="2" y="14" rx="2" ry="2"/><line x1="6" x2="6.01" y1="6" y2="6"/><line x1="6" x2="6.01" y1="18" y2="18"/>',
      'message-square-dashed':
        '<path d="M10 17H7l-4 4v-7"/><path d="M14 17h1"/><path d="M14 3h1"/><path d="M19 3a2 2 0 0 1 2 2"/><path d="M21 14v1a2 2 0 0 1-2 2"/><path d="M21 9v1"/><path d="M3 9v1"/><path d="M5 3a2 2 0 0 0-2 2"/><path d="M9 3h1"/>',
      folder:
        '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
      code: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
      'code-2': '<path d="m18 16 4-4-4-4"/><path d="m6 8-4 4 4 4"/><path d="m14.5 4-5 16"/>',
      terminal: '<polyline points="4 17 10 11 4 5"/><line x1="12" x2="20" y1="19" y2="19"/>',
      globe:
        '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
      'globe-2':
        '<path d="M21.54 15H17a2 2 0 0 0-2 2v4.54"/><path d="M7 3.34V5a3 3 0 0 0 3 3a2 2 0 0 1 2 2c0 1.1.9 2 2 2a2 2 0 0 0 2-2c0-1.1.9-2 2-2h3.17"/><path d="M11 21.95V18a2 2 0 0 0-2-2a2 2 0 0 1-2-2v-1a2 2 0 0 0-2-2H2.05"/><circle cx="12" cy="12" r="10"/>',
      cpu: '<rect width="16" height="16" x="4" y="4" rx="2"/><rect width="6" height="6" x="9" y="9" rx="1"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/>',
      bot: '<path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/>',
      database:
        '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/>',
      'book-open':
        '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
      book: '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20"/>',
      rocket:
        '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>',
      star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
      heart:
        '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
      zap: '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
      flame:
        '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
      compass:
        '<circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>',
      'graduation-cap':
        '<path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>',
      clapperboard:
        '<path d="M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3Z"/><path d="m6.2 5.3 3.1 3.9"/><path d="m12.4 3.4 3.1 4"/><path d="M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
      headphones:
        '<path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"/>',
      image:
        '<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
      cloud: '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>',
      'git-branch':
        '<line x1="6" x2="6" y1="3" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>',
      bug: '<path d="m8 2 1.88 1.88"/><path d="M14.12 3.88 16 2"/><path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1"/><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6"/><path d="M12 20v-9"/><path d="M6.53 9C4.6 8.8 3 7.1 3 5"/><path d="M6 13H2"/><path d="M3 21c0-2.1 1.7-3.9 3.8-4"/><path d="M20.97 5c0 2.1-1.6 3.8-3.5 4"/><path d="M22 13h-4"/><path d="M17.2 17c2.1.1 3.8 1.9 3.8 4"/>',
      bookmark: '<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>',
      'file-text':
        '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
      'file-spreadsheet':
        '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M8 13h2"/><path d="M14 13h2"/><path d="M8 17h2"/><path d="M14 17h2"/>',
      monitor:
        '<rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/>',
      'volume-2':
        '<path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"/><path d="M16 9a5 5 0 0 1 0 6"/><path d="M19.364 18.364a9 9 0 0 0 0-12.728"/>',
      sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
      calendar: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
      'key-round':
        '<path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z"/><circle cx="16.5" cy="7.5" r=".5" fill="currentColor"/>',
      'shield-check':
        '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
      'flask-conical':
        '<path d="M14 2v6a2 2 0 0 0 .245.96l5.51 10.08A2 2 0 0 1 18 22H6a2 2 0 0 1-1.755-2.96l5.51-10.08A2 2 0 0 0 10 8V2"/><path d="M6.453 15h11.094"/><path d="M8.5 2h7"/>',
      film: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 3v18"/><path d="M3 7.5h4"/><path d="M3 12h18"/><path d="M3 16.5h4"/><path d="M17 3v18"/><path d="M17 7.5h4"/><path d="M17 16.5h4"/>',
      music:
        '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
      'audio-lines':
        '<path d="M2 10v3"/><path d="M6 6v11"/><path d="M10 3v18"/><path d="M14 8v7"/><path d="M18 5v13"/><path d="M22 10v3"/>',
      palette:
        '<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>',
      video:
        '<path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5"/><rect x="2" y="6" width="14" height="12" rx="2"/>',
      smartphone: '<rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/>',
      'app-window': '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M10 4v4"/><path d="M2 8h20"/><path d="M6 4v4"/>',
      'trending-up': '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
      'pen-line': '<path d="M12 20h9"/><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z"/>',
      workflow: '<rect width="8" height="8" x="3" y="3" rx="2"/><path d="M7 11v4a2 2 0 0 0 2 2h4"/><rect width="8" height="8" x="13" y="13" rx="2"/>',
      archive:
        '<rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/>',
      inbox:
        '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
      wrench:
        '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
      blocks:
        '<rect width="7" height="7" x="14" y="3" rx="1"/><path d="M10 21V8a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5a1 1 0 0 0-1-1H3"/>',
      lightbulb:
        '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>',
      package:
        '<path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12"/><polyline points="3.29 7 12 12 20.71 7"/><path d="m7.5 4.27 9 5.15"/>',
      gauge: '<path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/>',
      'chart-no-axes-column': '<line x1="18" x2="18" y1="20" y2="10"/><line x1="12" x2="12" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="14"/>',
      presentation: '<path d="M2 3h20"/><path d="M21 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3"/><path d="m7 21 5-5 5 5"/>',
      sparkles:
        '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>',
      'sliders-horizontal':
        '<line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><line x1="14" x2="14" y1="2" y2="6"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="16" x2="16" y1="18" y2="22"/>',
      'folder-plus':
        '<path d="M12 10v6"/><path d="M9 13h6"/><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
      bell: '<path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/>',
      'check-circle':
        '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
      pin: '<path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>',
      'pin-off':
        '<path d="M12 17v5"/><path d="M15 9.34V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H7.89"/><path d="m2 2 20 20"/><path d="M9 9v1.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h11"/>',
      'arrow-up': '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
      'arrow-down': '<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>',
      x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    };

    const SEMANTIC_FOLDER_RULES = [
      [/总控|控制台|中枢|control|dashboard|console|admin|hub/i, 'sliders-horizontal', 'amber'],
      [/工作箱|ai[-_\s]?workspace|agent[-_\s]?box|workbench/i, 'folder-code', 'emerald'],
      [/日常|每日|生活|日记|日程|待办|daily|life|journal|routine/i, 'sun', 'amber'],
      [/资源|教程|书签|收藏|课程|导航|指南|手册|resource|tutorial|guide|bookmark|course/i, 'bookmark', 'cyan'],
      [/越狱|红队|渗透|密钥|鉴权|权限|漏洞|jailbreak|redteam|exploit|auth/i, 'key-round', 'teal'],
      [/安全|防护|合规|审计|加密|隐私|security|shield|audit|crypto/i, 'shield-check', 'emerald'],
      [/逆向|反编译|二进制|脱壳|破解|固件|调试|reverse|decompile|binary|ida|ghidra/i, 'cpu', 'violet'],
      [/大模型|本地模型|模型|推理|微调|训练|llm|ollama|vllm|comfy|lora|checkpoint/i, 'bot', 'purple'],
      [/文献|论文|学术|科研|期刊|paper|literature|scholar/i, 'book-open', 'rose'],
      [/学习|总结|汇总|知识库|笔记|读书|阅读|summary|study|note|wiki/i, 'file-text', 'indigo'],
      [/生信|基因|组学|单细胞|转录|测序|蛋白|临床|医学|实验|bio|rna|dna|genom|clinic|med|lab/i, 'flask-conical', 'teal'],
      [/视频|影视|短剧|分镜|动画|剪辑|漫剧|video|movie|film|anime|storyboard|toon/i, 'film', 'emerald'],
      [/音乐|音频|歌曲|配音|播客|声学|编曲|music|audio|song|voice|tts|podcast/i, 'audio-lines', 'pink'],
      [/图片|图像|画图|生图|视觉|摄影|设计|美术|海报|image|photo|design|art|ui|ux/i, 'palette', 'pink'],
      [/软件|网站|网页|前端|站点|博客|门户|浏览器|web|site|frontend|portal|saas|app/i, 'globe-2', 'sky'],
      [/手机|移动端|安卓|小程序|ios|android|mobile|apk/i, 'smartphone', 'blue'],
      [/桌面|客户端|窗口|windows|mac|electron|desktop/i, 'app-window', 'blue'],
      [/服务器|部署|运维|云|容器|节点|集群|代理|server|cloud|infra|devops|docker|vps|clash|proxy/i, 'server', 'cyan'],
      [/数据库|数据|表格|爬虫|采集|统计|报表|data|sql|db|sheet|excel|crawl|analytics/i, 'database', 'blue'],
      [/量化|交易|股票|基金|金融|行情|策略|回测|财务|账单|quant|trade|trading|finance|stock|billing/i, 'trending-up', 'amber'],
      [/写作|内容|小说|文案|公众号|自媒体|剧本|创作|稿件|writing|content|novel|story|blog|post/i, 'pen-line', 'orange'],
      [/工作流|自动化|定时|流水线|编排|workflow|automation|pipeline|cron/i, 'workflow', 'violet'],
      [/归档|备份|历史|旧版|封存|回收|archive|backup|legacy|old|history/i, 'archive', 'lime'],
      [/下载|临时|草稿|未归类|杂项|download|temp|tmp|scratch|inbox|misc/i, 'inbox', 'gray'],
      [/索引|规则|规范|配置|预设|模板|index|rule|config|preset|template/i, 'layers-3', 'indigo'],
      [/工具|插件|脚本|助手|效率|实用|tool|plugin|script|util|helper|cli/i, 'wrench', 'cyan'],
      [/开发|代码|工程|编程|源码|仓库|框架|组件|dev|code|repo|sdk|lib|pkg/i, 'code-2', 'sky'],
    ];

    const SEMANTIC_FALLBACK_SPECS = [
      ['folder-code', 'sky'],
      ['layers-3', 'indigo'],
      ['sparkles', 'purple'],
      ['blocks', 'emerald'],
      ['lightbulb', 'amber'],
      ['folder-git-2', 'cyan'],
      ['package', 'orange'],
      ['gauge', 'teal'],
      ['terminal', 'blue'],
      ['chart-no-axes-column', 'rose'],
    ];

    function resolveSemanticProjectIcon(title) {
      const cleaned = String(title || '').normalize('NFKC').trim();
      if (!cleaned) return { name: 'folder', color: 'sky' };
      for (const [re, name, color] of SEMANTIC_FOLDER_RULES) {
        if (re.test(cleaned)) return { name, color };
      }
      const pair = SEMANTIC_FALLBACK_SPECS[hashString(cleaned.toLowerCase()) % SEMANTIC_FALLBACK_SPECS.length];
      return { name: pair[0], color: pair[1] };
    }

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

    // ==================== Removable Completed-Sessions List (Pure Notice List, Zero OS/Toast Duplication) ====================
    function loadCompletedList() {
      try {
        const raw = localStorage.getItem(COMPLETED_LIST_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.slice(0, 30) : [];
      } catch {
        return [];
      }
    }

    let completedHistory = loadCompletedList();

    function saveCompletedList() {
      try {
        localStorage.setItem(COMPLETED_LIST_KEY, JSON.stringify(completedHistory));
      } catch {}
    }

    function refreshCompletedUi() {
      saveCompletedList();
      lastRailSignature = '';
      renderProjectRail();
      if (document.getElementById('t3-notif-popover')?.getAttribute('data-open') === '1') {
        renderNotifPopoverContent();
      }
    }

    function addCompletedRecord(entry) {
      // Replace existing record for same scoped thread so the list never stacks duplicates for one conversation
      completedHistory = completedHistory.filter(
        (item) =>
          !(
            item.threadId === entry.threadId &&
            (item.environmentId || '') === (entry.environmentId || '')
          )
      );
      completedHistory.unshift({
        ...entry,
        uid: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        createdAt: Date.now(),
      });
      if (completedHistory.length > 30) completedHistory.length = 30;
      refreshCompletedUi();
    }

    function removeCompletedItem(uid) {
      const before = completedHistory.length;
      completedHistory = completedHistory.filter((item) => item.uid !== uid);
      if (completedHistory.length !== before) {
        refreshCompletedUi();
      }
    }

    function clearAllCompletedItems() {
      if (!completedHistory.length) return;
      completedHistory = [];
      refreshCompletedUi();
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
        if (!t || t.deletedAt || t.archivedAt || t.settledAt || t.settledOverride === 'settled') continue;
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

    // ==================== Completed-Session Recorder ====================
    const threadSnapshotMap = new Map();
    let hasBootstrappedThreads = false;

    function checkTaskTransitions() {
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

        const snapKey = `${t.environmentId || ''}:${t.id}`;
        const prev = threadSnapshotMap.get(snapKey);
        threadSnapshotMap.set(snapKey, { isRunning, runId, runStatus });

        if (!hasBootstrappedThreads) continue;
        if (!prev) continue;

        const completedJustNow =
          (prev.isRunning && !isRunning && runStatus === 'completed') ||
          (!prev.isRunning &&
            !isRunning &&
            runId &&
            prev.runId !== runId &&
            runStatus === 'completed' &&
            t.latestRun?.completedAt &&
            Date.now() - Date.parse(t.latestRun.completedAt) < 15000);

        if (completedJustNow) {
          const projVis = resolveProjectVisual(t.projectId, projects, cbItems);
          const durationStr = fmtDuration(t.latestRun?.startedAt, t.latestRun?.completedAt);
          addCompletedRecord({
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

    // ==================== Completed List Popover (Left Rail Bell) ====================
    const onDocPointerDown = (e) => {
      const ctxMenu = document.getElementById('t3-rail-ctx-menu');
      if (ctxMenu && ctxMenu.getAttribute('data-open') === '1' && !ctxMenu.contains(e.target)) {
        closeRailContextMenu();
      }
      const pop = document.getElementById('t3-notif-popover');
      if (!pop || pop.getAttribute('data-open') !== '1') return;
      if (pop.contains(e.target) || e.target?.closest?.('[data-rail-value="__notify__"]')) return;
      closeNotifPopover();
    };
    const onDocKeyDown = (e) => {
      if (e.key === 'Escape') {
        closeRailContextMenu();
      }
    };
    document.addEventListener('pointerdown', onDocPointerDown);
    document.addEventListener('keydown', onDocKeyDown);

    // ==================== Rail Custom Order & Right-Click Context Menu ====================
    function loadRailOrder() {
      try {
        const raw = localStorage.getItem(RAIL_ORDER_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : [];
      } catch {
        return [];
      }
    }

    function saveRailOrder(order) {
      try {
        localStorage.setItem(RAIL_ORDER_KEY, JSON.stringify(order));
      } catch {}
    }

    const optimisticPinMap = new Map();

    function isItemEffectivelyPinned(value, rawPinned) {
      const ov = optimisticPinMap.get(value);
      if (ov && ov.until > Date.now()) {
        if (ov.pinned === rawPinned) optimisticPinMap.delete(value);
        return ov.pinned;
      }
      if (ov) optimisticPinMap.delete(value);
      return rawPinned;
    }

    function sortRailItemsWithOrder(items) {
      const order = loadRailOrder();
      const idxMap = new Map(order.map((val, i) => [val, i]));
      const sortTier = (arr) =>
        [...arr].sort((a, b) => {
          const ia = idxMap.has(a.value) ? idxMap.get(a.value) : 1e9;
          const ib = idxMap.has(b.value) ? idxMap.get(b.value) : 1e9;
          if (ia !== ib) return ia - ib;
          return 0;
        });
      const pinnedTier = sortTier(items.filter((it) => it.pinned));
      const unpinnedTier = sortTier(items.filter((it) => !it.pinned));
      return { pinnedTier, unpinnedTier, combined: [...pinnedTier, ...unpinnedTier] };
    }

    function moveRailItem(targetValue, direction, tierItems) {
      const values = tierItems.map((it) => it.value);
      const pos = values.indexOf(targetValue);
      const swapPos = pos + direction;
      if (pos < 0 || swapPos < 0 || swapPos >= values.length) return;
      const nextTier = [...values];
      const tmp = nextTier[pos];
      nextTier[pos] = nextTier[swapPos];
      nextTier[swapPos] = tmp;

      const existing = loadRailOrder().filter((v) => !values.includes(v));
      saveRailOrder([...nextTier, ...existing]);
      window.dispatchEvent(new CustomEvent('t3m:rail-order-updated'));
      lastRailSignature = '';
      renderProjectRail();
    }

    function toggleRailItemPin(item, allTierValues) {
      const nextPinned = !item.pinned;
      optimisticPinMap.set(item.value, { pinned: nextPinned, until: Date.now() + 1800 });
      // Place newly pinned/unpinned item cleanly at top of its target tier if not ordered
      const curOrder = loadRailOrder().filter((v) => v !== item.value);
      saveRailOrder(nextPinned ? [item.value, ...curOrder] : [...allTierValues.filter((v) => v !== item.value), item.value, ...curOrder]);

      const bridge = window.__t3mProjectRailBridge;
      if (bridge && typeof bridge.setProjectPinned === 'function') {
        bridge.setProjectPinned(item.value, nextPinned);
      }
      lastRailSignature = '';
      renderProjectRail();
    }

    function ensureRailContextMenu() {
      let menu = document.getElementById('t3-rail-ctx-menu');
      if (!menu) {
        menu = document.createElement('div');
        menu.id = 't3-rail-ctx-menu';
        menu.setAttribute('data-quota-ui-managed', 'true');
        menu.setAttribute('role', 'menu');
        menu.setAttribute('data-open', '0');
        document.body.appendChild(menu);
      }
      return menu;
    }

    function closeRailContextMenu() {
      const menu = document.getElementById('t3-rail-ctx-menu');
      if (menu) menu.setAttribute('data-open', '0');
    }

    function openRailContextMenu(mouseEvent, item, tierItems, allCombinedValues) {
      mouseEvent.preventDefault();
      mouseEvent.stopPropagation();
      hideRailTooltip();
      closeNotifPopover();

      const tierIdx = tierItems.findIndex((it) => it.value === item.value);
      const canMoveUp = tierIdx > 0;
      const canMoveDown = tierIdx >= 0 && tierIdx < tierItems.length - 1;

      const menu = ensureRailContextMenu();
      menu.innerHTML = '';

      const titleBar = document.createElement('div');
      titleBar.className = 't3-rcm-header';
      titleBar.textContent = item.label;
      menu.appendChild(titleBar);

      const actions = [
        {
          id: 'pin',
          label: item.pinned ? '取消置顶' : '置顶',
          icon: item.pinned ? 'pin-off' : 'pin',
          disabled: false,
          onRun: () => toggleRailItemPin(item, allCombinedValues),
        },
        {
          id: 'up',
          label: '向上移动',
          icon: 'arrow-up',
          disabled: !canMoveUp,
          onRun: () => moveRailItem(item.value, -1, tierItems),
        },
        {
          id: 'down',
          label: '向下移动',
          icon: 'arrow-down',
          disabled: !canMoveDown,
          onRun: () => moveRailItem(item.value, 1, tierItems),
        },
      ];

      for (const act of actions) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 't3-rcm-item';
        btn.setAttribute('role', 'menuitem');
        if (act.disabled) btn.disabled = true;
        btn.innerHTML = `<span class="t3-rcm-icon">${svgIcon(act.icon, 14)}</span><span class="t3-rcm-label"></span>`;
        btn.querySelector('.t3-rcm-label').textContent = act.label;
        btn.addEventListener('click', (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          closeRailContextMenu();
          if (!act.disabled) act.onRun();
        });
        menu.appendChild(btn);
      }

      const x = Math.min(window.innerWidth - 160, Math.max(8, mouseEvent.clientX + 6));
      const y = Math.min(window.innerHeight - 148, Math.max(8, mouseEvent.clientY - 6));
      menu.style.left = `${Math.round(x)}px`;
      menu.style.top = `${Math.round(y)}px`;
      menu.setAttribute('data-open', '1');
    }

    function ensureNotifPopover() {
      let pop = document.getElementById('t3-notif-popover');
      if (!pop) {
        pop = document.createElement('div');
        pop.id = 't3-notif-popover';
        pop.setAttribute('data-quota-ui-managed', 'true');
        pop.setAttribute('aria-label', '已完成对话列表');
        pop.setAttribute('data-open', '0');
        document.body.appendChild(pop);
      }
      return pop;
    }

    function closeNotifPopover() {
      const pop = document.getElementById('t3-notif-popover');
      if (pop) pop.setAttribute('data-open', '0');
    }

    function renderNotifPopoverContent() {
      const pop = ensureNotifPopover();
      pop.innerHTML = '';

      const header = document.createElement('div');
      header.className = 't3-np-header';
      header.innerHTML = `
        <div class="t3-np-title-wrap">
          <span class="t3-np-title">已完成列表</span>
          <span class="t3-np-pwa-tag">${completedHistory.length}</span>
        </div>
        <div class="t3-np-actions">
          ${completedHistory.length > 0 ? '<button type="button" class="t3-np-link-btn" data-act="clear">清空全部</button>' : ''}
        </div>
      `;
      const clearBtn = header.querySelector('[data-act="clear"]');
      if (clearBtn) {
        clearBtn.addEventListener('click', () => {
          clearAllCompletedItems();
        });
      }
      pop.appendChild(header);

      const list = document.createElement('div');
      list.className = 't3-np-list';
      if (!completedHistory.length) {
        const empty = document.createElement('div');
        empty.className = 't3-np-empty';
        empty.textContent = '暂无已完成的对话记录 · 对话完成后将在此列出，可点击跳转或单独移除';
        list.appendChild(empty);
      } else {
        for (const item of completedHistory) {
          const row = document.createElement('div');
          row.className = 't3-np-item';
          row.innerHTML = `
            <button type="button" class="t3-np-item-jump">
              <span class="t3-np-item-dot" style="--dot-color:${item.colorHex || '#10b981'}"></span>
              <span class="t3-np-item-main">
                <span class="t3-np-item-top">
                  <span class="t3-np-item-proj"></span>
                  <span class="t3-np-item-time">${item.durationStr ? `${item.durationStr} · ` : ''}${fmtClockTime(item.createdAt)}</span>
                </span>
                <span class="t3-np-item-title"></span>
              </span>
            </button>
            <button type="button" class="t3-np-item-remove" aria-label="移除该记录" title="从列表移除">${svgIcon('x', 13)}</button>
          `;
          row.querySelector('.t3-np-item-proj').textContent = item.projectTitle || '未归类';
          row.querySelector('.t3-np-item-title').textContent = item.title || '未命名会话';
          row.querySelector('.t3-np-item-jump').addEventListener('click', () => {
            jumpToTask(item.environmentId, item.threadId, item.projectValue);
          });
          row.querySelector('.t3-np-item-remove').addEventListener('click', (e) => {
            e.stopPropagation();
            removeCompletedItem(item.uid);
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
      if (document.getElementById('t3-stardust-enhancer-v400-style')) return;
      const style = document.createElement('style');
      style.id = 't3-stardust-enhancer-v400-style';
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

        /* Project Scope Modal inner scroll sizing (backdrop & transition handled natively by ComboboxPopup) */
        [data-project-scope-popup="true"] [data-slot="scroll-area"] {
          flex: 1 1 auto !important;
          min-height: 0 !important;
        }
        [data-project-scope-popup="true"] [data-slot="scroll-area-viewport"] {
          max-height: min(22rem, 56vh) !important;
          overflow-y: auto !important;
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
          min-height: 38px;
          padding: 3px 2px 3px;
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

        .t3-rail-icon-wrap > svg {
          width: 16px;
          height: 16px;
          display: block;
          flex-shrink: 0;
          overflow: visible;
        }

        .t3-rail-btn--utility .t3-rail-icon-wrap {
          width: 20px;
          height: 20px;
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

        /* Prevent horizontal clipping on mixed English/Chinese labels like Summary... */
        .t3-rail-label {
          display: block;
          flex-shrink: 0;
          width: 72px;
          max-width: 72px;
          padding: 0 3px 1px;
          box-sizing: border-box;
          font-size: 12px;
          line-height: 1.42;
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

        #t3-notif-popover {
          position: fixed;
          z-index: 2147483643;
          width: 320px;
          max-height: min(440px, calc(100vh - 32px));
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
          font-size: 10.5px;
          font-weight: 650;
          font-variant-numeric: tabular-nums;
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
          padding: 2px 6px;
          border-radius: 5px;
          font-size: 11.5px;
          font-weight: 500;
          color: var(--muted-foreground);
          cursor: pointer;
          transition: background-color 120ms ease, color 120ms ease;
        }
        .t3-np-link-btn:hover {
          color: var(--foreground);
          background: color-mix(in srgb, var(--foreground) 8%, transparent);
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
          gap: 4px;
          padding: 4px 6px 4px 8px;
          border-radius: 10px;
          transition: background-color 120ms ease;
        }
        .t3-np-item:hover {
          background: color-mix(in srgb, var(--foreground) 7%, transparent);
        }
        .t3-np-item-jump {
          flex: 1 1 0%;
          min-width: 0;
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 4px 2px;
          border: 0;
          background: transparent;
          color: var(--foreground);
          text-align: left;
          cursor: pointer;
        }
        .t3-np-item-dot {
          width: 7px;
          height: 7px;
          border-radius: 999px;
          flex-shrink: 0;
          background: var(--dot-color, #10b981);
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
        .t3-np-item-remove {
          width: 24px;
          height: 24px;
          border: 0;
          border-radius: 6px;
          background: transparent;
          color: var(--muted-foreground);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          cursor: pointer;
          opacity: 0.65;
          transition: opacity 120ms ease, background-color 120ms ease, color 120ms ease;
        }
        .t3-np-item:hover .t3-np-item-remove {
          opacity: 1;
        }
        .t3-np-item-remove:hover {
          background: color-mix(in srgb, var(--foreground) 12%, transparent);
          color: var(--foreground);
        }

        /* Project Rail Right-Click Context Menu */
        #t3-rail-ctx-menu {
          position: fixed;
          z-index: 2147483646;
          min-width: 144px;
          padding: 5px;
          border-radius: 11px;
          background: var(--t3-float-bg);
          border: 1px solid var(--t3-float-border);
          box-shadow: 0 16px 38px rgba(0, 0, 0, 0.45);
          -webkit-backdrop-filter: blur(20px) saturate(1.5);
          backdrop-filter: blur(20px) saturate(1.5);
          display: flex;
          flex-direction: column;
          gap: 2px;
          opacity: 0;
          pointer-events: none;
          transform: scale(0.96);
          transform-origin: top left;
          transition: opacity 120ms ease, transform 120ms cubic-bezier(0.2, 0.9, 0.3, 1);
          user-select: none;
          -webkit-app-region: no-drag;
        }
        #t3-rail-ctx-menu[data-open="1"] {
          opacity: 1;
          pointer-events: auto;
          transform: scale(1);
        }
        .t3-rcm-header {
          padding: 4px 8px 5px;
          margin-bottom: 2px;
          font-size: 11px;
          font-weight: 600;
          color: var(--muted-foreground);
          border-bottom: 1px solid color-mix(in srgb, var(--foreground) 9%, transparent);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 168px;
        }
        .t3-rcm-item {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          height: 29px;
          padding: 0 8px;
          border: 0;
          border-radius: 7px;
          background: transparent;
          color: var(--foreground);
          font-size: 12.5px;
          font-weight: 500;
          text-align: left;
          cursor: pointer;
          transition: background-color 110ms ease, color 110ms ease;
        }
        .t3-rcm-item:hover:not(:disabled) {
          background: color-mix(in srgb, var(--foreground) 9%, transparent);
        }
        .t3-rcm-item:active:not(:disabled) {
          transform: scale(0.985);
        }
        .t3-rcm-item:disabled {
          opacity: 0.38;
          cursor: not-allowed;
        }
        .t3-rcm-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: var(--muted-foreground);
          flex-shrink: 0;
        }
        .t3-rcm-item:hover:not(:disabled) .t3-rcm-icon {
          color: var(--foreground);
        }

        @media (prefers-reduced-motion: reduce) {
          .t3-rail-btn,
          .t3-rail-icon-wrap,
          #t3-rail-tooltip,
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
        closeRailContextMenu();
        cfg.onClick(e, btn);
      });
      if (typeof cfg.onContextMenu === 'function') {
        btn.addEventListener('contextmenu', (e) => {
          cfg.onContextMenu(e, btn);
        });
      }

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
      const completedCount = completedHistory.length;

      const rawEnriched = projectItems.map((it) => {
        const rec = matchProjectRecord(it, projects);
        const st = (rec?.id && stats.byProjectId.get(rec.id)) || { active: 0, running: 0 };
        const rawPinned = Boolean(it.pinned ?? rec?.pinned ?? rec?.pinnedAt);
        const pinned = isItemEffectivelyPinned(it.value, rawPinned);
        const iconObj = rec?.projectIcon || null;
        const sem = resolveSemanticProjectIcon(it.label);
        const explicitLucide = iconObj?.kind === 'lucide' && iconObj.name ? iconObj.name : null;
        const keepAsciiMonogram =
          iconObj?.kind === 'monogram' &&
          typeof iconObj.text === 'string' &&
          /^[A-Za-z0-9]{1,2}$/.test(iconObj.text.trim())
            ? iconObj.text.trim().toUpperCase()
            : null;
        const chosenIconName = explicitLucide || (!keepAsciiMonogram ? sem.name : null);
        const colorKey =
          (iconObj?.color && COLOR_MAP[iconObj.color] ? iconObj.color : null) ||
          sem.color ||
          FALLBACK_PALETTE[hashString(rec?.id || it.value) % FALLBACK_PALETTE.length];
        const colorHex = COLOR_MAP[colorKey] || COLOR_MAP.sky;
        const iconSvg = chosenIconName ? svgIcon(chosenIconName, 16) : null;
        const monogram = !iconSvg ? keepAsciiMonogram || pickMonogramGlyph(it.label) : null;

        return {
          value: it.value,
          label: it.label,
          shortLabel: shortRailLabel(it.label),
          pinned,
          colorHex,
          iconKey: chosenIconName || `mono:${monogram}`,
          iconSvg,
          monogram,
          activeCount: st.active,
          runningCount: st.running,
          selected: selectedSet.has(it.value),
        };
      });

      const { pinnedTier, unpinnedTier, combined: enriched } = sortRailItemsWithOrder(rawEnriched);
      const allCombinedValues = enriched.map((e) => e.value);

      const sig = JSON.stringify({
        sel: [...selectedSet],
        totalA: stats.totalActive,
        totalR: stats.totalRunning,
        doneN: completedCount,
        list: enriched.map((e) => [
          e.value,
          e.label,
          e.pinned ? 1 : 0,
          e.colorHex,
          e.iconKey,
          e.activeCount,
          e.runningCount,
        ]),
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
        subParts.push('右键可置顶/上下移动');

        const tierForItem = item.pinned ? pinnedTier : unpinnedTier;
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
            onContextMenu: (e) => openRailContextMenu(e, item, tierForItem, allCombinedValues),
          })
        );
      }

      rail.appendChild(scrollBox);
      if (prevScrollTop > 0) scrollBox.scrollTop = prevScrollTop;

      // 3. Bottom sticky utility actions ("分组" + "提醒" + "管理" + "添加")
      const bottomBox = document.createElement('div');
      bottomBox.className = 't3-rail-bottom';

      bottomBox.appendChild(
        createRailButton({
          value: '__group__',
          label: '分组',
          shortLabel: '分组',
          ariaLabel: '自定义侧边栏分类与关键词',
          tipTitle: '侧边栏分类设置',
          tipSub: '自定义标签 · 关键词 · 星标模型建议',
          compact: true,
          utility: true,
          iconSvg: svgIcon('layers', 16),
          badgeCount: 0,
          onClick: () => {
            window.dispatchEvent(new CustomEvent('t3m:open-category-settings'));
          },
        })
      );

      bottomBox.appendChild(
        createRailButton({
          value: '__notify__',
          label: '提醒',
          shortLabel: '提醒',
          ariaLabel: `已完成对话列表${completedCount > 0 ? `，共 ${completedCount} 条` : ''}`,
          tipTitle: '已完成对话列表',
          tipSub: completedCount > 0 ? `${completedCount} 条记录 · 点击查看或移除` : '仅汇总已完成会话，可随时移除',
          compact: true,
          utility: true,
          notifActive: completedCount > 0,
          iconSvg: svgIcon('bell', 16),
          badgeCount: completedCount,
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
        const filterBtn = [...menuInner.querySelectorAll(':scope > button[role="menuitem"]')].find(
          (btn) =>
            btn.querySelector('svg path[d^="M20 10a1 1 0 0 0 1-1V6"]') &&
            !btn.textContent?.includes('归入分类')
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
      document.removeEventListener('keydown', onDocKeyDown);
      if (rafId) cancelAnimationFrame(rafId);
      hideRailTooltip();
      closeNotifPopover();
      closeRailContextMenu();
    };
  };

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', initEnhancer, { once: true });
  } else {
    initEnhancer();
  }
})();
