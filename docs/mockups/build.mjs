// Builds the static mockups (3 visual directions x 3 screens) into ./html and
// renders them to ./png with render.mjs. Nothing here is imported by the app.
// LUCIDE=<path to lucide-static/icons> node build.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const lucide = process.env.LUCIDE;
if (!lucide) throw new Error("Set LUCIDE to the lucide-static/icons folder");

const icon = (name, cls = "") => {
  const svg = readFileSync(join(lucide, `${name}.svg`), "utf8");
  return svg
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<svg[^>]*>/, (tag) => tag.replace(/\s(width|height|class)="[^"]*"/g, "").replace("<svg", `<svg class="ic ${cls}"`))
    .trim();
};

/* ---------- Data (mirrors apps/desktop/src/catalog/catalog.ts) ---------- */
const groups = [
  { id: "video", title: "Video and audio", icon: "clapperboard", tone: "clay", tools: [
    { id: "ffmpeg", title: "Convert media", icon: "clapperboard", engine: "FFMPEG", size: "84 MB", ops: 14,
      desc: "Convert, compress, resize, trim, and fourteen other jobs on video and audio." },
    { id: "ffprobe", title: "Inspect media", icon: "scan-search", engine: "FFPROBE", size: "84 MB", ops: 1,
      desc: "See codecs, tracks, dimensions and technical metadata." },
    { id: "songrec", title: "Name the music", icon: "music", engine: "SONGREC", size: "12 MB", ops: 2,
      desc: "Identify what is playing, from the speakers or the room." },
    { id: "mkvtoolnix", title: "Package Matroska", icon: "layers", engine: "MKVTOOLNIX", size: "31 MB", ops: 4,
      desc: "Merge, split and rebuild tracks inside MKV files." },
  ]},
  { id: "downloads", title: "Downloads", icon: "download", tone: "sage", tools: [
    { id: "yt-dlp", title: "Download media", icon: "download", engine: "YT-DLP", size: "18 MB", ops: 5,
      desc: "Save a video or just its audio from a link." },
    { id: "gallery-dl", title: "Download galleries", icon: "images", engine: "GALLERY-DL", size: "14 MB", ops: 2,
      desc: "Save whole image galleries in one go." },
  ]},
  { id: "images", title: "Images", icon: "image", tone: "ochre", tools: [
    { id: "libvips", title: "Adjust images", icon: "image" }, { id: "image-search", title: "Find where a picture came from", icon: "search" },
    { id: "imagemagick", title: "Image formats", icon: "wand-sparkles" }, { id: "oxipng", title: "Optimise PNG", icon: "minimize-2" },
    { id: "exiftool", title: "Metadata", icon: "tag" } ] },
  { id: "documents", title: "PDFs and documents", icon: "file-text", tone: "slate", tools: [
    { id: "qpdf", title: "Organise PDFs", icon: "file-text" }, { id: "poppler", title: "Extract from PDFs", icon: "file-output" },
    { id: "tesseract", title: "Read text from images", icon: "scan-text" }, { id: "pandoc", title: "Convert documents", icon: "file-type" } ] },
  { id: "data", title: "Text and data", icon: "braces", tone: "plum", tools: [
    { id: "jq", title: "Format JSON", icon: "braces" }, { id: "yq", title: "Work with YAML", icon: "file-json" },
    { id: "miller", title: "Spreadsheets and CSV", icon: "table" }, { id: "ripgrep", title: "Search a project", icon: "text-search" },
    { id: "fd", title: "Find files", icon: "folder-search" }, { id: "difftastic", title: "Compare files", icon: "git-compare" } ] },
  { id: "utilities", title: "Quick tools", icon: "sparkles", tone: "stone", tools: [
    { id: "text-tools", title: "Work on text", icon: "type" }, { id: "codes-hashes", title: "Codes and hashes", icon: "hash" },
    { id: "css-tools", title: "CSS generators", icon: "paintbrush" }, { id: "code-formatting", title: "Minify and format", icon: "code" },
    { id: "network", title: "Network lookups", icon: "globe" }, { id: "qr-barcode", title: "QR codes and barcodes", icon: "qr-code" } ] },
  { id: "calculators", title: "Calculators", icon: "calculator", tone: "rose", tools: [
    { id: "math-finance", title: "Math, finance and health", icon: "calculator" }, { id: "dates-time", title: "Dates and time", icon: "calendar" },
    { id: "everyday", title: "Everyday calculators", icon: "sparkles" }, { id: "random-picks", title: "Random picks", icon: "dices" },
    { id: "test-data", title: "Test data", icon: "flask-conical" }, { id: "colors", title: "Colour tools", icon: "palette" } ] },
  { id: "files", title: "Files and disk", icon: "archive", tone: "teal", tools: [
    { id: "7zip", title: "Compress files", icon: "archive" }, { id: "dust", title: "Disk usage", icon: "hard-drive" },
    { id: "tokei", title: "Count code", icon: "chart-column" }, { id: "hexyl", title: "View bytes", icon: "binary" } ] },
  { id: "mockups", title: "Mockups", icon: "layout-template", tone: "sand", tools: [
    { id: "chat-mockup", title: "Chat mockup", icon: "message-square" }, { id: "post-mockup", title: "Post mockup", icon: "layout-template" } ] },
];
const counts = { video: 4, downloads: 2, images: 5, documents: 4, data: 6, utilities: 6, calculators: 6, files: 4, mockups: 2 };
const ffmpegOps = ["Convert format", "Compress media", "Trim a section", "Resize video", "Crop video", "Rotate video",
  "Change speed", "Change frame rate", "Extract audio", "Remove audio", "Normalise loudness", "Make a GIF", "Grab a frame", "Contact sheet"];
