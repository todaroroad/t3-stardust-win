import { serverCopy } from "~/i18n/serverCopy";
import { uiText } from "../../i18n";
import { useAtomValue } from "@effect/atom-react";
import { scopeThreadRef, scopedThreadKey } from "@t3tools/client-runtime/environment";
import { squashAtomCommandFailure } from "@t3tools/client-runtime/state/runtime";
import {
  AuthOrchestrationOperateScope,
  type EnvironmentId,
  type ThreadId,
} from "@t3tools/contracts";
import { useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import * as ThreadUndo from "@t3tools/client-runtime/state/thread-undo";
import { showThreadUndoNotice } from "../../hooks/showThreadUndoNotice";
import { refreshArchivedThreadsForEnvironment } from "../../lib/archivedThreadsState";
import { serverEnvironment } from "../../state/server";
import { useEnvironmentScope } from "../../state/session";
import { threadEnvironment } from "../../state/threads";
import { useOrchestrationCommand } from "../../state/use-orchestration-command";
import { Button } from "../ui/button";

/** The continuation action intentionally archives one segment, never its descendants. */
export function ArchiveOriginalThreadButton({
  environmentId,
  threadId,
  disconnected,
}: {
  environmentId: EnvironmentId;
  threadId: ThreadId;
  disconnected: boolean;
}) {
  const config = useAtomValue(serverEnvironment.configValueAtom(environmentId));
  const permitted = useEnvironmentScope(environmentId, AuthOrchestrationOperateScope);
  const supported = config?.environment.capabilities.threadArchiveSafety === true;
  const archive = useOrchestrationCommand(threadEnvironment.archive, { reportFailure: false });
  const unarchive = useOrchestrationCommand(threadEnvironment.unarchive, { reportFailure: false });
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const target = scopeThreadRef(environmentId, threadId);
  const submit = async () => {
    if (inFlight.current || disconnected || !permitted || !supported) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    const claim = ThreadUndo.begin("archive", scopedThreadKey(target));
    await (async () => {
      try {
        const result = await archive({ environmentId, input: { threadId, requireIdle: true } });
        if (result._tag !== "Success") {
          claim.finish();
          const failure = squashAtomCommandFailure(result);
          setError(
            failure instanceof Error ? failure.message : uiText("Couldn’t archive. Try again."),
          );
          return;
        }
        refreshArchivedThreadsForEnvironment(environmentId);
        showThreadUndoNotice({
          action: "Archived",
          claim,
          failureTitle: uiText("Failed to undo archive"),
          undo: async () => {
            ThreadUndo.invalidate("archive", scopedThreadKey(target));
            const result = await unarchive({ environmentId, input: { threadId } });
            if (result._tag === "Success") refreshArchivedThreadsForEnvironment(environmentId);
            return result;
          },
        });
      } catch {
        claim.finish();
        setError(uiText("Restore the connection to verify the archive status."));
      }
    })().finally(() => {
      inFlight.current = false;
      setBusy(false);
    });
  };
  return (
    <div>
      <Button
        size="xs"
        variant="ghost"
        disabled={busy || disconnected || !permitted || !supported}
        onClick={() => {
          void submit();
        }}
      >
        {busy ? uiText("Verifying and archiving…") : uiText("Archive original conversation")}
      </Button>
      {!supported ? (
        <p className="text-2xs text-muted-foreground">
          {uiText("Update the server to enable safe archiving in this environment.")}
        </p>
      ) : null}
      {error ? (
        <div role="alert" className="text-xs">
          <p>{serverCopy(error)}</p>
          {error.includes(uiText("Linked to an enabled scheduled task", undefined, "zh-CN")) ||
          error.includes("Linked to an enabled scheduled task") ? (
            <Button
              size="xs"
              variant="ghost"
              onClick={() => {
                void navigate({ to: "/settings/scheduled-tasks", search: { environmentId } });
              }}
            >
              {uiText("Manage scheduled tasks.")}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
