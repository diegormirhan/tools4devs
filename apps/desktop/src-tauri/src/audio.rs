//! Recording a few seconds of sound, either from a microphone or from whatever
//! the machine is already playing.
//!
//! The second half is the reason this module exists at all. Windows will hand an
//! application the mix that is going to the speakers, but only through WASAPI's
//! loopback mode — opening a *playback* endpoint for capture. FFmpeg cannot do
//! it on Windows, and the usual advice is to install a virtual cable, which this
//! product does not ask of anyone. So the capture is written here instead.
//!
//! Nothing recorded here is kept: the clip goes to a temporary file, is handed
//! to the recogniser, and the caller deletes it.

use std::collections::VecDeque;

/// One place sound can be recorded from, as the picker shows it.
#[derive(Debug, Clone, serde::Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AudioSource {
    /// The endpoint's own identifier, which survives a reboot and a rename.
    pub id: String,
    pub label: String,
    /// `microphone` or `playback`. The interface phrases the two very
    /// differently, because recording the room and recording the machine carry
    /// different expectations.
    pub kind: String,
    pub is_default: bool,
}

/// Loopback mode will not convert anything: a playback endpoint opened for
/// capture hands over its own mix format or refuses to open at all
/// (`AUDCLNT_E_UNSUPPORTED_FORMAT`). So the device chooses the rate and the
/// channel count, the clip is written at whatever those turn out to be, and
/// FFmpeg — which the recogniser is fed through anyway — does the converting.
/// These two are only the shape the tests generate and the fallback for a
/// device that reports nothing useful.
const SAMPLE_RATE: usize = 44_100;
const CHANNELS: usize = 2;

/// Anything below this peak is silence for our purposes — a muted output or a
/// microphone nobody spoke into, both worth saying out loud rather than sending
/// a flat line to a recogniser that will simply answer "no match".
const SILENCE_PEAK: f32 = 0.002;

/// Said for both an empty recording and a flat one, because the fix is the same.
pub const NOTHING_HEARD: &str = concat!(
    "Nothing came through. If you chose a speaker, start the music first and try again; ",
    "if you chose a microphone, check it is not muted."
);

#[cfg(windows)]
pub fn list_sources() -> Result<Vec<AudioSource>, String> {
    use wasapi::{Direction, DeviceState};

    // The whole enumeration has to happen on a COM-initialised thread, and the
    // command may arrive on any of Tauri's workers.
    std::thread::spawn(|| {
        let _ = wasapi::initialize_mta();
        let enumerator =
            wasapi::DeviceEnumerator::new().map_err(|error| describe(error, "list the sound devices"))?;

        let mut sources = Vec::new();
        for (direction, kind) in [
            (Direction::Render, "playback"),
            (Direction::Capture, "microphone"),
        ] {
            let default_id = enumerator
                .get_default_device(&direction)
                .ok()
                .and_then(|device| device.get_id().ok());
            let collection = enumerator
                .get_device_collection(&direction)
                .map_err(|error| describe(error, "list the sound devices"))?;
            let count = collection
                .get_nbr_devices()
                .map_err(|error| describe(error, "list the sound devices"))?;
            for index in 0..count {
                let Ok(device) = collection.get_device_at_index(index) else {
                    continue;
                };
                // Unplugged and disabled endpoints are still enumerated. Showing
                // them means offering a source that cannot record.
                if !matches!(device.get_state(), Ok(DeviceState::Active)) {
                    continue;
                }
                let (Ok(id), Ok(label)) = (device.get_id(), device.get_friendlyname()) else {
                    continue;
                };
                sources.push(AudioSource {
                    is_default: default_id.as_deref() == Some(id.as_str()),
                    id,
                    label,
                    kind: kind.to_string(),
                });
            }
        }
        // The default of each kind first, so the two obvious choices are the two
        // at the top rather than wherever Windows happened to enumerate them.
        sources.sort_by_key(|source| (source.kind.clone(), !source.is_default));
        Ok(sources)
    })
    .join()
    .map_err(|_| "Listing the sound devices stopped unexpectedly.".to_string())?
}

