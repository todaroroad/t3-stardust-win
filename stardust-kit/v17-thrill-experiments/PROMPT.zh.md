# 将「V17 高对比升档实验 4 套（火箭 / 聚变核心 / 日食弹弓 / 星钢淬火）」装进你的 T3 Code 工作台

直接把下面这段提示词发给 Claude Code / Codex / T3 Code 即可自动完成集成：

```text
请参考仓库目录 `stardust-kit/v17-thrill-experiments/` 中的完整源码与交互预览（`demo.html`），将「V17 高对比升档实验 4 套（火箭 / 聚变核心 / 日食弹弓 / 星钢淬火）」（四套不同主题的高对比 5 档升档冲击方案，可直接从中任选一套替换）集成到我当前 T3 Code 项目的推理强度选择器中：
1. 将场景渲染逻辑整理为独立模块 `apps/web/src/components/chat/cosmicSliderScenes.ts`，使用离屏精灵贴图预烘焙减少每帧渐变创建；
2. 更新 `apps/web/src/components/chat/CosmicEffortSlider.tsx`，保持 50px 胶囊轨道与 Liquid Glass 放大镜，使用 `wrap.clientWidth` 计算宽度防止弹窗缩放闪屏，并加上静止 2 秒自动休眠（鼠标移入/点击/拖动瞬间唤醒）；
3. 保留原有的无障碍 `role="radiogroup"` 与键盘左右键切换支持，并尊重 `prefers-reduced-motion: reduce`；
4. 改完后跑 `vp lint`、`vp run typecheck` 与 `CosmicEffortSlider.browser.test.tsx` 验证通过。
```
