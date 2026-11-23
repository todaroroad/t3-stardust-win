// @effect-diagnostics nodeBuiltinImport:off -- Hashes a downloaded file outside any Effect runtime.
/**
 * T3 Stardust's own macOS update feed and installer. Squirrel.Mac only installs Developer ID
 * builds and public Stardust builds are ad-hoc signed, so the fork verifies, extracts and swaps
 * its GitHub release zip itself. Nothing here reaches the network.
 *
 * @module stardustUpdate
 */
/* oxlint-disable t3code/no-low-value-comments -- The owner asked for this TODO; no tracking issue exists yet. */
// TODO(windows): electron-updater with a `github` provider for zds-xiaoxin/xiaoxin-t3code can
// serve Windows NSIS builds once they publish latest.yml; Windows and Linux are unchanged until then.
/* oxlint-enable t3code/no-low-value-comments */
import * as NodeCrypto from "node:crypto";
import * as NodeFS from "node:fs";

export const STARDUST_REPOSITORY = "zds-xiaoxin/xiaoxin-t3code";
export const STARDUST_LATEST_RELEASE_API = `https://api.github.com/repos/${STARDUST_REPOSITORY}/releases/latest`;
export const STARDUST_BUILD_INFO_FILE = "stardust-build.json";

export type StardustUpdateErrorCode =
  | "network"
  | "rate-limited"
  | "invalid-release"
  | "no-mac-asset"
  | "digest-mismatch"
  | "extract-failed"
  | "bundle-mismatch"
  | "version-mismatch"
  | "signature-invalid"
  | "not-writable"
  | "translocated"
  | "no-download"
  | "install-failed";

/**
 * User-facing English source text; the web UI translates these exact strings, so keep them free of
 * interpolated values. Details go to the cause and the update log.
 */
export const STARDUST_UPDATE_ERROR_MESSAGES: Readonly<Record<StardustUpdateErrorCode, string>> = {
  network: "Couldn’t reach GitHub to check for updates. Try again later.",
  "rate-limited": "GitHub is rate-limiting update checks. Try again later.",
  "invalid-release": "The latest release information is invalid.",
  "no-mac-asset": "The latest release has no verifiable Mac Apple Silicon build.",
  "digest-mismatch": "The downloaded update failed its checksum. It was deleted; try again.",
  "extract-failed": "Couldn’t unpack the downloaded update. Try again.",
  "bundle-mismatch": "The downloaded update is not T3 Stardust, so it was not installed.",
  "version-mismatch":
    "The downloaded update does not match the release version, so it was not installed.",
  "signature-invalid":
    "The downloaded update failed its code signature check, so it was not installed.",
  "not-writable":
    "T3 Stardust can’t replace itself in this folder. Move it to Applications or a folder you can write to, then try again.",
  translocated:
    "macOS is running T3 Stardust from a temporary location. Move it to the Applications folder, open it from there, then try again.",
  "no-download": "No downloaded update is ready to install.",
  "install-failed": "Couldn’t start the update installer. Your current version is unchanged.",
};

// Thrown inside the updater's promises and carried as ElectronUpdater error causes.
// @effect-diagnostics-next-line extendsNativeError:off
export class StardustUpdateError extends Error {
  readonly code: StardustUpdateErrorCode;
  readonly detail: string | undefined;
  constructor(code: StardustUpdateErrorCode, detail?: string) {
    super(STARDUST_UPDATE_ERROR_MESSAGES[code]);
    this.name = "StardustUpdateError";
    this.code = code;
    this.detail = detail;
  }
}

/** The user-facing text of a Stardust update failure, found anywhere in a cause chain. */
export function stardustUpdateUserMessage(cause: unknown): string | null {
  let current: unknown = cause;
  for (let depth = 0; depth < 5 && current !== null && current !== undefined; depth += 1) {
    if (current instanceof StardustUpdateError) return current.message;
    current = typeof current === "object" ? (current as { cause?: unknown }).cause : undefined;
  }
  return null;
}

export type StardustVersion = readonly [major: number, minor: number, patch: number];

