import { discardComposerDraft } from "../../lib/discardComposerDraft";
import type { ContextMenuSource, EnvironmentId, ProjectId, ScopedThreadRef } from "@t3tools/contracts";
import { scopeThreadRef, scopedThreadKey } from "@t3tools/client-runtime/environment";
import type { EnvironmentProject } from "@t3tools/client-runtime/state/shell";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";
import { isShownUnderParent } from "@t3tools/client-runtime/state/threads";
import { contextMenuSourceOf } from "../../contextMenuSource";
import { assistantCitationsToPlainText } from "@t3tools/shared/assistantCitations";
import { replaceComposerContextReferences } from "@t3tools/shared/composerContextReferences";
import { composerFileLinksToPlainText } from "@t3tools/shared/composerInlineTokens";
import { T, useGT, useMessages } from "gt-react";
import { SquarePenIcon, XIcon } from "lucide-react";
import {
  memo,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { useShallow } from "zustand/react/shallow";
import { terminalContextDisplayLabels } from "~/lib/terminalContext";
import { cn } from "~/lib/utils";
import { useTerminalLabelsByThreadKey } from "~/state/terminalSessions";
import { resolveSidebarRowAccessibility } from "../Sidebar.logic";
import { ProjectFavicon, type ProjectFaviconProject } from "../ProjectFavicon";
import {
  composerDraftHasUserContent,
  DraftId,
  useComposerDraftStore,
  type ComposerThreadDraftState,
  type DraftSessionState,
} from "../../composerDraftStore";
import {
  draftPenClassName,
  draftSurfaceClassName,
  JUMP_HINT_SLOT_CLASS_NAME,
  JumpHintBadge,
} from "./SidebarThreadRow";
import { CollapsibleSectionHeader } from "../ui/collapsible-section-header";
import { SharedTooltipTrigger } from "../ui/shared-tooltip";
import {
  togglePendingEditsCollapsed,
  usePendingEditsCollapsed,
} from "./stardustCategories";

const EMPTY_COMPOSER_PARTS = {
  prompt: "",
  images: [],
  persistedAttachments: [],
  files: [],
  terminalContexts: [],
  previewAnnotations: [],
  reviewComments: [],
} as const;

/** Terminal labels for draft threads; an unsent draft stays listed while it has a terminal. */
export function useDraftTerminalLabels(): ReadonlyMap<string, string> {
  const environmentIds = useComposerDraftStore((store) => {
    const ids = new Set<string>();
    for (const session of Object.values(store.draftThreadsByThreadKey)) {
      if (session.promotedTo == null) ids.add(session.environmentId);
    }
    return [...ids].toSorted().join("\n");
  });
  return useTerminalLabelsByThreadKey(
    environmentIds === "" ? [] : (environmentIds.split("\n") as EnvironmentId[]),
  );
}

export function draftTerminalLabel(
  session: DraftSessionState,
  terminalLabels: ReadonlyMap<string, string>,
): string | null {
  return terminalLabels.get(`${session.environmentId}:${session.threadId}`) ?? null;
}

function summarizeComposerPreview(
  composerInput: ComposerThreadDraftState | null | undefined,
  terminalLabel: string | null,
  resolve: ReturnType<typeof useMessages>,
  gt: ReturnType<typeof useGT>,
): string {
  const composer = composerInput ?? EMPTY_COMPOSER_PARTS;
  const terminalLabels = terminalContextDisplayLabels(composer.terminalContexts, resolve);
  const promptPreview =
    assistantCitationsToPlainText(
      composerFileLinksToPlainText(
        replaceComposerContextReferences(
          composer.prompt,
          (occurrence) =>
            (occurrence.kind === "terminal"
              ? terminalLabels.get(occurrence.contextId)
              : undefined) ?? occurrence.label,
        ),
      ),
    )
      .trim()
      .split("\n", 1)[0] ?? "";
  const attachmentCount =
    Math.max(composer.images.length, composer.persistedAttachments.length) +
    composer.files.length +
    composer.terminalContexts.length +
    composer.previewAnnotations.length +
    composer.reviewComments.length;
  return promptPreview.length > 0
    ? promptPreview
    : attachmentCount === 0 && terminalLabel !== null
      ? terminalLabel
      : gt("{count, plural, one {{count} attachment} other {{count} attachments}}", {
          count: attachmentCount,
        });
}

function ClickableProjectIcon(props: {
  project: ProjectFaviconProject | null;
  projectDisplayName: string | null;
  environmentId: EnvironmentId;
  projectId: ProjectId;
  isProjectScoped?: boolean | undefined;
  onProjectClick?: ((environmentId: EnvironmentId, projectId: ProjectId) => void) | undefined;
}) {
  if (!props.project) return null;
  if (!props.onProjectClick) {
    return <ProjectFavicon project={props.project} className="size-4 shrink-0" />;
  }
  const onProjectClick = props.onProjectClick;
  const label = props.isProjectScoped
    ? "返回所有项目"
    : `进入项目「${props.projectDisplayName || props.project.title}」`;
  return (
    <SharedTooltipTrigger
      render={
        <button
          type="button"
          aria-label={label}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onProjectClick(props.environmentId, props.projectId);
          }}
          className="inline-flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-xs outline-none transition-transform duration-150 hover:scale-110 active:scale-95 focus-visible:ring-2 focus-visible:ring-ring"
        />
      }
      label={label}
    >
      <ProjectFavicon project={props.project} className="size-4 shrink-0" />
    </SharedTooltipTrigger>
  );
}

