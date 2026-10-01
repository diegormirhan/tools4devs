// Records a demo of the web front in headless Chrome, with a drawn cursor.
//
//   node skills/app-demo-media/record.mjs [outDir] [url]
//
// Writes outDir/cover.png (a clean shot, no cursor, for the thumbnail) and
// outDir/frames/*.png + list.txt (an ffmpeg concat list that keeps each
// frame's real duration). The scenario is the `scene` function near the end.
import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(process.argv[2] ?? "demo-out");
const url = process.argv[3] ?? "http://localhost:5180/";
const frames = path.join(out, "frames");
const uploadFile = path.join(here, "sample-upload.css");
const port = 9344;
// 1440x810 CSS pixels: the UI reads larger on a phone than a real desktop
// would. Captured at 2560x1440 so compose.mjs can zoom in and stay sharp.
const W = 1440, H = 810, SCALE = 2560 / 1440;

const chrome = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  path.join(os.homedir(), "AppData\\Local\\Google\\Chrome\\Application\\chrome.exe"),
].filter(Boolean).find(existsSync);
if (!chrome) throw new Error("Chrome not found. Set CHROME_PATH.");
const profile = path.join(os.tmpdir(), `app-demo-${process.pid}`);
const proc = spawn(chrome, [
  "--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  // The screencast ignores an emulated scale factor; only a real one gives
  // frames in device pixels.
  `--force-device-scale-factor=${SCALE}`,
  "--no-first-run", "--hide-scrollbars", "--force-color-profile=srgb", "about:blank",
], { stdio: "ignore" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function devtools() {
  for (let i = 0; i < 100; i++) {
    try { const r = await fetch(`http://127.0.0.1:${port}/json/version`); if (r.ok) return (await r.json()).webSocketDebuggerUrl; } catch {}
    await sleep(150);
  }
  throw new Error("Chrome never exposed its DevTools port.");
}

const socket = new WebSocket(await devtools());
await new Promise((r) => socket.addEventListener("open", r, { once: true }));
let id = 0; let session; const pending = new Map(); const listeners = [];
socket.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); }
  else if (m.method) listeners.forEach((l) => l(m));
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  pending.set(++id, { resolve, reject });
  socket.send(JSON.stringify({ id, method, params, sessionId: session }));
});
const js = async (expression) => (await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result.value;
const capture = async (file) => { const s = await send("Page.captureScreenshot", { format: "png" }); await writeFile(file, Buffer.from(s.data, "base64")); };

const { targetId } = await send("Target.createTarget", { url: "about:blank" });
session = (await send("Target.attachToTarget", { targetId, flatten: true })).sessionId;
await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: SCALE, mobile: false });
await send("Page.enable"); await send("DOM.enable"); await send("Runtime.enable");
// Language and theme before the app reads them.
await send("Page.addScriptToEvaluateOnNewDocument", { source: `
  localStorage.setItem("tools4devs.language", "pt");
  localStorage.setItem("tools4devs.theme-preference", "dark");` });
// A click on a file input opens a chooser; answer it with the sample file.
await send("Page.setInterceptFileChooserDialog", { enabled: true });
listeners.push(async (m) => {
  if (m.method === "Page.fileChooserOpened") await send("DOM.setFileInputFiles", { files: [uploadFile], backendNodeId: m.params.backendNodeId });
});
await send("Page.navigate", { url });
await sleep(2500);
await mkdir(out, { recursive: true });
await capture(path.join(out, "cover.png"));

