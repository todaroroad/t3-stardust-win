# T3 Stardust 1.0.7: how this release was checked

The README and the release notes stay short on purpose. The details are here for anyone who wants to check our work.

## Build identity

| Item | Value |
| --- | --- |
| Build | C96, the 1.0.7 build. It contains everything since 1.0.2 (internal builds C91 to C95: quota cards four to a row with provider grouping and drag to reorder, sidebar task actions and status menu, "Done today", live Claude quota from response headers, separate Cost and Tokens pages, composer effort slider and context ring, the T3 Stardust name). C96 only restores the stable release flag that C94 and C95 lost (they showed a "Nightly" badge). |
| Web bundle `index.html` SHA-256 | `3ce507575f14d056de81dbbb2c04625a40964591bc24dbbb068d64c0f969d441` |
| Release-candidate app archive (ASAR) SHA-256 | `bb2f076be0ebbd08c6a772d1e60ebf8800bd64cbf765767081e94672d5d81273` |
| App archive (ASAR) in the download package | `30caca00e617fd5c5379241256cd106e344bd180224176ca2133c04c9b3a383a`. It differs from the candidate in exactly one entry: the bundled copy of the resource monitor, whose build-machine file paths were overwritten with neutral bytes of the same length. Every other entry is byte-identical |
| Signature of the download package | ad-hoc (`codesign -dv` shows `Signature=adhoc`, no Team ID); not signed with an Apple Developer ID; not notarized. `codesign --verify --deep --strict` passes on the unpacked ZIP |
| Package for download | `T3-Stardust-1.0.7-macOS-arm64.zip`, SHA-256 `8fb1509319093698fb20c2b65f3814739c92f966236238eba2e16ec906482184` |

Every product screenshot in this repository was rendered from the Stardust web bundle (the banners and social preview add brand art and HTML text around a real render).

## Automated checks (C96 / v1.0.7)

| Check | Result |
| --- | --- |
| Type check, `web` package | 0 errors |
| Lint (`vp lint`) on the changed files | 0 errors |
| Unit & Chromium browser tests for quota, sidebar, inbox and composer (changed areas) | all passed |
| Full web test suite | no new failures; the only failures are known ones that existed before this release (2 tests, plus 17 render scenarios that need a report directory to run) |
| Privacy scan on unpacked ZIP | 2,962 members scanned, 0 maintainer hits |
| Isolated smoke & PTY check | Welcome page rendered, 0 console/runtime errors, resource monitor healthy, no "Nightly" badge, `node-pty` exit 0, 0 leftover processes |

## Data migration: schema 79 → 95

- C67 and earlier use database schema **79**. This release uses schema **95**.
- The release contains 95 migration files, numbered 001 to 095; the last is `095_TurnItemInlineWorkOutput`. The count and the last name were read from the source tree while preparing this page.
- Rehearsal on a read-only copy of a real database (C72): 43 original tables, 1,493,712 rows, column digests equal before and after; migrations 085 and 095, foreign keys and integrity check passed. The original database was not migrated in the rehearsal.
- C82 to C96 changed no migration file; every build since then lists the same 95 migrations.
- The migration goes one way. The old app cannot read schema 95 safely. That is why the README asks for a cold backup of `~/.t3` first.

## Privacy

- Package and source are scanned for personal paths, user names, account names, e-mail addresses and keys before they ship. The C85 scan found 0 hits for hard-coded local paths in the source and in the production build. The final scan of the unpacked download package (2,962 files) found 0 maintainer names, accounts, build-machine paths or local signing identities; the remaining matches are third-party package authors, example addresses and upstream vendor build paths (details in `privacy-scan.json`, attached to the release). Before that scan, build-machine paths inside four native helper files and a build cache directory were removed from the package.
- Analytics are off by default (`telemetryEnabled` is false; old settings files read as off). With a clean home folder, 45 seconds after first start, a local listener received 0 analytics requests; the control run with analytics switched on received 1.
- This edition turns off auto-update when the update feed points at upstream T3 Code, and refuses npm release lookups unless `T3CODE_ALLOW_UPSTREAM_NPM_LOOKUP=1` is set.

