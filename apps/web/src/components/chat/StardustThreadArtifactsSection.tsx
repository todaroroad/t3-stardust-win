import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { ThreadStructure } from "@t3tools/client-runtime/state/shell";
import type { EnvironmentId, ProjectId, ThreadId } from "@t3tools/contracts";
import { workspaceRelativeFilePath } from "@t3tools/shared/path";
import {
  CheckIcon,
  ChevronDownIcon,
  CopyIcon,
  FileCode2Icon,
  FileSpreadsheetIcon,
  FileTextIcon,
  FilmIcon,
  GlobeIcon,
  ImageIcon,
  PackageIcon,
} from "lucide-react";
import { memo, useMemo, useState } from "react";

import { useCopyToClipboard } from "~/hooks/useCopyToClipboard";
import { cn } from "~/lib/utils";
import { selectThreadPanelOpen, useRightPanelStore } from "~/rightPanelStore";
import { useQuietThreadProjection } from "~/state/entities";
import { useProjectPathSearch } from "~/state/queries";
import type { ChatFileAttachment } from "~/types";
import { ThreadDetailsSection } from "./ThreadDetailsSection";

type ArtifactKind = "document" | "page" | "image" | "video" | "code";

interface StardustArtifactItem {
  readonly id: string;
  readonly name: string;
  readonly displayPath: string;
  readonly openPath: string;
  readonly kind: ArtifactKind;
  readonly source: "change" | "tool" | "link" | "attachment" | "workspace";
  readonly detail?: string | undefined;
  readonly attachment?: ChatFileAttachment | undefined;
}

const IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "webp", "gif", "svg", "bmp", "avif", "ico"]);
const VIDEO_EXTS = new Set(["mp4", "webm", "mov", "m4v", "mkv", "mp3", "wav", "flac", "ogg", "m4a"]);
const PAGE_EXTS = new Set(["html", "htm"]);
const DOC_EXTS = new Set([
  "md",
  "mdx",
  "markdown",
  "pdf",
  "docx",
  "xlsx",
  "pptx",
  "csv",
  "tsv",
  "txt",
  "rtf",
]);
const CODE_EXTS = new Set([
  "ts",
  "tsx",
  "js",
  "jsx",
  "mjs",
  "cjs",
  "py",
  "ipynb",
  "sh",
  "ps1",
  "cmd",
  "bat",
  "json",
  "yaml",
  "yml",
  "toml",
  "sql",
  "r",
  "rmd",
  "css",
  "go",
  "rs",
  "java",
  "cpp",
  "c",
]);

const NOISE_PATH_RE =
  /(?:^|[\\/])(?:node_modules|\.git|\.next|dist-electron|\.vite-plus|\.cache|__pycache__|\.t3[\\/]userdata|antigravity-acp[\\/]brain)(?:[\\/]|$)/i;

const NOISE_BASENAME_RE =
  /^(?:pnpm-lock\.yaml|package-lock\.json|yarn\.lock|bun\.lockb?|tsconfig.*\.json|\..*ignore)$/i;