/** Public Stardust versions are plain `major.minor.patch` (optionally `v`-prefixed), major >= 1. */
export function parseStardustVersion(value: string): StardustVersion | null {
  const match = /^v?([1-9]\d{0,5})\.(\d{1,5})\.(\d{1,5})$/.exec(value.trim());
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/** Negative when `left` is older, 0 when equal, positive when newer. Null when either is invalid. */
export function compareStardustVersions(left: string, right: string): number | null {
  const a = parseStardustVersion(left);
  const b = parseStardustVersion(right);
  if (!a || !b) return null;
  for (let index = 0; index < 3; index += 1) {
    const difference = a[index]! - b[index]!;
    if (difference !== 0) return difference;
  }
  return 0;
}

/** Only a strictly newer public release is ever offered: never an equal or older one. */
export function isStardustUpgrade(candidate: string, running: string): boolean {
  const comparison = compareStardustVersions(candidate, running);
  return comparison !== null && comparison > 0;
}

export function normalizeStardustVersion(value: string): string | null {
  const parsed = parseStardustVersion(value);
  return parsed ? parsed.join(".") : null;
}

export interface StardustBuildInfo {
  /** The public release this build corresponds to, e.g. `1.2.1`. */
  readonly communityVersion: string;
  /** Local build label such as `C109-stardust`; public zips carry one too. */
  readonly customBuild: string | null;
}

/** Reads Contents/Resources/stardust-build.json; null unless it names a valid community version. */
export function parseStardustBuildInfo(raw: string): StardustBuildInfo | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const communityVersion =
    typeof record.communityVersion === "string"
      ? normalizeStardustVersion(record.communityVersion)
      : null;
  if (communityVersion === null) return null;
  return {
    communityVersion,
    customBuild:
      typeof record.customBuild === "string" && record.customBuild.trim().length > 0
        ? record.customBuild.trim()
        : null,
  };
}

export interface StardustRelease {
  readonly version: string;
  readonly tag: string;
  readonly releaseName: string | null;
  readonly releaseNotes: string | null;
  readonly releaseDate: string | null;
  readonly asset: {
    readonly name: string;
    readonly url: string;
    readonly size: number;
    readonly sha256: string;
  };
}

export function stardustMacAssetNames(version: string): ReadonlyArray<string> {
  return [`T3-Stardust-v${version}-macOS-arm64.zip`, `T3-Stardust-${version}-macOS-arm64.zip`];
}

/** Parses GitHub's `releases/latest` response. Only URLs this function builds are ever fetched. */
export function parseStardustRelease(value: unknown): StardustRelease {
  if (!value || typeof value !== "object") throw new StardustUpdateError("invalid-release");
  const release = value as Record<string, unknown>;
  const tag = typeof release.tag_name === "string" ? release.tag_name : "";
  const version = /^v/.test(tag) ? normalizeStardustVersion(tag) : null;
  if (version === null || release.draft !== false || release.prerelease !== false) {
    throw new StardustUpdateError("invalid-release", `unexpected release ${tag || "(no tag)"}`);
  }
  const names = stardustMacAssetNames(version);
  const assets = Array.isArray(release.assets) ? release.assets : [];
  for (const name of names) {
    const asset = assets.find(
      (entry: unknown): entry is Record<string, unknown> =>
        !!entry && typeof entry === "object" && (entry as Record<string, unknown>).name === name,
    );
    if (!asset) continue;
    const digest = typeof asset.digest === "string" ? asset.digest : "";
    const match = /^sha256:([a-f0-9]{64})$/.exec(digest);
    if (
      asset.state !== "uploaded" ||
      typeof asset.size !== "number" ||
      !Number.isSafeInteger(asset.size) ||
      asset.size <= 0 ||
      !match
    ) {
      continue;
    }
    return {
      version,
      tag,
      releaseName: typeof release.name === "string" ? release.name : null,
      releaseNotes: typeof release.body === "string" ? release.body : null,
      releaseDate: typeof release.published_at === "string" ? release.published_at : null,
      asset: {
        name,
        url: `https://github.com/${STARDUST_REPOSITORY}/releases/download/${encodeURIComponent(tag)}/${encodeURIComponent(name)}`,
        size: asset.size,
        sha256: match[1]!,
      },
    };
  }
  throw new StardustUpdateError("no-mac-asset", `release ${tag} has no complete arm64 zip`);
}

