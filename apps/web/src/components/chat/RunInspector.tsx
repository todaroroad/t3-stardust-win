import { useUiText } from "~/i18n/useUiText";
import { useState } from "react";
import type {
  EnvironmentId,
  ThreadId,
  ServerProvider,
  OrchestrationV2Subagent,
} from "@t3tools/contracts";
import { deriveThreadTurnSubagents } from "@t3tools/client-runtime/state/thread-subagents";
import { remainingPercent } from "@t3tools/shared/usageLimits";
import { useQuietThreadProjection } from "../../state/entities";
import { useEnvironmentProviders } from "../../state/environments";

import { accountAlias, quotaSnapshot } from "./runInspectorModel";
import { Button } from "../ui/button";
import { useNavigate } from "@tanstack/react-router";
import { buildThreadRouteParams } from "../../threadRoutes";

export function RunQuota({
  limits,
  connected,
  now,
}: {
  limits: ServerProvider["usageLimits"];
  connected: boolean;
  now: number;
}) {
  const uiText = useUiText();
  const quota = quotaSnapshot(limits, connected, now);
  return (
    <div className="space-y-1">
      {quota.stale || quota.windows.length === 0 ? <p>{uiText("Temporarily unreadable")}</p> : null}
      {quota.checkedAt ? (
        <p className="text-muted-foreground">
          {uiText("Last checked")}: {new Date(quota.checkedAt).toLocaleString()}
        </p>
      ) : null}
      {quota.windows.map((window) => (
        <p key={window.id ?? `${window.kind}:${window.label}`}>
          {quota.stale ? `${uiText("Last known")} · ` : ""}
          {window.label ?? window.id}:{" "}
          {uiText("{percent}% remaining", { percent: remainingPercent(window) })}
        </p>
      ))}
    </div>
  );
}

export function SubtaskList({
  tasks,
  environmentId,
  providers,
}: {
  tasks: readonly OrchestrationV2Subagent[];
  environmentId: EnvironmentId;
  providers: readonly ServerProvider[];
}) {
  const uiText = useUiText();
  const [visible, setVisible] = useState(30);
  const navigate = useNavigate();
  if (tasks.length === 0) return null;
  return (
    <section aria-label={uiText("Subtask")} className="space-y-3 p-4 text-xs">
      <ul className="space-y-2">
        {tasks.slice(0, visible).map((task) => {
          const provider = providers.find((entry) => entry.instanceId === task.providerInstanceId);
          const child =
            task.remoteChild ??
            (task.childThreadId ? { environmentId, threadId: task.childThreadId } : null);
          return (
            <li key={task.id} className="border-b border-border/60 py-2 last:border-0">
              <button
                type="button"
                className="w-full rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:cursor-default"
                disabled={!child}
                onClick={() => {
                  if (child)
                    void navigate({
                      to: "/$environmentId/$threadId",
                      params: buildThreadRouteParams(child),
                    });
                }}
              >
                <p className="wrap-anywhere font-medium">{task.title || task.id}</p>
                <p className="mt-1 text-muted-foreground">
                  {accountAlias(provider?.displayName) ?? task.driver} · {uiText(task.status)}
                  {child ? " ↗" : ""}
                </p>
              </button>
            </li>
          );
        })}
      </ul>
      {tasks.length > visible ? (
        <Button variant="ghost" size="sm" onClick={() => setVisible(visible + 30)}>
          {uiText("Show more")}
        </Button>
      ) : null}
    </section>
  );
}
export function RunInspector({
  environmentId,
  threadId,
}: {
  environmentId: EnvironmentId;
  threadId: ThreadId;
}) {
  const structure = useQuietThreadProjection({ environmentId, threadId })?.projection ?? null;
  const providers = useEnvironmentProviders().get(environmentId) ?? [];
  const tasks = structure ? (deriveThreadTurnSubagents(structure)?.subagents ?? []) : [];
  return <SubtaskList tasks={tasks} environmentId={environmentId} providers={providers} />;
}
