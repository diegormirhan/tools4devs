//! Component store: downloads, verifies, extracts and activates the tools that do not
//! ship inside the installer. The user never leaves tools4devs to install anything.
//!
//! Everything here is keyed by the artifact's SHA-256, so two tools that share an
//! archive — ffmpeg and ffprobe come from the same build — are installed once.

use std::io::Read;
use std::path::{Path, PathBuf};

/// The manifest is the single source of truth for what we distribute, so the host reads
/// the same file the build and the catalog read, compiled in.
const MANIFEST: &str = include_str!("../../../../tooling/tools.json");

#[derive(Debug, serde::Deserialize)]
struct Manifest {
    tools: Vec<ManifestTool>,
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManifestTool {
    pub id: String,
    pub display_name: String,
    pub status: String,
    #[serde(default)]
    pub version: Option<String>,
    #[serde(default)]
    pub dependencies: Vec<String>,
    #[serde(default)]
    pub artifacts: Vec<Artifact>,
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Artifact {
    pub url: String,
    pub sha256: String,
    #[serde(default)]
    pub binary_directory: String,
    /// Arguments that make this artifact install itself without a window.
    ///
    /// Some projects publish only an NSIS installer — Tesseract, 7-Zip and
    /// MKVToolNix among them — which is why those tools sat in the manual
    /// list for so long. The flags are declared per artifact rather than
    /// guessed, because a wrong guess would run an interactive installer
    /// with no window to answer.
    #[serde(default)]
    pub silent_install: Vec<String>,
    /// How the payload is packed, when the URL does not end in `.zip`.
    ///
    /// `zip` is for a zip served from an address without that extension —
    /// SourceForge's `…/file.zip/download`, which ExifTool uses.
    ///
    /// `7z` covers both a bare `.7z` and a self-extracting `.exe` with a `.7z`
    /// appended to it — SongRec ships the latter, and its extractor offers no
    /// silent flag, so the archive is unpacked here rather than by running it.
    /// Declared rather than sniffed: guessing from a byte signature would mean
    /// an ordinary executable that happens to contain those six bytes gets
    /// unpacked instead of installed.
    #[serde(default)]
    pub archive: String,
    /// Files to rename once the payload is in place, `from` to `to`.
    ///
    /// Two unrelated problems, one mechanism. A project that publishes a bare
    /// `.exe` puts the version in its file name, and the host would otherwise
    /// have to know the version to find the binary. ExifTool ships its program
    /// as `exiftool(-k).exe`, where the suffix makes it wait for a keypress —
    /// upstream's own install instructions are to rename it.
    ///
    /// Both are facts about one artifact, so they live in the manifest beside
    /// everything else about it rather than in the host.
    #[serde(default)]
    pub rename: std::collections::BTreeMap<String, String>,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ComponentProgress {
    pub tool_id: String,
    pub phase: String,
    pub progress: Option<f64>,
    pub message: String,
}

fn manifest() -> &'static Manifest {
    static PARSED: std::sync::OnceLock<Manifest> = std::sync::OnceLock::new();
    PARSED.get_or_init(|| serde_json::from_str(MANIFEST).expect("tools.json ships with the binary"))
}

pub fn tool(tool_id: &str) -> Option<&'static ManifestTool> {
    manifest().tools.iter().find(|tool| tool.id == tool_id)
}

/// Where installed components live. Under the user's local app data, never in Program
/// Files, so installing a component never needs elevation.
// Keep the legacy directory so upgrades reuse verified, already installed tools.
fn store_root() -> Result<PathBuf, String> {
    let base =
        std::env::var_os("LOCALAPPDATA").ok_or("Could not locate the application data folder.")?;
    Ok(PathBuf::from(base).join("ToolHaven").join("components"))
}

/// One directory per artifact digest: re-installing the same version is idempotent and
/// a different version never overwrites a working one.
fn artifact_directory(artifact: &Artifact) -> Result<PathBuf, String> {
    Ok(store_root()?.join(&artifact.sha256[..16]))
}

/// The directory holding a tool's executables once it is installed, if it is installed.
pub fn installed_binary_directory(tool_id: &str) -> Option<PathBuf> {
    let artifact = tool(tool_id)?.artifacts.first()?;
    let mut directory = artifact_directory(artifact).ok()?;
    if !artifact.binary_directory.is_empty() {
        for segment in artifact.binary_directory.split(['/', '\\']) {
            directory = directory.join(segment);
        }
    }
    directory.is_dir().then_some(directory)
}

/// Tools that must be installed before this one, the requested tool last, skipping
/// whatever is already present.
pub fn installation_plan(tool_id: &str) -> Result<Vec<&'static ManifestTool>, String> {
    let mut ordered = Vec::new();
    let mut visiting = Vec::new();
    resolve_plan(tool_id, &mut ordered, &mut visiting)?;
    Ok(ordered)
}

