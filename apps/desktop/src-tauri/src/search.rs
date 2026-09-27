//! Looking a picture up on the search engines that index pictures.
//!
//! This is the first thing in the product that sends a file off the machine, so
//! it is worth being exact about what it does. It performs the one step a
//! browser cannot do for a file sitting on your disk — the upload — and then
//! hands the resulting address to your browser. It does not read the results,
//! scrape them, or keep anything. What comes back is a URL, and the browser does
//! the rest, signed in as you, with your own cookies and your own ad blocker.
//!
//! Engines that can search from an address instead take one directly, and those
//! upload nothing at all.

use std::path::Path;

/// Chrome's string, because Lens answers a bare client with a consent page.
const USER_AGENT: &str =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) \
     Chrome/140.0.0.0 Safari/537.36";

/// Lens rejects very large uploads, and sending 60 MB to find out is rude to
/// both ends. Well above any screenshot or camera JPEG.
const MAX_UPLOAD_BYTES: u64 = 20 * 1024 * 1024;

/// An engine, and whether it can be reached without uploading anything.
#[derive(Debug, Clone, serde::Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SearchEngine {
    pub id: String,
    pub label: String,
    /// True when the engine needs the picture itself, false when a link is enough.
    pub uploads: bool,
}

pub fn engines() -> Vec<SearchEngine> {
    [
        ("google", "Google Lens", true),
        ("yandex", "Yandex", false),
        ("bing", "Bing", false),
        ("tineye", "TinEye", false),
    ]
    .into_iter()
    .map(|(id, label, uploads)| SearchEngine {
        id: id.into(),
        label: label.into(),
        uploads,
    })
    .collect()
}

/// Percent-encodes a value for a query string.
///
/// Written out rather than pulled in: one unreserved-character rule is smaller
/// than a dependency, and getting it wrong is visible immediately.
pub fn encode(value: &str) -> String {
    let mut encoded = String::with_capacity(value.len());
    for byte in value.as_bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                encoded.push(*byte as char)
            }
            _ => encoded.push_str(&format!("%{byte:02X}")),
        }
    }
    encoded
}

/// The address that searches for a picture already published at `image_url`.
pub fn url_search(engine: &str, image_url: &str) -> Result<String, String> {
    let trimmed = image_url.trim();
    if !(trimmed.starts_with("http://") || trimmed.starts_with("https://")) {
        return Err("That is not a web address. It has to start with http:// or https://.".into());
    }
    let encoded = encode(trimmed);
    Ok(match engine {
        "google" => format!("https://lens.google.com/uploadbyurl?url={encoded}"),
        "yandex" => format!("https://yandex.com/images/search?rpt=imageview&url={encoded}"),
        "bing" => format!("https://www.bing.com/images/search?view=detailv2&iss=sbi&q=imgurl:{encoded}"),
        "tineye" => format!("https://tineye.com/search?url={encoded}"),
        other => return Err(format!("{other} is not one of the search engines offered.")),
    })
}

/// The media type for an extension, for the upload's own headers.
pub fn mime_for(path: &Path) -> &'static str {
    match path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_ascii_lowercase()
        .as_str()
    {
        "png" => "image/png",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "bmp" => "image/bmp",
        "tif" | "tiff" => "image/tiff",
        _ => "image/jpeg",
    }
}

/// Builds a `multipart/form-data` body holding one file.
///
/// Returned with its content type, because the boundary appears in both and the
/// two going out of step is a silent 400.
pub fn multipart(
    boundary: &str,
    field: &str,
    filename: &str,
    mime: &str,
    bytes: &[u8],
) -> (String, Vec<u8>) {
    let mut body = Vec::with_capacity(bytes.len() + 256);
    body.extend_from_slice(
        format!(
            "--{boundary}\r\nContent-Disposition: form-data; name=\"{field}\"; \
             filename=\"{filename}\"\r\nContent-Type: {mime}\r\n\r\n"
        )
        .as_bytes(),
    );
    body.extend_from_slice(bytes);
    body.extend_from_slice(format!("\r\n--{boundary}--\r\n").as_bytes());
    (
        format!("multipart/form-data; boundary={boundary}"),
        body,
    )
}

/// A boundary that cannot appear inside the file it delimits.
fn boundary() -> String {
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|elapsed| elapsed.subsec_nanos())
        .unwrap_or(0);
    format!("----tools4devsBoundary{nanos:08x}{:08x}", std::process::id())
}

