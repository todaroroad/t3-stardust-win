# 将「V19-A 16-Bit 街机高精像素星舰」装进你的 T3 Code 工作台

直接把下面这段提示词发给 Claude Code / Codex / T3 Code 即可自动完成集成：

```text
请参考仓库目录 `stardust-kit/v19-pixel-starship/` 中的完整源码与交互预览（`demo.html`），将「V19-A 16-Bit 街机高精像素星舰」（复古街机像素火箭、圆润火焰烟球与 5 档轨道演进）集成到我当前 T3 Code 项目的推理强度选择器中：
1. 将场景渲染逻辑整理为独立模块 `apps/web/src/components/chat/cosmicSliderScenes.ts`，使用离屏精灵贴图预烘焙减少每帧渐变创建；
2. 更新 `apps/web/src/components/chat/CosmicEffortSlider.tsx`，保持 50px 胶囊轨道与 Liquid Glass 放大镜，使用 `wrap.clientWidth` 计算宽度防止弹窗缩放闪屏，并加上静止 2 秒自动休眠（鼠标移入/点击/拖动瞬间唤醒）；
3. 保留原有的无障碍 `role="radiogroup"` 与键盘左右键切换支持，并尊重 `prefers-reduced-motion: reduce`；
4. 改完后跑 `vp lint`、`vp run typecheck` 与 `CosmicEffortSlider.browser.test.tsx` 验证通过。
```
