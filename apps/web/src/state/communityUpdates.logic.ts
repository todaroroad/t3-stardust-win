import { uiText } from "../i18n";
/** Community releases are independent of upstream Electron version numbers. */
/** The community release this build ships as. Bump with every public release. */
export const COMMUNITY_BASE_TAG = "v1.2.1";
export const COMMUNITY_REPOSITORY = "zds-xiaoxin/xiaoxin-t3code";
export const COMMUNITY_RELEASES_URL = `https://github.com/${COMMUNITY_REPOSITORY}/releases`;
export const COMMUNITY_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
export type CommunityUpdateMode = "standard" | "custom";
export interface CommunityRelease {
  tag: string;
  number: number;
  url: string;
  compareUrl: string;
}
/**
 * Maps community release tags onto a monotonically increasing integer order:
 * - Legacy C-series tags: `xiaoxin-c48-macos-20261112` -> 48
 * - Stardust semver tags (major >= 1): `v1.0.0` -> 1_010_000 (keeps upstream `v0.x.y` tags rejected)
 */
export function communityReleaseNumber(tag: string): number | null {
  const legacy = /^xiaoxin-c([1-9]\d*)-macos-\d{8}$/.exec(tag);
  if (legacy) {
    const number = Number(legacy[1]);
    return Number.isSafeInteger(number) ? number : null;
  }
  const semver = /^v([1-9]\d*)\.(\d+)\.(\d+)$/.exec(tag);
  if (semver) {
    const major = Number(semver[1]);
    const minor = Number(semver[2]);
    const patch = Number(semver[3]);
    if (minor < 100 && patch < 100) {
      const encoded = 1_000_000 + major * 10_000 + minor * 100 + patch;
      return Number.isSafeInteger(encoded) ? encoded : null;
    }
  }
  return null;
}
function expectedMacAssetNames(tag: string, number: number): ReadonlyArray<string> {
  const semver = /^v([1-9]\d*\.\d+\.\d+)$/.exec(tag);
  if (semver) return [`T3-Stardust-${semver[1]}-macOS-arm64.zip`];
  return [`Xiaoxin-T3-Code-C${number}-macOS-arm64.zip`];
}
export function parseCommunityRelease(value: unknown): CommunityRelease {
  if (!value || typeof value !== "object") throw new Error(uiText("Invalid release information"));
  const release = value as Record<string, unknown>;
  const tag = typeof release.tag_name === "string" ? release.tag_name : "";
  const number = communityReleaseNumber(tag);
  if (number === null || release.draft !== false || release.prerelease !== false) {
    throw new Error(uiText("The latest release is unavailable for Mac"));
  }
  const allowedAssetNames = expectedMacAssetNames(tag, number);
  if (
    !Array.isArray(release.assets) ||
    !release.assets.some((asset: unknown) => {
      if (!asset || typeof asset !== "object") return false;
      const file = asset as Record<string, unknown>;
      return (
        typeof file.name === "string" &&
        allowedAssetNames.includes(file.name) &&
        file.state === "uploaded" &&
        typeof file.size === "number" &&
        file.size > 0 &&
        typeof file.digest === "string" &&
        /^sha256:[a-f0-9]{64}$/.test(file.digest)
      );
    })
  )
    throw new Error(
      uiText("No complete, verifiable Mac Apple Silicon build is available for this release"),
    );
  // Construct trusted URLs; do not follow arbitrary URLs supplied by a response.
  return {
    tag,
    number,
    url: `${COMMUNITY_RELEASES_URL}/tag/${tag}`,
    compareUrl: `https://github.com/${COMMUNITY_REPOSITORY}/compare/${COMMUNITY_BASE_TAG}...${tag}`,
  };
}
export function communityUpdateActions(mode: CommunityUpdateMode) {
  return {
    canOpenDownloadPage: mode === "standard",
    canViewSourceDiff: mode === "custom",
    canInstall: false as const,
  };
}