/// Uploads a local picture to Google Lens and returns where to read the results.
pub fn upload_to_lens(path: &Path) -> Result<String, String> {
    let metadata = std::fs::metadata(path)
        .map_err(|_| "That file no longer exists.".to_string())?;
    if metadata.len() == 0 {
        return Err("That file is empty.".into());
    }
    if metadata.len() > MAX_UPLOAD_BYTES {
        return Err(format!(
            "That picture is {:.0} MB. Lens takes up to {} MB — shrink it first with the \
             image tools.",
            metadata.len() as f64 / (1024.0 * 1024.0),
            MAX_UPLOAD_BYTES / (1024 * 1024)
        ));
    }
    let bytes = std::fs::read(path).map_err(|error| format!("Could not read that file: {error}"))?;
    let filename = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("image");
    let (content_type, body) = multipart(
        &boundary(),
        "encoded_image",
        filename,
        mime_for(path),
        &bytes,
    );

    // The redirect is the answer, so it must not be followed: following it
    // downloads a results page we have no use for and throws away the address.
    let agent = ureq::AgentBuilder::new()
        .redirects(0)
        .timeout(std::time::Duration::from_secs(45))
        .build();
    let response = agent
        .post("https://lens.google.com/v3/upload?stcs=1")
        .set("Content-Type", &content_type)
        .set("User-Agent", USER_AGENT)
        .send_bytes(&body)
        .map_err(|error| match error {
            ureq::Error::Status(code, _) => format!(
                "Google Lens refused the upload (HTTP {code}). Try again in a moment."
            ),
            ureq::Error::Transport(transport) => {
                format!("Could not reach Google Lens: {transport}")
            }
        })?;

    results_url(response.status(), response.header("location")).ok_or_else(|| {
        "Google Lens accepted the picture but did not say where the results are. \
         This usually means the service changed; try another engine."
            .to_string()
    })
}

/// Reads the results address out of the upload's response.
pub fn results_url(status: u16, location: Option<&str>) -> Option<String> {
    if !(300..400).contains(&status) {
        return None;
    }
    let location = location?.trim();
    if location.starts_with("http://") || location.starts_with("https://") {
        Some(location.to_string())
    } else if let Some(path) = location.strip_prefix('/') {
        // A relative Location is legal, and Lens has used one before.
        Some(format!("https://www.google.com/{path}"))
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encodes_everything_a_url_would_otherwise_break_on() {
        assert_eq!(encode("a b"), "a%20b");
        assert_eq!(encode("x?y=z&w"), "x%3Fy%3Dz%26w");
        assert_eq!(encode("safe-._~9"), "safe-._~9");
        assert_eq!(encode("https://a.test/i.png"), "https%3A%2F%2Fa.test%2Fi.png");
    }

    #[test]
    fn builds_a_search_address_for_each_engine() {
        for engine in ["google", "yandex", "bing", "tineye"] {
            let url = url_search(engine, "https://example.test/cat.jpg").unwrap();
            assert!(url.starts_with("https://"), "{engine} produced {url}");
            assert!(
                url.contains("https%3A%2F%2Fexample.test%2Fcat.jpg"),
                "{engine} did not carry the encoded address: {url}"
            );
        }
    }

    #[test]
    fn refuses_an_engine_it_does_not_know_and_an_address_that_is_not_one() {
        assert!(url_search("askjeeves", "https://a.test/i.png").is_err());
        assert!(url_search("yandex", "C:/pictures/cat.jpg").is_err());
        assert!(url_search("yandex", "javascript:alert(1)").is_err());
    }

    #[test]
    fn wraps_the_file_in_a_body_whose_boundary_matches_its_header() {
        let (content_type, body) = multipart("XBOUND", "encoded_image", "c.png", "image/png", b"\x89PNG");
        assert_eq!(content_type, "multipart/form-data; boundary=XBOUND");
        let text = String::from_utf8_lossy(&body);
        assert!(text.starts_with("--XBOUND\r\n"));
        assert!(text.contains("name=\"encoded_image\"; filename=\"c.png\""));
        assert!(text.contains("Content-Type: image/png"));
        assert!(text.ends_with("\r\n--XBOUND--\r\n"));
        // The bytes have to survive intact, headers either side of them.
        assert!(body.windows(4).any(|window| window == b"\x89PNG"));
    }

    #[test]
    fn names_the_media_type_from_the_extension_and_guesses_jpeg_otherwise() {
        assert_eq!(mime_for(Path::new("a.PNG")), "image/png");
        assert_eq!(mime_for(Path::new("a.webp")), "image/webp");
        assert_eq!(mime_for(Path::new("a.tiff")), "image/tiff");
        assert_eq!(mime_for(Path::new("a.jpg")), "image/jpeg");
        assert_eq!(mime_for(Path::new("noextension")), "image/jpeg");
    }

    #[test]
    fn reads_the_results_address_only_out_of_a_redirect() {
        assert_eq!(
            results_url(303, Some("https://www.google.com/search?vsrid=abc")),
            Some("https://www.google.com/search?vsrid=abc".into())
        );
        assert_eq!(
            results_url(302, Some("/search?vsrid=abc")),
            Some("https://www.google.com/search?vsrid=abc".into())
        );
        assert_eq!(results_url(200, Some("https://www.google.com/x")), None);
        assert_eq!(results_url(303, None), None);
        assert_eq!(results_url(303, Some("javascript:alert(1)")), None);
    }

    #[test]
    fn boundaries_do_not_repeat_within_a_run() {
        let first = boundary();
        std::thread::sleep(std::time::Duration::from_millis(2));
        assert_ne!(first, boundary());
    }

    #[test]
    fn offers_only_engines_that_can_be_searched() {
        let engines = engines();
        assert_eq!(engines.len(), 4);
        for engine in &engines {
            assert!(url_search(&engine.id, "https://a.test/i.png").is_ok());
        }
        // Exactly one engine takes an upload, and the interface leans on that.
        assert_eq!(engines.iter().filter(|engine| engine.uploads).count(), 1);
    }
}