const SidebarDraftRow = memo(function SidebarDraftRow(props: {
  draftId: DraftId;
  environmentId: EnvironmentId;
  projectId: ProjectId;
  composer: ComposerThreadDraftState | null;
  terminalLabel: string | null;
  project: ProjectFaviconProject | null;
  projectDisplayName: string | null;
  isActive: boolean;
  isProjectScoped?: boolean | undefined;
  jumpLabel: string | null;
  onNavigate: (draftId: DraftId) => void;
  onDiscard: (draftId: DraftId) => void;
  onProjectClick?: ((environmentId: EnvironmentId, projectId: ProjectId) => void) | undefined;
  onContextMenu: (
    draftId: DraftId,
    position: { x: number; y: number },
    source: ContextMenuSource,
  ) => void;
}) {
  const { draftId, onContextMenu, onDiscard, onNavigate } = props;
  const gt = useGT();
  const resolve = useMessages();
  const preview = summarizeComposerPreview(props.composer, props.terminalLabel, resolve, gt);
  const accessibility = resolveSidebarRowAccessibility({
    title: preview,
    statusLabel: gt("Unsent draft"),
    projectDisplayName: props.projectDisplayName,
    isActive: props.isActive,
  });
  const handleActivate = () => onNavigate(draftId);
  const handleKeyDown = (event: ReactKeyboardEvent) => {
    if ((event.target as HTMLElement).closest("button")) return;
    if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
      event.preventDefault();
      const rect = event.currentTarget.getBoundingClientRect();
      onContextMenu(draftId, { x: rect.left, y: rect.bottom }, "keyboard");
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onNavigate(draftId);
    }
  };
  const handleContextMenu = (event: ReactMouseEvent) => {
    event.preventDefault();
    onContextMenu(draftId, { x: event.clientX, y: event.clientY }, contextMenuSourceOf(event));
  };
  const handleDiscard = (event: ReactMouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    onDiscard(draftId);
  };
  return (
    <li className="list-none py-0.5">
      <div
        role="button"
        tabIndex={0}
        data-sidebar-row={`draft:${draftId}`}
        aria-label={accessibility.label}
        aria-current={accessibility.current}
        data-testid="sidebar-draft-row"
        className={cn(
          "group/sidebar-row relative w-full cursor-pointer overflow-hidden rounded-md text-left text-sidebar-foreground outline-none select-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
          props.isActive ? "bg-sidebar-row-active" : draftSurfaceClassName,
        )}
        onClick={handleActivate}
        onContextMenu={handleContextMenu}
        onKeyDown={handleKeyDown}
      >
        <div className="relative z-10 px-(--sidebar-row-content-inset) py-(--sidebar-content-inset)">
          <div className="flex h-5 min-w-0 items-center gap-1.5">
            <SquarePenIcon aria-hidden className={draftPenClassName} />
            <ClickableProjectIcon
              project={props.project}
              projectDisplayName={props.projectDisplayName}
              environmentId={props.environmentId}
              projectId={props.projectId}
              isProjectScoped={props.isProjectScoped ?? false}
              onProjectClick={props.onProjectClick}
            />
            <span className="min-w-0 flex-1 truncate text-xs font-medium text-secondary-label">
              {props.projectDisplayName ?? "新草稿"}
            </span>
            <span className="shrink-0 text-[11px] font-medium text-amber-400/90">新草稿</span>
            <span
              className={cn(
                "ml-1 flex h-5 min-w-5 shrink-0 items-center justify-end",
                props.jumpLabel && JUMP_HINT_SLOT_CLASS_NAME,
              )}
            >
              <SharedTooltipTrigger
                render={
                  <button
                    type="button"
                    aria-label={gt("Discard draft")}
                    onClick={handleDiscard}
                    className="pointer-events-none inline-flex cursor-pointer items-center rounded-md bg-transparent px-1 text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:pointer-events-auto focus-visible:opacity-100 group-hover/sidebar-row:pointer-events-auto group-hover/sidebar-row:opacity-100"
                  >
                    <XIcon className="size-3" />
                  </button>
                }
                label={
                  <>
                    <T>Discard draft</T>
                  </>
                }
              />
              {props.jumpLabel ? <JumpHintBadge label={props.jumpLabel} /> : null}
            </span>
          </div>
          <div className="mt-0.5 truncate text-sm font-medium text-foreground/90">{preview}</div>
        </div>
      </div>
    </li>
  );
});

