//! The operations that are running right now, so one of them can be stopped.
//!
//! Stopping a job means stopping everything it started, which on Windows means
//! a Job Object rather than a kill on the one process we spawned: yt-dlp runs
//! FFmpeg to merge what it downloaded, and killing only yt-dlp leaves FFmpeg
//! writing to the file nobody is waiting for any more.
//!
//! The same object is what makes the app's children die with the app. The job
//! is created with `KILL_ON_JOB_CLOSE`, so a tools4devs that crashes does not
//! leave a transcode running until the machine is restarted.

use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};

/// What a finished job turned out to be, once its process exited.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Ending {
    /// It ran to completion, for better or worse.
    OnItsOwn,
    /// Somebody pressed stop.
    Cancelled,
}

#[cfg(windows)]
mod platform {
    use windows::Win32::Foundation::{CloseHandle, HANDLE};
    use windows::Win32::System::JobObjects::{
        AssignProcessToJobObject, CreateJobObjectW, JobObjectExtendedLimitInformation,
        SetInformationJobObject, TerminateJobObject, JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
        JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
    };

    /// A job object handle that can be held across threads.
    ///
    /// `HANDLE` is a raw pointer and so not `Send` by default. A Windows handle
    /// is process-wide and has no thread affinity, and every use of it here is
    /// behind the registry's mutex, which is what makes this sound.
    #[derive(Clone, Copy)]
    pub struct Job(pub HANDLE);

    unsafe impl Send for Job {}
    unsafe impl Sync for Job {}

    pub fn create() -> Result<Job, String> {
        unsafe {
            let handle =
                CreateJobObjectW(None, None).map_err(|error| format!("Could not prepare to run: {error}"))?;
            let mut limits = JOBOBJECT_EXTENDED_LIMIT_INFORMATION::default();
            // Without this the children outlive a crash of the app.
            limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
            SetInformationJobObject(
                handle,
                JobObjectExtendedLimitInformation,
                &limits as *const _ as *const std::ffi::c_void,
                std::mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
            )
            .map_err(|error| format!("Could not prepare to run: {error}"))?;
            Ok(Job(handle))
        }
    }

    pub fn adopt(job: Job, process: isize) -> Result<(), String> {
        unsafe {
            AssignProcessToJobObject(job.0, HANDLE(process as *mut std::ffi::c_void))
                .map_err(|error| format!("Could not take charge of the process: {error}"))
        }
    }

    pub fn terminate(job: Job) {
        // A job whose processes have already exited terminates harmlessly.
        unsafe {
            let _ = TerminateJobObject(job.0, 1);
        }
    }

    pub fn close(job: Job) {
        unsafe {
            let _ = CloseHandle(job.0);
        }
    }
}

#[cfg(not(windows))]
mod platform {
    #[derive(Clone, Copy)]
    pub struct Job(pub usize);

    pub fn create() -> Result<Job, String> {
        Err("Stopping a job is only implemented for Windows.".into())
    }
    pub fn adopt(_job: Job, _process: isize) -> Result<(), String> {
        Ok(())
    }
    pub fn terminate(_job: Job) {}
    pub fn close(_job: Job) {}
}

struct Entry {
    job: platform::Job,
    cancelled: bool,
}

fn registry() -> &'static Mutex<HashMap<String, Entry>> {
    static REGISTRY: OnceLock<Mutex<HashMap<String, Entry>>> = OnceLock::new();
    REGISTRY.get_or_init(|| Mutex::new(HashMap::new()))
}

/// Takes charge of a freshly spawned process on behalf of `job_id`.
///
/// A job with no id — nothing in the queue is waiting on it — is left alone:
/// there is no way to ask for it to be stopped, so there is nothing to track.
pub fn watch(job_id: Option<&str>, process_handle: isize) -> Result<(), String> {
    let Some(job_id) = job_id else { return Ok(()) };
    let job = platform::create()?;
    if let Err(error) = platform::adopt(job, process_handle) {
        platform::close(job);
        return Err(error);
    }
    let mut registry = registry().lock().map_err(|_| poisoned())?;
    if let Some(previous) = registry.insert(job_id.to_string(), Entry { job, cancelled: false }) {
        // One id should never run twice, but leaking a handle if it did is worse.
        platform::close(previous.job);
    }
    Ok(())
}

/// Stops the job, and everything it started. Returns whether there was one.
pub fn cancel(job_id: &str) -> Result<bool, String> {
    let mut registry = registry().lock().map_err(|_| poisoned())?;
    let Some(entry) = registry.get_mut(job_id) else {
        return Ok(false);
    };
    entry.cancelled = true;
    platform::terminate(entry.job);
    Ok(true)
}

/// Releases a finished job and says how it ended.
pub fn release(job_id: Option<&str>) -> Ending {
    let Some(job_id) = job_id else { return Ending::OnItsOwn };
    let Ok(mut registry) = registry().lock() else { return Ending::OnItsOwn };
    match registry.remove(job_id) {
        Some(entry) => {
            platform::close(entry.job);
            if entry.cancelled {
                Ending::Cancelled
            } else {
                Ending::OnItsOwn
            }
        }
        None => Ending::OnItsOwn,
    }
}

/// How many operations are running under this registry right now.
#[cfg(test)]
pub fn count() -> usize {
    registry().lock().map(|registry| registry.len()).unwrap_or(0)
}

/// The sentence a cancelled operation fails with, recognised by the interface.
pub const CANCELLED: &str = "Stopped before it finished.";

fn poisoned() -> String {
    "The list of running jobs is in an unusable state; restart the app.".to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn has_nothing_to_stop_for_an_id_it_never_saw() {
        assert_eq!(cancel("never-started").unwrap(), false);
        assert_eq!(release(Some("never-started")), Ending::OnItsOwn);
    }

    #[test]
    fn leaves_an_untracked_job_alone() {
        // No id means nothing in the queue is waiting, so there is nothing to
        // register and nothing that could ask for it to stop.
        assert!(watch(None, 0).is_ok());
        assert_eq!(release(None), Ending::OnItsOwn);
    }

    #[test]
    #[cfg(windows)]
    fn tracks_a_real_process_and_stops_it() {
        // A process that would otherwise sit there for a minute.
        let mut child = std::process::Command::new("cmd")
            .args(["/C", "timeout /T 60 /NOBREAK"])
            .stdin(std::process::Stdio::null())
            .stdout(std::process::Stdio::null())
            .spawn()
            .expect("the shell should start");

        use std::os::windows::io::AsRawHandle;
        watch(Some("test-job"), child.as_raw_handle() as isize).expect("it should be tracked");
        assert_eq!(count(), 1);

        assert!(cancel("test-job").unwrap(), "a tracked job can be stopped");
        let status = child.wait().expect("it should exit");
        assert!(!status.success(), "a stopped process does not exit cleanly");

        assert_eq!(release(Some("test-job")), Ending::Cancelled);
        assert_eq!(count(), 0);
    }
}
