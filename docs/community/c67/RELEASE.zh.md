# T3 星尘版 1.0 · C67

<!-- community-showcase -->

![T3 Stardust actual runtime, private content redacted](https://github.com/zds-xiaoxin/xiaoxin-t3code/raw/c67-stardust/assets/community/c67/overview-light.png)

[完整功能图库 / Feature gallery](https://github.com/zds-xiaoxin/xiaoxin-t3code#feature-showcase) · [中文](https://github.com/zds-xiaoxin/xiaoxin-t3code/blob/c67-stardust/README.md) · [English](https://github.com/zds-xiaoxin/xiaoxin-t3code/blob/c67-stardust/README.en.md)

本次更新：任务步骤与审批进卡、接续卡、清理与整理、苹果主题，以及午夜星尘品牌。验收快照没有待审批实例，因此没有展示或伪造审批截图。

**仅 macOS 13+ / Apple Silicon。** 下载本发行页的 `T3-Stardust-C67-macOS-arm64.zip`、`SHA256SUMS.txt` 与 `BUILD-PROVENANCE.json`，在同一目录执行 `shasum -a 256 -c SHA256SUMS.txt`。

升级前结束任务并完全退出，冷备聊天、登录和设置，保留旧应用；解压后将应用复制到 Applications。schema 仍为 79，不用旧数据库覆盖新聊天。ad-hoc 签名、未经过 Apple 公证；按系统「隐私与安全性」提示处理，不关闭系统整体保护。仅手动更新，上游自动更新源已禁用。

本机已安装 C67 的渲染进程空闲实测：中位数 **0.0%**、P95 **7.9%**，静置 30 秒后取得 65 个样本；有效窗口约 90.48 秒，期间无截图、CDP 或 DOM 轮询。这是历史本机测量，不承诺重建 ZIP 在所有设备上的相同表现。

web 与 server 从标记的公开源码重建；复用经验证的 C47 公开 Electron 外壳与依赖，其 1,507 个非品牌、非原生归档文件与已安装 C67 候选一致。PTY 复用 C47 已去调试路径且验证运行段与导出一致的公开模块；构建记录给出精确源码提交。

包内无维护者数据、凭据、私有签名身份或安装器；截图采用实色脱敏。清理暂存目录使用 `T3CODE_BUILD_STAGING_DIR`，默认 `~/.t3/build-staging`。原生终端冒烟仅运行示例 shell，不调用模型。本轮没有新的 Intel/Windows/Linux 二进制；可选 T3 Connect 登录、真实账号提供方流程未重新验收，既有嵌入 HTML 加载缺口未宣称修复。

基于 [T3 Code](https://github.com/pingdotgg/t3code)，保留 MIT 与第三方许可；内嵌内核 `0.1.7-nightly.20261103.4119`，属于独立社区版。

[检查范围与已知仓库级失败](https://github.com/zds-xiaoxin/xiaoxin-t3code/blob/c67-stardust/docs/community/c67/VALIDATION.md)：不宣称全仓 CI 通过。
