// Renders the motion-graphics preview clips frame by frame and encodes them to WebM.
// Needs playwright-core, a Chromium, lucide-static icons and an ffmpeg with libvpx-vp9.
// LUCIDE=<lucide-static/icons> FFMPEG=<ffmpeg> FRAMES=<tmp dir> node render.mjs [ids...]
// FPS, WIDTH and CRF override the app's defaults; the landing page renders at
// FPS=60 WIDTH=1280 CRF=26, where the clips are watched larger and must stay legible.
import { chromium } from "playwright-core";
import { readFileSync, mkdirSync, rmSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
// OUT defaults to out/; point it at apps/desktop/public/previews to ship the clips.
const { LUCIDE, FFMPEG, FRAMES = "/tmp/preview-frames" } = process.env;
const OUT = process.env.OUT ?? join(here, "out");
const ids = process.argv.slice(2).length ? process.argv.slice(2) : ["ffmpeg", "qpdf", "jq", "qr"];
const need = ["file-video", "scissors", "rotate-cw", "check", "triangle-alert", "link", "download", "image", "search", "scan-search", "mic", "film", "audio-lines", "captions", "folder", "type", "file-text", "text-search", "folder-search", "map-pin", "archive", "table", "hard-drive", "binary"];
const ICONS = Object.fromEntries(need.map((n) => [n, readFileSync(join(LUCIDE, `${n}.svg`), "utf8").replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>[\s\S]*$/, "").replace(/<!--[\s\S]*?-->/g, "").trim()]));
mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium", args: ["--no-sandbox", "--allow-file-access-from-files"] });
const FPS = Number(process.env.FPS ?? 30), D = 6;
const WIDTH = Number(process.env.WIDTH ?? 960);
// The QR pattern compresses badly; a little more compression keeps it under 200 KB.
const CRF = { qr: "43" };
for (const id of ids) {
  const ctx = await b.newContext({ viewport: { width: 640, height: 360 }, deviceScaleFactor: 2 });
  await ctx.addInitScript((icons) => { window.ICONS = icons; }, ICONS);
  const pg = await ctx.newPage();
  pg.on("pageerror", (e) => console.error(id, "page error:", e.message));
  await pg.goto(`${pathToFileURL(join(here, "clip.html")).href}?id=${id}`);
  await pg.evaluate(() => window.ready);
  const dir = join(FRAMES, id); rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
  for (let i = 0; i < FPS * D; i++) {
    await pg.evaluate((t) => window.render(t), i / FPS);
    await pg.screenshot({ path: join(dir, `f${String(i).padStart(4, "0")}.png`) });
  }
  execFileSync(FFMPEG, ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", join(dir, "f%04d.png"), "-vf", `scale=${WIDTH}:-2:flags=lanczos`,
    "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", process.env.CRF ?? CRF[id] ?? "36", "-row-mt", "1", "-pix_fmt", "yuv420p", "-an", join(OUT, `${id}.webm`)]);
  execFileSync(FFMPEG, ["-y", "-loglevel", "error", "-i", join(dir, `f${String(Math.round(1.6 * FPS)).padStart(4, "0")}.png`), "-vf", `scale=${Math.min(WIDTH, 960)}:-2:flags=lanczos`, "-q:v", WIDTH > 960 ? "3" : "5", join(OUT, `${id}.jpg`)]);
  console.log(id, "ok");
  await ctx.close();
}
await b.close();