const SidebarPendingThreadDraftRow = memo(function SidebarPendingThreadDraftRow(props: {
  thread: EnvironmentThreadShell;
  composer: ComposerThreadDraftState | null;
  project: ProjectFaviconProject | null;
  projectDisplayName: string | null;
  isActive: boolean;
  isProjectScoped?: boolean | undefined;
  onNavigateToThread: (ref: ScopedThreadRef) => void;
  onProjectClick?: ((environmentId: EnvironmentId, projectId: ProjectId) => void) | undefined;
  onContextMenu?:
    | ((
        ref: ScopedThreadRef,
        position: { x: number; y: number },
        source: ContextMenuSource,
      ) => void)
    | undefined;
}) {
  const { thread, onNavigateToThread, onContextMenu } = props;
  const gt = useGT();
  const resolve = useMessages();
  const threadRef = scopeThreadRef(thread.environmentId, thread.id);
  const draftPreview = summarizeComposerPreview(props.composer, null, resolve, gt);
  const titleText = thread.title.trim() || "未命名会话";

  return (
    <li className="list-none py-0.5">
      <div
        role="button"
        tabIndex={0}
        data-stardust-pending-draft={scopedThreadKey(threadRef)}
        aria-current={props.isActive ? "page" : undefined}
        className={cn(
          "group/sidebar-row relative w-full cursor-pointer overflow-hidden rounded-md text-left text-sidebar-foreground outline-none select-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
          props.isActive ? "bg-sidebar-row-active" : draftSurfaceClassName,
        )}
        onClick={() => onNavigateToThread(threadRef)}
        onContextMenu={(event) => {
          if (!onContextMenu) return;
          event.preventDefault();
          onContextMenu(threadRef, { x: event.clientX, y: event.clientY }, contextMenuSourceOf(event));
        }}
        onKeyDown={(event) => {
          if ((event.target as HTMLElement).closest("button")) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onNavigateToThread(threadRef);
          } else if (
            onContextMenu &&
            (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10"))
          ) {
            event.preventDefault();
            const rect = event.currentTarget.getBoundingClientRect();
            onContextMenu(threadRef, { x: rect.left, y: rect.bottom }, "keyboard");
          }
        }}
      >
        <div className="relative z-10 px-(--sidebar-row-content-inset) py-(--sidebar-content-inset)">
          <div className="flex h-5 min-w-0 items-center gap-1.5">
            <SquarePenIcon aria-hidden className={draftPenClassName} />
            <ClickableProjectIcon
              project={props.project}
              projectDisplayName={props.projectDisplayName}
              environmentId={thread.environmentId}
              projectId={thread.projectId}
              isProjectScoped={props.isProjectScoped ?? false}
              onProjectClick={props.onProjectClick}
            />
            <span className="min-w-0 flex-1 truncate text-xs font-normal text-secondary-label">
              {props.projectDisplayName}
            </span>
            <span className="ml-auto flex h-5 shrink-0 items-center gap-1">
              <span className="text-[11px] font-medium text-amber-400/90 group-hover/sidebar-row:hidden">
                待发送
              </span>
              <SharedTooltipTrigger
                render={
                  <button
                    type="button"
                    aria-label="清空未发送草稿"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      discardComposerDraft(threadRef);
                    }}
                    className="hidden cursor-pointer items-center rounded-md bg-transparent px-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:inline-flex group-hover/sidebar-row:inline-flex"
                  >
                    <XIcon className="size-3" />
                  </button>
                }
                label="清空未发送草稿"
              />
            </span>
          </div>
          <div className="mt-0.5 truncate text-sm font-medium text-foreground/92">{titleText}</div>
          <div className="mt-0.5 truncate text-xs text-muted-foreground">{draftPreview}</div>
        </div>
      </div>
    </li>
  );
});

