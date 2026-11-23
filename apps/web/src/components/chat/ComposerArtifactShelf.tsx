import type { WallArtifact } from "@t3tools/contracts";
import { FileIcon, ImagesIcon } from "lucide-react";
import { uiText } from "~/i18n";
import { Button } from "../ui/button";
import type { ComposerBannerStackItem } from "./ComposerBannerStack";

/** This turn's artifacts, on the composer's top edge; the Artifacts tab holds the full wall. */
export function artifactShelfBannerItem({
  artifacts,
  imageUrl,
  onView,
  onDismiss,
}: {
  readonly artifacts: readonly WallArtifact[];
  /** Resolves an image artifact to its file URL for the small previews; null skips it. */
  readonly imageUrl?: (artifact: WallArtifact) => string | null;
  readonly onView: () => void;
  readonly onDismiss: () => void;
}): ComposerBannerStackItem {
  const names = artifacts.slice(0, 2).map((artifact) => artifact.name);
  const previews = imageUrl
    ? artifacts
        .filter((artifact) => artifact.kind === "image")
        .slice(0, 3)
        .flatMap((artifact) => {
          const src = imageUrl(artifact);
          return src ? [{ id: artifact.id, name: artifact.name, src }] : [];
        })
    : [];
  const title = uiText("This turn's artifacts {count}", { count: artifacts.length });
  const more = artifacts.length - names.length;
  return {
    id: "turn-artifacts",
    variant: "info",
    icon: artifacts.some((artifact) => artifact.kind === "image") ? <ImagesIcon /> : <FileIcon />,
    title:
      previews.length === 0 ? (
        title
      ) : (
        <span className="inline-flex min-w-0 items-center gap-2" data-artifact-shelf-previews="">
          <span className="inline-flex shrink-0 gap-1">
            {previews.map((preview) => (
              <img
                key={preview.id}
                src={preview.src}
                alt=""
                loading="lazy"
                decoding="async"
                className="h-4 w-6 rounded-xs object-cover ring-1 ring-border"
              />
            ))}
          </span>
          <span className="truncate">{title}</span>
        </span>
      ),
    description: `${names.join(" · ")}${more > 0 ? ` · ${uiText("+{count} more", { count: more })}` : ""}`,
    actions: (
      <Button size="xs" variant="ghost" onClick={onView}>
        {uiText("View in panel")}
      </Button>
    ),
    dismissLabel: uiText("Hide this turn's artifacts"),
    onDismiss,
  };
}
