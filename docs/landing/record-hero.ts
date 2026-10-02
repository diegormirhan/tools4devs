// Records the landing page's hero video: the real interface, driven by a script
// over the E2E test host, so it can be re-recorded after any UI change.
//
//   npx vite --config apps/desktop/vite.config.ts --port 5199 --strictPort --host 127.0.0.1
//   node docs/landing/record-hero.ts [pt|en ...]
//
// Writes docs/landing/out/hero-<lang>.{webm,mp4,webp} and hero-<lang>.json, the
// moments the landing page's callouts key on. Needs ffmpeg with libvpx-vp9 and
// libx264 on PATH (or FFMPEG=...).
//
// The host answers execute_operation the way the Rust side does for FFmpeg: one
// "starting" event, then "completed". FFmpeg reports no percentage there, so the
// video shows none either.
import { chromium, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { installHost } from "../../e2e/host.ts";

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, "out");
const FFMPEG = process.env.FFMPEG ?? "ffmpeg";
const URL = process.env.APP_URL ?? "http://127.0.0.1:5199/";
const FPS = 30;
const VIEW = { width: 1280, height: 860 };

const COPY = {
  pt: { query: "comprimir midia", run: /Executar/, history: "Histórico", home: "Início", file: "aula.mov", size: "1,2 GB" },
  en: { query: "compress media", run: /Run/, history: "History", home: "Home", file: "lecture.mov", size: "1.2 GB" },
} as const;
type Lang = keyof typeof COPY;

