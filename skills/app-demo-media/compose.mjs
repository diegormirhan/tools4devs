// Turns a recording from record.mjs into the finished video.
//
//   Pass 1: the page at 60 fps with the cursor drawn smoothly on top (and,
//           with --zoom, a camera that follows it).
//   Pass 2: an intro card, each chapter with its caption, an outro card,
//           joined by transitions. The cards and captions are HTML
//           (overlay.html) rendered by headless Chrome, so they share the
//           app's fonts and colours.
//
//   node skills/app-demo-media/compose.mjs [outDir] [--speed 1.5] [--transition fadeblack] [--zoom] [--intro]
//
// Reads outDir/timeline.json and outDir/frames/list.txt; writes outDir/demo.mp4.
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const option = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };
const takesValue = (flag) => flag === "--speed" || flag === "--transition";
const out = path.resolve(args.find((a, i) => !a.startsWith("--") && !takesValue(args[i - 1])) ?? "demo-out");
const SPEED = Number(option("speed", "1.5"));
// Off by default: the whole screen stays in frame. --zoom follows the
// scenario's zoom() marks, which was tried and found too busy.
const ZOOM = args.includes("--zoom");
// fadeblack: a continuous take crossfaded into itself shows two cursors and
// two zoom levels at once; a quick dip through black does not.
const TRANSITION = option("transition", "fadeblack"); // any ffmpeg xfade type
const FADE = 0.5; // transition length, seconds
const FPS = 60;
const ffmpeg = process.env.FFMPEG ?? "ffmpeg";

const timeline = JSON.parse(readFileSync(path.join(out, "timeline.json"), "utf8"));
const { start, width: W, height: H } = timeline;
const frames = path.join(out, "frames");
const rawLength = readFileSync(path.join(frames, "list.txt"), "utf8")
  .split("\n").filter((l) => l.startsWith("duration")).reduce((sum, l) => sum + Number(l.split(" ")[1]), 0);
const length = rawLength / SPEED;

// ── Camera ───────────────────────────────────────────────────────────────
// Each output frame: where the camera wants to be (zoom level from the last
// zoom() mark, centred on the cursor), then an exponential ease towards it,
// so every change of zoom or aim glides instead of cutting.
const zoomAt = (t) => (ZOOM ? timeline.zoom.filter((z) => z.t <= t).at(-1)?.level ?? 1 : 1);
let cursorIndex = 0;
function cursorAt(t) {
  const c = timeline.cursor;
  if (!c.length || t <= c[0].t) return { x: W / 2, y: H / 2 };
  while (cursorIndex < c.length - 1 && c[cursorIndex + 1].t <= t) cursorIndex++;
  const a = c[cursorIndex], b = c[cursorIndex + 1];
  if (!b) return a;
  const k = Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t)));
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
}
const follow = (tau) => 1 - Math.exp(-1 / FPS / tau);
const even = (v) => Math.round(v / 2) * 2;
let zoom = 1, cx = W / 2, cy = H / 2;
let commands = "";
for (let i = 0; i < Math.ceil(length * FPS); i++) {
  const T = i / FPS;
  const raw = start + T * SPEED;
  const target = zoomAt(raw);
  const cursor = cursorAt(raw);
  // Zoomed out, the camera drifts back to the middle rather than the cursor.
  const aim = Math.min(1, Math.max(0, (target - 1) / 0.25));
  const tx = W / 2 + (cursor.x - W / 2) * aim;
  const ty = H / 2 + (cursor.y - H / 2) * aim;
  zoom += (target - zoom) * follow(0.38);
  cx += (tx - cx) * follow(0.3);
  cy += (ty - cy) * follow(0.3);
  const w = even(W / zoom), h = even(H / zoom);
  const x = even(Math.min(W - w, Math.max(0, cx - w / 2)));
  const y = even(Math.min(H - h, Math.max(0, cy - h / 2)));
  // The cursor.png tip sits at (10, 8).
  const pointer = `overlay@c x ${Math.round(cursor.x - 10)}, overlay@c y ${Math.round(cursor.y - 8)}`;
  commands += `${T.toFixed(4)} ${pointer}, crop@z x ${x}, crop@z y ${y}, crop@z w ${w}, crop@z h ${h};\n`;
}
const commandFile = path.join(out, "camera.txt");
writeFileSync(commandFile, commands);

const run = (argv) => execFileSync(ffmpeg, ["-y", "-loglevel", "error", ...argv], { stdio: "inherit" });
const zoomed = path.join(out, "zoomed.mp4");
console.log(`camera: ${Math.ceil(length * FPS)} frames, ${length.toFixed(1)}s at ${SPEED}x`);
// The page is captured at about 30 fps; the cursor and the camera are drawn
// here at 60, which is what makes the motion read as smooth.
const escaped = commandFile.replace(/\\/g, "/").replace(/:/g, "\\:");
run([
  "-f", "concat", "-safe", "0", "-i", path.join(frames, "list.txt"),
  "-loop", "1", "-i", path.join(out, "cursor.png"),
  "-filter_complex",
  `[0:v]setpts=(PTS-STARTPTS)/${SPEED},fps=${FPS},sendcmd=f='${escaped}'[page];` +
  `[1:v]format=rgba[pointer];` +
  `[page][pointer]overlay@c=x=0:y=0:shortest=1,crop@z=${W}:${H}:0:0,scale=1920:1080:flags=lanczos:in_range=pc:out_range=tv,format=yuv420p[v]`,
  "-map", "[v]", "-c:v", "libx264", "-preset", "medium", "-crf", "12", zoomed,
]);

