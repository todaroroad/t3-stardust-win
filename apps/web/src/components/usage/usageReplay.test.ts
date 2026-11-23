import { expect, it } from "vite-plus/test";
import { usageReplayKey } from "./usageReplay";
it("keeps cached and refreshed responses on one replay until the user acts", () => {
  const renders = [0, 24.5, 26.8].map(() => usageReplayKey("cost", 0));
  expect(new Set(renders).size).toBe(1);
  expect(usageReplayKey("cost", 1)).not.toBe(renders[0]);
  expect(usageReplayKey("tokens", 0)).not.toBe(renders[0]);
});
