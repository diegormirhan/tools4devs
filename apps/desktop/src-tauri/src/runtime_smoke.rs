//! Opt-in contract tests against installed Windows tools, using only generated fixtures.
use super::*;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};

fn request(
    tool: &str,
    operation: &str,
    inputs: &[PathBuf],
    output: Option<PathBuf>,
    options: &[(&str, &str)],
) -> OperationRequest {
    OperationRequest {
        tool_id: tool.into(),
        operation_id: operation.into(),
        input_paths: inputs
            .iter()
            .map(|path| path.to_string_lossy().into_owned())
            .collect(),
        output_path: output.map(|path| path.to_string_lossy().into_owned()),
        options: options
            .iter()
            .map(|(key, value)| (key.to_string(), value.to_string()))
            .collect(),
        source_url: None,
        conflict_policy: None,
        job_id: None,
    }
}

fn run(request: OperationRequest) -> OperationResult {
    let label = format!("{}/{}", request.tool_id, request.operation_id);
    let result =
        execute_operation_inner(request).unwrap_or_else(|error| panic!("{label}: {error}"));
    if let Some(output) = &result.output_path {
        let metadata =
            std::fs::metadata(output).unwrap_or_else(|error| panic!("{label}: {output}: {error}"));
        assert!(
            metadata.is_dir() || metadata.len() > 0,
            "{label}: empty output"
        );
    }
    println!("PASS {label}");
    result
}

fn cli(executable: &str, args: &[&str]) -> String {
    let output = std::process::Command::new(resolve_executable(executable).unwrap())
        .args(args)
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "{}: {}",
        executable,
        String::from_utf8_lossy(&output.stderr)
    );
    String::from_utf8_lossy(&output.stdout).into_owned()
}

/// The suites added later are not on every machine yet. Instead of failing the whole
/// sweep, the test verifies what is installed and names what it could not check.
fn tool_available(tool_id: &str) -> bool {
    executable_name(tool_id)
        .and_then(|name| resolve_suite_executable(tool_id, &name))
        .is_ok()
}

fn create_pdf(path: &Path) {
    let objects = [
        "<< /Type /Catalog /Pages 2 0 R >>",
        "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << >> /Contents 4 0 R >>",
        "<< /Length 0 >>\nstream\n\nendstream",
    ];
    let mut pdf = String::from("%PDF-1.4\n");
    let mut offsets = Vec::new();
    for (index, object) in objects.iter().enumerate() {
        offsets.push(pdf.len());
        pdf.push_str(&format!("{} 0 obj\n{object}\nendobj\n", index + 1));
    }
    let xref = pdf.len();
    pdf.push_str("xref\n0 5\n0000000000 65535 f \n");
    for offset in offsets {
        pdf.push_str(&format!("{offset:010} 00000 n \n"));
    }
    pdf.push_str(&format!(
        "trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n"
    ));
    std::fs::write(path, pdf).unwrap();
}

