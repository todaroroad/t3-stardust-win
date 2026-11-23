import { uiText } from "../../i18n";
import { useEffect, useState } from "react";
import { CheckIcon, RefreshCwIcon } from "lucide-react";
export function UsageRefreshButton({
  busy,
  disabled,
  onClick,
  label,
  iconOnly = false,
}: {
  readonly iconOnly?: boolean;
  readonly busy: boolean;
  readonly disabled: boolean;
  readonly onClick: () => void;
  readonly label: string;
}) {
  const [state, setState] = useState({ busy, updated: false });
  if (state.busy !== busy) setState({ busy, updated: state.busy && !busy });
  const updated = state.updated && !busy;
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- expires the transient completion label after the external read settles
  useEffect(() => {
    if (!updated) return;
    const timer = setTimeout(() => setState((current) => ({ ...current, updated: false })), 1600);
    return () => clearTimeout(timer);
  }, [updated]);
  return (
    <button
      type="button"
      className="usage-refresh-button"
      data-icon-only={iconOnly || undefined}
      data-state={busy ? "busy" : updated ? "updated" : "idle"}
      aria-label={label}
      aria-busy={busy}
      disabled={disabled}
      onClick={onClick}
    >
      {updated ? (
        <CheckIcon size={16} />
      ) : (
        <RefreshCwIcon size={16} data-usage-refresh={busy || undefined} />
      )}
      <span className={iconOnly ? "sr-only" : undefined}>
        {busy ? uiText("Reading") : updated ? uiText("Updated") : label}
      </span>
    </button>
  );
}
