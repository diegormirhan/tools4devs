use base64::{engine::general_purpose::STANDARD, Engine};
use minisign_verify::{PublicKey, Signature};
use std::{fs, path::PathBuf, process::Command};
use tauri_plugin_updater::RemoteRelease;

#[test]
#[ignore = "verifies the signed release named by TOOLS4DEVS_RELEASE_DIR"]
fn signed_release_is_readable_and_trusted_by_legacy_clients() {
    let directory = PathBuf::from(
        std::env::var_os("TOOLS4DEVS_RELEASE_DIR").expect("set TOOLS4DEVS_RELEASE_DIR"),
    );
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../..");
    let json = fs::read_to_string(directory.join("tools4devs.json")).unwrap();
    let legacy_json = fs::read_to_string(directory.join("latest.json")).unwrap();
    let release: RemoteRelease =
        serde_json::from_str(&json).expect("the Tauri updater must parse the static manifest");
    let filename = release
        .download_url("windows-x86_64")
        .unwrap()
        .path_segments()
        .unwrap()
        .next_back()
        .unwrap();
    let bytes = fs::read(directory.join(filename)).unwrap();
    assert!(
        bytes.starts_with(b"MZ"),
        "the updater needs a raw NSIS EXE, not a ZIP"
    );
    let signature_text = String::from_utf8(
        STANDARD
            .decode(release.signature("windows-x86_64").unwrap())
            .unwrap(),
    )
    .unwrap();
    let signature = Signature::decode(&signature_text).unwrap();
    let bridge: RemoteRelease = serde_json::from_str(&legacy_json).unwrap();
    assert_eq!(bridge.version.to_string(), "3.4.0");
    let frozen_bridge: serde_json::Value =
        serde_json::from_slice(&fs::read(root.join("scripts/release/bridge-3.4.0.json")).unwrap())
            .unwrap();
    assert_eq!(
        serde_json::from_str::<serde_json::Value>(&legacy_json).unwrap(),
        frozen_bridge
    );
    if release.version.to_string() == "3.4.0" {
        assert_eq!(json, legacy_json);
    } else {
        assert!(release.version > bridge.version);
        let bridge_directory = root.join("Releases/3.4.0");
        let bridge_filename = bridge
            .download_url("windows-x86_64")
            .unwrap()
            .path_segments()
            .unwrap()
            .next_back()
            .unwrap();
        let bridge_bytes = fs::read(bridge_directory.join(bridge_filename)).unwrap();
        let bridge_signature_text = String::from_utf8(
            STANDARD
                .decode(bridge.signature("windows-x86_64").unwrap())
                .unwrap(),
        )
        .unwrap();
        let bridge_signature = Signature::decode(&bridge_signature_text).unwrap();
        let config: serde_json::Value = serde_json::from_slice(
            &fs::read(root.join("tests/release/fixtures/bridge-3.4.0.json")).unwrap(),
        )
        .unwrap();
        assert_eq!(
            config["plugins"]["updater"]["endpoints"][0],
            "https://github.com/diegormirhan/tools4devs/releases/latest/download/tools4devs.json"
        );
        let key_text = String::from_utf8(
            STANDARD
                .decode(config["plugins"]["updater"]["pubkey"].as_str().unwrap())
                .unwrap(),
        )
        .unwrap();
        let key = PublicKey::decode(&key_text).unwrap();
        key.verify(&bridge_bytes, &bridge_signature, true)
            .expect("the pinned bridge must match the exact retained installer");
        key.verify(&bytes, &signature, true)
            .expect("the bridge must trust the current installer");
        println!(
            "Legacy channel: 3.4.0; bridge/current channel: {}; both artifacts verified",
            release.version
        );
    }
    for tag in [
        "v2.1.0", "v2.1.1", "v3.0.0", "v3.1.0", "v3.2.1", "v3.2.2", "v3.3.0",
    ] {
        let previous = Command::new("git")
            .current_dir(&root)
            .args([
                "show",
                &format!("{tag}:apps/desktop/src-tauri/tauri.conf.json"),
            ])
            .output()
            .unwrap();
        assert!(
            previous.status.success(),
            "missing historical configuration: {tag}"
        );
        let config: serde_json::Value = serde_json::from_slice(&previous.stdout).unwrap();
        let key_text = String::from_utf8(
            STANDARD
                .decode(config["plugins"]["updater"]["pubkey"].as_str().unwrap())
                .unwrap(),
        )
        .unwrap();
        let key = PublicKey::decode(&key_text).unwrap();
        key.verify(&bytes, &signature, true)
            .unwrap_or_else(|error| panic!("{tag} rejects the new installer: {error}"));
        let previous_version = tag.trim_start_matches('v').parse().unwrap();
        assert!(release.version > previous_version);
        let mut tampered = bytes.clone();
        tampered[100] ^= 1;
        assert!(
            key.verify(&tampered, &signature, true).is_err(),
            "{tag} must reject a modified installer"
        );
        println!(
            "{tag}: parses manifest, accepts newer version, trusts installer, rejects tampering"
        );
    }
}