function classifyExtension(filePath: string, mimeType?: string): ArtifactKind | null {
  const clean = filePath.split(/[?#]/)[0] ?? filePath;
  const base = clean.split(/[\\/]/).at(-1) ?? "";
  const dot = base.lastIndexOf(".");
  const ext = dot > 0 ? base.slice(dot + 1).toLowerCase() : "";
  if (mimeType) {
    if (mimeType.startsWith("image/")) return "image";
    if (mimeType.startsWith("video/") || mimeType.startsWith("audio/")) return "video";
    if (mimeType === "text/html") return "page";
  }
  if (IMAGE_EXTS.has(ext)) return "image";
  if (VIDEO_EXTS.has(ext)) return "video";
  if (PAGE_EXTS.has(ext)) return "page";
  if (DOC_EXTS.has(ext)) return "document";
  if (CODE_EXTS.has(ext)) return "code";
  return null;
}

function normalizeCandidatePath(
  raw: string,
  cwd: string | null,
): { readonly openPath: string; readonly displayPath: string; readonly name: string } | null {
  let cleaned = raw.trim().replace(/^<|>$/g, "");
  if (!cleaned || cleaned.includes("\0")) return null;
  if (/^file:\/\//i.test(cleaned)) {
    try {
      const u = new URL(cleaned);
      let p = decodeURIComponent(u.pathname);
      if (/^\/[A-Za-z]:\//.test(p)) p = p.slice(1);
      cleaned = p;
    } catch {
      cleaned = cleaned.replace(/^file:\/\/\/?/i, "");
    }
  } else if (/^[a-z][a-z0-9+.-]*:/i.test(cleaned) && !/^[A-Za-z]:[\\/]/.test(cleaned)) {
    // Skip http://, https://, t3-thread://, conversation://, etc.
    return null;
  }

  // Strip trailing #L10 or :10:5 line anchors
  cleaned = cleaned.replace(/#L\d+(?:-L?\d+)?$/i, "").replace(/:(\d+)(?::\d+)?$/, "");
  if (!cleaned || NOISE_PATH_RE.test(cleaned)) return null;

  const normalizedSlashes = cleaned.replace(/\\/g, "/").replace(/\/+$/, "");
  const name = normalizedSlashes.split("/").at(-1) ?? "";
  if (!name || NOISE_BASENAME_RE.test(name)) return null;

  if (cwd) {
    const rel = workspaceRelativeFilePath(cleaned, cwd);
    if (rel && rel !== "." && !rel.startsWith("..")) {
      const relSlash = rel.replace(/\\/g, "/");
      return { openPath: relSlash, displayPath: relSlash, name };
    }
  }

  return {
    openPath: normalizedSlashes,
    displayPath: normalizedSlashes,
    name,
  };
}

function extractMarkdownPaths(markdown: string): readonly string[] {
  const out: string[] = [];
  const linkRe = /\]\(\s*<?([^)\s>]+)>?\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(markdown)) !== null) {
    if (m[1]) out.push(m[1]);
  }
  return out;
}

function collectSessionArtifacts(
  projection: ThreadStructure | null | undefined,
  cwd: string | null,
): readonly StardustArtifactItem[] {
  if (!projection) return [];
  const byKey = new Map<string, StardustArtifactItem>();

  const upsert = (
    rawPath: string,
    source: StardustArtifactItem["source"],
    detail?: string,
  ) => {
    const norm = normalizeCandidatePath(rawPath, cwd);
    if (!norm) return;
    const kind = classifyExtension(norm.name);
    if (!kind) return;
    const key = norm.openPath.toLowerCase();
    // Later items in turnItems are newer: overwrite so re-ordered map puts newest at end
    if (byKey.has(key)) byKey.delete(key);
    byKey.set(key, {
      id: `path:${norm.openPath}`,
      name: norm.name,
      displayPath: norm.displayPath,
      openPath: norm.openPath,
      kind,
      source,
      detail,
    });
  };

  for (const cp of projection.checkpoints) {
    if (cp.status !== "ready") continue;
    for (const f of cp.files) {
      if (f.kind === "deleted" || f.kind === "D") {
        const norm = normalizeCandidatePath(f.path, cwd);
        if (norm) byKey.delete(norm.openPath.toLowerCase());
        continue;
      }
      const stat =
        f.additions > 0 || f.deletions > 0 ? `+${f.additions} -${f.deletions}` : undefined;
      upsert(f.path, "change", stat);
    }
  }

  for (const item of projection.turnItems) {
    if (item.type === "file_change") {
      const isDeleted =
        Boolean(item.changes?.length) && item.changes!.every((c) => c.operation === "delete");
      if (isDeleted) {
        const norm = normalizeCandidatePath(item.fileName, cwd);
        if (norm) byKey.delete(norm.openPath.toLowerCase());
        continue;
      }
      const stat =
        item.additions != null || item.deletions != null
          ? `+${item.additions ?? 0} -${item.deletions ?? 0}`
          : undefined;
      upsert(item.fileName, "change", stat);
      continue;
    }

    if (item.type === "dynamic_tool") {
      const toolName = String(item.toolName || "");
      let inp: Record<string, unknown> | null = null;
      if (item.input && typeof item.input === "object" && !Array.isArray(item.input)) {
        inp = item.input as Record<string, unknown>;
      } else if (typeof item.input === "string" && item.input.trim().startsWith("{")) {
        try {
          const parsed = JSON.parse(item.input) as unknown;
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            inp = parsed as Record<string, unknown>;
          }
        } catch {
          inp = null;
        }
      }
      if (/write_file|edit_file|html_render|save/i.test(toolName) && inp) {
        const p =
          typeof inp.Path === "string"
            ? inp.Path
            : typeof inp.path === "string"
              ? inp.path
              : null;
        if (p) upsert(p, "tool");
      }
      continue;
    }

    if (item.type === "proposed_plan") {
      if (item.markdown) {
        for (const p of extractMarkdownPaths(item.markdown)) {
          upsert(p, "link");
        }
      }
    }
  }

  for (const plan of projection.plans) {
    if (plan.kind === "proposed_plan" && plan.markdown) {
      for (const p of extractMarkdownPaths(plan.markdown)) {
        upsert(p, "link");
      }
    }
  }

  for (const message of projection.messages) {
    if (message.role === "assistant" && message.text) {
      for (const p of extractMarkdownPaths(message.text)) {
        upsert(p, "link");
      }
    }
    for (const att of message.attachments) {
      if (att.type !== "file" && att.type !== "image") continue;
      const kind = classifyExtension(att.name, att.mimeType) ?? "document";
      const key = `att:${att.id}`;
      byKey.set(key, {
        id: key,
        name: att.name,
        displayPath: att.type === "image" ? "会话图片附件" : "会话文件附件",
        openPath: att.name,
        kind,
        source: "attachment",
        attachment: {
          type: "file",
          id: att.id,
          name: att.name,
          mimeType: att.mimeType,
          sizeBytes: att.sizeBytes,
          ...(att.type === "file" && "htmlRender" in att && att.htmlRender === true
            ? { htmlRender: true }
            : {}),
        },
      });
    }
  }

  return [...byKey.values()].reverse();
}