const activeOp = "Extract audio";

/* ---------- Directions ---------- */
const dirs = {
  fluent: {
    name: "A · Calm and native (Fluent / DevToys)",
    font: `"Inter Variable", system-ui, sans-serif`,
    vars: `--bg:#111113;--sb:#18181b;--card:#1a1a1e;--card2:#202025;--bd:#2b2b31;--fg:#f4f4f5;--mut:#a1a1aa;--acc:#88afff;--accbg:rgba(136,175,255,.14);--acc2:#d8a64f;--onacc:#0b1220;--r:10px;--sbw:292px;--rowh:31px;--hf:var(--font);--hw:600;--hs:26px;--tile:#232329;`,
  },
  editorial: {
    name: "B · Editorial and warm",
    font: `"Inter Variable", system-ui, sans-serif`,
    vars: `--bg:#f7f3ec;--sb:#efe9de;--card:#fffdf8;--card2:#f8f3e9;--bd:#ded6c6;--fg:#1f1b16;--mut:#6f6759;--acc:#b4532a;--accbg:rgba(180,83,42,.12);--acc2:#3f6b5a;--onacc:#fff8f0;--r:6px;--sbw:292px;--rowh:31px;--hf:"Fraunces Variable", Georgia, serif;--hw:600;--hs:34px;--tile:#efe8da;`,
  },
  dense: {
    name: "C · Dense, IDE-style",
    font: `"Inter Variable", system-ui, sans-serif`,
    vars: `--bg:#1e1e1e;--sb:#181818;--card:#242426;--card2:#2a2a2d;--bd:#333336;--fg:#e4e4e7;--mut:#8b8b93;--acc:#4ec9a0;--accbg:rgba(78,201,160,.14);--acc2:#e5c07b;--onacc:#06231a;--r:4px;--sbw:264px;--rowh:26px;--hf:var(--font);--hw:600;--hs:20px;--tile:#2d2d31;`,
  },
};
const tones = {
  clay: ["#f3d9cc", "#9a3f1a"], sage: ["#dde7d3", "#3f6b3a"], ochre: ["#f2e3bc", "#8a6510"], slate: ["#d7e0ec", "#35507a"],
  plum: ["#e6dcee", "#66407f"], stone: ["#e7e1d2", "#5b5443"], rose: ["#f2d8d8", "#8f3b3b"], teal: ["#d5e7e3", "#276b5f"], sand: ["#eadcc8", "#7a5a2d"],
};