#[cfg(not(windows))]
pub fn list_sources() -> Result<Vec<AudioSource>, String> {
    Err("Recording is only implemented for Windows.".into())
}

/// How loud the last moment was, and how far through the recording it is.
///
/// Reported while the clip is still being taken, so the window can show the
/// sound arriving rather than a spinner that means nothing. The level is a
/// peak in 0..1; the fraction is 0..1 through the longest the recording can be.
pub type OnLevel = std::sync::Arc<dyn Fn(f32, f32) + Send + Sync>;

/// What has been recorded so far, and the shape it is in.
#[derive(Debug, Default)]
struct Recorded {
    samples: Vec<f32>,
    rate: usize,
    channels: usize,
    /// Set once the device has been opened and has started delivering.
    ready: bool,
}

/// A recording that is still going, which can be read from while it runs.
///
/// Reading a recording before it is finished is the whole point: a caller can
/// try to identify what it has after four seconds rather than after twelve, and
/// stop the moment it succeeds. A recording that must complete before anyone
/// can look at it makes every answer cost the full wait.
pub struct Recording {
    recorded: std::sync::Arc<std::sync::Mutex<Recorded>>,
    stop: std::sync::Arc<std::sync::atomic::AtomicBool>,
    worker: Option<std::thread::JoinHandle<Result<(), String>>>,
}

impl Recording {
    /// Everything captured up to now, or nothing if the device has yet to
    /// deliver anything at all.
    pub fn so_far(&self) -> Option<(Vec<f32>, u32, u16)> {
        let recorded = self.recorded.lock().ok()?;
        if !recorded.ready || recorded.samples.is_empty() {
            return None;
        }
        Some((
            recorded.samples.clone(),
            recorded.rate as u32,
            recorded.channels as u16,
        ))
    }

    /// How many seconds of sound have arrived.
    pub fn seconds(&self) -> f32 {
        let Ok(recorded) = self.recorded.lock() else {
            return 0.0;
        };
        if recorded.rate == 0 || recorded.channels == 0 {
            return 0.0;
        }
        recorded.samples.len() as f32 / (recorded.rate * recorded.channels) as f32
    }

    pub fn running(&self) -> bool {
        self.worker.as_ref().is_some_and(|worker| !worker.is_finished())
    }

    /// Asks the recording to end. It stops at its next turn round the loop.
    pub fn stop(&self) {
        self.stop.store(true, std::sync::atomic::Ordering::Relaxed);
    }

    /// Ends the recording and reports anything the device itself complained of.
    pub fn finish(mut self) -> Result<(), String> {
        self.stop();
        match self.worker.take() {
            Some(worker) => worker
                .join()
                .map_err(|_| "Recording stopped unexpectedly.".to_string())?,
            None => Ok(()),
        }
    }
}

impl Drop for Recording {
    fn drop(&mut self) {
        // A caller that returns early must not leave a device open.
        self.stop();
        if let Some(worker) = self.worker.take() {
            let _ = worker.join();
        }
    }
}

