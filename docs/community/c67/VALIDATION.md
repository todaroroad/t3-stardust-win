# Validation scope

The C67 installed version and this rebuilt public package have separate evidence. See `BUILD-PROVENANCE.json` in the release for archive, signature and PTY results.

The initial required `check:changed` completed but was not fully green: the reused local build environment lacks infra/task-cache and relay dependencies; knip reports unused exports/dependencies; the MCP tool JSON budget records 51,799 bytes while the current measured list is 52,322; the compiler coverage gate reports unsupported try/finally and throw-in-try syntax in TaskBoardPanel, TaskInbox and WorkbenchModeSettings. These components still compile for the runtime bundle, but their affected functions are not React-Compiler optimized. No budget or compiler assertions were weakened.

Release-only fixes normalize the cleanup staging directory, rename a misleading hook-like callback, document the stylesheet synchronization effect for lint, and format changed files. Generated Cursor SDK and resource-monitor build binaries are excluded from source publishing; the verified public desktop shell retains the required runtime modules.

Targeted web/server types, build, lint, feature regressions, package integrity and privacy scans are the release checks. Whole-repository CI is not asserted green. No real model call was made.

Final targeted checks: web/server types and builds passed; format and lint passed; 11 feature test files / 35 tests passed, covering task steps, approvals, resume, theme switching and cleanup safety. The initial broad run passed 594 of 595 tests; its sole test failure was the unchanged MCP budget record.