// Click ripple and element lookup, installed in the page.
await js(`(() => {
  const style = document.createElement("style");
  style.textContent = "@keyframes demo-ripple{from{transform:translate(-50%,-50%) scale(.3);opacity:.9}to{transform:translate(-50%,-50%) scale(1.6);opacity:0}}";
  document.head.appendChild(style);
  window.__ripple = (x, y) => {
    const r = document.createElement("div");
    Object.assign(r.style, { position: "fixed", left: x + "px", top: y + "px", width: "38px", height: "38px", borderRadius: "50%",
      border: "2px solid rgba(125,211,252,.95)", background: "rgba(125,211,252,.18)", zIndex: 2147483646, pointerEvents: "none",
      animation: "demo-ripple 520ms ease-out forwards" });
    document.documentElement.appendChild(r); setTimeout(() => r.remove(), 600);
  };
  const visible = (el) => { const b = el.getBoundingClientRect(); return b.width > 0 && b.height > 0 && getComputedStyle(el).visibility !== "hidden"; };
  const area = (el) => { const b = el.getBoundingClientRect(); return b.width * b.height; };
  window.__find = (text, root) => [...(root ? document.querySelector(root) : document)
      .querySelectorAll("button,a,[role=tab],[role=option],[role=radio],li,label,span,h3,strong")]
    .filter((el) => visible(el) && (el.innerText || "").trim().split("\\n")[0].trim() === text)
    .sort((a, b) => area(a) - area(b))[0];
  window.__center = (el) => { const b = el.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; };
})()`);

// ── Input: every move is shown by the drawn cursor and sent as a real event ──
let cx = W / 2, cy = H / 2;
// Ease in-out quint: a slow start, a decisive middle, a soft landing.
const ease = (t) => (t < 0.5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2);
// The cursor is not drawn in the page: compose.mjs draws it at 60 fps from
// these positions, so it glides however fast the page itself is captured.
// Each move takes a time that grows with distance, eases in and out, and
// bends slightly, the way a hand moves a mouse.
async function moveTo(x, y) {
  const dist = Math.hypot(x - cx, y - cy);
  if (dist < 1) return;
  const duration = Math.min(1100, 380 + dist * 0.85);
  const sx = cx, sy = cy, bend = Math.min(50, dist * 0.1);
  const began = Date.now();
  for (;;) {
    const u = Math.min(1, (Date.now() - began) / duration);
    const t = ease(u);
    const px = sx + (x - sx) * t + Math.sin(Math.PI * t) * bend * 0.35;
    const py = sy + (y - sy) * t - Math.sin(Math.PI * t) * bend * 0.25;
    timeline.cursor.push({ t: Date.now() / 1000, x: px * SCALE, y: py * SCALE });
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: px, y: py });
    if (u >= 1) break;
    await sleep(8);
  }
  cx = x; cy = y;
}
async function click(x, y) {
  await moveTo(x, y); await sleep(120);
  await js(`__ripple(${x},${y})`);
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
  await sleep(70);
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
}
// Waits for the element, scrolls it into view smoothly if it is off screen
// (a click outside a modal closes it), then returns its centre.
async function at(finder) {
  for (let i = 0; i < 40; i++) {
    const state = await js(`(() => { const el = ${finder}; if (!el) return false;
      const b = el.getBoundingClientRect(); const out = b.top < 70 || b.bottom > innerHeight - 20;
      if (out) el.scrollIntoView({ block: "center", behavior: "smooth" }); return out ? "scrolled" : true; })()`);
    if (state === "scrolled") await sleep(550);
    if (state) return JSON.parse(await js(`JSON.stringify(__center(${finder}))`));
    await sleep(100);
  }
  await capture(path.join(out, "failure.png"));
  throw new Error(`Not found: ${finder} (see failure.png)`);
}
const byText = (text, root) => `__find(${JSON.stringify(text)}${root ? "," + JSON.stringify(root) : ""})`;
const bySel = (selector) => `document.querySelector(${JSON.stringify(selector)})`;
const card = (title) => `[...document.querySelectorAll('article[aria-labelledby^="card-"]')].find(a => a.querySelector("h3")?.innerText.trim() === ${JSON.stringify(title)})`;
const cardOpen = (title) => `${card(title)}?.querySelector("button")`;
// Pausing on a card is what opens its preview now; there is no artwork to aim at.
const cardArt = (title) => card(title);
const nthPlus = (n) => `[...document.querySelectorAll(".operation-options .number-field")][${n}]?.querySelector("button:last-of-type")`;
// A tool is a page now; the way back to the catalog is the brand at the top of the sidebar.
const closePanel = bySel('[data-slot="sidebar-header"] button');
async function clickOn(finder) { const p = await at(finder); await click(p.x, p.y); }
async function hover(finder) { const p = await at(finder); await moveTo(p.x, p.y); }
async function type(text, delay = 55) { for (const ch of text) { await send("Input.insertText", { text: ch }); await sleep(delay + Math.random() * 40); } }
async function key(keyName, code, vk, modifiers = 0) {
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: keyName, code, windowsVirtualKeyCode: vk, modifiers });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: keyName, code, windowsVirtualKeyCode: vk, modifiers });
}
const selectAll = () => key("a", "KeyA", 65, 2);
async function scroll(dy, steps = 12) {
  for (let i = 0; i < steps; i++) { await send("Input.dispatchMouseEvent", { type: "mouseWheel", x: cx, y: cy, deltaX: 0, deltaY: dy / steps }); await sleep(22); }
}

