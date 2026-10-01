/// Paints the native title bar with the colours the interface sends, so it matches
/// the sidebar beneath it. The controls, snapping and dragging stay the system's own.
///
/// Only Windows 11 honours these attributes. Windows 10 refuses them and keeps its
/// default bar, which is why a refusal is not reported as an error.
#[tauri::command]
pub fn paint_title_bar(window: tauri::WebviewWindow, background: [u8; 3], text: [u8; 3]) {
    #[cfg(windows)]
    {
        use windows::Win32::Foundation::{COLORREF, HWND};
        use windows::Win32::Graphics::Dwm::{DwmSetWindowAttribute, DWMWA_CAPTION_COLOR, DWMWA_TEXT_COLOR};

        let Ok(handle) = window.hwnd() else { return };
        let hwnd = HWND(handle.0);
        for (attribute, rgb) in [(DWMWA_CAPTION_COLOR, background), (DWMWA_TEXT_COLOR, text)] {
            let color = colorref(rgb);
            let _ = unsafe {
                DwmSetWindowAttribute(
                    hwnd,
                    attribute,
                    (&color as *const COLORREF).cast(),
                    std::mem::size_of::<COLORREF>() as u32,
                )
            };
        }
    }
    #[cfg(not(windows))]
    let _ = (window, background, text);
}

/// Windows stores colours as 0x00BBGGRR.
#[cfg(windows)]
fn colorref([red, green, blue]: [u8; 3]) -> windows::Win32::Foundation::COLORREF {
    windows::Win32::Foundation::COLORREF(u32::from(red) | u32::from(green) << 8 | u32::from(blue) << 16)
}

#[cfg(all(test, windows))]
mod tests {
    #[test]
    fn packs_red_in_the_low_byte() {
        assert_eq!(super::colorref([0x12, 0x34, 0x56]).0, 0x0056_3412);
    }
}
