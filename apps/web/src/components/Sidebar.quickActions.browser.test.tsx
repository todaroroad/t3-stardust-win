import { createMemoryHistory } from "@tanstack/react-router";
import { DEFAULT_CLIENT_SETTINGS } from "@t3tools/contracts/settings";
import type * as Context from "effect/Context";
import { expect, it, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";

import { AppRoot } from "~/AppRoot";
import "~/components/ChatView";
import "~/index.css";
import { applyThemePalette } from "~/themePalette";
import { __setClientSettingsForTests } from "~/hooks/useSettings";
import { getRouter } from "~/router";
import {
  ENVIRONMENT_ID,
  dispatchedCommands,
  installFakeEnvironment,
  threadWithHistory,
  type FakeDriver,
} from "../../test/fakeEnvironment";
import { render } from "../../test/render";

vi.mock("../../../../packages/client-runtime/src/connection/driver.ts", async (importOriginal) => {
  const [actual, { fakeDriver }, Layer] = await Promise.all([
    importOriginal<{ readonly ConnectionDriver: Context.Key<unknown, FakeDriver> }>(),
    import("../../test/fakeEnvironment"),
    import("effect/Layer"),
  ]);
  return { ...actual, layer: Layer.succeed(actual.ConnectionDriver, fakeDriver) };
});

vi.mock(import("~/rpc/requestLatencyState"), async (original) => ({
  ...(await original()),
  trackRpcRequestSent: () => {},
}));

it("V12 hover actions settle a finished thread without opening it (folder rows)", async () => {
  {
    const boring = true;
    await page.viewport(1400, 900);
    const [open, finished] = [threadWithHistory("open", 1), threadWithHistory("finished", 1)];
    using _environment = installFakeEnvironment([open, finished]);
    __setClientSettingsForTests({
      ...DEFAULT_CLIENT_SETTINGS,
      boringSidebarEnabled: boring,
      onboardingCompletedAt: "2026-01-01T00:00:00.000Z",
    });
    const router = getRouter(
      createMemoryHistory({ initialEntries: [`/${ENVIRONMENT_ID}/${open.id}`] }),
    );
    await router.load();
    await using _app = await render(<AppRoot router={router} />, { router: false });
    applyThemePalette("apple", "light");
    const row = page
      .getByTestId(boring ? "sidebar-row-folder" : "sidebar-row-card")
      .filter({ hasText: finished.title });
    await expect.element(row).toBeInTheDocument();
    await userEvent.hover(row);
    const strip = row.element().querySelector<HTMLElement>("[data-sidebar-quick-actions]");
    expect(strip?.getAttribute("data-sidebar-quick-actions")).toBe("pending");
    const actions = [...strip!.querySelectorAll("[data-sidebar-quick-action]")].map((node) =>
      node.getAttribute("data-sidebar-quick-action"),
    );
    expect(actions).toEqual(["settle", "pin", "archive", "more"]);
    await vi.waitFor(() => expect(getComputedStyle(strip!.parentElement!).opacity).toBe("1"));
    const sidebar = document.querySelector<HTMLElement>('[data-slot="sidebar"]') ?? document.body;
    const before = dispatchedCommands().length;
    await userEvent.click(
      strip!.querySelector<HTMLButtonElement>('[data-sidebar-quick-action="settle"]')!,
    );
    await vi.waitFor(() => {
      const sent = dispatchedCommands().slice(before);
      expect(sent.some((command) => JSON.stringify(command).includes(finished.id))).toBe(true);
    });
    // Still on the thread that was open: settling from the row never navigates.
    expect(router.state.location.pathname).toBe(`/${ENVIRONMENT_ID}/${open.id}`);
  }
});
