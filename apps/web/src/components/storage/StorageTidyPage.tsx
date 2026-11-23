import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import { squashAtomCommandFailure } from "@t3tools/client-runtime/state/runtime";
import {
  type EnvironmentId,
  type StorageTidyActionInput,
  type StorageTidyOperation,
  type StorageTidySettings,
  type StorageTidyState,
} from "@t3tools/contracts";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Option from "effect/Option";
import { useEffect, useState } from "react";

import { useStableCallback } from "../../hooks/useStableCallback";
import { useUiText } from "~/i18n/useUiText";
import { usePrimaryEnvironmentId } from "../../state/environments";
import { serverEnvironment } from "../../state/server";
import { useAtomCommand } from "../../state/use-atom-command";
import { toastManager } from "../ui/toast";
import { SettingsPageContainer } from "../settings/settingsLayout";
import { useSettingsScope } from "../settings/SettingsScopeContext";
import { StorageTidyView, type StorageTidyViewMode } from "./StorageTidyView";
import { MOLE_INSTALL_COMMAND, defaultSelection } from "./storageTidyModel";

const POLL_MS = 1000;

type Translate = ReturnType<typeof useUiText>;
function errorCopy(t: Translate, code: string): string {
  switch (code) {
    case "build-directory-invalid":
      return t("That folder cannot be used. Choose an existing folder on this computer, other than your home folder or the disk root.");
    case "busy":
      return t("Another cleanup step is still running. Try again in a moment.");
    case "scan-required":
      return t("Scan first, then choose what to clean.");
    case "operation-missing":
    case "not-recoverable":
      return t("This cleanup can no longer be undone.");
    case "nothing-restored":
      return t("Nothing could be put back. The items may have been emptied from Trash or the original folders changed.");
    case "archive-missing":
      return t("The archive folder could not be found.");
    default:
      return t("Cleanup could not continue. Nothing was removed.");
  }
}

export function StorageTidySettingsPanel() {
  const { environment } = useSettingsScope();
  const primary = usePrimaryEnvironmentId();
  const environmentId = environment?.environmentId ?? primary;
  return (
    <SettingsPageContainer width="wide">
      {environmentId ? <StorageTidyEnvironment key={environmentId} environmentId={environmentId} /> : null}
    </SettingsPageContainer>
  );
}

export function StorageTidyEnvironment({ environmentId }: { readonly environmentId: EnvironmentId }) {
  const t = useUiText();
  const atom = serverEnvironment.storageTidyState({ environmentId, input: {} });
  const result = useAtomValue(atom);
  const refresh = useAtomRefresh(atom);
  const queried = Option.getOrNull(AsyncResult.value(result));
  const permitted = useAtomValue(serverEnvironment.storageTidyAct.permissionAtom(environmentId));
  const run = useAtomCommand(serverEnvironment.storageTidyAct, { reportFailure: false });
  // A command returns the fresh state at once; it holds until the query is read again.
  const [override, setOverride] = useState<{ base: StorageTidyState | null; value: StorageTidyState } | null>(null);
  const state = override && override.base === queried ? override.value : queried;
  const [selection, setSelection] = useState<{ scanKey: string; ids: ReadonlySet<string> } | null>(null);
  const [rescueOverride, setRescueOverride] = useState<boolean | null>(null);
  const [volumePath, setVolumePath] = useState("");
  const [submittedAt, setSubmittedAt] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const operation = state?.operation ?? null;
  const finished =
    operation !== null &&
    submittedAt !== null &&
    Date.parse(operation.startedAt) >= submittedAt - 2000 &&
    operation.phase !== "running" &&
    state?.phase === "idle";
  const executing = state?.phase === "executing" || (submittedAt !== null && !finished);
  const mode: StorageTidyViewMode =
    state === null
      ? "start"
      : state.phase === "scanning"
        ? "scanning"
        : executing
          ? "executing"
          : finished && operation !== null && dismissed !== operation.id
            ? "done"
            : state.scan
              ? "result"
              : "start";
  const polling = mode === "scanning" || mode === "executing";
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Poll the server while it scans or cleans; there is no push channel for this state.
  useEffect(() => {
    if (!polling) return;
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
      refresh();
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [polling, refresh]);

  const act = useStableCallback(async (input: StorageTidyActionInput, onFailure?: (message: string) => void) => {
    setPending(true);
    setError(null);
    try {
      const outcome = await run({ environmentId, input });
      if (outcome._tag === "Success") {
        setOverride({ base: queried, value: outcome.value });
        setNowMs(Date.now());
        refresh();
        return true;
      }
      const failure = squashAtomCommandFailure(outcome);
      const code = failure instanceof Error ? failure.message : String((failure as { message?: unknown })?.message ?? failure);
      (onFailure ?? setError)(errorCopy(t, code));
    } catch (cause) {
      (onFailure ?? setError)(errorCopy(t, String(cause)));
    } finally {
      setPending(false);
    }
    return false;
  });

  if (!state)
    return (
      <p role="status" className="text-sm text-muted-foreground">
        {t(result._tag === "Failure" ? "Storage information is unavailable. Nothing was changed." : "Reading storage information…")}
      </p>
    );
  const scanKey = state.scan?.scannedAt ?? "";
  const selected =
    selection && selection.scanKey === scanKey ? selection.ids : defaultSelection(state.scan?.items ?? []);
  const setSelected = (ids: ReadonlySet<string>) => setSelection({ scanKey, ids });
  const rescueEnabled = rescueOverride ?? state.settings.rescueFirst;
  return (
    <StorageTidyView
      state={state}
      mode={mode}
      activeVolumePath={volumePath}
      selected={selected}
      rescueEnabled={rescueEnabled}
      canWrite={permitted === true}
      busy={pending}
      nowMs={nowMs}
      error={error}
      settingsError={settingsError}
      onVolumeChange={setVolumePath}
      onToggle={(id, checked) => {
        const next = new Set(selected);
        if (checked) next.add(id);
        else next.delete(id);
        setSelected(next);
      }}
      onToggleMany={(ids, checked) => {
        const next = new Set(selected);
        for (const id of ids) {
          if (checked) next.add(id);
          else next.delete(id);
        }
        setSelected(next);
      }}
      onRescueChange={setRescueOverride}
      onScan={() => {
        setDismissed(null);
        setSubmittedAt(null);
        void act({ action: "scan" });
      }}
      onExecute={() => {
        setSubmittedAt(Date.now());
        void act({ action: "execute", itemIds: [...selected], rescue: rescueEnabled }).then((ok) => {
          if (!ok) setSubmittedAt(null);
        });
      }}
      onUndo={(op: StorageTidyOperation) => void act({ action: "undo", operationId: op.id })}
      onOpenArchive={(op: StorageTidyOperation) => void act({ action: "open-archive", operationId: op.id })}
      onFinish={() => {
        if (operation) setDismissed(operation.id);
        setSubmittedAt(null);
      }}
      onCopyMoleInstall={() => {
        void navigator.clipboard.writeText(MOLE_INSTALL_COMMAND).then(
          () => toastManager.add({ type: "success", title: t("Command copied"), description: MOLE_INSTALL_COMMAND }),
          () => toastManager.add({ type: "error", title: t("Could not copy the command"), description: MOLE_INSTALL_COMMAND }),
        );
      }}
      onSettingsChange={(patch: Partial<StorageTidySettings>) => {
        setSettingsError(null);
        void act({ action: "settings", ...patch }, setSettingsError);
      }}
    />
  );
}