## How the images were made

- A real T3 Stardust server serving the C96 web bundle and a headless Chrome, both on a throwaway home folder, with outbound network blocked and the maintainer's real data folder unreadable. No real model was called.
- A small local script plays the part of the agent (a fixed six-step plan with plain tool calls), so the step capsule, the stats bar and the sidebar are the real components.
- Invented demo data: project and chat names, the account names (Claude Studio, Claude Work, Claude Home, Codex), every quota number, reset time, disk size and cleanup item. The quota, storage and category-suggestion answers are injected between the page and the server so the real components render them. The "Resets this week" timeline is the real component fed with those numbers.
- The small Stardust compass card on the Limits page is hidden in these images (it can cut off its labels in the four-column layout; see Known issues in the release notes).
- Window frame, shadow, crop and scale are added afterward. No pixel is drawn by hand. The banner and social preview use separately generated background art that contains no interface; the text on them is HTML text.
- Animations are cuts of real screen recordings of the same demo run, 6 to 9 seconds each.

### Image check

277 images and sampled animation frames read with macOS Vision text recognition (5,704 text lines, 0 read errors): 0 private matches. 4 public documents searched for personal paths, user and account names, e-mail addresses and keys: 0 matches.

### Media inventory

| File | Type | Size | SHA-256 (first 16) | What it shows |
| --- | --- | --- | --- | --- |
| banner-en-dark.webp | webp | 52 KB | f75c9cb1bf20eade | README banner: brand background art + HTML text (no UI) |
| banner-en-light.webp | webp | 47 KB | 83230a9978a76921 | README banner: brand background art + HTML text (no UI) |
| banner-zh-dark.webp | webp | 43 KB | fd527662844bf2c4 | README banner: brand background art + HTML text (no UI) |
| banner-zh-light.webp | webp | 40 KB | ad608410be3089ab | README banner: brand background art + HTML text (no UI) |
| categories-en-dark.webp | webp | 105 KB | 399155a94f89406e | Suggested categories dialog before anything moves |
| categories-en-light.webp | webp | 105 KB | f256532a0d17ded7 | Suggested categories dialog before anything moves |
| categories-zh-dark.webp | webp | 88 KB | 617cd246e676797e | Suggested categories dialog before anything moves |
| categories-zh-light.webp | webp | 89 KB | 31fcd785807cba15 | Suggested categories dialog before anything moves |
| cleanup-en-dark.webp | webp | 84 KB | 493553dc6d526969 | Usage → Cleanup & organization, suggestions before any removal |
| cleanup-en-light.webp | webp | 86 KB | ca6ebfc4cf8e6c7f | Usage → Cleanup & organization, suggestions before any removal |
| cleanup-zh-dark.webp | webp | 76 KB | 30aa6e51d5852746 | Usage → Cleanup & organization, suggestions before any removal |
| cleanup-zh-light.webp | webp | 78 KB | af02054a99ea0b6f | Usage → Cleanup & organization, suggestions before any removal |
| hero-en-dark.webp | webp | 90 KB | 22135553ded4caa4 | Whole workbench, a run in progress at 4 of 6 milestones, sidebar sorted into categories |
| hero-en-light.webp | webp | 90 KB | b5dbefee6c752766 | Whole workbench, a run in progress at 4 of 6 milestones, sidebar sorted into categories |
| hero-zh-dark.webp | webp | 87 KB | cf43a3956fa378e7 | Whole workbench, a run in progress at 4 of 6 milestones, sidebar sorted into categories |
| hero-zh-light.webp | webp | 88 KB | 2a92b375797ab354 | Whole workbench, a run in progress at 4 of 6 milestones, sidebar sorted into categories |
| inbox-en-dark.webp | webp | 39 KB | d3c18f248db798bf | Sidebar task with its hover actions and the status menu |
| inbox-en-light.webp | webp | 39 KB | 062cae09e7855700 | Sidebar task with its hover actions and the status menu |
| inbox-zh-dark.webp | webp | 37 KB | 47035a7036f7e398 | Sidebar task with its hover actions and the status menu |
| inbox-zh-light.webp | webp | 37 KB | 8f736d0d66b99770 | Sidebar task with its hover actions and the status menu |
| quota-en-dark.gif | gif | 175 KB | 43150064261b71a8 | Quota cards and Resets this week, lanes hovered one by one |
| quota-en-dark.webp | webp | 88 KB | 8621d1fcdda47d5a | Usage → Limits: four account cards in a row and "Resets this week" |
| quota-en-light.gif | gif | 152 KB | b80d384d4dac429b | Quota cards and Resets this week, lanes hovered one by one |
| quota-en-light.webp | webp | 95 KB | 91233b60e175be5e | Usage → Limits: four account cards in a row and "Resets this week" |
| quota-zh-dark.gif | gif | 189 KB | a402c3ff2bc993e1 | Quota cards and Resets this week, lanes hovered one by one |
| quota-zh-dark.webp | webp | 78 KB | a7610e3c1bb2ce97 | Usage → Limits: four account cards in a row and "Resets this week" |
| quota-zh-light.gif | gif | 163 KB | 19738390381a4371 | Quota cards and Resets this week, lanes hovered one by one |
| quota-zh-light.webp | webp | 87 KB | f90b554b0be70479 | Usage → Limits: four account cards in a row and "Resets this week" |
| social-preview.png | png | 539 KB | d3acede9688a3366 | Social preview: brand background + HTML text + real hero render |
| stats-en-dark.webp | webp | 36 KB | db580bb79c0ef892 | Session statistics popover after the first turn |
| stats-en-light.webp | webp | 37 KB | a455bbdc024c6caf | Session statistics popover after the first turn |
| stats-zh-dark.webp | webp | 32 KB | 659636ca0f1914f5 | Session statistics popover after the first turn |
| stats-zh-light.webp | webp | 34 KB | 37d6bfc9624af33a | Session statistics popover after the first turn |
| steps-en-dark.gif | gif | 1.84 MB | 86035ca191d624b5 | Step capsule: expand, open a stage, finish |
| steps-en-dark.webp | webp | 98 KB | e0fd65ffa649c7ed | Step capsule expanded, one stage open to show its operations |
| steps-en-light.gif | gif | 1.93 MB | 7cd6dcf6f06ca16f | Step capsule: expand, open a stage, finish |
| steps-en-light.webp | webp | 101 KB | 554a575f86d467a6 | Step capsule expanded, one stage open to show its operations |
| steps-zh-dark.gif | gif | 1.57 MB | 3cf2f63f017ea701 | Step capsule: expand, open a stage, finish |
| steps-zh-dark.webp | webp | 93 KB | bc324599dbf4fb13 | Step capsule expanded, one stage open to show its operations |
| steps-zh-light.gif | gif | 1.55 MB | 1e4c229398f51541 | Step capsule: expand, open a stage, finish |
| steps-zh-light.webp | webp | 95 KB | a7ef8c79c3a315d1 | Step capsule expanded, one stage open to show its operations |
| welcome-en-dark.webp | webp | 80 KB | ea754962b69545eb | First-run welcome page, detected agents |
| welcome-en-light.webp | webp | 79 KB | 4dfe0030ee4a1bf8 | First-run welcome page, detected agents |
| welcome-zh-dark.webp | webp | 75 KB | b744ea9254a77466 | First-run welcome page, detected agents |
| welcome-zh-light.webp | webp | 74 KB | 7ac0e9b56ad6dafe | First-run welcome page, detected agents |

## Not covered

- The images come from the web bundle in headless Chrome, not from a screenshot of the packaged Electron window. `backdrop-filter` in the real window was not checked.
- Real Claude and Codex end-to-end runs were not done for this release (no real model requests). Plan sources were checked with adapter tests and a recorded Codex replay.
- The download package is ad-hoc signed and not notarized, so Gatekeeper blocks the first launch (Open Anyway). Four third-party binaries of the bundled Cursor SDK keep their vendors' original signatures.

## Verify your download

```sh
shasum -a 256 T3-Stardust-1.0.7-macOS-arm64.zip
```

Compare the result with the checksum in the [release notes](https://github.com/zds-xiaoxin/xiaoxin-t3code/releases/tag/v1.0.7).