fn resolve_plan(
    tool_id: &str,
    ordered: &mut Vec<&'static ManifestTool>,
    visiting: &mut Vec<String>,
) -> Result<(), String> {
    if ordered.iter().any(|tool| tool.id == tool_id) {
        return Ok(());
    }
    if visiting.iter().any(|id| id == tool_id) {
        visiting.push(tool_id.to_string());
        return Err(format!("Circular dependency: {}", visiting.join(" -> ")));
    }
    let entry = tool(tool_id).ok_or_else(|| format!("Tool outside the catalog: {tool_id}"))?;

    visiting.push(tool_id.to_string());
    for dependency in &entry.dependencies {
        resolve_plan(dependency, ordered, visiting)?;
    }
    visiting.pop();

    // Tools inside the installer are already there; nothing to download for them.
    if entry.status != "bundled" {
        ordered.push(entry);
    }
    Ok(())
}

pub fn is_installed(tool_id: &str) -> bool {
    match tool(tool_id) {
        Some(entry) if entry.status == "bundled" => true,
        Some(_) => installed_binary_directory(tool_id).is_some(),
        None => false,
    }
}

/// Downloads, verifies and activates one component. Existing installations are left
/// untouched until the new one is complete and verified.
pub fn install(
    tool_id: &str,
    report: &(dyn Fn(ComponentProgress) + Send + Sync),
) -> Result<(), String> {
    let entry = tool(tool_id).ok_or_else(|| format!("Tool outside the catalog: {tool_id}"))?;
    if entry.status == "bundled" {
        return Ok(());
    }
    if entry.status != "downloadable" {
        return Err(format!(
            "{} has no pinned artifact yet, so the app cannot install it.",
            entry.display_name
        ));
    }
    let first = entry
        .artifacts
        .first()
        .ok_or("The tool declares no artifact.")?;

    let target = artifact_directory(first)?;
    if target.is_dir() {
        return Ok(());
    }

    // Staging beside the final directory keeps activation on the same volume, so the
    // rename is atomic and a failure never leaves a half-installed component active.
    let staging = target.with_extension("staging");
    let _ = std::fs::remove_dir_all(&staging);
    std::fs::create_dir_all(&staging)
        .map_err(|error| format!("Could not prepare the installation: {error}"))?;

    // Every artifact lands in the same directory, in order. A tool is not always
    // one download: the model upscaler is a runtime from one project and a set of
    // weights from another, each with its own licence and its own digest, and the
    // pair is only useful together.
    let result = (|| -> Result<(), String> {
        for (index, artifact) in entry.artifacts.iter().enumerate() {
            let counted = if entry.artifacts.len() > 1 {
                format!(" ({} of {})", index + 1, entry.artifacts.len())
            } else {
                String::new()
            };
            report(ComponentProgress {
                tool_id: tool_id.into(),
                phase: "downloading".into(),
                progress: Some(0.0),
                message: format!(
                    "Downloading {} {}{counted}…",
                    entry.display_name,
                    entry.version.as_deref().unwrap_or("")
                ),
            });
            let bytes = download(&artifact.url, tool_id, report)?;

            report(ComponentProgress {
                tool_id: tool_id.into(),
                phase: "verifying".into(),
                progress: None,
                message: "Verifying the download…".into(),
            });
            let digest = sha256(&bytes);
            if digest != artifact.sha256.to_ascii_lowercase() {
                return Err(format!(
                    "The download does not match what was expected.\nexpected {}\ngot      {digest}",
                    artifact.sha256
                ));
            }

            report(ComponentProgress {
                tool_id: tool_id.into(),
                phase: "installing".into(),
                progress: None,
                message: format!(
                    "Installing {} {}{counted}…",
                    entry.display_name,
                    entry.version.as_deref().unwrap_or("")
                ),
            });
            unpack(artifact, &bytes, &staging)?;
            apply_renames(artifact, &staging)?;
        }
        Ok(())
    })();
    if let Err(error) = result {
        let _ = std::fs::remove_dir_all(&staging);
        return Err(error);
    }

    if let Err(error) = std::fs::rename(&staging, &target) {
        let _ = std::fs::remove_dir_all(&staging);
        return Err(format!("Could not activate the component: {error}"));
    }

    report(ComponentProgress {
        tool_id: tool_id.into(),
        phase: "ready".into(),
        progress: Some(1.0),
        message: format!("{} installed.", entry.display_name),
    });
    Ok(())
}

