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
    let json = fs::read_to_string(directory.join("latest.json")).unwrap();
    assert_eq!(json, fs::read_to_string(directory.join("tools4devs.json")).unwrap());
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
