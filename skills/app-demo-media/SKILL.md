---
name: app-demo-media
description: Record a short product demo video of the tools4devs app (headless, smooth 60 fps cursor, intro and outro cards, a caption per chapter, transitions) and render a matching cover thumbnail, for LinkedIn or a release post. Use when asked for a demo video, a screen recording, a walkthrough clip, or a video cover/thumbnail of the app.
---

# App demo video and cover

Produces a 1080p 60 fps MP4 of someone using the app and a 1920x1080 PNG cover for it. Nothing touches the user's desktop: the web front runs in headless Chrome, driven over the DevTools protocol.

The style is a product-launch demo, built as the `video` skill's product demo workflow describes: a script, a screen recording, a programmatic HTML layer for titles, captions and transitions, captions always on (most social video plays muted), and export for the platform.

The finished video runs:
1. a fade in straight onto the app (an intro card in the cover's composition is available with `--intro`, off by default at the user's request);
2. the app in use, with the whole screen in frame, a cursor gliding at 60 fps and one caption per chapter;
3. a short dip through black between chapters;
4. an outro card with the link.

## How it works

1. **`record.mjs` drives the app and captures the page.**
   - The scenario sends real mouse and keyboard events, so hover states, dropdowns and file choosers behave as they would for a person.
   - The page is captured with `Page.startScreencast`, at 2560x1440 JPEG and about 30 fps.
   - The cursor is **not** drawn in the page. Its exact position is logged with a timestamp, along with the `zoom()` and `chapter()` marks the scenario sets.
2. **`compose.mjs` builds the video in two ffmpeg passes.**
   - **Pass 1** runs every output frame at 60 fps. It interpolates the cursor from the log and draws `cursor.png` there. It eases the camera towards the requested zoom and aims it at the cursor, then crops and scales to 1080p. The cursor and the camera move at a true 60 fps however fast the page was captured, which is what makes the motion look smooth.
   - **Pass 2** renders `overlay.html` with headless Chrome: the intro card, one transparent caption per chapter, and the outro card. Each caption fades in with a short rise after the transition clears and fades out before the next one. Then pass 2 joins intro, chapters and outro with `xfade`, with a fade at both ends.

   The programmatic layer is plain HTML rendered by the same Chrome, so it uses the app's fonts and colours with no extra dependency. The `video` skill suggests Hyperframes for this; it is a CLI built on puppeteer, sharp and esbuild that does the same thing, so it was not added.

## Steps

All commands run from the repo root. Chrome and ffmpeg must be installed. On this machine ffmpeg is not on PATH, so point the `FFMPEG` variable at it.

1. **Start the web front.** Use the `tools4devs-web` config in `.claude/launch.json`, which runs vite on 5180 with `--strictPort`.

2. **Record** into an output folder:

   ```bash
   node skills/app-demo-media/record.mjs demo-out http://localhost:5180/
   ```

   The script writes:
   - `cover.png`: a clean shot with no cursor, for the thumbnail;
   - `cursor.png`;
   - `timeline.json`;
   - `frames/`.

   If it stops with `Not found`, look at `demo-out/failure.png`.

3. **Compose**:

   ```bash
   FFMPEG=/path/to/ffmpeg.exe node skills/app-demo-media/compose.mjs demo-out
   ```

   The defaults are `--speed 1.5` and `--transition fadeblack`, which turn about 90 s of recording into about 60 s. The result is `demo-out/demo.mp4`. `--zoom` turns on the camera zooms from the scenario's `zoom()` marks. They are off by default: the user found them too busy, and the whole screen reads better.

4. **Check it.** Look at a contact sheet, the last two seconds and a frame in the middle of a transition:

   ```bash
   ffmpeg -y -i demo-out/demo.mp4 -vf "fps=1/2.4,scale=640:-1,tile=4x6" -frames:v 1 demo-out/sheet.png
   ```