// ── The programmatic layer ───────────────────────────────────────────────
const chrome = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  path.join(os.homedir(), "AppData\\Local\\Google\\Chrome\\Application\\chrome.exe"),
].filter(Boolean).find(existsSync);
if (!chrome) throw new Error("Chrome not found. Set CHROME_PATH.");
const layer = path.join(out, "overlay");
mkdirSync(layer, { recursive: true });
copyFileSync(path.join(here, "overlay.html"), path.join(layer, "overlay.html"));
copyFileSync(path.join(out, "cover.png"), path.join(layer, "cover.png"));
const landing = path.resolve(here, "../../../toolhaven-desktop-landing/assets");
for (const file of ["fonts/inter-tight-400.woff2", "fonts/inter-tight-500.woff2", "fonts/inter-tight-600.woff2", "tools4devs-mark.svg", "wordmark-dark.svg"]) {
  if (existsSync(path.join(landing, file))) copyFileSync(path.join(landing, file), path.join(layer, path.basename(file)));
}
// Each render gets its own profile: calls that share one are handed to the
// same browser, which renders them all as whichever page it loaded last.
function renderLayer(name, query) {
  const file = path.join(layer, `${name}.png`);
  const profile = path.join(os.tmpdir(), `app-demo-layer-${process.pid}-${name}`);
  const page = `file:///${path.join(layer, "overlay.html").replace(/\\/g, "/")}?${query}`;
  execFileSync(chrome, [
    "--headless=new", "--disable-gpu", "--hide-scrollbars", "--allow-file-access-from-files",
    `--user-data-dir=${profile}`, "--no-first-run",
    "--force-device-scale-factor=1", "--window-size=1920,1080", "--default-background-color=00000000",
    "--virtual-time-budget=2500", `--screenshot=${file}`, page,
  ], { stdio: "ignore" });
  rmSync(profile, { recursive: true, force: true });
  return file;
}

// ── Chapters, captions and transitions ───────────────────────────────────
const cuts = timeline.chapters.map((c) => (c.t - start) / SPEED).filter((t) => t > 1 && t < length - 1);
const bounds = [0, ...cuts, length];
const captionFor = (from) =>
  timeline.chapters.filter((c) => (c.t - start) / SPEED <= from + 1).at(-1)?.caption;

const INTRO = 2.6, OUTRO = 3.4, RISE = 26;
const inputs = [];
const parts = [];
let n = 0;
const card = (file, seconds) => {
  inputs.push("-loop", "1", "-framerate", String(FPS), "-t", String(seconds), "-i", file);
  parts.push(`[${n}:v]fps=${FPS},format=yuv420p,setsar=1[p${parts.length}]`);
  n++;
  return seconds;
};
// The intro card is opt-in: the video reads better opening straight on the
// app with a fade, and the cover already does the intro's job.
const durations = args.includes("--intro") ? [card(renderLayer("intro", "mode=intro"), INTRO)] : [];
for (let i = 0; i < bounds.length - 1; i++) {
  const d = bounds[i + 1] - bounds[i];
  durations.push(d);
  inputs.push("-ss", bounds[i].toFixed(3), "-t", d.toFixed(3), "-i", zoomed);
  const video = n++;
  const caption = captionFor(bounds[i]);
  const p = parts.length;
  if (!caption) { parts.push(`[${video}:v]setpts=PTS-STARTPTS,fps=${FPS},setsar=1[p${p}]`); continue; }
  inputs.push("-loop", "1", "-framerate", String(FPS), "-t", d.toFixed(3), "-i",
    renderLayer(`caption-${i}`, `mode=caption&text=${encodeURIComponent(caption)}`));
  const text = n++;
  // In after the transition has cleared, out before the next one starts, with
  // a short rise on the way in.
  const inAt = 0.55, outAt = Math.max(inAt + 0.5, d - 0.75);
  parts.push(
    `[${text}:v]format=rgba,fade=t=in:st=${inAt}:d=0.35:alpha=1,fade=t=out:st=${outAt.toFixed(3)}:d=0.3:alpha=1[c${p}];` +
    `[${video}:v]setpts=PTS-STARTPTS,fps=${FPS}[b${p}];` +
    `[b${p}][c${p}]overlay=x=0:y='${RISE}*max(0,1-max(0,t-${inAt})/0.4)':eval=frame,setsar=1[p${p}]`,
  );
}
durations.push(card(renderLayer("outro", "mode=outro"), OUTRO));

let graph = parts.join(";");
let last = "p0";
let offset = 0;
for (let i = 1; i < parts.length; i++) {
  offset += durations[i - 1] - FADE;
  graph += `;[${last}][p${i}]xfade=transition=${TRANSITION}:duration=${FADE}:offset=${offset.toFixed(3)}[x${i}]`;
  last = `x${i}`;
}
const finalLength = durations.reduce((a, b) => a + b, 0) - FADE * (parts.length - 1);
graph += `;[${last}]fade=t=in:st=0:d=0.5,fade=t=out:st=${(finalLength - 0.8).toFixed(3)}:d=0.8,format=yuv420p[v]`;
const result = path.join(out, "demo.mp4");
run([
  ...inputs, "-filter_complex", graph, "-map", "[v]", "-r", String(FPS),
  "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-profile:v", "high", "-color_range", "tv", "-movflags", "+faststart", result,
]);
rmSync(zoomed);
console.log(`${result}: ${finalLength.toFixed(1)}s, ${parts.length} parts, ${TRANSITION} transitions`);