fn download(
    url: &str,
    tool_id: &str,
    report: &(dyn Fn(ComponentProgress) + Send + Sync),
) -> Result<Vec<u8>, String> {
    let response = ureq::get(url)
        .call()
        .map_err(|error| format!("Failed to download the component: {error}"))?;
    let expected = response
        .header("Content-Length")
        .and_then(|value| value.parse::<usize>().ok());

    let mut reader = response.into_reader();
    let mut bytes = Vec::with_capacity(expected.unwrap_or(0));
    let mut chunk = vec![0_u8; 256 * 1024];
    let mut announced = 0.0_f64;

    loop {
        let read = reader
            .read(&mut chunk)
            .map_err(|error| format!("The download was interrupted: {error}"))?;
        if read == 0 {
            break;
        }
        bytes.extend_from_slice(&chunk[..read]);

        if let Some(total) = expected.filter(|total| *total > 0) {
            let progress = (bytes.len() as f64 / total as f64).clamp(0.0, 1.0);
            // One event per percent: enough for a smooth bar, far less chatter than one
            // per chunk.
            if progress - announced >= 0.01 || progress >= 1.0 {
                announced = progress;
                report(ComponentProgress {
                    tool_id: tool_id.into(),
                    phase: "downloading".into(),
                    progress: Some(progress),
                    message: format!(
                        "Downloading… {:.0} of {:.0} MB",
                        bytes.len() as f64 / 1_048_576.0,
                        total as f64 / 1_048_576.0
                    ),
                });
            }
        }
    }
    Ok(bytes)
}

fn sha256(bytes: &[u8]) -> String {
    use sha2::Digest;
    let mut hasher = sha2::Sha256::new();
    hasher.update(bytes);
    hasher
        .finalize()
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

/// Runs a downloaded installer into the component directory.
///
/// The bytes were checked against the pinned digest before this point, which
/// is the same trust the app already places in every tool it executes: an
/// installer is not more dangerous than the binary it installs, provided it
/// is the one that was reviewed. It is pointed at the component store, so
/// nothing lands outside the app's own folder and no elevation is asked for.
fn run_silent_installer(artifact: &Artifact, bytes: &[u8], staging: &Path) -> Result<(), String> {
    let installer = staging.join("__installer.exe");
    std::fs::write(&installer, bytes)
        .map_err(|error| format!("Could not write the installer: {error}"))?;

    let mut command = std::process::Command::new(&installer);
    command.args(&artifact.silent_install);
    // NSIS requires /D last, unquoted, and takes the rest of the line as the
    // path — so it cannot be passed as a normal argument with the others.
    command.arg(format!("/D={}", staging.display()));

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x0800_0000); // CREATE_NO_WINDOW

        // Some installers ask Windows for elevation in their manifest whatever
        // they are about to write — Tesseract's does, and starting it failed
        // outright with "the requested operation requires elevation", error
        // 740, before a single argument was read. This is the documented
        // compatibility switch that answers "run as the user who started me"
        // instead of raising a prompt nobody can answer from here.
        //
        // It cannot grant anything: the process gets this app's own token, so
        // an installer that genuinely needed administrator would now fail
        // while writing rather than while starting. Ours is pointed at the
        // component store under %LOCALAPPDATA%, which the user owns.
        command.env("__COMPAT_LAYER", "RunAsInvoker");
    }

    let outcome = command.status();
    let code = match outcome {
        Ok(status) if status.success() => Ok(()),
        Ok(status) => Err(format!("The installer failed ({status}).")),
        Err(error) => Err(format!("Could not start the installer: {error}")),
    };

    // Everything above runs with this app's own token and asks nobody for
    // anything. If it did not work, the remaining explanation is an installer
    // that truly cannot write what it needs to without administrator rights,
    // and the only way to find out is to ask Windows — which puts the prompt
    // in front of the person, where a decision like that belongs.
    let code = match code {
        Ok(()) => Ok(()),
        Err(unelevated) => {
            #[cfg(windows)]
            {
                elevated_install(&installer, artifact, staging).map_err(|elevated| {
                    format!("{unelevated} Asking Windows for permission did not work either: {elevated}")
                })
            }
            #[cfg(not(windows))]
            {
                Err(unelevated)
            }
        }
    };

    let _ = std::fs::remove_file(&installer);
    code?;
    // An installer that "succeeds" without writing anything would otherwise
    // activate an empty directory and report the tool as ready.
    let wrote_something = std::fs::read_dir(staging)
        .map_err(|error| format!("Could not read the installation: {error}"))?
        .next()
        .is_some();
    if !wrote_something {
        return Err("The installer produced no files.".into());
    }
    Ok(())
}

