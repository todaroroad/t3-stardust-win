import * as NodeFS from "node:fs";
import { ev, send, wait, close } from "./zh-copy-cdp.mjs";
const phase = process.argv[2] ?? "after";
const results = [];
await send("Page.bringToFront");
export async function settled() {
  await ev("document.activeElement?.blur()");
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 15, y: 15 });
  for (let i = 0; i < 40; i++) {
    await wait(100);
    if (
      await ev(`document.getAnimations().filter(a=>a.playState==='running'||a.pending).length===0`)
    ) {
      await wait(250);
      if (
        await ev(
          `document.getAnimations().filter(a=>a.playState==='running'||a.pending).length===0`,
        )
      )
        return;
    }
  }
  throw Error("Animations did not settle");
}
const collect = () => {
  const all = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const text = node.textContent.trim();
    if (!/[a-zA-Z]/.test(text)) continue;
    const element = node.parentElement;
    if (
      !element ||
      element.closest(
        'script,style,pre,code,.chat-markdown,.tiptap,[data-thread-find-text="true"],.sr-only',
      )
    )
      continue;
    let hidden = false;
    for (let p = element; p; p = p.parentElement) {
      const s = getComputedStyle(p);
      if (s.display === "none" || s.visibility === "hidden" || Number(s.opacity) === 0) {
        hidden = true;
        break;
      }
    }
    if (hidden) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    const rect = [...range.getClientRects()].find(
      (r) =>
        r.width > 1 &&
        r.height > 1 &&
        r.bottom > 0 &&
        r.top < innerHeight &&
        r.right > 0 &&
        r.left < innerWidth,
    );
    if (!rect) continue;
    let clipped = false;
    for (let p = element.parentElement; p; p = p.parentElement) {
      const s = getComputedStyle(p),
        r = p.getBoundingClientRect();
      if (
        /hidden|auto|scroll|clip/.test(s.overflowY) &&
        (rect.bottom <= r.top || rect.top >= r.bottom)
      ) {
        clipped = true;
        break;
      }
    }
    if (clipped) continue;
    // Artifact names/folder metadata and editable field values are data, never application copy.
    const data =
      element.closest("[data-artifact-id]") &&
      (element.tagName === "SMALL" || element.classList.contains("truncate"));
    all.push({
      text,
      data: !!data,
      tag: element.tagName,
      cls: element.className,
      top: Math.round(rect.top),
    });
  }
  return all;
};
// Exact product/protocol/format names and model identifiers. Never whitelist status verbs or whole English sentences.
const terms =
  /\b(?:T3(?: Code)?|Stardust|Code|AI|API|SDK|CLI|MCP|ACP|HTTP|HTTPS|WebSocket|JSON|HTML|MD|TXT|PNG|SVG|PDF|CSV|OAuth|SSH|URL|URI|UUID|CPU|RAM|GB|MB|KB|GiB|MiB|B|K|M|USD|GMT|UTC|Finder|GitHub|Git|Codex|Claude|Grok|Gemini|Antigravity|Cursor|OpenAI|Anthropic|Google|Chrome|Chromium|Safari|Firefox|Edge|Obsidian|MacBook|Air|macOS|Windows|Linux|iOS|Android|ChatGPT|GPT|Pro|Max|Opus|Sonnet|Haiku|Argon|Flash|DeepSeek|Qwen|Ollama|Node|Electron|X|App|VS Code|VSCode|Zed|Warp|iTerm2|Terminal)\b/g;
function unknown(row) {
  if (
    row.data ||
    /^(?:\/Users\/|\/Volumes\/)/.test(row.text) ||
    /^(?:Cache|sessions|projects|statev2\.sqlite|logs|attachments)$/.test(row.text)
  )
    return "";
  let s = row.text
    .replace(/Grok Build/g, "")
    .replace(/(?:https?:\/\/|\/Users\/|\/Volumes\/)[^\s]+/g, "")
    .replace(
      /[^\s]*\.(?:md|html|png|jpg|json|txt|tsx?|jsx?|py|css|svg|pdf|log|yml|toml|zip)\b/g,
      "",
    )
    .replace(/\b(?:gpt|codex|claude|gemini|o|deepseek|grok|qwen)[-\w.]+/gi, "")
    .replace(/\bv\d+(?:\.\d+)*\b/g, "")
    .replace(/\b\d+(?:\.\d+)?\s*(?:ms|s|m|h|d|B|GB|MB|KB|GiB|MiB|K|M)\b/g, "")
    .replace(terms, "");
  return (s.match(/[A-Za-z][A-Za-z_-]*/g) || []).filter((w) => w !== "T").join(" ");
}
async function capture(name) {
  await settled();
  const rows = await ev(`(${collect})()`);
  const failures = rows.map((r) => ({ ...r, unknown: unknown(r) })).filter((r) => r.unknown);
  results.push({ name, lang: await ev("document.documentElement.lang"), rows, failures });
  console.log(
    name,
    failures.map((r) => r.text),
  );
  NodeFS.writeFileSync(
    `implementation/c72-evidence/visible-copy-${phase}.json`,
    JSON.stringify(results, null, 2),
  );
}
async function nav(path) {
  await ev(`location.hash=${JSON.stringify(path)}`);
  await wait(1400);
}
try {
  await nav("/ea117abc-950b-4d1b-8f99-d846054205b6/00dd0a48-c164-46cf-9541-d81738b32702");
  await capture("conversation");
  await nav("/draft/4f046430-db33-46a5-aff7-411be7e8cc4d");
  await capture("main-new-conversation");
  await nav("/usage");
  await wait(1300);
  for (const [name, label] of [
    ["cost", "费用"],
    ["tokens", "令牌"],
    ["limits", "限额"],
    ["cleanup", "清理与整理"],
  ]) {
    await ev(
      `(()=>{const d=[...document.querySelectorAll('[role=dialog]')].at(-1);const b=[...d.querySelectorAll('button')].find(e=>e.innerText===${JSON.stringify(label)});if(!b)throw Error('Missing tab');b.click()})()`,
    );
    await wait(1200);
    await capture("usage-" + name);
  }
  await nav("/settings/general");
  await capture("settings-general");
} finally {
  close();
}
const errors = results.flatMap((r) => r.failures);
if (results.length !== 7 || results.some((r) => r.lang !== "zh") || errors.length)
  process.exitCode = 1;
