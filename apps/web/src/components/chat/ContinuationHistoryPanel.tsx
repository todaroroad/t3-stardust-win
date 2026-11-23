import { uiText } from "../../i18n";
import type { ThreadStructure } from "@t3tools/client-runtime/state/shell";
import { readUiLocale } from "~/i18n";
import type { EnvironmentId, ThreadId } from "@t3tools/contracts";
import {
  presentThreadShell,
  type EnvironmentThreadShell,
} from "@t3tools/client-runtime/state/shell";
import { useNavigate } from "@tanstack/react-router";
import * as Option from "effect/Option";
import { useLayoutEffect, useRef, useState } from "react";
import { useEnvironmentThread, threadEnvironment } from "../../state/threads";
import { useThreadShells, useProjects } from "../../state/entities";
import { useArchivedThreadSnapshots } from "../../lib/archivedThreadsState";
import { useAtomValue } from "@effect/atom-react";
import { AsyncResult } from "effect/reactivity";
import { environmentCatalog } from "../../connection/catalog";
import { ArchiveOriginalThreadButton } from "./ArchiveOriginalThreadButton";
import { useAtomCommand } from "../../state/use-atom-command";
import { useProjectFileQuery } from "../files/projectFilesQueryState";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  buildContinuationChain,
  isContinuationSegment,
  continuationHandoffPath,
  continuationMessages,
  continuationQuote,
} from "./continuationHistory";

export function ContinuationHistoryPanel(props: {
  environmentId: EnvironmentId;
  thread: EnvironmentThreadShell;
  projection: ThreadStructure | null;
  onQuote: (text: string) => boolean;
  /** Shown instead of nothing when this thread has no earlier or later segments. */
  emptyLabel?: string;
}) {
  const shells = useThreadShells();
  const environmentIds = (() => [props.environmentId])();
  const archived = useArchivedThreadSnapshots(environmentIds);
  const connection = useAtomValue(environmentCatalog.stateAtom(props.environmentId));
  const phase = Option.getOrNull(AsyncResult.value(connection))?.phase;
  const disconnected = phase !== undefined && phase !== "connected";
  const archivedShells = (() =>
    archived.snapshots.flatMap((entry) =>
      entry.snapshot.threads.map((thread) => presentThreadShell(entry.environmentId, thread)),
    ))();
  const threads = (() => {
    const merged = new Map<ThreadId, EnvironmentThreadShell>();
    for (const thread of archivedShells) merged.set(thread.id, thread);
    for (const thread of shells) {
      if (thread.environmentId === props.environmentId) merged.set(thread.id, thread);
    }
    merged.set(props.thread.id, props.thread);
    return [...merged.values()];
  })();
  const chain = buildContinuationChain(props.thread, threads);
  const children = threads.filter(
    (thread) =>
      thread.id !== props.thread.id &&
      isContinuationSegment(thread) &&
      thread.continuedFromThreadId === props.thread.id &&
      thread.deletedAt === null,
  );
  if (
    !isContinuationSegment(props.thread) ||
    (!props.thread.continuedFromThreadId && children.length === 0)
  )
    return props.emptyLabel ? (
      <p className="px-3 py-3 text-xs text-muted-foreground">{props.emptyLabel}</p>
    ) : null;
  return (
    <>
      <section
        aria-label={uiText("Continuation sequence")}
        className="min-w-0 px-3 pt-3 pb-2"
        data-continuation-history
      >
        <h3 className="mb-2 text-xs font-medium">{uiText("Continuation history")}</h3>
        {disconnected ? (
          <p role="status" className="text-xs">
            {uiText("Connection lost. Cached records are shown. Reconnect to load more.")}
          </p>
        ) : null}
        {chain.issue === "cycle" ? (
          <p role="alert" className="text-xs">
            {uiText("A loop in the continuation chain stopped the search.")}
          </p>
        ) : null}
        {chain.issue === "broken" ? (
          <div className="text-xs" role="status">
            {disconnected
              ? uiText("Couldn’t verify earlier conversations.")
              : archived.isLoading
                ? uiText("Finding earlier conversations…")
                : archived.error
                  ? uiText("Couldn’t load continuation history. Try again.")
                  : uiText(
                      "The earlier conversation is missing or outside this continuation chain.",
                    )}
            {!disconnected && archived.error ? (
              <Button size="xs" variant="ghost" onClick={archived.refresh}>
                {uiText("Retry loading the sequence")}
              </Button>
            ) : null}
          </div>
        ) : null}
        {chain.segments.map((segment, index) => (
          <div key={segment.id} className="my-2 border-l pl-2">
            <p className="text-xs font-medium">
              {chain.issue === null
                ? uiText("Part {count}", { count: index + 1 })
                : uiText("Parts found")}
              {segment.id === props.thread.id ? uiText(" · Current part") : ""}
              {segment.archivedAt != null ? uiText(" · Archived") : uiText(" · Unarchived")}
            </p>
            {segment.id === props.thread.id ? (
              <>
                <p className="break-words text-xs">{segment.title}</p>
                <p className="text-2xs text-muted-foreground">
                  {new Date(segment.createdAt).toLocaleString(readUiLocale())}
                </p>
              </>
            ) : (
              <OriginalThreadHistory
                {...props}
                parent={segment}
                disconnected={disconnected}
                projection={
                  segment.id === props.thread.continuedFromThreadId ? props.projection : null
                }
              />
            )}
          </div>
        ))}
      </section>
      {children.length > 0 ? (
        <section aria-label={uiText("Next conversation")} className="min-w-0 px-3 pt-3 pb-2">
          <h3 className="mb-2 text-xs font-medium">{uiText("Next conversation")}</h3>
          {children.map((child) =>
            child.archivedAt != null ? (
              <div key={child.id}>
                <p className="text-2xs text-muted-foreground">{uiText("Archived")}</p>
                <OriginalThreadHistory
                  {...props}
                  parent={child}
                  projection={null}
                  disconnected={disconnected}
                />
              </div>
            ) : (
              <ThreadLink
                key={child.id}
                environmentId={props.environmentId}
                threadId={child.id}
                title={child.title}
              />
            ),
          )}
        </section>
      ) : null}
    </>
  );
}

