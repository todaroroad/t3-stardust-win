import { uiText } from "../../i18n";
import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { ScopedProjectRef, ScopedThreadRef } from "@t3tools/contracts";
import { useNavigate } from "@tanstack/react-router";
import { XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { type ComposerThreadTarget, useComposerDraftStore } from "../../composerDraftStore";
import { useProjects, useVisibleThreadShells } from "../../state/entities";
import { useEnvironments } from "../../state/environments";
import { useThreadSearch } from "../../state/queries";
import { buildThreadRouteParams } from "../../threadRoutes";
import { formatRelativeTimeLabel } from "../../timestampFormat";
import { Button } from "../ui/button";
import {
  continuationPrompt,
  rankSimilarThreads,
  scheduleSimilarThreadSearch,
  similarThreadQuery,
} from "./similarThreads";

const dismissedDrafts = new Set<string>();

export function SimilarThreadsHint({
  target,
  current,
  project,
}: {
  readonly target: ComposerThreadTarget;
  readonly current: ScopedThreadRef;
  readonly project: ScopedProjectRef;
}) {
  const prompt = useComposerDraftStore((store) => store.getComposerDraft(target)?.prompt ?? "");
  const [query, setQuery] = useState("");
  const draftKey =
    typeof target === "string" ? target : `${target.environmentId}:${target.threadId}`;
  const [dismissed, setDismissed] = useState(() => dismissedDrafts.has(draftKey));
  const dismiss = () => {
    dismissedDrafts.add(draftKey);
    setDismissed(true);
  };
  const [now] = useState(() => Date.now());
  const navigate = useNavigate();
  const { environments } = useEnvironments();
  const threads = useVisibleThreadShells();
  const projects = useProjects();
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- debounces composer input before starting server search and cancels obsolete timers
  useEffect(
    () => scheduleSimilarThreadSearch(dismissed ? "" : prompt, setQuery),
    [prompt, dismissed],
  );
  const search = useThreadSearch(
    environments
      .filter((env) => env.connection.phase === "connected")
      .map((env) => env.environmentId),
    !dismissed && query === similarThreadQuery(prompt) ? query : "",
    { spotlight: true },
  );
  const matches =
    search.failed || search.query !== query || !query || dismissed
      ? []
      : rankSimilarThreads(threads, search.matches, current, project);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- listens for Escape while the non-modal hint is visible without taking focus from the composer
  useEffect(() => {
    if (!matches.length) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.isComposing) dismiss();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [matches.length, dismiss]);
  if (!matches.length) return null;
  const open = async (thread: (typeof matches)[number], resume: boolean) => {
    const ref = scopeThreadRef(thread.environmentId, thread.id);
    if (resume) {
      const store = useComposerDraftStore.getState();
      store.setPrompt(ref, continuationPrompt(store.getComposerDraft(ref)?.prompt ?? "", prompt));
    }
    await navigate({ to: "/$environmentId/$threadId", params: buildThreadRouteParams(ref) });
  };
  return (
    <section
      aria-label={uiText("Similar work from earlier")}
      data-similar-threads-hint=""
      className="mb-2 rounded-xl bg-muted/80 px-3 py-2 text-xs"
    >
      <div className="mb-1 flex items-center justify-between gap-2 text-muted-foreground">
        <span>{uiText("Similar work from earlier")}</span>
        <Button
          variant="ghost-muted"
          size="icon-xs"
          aria-label={uiText("Dismiss similar conversations")}
          onClick={dismiss}
        >
          <XIcon />
        </Button>
      </div>
      {matches.map((thread, index) => {
        const title =
          projects.find(
            (p) => p.id === thread.projectId && p.environmentId === thread.environmentId,
          )?.title ?? uiText("Project");
        const settled =
          thread.settledOverride === "settled" ||
          (thread.settledAt !== null && thread.settledOverride !== "active");
        return (
          <div
            key={`${thread.environmentId}:${thread.id}`}
            className="flex items-center gap-2 py-1"
          >
            <span
              role="img"
              aria-label={settled ? uiText("Completed") : uiText("Active.")}
              className={`size-1.5 shrink-0 rounded-full ${settled ? "bg-muted-foreground/50" : "bg-success"}`}
            />
            <div className="min-w-0 flex-1">
              <div className="truncate">{thread.title}</div>
              <div className="truncate text-2xs text-muted-foreground">
                {title} · {formatRelativeTimeLabel(thread.updatedAt, now)}
              </div>
            </div>
            <Button size="xs" variant="ghost-muted" onClick={() => void open(thread, false)}>
              {uiText("View")}
            </Button>
            {index === 0 ? (
              <Button size="xs" onClick={() => void open(thread, true)}>
                {uiText("Continue working")}
              </Button>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}
