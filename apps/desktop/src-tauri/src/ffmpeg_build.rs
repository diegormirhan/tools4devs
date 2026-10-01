//! Whether an FFmpeg found outside the app's own components can do the app's work.
//!
//! FFmpeg builds differ in which encoders they carry. The operations name their
//! encoders outright (`-c:v libopenh264` and so on), so a build without one of
//! them fails those operations. Gyan's builds, the usual one on PATH, carry
//! libx264 instead of libopenh264. Such a build counts as absent, and the app
//! offers to install its own.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};

/// Every encoder the FFmpeg operations in `lib.rs` ask for by name.
const REQUIRED_ENCODERS: [&str; 5] = ["libopenh264", "libsvtav1", "libvpx-vp9", "libopus", "libmp3lame"];

/// Asks the executable once per path and remembers the answer for the session.
pub fn can_run_the_app_operations(executable: &Path) -> bool {
    static ANSWERS: OnceLock<Mutex<HashMap<PathBuf, bool>>> = OnceLock::new();
    let answers = ANSWERS.get_or_init(Default::default);
    if let Some(&known) = answers.lock().unwrap().get(executable) {
        return known;
    }
    let mut command = std::process::Command::new(executable);
    command.args(["-hide_banner", "-encoders"]);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }
    let usable = command
        .output()
        .map(|output| lists_every_required_encoder(&String::from_utf8_lossy(&output.stdout)))
        .unwrap_or(false);
    answers.lock().unwrap().insert(executable.to_path_buf(), usable);
    usable
}

/// Reads `ffmpeg -encoders`: one encoder per line, its name in the second column.
fn lists_every_required_encoder(listing: &str) -> bool {
    let names: Vec<&str> = listing
        .lines()
        .filter_map(|line| line.split_whitespace().nth(1))
        .collect();
    REQUIRED_ENCODERS.iter().all(|required| names.contains(required))
}

#[cfg(test)]
mod tests {
    use super::lists_every_required_encoder;

    const HEADER: &str = "Encoders:\n V..... = Video\n A..... = Audio\n ------\n";

    fn listing(encoders: &[&str]) -> String {
        let lines: String = encoders.iter().map(|name| format!(" V....D {name:<20} Some encoder\n")).collect();
        format!("{HEADER}{lines}")
    }

    #[test]
    fn accepts_a_build_with_every_encoder_the_operations_name() {
        assert!(lists_every_required_encoder(&listing(&[
            "libmp3lame", "libopenh264", "libopus", "libsvtav1", "libvpx", "libvpx-vp9",
        ])));
    }

    #[test]
    fn refuses_a_build_that_has_libx264_instead_of_libopenh264() {
        assert!(!lists_every_required_encoder(&listing(&[
            "libmp3lame", "libx264", "libopus", "libsvtav1", "libvpx-vp9",
        ])));
    }

    #[test]
    fn does_not_take_a_description_or_a_longer_name_for_the_encoder() {
        assert!(!lists_every_required_encoder(&format!(
            "{HEADER} V....D libx264    H.264 libopenh264 compatible\n V....D libopenh264x Other\n"
        )));
    }

    #[test]
    fn refuses_empty_output_from_a_build_that_would_not_start() {
        assert!(!lists_every_required_encoder(""));
    }
}