#[test]
#[ignore = "Runs the catalog against the real Windows CLIs; skips tools that are not installed"]
fn every_catalog_operation_executes_on_generated_fixtures() {
    let root = std::env::temp_dir().join(format!(
        "tools4devs-smoke-{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis()
    ));
    std::fs::create_dir(&root).unwrap();
    println!("Fixtures: {}", root.display());
    let json = root.join("sample.json");
    std::fs::write(&json, r#"{"name":"tools4devs","count":2}"#).unwrap();
    let yaml = root.join("sample.yaml");
    std::fs::write(&yaml, "name: tools4devs\ncount: 2\n").unwrap();
    for (tool, input) in [("jq", json.clone()), ("yq", yaml)] {
        assert!(run(request(tool, "format", &[input.clone()], None, &[]))
            .stdout
            .contains("tools4devs"));
        assert!(
            run(request(
                tool,
                "query",
                &[input],
                None,
                &[("query", ".count")]
            ))
            .stdout
            .trim()
                == "2"
        );
    }
    assert!(run(request(
        "ripgrep",
        "search",
        &[root.clone()],
        None,
        &[("query", "tools4devs")]
    ))
    .stdout
    .contains("sample.json"));
    assert!(run(request(
        "ripgrep",
        "search",
        &[root.clone()],
        None,
        &[("query", "NoSuchFixtureValue9382")]
    ))
    .stdout
    .contains("No match found"));
    assert!(run(request(
        "fd",
        "find",
        &[root.clone()],
        None,
        &[("query", "sample")]
    ))
    .stdout
    .contains("sample.json"));
    assert!(run(request("deno", "runtime", &[], None, &[]))
        .stdout
        .contains("deno "));

    let archive = root.join("sample.zip");
    run(request(
        "7zip",
        "compress",
        &[json.clone()],
        Some(archive.clone()),
        &[],
    ));
    let extracted = root.join("extracted");
    run(request(
        "7zip",
        "extract",
        &[archive],
        Some(extracted.clone()),
        &[],
    ));
    assert_eq!(
        std::fs::read(extracted.join("sample.json")).unwrap(),
        std::fs::read(&json).unwrap()
    );
    let overwrite = execute_operation_inner(request(
        "7zip",
        "compress",
        &[json.clone()],
        Some(json),
        &[],
    ));
    assert!(overwrite.unwrap_err().contains("already exists"));
    let markdown = root.join("sample.md");
    std::fs::write(&markdown, "# tools4devs\n\nFixture document.\n").unwrap();
    let html = root.join("sample.html");
    run(request(
        "pandoc",
        "convert",
        &[markdown],
        Some(html.clone()),
        &[],
    ));
    assert!(std::fs::read_to_string(html).unwrap().contains("<h1"));

    let pdf = root.join("sample.pdf");
    create_pdf(&pdf);
    for operation in ["merge", "split", "rotate", "protect", "linearize"] {
        let output = root.join(format!("{operation}.pdf"));
        let inputs = if operation == "merge" {
            vec![pdf.clone(), pdf.clone()]
        } else {
            vec![pdf.clone()]
        };
        run(request(
            "qpdf",
            operation,
            &inputs,
            Some(output.clone()),
            &[("password", "fixture-only"), ("pages", "1")],
        ));
        let check = cli(
            "qpdf.exe",
            &[
                "--password=fixture-only",
                "--show-npages",
                output.to_str().unwrap(),
            ],
        );
        assert_eq!(check.trim(), if operation == "merge" { "2" } else { "1" });
    }

    let ppm = root.join("sample.ppm");
    let mut image = b"P6\n120 120\n255\n".to_vec();
    image.extend(vec![128_u8; 120 * 120 * 3]);
    std::fs::write(&ppm, image).unwrap();
    for (operation, extension, expected_width) in [
        ("resize", "png", 120),
        ("upscale", "png", 240),
        ("crop", "png", 100),
        ("compress", "jpg", 120),
        ("convert", "png", 120),
    ] {
        let output = root.join(format!("{operation}.{extension}"));
        run(request(
            "libvips",
            operation,
            &[ppm.clone()],
            Some(output.clone()),
            &[],
        ));
        let probe = cli(
            "ffprobe.exe",
            &[
                "-v",
                "quiet",
                "-of",
                "json",
                "-show_streams",
                output.to_str().unwrap(),
            ],
        );
        let data: serde_json::Value = serde_json::from_str(&probe).unwrap();
        assert_eq!(data["streams"][0]["width"], expected_width);
    }

    let video = root.join("sample.mp4");
    cli(
        "ffmpeg.exe",
        &[
            "-v",
            "error",
            "-f",
            "lavfi",
            "-i",
            "color=c=blue:s=160x120:r=10",
            "-f",
            "lavfi",
            "-i",
            "sine=frequency=440",
            "-t",
            "1",
            "-c:v",
            "mpeg4",
            "-c:a",
            "aac",
            video.to_str().unwrap(),
        ],
    );
    let mut skipped: Vec<&str> = Vec::new();
    let ffmpeg_operations: &[(&str, &str)] = if tool_available("ffmpeg") {
        &[("convert", "mkv"), ("extract-audio", "mp3"), ("compress", "mp4"), ("trim", "mp4")]
    } else {
        skipped.push("ffmpeg");
        &[]
    };
    for &(operation, extension) in ffmpeg_operations {
        let output = root.join(format!("{operation}.{extension}"));
        run(request(
            "ffmpeg",
            operation,
            &[video.clone()],
            Some(output.clone()),
            &[("end", "0.5")],
        ));
        let result = run(request("ffprobe", "inspect", &[output], None, &[]));
        let probe: serde_json::Value = serde_json::from_str(&result.stdout).unwrap();
        assert!(!probe["streams"].as_array().unwrap().is_empty());
        if operation == "extract-audio" {
            assert_eq!(probe["streams"][0]["codec_name"], "mp3");
        }
    }

    let server = FixtureServer::start(std::fs::read(&video).unwrap());
    for operation in ["inspect-url", "download-video", "download-audio"] {
        let output = match operation {
            "download-video" => Some(root.join("download.mp4")),
            "download-audio" => Some(root.join("download.mp3")),
            _ => None,
        };
        let mut input = request("yt-dlp", operation, &[], output, &[]);
        input.source_url = Some(server.url.clone());
        let result = run(input);
        if operation == "inspect-url" {
            assert!(serde_json::from_str::<serde_json::Value>(&result.stdout).is_ok());
        }
    }

    if tool_available("exiftool") {
        let photo = root.join("compress.jpg");
        assert!(
            run(request("exiftool", "inspect", &[photo.clone()], None, &[]))
                .stdout
                .contains("JPEG")
        );
        run(request(
            "exiftool",
            "strip",
            &[photo.clone()],
            Some(root.join("stripped.jpg")),
            &[],
        ));
        let titled = root.join("titled.jpg");
        run(request(
            "exiftool",
            "set-title",
            &[photo],
            Some(titled.clone()),
            &[("title", "Fixture tools4devs")],
        ));
        assert!(
            cli("exiftool.exe", &["-s3", "-Title", titled.to_str().unwrap()])
                .contains("Fixture tools4devs")
        );
        println!("PASS exiftool/inspect + strip + set-title");
    } else {
        skipped.push("exiftool");
    }

    if tool_available("imagemagick") {
        let converted = root.join("magick-convert.png");
        run(request(
            "imagemagick",
            "convert",
            &[ppm.clone()],
            Some(converted.clone()),
            &[],
        ));
        assert_eq!(
            cli(
                "magick.exe",
                &["identify", "-format", "%m", converted.to_str().unwrap()]
            )
            .trim(),
            "PNG"
        );
        let gray = root.join("magick-gray.png");
        run(request(
            "imagemagick",
            "grayscale",
            &[ppm.clone()],
            Some(gray.clone()),
            &[],
        ));
        assert_eq!(
            cli(
                "magick.exe",
                &[
                    "identify",
                    "-format",
                    "%[colorspace]",
                    gray.to_str().unwrap()
                ]
            )
            .trim(),
            "Gray"
        );
        assert!(
            run(request("imagemagick", "inspect", &[ppm.clone()], None, &[]))
                .stdout
                .contains("Geometry")
        );
        println!("PASS imagemagick/convert + grayscale + inspect");
    } else {
        skipped.push("imagemagick");
    }

    if tool_available("oxipng") {
        let source = root.join("convert.png");
        let optimised = root.join("optimised.png");
        run(request(
            "oxipng",
            "optimize",
            &[source.clone()],
            Some(optimised.clone()),
            &[("level", "2")],
        ));
        assert!(
            std::fs::metadata(&optimised).unwrap().len()
                <= std::fs::metadata(&source).unwrap().len()
        );
        println!("PASS oxipng/optimize");
    } else {
        skipped.push("oxipng");
    }

    if tool_available("poppler") {
        let text = root.join("sample.txt");
        run(request(
            "poppler",
            "extract-text",
            &[pdf.clone()],
            Some(text),
            &[],
        ));
        run(request(
            "poppler",
            "rasterize",
            &[pdf.clone()],
            Some(root.join("page.png")),
            &[("page", "1"), ("dpi", "72")],
        ));
        println!("PASS poppler/extract-text + rasterize");
    } else {
        skipped.push("poppler");
    }

    if tool_available("mkvtoolnix") {
        let mkv = root.join("remuxed.mkv");
        run(request(
            "mkvtoolnix",
            "remux",
            &[video.clone()],
            Some(mkv.clone()),
            &[],
        ));
        assert!(run(request("mkvtoolnix", "inspect", &[mkv], None, &[]))
            .stdout
            .contains("tracks"));
        println!("PASS mkvtoolnix/remux + inspect");
    } else {
        skipped.push("mkvtoolnix");
    }

    if tool_available("miller") {
        let csv = root.join("table.csv");
        std::fs::write(
            &csv,
            "name,count
tools4devs,2
Fixture,5
",
        )
        .unwrap();
        let as_json = run(request("miller", "to-json", &[csv.clone()], None, &[])).stdout;
        assert!(as_json.contains("\"name\": \"tools4devs\""), "{as_json}");
        let json = root.join("table.json");
        std::fs::write(&json, &as_json).unwrap();
        assert!(run(request("miller", "to-csv", &[json], None, &[]))
            .stdout
            .contains("name,count"));
        assert!(run(request("miller", "summary", &[csv], None, &[]))
            .stdout
            .contains("field_name"));
        println!("PASS miller/to-json + to-csv + summary");
    } else {
        skipped.push("miller");
    }

    if tool_available("hexyl") {
        let stdout = run(request(
            "hexyl",
            "preview",
            &[root.join("sample.json")],
            None,
            &[("length", "16")],
        ))
        .stdout;
        assert!(stdout.contains("7b"), "{stdout}");
        println!("PASS hexyl/preview");
    } else {
        skipped.push("hexyl");
    }

    if tool_available("tokei") {
        assert!(run(request("tokei", "count", &[root.clone()], None, &[]))
            .stdout
            .contains("Language"));
        println!("PASS tokei/count");
    } else {
        skipped.push("tokei");
    }

    if tool_available("difftastic") {
        let left = root.join("left.json");
        let right = root.join("right.json");
        std::fs::write(
            &left,
            "{\"a\": 1}
",
        )
        .unwrap();
        std::fs::write(
            &right,
            "{\"a\": 2}
",
        )
        .unwrap();
        assert!(
            !run(request("difftastic", "compare", &[left, right], None, &[]))
                .stdout
                .is_empty()
        );
        let single = execute_operation_inner(request(
            "difftastic",
            "compare",
            &[root.join("left.json")],
            None,
            &[],
        ));
        assert!(single.unwrap_err().contains("both files"));
        println!("PASS difftastic/compare");
    } else {
        skipped.push("difftastic");
    }

    if tool_available("dust") {
        assert!(!run(request(
            "dust",
            "usage",
            &[root.clone()],
            None,
            &[("depth", "1"), ("lines", "5")]
        ))
        .stdout
        .is_empty());
        println!("PASS dust/usage");
    } else {
        skipped.push("dust");
    }

    if skipped.is_empty() {
        println!("Every catalog operation passed against a real binary.");
    } else {
        println!(
            "Catalog operations passed for every installed tool. NOT VERIFIED (not installed): {}",
            skipped.join(", ")
        );
    }
    println!("Generated fixtures retained at {}", root.display());
}

struct FixtureServer {
    url: String,
    stop: Arc<AtomicBool>,
    thread: Option<std::thread::JoinHandle<()>>,
}
impl FixtureServer {
    fn start(bytes: Vec<u8>) -> Self {
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let url = format!("http://{}/sample.mp4", listener.local_addr().unwrap());
        listener.set_nonblocking(true).unwrap();
        let stop = Arc::new(AtomicBool::new(false));
        let stopping = stop.clone();
        let thread = std::thread::spawn(move || {
            while !stopping.load(Ordering::Relaxed) {
                if let Ok((mut stream, _)) = listener.accept() {
                    stream.set_nonblocking(false).unwrap();
                    stream
                        .set_read_timeout(Some(std::time::Duration::from_secs(2)))
                        .ok();
                    let mut request = Vec::new();
                    let mut chunk = [0; 1024];
                    while !request.windows(4).any(|part| part == b"\r\n\r\n")
                        && request.len() < 16384
                    {
                        match stream.read(&mut chunk) {
                            Ok(0) | Err(_) => break,
                            Ok(length) => request.extend_from_slice(&chunk[..length]),
                        }
                    }
                    let head = request.starts_with(b"HEAD ");
                    let header = format!("HTTP/1.1 200 OK\r\nContent-Type: video/mp4\r\nContent-Length: {}\r\nConnection: close\r\n\r\n", bytes.len());
                    stream.write_all(header.as_bytes()).ok();
                    if !head {
                        stream.write_all(&bytes).ok();
                    }
                } else {
                    std::thread::sleep(std::time::Duration::from_millis(10));
                }
            }
        });
        Self {
            url,
            stop,
            thread: Some(thread),
        }
    }
}
impl Drop for FixtureServer {
    fn drop(&mut self) {
        self.stop.store(true, Ordering::Relaxed);
        if let Some(thread) = self.thread.take() {
            thread.join().unwrap();
        }
    }
}