export function sha256OfFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = NodeCrypto.createHash("sha256");
    const stream = NodeFS.createReadStream(filePath);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

/** Resolves when the file's sha256 equals `expectedHex`; otherwise rejects with digest-mismatch. */
export async function verifyFileSha256(filePath: string, expectedHex: string): Promise<void> {
  const expected = expectedHex.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(expected)) {
    throw new StardustUpdateError("digest-mismatch", "expected digest is not a sha256 hex string");
  }
  const actual = await sha256OfFile(filePath);
  if (actual !== expected) {
    throw new StardustUpdateError("digest-mismatch", `expected ${expected}, got ${actual}`);
  }
}

/** The `.app` bundle that contains `resourcesPath` (…/X.app/Contents/Resources), or null. */
export function appBundleOfResourcesPath(resourcesPath: string): string | null {
  const match = /^(.*\.app)\/Contents\/Resources\/?$/.exec(resourcesPath);
  return match?.[1] ?? null;
}

/** App Translocation runs quarantined apps from a read-only random path; replacing it is useless. */
export function isTranslocatedAppPath(appPath: string): boolean {
  return /\/AppTranslocation\//.test(appPath);
}

export function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export interface StardustInstallScriptOptions {
  /** The running app's process id; the script waits for it to exit. */
  readonly pid: number;
  /** The installed bundle to replace, e.g. /Applications/T3 Stardust.app. */
  readonly currentAppPath: string;
  /** The verified, extracted new bundle. */
  readonly newAppPath: string;
  /** ~/Library/Application Support/T3 Stardust/update-backup/<running version> */
  readonly backupDir: string;
  /** ~/Library/Logs/T3 Stardust/update.log */
  readonly logPath: string;
  /** The per-version download folder, removed after a successful install. */
  readonly cleanupDir: string | null;
  readonly fromVersion: string;
  readonly toVersion: string;
  /** False when installing on a normal quit: the user asked the app to stop, so it stays closed. */
  readonly relaunch: boolean;
  /** Seconds to wait for the app to quit before giving up without changing anything. */
  readonly waitTimeoutSeconds?: number;
  /** Overridable for tests; production uses /usr/bin/open. */
  readonly openCommand?: string;
}

/**
 * A zsh script that swaps the app bundle after the app quits and rolls back on any failure.
 * Never uses sudo: when the folder is not writable the move fails and the old app is restored.
 */
