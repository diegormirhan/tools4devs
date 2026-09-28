# ADR-0006: Bridge old updater clients before migrating the Windows identity

- Status: accepted by the owner
- Date: 2026-09-27

## Decision

Clients older than 3.4.0 must stop at the signed 3.4.0 bridge even when a newer release exists. The bridge follows the new tools4devs channel, then upgrades to 4.0.0 and future releases. This policy was explicitly requested by the owner.

Publish latest.json with the frozen signed 3.4.0 metadata in every later release. Publish tools4devs.json with the current version. Keep the original updater URL functional through GitHub's repository rename redirect and retain every v3.4.0 asset. The bridge changes its endpoint without changing its signing key or legacy Windows/data identities.

Version 4.0.0 migrates the operational application identifier, publisher, installer registry keys, install directory, component store and preference keys to tools4devs. The MSI UpgradeCode remains unchanged because it identifies the upgrade family rather than the brand. Legacy names remain only for migration detection and recovery copies.

## Data preservation

Copy existing filesystem data before creating the new WebView. Commit each complete directory with an atomic rename. Never overwrite an existing new profile. The old profile remains for recovery; the old component directory may be removed by the old uninstaller after its contents reach the new store. Migrate preference keys before mounting the application; remove old keys only after all new values have persisted. A migration error must stop initialization rather than opening an empty profile.

The NSIS installer writes the replacement before running the old uninstaller in update mode. Retarget only shortcuts belonging to the previous installation and remove the previous registration after cleanup succeeds.

## Validation and release ordering

Test channel routing, signing trust, failed and repeat migrations, preservation of existing new settings, real 3.4.0-to-4.0.0 installation, profiles and components. Publish the final rebuilt 3.4.0 first, then 4.0.0. Replacing the bridge installer later invalidates the frozen signature; any replacement needs coordinated manifest regeneration and validation.
