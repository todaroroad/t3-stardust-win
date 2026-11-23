import { expect, it } from "vite-plus/test";
import type { OrchestrationV2PlanStep } from "@t3tools/contracts";

import {
  capsuleMode,
  countRetries,
  currentMilestoneIndex,
  deriveMilestones,
  milestoneGroupSizes,
} from "./taskMilestones";
import type { TrailActivity } from "./taskTrailModel";

const steps = (statuses: OrchestrationV2PlanStep["status"][]): OrchestrationV2PlanStep[] =>
  statuses.map((status, index) => ({ id: `s${index}`, text: `Step ${index + 1}`, status }));
const command = (
  id: string,
  line: string,
  status: NonNullable<TrailActivity["status"]>,
): TrailActivity => ({
  id,
  kind: "command",
  label: line,
  command: line,
  status,
});

it("shows at most six milestones and merges longer plans in order", () => {
  expect(milestoneGroupSizes(0)).toEqual([]);
  expect(milestoneGroupSizes(4)).toEqual([1, 1, 1, 1]);
  expect(milestoneGroupSizes(6)).toEqual([1, 1, 1, 1, 1, 1]);
  expect(milestoneGroupSizes(7)).toEqual([2, 2, 2, 1]);
  expect(milestoneGroupSizes(14)).toEqual([3, 3, 2, 2, 2, 2]);
  for (const total of [7, 9, 12, 13, 20, 41]) {
    const sizes = milestoneGroupSizes(total);
    expect(sizes.length).toBeGreaterThanOrEqual(3);
    expect(sizes.length).toBeLessThanOrEqual(6);
    expect(sizes.reduce((a, b) => a + b, 0)).toBe(total);
  }
});

it("names a merged milestone after its first unfinished step and derives its status", () => {
  const milestones = deriveMilestones({
    steps: steps([
      "completed",
      "completed",
      "completed",
      "running",
      "pending",
      "pending",
      "pending",
    ]),
    activities: {},
  });
  expect(milestones.map((m) => [m.name, m.status])).toEqual([
    ["Step 2", "done"],
    ["Step 4", "run"],
    ["Step 5", "todo"],
    ["Step 7", "todo"],
  ]);
  expect(deriveMilestones({ steps: steps(["completed", "completed"]), activities: {} })).toEqual([
    expect.objectContaining({ name: "Step 1", status: "done" }),
    expect.objectContaining({ name: "Step 2", status: "done" }),
  ]);
  const [first] = deriveMilestones({
    steps: steps([
      "completed",
      "completed",
      "completed",
      "completed",
      "completed",
      "completed",
      "completed",
    ]),
    activities: {},
  });
  expect(first).toMatchObject({ name: "Step 2", status: "done", completedSteps: 2 });
});

it("counts retries and keeps probes out of the problem count", () => {
  const probes = [
    { id: "p1", kind: "read", label: "Read", path: "a.ts", status: "failed" },
    command("p2", "env | grep TOKEN", "failed"),
  ] satisfies TrailActivity[];
  expect(countRetries(probes)).toEqual({ retries: 0, unresolved: 0 });
  expect(
    countRetries([
      command("a", "pnpm test", "failed"),
      command("b", "pnpm test", "completed"),
      command("c", "pnpm build", "failed"),
    ]),
  ).toEqual({ retries: 1, unresolved: 1 });
  const [milestone] = deriveMilestones({
    steps: steps(["running"]),
    activities: { s0: [...probes, command("c", "pnpm build", "failed")] },
  });
  expect(milestone).toMatchObject({ status: "problem", retries: 0, unresolved: 1 });
  expect(milestone!.operations).toHaveLength(3);
  const [calm] = deriveMilestones({ steps: steps(["running"]), activities: { s0: probes } });
  expect(calm!.status).toBe("run");
});

it("puts a wait before trouble before work in flight", () => {
  const milestones = deriveMilestones({
    steps: steps(["running", "pending", "pending"]),
    activities: { s0: [command("a", "pnpm build", "failed")] },
    waitingStepId: "s1",
  });
  expect(milestones.map((m) => m.status)).toEqual(["problem", "need", "todo"]);
  expect(currentMilestoneIndex(milestones)).toBe(1);
  expect(capsuleMode(milestones, { waiting: true, complete: false })).toBe("need");
  expect(capsuleMode(milestones.slice(0, 1), { waiting: false, complete: false })).toBe("problem");
  expect(
    capsuleMode(deriveMilestones({ steps: steps(["running", "pending"]), activities: {} }), {
      waiting: false,
      complete: false,
    }),
  ).toBe("run");
  expect(
    capsuleMode(deriveMilestones({ steps: steps(["completed", "completed"]), activities: {} }), {
      waiting: false,
      complete: true,
    }),
  ).toBe("done");
  expect(capsuleMode([], { waiting: false, complete: false })).toBe("idle");
  expect(
    currentMilestoneIndex(deriveMilestones({ steps: steps(["completed"]), activities: {} })),
  ).toBe(-1);
});