/* ---------- Building blocks ---------- */
const sidebar = ({ screen, dir }) => {
  const pinned = screen === "home" || screen === "hover"
    ? `<div class="sec">Pinned</div>
       <a class="row"><span class="ico">${icon("clapperboard")}</span><span class="lbl">Convert media</span>${icon("star", "star on")}</a>
       <a class="row"><span class="ico">${icon("type")}</span><span class="lbl">Work on text</span>${icon("star", "star on")}</a>` : "";
  const tree = groups.map((g) => {
    const open = g.id === "video";
    const head = `<a class="row grp ${open ? "open" : ""}">${icon(open ? "chevron-down" : "chevron-right", "chev")}<span class="ico">${icon(g.icon)}</span><span class="lbl">${g.title}</span><span class="cnt">${counts[g.id]}</span></a>`;
    if (!open) return head;
    const tools = g.tools.map((t) => {
      const isActive = screen === "tool" && t.id === "ffmpeg";
      const row = `<a class="row tool ${isActive ? "trail" : ""}"><span class="ico">${icon(t.icon)}</span><span class="lbl">${t.title}</span>${isActive ? icon("chevron-down", "chev r") : ""}</a>`;
      if (!isActive) return row;
      const subs = ["Convert format", "Compress media", "Trim a section", "Extract audio", "Make a GIF"].map((o) =>
        `<a class="row sub ${o === activeOp ? "active" : ""}"><span class="lbl">${o}</span></a>`).join("");
      return row + `<div class="subs">${subs}<a class="row sub more"><span class="lbl">9 more…</span></a></div>`;
    }).join("");
    return head + `<div class="kids">${tools}</div>`;
  }).join("");
  return `<aside class="sb" aria-label="Sidebar">
    <div class="brand"><img src="../../../apps/desktop/public/brand/tools4devs-mark.svg" alt=""><div><b>tools4devs</b><small>Local tools</small></div></div>
    <a class="search">${icon("search")}<span>Search tools</span><kbd>Ctrl K</kbd></a>
    <nav class="tree">${pinned}<div class="sec">All tools</div>${tree}</nav>
    <div class="foot">
      <a class="row"><span class="ico">${icon("list-checks")}</span><span class="lbl">Queue</span><span class="badge">2</span></a>
      <a class="row"><span class="ico">${icon("history")}</span><span class="lbl">History</span></a>
      <a class="row"><span class="ico">${icon("settings")}</span><span class="lbl">Settings</span></a>
      <div class="status"><i></i>Windows x64 · runs on this machine</div>
    </div></aside>`;
};

const card = (t, group, dir, extra = "") => {
  const [tb, tf] = tones[group.tone];
  const art = dir === "editorial"
    ? `<div class="art" style="background:${tb};color:${tf}">${icon(t.icon, "big")}<span class="eng" style="color:${tf}">${t.engine}</span></div>` : "";
  const tile = dir === "editorial" ? "" : `<span class="tile">${icon(t.icon)}</span>`;
  const meta = dir === "dense"
    ? `<span class="eng">${t.engine}</span>`
    : dir === "fluent" ? `<span class="eng">${t.engine}</span>` : "";
  return `<article class="card ${extra}">${art}
    <div class="cbody">
      <div class="ctop">${tile}<div class="ctitle"><h3>${t.title}</h3>${meta}</div></div>
      <p>${t.desc}</p>
      <div class="cfoot"><span class="pill">${icon("download-cloud")}In-app download · ${t.size}</span><span class="opsn">${t.ops} ${t.ops === 1 ? "action" : "actions"}</span></div>
    </div></article>`;
};

const videoFrame = () => `<div class="vid">
  <div class="win"><div class="wbar"><i></i><i></i><i></i><span>Convert media · Extract audio</span></div>
    <div class="wbody">
      <div class="file">${icon("file-video")}<div><b>holiday-2025.mov</b><small>4K · 1.2 GB · 03:42</small></div></div>
      <div class="fld"><small>Output format</small><div class="sel">MP3 <span>${icon("chevron-down")}</span></div></div>
      <div class="run"><div class="prog"><i style="width:62%"></i></div><span>62%</span></div>
    </div>
    <svg class="cursor" viewBox="0 0 24 24"><path d="M5 3l14 8-6.2 1.8L10 19z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg>
  </div>
  <span class="tc">0:03</span><span class="loop">${icon("play")} Preview · muted loop</span></div>`;

