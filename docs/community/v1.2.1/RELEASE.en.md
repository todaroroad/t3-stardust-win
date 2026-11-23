# T3 Stardust v1.2.1

A small update on top of v1.2.0. The database is unchanged (still schema 105), so you can install over v1.2.0.

## New
1. **Anonymous active-user count (on by default)**: at most once a day the app sends a random install ID, the version, and the OS and CPU type; no conversations, accounts, projects or IP. The first launch shows a notice with a **Turn off** button; switch it any time under **Settings → About → "Count me as an active Stardust user"**. The website publishes only the number of devices active in the last 7 days.
2. **Update alerts show the version**: the alert title and the settings status now read like "v1.2.2" instead of an internal sort number.

## Verify and install
Download `T3-Stardust-v1.2.1-macOS-arm64.zip` and `SHA256SUMS.txt`, run `shasum -a 256 -c SHA256SUMS.txt`, unzip, and drag the app into `/Applications`. The public build is ad-hoc signed (not notarized by Apple); if macOS blocks the first launch, open **System Settings → Privacy & Security** and click "Open Anyway".
