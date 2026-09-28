// Renders <dir>/html/*.html to <dir>/png/*.png at 1440x900 (dir defaults to docs/mockups; pass "v2" for round 2).
// Needs playwright-core and a Chromium (adjust executablePath).
import { chromium } from "playwright-core";
import { readdirSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const here = join(dirname(fileURLToPath(import.meta.url)), process.argv[2] ?? ".");
mkdirSync(join(here, "png"), { recursive: true });
const b = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium", args: ["--no-sandbox", "--allow-file-access-from-files"] });
const pg = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
for (const f of readdirSync(join(here, "html")).filter((n) => n.endsWith(".html"))) {
  await pg.setViewportSize(f.includes("narrow") ? { width: 800, height: 600 } : { width: 1440, height: 900 });
  await pg.goto("file://" + join(here, "html", f) + "?still");
  await pg.evaluate(() => document.fonts.ready);
  await pg.waitForTimeout(150);
  await pg.screenshot({ path: join(here, "png", f.replace(".html", ".png")) });
}
await b.close();