function ThreadLink({
  environmentId,
  threadId,
  title,
}: {
  environmentId: EnvironmentId;
  threadId: ThreadId;
  title: string;
}) {
  const navigate = useNavigate();
  return (
    <Button
      variant="ghost"
      size="xs"
      onClick={() => {
        void navigate({ to: "/$environmentId/$threadId", params: { environmentId, threadId } });
      }}
    >
      {title} →
    </Button>
  );
}

function OriginalThreadHistory({
  environmentId,
  parent,
  projection,
  onQuote,
  disconnected,
}: {
  environmentId: EnvironmentId;
  parent: EnvironmentThreadShell;
  disconnected: boolean;
  projection: ThreadStructure | null;
  onQuote: (text: string) => boolean;
}) {
  // The existing thread state loads a bounded window and holds an opaque history cursor.
  // No visit/settle/approval/message command is dispatched for the source thread.
  const [expanded, setExpanded] = useState(false);
  const [fileOpen, setFileOpen] = useState(false);
  // Mount the existing bounded, read-only subscription only on explicit inspection.
  const state = useEnvironmentThread(
    expanded || fileOpen ? environmentId : null,
    expanded || fileOpen ? parent.id : null,
  );
  const original = Option.getOrNull(state.data);
  const loadEarlier = useAtomCommand(threadEnvironment.loadEarlierHistory, {
    reportFailure: false,
  });
  const projects = useProjects();
  const cwd =
    parent.worktreePath ??
    projects.find((p) => p.environmentId === environmentId && p.id === parent.projectId)
      ?.workspaceRoot ??
    "";
  const [query, setQuery] = useState("");
  const [quoteError, setQuoteError] = useState(false);
  const path = continuationHandoffPath(
    projection?.messages.find((m) => m.role === "user")?.text,
    original?.messages.toReversed().find((m) => m.role === "assistant")?.text,
  );
  const file = useProjectFileQuery(
    environmentId,
    cwd,
    path,
    fileOpen && path !== null && cwd !== "",
  );
  const messages = (() => continuationMessages(original?.visibleTurnItems ?? [], query))();
  const scroller = useRef<HTMLDivElement | null>(null);
  const scrollAnchor = useRef<{ height: number; top: number } | null>(null);
  const busy = useRef(false);
  const didScrollToEnd = useRef(false);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Keep the transcript DOM scroll anchor stable when earlier history is prepended.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || !expanded) return;
    if (scrollAnchor.current) {
      el.scrollTop = scrollAnchor.current.top + el.scrollHeight - scrollAnchor.current.height;
      scrollAnchor.current = null;
    } else if (!didScrollToEnd.current && original) {
      el.scrollTop = el.scrollHeight;
      didScrollToEnd.current = true;
    }
  }, [expanded, original]);
  const earlier = async () => {
    if (disconnected || busy.current || state.history.loading || !state.history.hasMoreHistory)
      return;
    busy.current = true;
    const el = scroller.current;
    if (el) scrollAnchor.current = { height: el.scrollHeight, top: el.scrollTop };
    await loadEarlier({ environmentId, input: { threadId: parent.id } }).finally(() => {
      busy.current = false;
    });
  };
  return (
    <section
      aria-label={uiText("Original conversation")}
      className="min-w-0 px-3 pt-3 pb-2"
      data-continuation-history
    >
      <p className="break-words text-xs">{parent.title}</p>
      <p className="mt-1 text-2xs text-muted-foreground">
        {new Date(parent.createdAt).toLocaleString(readUiLocale())} · {parent.itemCount}{" "}
        {uiText(" records")}
      </p>
      <div className="my-2 flex flex-wrap gap-1">
        <Button
          size="xs"
          variant="secondary"
          aria-expanded={expanded}
          onClick={() => {
            setExpanded(!expanded);
            didScrollToEnd.current = false;
          }}
        >
          {" "}
          {expanded ? uiText("Hide records") : uiText("View records")}{" "}
        </Button>
        {parent.archivedAt == null ? (
          <ArchiveOriginalThreadButton
            environmentId={environmentId}
            threadId={parent.id}
            disconnected={disconnected}
          />
        ) : null}
        {path ? (
          <Button size="xs" variant="ghost" onClick={() => setFileOpen(!fileOpen)}>
            {fileOpen ? uiText("Hide handoff file") : uiText("Open handoff file")}
          </Button>
        ) : null}
      </div>
      {fileOpen ? (
        <div className="mb-2 rounded-lg border p-2" data-continuation-file>
          <p className="mb-1 break-all text-2xs text-muted-foreground">{path}</p>
          {file.isPending ? (
            <p className="text-xs">{uiText("Loading handoff file…")}</p>
          ) : file.error ? (
            <>
              <p role="alert" className="text-xs">
                {file.error}
              </p>
              <Button size="xs" variant="ghost" onClick={file.refresh}>
                {uiText("Retry loading earlier records")}
              </Button>
            </>
          ) : (
            <pre className="max-h-60 overflow-y-auto whitespace-pre-wrap break-words text-xs">
              {file.data?.contents}
            </pre>
          )}
          {file.data?.truncated ? (
            <p className="text-xs">{uiText("File content truncated")}</p>
          ) : null}
        </div>
      ) : null}
      {expanded ? (
        <>
          <p className="mb-2 text-2xs text-muted-foreground">
            {uiText("Records are read-only. Quotes go into your draft for you to send.")}
          </p>
          <Input
            aria-label={uiText("Search original conversation")}
            placeholder={uiText("Search loaded records")}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <p className="my-1 text-2xs text-muted-foreground">
            {messages.length} {uiText(" matches · Search loaded records")}
            {state.history.hasMoreHistory
              ? uiText(". More records are available")
              : uiText(". All records loaded")}
          </p>
          {quoteError ? (
            <p role="alert" className="text-xs">
              {uiText(
                "The composer can’t add quotes right now. Close this panel and check the connection or pending requests.",
              )}
            </p>
          ) : null}
          <div
            ref={scroller}
            data-original-timeline
            className="max-h-[45dvh] overflow-y-auto overscroll-contain"
            onScroll={(event) => {
              if (event.currentTarget.scrollTop < 32 && !query) void earlier();
            }}
          >
            {state.history.hasMoreHistory ? (
              <Button
                size="xs"
                variant="ghost"
                disabled={disconnected || state.history.loading}
                onClick={() => {
                  void earlier();
                }}
              >
                {state.history.loading ? uiText("Loading…") : uiText("Load earlier records")}
              </Button>
            ) : null}
            {state.history.error ? (
              <p role="alert" className="text-xs">
                {uiText("Couldn’t load earlier records. Try again.")}
              </p>
            ) : null}
            {!original ? (
              <p className="text-xs">
                {disconnected
                  ? uiText("Connection lost. Waiting to reconnect.")
                  : state.status === "deleted"
                    ? uiText("The original conversation was deleted. Its messages are unavailable.")
                    : Option.isSome(state.error)
                      ? uiText(
                          "Couldn’t read the original conversation. Collapse and reopen it to retry.",
                        )
                      : uiText("Loading original conversation…")}
              </p>
            ) : messages.length === 0 ? (
              <p className="py-2 text-xs">{uiText("No matching messages")}</p>
            ) : null}
            {messages.map(({ item }) =>
              item.type === "user_message" || item.type === "assistant_message" ? (
                <article
                  key={item.id}
                  className="group my-2 rounded-lg border p-2"
                  data-original-message={item.id}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-2xs text-muted-foreground">
                      {item.type === "user_message" ? uiText("User") : uiText("Assistant")}
                    </span>
                    <div className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 pointer-coarse:opacity-100 max-md:opacity-100">
                      <Button
                        size="xs"
                        variant="ghost"
                        onPointerDown={(e) => e.preventDefault()}
                        onClick={() =>
                          setQuoteError(
                            !onQuote(
                              continuationQuote(item.text, parent.title, {
                                threadId: parent.id,
                                itemId: item.id,
                              }),
                            ),
                          )
                        }
                      >
                        {uiText("Quote")}
                      </Button>
                    </div>
                  </div>
                  <p className="whitespace-pre-wrap break-words text-xs select-text">{item.text}</p>
                </article>
              ) : null,
            )}
          </div>
        </>
      ) : null}
      {parent.archivedAt == null ? (
        <div className="mt-2">
          <ThreadLink
            environmentId={environmentId}
            threadId={parent.id}
            title={uiText("Open in main pane")}
          />
        </div>
      ) : null}
    </section>
  );
}
