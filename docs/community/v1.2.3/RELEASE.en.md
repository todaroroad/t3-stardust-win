# T3 Stardust v1.2.3

A performance and declutter update. The database is unchanged (still schema 105), so you can install over v1.2.2; v1.2.2 users can use "Update and restart" in **Settings → About**.

## Performance
- **No more constant repaint at idle**: the animated colourful wordmark at the top of the sidebar repainted every frame and measured about 30% CPU (renderer + GPU combined, 100% = one core), enough to warm the machine. It is static now.
- **Lighter while a thread runs**: the running status dot no longer pulses and the active tool label no longer shimmers (about 13% CPU together).
- Measured on the same Mac with a thread running: renderer + GPU went from about 52–56% to about 4%.

## Interface
- **A quieter top-left corner**: the colourful "T3 Stardust" wordmark is now a grey "T3" with the small violet sparkle from the app icon, so the composer and conversation keep your attention.
- **Back / forward arrows** appear only while the pointer is in the sidebar (or when focused with the keyboard); otherwise the row holds just the window buttons, the sidebar toggle and the mark.

## Verify and install
Download `T3-Stardust-v1.2.3-macOS-arm64.zip` and `SHA256SUMS.txt`, run `shasum -a 256 -c SHA256SUMS.txt`, unzip, and drag the app into `/Applications`. The public build is ad-hoc signed (not notarized by Apple); if macOS blocks the first launch, open **System Settings → Privacy & Security** and click "Open Anyway".
