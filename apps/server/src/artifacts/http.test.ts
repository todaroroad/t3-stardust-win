import * as NodeHttpPlatform from "@effect/platform-node/NodeHttpPlatform";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { AuthOrchestrationReadScope, AuthSessionId } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { HttpRouter } from "effect/http";
import { expect, it } from "vite-plus/test";
import * as ServerConfig from "../config.ts";
import * as EnvironmentAuth from "../auth/EnvironmentAuth.ts";
import * as ArtifactWall from "./ArtifactWall.ts";
import { routes } from "./http.ts";

it.each([
  {
    name: "authenticated local list",
    host: "127.0.0.1",
    url: "http://127.0.0.1/api/artifact-wall/list?threadId=test",
    credential: "read",
    forwarded: false,
    status: 200,
    lists: 1,
    opens: 0,
  },
  {
    name: "missing credentials",
    host: "127.0.0.1",
    url: "http://127.0.0.1/api/artifact-wall/list?threadId=test",
    credential: "none",
    forwarded: false,
    status: 401,
    lists: 0,
    opens: 0,
  },
  {
    name: "insufficient scope",
    host: "127.0.0.1",
    url: "http://127.0.0.1/api/artifact-wall/list?threadId=test",
    credential: "other",
    forwarded: false,
    status: 403,
    lists: 0,
    opens: 0,
  },
  {
    name: "remote host",
    host: "127.0.0.1",
    url: "http://remote.example/api/artifact-wall/list?threadId=test",
    credential: "read",
    forwarded: false,
    status: 403,
    lists: 0,
    opens: 0,
  },
  {
    name: "public listener",
    host: "0.0.0.0",
    url: "http://127.0.0.1/api/artifact-wall/list?threadId=test",
    credential: "read",
    forwarded: false,
    status: 403,
    lists: 0,
    opens: 0,
  },
  {
    name: "forwarded local request",
    host: "127.0.0.1",
    url: "http://127.0.0.1/api/artifact-wall/list?threadId=test",
    credential: "read",
    forwarded: true,
    status: 403,
    lists: 0,
    opens: 0,
  },
  {
    name: "invalid scope",
    host: "127.0.0.1",
    url: "http://127.0.0.1/api/artifact-wall/list?threadId=test&scope=all",
    credential: "read",
    forwarded: false,
    status: 400,
    lists: 0,
    opens: 0,
  },
  {
    name: "unknown file capability",
    host: "127.0.0.1",
    url: "http://127.0.0.1/api/artifact-wall/file/unknown",
    credential: "none",
    forwarded: false,
    status: 403,
    lists: 0,
    opens: 1,
  },
  {
    name: "remote file capability",
    host: "127.0.0.1",
    url: "http://remote.example/api/artifact-wall/file/known",
    credential: "read",
    forwarded: false,
    status: 403,
    lists: 0,
    opens: 0,
  },
])("$name", async (input) => {
  let lists = 0;
  let opens = 0;
  const services = Layer.mergeAll(
    Layer.mock(ServerConfig.ServerConfig)({
      host: input.host,
    } as ServerConfig.ServerConfig["Service"]),
    Layer.mock(EnvironmentAuth.EnvironmentAuth)({
      authenticateHttpRequest: () =>
        input.credential === "none"
          ? Effect.fail(new EnvironmentAuth.ServerAuthInvalidCredentialError({}))
          : Effect.succeed({
              sessionId: AuthSessionId.make("test"),
              subject: "test",
              method: "browser-session-cookie",
              scopes: input.credential === "read" ? [AuthOrchestrationReadScope] : [],
            } as EnvironmentAuth.AuthenticatedSession),
    }),
    Layer.mock(ArtifactWall.ArtifactWall)({
      list: () =>
        Effect.sync(() => {
          lists++;
          return [];
        }),
      open: () =>
        Effect.sync(() => {
          opens++;
          return null;
        }),
    }),
    NodeServices.layer,
    NodeHttpPlatform.layer,
  );
  const { handler, dispose } = HttpRouter.toWebHandler(
    routes.pipe(HttpRouter.provideRequest(services)),
    { disableLogger: true },
  );
  try {
    const response = await handler(
      new Request(input.url, {
        headers: {
          host: new URL(input.url).host,
          ...(input.forwarded ? { "x-forwarded-for": "10.0.0.1" } : {}),
        },
      }),
    );
    expect(response.status).toBe(input.status);
    expect(lists).toBe(input.lists);
    expect(opens).toBe(input.opens);
  } finally {
    await dispose();
  }
});
