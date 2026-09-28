use std::{
    fs, io,
    path::Path,
    time::{SystemTime, UNIX_EPOCH},
};

pub(crate) fn migrate_current_user() -> io::Result<()> {
    let local = std::env::var_os("LOCALAPPDATA")
        .ok_or_else(|| io::Error::other("Could not locate the application data folder."))?;
    let roaming = std::env::var_os("APPDATA").map(std::path::PathBuf::from);
    migrate_user_data(Path::new(&local), roaming.as_deref())
}

pub(crate) fn migrate_user_data(local: &Path, roaming: Option<&Path>) -> io::Result<()> {
    migrate_directory(
        &local.join("ToolHaven/components"),
        &local.join("tools4devs/components"),
    )?;
    if let Some(roaming) = roaming {
        migrate_directory(
            &roaming.join("com.toolhaven.desktop"),
            &roaming.join("com.tools4devs.desktop"),
        )?;
    }
    migrate_directory(
        &local.join("com.toolhaven.desktop"),
        &local.join("com.tools4devs.desktop"),
    )
}

fn migrate_directory(source: &Path, destination: &Path) -> io::Result<()> {
    if destination.try_exists()? {
        let metadata = fs::symlink_metadata(destination)?;
        if metadata.is_dir() && !metadata.file_type().is_symlink() {
            return Ok(());
        }
        return Err(io::Error::new(
            io::ErrorKind::AlreadyExists,
            "Migration destination is not a regular directory.",
        ));
    }
    if !source.try_exists()? {
        return Ok(());
    }
    let parent = destination
        .parent()
        .ok_or_else(|| io::Error::other("Migration destination has no parent."))?;
    fs::create_dir_all(parent)?;
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(io::Error::other)?
        .as_nanos();
    let staging = parent.join(format!(
        ".tools4devs-migration-{}-{nonce}",
        std::process::id()
    ));
    fs::create_dir(&staging)?;
    let result = copy_directory(source, &staging).and_then(|_| fs::rename(&staging, destination));
    if result.is_err() {
        // Only this freshly created staging directory is removed; original data stays intact.
        let _ = fs::remove_dir_all(&staging);
    }
    result
}

fn copy_directory(source: &Path, destination: &Path) -> io::Result<()> {
    if fs::symlink_metadata(source)?.file_type().is_symlink() {
        return Err(io::Error::other(
            "Close the old app and remove linked data directories before migrating.",
        ));
    }
    for entry in fs::read_dir(source)? {
        let entry = entry?;
        let kind = entry.file_type()?;
        let target = destination.join(entry.file_name());
        if kind.is_dir() {
            fs::create_dir(&target)?;
            copy_directory(&entry.path(), &target)?;
        } else if kind.is_file() {
            fs::copy(entry.path(), target)?;
        } else {
            return Err(io::Error::other(
                "Linked or special files cannot be migrated safely.",
            ));
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn workspace(name: &str) -> PathBuf {
        let root = std::env::temp_dir().join(format!(
            "tools4devs-migration-{}-{name}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).unwrap();
        root
    }

    #[test]
    fn copies_nested_profile_and_component_bytes_without_removing_the_original() {
        let root = workspace("copy");
        let source = root.join("legacy");
        let destination = root.join("current");
        fs::create_dir_all(source.join("nested")).unwrap();
        fs::write(source.join("nested/preferences"), b"saved settings").unwrap();
        migrate_directory(&source, &destination).unwrap();
        assert_eq!(
            fs::read(destination.join("nested/preferences")).unwrap(),
            b"saved settings"
        );
        assert_eq!(
            fs::read(source.join("nested/preferences")).unwrap(),
            b"saved settings"
        );
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn fresh_installs_need_no_legacy_directory() {
        let root = workspace("fresh");
        migrate_directory(&root.join("missing"), &root.join("current")).unwrap();
        assert!(!root.join("current").exists());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn migrates_both_profiles_and_components_to_the_canonical_paths() {
        let root = workspace("paths");
        let local = root.join("local");
        let roaming = root.join("roaming");
        for path in [
            local.join("com.toolhaven.desktop"),
            roaming.join("com.toolhaven.desktop"),
            local.join("ToolHaven/components"),
        ] {
            fs::create_dir_all(&path).unwrap();
            fs::write(path.join("saved"), b"retained").unwrap();
        }
        migrate_user_data(&local, Some(&roaming)).unwrap();
        for path in [
            local.join("com.tools4devs.desktop"),
            roaming.join("com.tools4devs.desktop"),
            local.join("tools4devs/components"),
        ] {
            assert_eq!(fs::read(path.join("saved")).unwrap(), b"retained");
        }
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn repeated_launches_never_overwrite_newer_data() {
        let root = workspace("repeat");
        fs::create_dir_all(root.join("legacy")).unwrap();
        fs::write(root.join("legacy/preferences"), b"old").unwrap();
        migrate_directory(&root.join("legacy"), &root.join("current")).unwrap();
        fs::write(root.join("current/preferences"), b"new").unwrap();
        migrate_directory(&root.join("legacy"), &root.join("current")).unwrap();
        assert_eq!(fs::read(root.join("current/preferences")).unwrap(), b"new");
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn a_failed_migration_leaves_the_source_intact_and_can_be_retried() {
        let root = workspace("retry");
        fs::create_dir_all(root.join("legacy")).unwrap();
        fs::write(root.join("legacy/preferences"), b"saved").unwrap();
        fs::write(root.join("blocked"), b"not a directory").unwrap();
        assert!(migrate_directory(&root.join("legacy"), &root.join("blocked/current")).is_err());
        assert_eq!(fs::read(root.join("legacy/preferences")).unwrap(), b"saved");
        assert!(!root.join("blocked/current").exists());
        fs::remove_file(root.join("blocked")).unwrap();
        migrate_directory(&root.join("legacy"), &root.join("blocked/current")).unwrap();
        assert_eq!(
            fs::read(root.join("blocked/current/preferences")).unwrap(),
            b"saved"
        );
        fs::remove_dir_all(root).unwrap();
    }

    #[cfg(windows)]
    #[test]
    fn a_locked_profile_never_becomes_a_partial_destination() {
        use std::os::windows::fs::OpenOptionsExt;
        let root = workspace("locked");
        let source = root.join("legacy");
        let destination = root.join("current");
        fs::create_dir_all(&source).unwrap();
        fs::write(source.join("preferences"), b"saved").unwrap();
        let lock = fs::OpenOptions::new()
            .read(true)
            .share_mode(0)
            .open(source.join("preferences"))
            .unwrap();
        assert!(migrate_directory(&source, &destination).is_err());
        assert!(!destination.exists());
        assert_eq!(fs::read_dir(&root).unwrap().count(), 1);
        drop(lock);
        migrate_directory(&source, &destination).unwrap();
        assert_eq!(fs::read(destination.join("preferences")).unwrap(), b"saved");
        assert_eq!(fs::read(source.join("preferences")).unwrap(), b"saved");
        fs::remove_dir_all(root).unwrap();
    }
}
