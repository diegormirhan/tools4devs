/// Opens the Windows 11 snap layouts for this window, as hovering the system's own
/// maximise button does. The window draws its own buttons, and Windows only offers the
/// layouts over a button it drew; Win+Z is the system's own shortcut for the same menu.
///
/// Only sent while the window has the focus, since Win+Z acts on the foreground window.
#[tauri::command]
pub fn show_snap_layouts(window: tauri::WebviewWindow) {
    #[cfg(windows)]
    {
        use windows::Win32::UI::Input::KeyboardAndMouse::{
            SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYBD_EVENT_FLAGS, KEYEVENTF_KEYUP, VIRTUAL_KEY, VK_LWIN,
        };

        if !window.is_focused().unwrap_or(false) {
            return;
        }
        let key = |code: VIRTUAL_KEY, flags: KEYBD_EVENT_FLAGS| INPUT {
            r#type: INPUT_KEYBOARD,
            Anonymous: INPUT_0 { ki: KEYBDINPUT { wVk: code, dwFlags: flags, ..Default::default() } },
        };
        let z = VIRTUAL_KEY(u16::from(b'Z'));
        // One call, so nothing typed in between can land while the Windows key is down.
        let inputs = [
            key(VK_LWIN, KEYBD_EVENT_FLAGS(0)),
            key(z, KEYBD_EVENT_FLAGS(0)),
            key(z, KEYEVENTF_KEYUP),
            key(VK_LWIN, KEYEVENTF_KEYUP),
        ];
        unsafe { SendInput(&inputs, std::mem::size_of::<INPUT>() as i32) };
    }
    #[cfg(not(windows))]
    let _ = window;
}