5. **Render the cover.** Copy the template and its assets next to `cover.png`, then screenshot it:

   ```bash
   cp skills/app-demo-media/thumb.html demo-out/
   cp "../toolhaven-desktop-landing/assets/fonts/"inter-tight-*.woff2 "../toolhaven-desktop-landing/assets/tools4devs-mark.svg" "../toolhaven-desktop-landing/assets/wordmark-dark.svg" demo-out/
   chrome --headless=new --disable-gpu --hide-scrollbars --allow-file-access-from-files \
     --force-device-scale-factor=1 --window-size=1920,1080 --virtual-time-budget=3000 \
     --screenshot="$(pwd)/demo-out/tools4devs-thumb.png" "file:///$(pwd)/demo-out/thumb.html"
   ```

## Writing a scenario

The scenario is the `scene()` function in `record.mjs`.

| Helper | Does |
|---|---|
| `chapter(label, caption)` | starts a chapter; `compose.mjs` puts a transition here and shows `caption`, with `<b>` for the blue part |
| `zoom(level)` | camera target from this moment: `1` is the whole screen, `1.3` to `1.8` closes in and follows the cursor |
| `clickOn(finder)`, `hover(finder)` | eased move (and click); scrolls the element into view first |
| `byText(text, rootSelector?)` | the smallest visible element whose first line of text is `text` |
| `bySel(css)`, `card(title)`, `cardOpen(title)`, `cardArt(title)`, `nthPlus(n)` | common targets |
| `type(text)`, `selectAll()`, `key(...)`, `scroll(dy)` | keyboard and wheel |

Camera guidance, for when `--zoom` is used:
- Zoom in when the eye needs one area: the search box, a panel's controls, a result. Zoom back to `1` before closing a panel or moving between catalog rows, so the viewer sees where they are.
- Don't zoom while both sides of a split layout matter, like the post mockup's form and its preview. Zoom on the result at the end.
- End on a zoomed hold of a strong result for about 4 seconds of real time.

## Script and captions

Write the captions as the story a muted viewer reads: what they can do, not what is on screen. Keep each one to a line, about 6 to 10 words, with the payoff in `<b>`. The intro and outro text lives in `overlay.html`.

## The cover's look

Keep it quiet so it doesn't look generated:
- The app's own near-black and the brand blue `#5bc0eb`, plus two soft radial glows.
- Inter Tight with tight tracking.
- The dot grid from the app's card artwork.
- A real screenshot turned slightly away and running off the right edge.
- One line of copy and three pills with facts.
- No floating widgets over the screenshot. A tweet card was tried and rejected.

## Lessons from the first recordings

- **Screencast size.** The screencast ignores an emulated device scale factor and sends frames in CSS pixels. Chrome has to be started with `--force-device-scale-factor` to get 2560x1440.
- **PNG vs JPEG.** At 2560x1440, PNG frames drop the capture to about 18 fps. JPEG at quality 92 keeps it near 30 with no visible loss.
- **Colour range.** JPEG frames are full range. Convert to TV range (`in_range=pc:out_range=tv`), or players show washed-out blacks.
- **No frames while idle.** Chrome sends a frame only when the page changes. Moving only the cursor sends nothing, so the last frame is held until `timeline.end`, otherwise the ending is cut off.
- **Crossfades.** Crossfading a continuous take into itself shows two cursors and two zoom levels. `fadeblack` doesn't have that problem.
- **Open panels.** Closing a panel with typed or uploaded content asks "Discard this work?". Press "Limpar" first, or end on that panel.
- **Dropdowns near the bottom.** A dropdown near the bottom of a modal is clipped, so the click lands on the backdrop and closes the modal. Scroll first. `at()` also scrolls off-screen targets into view before clicking.
- **Web mode.** There is no native host: downloadable tools show "Baixar", not "Pronto", and native-only features can't be shown.
- **CSS specificity in `overlay.html`.** A class that sets `display` beats `[data-mode] { display: none }` when it comes later, and a full-screen card then covers every render. Only the script sets `display`.
- **Separate Chrome renders.** Each render needs its own `--user-data-dir`. Otherwise Chrome hands every call to one browser, which renders them all as the last page it loaded.
- **Language and theme.** Set them through `localStorage` (`toolhaven.language`, `toolhaven.theme-preference`) before navigating.
- **Address.** Use `localhost`, not `127.0.0.1`: vite listens on IPv6.
