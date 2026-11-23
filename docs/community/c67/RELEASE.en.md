# T3 Stardust 1.0 · C67

<!-- community-showcase -->

![T3 Stardust actual runtime, private content redacted](https://github.com/zds-xiaoxin/xiaoxin-t3code/raw/c67-stardust/assets/community/c67/overview-light.png)

[完整功能图库 / Feature gallery](https://github.com/zds-xiaoxin/xiaoxin-t3code#feature-showcase) · [中文](https://github.com/zds-xiaoxin/xiaoxin-t3code/blob/c67-stardust/README.md) · [English](https://github.com/zds-xiaoxin/xiaoxin-t3code/blob/c67-stardust/README.en.md)

Task steps and approvals in the conversation, resume cards, clearer cleanup inventory, Apple-inspired themes and Midnight Stardust branding. Approval screenshots are omitted because the acceptance snapshot contained no pending requests.

**macOS 13+ / Apple Silicon only.** Download `T3-Stardust-C67-macOS-arm64.zip`, `SHA256SUMS.txt` and `BUILD-PROVENANCE.json` from this release. Check the hashes with `shasum -a 256 -c SHA256SUMS.txt`.

Finish active tasks and quit before upgrading. Back up chats, logins and settings; keep the old application. Extract and copy the app to Applications. Schema remains 79; never restore an older database over newer chats. Ad-hoc signed, not Apple-notarized; follow macOS Privacy & Security prompts without disabling system-wide protection. Updates are manual and the upstream feed is disabled.

Local installed C67 idle renderer: median **0.0%**, P95 **7.9%**, 65 samples after 30 seconds of settling. The valid window lasted about 90.48 seconds with no screenshot/CDP/DOM polling. This historical local measurement is not a claim about every device or the rebuilt ZIP.

The web and server are rebuilt from the tagged public source. The verified C47 public Electron shell/dependencies are reused; their 1,507 non-brand/non-native archive files match the installed-C67 candidate. The native PTY comes from the C47 public package with debug-path stripping and section/export equivalence evidence. Build metadata identifies the exact code commit.

No maintainer data, credentials, private signing identity or installation helper is bundled. Screenshots use opaque privacy redaction. Cleanup staging uses `T3CODE_BUILD_STAGING_DIR` (default `~/.t3/build-staging`). Native terminal smoke uses only a fixture shell, with no model request. No new Intel/Windows/Linux binary; optional T3 Connect login and real-account provider flows were not revalidated. The prior embedded-HTML loading limitation is not claimed fixed.

Based on [T3 Code](https://github.com/pingdotgg/t3code), MIT. Embedded core `0.1.7-nightly.20261103.4119`; this is an independent community edition. Third-party notices are retained.

[Validation scope and known repository-wide failures](https://github.com/zds-xiaoxin/xiaoxin-t3code/blob/c67-stardust/docs/community/c67/VALIDATION.md): whole-repository CI is not claimed green.
