import { expect, it } from "vite-plus/test";

import { trailFailureKind } from "./taskTrailFailures";
import type { TrailActivity } from "./taskTrailModel";

const failed = (kind: TrailActivity["kind"], command?: string) =>
  trailFailureKind({ kind, status: "failed", ...(command === undefined ? {} : { command }) });

it("greys out probes and empty searches, and keeps real failures red", () => {
  expect(failed("read")).toBe("no-result");
  expect(failed("search")).toBe("no-result");
  expect(failed("command", "env | grep PATH")).toBe("no-result");
  expect(failed("command", "cd app && ls -la src/missing")).toBe("no-result");
  expect(failed("command", "git status --short")).toBe("no-result");
  expect(trailFailureKind({ kind: "command", status: "no_matches" })).toBe("no-result");
  expect(failed("command", "pnpm test")).toBe("failed");
  expect(failed("command", "cat notes.txt && pnpm build")).toBe("failed");
  expect(failed("command", "git push origin main")).toBe("failed");
  expect(failed("write")).toBe("failed");
  expect(failed("delegate")).toBe("failed");
  expect(
    trailFailureKind({ kind: "command", status: "completed", command: "pnpm test" }),
  ).toBeNull();
});
