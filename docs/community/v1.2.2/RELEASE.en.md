# T3 Stardust v1.2.2

An update on top of v1.2.1. The database is unchanged (still schema 105), so you can install over v1.2.1.

## Fixes
1. **ChatGPT sign-in follows the system proxy**: with a "system proxy" such as Clash, the app's backend used to ignore the proxy, so sign-in failed with "Could not reach ChatGPT sign-in" where `auth.openai.com` is not directly reachable. The app now reads the macOS system proxy at startup and hands it to the backend; an `HTTPS_PROXY` you set yourself still wins. HTTP/HTTPS proxies only; a SOCKS-only proxy is not used.
2. **The Welcome page no longer covers the window buttons**: the quota button on the first-run Welcome page no longer overlaps the red/yellow/green buttons.
3. **No empty quota button before sign-in**: until some account reports a quota, the top-left "Remaining quota" button stays hidden; it appears once a quota is read.

## New
1. **One-click macOS updates**: **Settings → About** and the new-version alert offer "Update and restart": download, verify SHA-256 and the signature, replace the app and relaunch, rolling back on any failure; the previous version is kept in the cache's `update-backup`. A switch "Download updates automatically and install on next launch" is off by default. **This works from v1.2.2 on**; v1.2.1 and earlier still need a manual download this time.
2. **Settings → Storage & cleanup**: a fixed-rule scan (not AI) sorts removable items into "safe to clean", "take a look" and "remind only". "Take a look" items go to the Trash first and can be undone for 7 days; folders with uncommitted git changes never land in "safe to clean"; a rescue copy to `~/Documents/T3 Stardust 抢救/` can run before deleting. If [Mole](https://github.com/tw93/Mole) is installed, only `mo clean --dry-run` is run to read its list. The usage page keeps a single "disk free" entry.
3. **Quota bar**: the current thread's account comes first, the rest by remaining quota; no more "Readings expired" text; refreshes every 10 minutes while the window is visible.

## Upstream
Merges 32 official T3 Code commits up to `356dff3352` (socket resend, handoff restore and other fixes).

## Verify and install
Download `T3-Stardust-v1.2.2-macOS-arm64.zip` and `SHA256SUMS.txt`, run `shasum -a 256 -c SHA256SUMS.txt`, unzip, and drag the app into `/Applications`. The public build is ad-hoc signed (not notarized by Apple); if macOS blocks the first launch, open **System Settings → Privacy & Security** and click "Open Anyway".