/// Starts recording from `source_id`, for at most `seconds`.
#[cfg(windows)]
pub fn start(source_id: &str, seconds: u32, on_level: OnLevel) -> Result<Recording, String> {
    use wasapi::{Direction, StreamMode};

    if !(1..=30).contains(&seconds) {
        return Err("A clip has to be between 1 and 30 seconds long.".into());
    }
    let wanted = source_id.to_string();
    let recorded = std::sync::Arc::new(std::sync::Mutex::new(Recorded::default()));
    let stop = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
    let shared = recorded.clone();
    let halt = stop.clone();

    let worker = std::thread::spawn(move || -> Result<(), String> {
        let _ = wasapi::initialize_mta();
        let enumerator = wasapi::DeviceEnumerator::new()
            .map_err(|error| describe(error, "open the sound device"))?;

        // A playback endpoint opened for capture is loopback mode; that is the
        // whole trick, and it is why the direction here is the device's own.
        let mut found = None;
        for direction in [Direction::Render, Direction::Capture] {
            let Ok(collection) = enumerator.get_device_collection(&direction) else {
                continue;
            };
            let Ok(count) = collection.get_nbr_devices() else {
                continue;
            };
            for index in 0..count {
                let Ok(device) = collection.get_device_at_index(index) else {
                    continue;
                };
                if device.get_id().ok().as_deref() == Some(wanted.as_str()) {
                    found = Some(device);
                    break;
                }
            }
            if found.is_some() {
                break;
            }
        }
        let device = found.ok_or_else(|| {
            "That sound device is no longer available. Pick another one.".to_string()
        })?;

        let mut client = device
            .get_iaudioclient()
            .map_err(|error| describe(error, "open the sound device"))?;
        // Ask the device what it is already doing rather than telling it.
        let format = client
            .get_mixformat()
            .map_err(|error| describe(error, "read the sound format"))?;
        let block_align = format.get_blockalign() as usize;
        // A device reporting zero is broken, but falling back beats failing.
        let rate = match format.get_samplespersec() as usize {
            0 => SAMPLE_RATE,
            reported => reported,
        };
        let channels = match format.get_nchannels() as usize {
            0 => CHANNELS,
            reported => reported,
        };
        let bits = format.get_bitspersample() as usize;
        let sample_type: SampleKind = format
            .get_subformat()
            .map_err(|error| describe(error, "read the sound format"))?
            .into();
        let (default_period, _min_period) = client
            .get_device_period()
            .map_err(|error| describe(error, "open the sound device"))?;
        // Always Capture, whichever kind of endpoint this is: asking to capture
        // a *playback* device is precisely what turns the loopback flag on, and
        // passing the device's own direction quietly opens a playback stream
        // that then refuses to hand over a capture client.
        //
        // Polling rather than events, because a loopback stream does not signal
        // one reliably — the documented advice, and the difference between a
        // recording and a four-second wait that returns nothing.
        client
            .initialize_client(
                &format,
                &Direction::Capture,
                &StreamMode::PollingShared {
                    autoconvert: false,
                    buffer_duration_hns: default_period,
                },
            )
            .map_err(|error| describe(error, "open the sound device"))?;
        let capture = client
            .get_audiocaptureclient()
            .map_err(|error| describe(error, "open the sound device"))?;

        if let Ok(mut recorded) = shared.lock() {
            recorded.rate = rate;
            recorded.channels = channels;
            recorded.ready = true;
        }

        let wanted_frames = rate * seconds as usize;
        let mut queue: VecDeque<u8> = VecDeque::with_capacity(wanted_frames * block_align);
        client
            .start_stream()
            .map_err(|error| describe(error, "start recording"))?;

        // A silent playback device delivers nothing at all rather than zeroes,
        // so the loop is bounded by the clock as well as by the byte count —
        // otherwise recording a muted machine would never return.
        let deadline =
            std::time::Instant::now() + std::time::Duration::from_secs(seconds as u64 + 4);
        // Often enough to look continuous, rarely enough not to flood the
        // window with events nobody can see.
        let report_every = std::time::Duration::from_millis(60);
        let mut reported_at = std::time::Instant::now();
        let mut handed_over = 0usize;
        let started = std::time::Instant::now();

        while queue.len() < wanted_frames * block_align
            && std::time::Instant::now() < deadline
            && !halt.load(std::sync::atomic::Ordering::Relaxed)
        {
            if capture.read_from_device_to_deque(&mut queue).is_err() {
                break;
            }
            if reported_at.elapsed() >= report_every {
                reported_at = std::time::Instant::now();
                // Only what arrived since the last pass, taken from the back of
                // the queue rather than by walking it from the front.
                let fresh: Vec<u8> = queue.range(handed_over..).copied().collect();
                handed_over = queue.len();
                if let Some(samples) = decode(&fresh, bits, &sample_type) {
                    let level = peak(&samples);
                    if let Ok(mut recorded) = shared.lock() {
                        recorded.samples.extend_from_slice(&samples);
                    }
                    let through = started.elapsed().as_secs_f32() / seconds as f32;
                    on_level(level, through.clamp(0.0, 1.0));
                }
            }
            // Half the device period: often enough that the ring buffer never
            // overruns, rarely enough that this is not a spin.
            std::thread::sleep(std::time::Duration::from_micros(
                (default_period as u64 / 20).clamp(1_000, 10_000),
            ));
        }
        let _ = client.stop_stream();

        // Whatever is still in the queue belongs to the recording too.
        let fresh: Vec<u8> = queue.range(handed_over..).copied().collect();
        if let Some(samples) = decode(&fresh, bits, &sample_type) {
            if let Ok(mut recorded) = shared.lock() {
                recorded.samples.extend_from_slice(&samples);
            }
        } else if handed_over == 0 {
            return Err(format!(
                "This device records in a format ({bits}-bit {sample_type}) that cannot be read."
            ));
        }
        on_level(0.0, 1.0);
        Ok(())
    });

    Ok(Recording {
        recorded,
        stop,
        worker: Some(worker),
    })
}

