import { uiText } from "../i18n";
import { WallArtifactList, type EnvironmentId, type WallArtifact } from "@t3tools/contracts";
import * as Schema from "effect/Schema";
import { readPreparedConnection } from "../state/session";
import { readDesktopPrimaryBearerToken } from "../environments/primary/desktopAuth";

class ArtifactWallError extends Schema.TaggedError<ArtifactWallError>()("ArtifactWallError", {
  message: Schema.String,
}) {}

const decodeWallArtifactList = Schema.decodeUnknownSync(WallArtifactList);

async function listRequestInit(environmentId: EnvironmentId): Promise<RequestInit> {
  const connection = readPreparedConnection(environmentId);
  if (!connection)
    throw new ArtifactWallError({ message: uiText("Connection pending. Try again in a moment.") });
  let token =
    connection.httpAuthorization?._tag === "Bearer" ? connection.httpAuthorization.token : null;
  // Primary HTTP calls use the same desktop bridge when the prepared session has no bearer.
  if (!token && connection.target._tag === "PrimaryConnectionTarget" && window.desktopBridge) {
    try {
      token = await readDesktopPrimaryBearerToken();
    } catch {
      throw new ArtifactWallError({
        message: uiText("Couldn’t read local authorization. Reconnect and try again."),
      });
    }
    if (!token)
      throw new ArtifactWallError({
        message: uiText("Local connection unauthorized. Reconnect and try again."),
      });
  }
  return token
    ? { credentials: "omit", headers: { Authorization: `Bearer ${token}` } }
    : { credentials: "include" };
}

async function wallFetch(url: URL | string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (error) {
    if (init.signal?.aborted) throw error;
    const crossOriginCookie =
      init.credentials === "include" &&
      new URL(url, window.location.href).origin !== window.location.origin;
    throw new ArtifactWallError({
      message: crossOriginCookie
        ? uiText(
            "This sign-in is unavailable across origins. Use a local connection and try again.",
          )
        : uiText("Couldn’t reach the artifact service. Try again."),
    });
  }
}

function artifactWallOrigin(environmentId: EnvironmentId): string | null {
  const connection = readPreparedConnection(environmentId);
  if (!connection || connection.httpAuthorization?._tag === "Dpop") return null;
  const origin = new URL(connection.httpBaseUrl, window.location.href);
  return origin.origin === window.location.origin ||
    ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname)
    ? origin.href
    : null;
}
export function artifactFileUrl(environmentId: EnvironmentId, id: string): string | null {
  const origin = artifactWallOrigin(environmentId);
  return origin ? new URL(`/api/artifact-wall/file/${encodeURIComponent(id)}`, origin).href : null;
}
export async function loadWallArtifacts(
  environmentId: EnvironmentId,
  threadId: string,
  scope: "thread" | "project",
  signal: AbortSignal,
) {
  const origin = artifactWallOrigin(environmentId);
  if (!origin)
    throw new ArtifactWallError({
      message: uiText("Artifacts are available on local connections only."),
    });
  const url = new URL("/api/artifact-wall/list", origin);
  url.searchParams.set("threadId", threadId);
  url.searchParams.set("scope", scope);
  const response = await wallFetch(url, { ...(await listRequestInit(environmentId)), signal });
  if (response.status === 401)
    throw new ArtifactWallError({
      message: uiText("Authorization expired. Reconnect and try again."),
    });
  if (response.status === 403)
    throw new ArtifactWallError({ message: uiText("This connection can’t read artifacts.") });
  if (!response.ok)
    throw new ArtifactWallError({ message: uiText("Couldn’t read artifacts. Try again.") });
  try {
    return decodeWallArtifactList(await response.json()).artifacts;
  } catch {
    throw new ArtifactWallError({ message: uiText("Couldn’t read artifact data. Try again.") });
  }
}
export async function fileFromArtifact(
  environmentId: EnvironmentId,
  artifact: WallArtifact,
): Promise<File> {
  const url = artifactFileUrl(environmentId, artifact.id);
  if (!url) throw new Error(uiText("Artifacts are available on local connections only."));
  // This route authenticates the collected, expiring capability ID (as images do).
  const response = await wallFetch(url, { credentials: "omit" });
  if (!response.ok) throw new Error(uiText("This file is unavailable. Refresh artifacts."));
  try {
    const blob = await response.blob();
    return new File([blob], artifact.name, { type: blob.type });
  } catch {
    throw new ArtifactWallError({ message: uiText("Couldn’t read the file. Try again.") });
  }
}
