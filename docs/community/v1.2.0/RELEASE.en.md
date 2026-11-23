# T3 Stardust v1.2.0

Built on upstream T3 Code as of 2026-11-21 (`0.1.11`, commit `f9b19a7f85`) for macOS Apple Silicon.

## Before you upgrade
The first launch of v1.2.0 migrates the local database from schema 95 to 105. After that, older Stardust builds (v1.0.x) and older official T3 Code builds can no longer read it. Back up `~/.t3/userdata` before upgrading.

## Stardust additions
1. **V18 "Starship Launch Stack" effort slider**: continuous 5-stage flight with 180ms upshift feedback; a pre-baked offscreen sprite atlas (per-frame gradient objects cut from ~120–180 to 6 or fewer); the canvas stops redrawing after 2 seconds idle.
2. **Smoother popovers**: removed the `filter: blur` transitions on the Session Stats popovers and lowered the backdrop blur to `12px`.
3. **Compact model picker**: provider tabs across the top, a fixed-height scrolling list with effort levels and remaining quota per model, and a color-coded Auto / Needs approval permission chip.
4. **Leaner settings**: removed the Clawd workbench and "Focus on chat"; Sidebar categories moved into the Sessions page; the update mode defaults to "Standard · confirm updates manually".
5. **App name**: ships as `T3 Stardust.app`.
6. **Stardust Kit (phase 1)**: `stardust-kit/` with the V16 / V17 / V18 / V19 slider engines, each with a `demo.html`, standalone source and an AI integration prompt.
7. **Update alerts fixed**: the version baseline is v1.2.0, so v1.2.0 users are not told to update again. Updates stay notify + manual download; the app never replaces or restarts itself.

## Merged from upstream
1,073 upstream commits, including fewer git processes when listing branches, pushing and checking status; usage-limit rows that show your pace and link to the usage page; native Mac dictation with Apple Speech; copying chat tables as HTML; a copy button on file previews; and thread cards on hovering a thread chip.

## Verify and install
Download `T3-Stardust-v1.2.0-macOS-arm64.zip` and `SHA256SUMS.txt`, run `shasum -a 256 -c SHA256SUMS.txt`, unzip, and drag the app into `/Applications`. The public build is ad-hoc signed (not notarized by Apple); if macOS blocks the first launch, open **System Settings → Privacy & Security** and click "Open Anyway".
