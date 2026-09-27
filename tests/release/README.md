# Release compatibility checks

The normal Node tests use a frozen 3.3.0 configuration fixture, so a shallow checkout does not need historical Git tags. The fixture records the original data identity and updater trust contract.

After building a signed release, run the opt-in native artifact verification from the repository root:

```powershell
$env:TOOLS4DEVS_RELEASE_DIR = (Resolve-Path Releases/3.4.0).Path
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --test update_release -- --ignored --nocapture
```

This check needs the historical tags from 2.1.0 through 3.3.0. It uses their public keys to verify the exact NSIS installer, rejects a tampered copy, checks version ordering, parses the static manifest with the Tauri updater and verifies the manifest aliases are identical. It does not execute all historical clients or replace an installation.
