# Windows upgrade identity

The public product is tools4devs. The 3.4.0 bridge retains the `com.toolhaven.desktop` application identity, `ToolHaven` component store, `toolhaven.*` preference keys and original updater public key. It changes the updater endpoint to the tools4devs.json channel.

The NSIS template comes from Tauri CLI 2.11.4, licensed MIT OR Apache-2.0:
https://github.com/tauri-apps/tauri/blob/tauri-cli-v2.11.4/crates/tauri-bundler/src/bundle/windows/nsis/installer.nsi

Original SHA-256: `20f4ecc730defb71f1342eaeaec4021df13be3d843abba0effe88ea5835fa079`.

Version 4.0.0 writes the tools4devs NSIS registry keys and publisher. It recognizes the previous NSIS keys and both legacy MSI product/publisher pairs. When the updater passes the old install directory, the installer selects the new tools4devs directory, writes the replacement first, then runs the previous uninstaller in update mode so it preserves user data. The hook retargets only shortcuts owned by the previous installation, updates their AppUserModelID and removes the old registration after successful cleanup. The MSI UpgradeCode remains pinned to the value shipped before the rename. Compare this template against upstream before upgrading Tauri CLI.

Tauri upstream copyright: the Tauri Programme within The Commons Conservancy. Licence texts are included beside this file.

## Migrated identity

Version 3.4.0 is the compatibility bridge. Version 4.0.0 uses com.tools4devs.desktop, tools4devs.* preference keys and the tools4devs component store. Before creating a WebView, Rust copies the old profile and components into temporary sibling directories, then renames each completed copy into place. An existing destination is authoritative and is never overwritten. Failed copies never replace the original data. The previous profile remains for recovery; the previous component directory may be removed by the old uninstaller after a complete copy reaches the new store. The frontend persists all migrated values before removing old preference keys from the new profile. Remaining legacy names are detection inputs and historical fixtures, not active storage identities.

Older binaries permanently embed the original GitHub updater URL. That URL and its latest.json asset must remain available while those clients are supported. From releases after 3.4.0, latest.json stays pinned to the signed 3.4.0 installer, while tools4devs.json advertises the current release. The signing key must stay the same unless a separate key-rotation bridge has been shipped first. Publish the final rebuilt 3.4.0 artifacts before publishing 4.0.0; keep the v3.4.0 assets permanently available. Never overwrite the bridge metadata with a different installer after newer releases depend on it.
