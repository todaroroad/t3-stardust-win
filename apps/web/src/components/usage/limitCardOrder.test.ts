import { describe, expect, it } from "vite-plus/test";
import { applyLimitCardOrder, moveLimitCard } from "./limitCardOrder";

const pools = [
  { id: "antigravity", driver: "antigravity" },
  { id: "grok", driver: "grok" },
  { id: "claude-2", driver: "claudeAgent" },
  { id: "claude-1", driver: "claudeAgent" },
  { id: "codex", driver: "codex" },
];
const order = (saved: readonly string[] | null) =>
  applyLimitCardOrder(
    pools,
    saved,
    (pool) => pool.id,
    (pool) => pool.driver,
  ).map((pool) => pool.id);

describe("V14 limit card order", () => {
  it("keeps the auto order until the user drags", () => {
    expect(order(null)).toEqual(pools.map((pool) => pool.id));
  });
  it("follows the saved order, drops vanished ids, and slots new ones beside their provider", () => {
    expect(order(["codex", "claude-1", "gone", "antigravity", "grok"])).toEqual([
      "codex",
      "claude-1",
      "claude-2",
      "antigravity",
      "grok",
    ]);
  });
  it("moves a card to a new index without losing others", () => {
    expect(moveLimitCard(["a", "b", "c", "d"], "d", 1)).toEqual(["a", "d", "b", "c"]);
    expect(moveLimitCard(["a", "b"], "a", 9)).toEqual(["b", "a"]);
  });
});