// Camera and chapter marks, read by compose.mjs. zoom(1) is the whole screen;
// above 1 the camera closes in and follows the cursor.
const timeline = { cursor: [], zoom: [], chapters: [] };
const zoom = (level) => timeline.zoom.push({ t: Date.now() / 1000, level });
// The caption is what the viewer reads for that chapter; most social video
// plays muted, so the captions carry the story.
const chapter = (label, caption) => timeline.chapters.push({ t: Date.now() / 1000, label, caption });

// ── The scenario ─────────────────────────────────────────────────────────
// Rules learned the hard way:
// - Close a panel only when it has nothing typed in it, or a "discard this
//   work?" dialog appears. Clear it first, or end the video on that panel.
// - A dropdown near the bottom of a modal is clipped; scroll before opening.
async function scene() {
  chapter("catalog", "25 ferramentas open source, <b>organizadas pelo que você quer fazer</b>");
  await hover(cardArt("Converter mídia")); await sleep(700);
  await hover(cardArt("Identificar a música")); await sleep(600);
  await scroll(520); await sleep(500); await scroll(-520); await sleep(300);

  chapter("search", "Busque por <b>ação, formato ou ferramenta</b>");
  await clickOn(bySel("input[type=search]")); zoom(1.7); await sleep(500);
  await type("pdf"); await sleep(1400);
  await selectAll(); await key("Backspace", "Backspace", 8); zoom(1); await sleep(700);

  chapter("css", "Gere CSS com <b>prévia ao vivo</b>");
  await clickOn(byText("Ferramentas rápidas")); await sleep(700);
  zoom(1.45); await hover(cardArt("Geradores CSS")); await sleep(1500);
  await clickOn(cardOpen("Geradores CSS")); zoom(1.3); await sleep(900);
  for (let i = 0; i < 4; i++) { await clickOn(nthPlus(0)); await sleep(160); }
  await scroll(320, 10); await sleep(400);
  await clickOn(bySel(".utility-preview-surface button")); await sleep(500);
  await clickOn(byText("Cartão")); await sleep(900);
  await scroll(-320, 10); await sleep(300);
  await clickOn(byText("Gradiente", ".tool-panel__menu")); await sleep(700);
  await scroll(260, 10); await sleep(300);
  for (let i = 0; i < 6; i++) { await clickOn(nthPlus(0)); await sleep(90); }
  await sleep(600);
  await clickOn(byText("Sombra da caixa", ".tool-panel__menu")); await sleep(1100);
  zoom(1); await clickOn(closePanel); await sleep(900);

  chapter("upload", "Envie um arquivo e <b>formate na hora</b>");
  await hover(cardArt("Minificar e formatar")); await sleep(900);
  await clickOn(cardOpen("Minificar e formatar")); await sleep(900);
  zoom(1.5); await clickOn(bySel(".utility-file-upload")); await sleep(1600);
  await scroll(260, 8); await sleep(1400);
  await clickOn(byText("Formatar CSS", ".tool-panel__menu")); await sleep(1300);
  await clickOn(byText("Limpar")); zoom(1); await sleep(400);
  await clickOn(closePanel); await sleep(800);

  chapter("random", "Dados, sorteios e Mega-Sena, <b>com um clique</b>");
  await clickOn(byText("Calculadoras")); await sleep(700);
  await clickOn(cardOpen("Escolhas aleatórias")); zoom(1.5); await sleep(800);
  await clickOn(nthPlus(1)); await sleep(200);
  await clickOn(nthPlus(1)); await sleep(500);
  for (let i = 0; i < 3; i++) { await clickOn(byText("Gerar de novo")); await sleep(650); }
  await clickOn(byText("Números da Mega-Sena", ".tool-panel__menu")); await sleep(700);
  await clickOn(byText("Gerar de novo")); await sleep(800);
  zoom(1); await clickOn(closePanel); await sleep(800);

  chapter("theme", "Tema <b>claro ou escuro</b>");
  await clickOn(byText("Tudo")); await sleep(500);
  await clickOn(`document.querySelectorAll("[role=radio]")[1]`); await sleep(1400);
  await hover(cardArt("Inspecionar mídia")); await sleep(800);
  await clickOn(`document.querySelectorAll("[role=radio]")[2]`); await sleep(1000);

  chapter("mockup", "Mockups de tweet <b>prontos para postar</b>");
  await clickOn(byText("Mockups")); await sleep(700);
  await clickOn(cardOpen("Mockup de post")); await sleep(1000);
  await clickOn(bySel(".mockup-panel__form textarea")); await selectAll();
  await type("Disciplina é fazer o que precisa ser feito, mesmo quando ninguém está olhando.", 38); await sleep(600);
  await clickOn(bySel(".mockup-checkbox input")); await sleep(900);
  zoom(1.8); await hover(bySel(".mockup-post--tweet")); await sleep(3800);
}

