# Release compatibility checks

The normal Node tests use frozen 3.3.0 and bridge 3.4.0 configuration fixtures, so a shallow checkout does not need historical Git tags. The fixtures record the original data identity, signing trust and the bridge's new channel. Channel tests keep latest.json pinned to 3.4.0 while tools4devs.json advertises the current release.

After building a signed release, run the opt-in native artifact verification from the repository root:

```powershell
$env:TOOLS4DEVS_RELEASE_DIR = (Resolve-Path Releases/4.0.0).Path
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --test update_release -- --ignored --nocapture
```

This check needs the historical tags from 2.1.0 through 3.3.0 and the retained Releases/3.4.0 installer. It verifies the exact signed artifacts and frozen bridge metadata, rejects a tampered current installer, checks version ordering and parses both channels with the Tauri updater. It does not execute all historical clients or replace an installation.
