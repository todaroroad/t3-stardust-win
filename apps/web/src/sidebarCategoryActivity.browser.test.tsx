import { expect, it, vi } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import { act, fakeTimers, render } from "../test/render";
import { useStableCategoryOrder, type CategorySection } from "./sidebarCategoryActivity";
import type { SidebarProjectSnapshot } from "./sidebarProjectGrouping";
import { observeSidebarList } from "./lib/sidebarListMotion";

function Harness({ reverse = false }: { reverse?: boolean }) {
  const sections: CategorySection[] = [
    {
      group: "工具与系统",
      projects: (reverse ? ["b", "a"] : ["a", "b"]).map(
        (projectKey) => ({ projectKey }) as SidebarProjectSnapshot,
      ),
    },
  ];
  const { sections: ordered, attachInteraction } = useStableCategoryOrder(sections);
  return (
    <>
      <div aria-label="sidebar" ref={attachInteraction}>
        <ul ref={observeSidebarList}>
          {ordered![0]!.projects.map((project) => (
            <li key={project.projectKey}>
              <button>{project.projectKey}</button>
            </li>
          ))}
        </ul>
      </div>
      <button>outside</button>
    </>
  );
}
it("holds order during pointer or keyboard interaction and coalesces updates after leaving", async () => {
  await using screen = await render(<Harness />, { router: false }); // The harness owns order, not routing.
  const order = () => [...screen.container.querySelectorAll("li")].map((node) => node.textContent);
  await userEvent.hover(screen.getByRole("button", { name: "a", exact: true }));
  await screen.rerender(<Harness reverse />);
  using _timers = fakeTimers();
  await act(() => {
    vi.advanceTimersByTime(2000);
  });
  expect(order()).toEqual(["a", "b"]);
  await act(() => {
    screen.getByRole("button", { name: "a", exact: true }).element().focus();
  });
  await userEvent.hover(screen.getByRole("button", { name: "outside" }));
  await act(() => {
    vi.advanceTimersByTime(2000);
  });
  expect(order()).toEqual(["a", "b"]);
  await act(() => {
    screen.getByRole("button", { name: "outside" }).element().focus();
  });
  await act(() => {
    vi.advanceTimersByTime(999);
  });
  expect(order()).toEqual(["a", "b"]);
  await act(() => {
    vi.advanceTimersByTime(1);
  });
  expect(order()).toEqual(["b", "a"]);
});
it("has no idle position timers or intersection observers and skips FLIP with reduced motion", async () => {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  using _matches = vi.spyOn(media, "matches", "get").mockReturnValue(true);
  using _query = vi.spyOn(window, "matchMedia").mockReturnValue(media);
  await using screen = await render(<Harness />, { router: false }); // Only list motion is exercised.
  using animate = vi.spyOn(Element.prototype, "animate");
  using interval = vi.spyOn(window, "setInterval");
  using observer = vi.spyOn(window, "IntersectionObserver");
  using _timers = fakeTimers();
  await screen.rerender(<Harness reverse />);
  await act(() => {
    vi.advanceTimersByTime(1000);
  });
  expect(animate).not.toHaveBeenCalled();
  expect(interval).not.toHaveBeenCalled();
  expect(observer).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});

it("plays a finite transform FLIP on reorder and does not restart for identical order", async () => {
  await using screen = await render(<Harness />, { router: false }); // List movement is independent of navigation.
  using animate = vi.spyOn(Element.prototype, "animate");
  using _timers = fakeTimers();
  await screen.rerender(<Harness reverse />);
  await act(() => {
    vi.advanceTimersByTime(1000);
  });
  expect(animate).toHaveBeenCalledTimes(2);
  expect(
    animate.mock.calls.every(
      ([, options]) =>
        typeof options === "object" &&
        options?.duration === 250 &&
        options.iterations === undefined,
    ),
  ).toBe(true);
  animate.mockClear();
  await screen.rerender(<Harness reverse />);
  expect(animate).not.toHaveBeenCalled();
  await screen.unmount();
  expect(vi.getTimerCount()).toBe(0);
});