#[cfg(not(windows))]
pub fn start(_source_id: &str, _seconds: u32, _on_level: OnLevel) -> Result<Recording, String> {
    Err("Recording is only implemented for Windows.".into())
}

/// Writes what has been recorded so far, refusing a clip with nothing in it.
pub fn write_clip(
    samples: &[f32],
    rate: u32,
    channels: u16,
    destination: &std::path::Path,
) -> Result<(), String> {
    // An idle playback endpoint hands over no buffers at all, rather than
    // buffers of zeroes, so "nothing arrived" and "all of it was silence" are
    // the same situation to whoever has to fix it.
    if samples.is_empty() || peak(samples) < SILENCE_PEAK {
        return Err(NOTHING_HEARD.into());
    }
    write_wav_at(samples, rate, channels, destination)
        .map_err(|error| format!("Could not write the clip: {error}"))
}

/// Turns a device's raw bytes into samples between -1 and 1.
///
/// Shared mode is nearly always 32-bit float, but a device is entitled to hand
/// over 16- or 32-bit integers, and one that does should record rather than
/// fail. Anything else is refused by name instead of being read as noise.
pub fn decode(bytes: &[u8], bits: usize, sample_type: &SampleKind) -> Option<Vec<f32>> {
    match (bits, sample_type) {
        (32, SampleKind::Float) => Some(
            bytes
                .chunks_exact(4)
                .map(|chunk| f32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]))
                .collect(),
        ),
        (32, SampleKind::Int) => Some(
            bytes
                .chunks_exact(4)
                .map(|chunk| {
                    i32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]) as f32
                        / i32::MAX as f32
                })
                .collect(),
        ),
        (16, SampleKind::Int) => Some(
            bytes
                .chunks_exact(2)
                .map(|chunk| i16::from_le_bytes([chunk[0], chunk[1]]) as f32 / i16::MAX as f32)
                .collect(),
        ),
        _ => None,
    }
}

/// The sample layouts this module knows how to read.
///
/// Its own enum rather than the library's, so the decoder can be tested on a
/// machine with no sound card at all.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum SampleKind {
    Float,
    Int,
}

impl std::fmt::Display for SampleKind {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SampleKind::Float => write!(formatter, "float"),
            SampleKind::Int => write!(formatter, "integer"),
        }
    }
}

#[cfg(windows)]
impl From<wasapi::SampleType> for SampleKind {
    fn from(value: wasapi::SampleType) -> Self {
        match value {
            wasapi::SampleType::Float => SampleKind::Float,
            wasapi::SampleType::Int => SampleKind::Int,
        }
    }
}

