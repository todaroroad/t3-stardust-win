import { describe, expect, it, vi } from "vite-plus/test";

import "~/index.css";
import { render } from "../../../test/render";
import { testUiLocale } from "../../../test/uiLocale";
import { TelemetryConsentRow } from "./TelemetryConsentRow";

const state = vi.hoisted(() => ({
  telemetryEnabled: false,
  managedOff: undefined as string | undefined,
  patches: [] as Array<Record<string, unknown>>,
}));

vi.mock(import("./useScopedSettings"), async (original) => ({
  ...(await original()),
  useScopedSettings: (() => ({ telemetryEnabled: state.telemetryEnabled })) as never,
  useScopedSettingsMixed: () => false,
  useUpdateScopedSettings: () => (patch: Record<string, unknown>) => {
    state.patches.push(patch);
  },
}));
// The real row makes its control inert without a connected environment; this test is about the
// row's own copy and writes, so it stands in a plain layout.
vi.mock(import("./settingsLayout"), async (original) => ({
  ...(await original()),
  SettingsRow: (({ title, description, control }: Record<string, React.ReactNode>) => (
    <div>
      <h3>{title}</h3>
      <p>{description}</p>
      {control}
    </div>
  )) as never,
}));
vi.mock(import("~/state/managedPolicy"), async (original) => ({
  ...(await original()),
  usePrimaryManagedPolicy: (() => undefined) as never,
  managedTelemetryOffMessage: () => state.managedOff,
}));

function reset(patch: Partial<typeof state> = {}) {
  Object.assign(state, { telemetryEnabled: false, managedOff: undefined, patches: [] }, patch);
}

describe("usage statistics opt-in row", () => {
  it("is off by default, names the destination and only an explicit click turns it on", async () => {
    reset();
    await using screen = await render(<TelemetryConsentRow />);
    const toggle = screen.getByRole("switch", { name: "Share anonymous usage data" });
    await expect.element(toggle).not.toBeChecked();
    expect(screen.container.textContent).toContain("Off by default");
    expect(screen.container.textContent).toContain("ingest.t3.codes");
    expect(state.patches).toEqual([]);
    await toggle.click();
    expect(state.patches).toEqual([{ telemetryEnabled: true }]);
  });

  it("shows the saved opt-in and switches off with one click", async () => {
    reset({ telemetryEnabled: true });
    await using screen = await render(<TelemetryConsentRow />);
    const toggle = screen.getByRole("switch", { name: "Share anonymous usage data" });
    await expect.element(toggle).toBeChecked();
    await toggle.click();
    expect(state.patches).toEqual([{ telemetryEnabled: false }]);
  });

  it("is locked off when an administrator turned usage data off", async () => {
    reset({ telemetryEnabled: true, managedOff: "Acme turned off anonymous usage data." });
    await using screen = await render(<TelemetryConsentRow />);
    const toggle = screen.getByRole("switch", { name: "Share anonymous usage data" });
    await expect.element(toggle).toBeDisabled();
    await expect.element(toggle).not.toBeChecked();
    expect(screen.container.textContent).toContain("Acme turned off anonymous usage data.");
  });

  it("reads in Chinese without losing the destination", async () => {
    reset();
    using _locale = testUiLocale("zh-CN");
    await using screen = await render(<TelemetryConsentRow />);
    await expect.element(screen.getByRole("switch", { name: "共享匿名使用数据" })).toBeVisible();
    expect(screen.container.textContent).toContain("默认关闭");
    expect(screen.container.textContent).toContain("ingest.t3.codes");
  });
});