/** A pointer the screencast can see: Playwright moves no visible cursor. */
function cursorScript() {
  const style = document.createElement("style");
  style.textContent = `
    #demo-cursor { position: fixed; left: 0; top: 0; z-index: 2147483647; pointer-events: none;
      transform: translate(-100px, -100px); will-change: transform; }
    #demo-cursor svg { display: block; width: 22px; height: 22px; filter: drop-shadow(0 2px 3px rgba(0,0,0,.35));
      transform-origin: 3px 2px; transition: transform 120ms cubic-bezier(.2,.8,.2,1); }
    #demo-cursor.is-down svg { transform: scale(.86); }
    #demo-cursor i { position: absolute; left: -14px; top: -14px; width: 32px; height: 32px; border-radius: 50%;
      background: rgba(40,100,173,.28); opacity: 0; transform: scale(.4); }
    #demo-cursor.is-down i { animation: demo-ring 420ms cubic-bezier(.2,.8,.2,1); }
    @keyframes demo-ring { 0% { opacity: 1; transform: scale(.4); } 100% { opacity: 0; transform: scale(1.4); } }
    #demo-file { position: absolute; left: 18px; top: 16px; display: none; align-items: center; gap: 8px;
      padding: 8px 12px; border-radius: 10px; background: #fff; color: #151c2a; white-space: nowrap;
      font: 500 13px/1.2 "Inter", system-ui, sans-serif; box-shadow: 0 10px 26px -8px rgba(0,0,0,.35), 0 0 0 1px rgba(0,0,0,.06);
      transform: rotate(-3deg); }
    #demo-file b { font-weight: 600; } #demo-file span { color: #526173; }
    #demo-cursor.is-dragging #demo-file { display: flex; }`;
  const cursor = document.createElement("div");
  cursor.id = "demo-cursor";
  cursor.innerHTML = `<i></i><svg viewBox="0 0 22 22"><path d="M3 2l14 9.6-6.4 1.1 3.9 6.9-2.6 1.4-3.9-6.9L3 18.2z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg><div id="demo-file"></div>`;
  const mount = () => { document.head.append(style); document.body.append(cursor); };
  if (document.body) mount(); else addEventListener("DOMContentLoaded", mount);
  addEventListener("mousemove", (e) => { cursor.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`; }, true);
  addEventListener("mousedown", () => { cursor.classList.remove("is-down"); void cursor.offsetWidth; cursor.classList.add("is-down"); }, true);
  addEventListener("mouseup", () => setTimeout(() => cursor.classList.remove("is-down"), 140), true);
}

/** Answers execute_operation as the Rust host does for FFmpeg, and reports 5.0.0. */
function hostScript() {
  const w = window as unknown as { __TAURI_INTERNALS__: { invoke: (cmd: string, args?: any) => Promise<unknown> }; __host: any };
  const invoke = w.__TAURI_INTERNALS__.invoke;
  w.__TAURI_INTERNALS__.invoke = async (cmd: string, args: any = {}) => {
    if (cmd === "plugin:app|version") return "5.0.0";
    if (cmd !== "execute_operation") return invoke(cmd, args);
    w.__host.calls.push({ cmd, args });
    const r = args.request;
    const base = { jobId: r.jobId, toolId: r.toolId, operationId: r.operationId };
    w.__host.emit("operation-progress", { ...base, phase: "starting", progress: 0, message: "Starting ffmpeg.exe…" });
    await new Promise((resolve) => setTimeout(resolve, 2400));
    w.__host.emit("operation-progress", { ...base, phase: "completed", progress: 1, message: "Operation finished." });
    return { executable: "ffmpeg.exe", stdout: "", stderr: "", outputPath: r.outputPath, message: "Operation finished." };
  };
}

// Pointer moves follow an ease-in-out over real time, so hover states in the app
// fire exactly as they would under a hand.
let pointer = { x: VIEW.width + 40, y: VIEW.height - 120 };
async function glide(page: Page, x: number, y: number, ms = 650) {
  // Paced by the clock, not by step count: each move costs a round trip.
  const from = { ...pointer };
  const start = Date.now();
  for (;;) {
    const t = Math.min((Date.now() - start) / ms, 1);
    const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    await page.mouse.move(from.x + (x - from.x) * e, from.y + (y - from.y) * e);
    if (t === 1) break;
  }
  pointer = { x, y };
}
async function center(page: Page, locator: ReturnType<Page["locator"]>) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("target not on screen");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}
async function clickOn(page: Page, locator: ReturnType<Page["locator"]>, ms?: number) {
  const p = await center(page, locator);
  await glide(page, p.x, p.y, ms);
  await page.waitForTimeout(140);
  await page.mouse.down();
  await page.waitForTimeout(90);
  await page.mouse.up();
}

async function record(lang: Lang) {
  const copy = COPY[lang];
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const page = await browser.newPage({ viewport: VIEW, deviceScaleFactor: 2 });
  await installHost(page, {
    available: ["ffmpeg", "ffprobe", "jq", "yq", "ripgrep", "fd", "qpdf"],
    saveDialog: lang === "pt" ? "C:/Vídeos/aula-comprimida.mp4" : "C:/Videos/lecture-compressed.mp4",
  });
  await page.addInitScript(hostScript);
  await page.addInitScript(cursorScript);
  await page.addInitScript((l) => localStorage.setItem("tools4devs.language", l), lang);
  await page.goto(URL);
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(pointer.x, pointer.y);
  await page.waitForTimeout(600);

  const frames = join(OUT, `frames-${lang}`);
  rmSync(frames, { recursive: true, force: true });
  mkdirSync(frames, { recursive: true });
  const shots: Array<{ t: number; file: string }> = [];
  const cdp = await page.context().newCDPSession(page);
  cdp.on("Page.screencastFrame", async ({ data, sessionId }) => {
    const file = join(frames, `f${String(shots.length).padStart(5, "0")}.jpg`);
    writeFileSync(file, Buffer.from(data, "base64"));
    // Arrival time, on the same clock as t0 and the marks; metadata.timestamp is the browser's.
    shots.push({ t: Date.now() / 1000, file });
    await cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
  });

  const marks: Record<string, number> = {};
  let t0 = 0;
  const mark = (name: string) => { marks[name] = +(Date.now() / 1000 - t0).toFixed(2); };
  // A one-pixel nudge forces a first frame at t0, since frames only come on change.
  const nudge = () => page.evaluate(() => { document.body.style.outline = document.body.style.outline ? "" : "0 solid transparent"; });

  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 95, maxWidth: VIEW.width * 2, maxHeight: VIEW.height * 2, everyNthFrame: 1 });
  await nudge();
  t0 = Date.now() / 1000;
  await page.waitForTimeout(1300);

  // 1. Search by what you want done.
  mark("search");
  await clickOn(page, page.getByRole("button", { name: /Buscar|Search/ }).first(), 800);
  await page.waitForTimeout(250);
  await page.getByRole("combobox").pressSequentially(copy.query, { delay: 75 });
  await page.waitForTimeout(450);
  await clickOn(page, page.getByRole("option").first(), 500);
  await page.waitForTimeout(700);

  // 2. Bring the file in from outside the window.
  mark("drop");
  const zone = await center(page, page.getByRole("button", { name: /Escolher arquivos|Choose files/ }));
  await glide(page, VIEW.width + 30, zone.y + 60, 450);
  await page.evaluate(({ file, size }) => {
    const chip = document.getElementById("demo-file")!;
    chip.innerHTML = `<b>${file}</b><span>${size}</span>`;
    document.getElementById("demo-cursor")!.classList.add("is-dragging");
  }, copy);
  await page.waitForTimeout(150);
  await glide(page, VIEW.width - 160, zone.y + 30, 350);
  await page.evaluate(() => (window as any).__host.emit("tauri://drag-enter", { paths: ["x"], position: { x: 0, y: 0 } }));
  await glide(page, zone.x - 120, zone.y, 750);
  await page.waitForTimeout(250);
  const path = lang === "pt" ? "C:/Vídeos/aula.mov" : "C:/Videos/lecture.mov";
  await page.evaluate((p) => {
    document.getElementById("demo-cursor")!.classList.remove("is-dragging");
    (window as any).__host.drop([p]);
  }, path);
  await page.waitForTimeout(700);

  // 3. Run it. It runs here, on this machine.
  mark("run");
  await clickOn(page, page.getByRole("button", { name: copy.run }), 700);
  await glide(page, pointer.x - 140, pointer.y + 170, 900);
  await page.getByRole("button", { name: copy.run }).waitFor({ state: "visible", timeout: 10_000 });
  mark("done");
  await page.waitForTimeout(1100);

  // 4. The result waits in the history.
  await clickOn(page, page.getByRole("button", { name: copy.history, exact: true }), 800);
  await page.waitForTimeout(500);
  await glide(page, ...(Object.values(await center(page, page.getByRole("button", { name: /Abrir na pasta|Show in folder|Open/ }).first())) as [number, number]), 700);
  await page.waitForTimeout(1200);

  // 5. Back home and out of frame, so the loop closes on its first frame.
  await clickOn(page, page.getByRole("navigation", { name: /Onde você está|Where you are/ }).getByText(copy.home, { exact: true }), 700);
  await glide(page, VIEW.width + 40, VIEW.height - 120, 800);
  await page.waitForTimeout(900);
  await nudge();
  await page.waitForTimeout(100);
  const end = Date.now() / 1000;
  await cdp.send("Page.stopScreencast");
  await browser.close();

  // Frames arrive only on change, sometimes faster than the output rate. Resample:
  // each output frame shows the latest capture at its instant.
  const entry = (file: string) => `file '${file.replace(/\\/g, "/")}'`;
  const list: string[] = [];
  let k = 0;
  for (let i = 0; i / FPS <= end - t0; i++) {
    while (k + 1 < shots.length && shots[k + 1].t <= t0 + i / FPS) k++;
    list.push(entry(shots[k].file), `duration ${(1 / FPS).toFixed(6)}`);
  }
  list.push(entry(shots[k].file));
  const used = shots;
  const concat = join(frames, "list.txt");
  writeFileSync(concat, list.join("\n"));

  const scale = "scale=1920:-2:flags=lanczos";
  const input = ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", concat, "-vf", `${scale},fps=${FPS}`];
  execFileSync(FFMPEG, [...input, "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "38", "-row-mt", "1", "-deadline", "good", "-pix_fmt", "yuv420p", "-an", join(OUT, `hero-${lang}.webm`)]);
  execFileSync(FFMPEG, [...input, "-c:v", "libx264", "-preset", "slow", "-crf", "26", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", join(OUT, `hero-${lang}.mp4`)]);
  execFileSync(FFMPEG, ["-y", "-loglevel", "error", "-i", used[0].file, "-vf", scale, "-quality", "88", join(OUT, `hero-${lang}.webp`)]);
  writeFileSync(join(OUT, `hero-${lang}.json`), JSON.stringify({ duration: +(end - t0).toFixed(2), marks }, null, 2));
  rmSync(frames, { recursive: true, force: true });
  console.log(lang, `${used.length} frames over ${(end - t0).toFixed(1)}s`, marks);
}

mkdirSync(OUT, { recursive: true });
const langs = (process.argv.slice(2) as Lang[]).filter((l) => l in COPY);
for (const lang of langs.length ? langs : (["pt", "en"] as Lang[])) {
  pointer = { x: VIEW.width + 40, y: VIEW.height - 120 };
  await record(lang);
}