pub fn peak(samples: &[f32]) -> f32 {
    samples.iter().fold(0.0_f32, |worst, sample| worst.max(sample.abs()))
}

/// Writes float samples as 16-bit PCM, which every recogniser reads.
pub fn write_wav_at(
    samples: &[f32],
    rate: u32,
    channels: u16,
    destination: &std::path::Path,
) -> Result<(), String> {
    if channels == 0 || rate == 0 {
        return Err("That device reported a sound format with no channels.".into());
    }
    if let Some(parent) = destination.parent() {
        std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let spec = hound::WavSpec {
        channels,
        sample_rate: rate,
        bits_per_sample: 16,
        sample_format: hound::SampleFormat::Int,
    };
    let mut writer =
        hound::WavWriter::create(destination, spec).map_err(|error| error.to_string())?;
    for sample in samples {
        // Clamped before scaling: a sample above 1.0 would wrap to a loud click
        // rather than clip, which is exactly the artefact a recogniser trips on.
        let clamped = sample.clamp(-1.0, 1.0);
        writer
            .write_sample((clamped * i16::MAX as f32) as i16)
            .map_err(|error| error.to_string())?;
    }
    writer.finalize().map_err(|error| error.to_string())
}

#[cfg(windows)]
fn describe(error: wasapi::WasapiError, what: &str) -> String {
    format!("Could not {what}: {error}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn measures_the_loudest_sample_regardless_of_sign() {
        assert_eq!(peak(&[0.0, -0.8, 0.3]), 0.8);
        assert_eq!(peak(&[]), 0.0);
    }

    #[test]
    fn treats_a_flat_line_as_silence() {
        assert!(peak(&[0.0; 64]) < SILENCE_PEAK);
        assert!(peak(&[0.0, 0.5]) >= SILENCE_PEAK);
    }

    #[test]
    fn writes_a_wav_a_reader_can_open_again() {
        let directory = std::env::temp_dir().join("tools4devs-audio-test");
        let _ = std::fs::create_dir_all(&directory);
        let path = directory.join("clip.wav");
        let samples: Vec<f32> = (0..SAMPLE_RATE * CHANNELS)
            .map(|index| ((index as f32) / 40.0).sin() * 0.5)
            .collect();
        write_wav_at(&samples, SAMPLE_RATE as u32, CHANNELS as u16, &path).expect("the clip should be written");

        let reader = hound::WavReader::open(&path).expect("the clip should be readable");
        assert_eq!(reader.spec().sample_rate, SAMPLE_RATE as u32);
        assert_eq!(reader.spec().channels, CHANNELS as u16);
        assert_eq!(reader.len() as usize, samples.len());
        let _ = std::fs::remove_file(&path);
    }

    /// Needs a real sound card, so it is not part of the ordinary run.
    /// `cargo test -- --ignored lists_the_machines_own_sound_devices`
    #[test]
    #[ignore = "requires audio hardware"]
    #[cfg(windows)]
    fn lists_the_machines_own_sound_devices() {
        let sources = list_sources().expect("the devices should be listable");
        assert!(!sources.is_empty(), "a machine with sound has sources");
        for source in &sources {
            println!(
                "  [{}]{} {}",
                source.kind,
                if source.is_default { " (default)" } else { "" },
                source.label
            );
        }
        assert!(
            sources.iter().any(|source| source.kind == "playback"),
            "there is always something to play sound out of"
        );
        for source in &sources {
            assert!(!source.id.is_empty());
            assert!(!source.label.is_empty());
            assert!(matches!(source.kind.as_str(), "playback" | "microphone"));
        }
        // The default of each kind sorts to the front of its own group.
        for kind in ["microphone", "playback"] {
            let group: Vec<_> = sources.iter().filter(|s| s.kind == kind).collect();
            if group.iter().any(|source| source.is_default) {
                assert!(group[0].is_default, "the default {kind} should sort first");
            }
        }
    }

    /// Plays a tone into a device and records that same device back.
    ///
    /// This is the whole loopback claim in one test: if what the machine is
    /// playing can be recorded, a tone rendered here comes back above the
    /// silence floor. It prefers a playback device that is *not* the default,
    /// so it can run without anything being audible in the room.
    ///
    /// `cargo test -- --ignored --nocapture captures_what_is_played_into_a_device`
    #[test]
    #[ignore = "requires audio hardware"]
    #[cfg(windows)]
    fn captures_what_is_played_into_a_device() {
        let sources = list_sources().expect("the devices should be listable");
        let playback: Vec<_> = sources
            .iter()
            .filter(|source| source.kind == "playback")
            .collect();
        let device = playback
            .iter()
            .find(|source| !source.is_default)
            .or_else(|| playback.first())
            .expect("a playback device");
        println!("playing into and recording from: {}", device.label);

        let playing = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(true));
        let stop = playing.clone();
        let id = device.id.clone();
        let player = std::thread::spawn(move || play_tone(&id, &stop));

        // A moment for the render stream to actually start before recording.
        std::thread::sleep(std::time::Duration::from_millis(400));
        let path = std::env::temp_dir().join("tools4devs-loopback-test.wav");
        let reports = std::sync::Arc::new(std::sync::atomic::AtomicUsize::new(0));
        let loudest = std::sync::Arc::new(std::sync::Mutex::new(0.0_f32));
        let counted = reports.clone();
        let peaked = loudest.clone();
        let recording = start(
            &device.id,
            3,
            std::sync::Arc::new(move |level, through| {
                counted.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                let mut peaked = peaked.lock().unwrap();
                *peaked = peaked.max(level);
                assert!((0.0..=1.0).contains(&through), "progress stays in range");
            }),
        )
        .expect("the device should open");

        // The point of the handle: what has arrived can be read before the
        // recording is over, which is what lets a lookup start early.
        std::thread::sleep(std::time::Duration::from_millis(900));
        let early = recording.so_far().expect("something by now");
        assert!(!early.0.is_empty(), "sound is readable while still recording");
        assert!(recording.running(), "and the recording is still going");

        recording.finish().expect("the tone should come back");
        playing.store(false, std::sync::atomic::Ordering::Relaxed);
        player.join().expect("the player should not panic").expect("the tone should play");

        // The window is told what is arriving while it arrives, not afterwards.
        assert!(
            reports.load(std::sync::atomic::Ordering::Relaxed) > 10,
            "three seconds should report many times"
        );
        assert!(*loudest.lock().unwrap() > SILENCE_PEAK, "and report the tone");

        let (samples, rate, channels) = early;
        write_clip(&samples, rate, channels, &path).expect("a clip with sound in it");

        let mut reader = hound::WavReader::open(&path).expect("readable");
        let samples: Vec<f32> = reader
            .samples::<i16>()
            .map(|sample| sample.unwrap() as f32 / i16::MAX as f32)
            .collect();
        let frames = samples.len() / CHANNELS;
        assert!(
            frames as f32 > SAMPLE_RATE as f32 * 0.5,
            "read after most of a second, {frames} frames captured"
        );
        println!("captured {frames} frames, peak {:.3}", peak(&samples));
        assert!(
            peak(&samples) > SILENCE_PEAK,
            "the tone should be audible in the recording"
        );
        let _ = std::fs::remove_file(&path);
    }

    /// Plays a WAV into one device, for measuring how long a match takes
    /// without anything being audible in the room.
    ///
    /// `TOOLS4DEVS_PLAY=C:\clip.wav cargo test -- --ignored --nocapture plays_a_file_into_a_device`
    #[test]
    #[ignore = "plays a file named by TOOLS4DEVS_PLAY"]
    #[cfg(windows)]
    fn plays_a_file_into_a_device() {
        let Some(path) = std::env::var_os("TOOLS4DEVS_PLAY") else {
            println!("set TOOLS4DEVS_PLAY to a wav");
            return;
        };
        let mut reader = hound::WavReader::open(&path).expect("a readable wav");
        let spec = reader.spec();
        let samples: Vec<f32> = match spec.sample_format {
            hound::SampleFormat::Int => reader
                .samples::<i16>()
                .map(|s| s.unwrap() as f32 / i16::MAX as f32)
                .collect(),
            hound::SampleFormat::Float => reader.samples::<f32>().map(|s| s.unwrap()).collect(),
        };
        println!(
            "playing {:.1}s at {} Hz into the quietest device",
            samples.len() as f32 / (spec.sample_rate * spec.channels as u32) as f32,
            spec.sample_rate
        );

        let sources = list_sources().expect("devices");
        let playback: Vec<_> = sources.iter().filter(|s| s.kind == "playback").collect();
        let device = playback
            .iter()
            .find(|s| !s.is_default)
            .or_else(|| playback.first())
            .expect("a playback device");
        println!("device: {}", device.label);

        let keep_going = std::sync::atomic::AtomicBool::new(true);
        play_samples(&device.id, &samples, spec.channels as usize, &keep_going)
            .expect("it should play");
    }

    /// Renders a quiet sine into one device until told to stop.
    #[cfg(windows)]
    fn play_tone(
        device_id: &str,
        keep_going: &std::sync::atomic::AtomicBool,
    ) -> Result<(), String> {
        use wasapi::{Direction, SampleType, StreamMode, WaveFormat};

        let _ = wasapi::initialize_mta();
        let enumerator = wasapi::DeviceEnumerator::new().map_err(|e| e.to_string())?;
        let collection = enumerator
            .get_device_collection(&Direction::Render)
            .map_err(|e| e.to_string())?;
        let count = collection.get_nbr_devices().map_err(|e| e.to_string())?;
        let mut device = None;
        for index in 0..count {
            let candidate = collection
                .get_device_at_index(index)
                .map_err(|e| e.to_string())?;
            if candidate.get_id().ok().as_deref() == Some(device_id) {
                device = Some(candidate);
                break;
            }
        }
        let device = device.ok_or("the device went away")?;
        let mut client = device.get_iaudioclient().map_err(|e| e.to_string())?;
        let format = WaveFormat::new(32, 32, &SampleType::Float, SAMPLE_RATE, CHANNELS, None);
        let (default_period, _min) = client.get_device_period().map_err(|e| e.to_string())?;
        client
            .initialize_client(
                &format,
                &Direction::Render,
                &StreamMode::PollingShared {
                    autoconvert: true,
                    buffer_duration_hns: default_period,
                },
            )
            .map_err(|e| e.to_string())?;
        let render = client.get_audiorenderclient().map_err(|e| e.to_string())?;
        client.start_stream().map_err(|e| e.to_string())?;

        let mut phase = 0.0_f64;
        let step = std::f64::consts::TAU * 440.0 / SAMPLE_RATE as f64;
        while keep_going.load(std::sync::atomic::Ordering::Relaxed) {
            let frames = client
                .get_available_space_in_frames()
                .map_err(|e| e.to_string())? as usize;
            let mut block: VecDeque<u8> = VecDeque::with_capacity(frames * CHANNELS * 4);
            for _ in 0..frames {
                phase += step;
                // A third of full scale: unmistakable against the silence
                // floor, nowhere near clipping.
                let sample = ((phase.sin() * 0.3) as f32).to_le_bytes();
                for _ in 0..CHANNELS {
                    block.extend(sample);
                }
            }
            render
                .write_to_device_from_deque(frames, &mut block, None)
                .map_err(|e| e.to_string())?;
            std::thread::sleep(std::time::Duration::from_millis(5));
        }
        let _ = client.stop_stream();
        Ok(())
    }

    /// Renders prepared samples into one device, once through.
    #[cfg(windows)]
    fn play_samples(
        device_id: &str,
        samples: &[f32],
        source_channels: usize,
        keep_going: &std::sync::atomic::AtomicBool,
    ) -> Result<(), String> {
        use wasapi::{Direction, SampleType, StreamMode, WaveFormat};

        let _ = wasapi::initialize_mta();
        let enumerator = wasapi::DeviceEnumerator::new().map_err(|e| e.to_string())?;
        let collection = enumerator
            .get_device_collection(&Direction::Render)
            .map_err(|e| e.to_string())?;
        let count = collection.get_nbr_devices().map_err(|e| e.to_string())?;
        let mut device = None;
        for index in 0..count {
            let candidate = collection.get_device_at_index(index).map_err(|e| e.to_string())?;
            if candidate.get_id().ok().as_deref() == Some(device_id) {
                device = Some(candidate);
                break;
            }
        }
        let device = device.ok_or("the device went away")?;
        let mut client = device.get_iaudioclient().map_err(|e| e.to_string())?;
        let format = WaveFormat::new(32, 32, &SampleType::Float, SAMPLE_RATE, CHANNELS, None);
        let (default_period, _min) = client.get_device_period().map_err(|e| e.to_string())?;
        client
            .initialize_client(
                &format,
                &Direction::Render,
                &StreamMode::PollingShared {
                    autoconvert: true,
                    buffer_duration_hns: default_period,
                },
            )
            .map_err(|e| e.to_string())?;
        let render = client.get_audiorenderclient().map_err(|e| e.to_string())?;
        client.start_stream().map_err(|e| e.to_string())?;

        let mut at = 0usize;
        while at < samples.len() && keep_going.load(std::sync::atomic::Ordering::Relaxed) {
            let frames = client
                .get_available_space_in_frames()
                .map_err(|e| e.to_string())? as usize;
            let mut block: VecDeque<u8> = VecDeque::with_capacity(frames * CHANNELS * 4);
            for _ in 0..frames {
                // Mono to stereo, or stereo straight through.
                for channel in 0..CHANNELS {
                    let index = at + channel.min(source_channels - 1);
                    let value = samples.get(index).copied().unwrap_or(0.0);
                    block.extend(value.to_le_bytes());
                }
                at += source_channels;
            }
            render
                .write_to_device_from_deque(frames, &mut block, None)
                .map_err(|e| e.to_string())?;
            std::thread::sleep(std::time::Duration::from_millis(5));
        }
        let _ = client.stop_stream();
        Ok(())
    }

    #[test]
    fn refuses_a_clip_with_nothing_in_it() {
        let path = std::env::temp_dir().join("tools4devs-silent-test.wav");
        // Silence and an empty recording are the same problem to whoever has
        // to fix it, so they get the same sentence.
        assert_eq!(write_clip(&[], 44100, 2, &path).unwrap_err(), NOTHING_HEARD);
        assert_eq!(
            write_clip(&[0.0; 128], 44100, 2, &path).unwrap_err(),
            NOTHING_HEARD
        );
        assert!(write_clip(&[0.0, 0.6, -0.4], 44100, 1, &path).is_ok());
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn clips_rather_than_wrapping_a_sample_above_full_scale() {
        let directory = std::env::temp_dir().join("tools4devs-audio-test");
        let _ = std::fs::create_dir_all(&directory);
        let path = directory.join("hot.wav");
        write_wav_at(&[2.0, -2.0], SAMPLE_RATE as u32, CHANNELS as u16, &path).expect("the clip should be written");
        let mut reader = hound::WavReader::open(&path).expect("the clip should be readable");
        let samples: Vec<i16> = reader.samples::<i16>().map(|s| s.unwrap()).collect();
        assert_eq!(samples, vec![i16::MAX, -i16::MAX]);
        let _ = std::fs::remove_file(&path);
    }
}
