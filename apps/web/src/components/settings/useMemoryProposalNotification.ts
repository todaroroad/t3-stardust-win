import { uiText } from "../../i18n";
import { useEffect, useRef } from "react";
import { useEnvironments } from "../../state/environments";
import { toastManager } from "../ui/toast";

export function useMemoryProposalNotification() {
  const { environments } = useEnvironments();
  const ids = environments.flatMap((environment) =>
    (environment.serverConfig?.settings.memory?.pending ?? []).map(
      ({ id }) => `${environment.environmentId}:${id}`,
    ),
  );
  const key = JSON.stringify(ids);
  const seen = useRef<Set<string> | null>(null);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- settings broadcasts notify the user when a new pending proposal arrives
  useEffect(() => {
    const current = new Set<string>(JSON.parse(key));
    const previous = seen.current;
    if (previous !== null && [...current].some((id) => !previous.has(id))) {
      toastManager.add({
        type: "info",
        title: uiText("New memory proposal to review"),
        description: uiText(
          "Open Settings → Memory to approve, edit, or reject it. Models receive approved memories only.",
        ),
      });
    }
    seen.current = current;
  }, [key]);
}
