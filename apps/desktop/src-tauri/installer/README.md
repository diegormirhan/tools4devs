# Windows upgrade identity

The public product is tools4devs. The 3.4.0 bridge retains the `com.toolhaven.desktop` application identity, `ToolHaven` component store, `toolhaven.*` preference keys and original updater public key. It changes the updater endpoint to the tools4devs.json channel.

The NSIS template comes from Tauri CLI 2.11.4, licensed MIT OR Apache-2.0:
https://github.com/tauri-apps/tauri/blob/tauri-cli-v2.11.4/crates/tauri-bundler/src/bundle/windows/nsis/installer.nsi

Original SHA-256: `20f4ecc730defb71f1342eaeaec4021df13be3d843abba0effe88ea5835fa079`.

Local changes keep the original NSIS uninstall/install-location registry keys and recognize both product names when migrating an MSI installation. The shortcut hook updates and renames only shortcuts targeting this application's old executable. The installed and portable executable is `tools4devs.exe`. The MSI UpgradeCode is explicitly pinned to the value shipped before the rename. Compare this template against upstream before upgrading Tauri CLI.

Tauri upstream copyright: the Tauri Programme within The Commons Conservancy. Licence texts are included beside this file.

## Future removal of legacy names

Version 3.4.0 is the compatibility bridge. A later release can migrate preference keys and the component directory to tools4devs, with rollback-safe migration and tests covering existing installations. Changing the application identifier also requires migrating WebView data before opening the new profile. Renaming installer registry keys requires explicit detection and replacement of the old installation; the MSI UpgradeCode must remain stable.

Older binaries permanently embed the original GitHub updater URL. That URL and its latest.json asset must remain available while those clients are supported. From releases after 3.4.0, latest.json stays pinned to the signed 3.4.0 installer, while tools4devs.json advertises the current release. The signing key must stay the same unless a separate key-rotation bridge has been shipped first. Publish the final rebuilt 3.4.0 artifacts before publishing 4.0.0; keep the v3.4.0 assets permanently available. Never overwrite the bridge metadata with a different installer after newer releases depend on it.
