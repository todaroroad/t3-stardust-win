import { useAtomValue } from "@effect/atom-react";
import type { EnvironmentId } from "@t3tools/contracts";
import { Link } from "@tanstack/react-router";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Option from "effect/Option";
import { HardDriveIcon } from "lucide-react";

import { useUiText } from "~/i18n/useUiText";
import { cn } from "~/lib/utils";
import { formatBytes } from "../../lib/formatBytes";
import { serverEnvironment } from "../../state/server";

/** The one disk entry on the usage page: free space, linking to Settings → Storage & cleanup. */
export function UsageDiskChip({ environmentId }: { readonly environmentId: EnvironmentId }) {
  const t = useUiText();
  const result = useAtomValue(serverEnvironment.storageTidyState({ environmentId, input: {} }));
  const state = Option.getOrNull(AsyncResult.value(result));
  const volume = state?.volumes.find((row) => row.internal) ?? state?.volumes[0];
  if (!volume) return null;
  const low = volume.totalBytes !== null && volume.totalBytes > 0 && volume.freeBytes / volume.totalBytes < 0.15;
  return (
    <Link
      to="/settings/storage"
      aria-label={t("Disk free {size}. Open Storage and cleanup", { size: formatBytes(volume.freeBytes) })}
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs tabular-nums transition-colors hover:bg-accent",
        low ? "border-warning/40 bg-warning/8 text-warning-foreground" : "border-border text-muted-foreground",
      )}
      data-testid="usage-disk-chip"
    >
      <HardDriveIcon className="size-3" />
      {t("Disk free {size}", { size: formatBytes(volume.freeBytes) })}
    </Link>
  );
}