/// Runs the installer again, this time asking Windows for administrator rights.
///
/// `ShellExecuteEx` with the `runas` verb is what raises the consent dialog;
/// there is no way to raise it from a process that is already running without
/// starting another one. The person either agrees or does not, and a refusal
/// arrives here as an ordinary error, which the card reports like any other
/// failed install.
#[cfg(windows)]
fn elevated_install(installer: &Path, artifact: &Artifact, staging: &Path) -> Result<(), String> {
    use std::os::windows::ffi::OsStrExt;
    use windows::core::PCWSTR;
    use windows::Win32::Foundation::{CloseHandle, WAIT_OBJECT_0};
    use windows::Win32::System::Threading::{GetExitCodeProcess, WaitForSingleObject, INFINITE};
    use windows::Win32::UI::Shell::{
        ShellExecuteExW, SEE_MASK_NOCLOSEPROCESS, SHELLEXECUTEINFOW,
    };
    use windows::Win32::UI::WindowsAndMessaging::SW_HIDE;

    fn wide(text: &str) -> Vec<u16> {
        std::ffi::OsStr::new(text)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect()
    }

    // The same line the unelevated attempt used, with /D last and unquoted.
    let mut arguments = artifact.silent_install.join(" ");
    if !arguments.is_empty() {
        arguments.push(' ');
    }
    arguments.push_str(&format!("/D={}", staging.display()));

    let file = wide(&installer.to_string_lossy());
    let parameters = wide(&arguments);
    let verb = wide("runas");

    let mut info = SHELLEXECUTEINFOW {
        cbSize: std::mem::size_of::<SHELLEXECUTEINFOW>() as u32,
        fMask: SEE_MASK_NOCLOSEPROCESS,
        lpVerb: PCWSTR(verb.as_ptr()),
        lpFile: PCWSTR(file.as_ptr()),
        lpParameters: PCWSTR(parameters.as_ptr()),
        nShow: SW_HIDE.0,
        ..Default::default()
    };

    unsafe {
        ShellExecuteExW(&mut info).map_err(|error| {
            // Cancelling the consent dialog arrives here, and is not a fault.
            format!("{error}")
        })?;

        if info.hProcess.is_invalid() {
            return Err("Windows started nothing.".into());
        }
        let waited = WaitForSingleObject(info.hProcess, INFINITE);
        let mut status = 0u32;
        let read = GetExitCodeProcess(info.hProcess, &mut status);
        let _ = CloseHandle(info.hProcess);

        if waited != WAIT_OBJECT_0 {
            return Err("Waiting for the installer failed.".into());
        }
        read.map_err(|error| format!("Could not read how the installer ended: {error}"))?;
        if status != 0 {
            return Err(format!("The installer failed (exit code {status})."));
        }
    }
    Ok(())
}

/// Puts one artifact's bytes into the staging directory, however it is packed.
fn unpack(artifact: &Artifact, bytes: &[u8], staging: &Path) -> Result<(), String> {
    if artifact.archive == "7z" {
        extract_seven_zip(bytes, staging)
    } else if !artifact.silent_install.is_empty() {
        run_silent_installer(artifact, bytes, staging)
    } else if artifact.archive == "zip" || is_archive(&artifact.url) {
        extract_zip(bytes, staging)
    } else {
        write_single_file(artifact, bytes, staging)
    }
}