function ArtifactKindGlyph({ kind }: { readonly kind: ArtifactKind }) {
  switch (kind) {
    case "image":
      return <ImageIcon className="size-3.5 shrink-0 text-pink-400" />;
    case "video":
      return <FilmIcon className="size-3.5 shrink-0 text-purple-400" />;
    case "page":
      return <GlobeIcon className="size-3.5 shrink-0 text-sky-400" />;
    case "code":
      return <FileCode2Icon className="size-3.5 shrink-0 text-emerald-400" />;
    case "document":
    default:
      return <FileTextIcon className="size-3.5 shrink-0 text-amber-400" />;
  }
}

const FILTER_LABELS: ReadonlyArray<{ readonly id: "all" | ArtifactKind; readonly label: string }> = [
  { id: "all", label: "全部" },
  { id: "document", label: "文档" },
  { id: "page", label: "网页" },
  { id: "image", label: "图片" },
  { id: "video", label: "音视频" },
  { id: "code", label: "代码" },
];

const ISOLATED_PROJECT_ID = "70f0f604-0375-4a30-a76e-dd7bbf6449cb";

export const StardustThreadArtifactsSection = memo(function StardustThreadArtifactsSection({
  environmentId,
  threadId,
  projectId,
  gitCwd,
  isServerThread,
  isDraft,
}: {
  readonly environmentId: EnvironmentId;
  readonly threadId: ThreadId;
  readonly projectId: ProjectId;
  readonly gitCwd: string | null;
  readonly isServerThread: boolean;
  readonly isDraft: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const [scope, setScope] = useState<"thread" | "project">("thread");
  const [filter, setFilter] = useState<"all" | ArtifactKind>("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { copyToClipboard } = useCopyToClipboard();

  const threadRef = useMemo(
    () => scopeThreadRef(environmentId, threadId),
    [environmentId, threadId],
  );

  const canReadSession = isServerThread && !isDraft && String(projectId) !== ISOLATED_PROJECT_ID;
  const quietThread = useQuietThreadProjection(canReadSession ? threadRef : null);
  const projection = quietThread?.projection ?? null;

  const canSearchProject =
    scope === "project" &&
    Boolean(gitCwd) &&
    String(projectId) !== ISOLATED_PROJECT_ID;

  const projectSearch = useProjectPathSearch(
    {
      environmentId: canSearchProject ? environmentId : null,
      cwd: canSearchProject ? gitCwd : null,
      query: "",
      kind: "file",
    },
    80,
    { allowEmptyQuery: canSearchProject },
  );

  const sessionItems = useMemo(
    () => (canReadSession ? collectSessionArtifacts(projection, gitCwd) : []),
    [canReadSession, projection, gitCwd],
  );

  const projectItems = useMemo(() => {
    if (scope !== "project") return sessionItems;
    const merged = new Map<string, StardustArtifactItem>();
    for (const item of sessionItems) {
      merged.set(item.openPath.toLowerCase(), item);
    }
    for (const entry of projectSearch.entries) {
      const relPath = entry.path.replace(/\\/g, "/");
      if (NOISE_PATH_RE.test(relPath)) continue;
      const name = relPath.split("/").at(-1) ?? relPath;
      if (NOISE_BASENAME_RE.test(name)) continue;
      const kind = classifyExtension(name);
      if (!kind) continue;
      const key = relPath.toLowerCase();
      if (merged.has(key)) continue;
      merged.set(key, {
        id: `ws:${relPath}`,
        name,
        displayPath: relPath,
        openPath: relPath,
        kind,
        source: "workspace",
      });
    }
    return [...merged.values()];
  }, [scope, sessionItems, projectSearch.entries]);

  const activeItems = scope === "thread" ? sessionItems : projectItems;

  const counts = useMemo(() => {
    const map: Record<"all" | ArtifactKind, number> = {
      all: activeItems.length,
      document: 0,
      page: 0,
      image: 0,
      video: 0,
      code: 0,
    };
    for (const it of activeItems) {
      map[it.kind] += 1;
    }
    return map;
  }, [activeItems]);

  const effectiveFilter = filter !== "all" && counts[filter] === 0 ? "all" : filter;
  const filteredItems = useMemo(
    () =>
      effectiveFilter === "all"
        ? activeItems
        : activeItems.filter((it) => it.kind === effectiveFilter),
    [activeItems, effectiveFilter],
  );

  const handleOpenArtifact = (
    item: StardustArtifactItem,
    buttonEl?: HTMLButtonElement | null,
  ) => {
    const store = useRightPanelStore.getState();
    const wasOpen =
      selectThreadPanelOpen(store.threadPanelVisibilityByThreadKey, threadRef, "inline") ||
      selectThreadPanelOpen(store.threadPanelVisibilityByThreadKey, threadRef, "popover");
    if (wasOpen) {
      (
        window as unknown as { __t3mKeepDetailsPopoverUntil?: number }
      ).__t3mKeepDetailsPopoverUntil = Date.now() + 650;
    }
    if (item.attachment) {
      store.openAttachment(threadRef, item.attachment);
    } else {
      store.openFile(threadRef, item.openPath);
    }
    if (wasOpen) {
      // Keep the details card open if opening the preview transitions it from inline -> popover
      store.setThreadPanelOpen(threadRef, "popover", true);
      if (buttonEl) {
        window.requestAnimationFrame(() => {
          if (buttonEl.isConnected) {
            buttonEl.focus({ preventScroll: true });
          }
        });
      }
    }
  };

  return (
    <ThreadDetailsSection
      headingId="thread-details-stardust-artifacts"
      title="产物"
      separated
      showHeading={false}
    >
      <div className="px-2 py-1 select-none">
        {/* Top Row: Collapsible header + Scope segmented pill */}
        <div className="flex items-center justify-between gap-2 px-1 py-0.5">
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-foreground/90 hover:text-foreground"
          >
            <ChevronDownIcon
              className={cn(
                "size-3.5 text-muted-foreground transition-transform duration-150",
                !expanded && "-rotate-90",
              )}
            />
            <PackageIcon className="size-3.5 text-sky-400" />
            <span>产物</span>
            <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-foreground/[0.08] px-1.5 text-[10.5px] font-semibold text-muted-foreground tabular-nums">
              {counts.all}
            </span>
          </button>

          {expanded ? (
            <div
              role="tablist"
              aria-label="产物范围"
              className="inline-flex items-center rounded-lg bg-foreground/[0.06] p-0.5 text-[11px]"
            >
              <button
                type="button"
                role="tab"
                aria-selected={scope === "thread"}
                onClick={() => setScope("thread")}
                className={cn(
                  "cursor-pointer rounded-md px-2 py-0.5 font-medium transition-colors duration-120",
                  scope === "thread"
                    ? "bg-background/90 text-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                本会话
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={scope === "project"}
                onClick={() => setScope("project")}
                className={cn(
                  "cursor-pointer rounded-md px-2 py-0.5 font-medium transition-colors duration-120",
                  scope === "project"
                    ? "bg-background/90 text-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                本项目
              </button>
            </div>
          ) : null}
        </div>

        {expanded ? (
          <div className="mt-1.5 space-y-1.5">
            {/* Filter chips */}
            <div className="flex flex-wrap items-center gap-1 px-1">
              {FILTER_LABELS.map((f) => {
                const count = counts[f.id];
                if (f.id !== "all" && count === 0) return null;
                const active = effectiveFilter === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFilter(f.id)}
                    className={cn(
                      "inline-flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-medium tabular-nums transition-colors duration-120",
                      active
                        ? "bg-foreground/[0.12] text-foreground"
                        : "bg-foreground/[0.04] text-muted-foreground hover:bg-foreground/[0.08] hover:text-foreground",
                    )}
                  >
                    <span>{f.label}</span>
                    <span>{count}</span>
                  </button>
                );
              })}
            </div>

            {/* Native scrollable list (marked data-thread-artifacts-list so ThreadDetailsCard never downgrades density) */}
            <div
              data-thread-artifacts-list
              className="max-h-56 space-y-0.5 overflow-y-auto px-0.5 pb-0.5"
            >
              {scope === "project" && projectSearch.isPending && filteredItems.length === 0 ? (
                <div className="px-2 py-3 text-xs text-muted-foreground">正在扫描项目产物…</div>
              ) : filteredItems.length === 0 ? (
                <div className="px-2 py-2.5 text-xs text-muted-foreground">
                  {scope === "thread" ? "这个会话还没有产物" : "这个项目还没有可展示的产物"}
                </div>
              ) : (
                filteredItems.slice(0, 60).map((item) => {
                  const isExcelOrCsv = /\.(?:xlsx|csv|tsv)$/i.test(item.name);
                  return (
                    <div
                      key={item.id}
                      className="group/art flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-xs transition-colors hover:bg-foreground/[0.06]"
                    >
                      {isExcelOrCsv ? (
                        <FileSpreadsheetIcon className="size-3.5 shrink-0 text-emerald-400" />
                      ) : (
                        <ArtifactKindGlyph kind={item.kind} />
                      )}
                      <button
                        type="button"
                        onClick={(e) => handleOpenArtifact(item, e.currentTarget)}
                        title={item.displayPath}
                        className="min-w-0 flex-1 cursor-pointer text-left"
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="min-w-0 flex-1 truncate font-medium text-foreground/92 group-hover/art:text-foreground">
                            {item.name}
                          </span>
                          {item.detail ? (
                            <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
                              {item.detail}
                            </span>
                          ) : null}
                        </div>
                        {item.displayPath !== item.name ? (
                          <div className="truncate text-[10px] text-muted-foreground/80">
                            {item.displayPath}
                          </div>
                        ) : null}
                      </button>
                      {!item.attachment ? (
                        <button
                          type="button"
                          title="复制路径"
                          onClick={(e) => {
                            e.stopPropagation();
                            const fullOrRel =
                              gitCwd && !/^(?:[A-Za-z]:[\\/]|\/)/.test(item.openPath)
                                ? `${gitCwd.replace(/[\\/]+$/, "")}/${item.openPath}`
                                : item.openPath;
                            void copyToClipboard(fullOrRel, undefined);
                            setCopiedId(item.id);
                            window.setTimeout(() => {
                              setCopiedId((cur) => (cur === item.id ? null : cur));
                            }, 1500);
                          }}
                          className="hidden size-5 shrink-0 cursor-pointer items-center justify-center rounded text-muted-foreground hover:bg-foreground/[0.09] hover:text-foreground group-hover/art:inline-flex"
                        >
                          {copiedId === item.id ? (
                            <CheckIcon className="size-3 text-emerald-400" />
                          ) : (
                            <CopyIcon className="size-3" />
                          )}
                        </button>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ) : null}
      </div>
    </ThreadDetailsSection>
  );
});