/**
 * Unsent new drafts listed above the threads, newest first.
 * Live-updates as soon as the user types content into the open draft composer so
 * new drafts are never hidden at the top of the sidebar.
 */
export function useSidebarDrafts(
  scopedProjectKeys: ReadonlySet<string> | null,
  _routeDraftId: string | null,
  terminalLabels: ReadonlyMap<string, string>,
): { draftIds: readonly DraftId[]; routeDraftComposer: ComposerThreadDraftState | null } {
  const draftIds = useComposerDraftStore(
    useShallow((store) => {
      const listed: [string, DraftSessionState][] = [];
      for (const [draftKey, session] of Object.entries(store.draftThreadsByThreadKey)) {
        if (session.promotedTo != null) continue;
        if (
          scopedProjectKeys !== null &&
          !scopedProjectKeys.has(`${session.environmentId}:${session.projectId}`)
        ) {
          continue;
        }
        const isListed =
          draftTerminalLabel(session, terminalLabels) !== null ||
          composerDraftHasUserContent(store.draftsByThreadKey[draftKey]);
        if (isListed) listed.push([draftKey, session]);
      }
      listed.sort(([, left], [, right]) => right.createdAt.localeCompare(left.createdAt));
      return listed.map(([draftKey]) => DraftId.make(draftKey));
    }),
  );
  return { draftIds, routeDraftComposer: null };
}

/**
 * Unified collapsible `待编辑` section at the very top of the sidebar:
 * surfaces both brand-new unsent draft sessions AND existing conversations
 * where the user has typed unsent text or attached files in the composer.
 */