export function buildStardustInstallScript(options: StardustInstallScriptOptions): string {
  const backupApp = `${options.backupDir}/${options.currentAppPath.split("/").pop() ?? "T3 Stardust.app"}`;
  const slash = options.currentAppPath.lastIndexOf("/");
  const stagedApp = `${options.currentAppPath.slice(0, slash + 1)}.${options.currentAppPath.slice(slash + 1)}.update-previous`;
  const openCommand = options.openCommand ?? "/usr/bin/open";
  const waitTimeout = Math.max(1, Math.floor(options.waitTimeoutSeconds ?? 600));
  return `#!/bin/zsh
# T3 Stardust updater: ${options.fromVersion} -> ${options.toVersion}
set -u
umask 022
PID=${options.pid}
CURRENT=${shellQuote(options.currentAppPath)}
NEW=${shellQuote(options.newAppPath)}
BACKUP_DIR=${shellQuote(options.backupDir)}
BACKUP=${shellQuote(backupApp)}
STAGED=${shellQuote(stagedApp)}
LOG=${shellQuote(options.logPath)}
CLEANUP=${shellQuote(options.cleanupDir ?? "")}
RELAUNCH=${options.relaunch ? 1 : 0}
OPEN=${shellQuote(openCommand)}
FROM=${shellQuote(options.fromVersion)}
TO=${shellQuote(options.toVersion)}

mkdir -p "\${LOG:h}" 2>/dev/null
log() { print -r -- "$(/bin/date '+%Y-%m-%d %H:%M:%S') [$$] $*" >> "$LOG" 2>/dev/null; }

relaunch() {
  (( RELAUNCH )) || return 0
  env -i HOME="$HOME" USER="\${USER:-}" LOGNAME="\${LOGNAME:-}" TMPDIR="\${TMPDIR:-/tmp}" \\
    PATH=/usr/bin:/bin:/usr/sbin:/sbin "$OPEN" "$1" >> "$LOG" 2>&1
}

restore_previous() {
  if [[ -e "$CURRENT" ]]; then
    /bin/rm -rf "$CURRENT" >> "$LOG" 2>&1
  fi
  if /bin/mv "$STAGED" "$CURRENT" >> "$LOG" 2>&1; then
    log "rolled back to $FROM"
    return 0
  fi
  log "ROLLBACK FAILED: the previous app is kept at $STAGED"
  return 1
}

fail_before_swap() {
  log "update to $TO not applied: $1"
  relaunch "$CURRENT"
  exit 1
}

fail_after_swap() {
  log "update to $TO failed: $1; rolling back"
  if restore_previous; then
    relaunch "$CURRENT"
  else
    relaunch "$STAGED"
  fi
  exit 1
}

log "waiting for pid $PID to quit (update $FROM -> $TO)"
waited=0
while kill -0 "$PID" 2>/dev/null; do
  if (( waited >= ${waitTimeout * 10} )); then
    log "app did not quit within ${waitTimeout}s; update to $TO not applied"
    exit 1
  fi
  sleep 0.1
  (( waited += 1 ))
done

[[ -d "$NEW/Contents" ]] || fail_before_swap "new app is missing at $NEW"
[[ -d "$CURRENT/Contents" ]] || fail_before_swap "current app is missing at $CURRENT"
if [[ -e "$STAGED" ]]; then
  /bin/rm -rf "$STAGED" >> "$LOG" 2>&1 || fail_before_swap "cannot clear $STAGED"
fi

# A rename in the same folder is atomic, so the previous app is never half-moved.
/bin/mv "$CURRENT" "$STAGED" >> "$LOG" 2>&1 || fail_before_swap "cannot move $CURRENT aside (is the folder writable?)"
/bin/mv "$NEW" "$CURRENT" >> "$LOG" 2>&1 || fail_after_swap "cannot move the new app into place"
[[ -f "$CURRENT/Contents/Info.plist" && -d "$CURRENT/Contents/MacOS" ]] || fail_after_swap "the installed app is incomplete"
log "installed $TO at $CURRENT"

if (( RELAUNCH )); then
  relaunch "$CURRENT" || fail_after_swap "could not open the new app"
  log "relaunched $TO"
fi

# Keep the previous version as the only backup.
if /bin/mkdir -p "$BACKUP_DIR" >> "$LOG" 2>&1; then
  for old in "\${BACKUP_DIR:h}"/*(N/); do
    [[ "$old" == "$BACKUP_DIR" ]] || /bin/rm -rf "$old" >> "$LOG" 2>&1
  done
  [[ -e "$BACKUP" ]] && /bin/rm -rf "$BACKUP" >> "$LOG" 2>&1
  if /bin/mv "$STAGED" "$BACKUP" >> "$LOG" 2>&1; then
    log "backed up $FROM to $BACKUP"
  else
    log "could not move the previous app to $BACKUP; removing it"
    /bin/rm -rf "$STAGED" >> "$LOG" 2>&1
  fi
else
  log "could not create $BACKUP_DIR; removing the previous app"
  /bin/rm -rf "$STAGED" >> "$LOG" 2>&1
fi
if [[ -n "$CLEANUP" && -d "$CLEANUP" ]]; then
  /bin/rm -rf "$CLEANUP" >> "$LOG" 2>&1
fi
log "update to $TO finished"
exit 0
`;
}