const chips = (n = 5) => ffmpegOps.slice(0, n).map((o) => `<span class="chip">${o}</span>`).join("") +
  `<span class="chip more">+${ffmpegOps.length - n}</span>`;

const homeMain = (dir, hover) => {
  const vg = groups[0], dg = groups[1];
  const cells = vg.tools.map((t, i) => {
    const hov = hover && i === 0;
    return `<div class="cell ${hover ? "dim" : ""} ${hov ? "hot" : ""}">${card(t, vg, dir)}${hov ? `
      <div class="pop">${videoFrame()}
        <div class="pbody">
          <div class="ptop"><span class="tile">${icon(t.icon)}</span><div><h3>${t.title}</h3><small class="eng">${t.engine} · ${t.size} download</small></div>
            <button class="btn">Get it ${icon("download")}</button></div>
          <p>${t.desc}</p>
          <div class="what">What you can do</div><div class="chips">${chips(6)}</div>
        </div></div>` : ""}</div>`;
  }).join("");
  const dcells = dg.tools.map((t) => `<div class="cell ${hover ? "dim" : ""}">${card(t, dg, dir)}</div>`).join("");
  return `<header class="top"><div><h1>${dir === "editorial" ? "What would you like to do today?" : "What do you want to do?"}</h1>
      <p>Pick a tool on the left, or drop a file on this window and we will suggest what fits.</p></div>
      <button class="btn ghost">${icon("upload")} Choose a file</button></header>
    <section><div class="shead"><h2>${vg.title}</h2><span>${vg.tools.length} tools</span></div><div class="grid">${cells}</div></section>
    <section><div class="shead"><h2>${dg.title}</h2><span>${dg.tools.length} tools</span></div><div class="grid">${dcells}</div></section>`;
};

const toolMain = () => `<header class="top crumb"><div>
    <div class="bc">Video and audio ${icon("chevron-right")} Convert media ${icon("chevron-right")} <b>Extract audio</b></div>
    <h1>Extract audio</h1><p>Write an audio file from the video.</p></div>
    <span class="pill ok">${icon("circle-check")} FFmpeg 7.1 ready</span></header>
  <div class="toolpage">
    <div class="col">
      <div class="drop"><span class="tile big">${icon("file-video")}</span>
        <div><b>holiday-2025.mov</b><small>4K · 1.2 GB · 03:42 · AAC stereo</small></div><button class="btn ghost sm">Change file</button></div>
      <div class="panel"><h4>Options</h4>
        <div class="f2"><label>Output format</label><div class="sel">MP3 <span>${icon("chevron-down")}</span></div></div>
        <div class="f2"><label>Quality <em>192 kbps</em></label><div class="slider"><i style="width:58%"></i><b style="left:58%"></b></div></div>
        <div class="f2 sw"><label>Keep title and artist tags</label><div class="switch on"><i></i></div></div>
        <div class="f2"><label>Save to</label><div class="sel">C:\\Users\\you\\Music ${icon("chevron-down")}</div></div>
      </div>
    </div>
    <div class="col side">
      <div class="panel"><h4>Summary</h4>
        <dl><dt>From</dt><dd>holiday-2025.mov</dd><dt>To</dt><dd>holiday-2025.mp3</dd><dt>Estimated size</dt><dd>≈ 5.1 MB</dd><dt>Runs</dt><dd>On your machine, no upload</dd></dl>
        <button class="btn block">${icon("audio-lines")} Extract audio</button>
        <button class="btn ghost block">Add to queue</button></div>
    </div>
  </div>`;

