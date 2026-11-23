import { expect, it } from "vite-plus/test";
import { render } from "../../../test/render";
import { RunQuota } from "./RunInspector";

it("shows unreadable quota without inventing 0 or available", async () => {
  await using screen = await render(<RunQuota limits={undefined} connected now={0} />);
  expect(screen.container.textContent).toContain("Temporarily unreadable");
  expect(screen.container.textContent).not.toContain("0%");
  expect(screen.container.textContent).not.toContain("available");
});
it("labels failed cached windows as last known", async () => {
  const limits = {
    checkedAt: "2026-10-26T00:00:00Z",
    unavailable: { reason: "probeFailed" as const },
    windows: [{ id: "weekly", label: "Weekly", kind: "weekly" as const, usedPercent: 60 }],
  };
  await using screen = await render(
    <RunQuota limits={limits} connected now={Date.parse(limits.checkedAt)} />,
  );
  expect(screen.container.textContent).toContain("Last known");
  expect(screen.container.textContent).toContain("40% remaining");
  expect(screen.container.textContent).toContain("Temporarily unreadable");
});

it("shows only child task rows and navigates into the child conversation", async () => {
  const { SubtaskList } = await import("./RunInspector");
  const { EnvironmentId, NodeId, ProviderDriverKind, ProviderInstanceId, ThreadId } =
    await import("@t3tools/contracts");
  const DateTime = await import("effect/DateTime");
  const env = EnvironmentId.make("c64-local");
  const task = {
    id: NodeId.make("child"),
    threadId: ThreadId.make("parent"),
    runId: null,
    parentNodeId: NodeId.make("parent"),
    origin: "app_owned" as const,
    createdBy: "agent" as const,
    driver: ProviderDriverKind.make("codex"),
    providerInstanceId: ProviderInstanceId.make("codex"),
    providerThreadId: null,
    childThreadId: ThreadId.make("child-thread"),
    nativeTaskRef: null,
    prompt: "Review",
    title: "复核配色",
    model: null,
    status: "waiting" as const,
    result: null,
    startedAt: null,
    completedAt: null,
    updatedAt: DateTime.makeUnsafe("2026-01-01T00:00:00Z"),
  };
  await using screen = await render(
    <SubtaskList tasks={[task]} environmentId={env} providers={[]} />,
  );
  expect(screen.container.querySelector(".plan-capsule")).toBeNull();
  expect(screen.container.querySelector("details")).toBeNull();
  await screen.getByRole("button", { name: /复核配色/ }).click();
  expect(screen.router?.state.location.pathname).toBe("/c64-local/child-thread");
  await screen.rerender(<SubtaskList tasks={[]} environmentId={env} providers={[]} />);
  expect(screen.container.querySelector("section")).toBeNull();
});