// ── Recording ────────────────────────────────────────────────────────────
await rm(frames, { recursive: true, force: true }); await mkdir(frames, { recursive: true });
const shots = [];
listeners.push((m) => {
  if (m.method !== "Page.screencastFrame") return;
  shots.push({ t: m.params.metadata.timestamp, data: m.params.data });
  send("Page.screencastFrameAck", { sessionId: m.params.sessionId }).catch(() => {});
});
// JPEG at 92 is visually lossless here and keeps the capture near 30 fps;
// PNG at this size drops it to about 18.
await send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: 2560, maxHeight: 1440, everyNthFrame: 1 });
timeline.cursor.push({ t: Date.now() / 1000, x: cx * SCALE, y: cy * SCALE });
await sleep(900);
try {
  await scene();
  timeline.end = Date.now() / 1000;
} finally {
  await send("Page.stopScreencast").catch(() => {}); await sleep(300);
  // The cursor compose.mjs draws, rasterised here at the capture scale.
  const svg = readFileSync(path.join(here, "cursor.svg")).toString("base64");
  await send("Emulation.setDefaultBackgroundColorOverride", { color: { r: 0, g: 0, b: 0, a: 0 } });
  await send("Page.navigate", { url: `data:text/html,<body style="margin:0;background:transparent"><img src="data:image/svg+xml;base64,${svg}">` });
  await sleep(600);
  const icon = await send("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: 36, height: 36, scale: 1 } });
  await writeFile(path.join(out, "cursor.png"), Buffer.from(icon.data, "base64"));
  socket.close(); proc.kill();
  await rm(profile, { recursive: true, force: true }).catch(() => {});
}

// The screencast only sends a frame when something changes, so each frame
// is held for exactly as long as it was on screen.
let list = "";
for (let i = 0; i < shots.length; i++) {
  const file = `f${String(i).padStart(5, "0")}.jpg`;
  await writeFile(path.join(frames, file), Buffer.from(shots[i].data, "base64"));
  // The page sends no frame while only the cursor moves, so the last one is
  // held until the scenario actually ended.
  const next = i + 1 < shots.length ? shots[i + 1].t : Math.max(shots[i].t + 0.5, (timeline.end ?? shots[i].t) + 0.5);
  list += `file '${file}'\nduration ${Math.max(0.001, next - shots[i].t).toFixed(4)}\n`;
}
list += `file 'f${String(shots.length - 1).padStart(5, "0")}.jpg'\n`;
await writeFile(path.join(frames, "list.txt"), list);
await writeFile(path.join(out, "timeline.json"), JSON.stringify({ start: shots[0].t, width: W * SCALE, height: H * SCALE, ...timeline }));
const total = Math.max(shots.at(-1).t + 0.5, (timeline.end ?? 0) + 0.5) - shots[0].t;
console.log(`${shots.length} frames, ${total.toFixed(1)}s raw`);