const css = (dir) => `
@font-face{font-family:"Inter Variable";src:url(../fonts/inter.woff2) format("woff2");font-weight:100 900}
@font-face{font-family:"Fraunces Variable";src:url(../fonts/fraunces.woff2) format("woff2");font-weight:100 900}
@font-face{font-family:"JBM";src:url(../fonts/jetbrains-mono-latin-400-normal.woff2) format("woff2");font-weight:400}
@font-face{font-family:"JBM";src:url(../fonts/jetbrains-mono-latin-500-normal.woff2) format("woff2");font-weight:500}
*{box-sizing:border-box;margin:0;padding:0}
:root{--font:${dirs[dir].font};${dirs[dir].vars}}
html,body{width:1440px;height:900px;overflow:hidden;background:var(--bg)}
body{font-family:var(--font);color:var(--fg);-webkit-font-smoothing:antialiased;font-size:14px}
.ic{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;flex:none}
.app{display:grid;grid-template-columns:var(--sbw) 1fr;height:900px}
.sb{background:var(--sb);border-right:1px solid var(--bd);display:flex;flex-direction:column;min-height:0;padding:14px 10px}
.brand{display:flex;gap:10px;align-items:center;padding:4px 8px 14px}
.brand img{width:34px;height:34px;border-radius:9px}
.brand b{display:block;font-family:var(--hf);font-size:${dir === "editorial" ? 19 : 15}px;font-weight:600;letter-spacing:-.01em}
.brand small{color:var(--mut);font-size:11.5px}
.search{display:flex;align-items:center;gap:8px;height:36px;padding:0 10px;border:1px solid var(--bd);border-radius:var(--r);background:var(--card);color:var(--mut);font-size:13px;margin-bottom:10px}
.search span{flex:1}.search kbd{font:11px "JBM",monospace;border:1px solid var(--bd);border-radius:4px;padding:1px 5px}
.tree{flex:1;min-height:0;overflow:hidden}
.sec{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--mut);padding:12px 10px 6px;${dir === "dense" ? `font-family:"JBM",monospace;font-size:10.5px;` : ""}}
.row{display:flex;align-items:center;gap:9px;height:var(--rowh);padding:0 10px;border-radius:calc(var(--r) - 2px);color:var(--fg);font-size:${dir === "dense" ? 13 : 14}px;white-space:nowrap}
.row .ico{display:grid;place-items:center;color:var(--mut)}.row .lbl{flex:1;overflow:hidden;text-overflow:ellipsis}
.row .cnt{font-size:12px;color:var(--mut)}.row.grp{font-weight:${dir === "dense" ? 500 : 550}}
.row.grp .chev{width:14px;height:14px;color:var(--mut);margin-left:-4px}.row.grp.open{background:${dir === "editorial" ? "rgba(0,0,0,.04)" : "rgba(255,255,255,.04)"}}
.kids{margin:2px 0 6px 18px;padding-left:8px;border-left:1px solid var(--bd)}
.row.tool.trail{font-weight:600}.row.tool .chev{width:14px;height:14px;color:var(--mut)}
.subs{margin:2px 0 6px 14px;padding-left:8px;border-left:1px solid var(--bd)}
.row.sub{height:calc(var(--rowh) - 3px);font-size:13px;color:var(--mut)}
.row.sub.active{background:var(--accbg);color:var(--acc);font-weight:600}
.row.sub.more{font-style:italic}
.star{width:14px;height:14px;color:var(--acc2)}.star.on{fill:var(--acc2)}
.foot{border-top:1px solid var(--bd);padding-top:8px;margin-top:8px}
.badge{background:var(--acc);color:var(--onacc);font-size:11px;font-weight:700;border-radius:99px;padding:1px 7px}
.status{display:flex;align-items:center;gap:8px;color:var(--mut);font-size:11.5px;padding:10px 10px 2px}.status i{width:7px;height:7px;border-radius:50%;background:var(--acc)}
main{padding:30px 40px;overflow:hidden;position:relative}
.top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:26px;gap:20px}
h1{font-family:var(--hf);font-size:var(--hs);font-weight:var(--hw);letter-spacing:-.02em;line-height:1.1}
.top p{color:var(--mut);margin-top:8px;font-size:${dir === "dense" ? 13 : 14.5}px}
.btn{display:inline-flex;align-items:center;gap:7px;height:36px;padding:0 14px;border-radius:calc(var(--r) - 2px);background:var(--acc);color:var(--onacc);border:1px solid transparent;font:600 13.5px var(--font)}
.btn.ghost{background:transparent;color:var(--fg);border-color:var(--bd)}.btn.sm{height:30px;font-size:12.5px}.btn.block{width:100%;justify-content:center;height:40px;margin-top:10px}
.shead{display:flex;justify-content:space-between;align-items:baseline;border-bottom:1px solid var(--bd);padding-bottom:9px;margin-bottom:16px}
.shead h2{font-family:var(--hf);font-size:${dir === "editorial" ? 20 : 15}px;font-weight:600}.shead span{color:var(--mut);font-size:12.5px}
section{margin-bottom:28px}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:${dir === "dense" ? 10 : 16}px}
.cell{position:relative}.cell.dim .card{opacity:.5}.cell.hot .card{opacity:.25}
.card{background:var(--card);border:1px solid var(--bd);border-radius:var(--r);overflow:hidden;display:flex;flex-direction:column;height:${dir === "editorial" ? 204 : dir === "dense" ? 104 : 156}px}
.cbody{padding:${dir === "dense" ? "12px 14px" : "16px"};display:flex;flex-direction:column;flex:1}
.ctop{display:flex;gap:12px;align-items:center}.ctitle{flex:1;min-width:0;display:flex;${dir === "dense" ? "justify-content:space-between;align-items:baseline;gap:8px" : "flex-direction:column;gap:2px"}}
.ctitle h3{font-family:var(--hf);font-size:${dir === "editorial" ? 18 : 14.5}px;font-weight:600;letter-spacing:-.005em}
.eng{font:500 10.5px "JBM",monospace;letter-spacing:.05em;color:var(--mut)}
.tile{width:${dir === "dense" ? 30 : 40}px;height:${dir === "dense" ? 30 : 40}px;border-radius:${dir === "fluent" ? 10 : 6}px;background:var(--tile);display:grid;place-items:center;color:var(--acc);flex:none}
.tile .ic{width:${dir === "dense" ? 16 : 20}px;height:${dir === "dense" ? 16 : 20}px}.tile.big{width:48px;height:48px}
.card p{color:var(--mut);font-size:${dir === "dense" ? 12.5 : 13}px;line-height:1.45;margin-top:${dir === "dense" ? 4 : 10}px;${dir === "dense" ? "overflow:hidden;display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical" : ""}}
.cfoot{margin-top:auto;display:${dir === "dense" ? "none" : "flex"};justify-content:space-between;align-items:center;padding-top:10px}
.pill{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;color:var(--mut);border:1px solid var(--bd);border-radius:99px;padding:3px 9px}.pill .ic{width:13px;height:13px}
.pill.ok{color:var(--acc);border-color:var(--accbg);background:var(--accbg)}.opsn{font-size:11.5px;color:var(--mut)}
.art{height:72px;display:flex;align-items:flex-end;justify-content:space-between;padding:14px 16px}.art .big{width:40px;height:40px;stroke-width:1.6}.art .eng{font-weight:500}
.pop{position:absolute;left:-18px;top:-14px;width:calc(100% + 36px);z-index:10;background:var(--card2);border:1px solid var(--bd);border-radius:calc(var(--r) + 4px);overflow:hidden;box-shadow:0 30px 70px -10px rgba(0,0,0,.55),0 0 0 1px rgba(255,255,255,.03)}
.vid{position:relative;height:214px;align-content:start;padding-top:16px;background:${dir === "editorial" ? "#2a241d" : "#0d0d10"};display:grid;place-items:center;overflow:hidden}
.win{width:78%;background:${dir === "editorial" ? "#f7f3ec" : "#18181b"};border:1px solid ${dir === "editorial" ? "#cfc6b4" : "#33333a"};border-radius:8px;box-shadow:0 10px 30px rgba(0,0,0,.4);position:relative;overflow:hidden}
.wbar{display:flex;gap:5px;align-items:center;padding:7px 9px;border-bottom:1px solid var(--bd);font-size:10px;color:var(--mut)}.wbar i{width:7px;height:7px;border-radius:50%;background:var(--bd)}.wbar span{margin-left:6px}
.wbody{padding:10px;display:grid;gap:8px}.file{display:flex;gap:8px;align-items:center;border:1px solid var(--bd);border-radius:6px;padding:6px 8px}.file .ic{color:var(--acc)}.file b{font-size:11px;display:block}.file small{font-size:9.5px;color:var(--mut)}
.fld small{font-size:9.5px;color:var(--mut);display:block;margin-bottom:3px}.sel{display:flex;justify-content:space-between;align-items:center;gap:6px;border:1px solid var(--bd);border-radius:6px;padding:0 9px;height:32px;font-size:13px;background:var(--card)}
.wbody .sel{height:24px;font-size:11px}.sel .ic,.sel span{color:var(--mut)}.sel span{display:flex}
.slider{position:relative;height:4px;background:var(--bd);border-radius:9px;margin:9px 2px}.slider i{position:absolute;left:0;top:0;bottom:0;background:var(--acc);border-radius:9px}.slider b{position:absolute;top:-5px;width:14px;height:14px;margin-left:-7px;border-radius:50%;background:#fff;border:2px solid var(--acc)}
.run{display:flex;align-items:center;gap:8px;font-size:10px;color:var(--mut)}.prog{flex:1;height:5px;background:var(--bd);border-radius:9px;overflow:hidden}.prog i{display:block;height:100%;background:var(--acc)}
.cursor{position:absolute;width:20px;height:20px;right:30%;top:58%}
.tc{position:absolute;right:10px;bottom:8px;font:500 10.5px "JBM",monospace;background:rgba(0,0,0,.6);color:#fff;padding:2px 6px;border-radius:4px}
.loop{position:absolute;left:10px;bottom:8px;font-size:10.5px;background:rgba(0,0,0,.6);color:#fff;padding:2px 8px 2px 6px;border-radius:99px;display:flex;align-items:center;gap:5px}.loop .ic{width:10px;height:10px;fill:#fff}
.pbody{padding:16px}.ptop{display:flex;gap:12px;align-items:center}.ptop>div{flex:1}.ptop h3{font-family:var(--hf);font-size:${dir === "editorial" ? 19 : 16}px;font-weight:600}
.pbody p{color:var(--mut);font-size:13px;margin:12px 0 14px;line-height:1.5}.what{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--mut);margin-bottom:8px}
.chips{display:flex;flex-wrap:wrap;gap:6px}.chip{font-size:12px;border:1px solid var(--bd);border-radius:${dir === "dense" ? 4 : 99}px;padding:3px 10px;background:var(--card)}.chip.more{color:var(--acc);border-color:var(--accbg)}
.bc{display:flex;align-items:center;gap:6px;color:var(--mut);font-size:12.5px;margin-bottom:12px}.bc .ic{width:13px;height:13px}.bc b{color:var(--fg);font-weight:600}
.toolpage{display:grid;grid-template-columns:1fr 340px;gap:20px}.col{display:grid;gap:16px;align-content:start}
.drop{display:flex;align-items:center;gap:14px;border:1.5px dashed var(--bd);border-radius:var(--r);padding:18px;background:var(--card)}.drop>div{flex:1}.drop b{display:block;font-size:14.5px}.drop small{color:var(--mut);font-size:12.5px}
.panel{background:var(--card);border:1px solid var(--bd);border-radius:var(--r);padding:18px}.panel h4{font-family:var(--hf);font-size:14px;margin-bottom:14px}
.f2{margin-bottom:16px}.f2 label{display:flex;justify-content:space-between;font-size:12.5px;color:var(--mut);margin-bottom:7px}.f2 label em{font-style:normal;color:var(--fg)}
.f2.sw{display:flex;justify-content:space-between;align-items:center}.f2.sw label{margin:0;color:var(--fg);font-size:13.5px}
.switch{width:38px;height:22px;border-radius:99px;background:var(--bd);position:relative}.switch.on{background:var(--acc)}.switch i{position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:#fff}.switch.on i{left:19px}
dl{display:grid;grid-template-columns:auto 1fr;gap:9px 14px;font-size:13px}dt{color:var(--mut)}dd{text-align:right}
.side .panel{position:sticky;top:0}
`;

const page = (dir, screen) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${dirs[dir].name} · ${screen}</title><style>${css(dir)}</style></head>
<body><div class="app">${sidebar({ screen, dir })}<main>${screen === "tool" ? toolMain() : homeMain(dir, screen === "hover")}</main></div></body></html>`;

mkdirSync(join(here, "html"), { recursive: true });
for (const dir of Object.keys(dirs))
  for (const screen of ["home", "hover", "tool"])
    writeFileSync(join(here, "html", `${dir}-${screen}.html`), page(dir, screen));
console.log("built 9 pages");
