import { useState } from "react";
import { expect, it } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";

import { render } from "../../../test/render";
import { CosmicEffortSlider } from "./CosmicEffortSlider";

const options = [
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
];

function Harness() {
  const [value, setValue] = useState("medium");
  return (
    <CosmicEffortSlider label="Thinking" options={options} value={value} onChange={setValue}>
      <div role="radiogroup" aria-label="Thinking">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={option.id === value}
            onClick={() => setValue(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </CosmicEffortSlider>
  );
}

it("renders the single V18 Starship scene and updates flight stage with level", async () => {
  await using screen = await render(<Harness />, { router: false }); // no routes involved
  const root = document.querySelector("[data-cosmic-effort-slider]")!;
  expect(root.getAttribute("data-cosmic-scene")).toBe("starship");
  expect(document.querySelector("[data-cosmic-variant-pills]")).toBeNull();
  await expect.element(screen.getByText("Reasoning effort · Medium")).toBeInTheDocument();
  await expect.element(screen.getByText("Max-Q · breaking clouds")).toBeInTheDocument();
  await expect.element(screen.getByText("3 levels")).toBeInTheDocument();

  // Level radios passed as children drive both the heading and the Starship flight beat.
  await userEvent.click(screen.getByRole("radio", { name: "Low" }));
  await expect.element(screen.getByText("Reasoning effort · Low")).toBeInTheDocument();
  await expect.element(screen.getByText("Pad standby · cryo mist")).toBeInTheDocument();

  await userEvent.click(screen.getByRole("radio", { name: "High" }));
  await expect.element(screen.getByText("Reasoning effort · High")).toBeInTheDocument();
  await expect.element(screen.getByText("Deep-space warp · full mission")).toBeInTheDocument();
});

it("keeps only the level radios in the Thinking radiogroup", async () => {
  await using screen = await render(<Harness />, { router: false }); // no routes involved
  const levels = screen.getByRole("radiogroup", { name: "Thinking" });
  await expect.element(levels.getByRole("radio")).toHaveLength(3);
});

it("auto-sleeps the canvas loop after 2s of idle and wakes on interaction", async () => {
  await using screen = await render(<Harness />, { router: false });
  const canvas = document.querySelector<HTMLCanvasElement>("[data-cosmic-track] canvas")!;
  await expect.poll(() => canvas.dataset.renderState, { timeout: 1000 }).toBe("active");
  await expect.poll(() => canvas.dataset.renderState, { timeout: 4000 }).toBe("sleeping");

  await userEvent.click(screen.getByRole("radio", { name: "High" }));
  await expect.poll(() => canvas.dataset.renderState, { timeout: 1000 }).toBe("active");
});