/// Whether `unpack` opens this artifact rather than keeping it as one file.
#[cfg(test)]
fn unpacks(artifact: &Artifact) -> bool {
    matches!(artifact.archive.as_str(), "7z" | "zip")
        || !artifact.silent_install.is_empty()
        || is_archive(&artifact.url)
}

/// Whether a URL names something to unpack rather than something to keep.
fn is_archive(url: &str) -> bool {
    let name = url.split(['?', '#']).next().unwrap_or(url).to_ascii_lowercase();
    name.ends_with(".zip")
}

fn write_single_file(
    artifact: &Artifact,
    bytes: &[u8],
    destination: &Path,
) -> Result<(), String> {
    let name = artifact
        .url
        .split(['?', '#'])
        .next()
        .unwrap_or(&artifact.url)
        .rsplit('/')
        .next()
        .filter(|name| !name.is_empty())
        .ok_or("The artifact URL has no file name.")?;
    std::fs::write(destination.join(name), bytes)
        .map_err(|error| format!("Could not write {name}: {error}"))
}

/// Applies the manifest's renames inside the staging directory.
///
/// Both sides are checked rather than trusted: the manifest ships with the
/// binary, but a path that climbs out of staging would write wherever it liked,
/// and a rule that silently does nothing is worse than one that says so.
fn apply_renames(artifact: &Artifact, staging: &Path) -> Result<(), String> {
    for (from, to) in &artifact.rename {
        let source = safe_join(staging, from)?;
        let target = safe_join(staging, to)?;
        if !source.exists() {
            return Err(format!("The download does not contain {from}."));
        }
        if let Some(parent) = target.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|error| format!("Could not make room for {to}: {error}"))?;
        }
        std::fs::rename(&source, &target)
            .map_err(|error| format!("Could not rename {from} to {to}: {error}"))?;
    }
    Ok(())
}

/// Joins a manifest-supplied relative path onto a root, refusing to leave it.
fn safe_join(root: &Path, relative: &str) -> Result<PathBuf, String> {
    let mut path = root.to_path_buf();
    for segment in relative.split(['/', '\\']).filter(|part| !part.is_empty()) {
        if segment == ".." || segment.contains(':') {
            return Err(format!("{relative} is not a path inside the download."));
        }
        path.push(segment);
    }
    if path == root {
        return Err(format!("{relative} names no file."));
    }
    Ok(path)
}

/// Where the 7z archive begins inside a file that may be carrying it.
///
/// A self-extracting archive is an ordinary executable with the archive glued
/// on after it, so the signature is found rather than assumed to be at zero.
pub fn seven_zip_offset(bytes: &[u8]) -> Option<usize> {
    const SIGNATURE: [u8; 6] = [0x37, 0x7A, 0xBC, 0xAF, 0x27, 0x1C];
    bytes.windows(SIGNATURE.len()).position(|window| window == SIGNATURE)
}

fn extract_seven_zip(bytes: &[u8], destination: &Path) -> Result<(), String> {
    let offset = seven_zip_offset(bytes)
        .ok_or("This download does not contain a 7z archive after all.")?;
    sevenz_rust2::decompress(std::io::Cursor::new(&bytes[offset..]), destination)
        .map_err(|error| format!("Could not unpack the archive: {error}"))
}

