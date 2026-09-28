// Renders the motion-graphics preview clips frame by frame and encodes them to WebM.
// Needs playwright-core, a Chromium, lucide-static icons and an ffmpeg with libvpx-vp9.
// LUCIDE=<lucide-static/icons> FFMPEG=<ffmpeg> FRAMES=<tmp dir> node render.mjs [ids...]
import { chromium } from "playwright-core";
import { readFileSync, mkdirSync, rmSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const { LUCIDE, FFMPEG, FRAMES = "/tmp/preview-frames" } = process.env;
const ids = process.argv.slice(2).length ? process.argv.slice(2) : ["ffmpeg", "qpdf", "jq", "qr"];
const need = ["file-video", "scissors", "rotate-cw", "check", "triangle-alert", "link", "download", "image"];
const ICONS = Object.fromEntries(need.map((n) => [n, readFileSync(join(LUCIDE, `${n}.svg`), "utf8").replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>[\s\S]*$/, "").replace(/<!--[\s\S]*?-->/g, "").trim()]));
mkdirSync(join(here, "out"), { recursive: true });
const b = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium", args: ["--no-sandbox", "--allow-file-access-from-files"] });
const FPS = 30, D = 6;
for (const id of ids) {
  const ctx = await b.newContext({ viewport: { width: 640, height: 360 }, deviceScaleFactor: 2 });
  await ctx.addInitScript((icons) => { window.ICONS = icons; }, ICONS);
  const pg = await ctx.newPage();
  pg.on("pageerror", (e) => console.error(id, "page error:", e.message));
  await pg.goto(`file://${join(here, "clip.html")}?id=${id}`);
  await pg.evaluate(() => window.ready);
  const dir = join(FRAMES, id); rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
  for (let i = 0; i < FPS * D; i++) {
    await pg.evaluate((t) => window.render(t), i / FPS);
    await pg.screenshot({ path: join(dir, `f${String(i).padStart(4, "0")}.png`) });
  }
  execFileSync(FFMPEG, ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", join(dir, "f%04d.png"), "-vf", "scale=960:540:flags=lanczos",
    "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "36", "-row-mt", "1", "-pix_fmt", "yuv420p", "-an", join(here, "out", `${id}.webm`)]);
  execFileSync(FFMPEG, ["-y", "-loglevel", "error", "-i", join(dir, "f0048.png"), "-vf", "scale=960:540", "-q:v", "3", join(here, "out", `${id}.jpg`)]);
  console.log(id, "ok");
  await ctx.close();
}
await b.close();
