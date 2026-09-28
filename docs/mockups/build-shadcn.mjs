// Round 2: variations of directions A (zinc) and B (stone), each in light and dark,
// built from the official shadcn/ui tokens (./shadcn/*.json) and component classes.
// LUCIDE=<path to lucide-static/icons> node build-shadcn.mjs [outDir=v2] [variant]  &&  node render.mjs <outDir>   (b3 = blue/cool B2, use: node build-shadcn.mjs v3 b3)
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { groups, counts, ffmpegOps } from "./data.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const lucide = process.env.LUCIDE;
if (!lucide) throw new Error("Set LUCIDE to the lucide-static/icons folder");
const icon = (name, cls = "") => readFileSync(join(lucide, `${name}.svg`), "utf8")
  .replace(/<!--[\s\S]*?-->/g, "")
  .replace(/<svg[^>]*>/, (t) => t.replace(/\s(width|height|class)="[^"]*"/g, "").replace("<svg", `<svg class="ic ${cls}"`)).trim();

/* ---------- Variants ---------- */
const bases = {
  zinc: JSON.parse(readFileSync(join(here, "shadcn/zinc.json"), "utf8")),
  stone: JSON.parse(readFileSync(join(here, "shadcn/stone.json"), "utf8")),
  mist: JSON.parse(readFileSync(join(here, "shadcn/mist.json"), "utf8")),
};
// Only --primary (and what derives from it) and the warm B canvas are ours; everything else is the shadcn base colour.
const overrides = {
  zinc: {
    light: { primary: "oklch(0.546 0.245 262.881)", "primary-foreground": "oklch(0.985 0 0)", ring: "oklch(0.623 0.214 259.815)", "sidebar-primary": "oklch(0.546 0.245 262.881)", "sidebar-ring": "oklch(0.623 0.214 259.815)" },
    dark: { primary: "oklch(0.75 0.12 262)", "primary-foreground": "oklch(0.21 0.006 285.885)", ring: "oklch(0.55 0.13 262)", "sidebar-primary": "oklch(0.75 0.12 262)", "sidebar-ring": "oklch(0.55 0.13 262)" },
  },
  stone: {
    light: { background: "oklch(0.975 0.008 85)", card: "oklch(0.995 0.004 85)", popover: "oklch(0.995 0.004 85)", sidebar: "oklch(0.952 0.011 85)", secondary: "oklch(0.945 0.012 85)", muted: "oklch(0.945 0.012 85)", accent: "oklch(0.935 0.014 85)", "sidebar-accent": "oklch(0.925 0.016 85)", border: "oklch(0.885 0.015 85)", "sidebar-border": "oklch(0.885 0.015 85)", input: "oklch(0.885 0.015 85)",
      primary: "oklch(0.53 0.145 40)", "primary-foreground": "oklch(0.985 0.005 85)", ring: "oklch(0.62 0.13 40)", "sidebar-primary": "oklch(0.53 0.145 40)", "sidebar-ring": "oklch(0.62 0.13 40)" },
    dark: { primary: "oklch(0.7 0.15 45)", "primary-foreground": "oklch(0.216 0.006 56.043)", ring: "oklch(0.55 0.12 45)", "sidebar-primary": "oklch(0.7 0.15 45)", "sidebar-ring": "oklch(0.55 0.12 45)" },
  },
};
overrides.mist = {
  // Cool blue-grey canvas and a blue primary; the inset panel stays white so it reads against the sidebar.
  light: { primary: "oklch(0.52 0.19 258)", "primary-foreground": "oklch(0.985 0.002 197.1)", ring: "oklch(0.62 0.16 258)", "sidebar-primary": "oklch(0.52 0.19 258)", "sidebar-ring": "oklch(0.62 0.16 258)",
    sidebar: "oklch(0.962 0.008 245)", "sidebar-accent": "oklch(0.925 0.013 245)", "sidebar-border": "oklch(0.905 0.01 245)", secondary: "oklch(0.958 0.006 245)", muted: "oklch(0.958 0.006 245)", accent: "oklch(0.945 0.009 245)", border: "oklch(0.915 0.008 245)", input: "oklch(0.915 0.008 245)" },
  dark: { primary: "oklch(0.74 0.13 258)", "primary-foreground": "oklch(0.2 0.02 258)", ring: "oklch(0.55 0.13 258)", "sidebar-primary": "oklch(0.74 0.13 258)", "sidebar-ring": "oklch(0.55 0.13 258)",
    background: "oklch(0.17 0.012 255)", card: "oklch(0.215 0.014 255)", popover: "oklch(0.215 0.014 255)", sidebar: "oklch(0.14 0.012 255)", "sidebar-accent": "oklch(0.27 0.02 255)", secondary: "oklch(0.27 0.016 255)", muted: "oklch(0.27 0.016 255)", accent: "oklch(0.3 0.02 255)" },
};
const variants = {
  b3: { base: "mist", title: "B3 · Mist azul, sidebar inset, ícone colorido por grupo", shell: "inset", card: "tile", heading: true, hue: { clay: 255, sage: 165, ochre: 78, slate: 285, plum: 322, stone: 215, rose: 12, teal: 195, sand: 135 } },
  a1: { base: "zinc", title: "A1 · Zinc, sidebar padrão, cards verticais", shell: "sidebar", card: "vertical", heading: false },
  a2: { base: "zinc", title: "A2 · Zinc, sidebar inset, cards horizontais", shell: "inset", card: "horizontal", heading: false },
  b1: { base: "stone", title: "B1 · Stone, sidebar padrão, cards com faixa de cor", shell: "sidebar", card: "strip", heading: true },
  b2: { base: "stone", title: "B2 · Stone, sidebar inset, ícone colorido por grupo", shell: "inset", card: "tile", heading: true },
};
const hue = { clay: 40, sage: 140, ochre: 85, slate: 250, plum: 315, stone: 80, rose: 15, teal: 185, sand: 65 };

const tokens = (v, theme) => {
  const t = { ...bases[v.base][theme], ...overrides[v.base][theme] };
  return Object.entries(t).map(([k, val]) => `--${k}:${val};`).join("");
};

/* ---------- Pieces (class names mirror the shadcn Tailwind utilities they stand for) ---------- */
let curHue = hue;
const toneStyle = (g) => `--th:${curHue[g.tone]}`;

const ffSubs = ["Convert format", "Compress media", "Trim a section", "Extract audio", "Make a GIF"];
const subsFor = {
  ffmpeg: { items: ffSubs, more: "9 more…" },
  "text-tools": { items: ["Change case", "Count words", "Find and replace", "Remove duplicate lines", "Sort lines"], more: "10 more…" },
};
const homeNav = { pinned: true, open: "video" };
const toolNav = { pinned: false, open: "video", tool: "ffmpeg", sub: "Extract audio" };
const nav = {
  home: homeNav, hover: homeNav, palette: homeNav, install: homeNav, narrow: homeNav,
  tool: toolNav, discard: toolNav,
  queue: { pinned: true, open: null, footer: "Queue" }, history: { pinned: true, open: null, footer: "History" }, settings: { pinned: true, open: null, footer: "Settings" },
  utility: { pinned: false, open: "utilities", tool: "text-tools", sub: "Change case" },
  chat: { pinned: false, open: "mockups", tool: "chat-mockup", activeTool: true },
};

const sidebar = (v, screen) => {
  const cfg = nav[screen];
  const pinned = cfg.pinned ? `<div class="sgroup"><div class="glabel">Pinned</div><ul class="menu">
      <li><a class="mbtn">${icon("clapperboard")}<span>Convert media</span>${icon("star", "star")}</a></li>
      <li><a class="mbtn">${icon("type")}<span>Work on text</span>${icon("star", "star")}</a></li></ul></div>` : "";
  const items = groups.map((g) => {
    const open = g.id === cfg.open;
    const ico = v.card === "tile" ? `<span class="gico" style="${toneStyle(g)}">${icon(g.icon)}</span>` : icon(g.icon);
    const btn = `<a class="mbtn ${open ? "open" : ""}">${ico}<span>${g.title}</span><em class="cnt">${counts[g.id]}</em>${icon("chevron-right", "chev")}</a>`;
    if (!open) return `<li>${btn}</li>`;
    const tools = g.tools.map((t) => {
      const sub = t.id === cfg.tool ? subsFor[t.id] : null;
      const b = `<a class="sbtn ${sub ? "open" : ""} ${cfg.activeTool && t.id === cfg.tool ? "active" : ""}">${icon(t.icon)}<span>${t.title}</span>${sub ? icon("chevron-right", "chev") : ""}</a>`;
      if (!sub) return `<li>${b}</li>`;
      const subs = sub.items.map((o) => `<li><a class="sbtn ${o === cfg.sub ? "active" : ""}"><span>${o}</span></a></li>`).join("");
      return `<li>${b}<ul class="sub">${subs}<li><a class="sbtn muted"><span>${sub.more}</span></a></li></ul></li>`;
    }).join("");
    return `<li>${btn}<ul class="sub">${tools}</ul></li>`;
  }).join("");
  const f = (label, ic, badge = "") => `<li><a class="mbtn ${cfg.footer === label ? "active" : ""}">${icon(ic)}<span>${label}</span>${badge}</a></li>`;
  return `<aside class="sidebar">
    <div class="shead"><a class="mbtn lg"><span class="logo"><img src="../../../../apps/desktop/public/brand/tools4devs-mark.svg" alt=""></span><span class="two"><b>tools4devs</b><small>Local tools</small></span></a>
      <div class="sinput">${icon("search")}<span>Search tools…</span><kbd>Ctrl K</kbd></div></div>
    <div class="scontent">${pinned}<div class="sgroup"><div class="glabel">All tools</div><ul class="menu">${items}</ul></div></div>
    <div class="sfoot"><ul class="menu">${f("Queue", "list-checks", '<b class="mbadge">2</b>')}${f("History", "history")}${f("Settings", "settings")}</ul></div>
  </aside>`;
};

// Icon-only rail (shadcn `collapsible="icon"`), used when the window is at its 800px minimum.
const rail = (v) => `<aside class="sidebar rail">
  <div class="shead"><a class="mbtn lg"><span class="logo"><img src="../../../../apps/desktop/public/brand/tools4devs-mark.svg" alt=""></span></a></div>
  <div class="scontent"><ul class="menu">${groups.map((g, i) => `<li><a class="mbtn ${i === 0 ? "active" : ""}"><span class="gico" style="${toneStyle(g)}">${icon(g.icon)}</span></a></li>`).join("")}</ul></div>
  <div class="sfoot"><ul class="menu"><li><a class="mbtn">${icon("list-checks")}</a></li><li><a class="mbtn">${icon("history")}</a></li><li><a class="mbtn">${icon("settings")}</a></li></ul></div></aside>`;

const header = (crumbs) => `<header class="hdr"><button class="iconbtn">${icon("panel-left")}</button><i class="sep"></i>
  <nav class="bc">${crumbs.map((c, i) => i === crumbs.length - 1 ? `<span class="cur">${c}</span>` : `<span>${c}</span>${icon("chevron-right")}`).join("")}</nav></header>`;

const badgeCloud = (t) => `<span class="badge sec">${icon("download-cloud")}In-app download · ${t.size}</span>`;

const card = (v, t, g) => {
  const tone = `style="${toneStyle(g)}"`;
  const eng = `<span class="eng">${t.engine}</span>`;
  const actions = `<span class="badge out">${t.ops} ${t.ops === 1 ? "action" : "actions"}</span>`;
  if (v.card === "vertical") return `<article class="card">
    <div class="ch"><span class="tile">${icon(t.icon)}</span><div class="ct"><h3>${t.title}</h3>${eng}</div>${actions}</div>
    <p class="cc">${t.desc}</p><div class="cf">${badgeCloud(t)}</div></article>`;
  if (v.card === "horizontal") return `<article class="card h">
    <span class="tile">${icon(t.icon)}</span>
    <div class="hb"><div class="row2"><h3>${t.title}</h3>${eng}</div><p class="cc">${t.desc}</p>
      <div class="cf">${badgeCloud(t)}${actions}</div></div></article>`;
  if (v.card === "strip") return `<article class="card strip" ${tone}>
    <div class="art">${icon(t.icon, "xl")}${eng}</div>
    <div class="sb"><h3>${t.title}</h3><p class="cc">${t.desc}</p><div class="cf">${badgeCloud(t)}${actions}</div></div></article>`;
  return `<article class="card" ${tone}>
    <div class="ch"><span class="tile tone lg">${icon(t.icon)}</span><div class="ct"><h3>${t.title}</h3>${eng}</div>${actions}</div>
    <p class="cc">${t.desc}</p><div class="cf">${badgeCloud(t)}</div></article>`;
};

const clipFor = (t, v) => (v.base === "mist" && t && existsSync(join(here, "previews/out", `${t.id === "ffmpeg" ? "ffmpeg" : t.id}.webm`)) ? t.id : null);
const videoFrame = (t, v) => clipFor(t, v)
  ? `<div class="vid real"><video src="../../previews/out/${t.id}.webm" poster="../../previews/out/${t.id}.jpg" muted loop playsinline preload="auto"></video></div>`
  : `<div class="vid"><div class="win">
  <div class="wbar"><i></i><i></i><i></i><span>Convert media · Extract audio</span></div>
  <div class="wbody"><div class="file">${icon("file-video")}<div><b>holiday-2025.mov</b><small>4K · 1.2 GB · 03:42</small></div></div>
    <div class="sel sm">MP3${icon("chevron-down")}</div>
    <div class="run"><div class="prog"><i style="width:62%"></i></div><span>62%</span></div></div>
  <svg class="cursor" viewBox="0 0 24 24"><path d="M5 3l14 8-6.2 1.8L10 19z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg></div>
  <span class="tag l">${icon("play")} Preview · muted loop</span><span class="tag r">0:03</span></div>`;

const homeMain = (v, hover) => {
  const [vg, dg] = groups;
  const cell = (t, g, hot) => `<div class="cell ${hover && !hot ? "dim" : ""}">${card(v, t, g)}${hot ? `
    <div class="pop" style="${toneStyle(g)}">${videoFrame(t, v)}<div class="pb">
      <div class="ph"><span class="tile ${v.card === "tile" ? "tone" : ""} lg">${icon(t.icon)}</span><div class="ct"><h3>${t.title}</h3><span class="eng">${t.engine} · ${t.size} download</span></div>
        <button class="btn">Get it ${icon("download")}</button></div>
      <p class="cc">${t.desc}</p><div class="what">What you can do</div>
      <div class="chips">${ffmpegOps.slice(0, 6).map((o) => `<span class="badge out">${o}</span>`).join("")}<span class="badge sec">+8</span></div></div></div>` : ""}</div>`;
  return `<div class="page"><div class="ptitle"><div><h1>What do you want to do?</h1>
      <p>Pick a tool on the left, or drop a file on this window and we will suggest what fits.</p></div>
      <button class="btn outline">${icon("upload")} Choose a file</button></div>
    <section><div class="shd"><h2>${vg.title}</h2><span>${vg.tools.length} tools</span></div>
      <div class="grid">${vg.tools.map((t, i) => cell(t, vg, hover && i === 0)).join("")}</div></section>
    <section><div class="shd"><h2>${dg.title}</h2><span>${dg.tools.length} tools</span></div>
      <div class="grid">${dg.tools.map((t) => cell(t, dg, false)).join("")}</div></section></div>`;
};

const toolMain = () => `<div class="page"><div class="ptitle"><div><h1>Extract audio</h1><p>Write an audio file from the video.</p></div>
    <span class="badge out ok">${icon("circle-check")} FFmpeg 7.1 ready</span></div>
  <div class="tgrid"><div class="stack">
    <div class="drop"><span class="tile lg">${icon("file-video")}</span><div><b>holiday-2025.mov</b><small>4K · 1.2 GB · 03:42 · AAC stereo</small></div><button class="btn outline sm">Change file</button></div>
    <article class="card"><div class="ch2"><h3>Options</h3><p>Choose how the audio is written.</p></div>
      <div class="cb">
        <div class="field"><label>Output format</label><div class="sel">MP3${icon("chevron-down")}</div></div>
        <div class="field"><label>Quality <em>192 kbps</em></label><div class="slider"><i style="width:58%"></i><b style="left:58%"></b></div></div>
        <div class="field swr"><label>Keep title and artist tags</label><div class="switch on"><i></i></div></div>
        <div class="field"><label>Save to</label><div class="sel">C:\\Users\\you\\Music${icon("chevron-down")}</div></div>
      </div></article></div>
    <article class="card"><div class="ch2"><h3>Summary</h3><p>Nothing leaves your computer.</p></div>
      <dl class="cb"><dt>From</dt><dd>holiday-2025.mov</dd><dt>To</dt><dd>holiday-2025.mp3</dd><dt>Estimated size</dt><dd>≈ 5.1 MB</dd></dl>
      <div class="cf col"><button class="btn block">${icon("audio-lines")} Extract audio</button><button class="btn outline block">Add to queue</button></div></article>
  </div></div>`;

/* ---------- Other screens (round 4) ---------- */
const job = ({ ic, title, meta, msg, status, pct, actions }) => {
  const badge = { running: `<span class="badge pri">Running${pct != null ? ` ${pct}%` : ""}</span>`, queued: `<span class="badge out">${icon("circle-slash")} Waiting</span>`,
    done: `<span class="badge sec">${icon("check")} Done</span>`, failed: `<span class="badge bad">${icon("triangle-alert")} Failed</span>`, stopped: `<span class="badge out">${icon("circle-slash")} Stopped</span>` }[status];
  return `<article class="job"><span class="tile">${icon(ic)}</span>
    <div class="jid"><b>${title}</b><small>${meta}</small><small class="${status === "failed" ? "err" : ""}">${msg}</small>${actions ? `<div class="jact">${actions}</div>` : ""}</div>
    <div class="jst">${badge}${pct != null && status === "running" ? `<div class="prog w"><i style="width:${pct}%"></i></div>` : ""}${status === "running" || status === "queued" ? `<button class="btn outline sm">${icon("circle-slash")} Stop</button>` : ""}</div></article>`;
};
const folderActs = `<button class="btn ghost sm">${icon("folder-open")} Show in folder</button><button class="btn ghost sm">${icon("copy")} Copy path</button>`;

const queueMain = () => `<div class="page"><div class="ptitle"><div><h1>Operation queue</h1><p>3 operations in this section.</p></div></div>
  <div class="jobs">
  ${job({ ic: "audio-lines", title: "Extract audio", meta: "FFmpeg · holiday-2025.mov · format: MP3 · quality: 192", msg: "Writing holiday-2025.mp3…", status: "running", pct: 62 })}
  ${job({ ic: "download", title: "Download media", meta: "yt-dlp · https://example.com/watch?v=…", msg: "Downloading 4 of 12 MB…", status: "running", pct: 34 })}
  ${job({ ic: "file-text", title: "Merge PDFs", meta: "Organise PDFs · 3 files", msg: "Waits until one of the running operations finishes.", status: "queued" })}
  </div></div>`;

const historyMain = () => `<div class="page"><div class="ptitle"><div><h1>Result history</h1><p>5 operations in this section.</p></div><button class="btn outline sm">Clear the history</button></div>
  <div class="jobs">
  ${job({ ic: "audio-lines", title: "Extract audio", meta: "FFmpeg · holiday-2025.mov · format: MP3", msg: "Finished in 14 s.", status: "done", actions: folderActs })}
  ${job({ ic: "image", title: "Compress image", meta: "Adjust images · banner.png · quality: 80", msg: "Saved 1.8 MB (62% smaller).", status: "done", actions: folderActs })}
  ${job({ ic: "braces", title: "Format JSON", meta: "Format JSON · response.json", msg: "The file is not valid JSON at line 14.", status: "failed" })}
  ${job({ ic: "download", title: "Download media", meta: "yt-dlp · https://example.com/watch?v=…", msg: "Stopped before it finished.", status: "stopped" })}
  </div></div>`;

const setRow = (title, desc, control) => `<article class="card sc"><div class="sct"><h3>${title}</h3><p>${desc}</p></div><div class="scc">${control}</div></article>`;
const settingsMain = () => `<div class="page"><div class="ptitle"><div><h1>Settings</h1><p>Everything stays on this computer.</p></div></div>
  <div class="sgrid">
  ${setRow("Version", "This is the newest version.", `<span class="mono">4.0.0</span><button class="btn outline sm">${icon("refresh-cw")} Check for updates</button>`)}
  ${setRow("Language", "Tools, options and errors are all translated.", `<div class="sel w200">English${icon("chevron-down")}</div>`)}
  ${setRow("Theme", "Follow Windows, or pick one.", `<div class="tg"><span>${icon("monitor")} System</span><span>${icon("sun")} Light</span><span class="on">${icon("moon")} Dark</span></div>`)}
  ${setRow("Sidebar", "Keep the tool tree open when the window is wide.", `<div class="switch on"><i></i></div>`)}
  ${setRow("Default destination", "C:\\Users\\you\\Documents\\tools4devs", `<button class="btn outline sm">Choose</button><button class="btn ghost sm">Clear</button>`)}
  ${setRow("History", "5 results kept across restarts.", `<button class="btn outline sm">Clear</button>`)}
  ${setRow("How many at once", "Anything beyond this waits in the queue.", `<div class="sel w200">2 operations${icon("chevron-down")}</div>`)}
  ${setRow("When the file already exists", "Choose what happens to the old file.", `<div class="sel w260">Keep both — number the new one${icon("chevron-down")}</div>`)}
  </div></div>`;

const paletteOverlay = () => `<div class="scrim"></div><div class="modal cmd">
  <div class="cin">${icon("search")}<span>extract au<i class="caret"></i></span></div>
  <div class="clist">
    <div class="cgh">Actions</div>
    <div class="ci sel-on"><span class="tile sm">${icon("audio-lines")}</span><div><b>Extract audio</b><small>Convert media · FFmpeg</small></div><em>Video and audio</em></div>
    <div class="ci"><span class="tile sm">${icon("file-output")}</span><div><b>Extract text</b><small>Extract from PDFs · Poppler</small></div><em>PDFs and documents</em></div>
    <div class="ci"><span class="tile sm">${icon("scan-text")}</span><div><b>Extract text from a picture</b><small>Read text from images · Tesseract</small></div><em>PDFs and documents</em></div>
    <div class="cgh">Tools</div>
    <div class="ci"><span class="tile sm">${icon("clapperboard")}</span><div><b>Convert media</b><small>14 actions</small></div><em>Video and audio</em></div>
  </div>
  <div class="cfoot2"><span><kbd>↑</kbd><kbd>↓</kbd> move</span><span><kbd>↵</kbd> open</span><span><kbd>Esc</kbd> close</span></div></div>`;

const installOverlay = () => `<div class="scrim"></div><div class="modal dlg">
  <div class="dtile">${icon("download")}</div>
  <h2>Install FFmpeg</h2>
  <p class="dsub">tools4devs downloads and installs everything below on its own — 115 MB in total. You never leave the app, and you never install anything by hand.</p>
  <div class="plan">
    <div class="step"><span class="idx">01</span><div><b>FFmpeg</b><small>Downloading 45%</small></div><div class="prog w"><i style="width:45%"></i></div></div>
    <div class="step"><span class="idx">02</span><div><b>FFprobe</b><small>Requested tool · 31 MB</small></div></div>
  </div>
  <div class="assure"><span>${icon("shield-check")} SHA-256 checked before anything is activated</span><span>${icon("hard-drive")} Installed per version, with no administrator rights</span></div>
  <div class="dfoot"><button class="btn outline">Close</button></div></div>`;

const discardOverlay = () => `<div class="scrim"></div><div class="modal dlg sm2">
  <h2>Discard this work?</h2>
  <p class="dsub">Opening Inspect media closes Extract audio. The file you chose and the options you set here will be lost.</p>
  <div class="dfoot"><button class="btn outline">Keep editing</button><button class="btn bad">Discard</button></div></div>`;

const textArea = (label, text, extra = "") => `<article class="card ta"><div class="tah"><b>${label}</b>${extra}</div><div class="tbox">${text}</div></article>`;
const utilityMain = () => `<div class="page"><div class="ptitle"><div><h1>Change case</h1><p>Turn text into upper, lower, title or sentence case.</p></div></div>
  <article class="card" style="margin-bottom:16px"><div class="ch2"><h3>Options</h3></div><div class="cb"><div class="field"><label>Style</label>
    <div class="tg"><span>UPPER</span><span>lower</span><span class="on">Title Case</span><span>Sentence case</span></div></div></div></article>
  <div class="two-col">${textArea("Input", "the quick brown fox jumps over the lazy dog", `<button class="btn ghost sm">${icon("upload")} Upload a file</button>`)}
    ${textArea("Result", "The Quick Brown Fox Jumps Over The Lazy Dog", `<button class="btn sm">${icon("copy")} Copy</button>`)}</div>
  <p class="hint">It runs here, as you type. <button class="btn ghost sm">${icon("eraser")} Clear</button></p></div>`;

const bubble = (side, text, time) => `<div class="bub ${side}"><span>${text}</span><small>${time}</small></div>`;
const chatMain = () => `<div class="page"><div class="ptitle"><div><h1>Chat mockup</h1><p>Type messages, then save the chat as a picture.</p></div></div>
  <div class="tgrid" style="grid-template-columns:1fr 360px"><article class="card"><div class="ch2"><h3>Conversation</h3><p>Who is talking, and what they say.</p></div>
    <div class="cb"><div class="two-col tight"><div class="field"><label>App</label><div class="sel">WhatsApp${icon("chevron-down")}</div></div>
      <div class="field"><label>Contact name</label><div class="sel">Maria</div></div></div>
      ${[["Them", "Hey, are we still on for tomorrow?", "09:41"], ["Me", "Yes! See you at 10.", "09:42"], ["Them", "Perfect, I'll bring the files.", "09:43"]].map(([w, t, tm]) => `<div class="mrow"><span class="tg mini"><span class="${w === "Me" ? "on" : ""}">Me</span><span class="${w === "Them" ? "on" : ""}">Them</span></span><div class="sel grow">${t}</div><div class="sel w70">${tm}</div><button class="iconbtn">${icon("trash-2")}</button></div>`).join("")}
      <button class="btn outline sm" style="justify-self:start">${icon("plus")} Add a message</button></div></article>
    <div class="stack"><div class="phone"><div class="phh"><span class="av">M</span><b>Maria</b><small>online</small></div>
      <div class="chat">${bubble("them", "Hey, are we still on for tomorrow?", "09:41")}${bubble("me", "Yes! See you at 10.", "09:42")}${bubble("them", "Perfect, I'll bring the files.", "09:43")}</div>
      <div class="phf">It's between us…</div></div><button class="btn block">${icon("download")} Save image</button></div></div></div>`;

const narrowMain = () => `<div class="page"><div class="ptitle"><div><h1 style="font-size:24px">What do you want to do?</h1><p>Pick a tool, or drop a file here.</p></div></div>
  <section><div class="shd"><h2>Video and audio</h2><span>4 tools</span></div><div class="grid two">${groups[0].tools.slice(0, 4).map((t) => `<div class="cell">${card(variants.b3, t, groups[0])}</div>`).join("")}</div></section></div>`;

const css = (v, theme, W = 1440, H = 900) => `
@font-face{font-family:"Inter Variable";src:url(../../fonts/inter.woff2) format("woff2");font-weight:100 900}
@font-face{font-family:"Fraunces Variable";src:url(../../fonts/fraunces.woff2) format("woff2");font-weight:100 900}
@font-face{font-family:"JBM";src:url(../../fonts/jetbrains-mono-latin-500-normal.woff2) format("woff2");font-weight:500}
*{box-sizing:border-box;margin:0;padding:0;border-color:var(--border)}
:root{color-scheme:${theme};--radius:0.625rem;--rm:calc(var(--radius)*.8);--rl:var(--radius);--rxl:calc(var(--radius)*1.4);--font-sans:"Inter Variable",system-ui,sans-serif;--font-heading:${v.heading ? '"Fraunces Variable",Georgia,serif' : '"Inter Variable",system-ui,sans-serif'};${tokens(v, theme)}}
html,body{width:${W}px;height:${H}px;overflow:hidden}
body{background:var(--background);color:var(--foreground);font-family:var(--font-sans);font-size:14px;-webkit-font-smoothing:antialiased}
.ic{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;flex:none}
.ic.xl{width:36px;height:36px;stroke-width:1.6}
.app{display:flex;height:${H}px;${v.shell === "inset" ? "background:var(--sidebar);" : ""}}
.sidebar{width:256px;flex:none;display:flex;flex-direction:column;background:var(--sidebar);color:var(--sidebar-foreground);${v.shell === "sidebar" ? "border-right:1px solid var(--sidebar-border);" : ""}}
.shead{padding:8px;display:flex;flex-direction:column;gap:8px}
.mbtn,.sbtn{display:flex;align-items:center;gap:8px;width:100%;border-radius:var(--rm);text-align:left;white-space:nowrap;overflow:hidden}
.mbtn{height:32px;padding:8px;font-size:14px}.mbtn.lg{height:48px}
.mbtn>span:not(.logo):not(.two):not(.gico),.sbtn>span{flex:1;overflow:hidden;text-overflow:ellipsis}
.mbtn .cnt{font-style:normal;font-size:12px;color:color-mix(in oklab,var(--sidebar-foreground) 55%,transparent)}
.mbtn .chev,.sbtn .chev{opacity:.6;width:16px;transition:none}.mbtn.open .chev,.sbtn.open .chev{transform:rotate(90deg)}
.mbtn.lg .logo{width:32px;height:32px;border-radius:var(--rl);overflow:hidden;background:var(--sidebar-primary);display:grid;place-items:center;flex:none}.logo img{width:32px;height:32px}
.two{display:grid;line-height:1.15;text-align:left}.two b{font-size:14px;font-weight:600;font-family:var(--font-heading)}.two small{font-size:12px;opacity:.7}
.sinput{display:flex;align-items:center;gap:8px;height:32px;padding:0 8px;border-radius:var(--rm);border:1px solid var(--input);background:var(--background);font-size:14px;color:var(--muted-foreground)}.sinput span{flex:1}.sinput .ic{opacity:.6}
kbd{font:500 11px "JBM",monospace;border:1px solid var(--border);border-radius:4px;padding:1px 5px;color:var(--muted-foreground)}
.scontent{flex:1;min-height:0;overflow:hidden;display:flex;flex-direction:column;gap:8px}
.sgroup{padding:8px}.glabel{height:32px;display:flex;align-items:center;padding:0 8px;font-size:12px;font-weight:500;color:color-mix(in oklab,var(--sidebar-foreground) 70%,transparent)}
.menu,.sub{list-style:none;display:flex;flex-direction:column;gap:4px}
.sub{margin:0 14px;padding:2px 10px;border-left:1px solid var(--sidebar-border)}
.sbtn{height:28px;padding:0 8px;font-size:14px}.sbtn.muted{color:color-mix(in oklab,var(--sidebar-foreground) 60%,transparent);font-style:italic}
.sbtn.active{background:var(--sidebar-accent);color:var(--sidebar-accent-foreground);font-weight:500}
.sbtn.open{font-weight:500}.mbtn.open{background:${"color-mix(in oklab,var(--sidebar-accent) 55%,transparent)"}}
.star{width:14px;height:14px;fill:var(--primary);color:var(--primary)}
.gico{display:grid;place-items:center;color:oklch(${theme === "dark" ? "0.8 0.11" : "0.48 0.12"} var(--th))}
.mbadge{min-width:20px;height:20px;border-radius:var(--rm);padding:0 4px;display:grid;place-items:center;font-size:12px;font-weight:500;background:var(--sidebar-primary);color:var(--sidebar-primary-foreground)}
.sfoot{padding:8px;border-top:1px solid var(--sidebar-border)}
.wrap{flex:1;min-width:0;display:flex;${v.shell === "inset" ? "padding:8px 8px 8px 0;" : ""}}
.inset{flex:1;min-width:0;background:var(--background);overflow:hidden;position:relative;${v.shell === "inset" ? "border-radius:var(--rxl);box-shadow:0 1px 2px 0 rgb(0 0 0/.06),0 0 0 1px var(--border);" : ""}}
.hdr{height:64px;display:flex;align-items:center;gap:8px;padding:0 16px}.iconbtn{width:28px;height:28px;border-radius:var(--rm);display:grid;place-items:center;background:none;border:0;color:var(--foreground)}
.sep{width:1px;height:16px;background:var(--border);margin:0 4px}
.bc{display:flex;align-items:center;gap:6px;font-size:14px;color:var(--muted-foreground)}.bc .ic{width:14px;height:14px}.bc .cur{color:var(--foreground)}
.page{padding:0 24px 24px}
.ptitle{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:24px}
h1{font-family:var(--font-heading);font-size:${v.heading ? 30 : 24}px;font-weight:${v.heading ? 600 : 600};letter-spacing:-.02em;line-height:1.2}
.ptitle p{color:var(--muted-foreground);margin-top:6px}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:36px;padding:0 16px;border-radius:var(--rm);font:500 14px var(--font-sans);background:var(--primary);color:var(--primary-foreground);border:1px solid transparent;flex:none}
.btn .ic{width:16px;height:16px}
.btn.outline{background:${theme === "dark" ? "color-mix(in oklab,var(--input) 30%,transparent)" : "var(--background)"};color:var(--foreground);border-color:var(--input);box-shadow:0 1px 2px 0 rgb(0 0 0/.05)}
.btn.sm{height:32px;padding:0 12px}.btn.block{width:100%}
.badge{display:inline-flex;align-items:center;gap:4px;border:1px solid transparent;border-radius:9999px;padding:2px 8px;font-size:12px;font-weight:500;white-space:nowrap}.badge .ic{width:12px;height:12px}
.badge.sec{background:var(--secondary);color:var(--secondary-foreground)}.badge.out{border-color:var(--border);color:var(--foreground)}.badge.out.ok{color:var(--primary)}
.shd{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:12px}.shd h2{font-family:var(--font-heading);font-size:${v.heading ? 20 : 18}px;font-weight:600;letter-spacing:-.01em}.shd span{color:var(--muted-foreground);font-size:14px}
section{margin-bottom:24px}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.cell{position:relative}.cell.dim .card{opacity:.45}
.card{display:flex;flex-direction:column;gap:24px;border:1px solid var(--border);border-radius:var(--rxl);background:var(--card);color:var(--card-foreground);padding:24px 0;box-shadow:0 1px 2px 0 rgb(0 0 0/.05)}
.card>*{padding:0 24px}
.ch{display:flex;align-items:flex-start;gap:12px}.ct{flex:1;min-width:0;display:grid;gap:4px}
.ct h3,.hb h3,.sb h3,.ch2 h3{font-family:var(--font-heading);font-size:${v.heading ? 17 : 16}px;font-weight:600;line-height:1.1;letter-spacing:-.005em}
.eng{font:500 11px "JBM",monospace;letter-spacing:.05em;color:var(--muted-foreground)}
.tile{width:40px;height:40px;border-radius:var(--rl);background:var(--muted);color:var(--primary);display:grid;place-items:center;flex:none}.tile .ic{width:20px;height:20px}.tile.lg{width:44px;height:44px}
.tile.tone{background:oklch(${theme === "dark" ? "0.32 0.06" : "0.93 0.045"} var(--th));color:oklch(${theme === "dark" ? "0.82 0.11" : "0.45 0.12"} var(--th))}
.cc{font-size:14px;line-height:1.5;color:var(--muted-foreground)}
.cf{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:auto}.cf.col{flex-direction:column;align-items:stretch}
.card.h{flex-direction:row;gap:16px;padding:16px}.card.h>*{padding:0}.card.h .hb{flex:1;display:grid;gap:8px;min-width:0}.row2{display:flex;justify-content:space-between;align-items:baseline;gap:8px}
.card.h .cc{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.card.strip{padding:0;gap:0;overflow:hidden}.card.strip>*{padding:0}
.card.strip .art{height:76px;padding:12px 20px;display:flex;justify-content:space-between;align-items:flex-end;background:oklch(${theme === "dark" ? "0.3 0.05" : "0.93 0.032"} var(--th));color:oklch(${theme === "dark" ? "0.82 0.11" : "0.45 0.12"} var(--th))}.card.strip .eng{color:inherit;opacity:.85}
.card.strip .sb{padding:20px;display:grid;gap:8px}
.pop{position:absolute;left:-20px;top:-16px;width:calc(100% + 40px);z-index:10;background:var(--popover);color:var(--popover-foreground);border:1px solid var(--border);border-radius:var(--rxl);overflow:hidden;box-shadow:0 10px 15px -3px rgb(0 0 0/.25),0 4px 6px -4px rgb(0 0 0/.2)}
.vid{position:relative;aspect-ratio:16/9;background:${theme === "dark" ? "oklch(0.1 0 0)" : "var(--muted)"};display:grid;place-items:center;overflow:hidden}
.win{width:74%;background:var(--background);border:1px solid var(--border);border-radius:var(--rl);box-shadow:0 10px 25px -5px rgb(0 0 0/.3);position:relative;overflow:hidden}
.wbar{display:flex;gap:5px;align-items:center;padding:7px 9px;border-bottom:1px solid var(--border);font-size:10px;color:var(--muted-foreground)}.wbar i{width:7px;height:7px;border-radius:50%;background:var(--border)}.wbar span{margin-left:6px}
.wbody{padding:10px;display:grid;gap:8px}.file{display:flex;gap:8px;align-items:center;border:1px solid var(--border);border-radius:var(--rm);padding:6px 8px}.file .ic{color:var(--primary)}.file b{font-size:11px;font-weight:500;display:block}.file small{font-size:9.5px;color:var(--muted-foreground)}
.run{display:flex;align-items:center;gap:8px;font-size:10px;color:var(--muted-foreground)}.prog{flex:1;height:6px;background:var(--muted);border-radius:9px;overflow:hidden}.prog i{display:block;height:100%;background:var(--primary)}
.cursor{position:absolute;width:20px;height:20px;right:28%;top:52%}
.tag{position:absolute;bottom:8px;font-size:10.5px;background:rgb(0 0 0/.6);color:#fff;border-radius:9999px;padding:2px 8px;display:flex;align-items:center;gap:5px}.vid.real video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.tag{z-index:2}.tag.l{left:10px}.tag.r{right:10px;border-radius:5px;font-family:"JBM",monospace}.tag .ic{width:10px;height:10px;fill:#fff}
.pb{padding:16px;display:grid;gap:12px}.ph{display:flex;gap:12px;align-items:center}.ph .ct{flex:1}
.what{font-size:12px;font-weight:500;color:var(--muted-foreground);margin-bottom:-4px}.chips{display:flex;flex-wrap:wrap;gap:6px}
.tgrid{display:grid;grid-template-columns:1fr 320px;gap:24px;align-items:start}.stack{display:grid;gap:16px}
.drop{display:flex;align-items:center;gap:16px;padding:16px;border:1px dashed var(--input);border-radius:var(--rxl);background:var(--card)}.drop>div{flex:1}.drop b{display:block;font-weight:500}.drop small{color:var(--muted-foreground);font-size:13px}
.ch2{display:grid;gap:6px}.ch2 p{color:var(--muted-foreground);font-size:14px}
.cb{display:grid;gap:20px}.field label{display:flex;justify-content:space-between;font-size:14px;font-weight:500;margin-bottom:8px}.field label em{font-style:normal;font-weight:400;color:var(--muted-foreground)}
.sel{display:flex;align-items:center;justify-content:space-between;height:36px;padding:0 12px;border:1px solid var(--input);border-radius:var(--rm);box-shadow:0 1px 2px 0 rgb(0 0 0/.05);font-size:14px;${theme === "dark" ? "background:color-mix(in oklab,var(--input) 30%,transparent);" : ""}}.sel .ic{opacity:.5}.sel.sm{height:24px;font-size:11px;padding:0 8px}.sel.sm .ic{width:12px;height:12px}
.slider{position:relative;height:6px;background:var(--muted);border-radius:9999px;margin:14px 8px 8px 0}.slider i{position:absolute;inset:0 auto 0 0;background:var(--primary);border-radius:9999px}.slider b{position:absolute;top:-5px;width:16px;height:16px;margin-left:-8px;border-radius:50%;background:#fff;border:1px solid var(--primary);box-shadow:0 1px 2px rgb(0 0 0/.15)}
.swr{display:flex;justify-content:space-between;align-items:center}.swr label{margin:0}
.switch{width:32px;height:18px;border-radius:9999px;background:var(--input);position:relative}.switch.on{background:var(--primary)}.switch i{position:absolute;top:1px;left:1px;width:16px;height:16px;border-radius:50%;background:var(--background)}.switch.on i{left:15px;background:var(--primary-foreground)}
dl.cb{grid-template-columns:auto 1fr;gap:12px 16px;font-size:14px}dt{color:var(--muted-foreground)}dd{text-align:right;font-weight:500}

.mbtn.active{background:var(--sidebar-accent);color:var(--sidebar-accent-foreground);font-weight:500}
.btn.ghost{background:transparent;color:var(--foreground);border-color:transparent}.btn.bad{background:var(--destructive);color:#fff}
.badge.pri{background:color-mix(in oklab,var(--primary) 14%,transparent);color:var(--primary)}.badge.bad{background:color-mix(in oklab,var(--destructive) 14%,transparent);color:var(--destructive)}
.jobs{display:grid;gap:12px;max-width:940px}.job{display:flex;align-items:center;gap:16px;padding:16px 20px;border:1px solid var(--border);border-radius:var(--rxl);background:var(--card);box-shadow:0 1px 2px 0 rgb(0 0 0/.05)}
.jid{flex:1;min-width:0;display:grid;gap:3px}.jid b{font-weight:600}.jid small{font-size:13px;color:var(--muted-foreground)}.jid small.err{color:var(--destructive)}.jact{display:flex;gap:4px;margin:6px 0 0 -12px}
.jst{display:flex;align-items:center;gap:12px}.prog.w{width:140px;flex:none}
.sgrid{display:grid;grid-template-columns:1fr;gap:12px;max-width:760px}.card.sc{flex-direction:row;align-items:center;justify-content:space-between;gap:16px;padding:20px 24px}.card.sc>*{padding:0}
.sct h3{font-family:var(--font-heading);font-size:16px;font-weight:600}.sct p{color:var(--muted-foreground);font-size:13px;margin-top:4px}.scc{display:flex;gap:8px;align-items:center;flex:none}
.mono{font:500 13px "JBM",monospace;color:var(--muted-foreground)}.w200{width:180px}.w260{width:250px;font-size:13px}.w70{width:76px}.grow{flex:1}
.tg{display:inline-flex;border:1px solid var(--input);border-radius:var(--rm);overflow:hidden;box-shadow:0 1px 2px 0 rgb(0 0 0/.05)}.tg>span{height:34px;padding:0 12px;display:flex;align-items:center;gap:6px;font-size:14px;border-right:1px solid var(--input)}.tg>span:last-child{border-right:0}.tg>span.on{background:var(--accent);font-weight:500}.tg.mini>span{height:30px;padding:0 10px;font-size:13px}
.scrim{position:absolute;inset:0;background:rgb(0 0 0/.5);z-index:50}.modal{position:absolute;left:50%;transform:translateX(-50%);z-index:60;background:var(--popover);color:var(--popover-foreground);border:1px solid var(--border);box-shadow:0 20px 25px -5px rgb(0 0 0/.3),0 8px 10px -6px rgb(0 0 0/.2)}
.cmd{top:130px;width:580px;border-radius:var(--rxl);overflow:hidden}.cin{display:flex;align-items:center;gap:10px;height:52px;padding:0 16px;border-bottom:1px solid var(--border);font-size:15px}.cin .ic{opacity:.5}.caret{display:inline-block;width:1px;height:18px;background:var(--foreground);vertical-align:middle;margin-left:1px}
.clist{padding:6px}.cgh{font-size:12px;font-weight:500;color:var(--muted-foreground);padding:8px 8px 4px}.ci{display:flex;align-items:center;gap:12px;padding:8px;border-radius:var(--rm)}.ci.sel-on{background:var(--accent)}.ci div{flex:1}.ci b{font-weight:500;display:block;font-size:14px}.ci small{font-size:12px;color:var(--muted-foreground)}.ci em{font-style:normal;font-size:12px;color:var(--muted-foreground)}
.tile.sm{width:32px;height:32px}.tile.sm .ic{width:16px;height:16px}
.cfoot2{display:flex;gap:16px;padding:10px 16px;border-top:1px solid var(--border);font-size:12px;color:var(--muted-foreground)}.cfoot2 kbd{margin-right:3px}
.dlg{top:120px;width:520px;border-radius:var(--rl);padding:24px;display:grid;gap:16px}.dlg.sm2{top:300px;width:460px}
.dtile{width:48px;height:48px;border-radius:var(--rl);background:color-mix(in oklab,var(--primary) 14%,transparent);color:var(--primary);display:grid;place-items:center}.dtile .ic{width:24px;height:24px}
.dlg h2{font-family:var(--font-heading);font-size:20px;font-weight:600;letter-spacing:-.01em}.dsub{color:var(--muted-foreground);font-size:14px;line-height:1.55}
.plan{border:1px solid var(--border);border-radius:var(--rm);overflow:hidden}.step{display:flex;align-items:center;gap:14px;padding:12px 14px;border-bottom:1px solid var(--border)}.step:last-child{border:0}.step>div:not(.prog){flex:1}.step b{display:block;font-weight:500}.step small{color:var(--muted-foreground);font-size:12px}.idx{font:500 12px "JBM",monospace;color:var(--muted-foreground)}
.assure{display:grid;gap:8px;font-size:13px;color:var(--muted-foreground)}.assure span{display:flex;gap:8px;align-items:center}.assure .ic{color:var(--primary)}
.dfoot{display:flex;justify-content:flex-end;gap:8px}
.two-col{display:grid;grid-template-columns:1fr 1fr;gap:16px}.two-col.tight{gap:12px}
.ta{gap:12px;padding:16px 0}.tah{display:flex;justify-content:space-between;align-items:center}.tah b{font-weight:500}.tbox{min-height:140px;border:1px solid var(--input);border-radius:var(--rm);padding:12px;font:14px/1.6 "JBM",monospace;background:${theme === "dark" ? "color-mix(in oklab,var(--input) 30%,transparent)" : "transparent"}}
.hint{margin-top:16px;display:flex;align-items:center;gap:8px;color:var(--muted-foreground);font-size:14px}
.mrow{display:flex;align-items:center;gap:8px}.iconbtn .ic{width:16px;height:16px}
.phone{border:1px solid var(--border);border-radius:28px;background:var(--card);overflow:hidden;box-shadow:0 10px 15px -3px rgb(0 0 0/.15);height:520px;display:flex;flex-direction:column}
.phh{display:flex;align-items:center;gap:10px;padding:16px;border-bottom:1px solid var(--border)}.phh small{margin-left:auto;color:var(--muted-foreground)}.av{width:32px;height:32px;border-radius:50%;background:color-mix(in oklab,var(--primary) 18%,transparent);color:var(--primary);display:grid;place-items:center;font-weight:600}
.chat{flex:1;padding:16px;display:flex;flex-direction:column;gap:8px;background:var(--muted)}.bub{max-width:80%;padding:8px 12px;border-radius:14px;font-size:14px;display:grid;gap:2px}.bub small{font-size:10.5px;opacity:.65;justify-self:end}
.bub.them{background:var(--card);align-self:flex-start;border-bottom-left-radius:4px}.bub.me{background:var(--primary);color:var(--primary-foreground);align-self:flex-end;border-bottom-right-radius:4px}
.phf{padding:14px 16px;border-top:1px solid var(--border);color:var(--muted-foreground);font-size:14px}
.grid.two{grid-template-columns:1fr 1fr}
.sidebar.rail{width:56px}.rail .shead{padding:8px}.rail .mbtn{justify-content:center;padding:0;width:40px;margin:0 auto;height:40px}.rail .mbtn.lg{height:44px}.rail .mbtn.active{background:var(--sidebar-accent)}.rail .sfoot{padding:8px 0}.rail .scontent{padding-top:8px}.rail .menu{align-items:center}
`;

const size = { narrow: [800, 600] };
const page = (key, theme, screen) => {
  const v = variants[key];
  curHue = v.hue ?? hue;
  const [W, H] = size[screen] ?? [1440, 900];
  const crumbs = { tool: ["Video and audio", "Convert media", "Extract audio"], discard: ["Video and audio", "Convert media", "Extract audio"], queue: ["Queue"], history: ["History"], settings: ["Settings"],
    utility: ["Quick tools", "Work on text", "Change case"], chat: ["Mockups", "Chat mockup"] }[screen] ?? ["Tools"];
  const mains = { home: () => homeMain(v, false), hover: () => homeMain(v, true), tool: toolMain, discard: toolMain, queue: queueMain, history: historyMain, settings: settingsMain,
    palette: () => homeMain(v, false), install: () => homeMain(v, false), utility: utilityMain, chat: chatMain, narrow: narrowMain };
  const overlay = { palette: paletteOverlay, install: installOverlay, discard: discardOverlay }[screen]?.() ?? "";
  const side = screen === "narrow" ? rail(v) : sidebar(v, screen);
  return `<!doctype html><html lang="en" class="${theme}"><head><meta charset="utf-8"><title>${v.title} · ${theme} · ${screen}</title><style>${css(v, theme, W, H)}</style></head>
<body><div class="app">${side}<div class="wrap"><main class="inset">${header(crumbs)}${mains[screen]()}</main></div></div>${overlay}</body></html>`;
};

const outDir = process.argv[2] ?? "v2";
const only = process.argv[3];
mkdirSync(join(here, outDir, "html"), { recursive: true });
let n = 0;
for (const key of Object.keys(variants).filter((k) => (only ? k === only : k !== "b3"))) for (const theme of ["light", "dark"]) for (const screen of (process.argv[4] ? process.argv[4].split(",") : ["home", "hover", "tool"])) {
  writeFileSync(join(here, outDir, "html", `${key}-${theme}-${screen}.html`), page(key, theme, screen)); n++;
}
console.log(`built ${n} pages`);
