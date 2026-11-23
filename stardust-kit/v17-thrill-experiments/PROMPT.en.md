# Install "V17 High-Contrast Experiments (Rocket / Fusion Reactor / Solar Eclipse / Starsteel Forge)" into Your T3 Code Workbench

Paste the prompt below into Claude Code / Codex / T3 Code:

```text
Using the reference implementation and interactive demo in `stardust-kit/v17-thrill-experiments/` (`demo.html`), integrate "V17 High-Contrast Experiments (Rocket / Fusion Reactor / Solar Eclipse / Starsteel Forge)" (Four high-contrast 5-tier themes (Starship / Fusion Reactor / Solar Eclipse / Starsteel Forge) with tactile upshift juice) as the reasoning effort slider in this T3 Code workspace:
1. Place the Canvas 2D scene engine in `apps/web/src/components/chat/cosmicSliderScenes.ts` with pre-baked offscreen sprite textures to avoid per-frame gradient allocations;
2. Wire it into `apps/web/src/components/chat/CosmicEffortSlider.tsx` with the 50px capsule track, Liquid Glass magnifying lens, `wrap.clientWidth` sizing (no popover scale flash), and 2-second idle auto-sleep (waking immediately on hover, focus, click, or drag);
3. Preserve accessible `role="radiogroup"` radios, arrow-key navigation, and `prefers-reduced-motion: reduce`;
4. Run `vp lint`, `vp run typecheck`, and `CosmicEffortSlider.browser.test.tsx` to verify.
```
