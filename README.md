# T3星辰版 (Windows x64)

基于官方 [pingdotgg/t3code](https://github.com/pingdotgg/t3code) 正式版持续三方合并维护的个人定制 Windows 桌面客户端。

## 核心特性

- **直连官方正式版内核**：保留星辰版全套工作台 UI 修改，直接合并跟进 `pingdotgg/t3code` 官方稳定版 Release（消除数据库迁移与新模型支持代差）。
- **侧边栏双模式与全分区折叠**：
  - 原生侧边栏新增 **「已置顶（Pinned）」与「活跃（Active）」** 可折叠抽屉（与底部 `Working / Snoozed / Settled` 交互一致）；
  - 同时保留星辰分类侧边栏（运行中 + 待处理 + 二级虚拟分类）、V18 推理滑块、输入框 V9 与 4 标签页多账号用量看板。
- **思考过程增强**：内置三芒星渐变思考图标（`StardustThoughtIcon`）与每段思考耗时 / Token 徽章（`ThoughtUsageBadge`）。
- **Windows 并排共存与原生热更新**：
  - 独立 `appId`（`com.todaroroad.t3stardust`）与独立安装目录（`%LOCALAPPDATA%\Programs\t3-stardust`），与官方 `T3 Code (Beta)` 互不覆盖，无缝共享 `~/.t3/userdata` 会话数据与登录态；
  - 内置 `electron-updater`（`latest.yml` + `.blockmap` 差分升级），支持在「设置 → 关于」中一键检查并重启升级。
- **隐私净空**：已彻底移除全部第三方统计上报与社区轮询请求，并在每次构建产物中自动校验。
