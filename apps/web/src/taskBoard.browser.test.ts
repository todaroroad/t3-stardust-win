import { fakeTimers } from "../test/render";
import { expect, it, vi } from "vite-plus/test";
import { refreshTaskBoard, startTaskBoardPolling, useTaskBoard } from "./taskBoard";

it("does not publish identical polls, slows blurred windows and stops hidden timers", async () => {
  using _timers = fakeTimers();
  {
    using visible = vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    using focus = vi.spyOn(document, "hasFocus").mockReturnValue(true);
    using fetch = vi.spyOn(globalThis, "fetch").mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            tasks: [],
            counts: {
              active: 0,
              user: 0,
              blocked: 0,
              agent: 0,
              stale: 0,
              done_week: 0,
              badge: 0,
            },
          }),
        ),
    );
    const stop = startTaskBoardPolling();
    try {
      await refreshTaskBoard();
      const state = useTaskBoard.getState();
      const changed = vi.fn();
      const unsubscribe = useTaskBoard.subscribe(changed);
      try {
        await vi.advanceTimersByTimeAsync(30000);
        expect(fetch).toHaveBeenCalledTimes(2);
        expect(useTaskBoard.getState()).toBe(state);
        expect(changed).not.toHaveBeenCalled();
        focus.mockReturnValue(false);
        window.dispatchEvent(new Event("blur"));
        await vi.advanceTimersByTimeAsync(119999);
        expect(fetch).toHaveBeenCalledTimes(2);
        await vi.advanceTimersByTimeAsync(1);
        expect(fetch).toHaveBeenCalledTimes(3);
        visible.mockReturnValue("hidden");
        document.dispatchEvent(new Event("visibilitychange"));
        await refreshTaskBoard();
        expect(vi.getTimerCount()).toBe(0);
        await vi.advanceTimersByTimeAsync(240000);
        expect(fetch).toHaveBeenCalledTimes(3);
        visible.mockReturnValue("visible");
        focus.mockReturnValue(true);
        document.dispatchEvent(new Event("visibilitychange"));
        await refreshTaskBoard();
        expect(fetch).toHaveBeenCalledTimes(4);
      } finally {
        unsubscribe();
      }
    } finally {
      stop();
    }
  }
});