export const SidebarDraftBlock = memo(function SidebarDraftBlock(props: {
  draftIds: readonly DraftId[];
  routeDraftComposer: ComposerThreadDraftState | null;
  terminalLabels: ReadonlyMap<string, string>;
  jumpLabelByDraftId: ReadonlyMap<DraftId, string> | null;
  projectByKey: ReadonlyMap<string, EnvironmentProject>;
  projectDisplayNameByKey: ReadonlyMap<string, string>;
  routeDraftId: string | null;
  onNavigateToDraft: (draftId: DraftId) => void;
  onDraftContextMenu: (
    draftId: DraftId,
    position: { x: number; y: number },
    source: ContextMenuSource,
  ) => void;
  allThreads?: readonly EnvironmentThreadShell[] | undefined;
  scopedProjectKeys?: ReadonlySet<string> | null | undefined;
  delegatedUnderParent?: ReadonlySet<string> | undefined;
  routeRowThreadKey?: string | null | undefined;
  isProjectScoped?: boolean | undefined;
  headerAction?: ReactNode | undefined;
  onNavigateToThread?: ((ref: ScopedThreadRef) => void) | undefined;
  onThreadContextMenu?:
    | ((
        ref: ScopedThreadRef,
        position: { x: number; y: number },
        source: ContextMenuSource,
      ) => void)
    | undefined;
  onProjectClick?: ((environmentId: EnvironmentId, projectId: ProjectId) => void) | undefined;
}) {
  const collapsed = usePendingEditsCollapsed();
  const draftThreadsByThreadKey = useComposerDraftStore((store) => store.draftThreadsByThreadKey);
  const existingDraftKeys = useComposerDraftStore(
    useShallow((store) => {
      const keys: string[] = [];
      for (const [key, draft] of Object.entries(store.draftsByThreadKey)) {
        if (store.draftThreadsByThreadKey[key] !== undefined) continue;
        if (composerDraftHasUserContent(draft)) {
          keys.push(key);
        }
      }
      return keys;
    }),
  );
  const draftsByKey = useComposerDraftStore(
    useShallow((store) =>
      Object.fromEntries(
        [...props.draftIds, ...existingDraftKeys].map(
          (key) => [key, store.draftsByThreadKey[key]] as const,
        ),
      ),
    ),
  );

  const drafts = props.draftIds.flatMap((draftId) => {
    const session = draftThreadsByThreadKey[draftId];
    const composer = draftsByKey[draftId] ?? props.routeDraftComposer ?? null;
    return session ? [{ draftId, session, composer }] : [];
  });

  const pendingThreads = (() => {
    if (!props.allThreads || existingDraftKeys.length === 0 || !props.onNavigateToThread) {
      return [];
    }
    const keySet = new Set(existingDraftKeys);
    const delegated = props.delegatedUnderParent ?? new Set<string>();
    const out: Array<{ thread: EnvironmentThreadShell; composer: ComposerThreadDraftState | null }> = [];
    for (const thread of props.allThreads) {
      if (thread.archivedAt !== null) continue;
      if (
        isShownUnderParent(
          { environmentId: thread.environmentId, threadId: thread.id },
          thread.lineage,
          delegated,
        )
      ) {
        continue;
      }
      if (
        props.scopedProjectKeys != null &&
        !props.scopedProjectKeys.has(`${thread.environmentId}:${thread.projectId}`)
      ) {
        continue;
      }
      const key = scopedThreadKey(scopeThreadRef(thread.environmentId, thread.id));
      if (!keySet.has(key)) continue;
      out.push({ thread, composer: draftsByKey[key] ?? null });
    }
    return out;
  })();

  const totalCount = drafts.length + pendingThreads.length;
  if (totalCount === 0) {
    return null;
  }

  const headerButton = (
    <CollapsibleSectionHeader
      data-sidebar-row="shelf:pending-edits"
      onClick={togglePendingEditsCollapsed}
      expanded={!collapsed}
      tone="muted"
      data-testid="sidebar-pending-edits-toggle"
      accessory={<span className="font-normal tabular-nums">{totalCount}</span>}
    >
      <span className="inline-flex items-center gap-1.5">
        <SquarePenIcon aria-hidden className="size-3.5 shrink-0 text-amber-400/90" />
        <span>待编辑</span>
      </span>
    </CollapsibleSectionHeader>
  );

  return (
    <>
      <li className="relative mx-0.5 h-8 list-none">
        {props.headerAction ? (
          <div className="flex h-8 items-center gap-1">
            <div className="min-w-0 flex-1">{headerButton}</div>
            <div className="shrink-0">{props.headerAction}</div>
          </div>
        ) : (
          headerButton
        )}
      </li>
      {!collapsed ? (
        <>
          {drafts.map(({ composer, draftId, session }) => {
            const projectKey = `${session.environmentId}:${session.projectId}`;
            return (
              <SidebarDraftRow
                key={draftId}
                draftId={draftId}
                environmentId={session.environmentId}
                projectId={session.projectId}
                composer={composer}
                terminalLabel={draftTerminalLabel(session, props.terminalLabels)}
                project={props.projectByKey.get(projectKey) ?? null}
                projectDisplayName={props.projectDisplayNameByKey.get(projectKey) ?? null}
                isActive={draftId === props.routeDraftId}
                isProjectScoped={props.isProjectScoped ?? false}
                jumpLabel={props.jumpLabelByDraftId?.get(draftId) ?? null}
                onNavigate={props.onNavigateToDraft}
                onDiscard={discardComposerDraft}
                onProjectClick={props.onProjectClick}
                onContextMenu={props.onDraftContextMenu}
              />
            );
          })}
          {pendingThreads.map(({ thread, composer }) => {
            const projectKey = `${thread.environmentId}:${thread.projectId}`;
            const threadKey = scopedThreadKey(scopeThreadRef(thread.environmentId, thread.id));
            return (
              <SidebarPendingThreadDraftRow
                key={`pending-thread:${threadKey}`}
                thread={thread}
                composer={composer}
                project={props.projectByKey.get(projectKey) ?? null}
                projectDisplayName={props.projectDisplayNameByKey.get(projectKey) ?? null}
                isActive={props.routeRowThreadKey === threadKey}
                isProjectScoped={props.isProjectScoped ?? false}
                onNavigateToThread={props.onNavigateToThread!}
                onProjectClick={props.onProjectClick}
                onContextMenu={props.onThreadContextMenu}
              />
            );
          })}
        </>
      ) : null}
      <li
        aria-hidden
        data-testid="sidebar-draft-divider"
        className="mx-2.5 my-1 h-px list-none bg-sidebar-border/60"
      />
    </>
  );
});