fn extract_zip(bytes: &[u8], destination: &Path) -> Result<(), String> {
    let mut archive = zip::ZipArchive::new(std::io::Cursor::new(bytes))
        .map_err(|error| format!("The download is not a valid zip: {error}"))?;

    for index in 0..archive.len() {
        let mut entry = archive
            .by_index(index)
            .map_err(|error| format!("Could not read the package contents: {error}"))?;
        // `enclosed_name` rejects absolute paths and `..`, so a malicious archive cannot
        // write outside the store.
        let Some(relative) = entry.enclosed_name() else {
            return Err(format!(
                "The package contains an unsafe path: {}",
                entry.name()
            ));
        };
        let path = destination.join(relative);

        if entry.is_dir() {
            std::fs::create_dir_all(&path)
                .map_err(|error| format!("Could not create {}: {error}", path.display()))?;
            continue;
        }
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|error| format!("Could not create {}: {error}", parent.display()))?;
        }
        let mut file = std::fs::File::create(&path)
            .map_err(|error| format!("Could not write {}: {error}", path.display()))?;
        std::io::copy(&mut entry, &mut file)
            .map_err(|error| format!("Failed to extract {}: {error}", path.display()))?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    #[test]
    fn rename_preserves_the_existing_component_store() {
        let base = std::env::var_os("LOCALAPPDATA").unwrap();
        assert_eq!(super::store_root().unwrap(), std::path::PathBuf::from(base).join("ToolHaven").join("components"));
    }

    use super::*;

    #[test]
    fn every_catalog_tool_declares_a_delivery_that_the_app_can_honour() {
        for entry in &manifest().tools {
            match entry.status.as_str() {
                "bundled" | "downloadable" => {
                    assert!(entry.version.is_some(), "{} has no version", entry.id);
                    assert!(!entry.artifacts.is_empty(), "{} has no artifact", entry.id);
                }
                "planned" => assert!(
                    entry.artifacts.is_empty(),
                    "{} should declare no artifact",
                    entry.id
                ),
                other => panic!("unknown status on {}: {other}", entry.id),
            }
        }
    }

    #[test]
    fn plans_dependencies_first_and_skips_what_the_installer_already_ships() {
        let plan = installation_plan("yt-dlp").unwrap();
        let ids: Vec<&str> = plan.iter().map(|tool| tool.id.as_str()).collect();

        assert_eq!(ids, ["deno", "ffmpeg", "ffprobe", "yt-dlp"]);
        assert!(installation_plan("no-such-tool").is_err());
    }

    #[test]
    fn tools_sharing_an_archive_install_into_the_same_directory() {
        let ffmpeg = tool("ffmpeg").unwrap().artifacts.first().unwrap();
        let ffprobe = tool("ffprobe").unwrap().artifacts.first().unwrap();

        assert_eq!(ffmpeg.sha256, ffprobe.sha256);
        assert_eq!(
            artifact_directory(ffmpeg).unwrap(),
            artifact_directory(ffprobe).unwrap()
        );
    }

    #[test]
    #[ignore = "Baixa um componente real da internet"]
    fn installs_a_real_component_end_to_end() {
        let artifact = tool("difftastic").unwrap().artifacts.first().unwrap();
        let directory = artifact_directory(artifact).unwrap();
        let _ = std::fs::remove_dir_all(&directory);

        let seen = std::sync::Mutex::new(Vec::new());
        install("difftastic", &|progress| {
            seen.lock().unwrap().push(progress.phase);
        })
        .unwrap();

        let phases = seen.into_inner().unwrap();
        assert!(phases.contains(&"downloading".to_string()), "{phases:?}");
        assert!(phases.contains(&"verifying".to_string()), "{phases:?}");
        assert!(phases.contains(&"ready".to_string()), "{phases:?}");
        assert!(is_installed("difftastic"));

        let binaries = installed_binary_directory("difftastic").expect("installed");
        assert!(binaries.join("difft.exe").is_file());
        // Re-installing an artifact already in the store must be a no-op, not a re-download.
        install("difftastic", &|_| panic!("must not download twice")).unwrap();
        println!("Component installed at {}", binaries.display());
    }

    /// Installs every downloadable tool into an empty store, as a fresh machine
    /// would, then runs each one. About 900 MB of downloads; pinned URLs rot
    /// (BtbN prunes its daily builds), and only this finds out before a user does.
    ///
    /// `cargo test --lib -- --ignored --nocapture installs_and_runs_every_tool`
    #[test]
    #[ignore = "downloads every component from the internet"]
    fn installs_and_runs_every_tool() {
        let store = std::env::temp_dir().join("tools4devs-fresh-machine");
        let _ = std::fs::remove_dir_all(&store);
        std::fs::create_dir_all(&store).unwrap();
        std::env::set_var("LOCALAPPDATA", &store);

        let mut failures = Vec::new();
        for entry in manifest().tools.iter().filter(|tool| tool.status == "downloadable") {
            let id = entry.id.as_str();
            if let Err(error) = install(id, &|_| {}) {
                failures.push(format!("{id}: install failed: {error}"));
                continue;
            }
            let executable = crate::executable_name(id).unwrap();
            let Some(binary) = installed_binary_directory(id).map(|dir| dir.join(&executable)) else {
                failures.push(format!("{id}: no binary directory after install"));
                continue;
            };
            let arguments: &[&str] = match id {
                "ffmpeg" | "ffprobe" => &["-version"],
                "exiftool" => &["-ver"],
                "poppler" => &["-v"],
                "7zip" => &["i"],
                "upscaler" => &["-h"],
                _ => &["--version"],
            };
            let output = std::process::Command::new(&binary)
                .args(arguments)
                .current_dir(binary.parent().unwrap())
                .stdin(std::process::Stdio::null())
                .output();
            match output {
                Err(error) => failures.push(format!("{id}: could not start {}: {error}", binary.display())),
                Ok(output) => {
                    let text = format!(
                        "{}{}",
                        String::from_utf8_lossy(&output.stdout),
                        String::from_utf8_lossy(&output.stderr)
                    );
                    let first = text.lines().find(|line| !line.trim().is_empty()).unwrap_or("").trim();
                    println!("{id:12} {:?}  {first}", output.status.code());
                    // 0xC0000135 / 0xC000007B: a DLL the build needs is missing or the wrong bitness.
                    let loader_failure = matches!(output.status.code(), Some(-1073741515) | Some(-1073741701));
                    if first.is_empty() || loader_failure {
                        failures.push(format!("{id}: ran but did not work ({:?}): {first}", output.status.code()));
                    }
                }
            }
        }
        assert!(failures.is_empty(), "\n{}", failures.join("\n"));
    }

    /// Runs a real installer into a temporary directory, with this app's own
    /// token and nothing else.
    ///
    /// Tesseract's installer asks Windows for elevation in its manifest, so
    /// starting it used to fail with error 740 before it read an argument —
    /// which is what this proves is fixed. It writes 114 MB and takes a few
    /// seconds; it is ignored because it needs a real installer on disk.
    ///
    /// `TOOLS4DEVS_INSTALLER=C:\path\to\setup.exe cargo test -- --ignored --nocapture runs_an_installer_without_elevation`
    #[test]
    #[ignore = "runs the installer named by TOOLS4DEVS_INSTALLER"]
    fn runs_an_installer_without_elevation() {
        let Some(source) = std::env::var_os("TOOLS4DEVS_INSTALLER") else {
            println!("set TOOLS4DEVS_INSTALLER to an installer path");
            return;
        };
        let bytes = std::fs::read(&source).expect("the installer should be readable");
        let staging = std::env::temp_dir().join("tools4devs-install-test");
        let _ = std::fs::remove_dir_all(&staging);
        std::fs::create_dir_all(&staging).expect("the staging directory should be creatable");

        let artifact = Artifact {
            url: String::new(),
            sha256: String::new(),
            binary_directory: String::new(),
            silent_install: vec!["/S".into()],
            archive: String::new(),
            rename: Default::default(),
        };

        run_silent_installer(&artifact, &bytes, &staging).expect("the installer should run");
        let files = walkdir(&staging, 1);
        assert!(!files.is_empty(), "the installer should have written something");
        println!("{} entries, first few:", files.len());
        for entry in files.iter().take(5) {
            println!("  {entry}");
        }
    }

    /// Lists what a downloaded archive holds, for working out `binaryDirectory`
    /// and `rename` when pinning a new tool. Uses the installer's own extractor,
    /// so what it prints is what the app would see.
    ///
    /// `TOOLS4DEVS_PROBE=C:\path\to\archive.7z cargo test -- --ignored --nocapture probes_an_archive`
    #[test]
    #[ignore = "reads an archive named by TOOLS4DEVS_PROBE"]
    fn probes_an_archive() {
        let Some(source) = std::env::var_os("TOOLS4DEVS_PROBE") else {
            println!("set TOOLS4DEVS_PROBE to an archive path");
            return;
        };
        let bytes = std::fs::read(&source).expect("the archive should be readable");
        let destination = std::env::temp_dir().join("tools4devs-probe");
        let _ = std::fs::remove_dir_all(&destination);
        let offset = seven_zip_offset(&bytes).unwrap_or(0);
        sevenz_rust2::decompress(std::io::Cursor::new(&bytes[offset..]), &destination)
            .expect("the archive should unpack");
        for entry in walkdir(&destination, 2) {
            println!("  {entry}");
        }
    }

    #[cfg(test)]
    fn walkdir(root: &std::path::Path, depth: usize) -> Vec<String> {
        let mut found = Vec::new();
        let Ok(entries) = std::fs::read_dir(root) else { return found };
        for entry in entries.flatten() {
            let path = entry.path();
            let name = path.strip_prefix(root).unwrap_or(&path).display().to_string();
            if path.is_dir() {
                found.push(format!("{name}/"));
                if depth > 1 {
                    found.extend(walkdir(&path, depth - 1).into_iter().map(|child| format!("{name}/{child}")));
                }
            } else {
                found.push(name);
            }
        }
        found.sort();
        found.truncate(30);
        found
    }

    #[test]
    fn keeps_a_loose_file_and_unpacks_an_archive() {
        // A model's weights are a file to keep as it is; a release is a zip to
        // open. Deciding by extension rather than by "is it an .exe" is what
        // lets one tool be assembled from both.
        assert!(is_archive("https://example.test/realsr-windows.zip"));
        assert!(is_archive("https://example.test/RELEASE.ZIP?token=1"));
        assert!(!is_archive("https://example.test/models/4xNomos8kSC.bin"));
        assert!(!is_archive("https://example.test/tool.exe"));
        assert!(!is_archive("https://example.test/weights.param"));
    }

    #[test]
    fn every_artifact_that_names_a_folder_inside_itself_is_unpacked() {
        // ExifTool's SourceForge URL ends in `.zip/download`, so it was kept as
        // a loose file called `download` and its rename then found nothing.
        for tool in &manifest().tools {
            for artifact in &tool.artifacts {
                let names_a_folder = !artifact.binary_directory.is_empty()
                    || artifact.rename.keys().any(|from| from.contains(['/', '\\']));
                if names_a_folder {
                    assert!(unpacks(artifact), "{} would not be unpacked: {}", tool.id, artifact.url);
                }
            }
        }
    }

    #[test]
    fn refuses_a_rename_that_would_write_outside_the_download() {
        let root = std::path::Path::new("C:\\store\\abc");
        assert!(safe_join(root, "../escape.exe").is_err());
        assert!(safe_join(root, "sub/../../escape.exe").is_err());
        assert!(safe_join(root, "D:\\elsewhere.exe").is_err());
        assert!(safe_join(root, "").is_err());

        assert_eq!(
            safe_join(root, "exiftool-13.59_64/exiftool(-k).exe").unwrap(),
            root.join("exiftool-13.59_64").join("exiftool(-k).exe")
        );
    }

    #[test]
    fn finds_the_archive_inside_a_self_extracting_executable() {
        let signature = [0x37u8, 0x7A, 0xBC, 0xAF, 0x27, 0x1C];
        // At the very start, as a bare .7z would be.
        assert_eq!(seven_zip_offset(&signature), Some(0));

        // After a stub, as a self-extractor is.
        let mut sfx = vec![0x4D, 0x5A, 0x90, 0x00, 0x03];
        sfx.extend_from_slice(&signature);
        assert_eq!(seven_zip_offset(&sfx), Some(5));

        // And absent, which has to be said rather than guessed at.
        assert_eq!(seven_zip_offset(b"MZ this is just a program"), None);
        assert_eq!(seven_zip_offset(&[]), None);
        assert_eq!(seven_zip_offset(&signature[..5]), None);
    }

    #[test]
    fn leaves_nothing_for_the_user_to_install_by_hand() {
        // Four tools used to sit outside the automatic channel because of how
        // they were packaged. None does now, and the promise on the site --
        // that you never install anything by hand -- holds only while this
        // passes.
        let manual: Vec<&str> = manifest()
            .tools
            .iter()
            .filter(|tool| tool.status != "bundled" && tool.status != "downloadable")
            .map(|tool| tool.id.as_str())
            .collect();

        assert_eq!(manual, Vec::<&str>::new());
    }

    #[test]
    fn refuses_a_tool_that_is_not_in_the_catalog_at_all() {
        let error = install("definitely-not-a-tool", &|_| {}).unwrap_err();
        assert!(error.contains("outside the catalog"), "{error}");
    }
}

