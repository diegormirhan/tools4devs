// Captures the pieces of the real interface that the landing page's demo is
// assembled from: the shell, every sidebar group opened, each page in each state
// of the three walkthroughs, the command palette, and the app's own stylesheet.
// Re-run after any UI change and the demo follows.
//
//   npx vite build --config apps/desktop/vite.config.ts --outDir tmp/appbuild --emptyOutDir
//   npx vite --config apps/desktop/vite.config.ts --port 5199 --strictPort --host 127.0.0.1
//   node docs/landing/snap-demo.ts
//
// Writes into LANDING (default ../toolhaven-desktop-landing)/assets/demo/.
import { chromium, type Page } from "@playwright/test";
import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { installHost } from "../../e2e/host.ts";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../..");
const LANDING = resolve(process.env.LANDING ?? join(repo, "..", "toolhaven-desktop-landing"));
const OUT = join(LANDING, "assets", "demo");
const BUILD = resolve(process.env.APP_BUILD ?? join(repo, "tmp", "appbuild", "assets"));
const URL = process.env.APP_URL ?? "http://127.0.0.1:5199/";
mkdirSync(OUT, { recursive: true });

/* The stylesheet: font URLs repointed, and only the Latin faces kept. */
function stylesheet() {
  const css = readdirSync(BUILD).find((f) => f.endsWith(".css"));
  if (!css) throw new Error(`no stylesheet in ${BUILD}; build the app first`);
  const keep = /(inter|jetbrains-mono)-latin(-ext)?-(wght|400|500)-normal-[\w-]+\.woff2/;
  let text = readFileSync(join(BUILD, css), "utf8");
  // Drop @font-face blocks for scripts the demo never shows, and the .woff fallbacks.
  text = text.replace(/@font-face\{[^}]*\}/g, (block) => {
    const woff2 = block.match(/url\(\/assets\/([^)]+\.woff2)\)/);
    return woff2 && keep.test(woff2[1]) ? block.replace(/,url\([^)]+\.woff\)format\("woff"\)/g, "") : "";
  });
  text = text.replace(/url\(\/assets\//g, "url(/assets/demo/");
  writeFileSync(join(OUT, "app.css"), text);
  for (const f of readdirSync(BUILD)) if (keep.test(f)) copyFileSync(join(BUILD, f), join(OUT, f));
}

const COPY = {
  pt: {
    video: "C:/Vídeos/aula.mov", videoOut: "C:/Vídeos/aula-comprimida.mp4",
    pdfs: ["C:/Documentos/contrato.pdf", "C:/Documentos/anexo-1.pdf", "C:/Documentos/recibo.pdf"], pdfOut: "C:/Documentos/contrato-completo.pdf",
    compress: "comprimir midia", merge: "juntar pdf", hash: "gerador de hash", run: /Executar/, history: "Histórico", queue: /^Fila/,
  },
  en: {
    video: "C:/Videos/lecture.mov", videoOut: "C:/Videos/lecture-compressed.mp4",
    pdfs: ["C:/Documents/contract.pdf", "C:/Documents/appendix-1.pdf", "C:/Documents/receipt.pdf"], pdfOut: "C:/Documents/contract-complete.pdf",
    compress: "compress media", merge: "merge pdf", hash: "hash generator", run: /Run/, history: "History", queue: /^Queue/,
  },
} as const;
type Lang = keyof typeof COPY;

async function capture(lang: Lang) {
  const c = COPY[lang];
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  let saveTo: string = c.videoOut;
  await installHost(page, { available: ["ffmpeg", "ffprobe", "qpdf"], stepMs: 60_000 });
  await page.exposeFunction("__saveTo", () => saveTo);
  // The host's own job runner holds each job until the page lets it finish.
  await page.addInitScript(() => {
    const w = window as any;
    const invoke = w.__TAURI_INTERNALS__.invoke;
    w.__finish = null;
    w.__TAURI_INTERNALS__.invoke = async (cmd: string, args: any = {}) => {
      if (cmd === "plugin:app|version") return "5.0.0";
      if (cmd === "plugin:dialog|save") return w.__saveTo();
      if (cmd !== "execute_operation") return invoke(cmd, args);
      const r = args.request;
      const base = { jobId: r.jobId, toolId: r.toolId, operationId: r.operationId };
      w.__host.emit("operation-progress", { ...base, phase: "starting", progress: 0, message: `Starting ${r.toolId}.exe…` });
      await new Promise((resolve) => (w.__finish = resolve));
      w.__host.emit("operation-progress", { ...base, phase: "completed", progress: 1, message: "Operation finished." });
      return { executable: `${r.toolId}.exe`, stdout: "", stderr: "", outputPath: r.outputPath, message: "Operation finished." };
    };
  });
  await page.addInitScript((l) => {
    localStorage.setItem("tools4devs.language", l);
    localStorage.setItem("tools4devs.sidebar", "expanded");
  }, lang);
  await page.goto(URL);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);

  const settle = () => page.waitForTimeout(500);
  const html = (sel: string, inner = false) =>
    page.evaluate(([s, i]) => {
      const el = document.querySelector(s as string);
      if (!el) throw new Error(`missing ${s}`);
      return i ? el.innerHTML : el.outerHTML;
    }, [sel, inner] as const);
  const PAGE = "main[data-slot=sidebar-inset] > header + div";
  const T: any = { lang, pages: {}, headers: {}, groups: [], groupsHere: {}, footers: {}, palette: {} };

  // The shell, with the header and page emptied: the demo fills them.
  T.shell = await page.evaluate(() => {
    const wrap = document.querySelector("[data-slot=sidebar-wrapper]")!.cloneNode(true) as HTMLElement;
    wrap.querySelector("main > header")!.outerHTML = "<header data-demo-header></header>";
    wrap.querySelector("main > div")!.innerHTML = "";
    wrap.querySelector("main > div")!.setAttribute("data-demo-page", "");
    return wrap.outerHTML;
  });
  T.htmlClass = await page.evaluate(() => document.documentElement.className);
  T.bodyClass = await page.evaluate(() => document.body.className);
  T.headers.home = await html("main > header");
  T.footers.idle = await html("[data-slot=sidebar-footer]");
  // Home pages, trimmed to the first two groups of cards: nobody scrolls further in a demo.
  const home = () => page.evaluate((s) => {
    const el = document.querySelector(s)!.cloneNode(true) as HTMLElement;
    el.querySelectorAll("section[id^=section-]").forEach((sec, i) => { if (i > 1) sec.remove(); });
    return el.innerHTML;
  }, PAGE);
  T.pages.home = await home();

  // History before anything has run.
  await page.getByRole("button", { name: c.history, exact: true }).click();
  await settle();
  T.pages["history-empty"] = await html(PAGE, true);
  await page.goto(URL);
  await settle();

  // Home while a file hovers the window, and after one lands: the app suggests tools.
  const emit = (event: string, payload: unknown) =>
    page.evaluate(([e, p]) => (window as any).__host.emit(e, p), [event, payload] as const);
  await emit("tauri://drag-enter", { paths: [c.video], position: { x: 0, y: 0 } });
  await settle();
  T.pages["home-drag"] = await home();
  await emit("tauri://drag-leave", null);
  await page.evaluate((p) => (window as any).__host.drop([p]), c.video);
  await settle();
  T.pages["home-video"] = await home();
  await page.goto(URL);
  await settle();
  await page.evaluate((p) => (window as any).__host.drop(p), c.pdfs);
  await settle();
  T.pages["home-pdf"] = await home();
  await page.goto(URL);
  await settle();

  // Every group opened, one at a time, as the app allows.
  const groups = await page.getByRole("tree").getByRole("treeitem").count();
  for (let i = 0; i < groups; i++) {
    const item = page.locator("[role=tree] > li").nth(i);
    await item.locator("[role=treeitem]").first().click();
    await settle();
    T.groups.push({ open: await item.evaluate((el) => el.outerHTML) });
    await item.locator("[role=treeitem]").first().click(); // close again
    await settle();
    T.groups[i].closed = await item.evaluate((el) => el.outerHTML);
  }

  // The palette, empty and with results.
  await page.keyboard.press("Control+k");
  await settle();
  T.palette.empty = await page.evaluate(() => document.querySelector("[role=dialog]")!.outerHTML);
  T.palette.overlay = await page.evaluate(() => document.querySelector("[data-slot=dialog-overlay]")?.outerHTML ?? "");
  const rows: Record<string, string> = {};
  for (const q of [c.compress, c.merge, c.hash, "pdf", "video", "hash", "comp", "imag"]) {
    await page.getByRole("combobox").fill(q);
    await page.waitForTimeout(250);
    for (const opt of await page.locator("[role=option]").all()) {
      const key = (await opt.innerText()).replace(/\s+/g, " ").trim();
      rows[key] ??= await opt.evaluate((el) => el.outerHTML);
    }
  }
  T.palette.rows = rows;
  T.palette.groups = await page.evaluate(() => Array.from(document.querySelectorAll("[cmdk-group]")).map((g) => g.outerHTML));
  await page.keyboard.press("Escape");
  await settle();

  // Compress a video.
  await page.keyboard.press("Control+k");
  await page.getByRole("combobox").fill(c.compress);
  await page.waitForTimeout(250);
  await page.keyboard.press("Enter");
  await settle();
  T.headers.ffmpeg = await html("main > header");
  T.groupsHere.ffmpeg = await html("[role=tree] > li:has([data-active=true]), [role=tree] > li:has([aria-current])");
  T.pages.ffmpeg = await html(PAGE, true);
  await page.evaluate((p) => (window as any).__host.drop([p]), c.video);
  await settle();
  T.pages["ffmpeg-file"] = await html(PAGE, true);
  saveTo = c.videoOut;
  await page.getByRole("button", { name: c.run }).click();
  await settle();
  T.pages["ffmpeg-running"] = await html(PAGE, true);
  T.footers.running = await html("[data-slot=sidebar-footer]");
  await page.evaluate(() => (window as any).__finish());
  await page.getByRole("button", { name: c.run }).waitFor();
  await settle();
  T.pages["ffmpeg-done"] = await html(PAGE, true);
  await page.getByRole("button", { name: c.history, exact: true }).click();
  await settle();
  T.headers.history = await html("main > header");
  T.footers.history = await html("[data-slot=sidebar-footer]");
  T.pages.history = await html(PAGE, true);

  // Make a hash: a quick tool, nothing to discard on the way in.
  await page.keyboard.press("Control+k");
  await page.getByRole("combobox").fill(c.hash);
  await page.waitForTimeout(250);
  await page.keyboard.press("Enter");
  await settle();
  T.headers.hash = await html("main > header");
  T.groupsHere.hash = await html("[role=tree] > li:has([data-active=true]), [role=tree] > li:has([aria-current])");
  T.pages.hash = await html(PAGE, true);
  await page.locator(`${PAGE} textarea`).first().fill("abc");
  await settle();
  T.pages["hash-typed"] = await html(PAGE, true);

  // Merge PDFs.
  await page.keyboard.press("Control+k");
  await page.getByRole("combobox").fill(c.merge);
  await page.waitForTimeout(250);
  await page.keyboard.press("Enter");
  await settle();
  // Leaving the hash with text in it asks first; say yes.
  const discard = page.getByRole("alertdialog");
  if (await discard.isVisible().catch(() => false)) {
    await discard.getByRole("button").last().click();
    await settle();
  }
  T.headers.qpdf = await html("main > header");
  T.groupsHere.qpdf = await html("[role=tree] > li:has([data-active=true]), [role=tree] > li:has([aria-current])");
  T.pages.qpdf = await html(PAGE, true);
  await page.evaluate((p) => (window as any).__host.drop([p]), c.pdfs[0]);
  await settle();
  T.pages["qpdf-file"] = await html(PAGE, true);
  await page.evaluate((p) => (window as any).__host.drop(p), c.pdfs);
  await settle();
  T.pages["qpdf-files"] = await html(PAGE, true);
  saveTo = c.pdfOut;
  await page.getByRole("button", { name: c.run }).click();
  await settle();
  T.pages["qpdf-running"] = await html(PAGE, true);
  await page.evaluate(() => (window as any).__finish());
  await page.getByRole("button", { name: c.run }).waitFor();
  await settle();
  T.pages["qpdf-done"] = await html(PAGE, true);
  await page.getByRole("button", { name: c.history, exact: true }).click();
  await settle();
  T.pages.history2 = await html(PAGE, true);

  // React's and Radix's runtime ids mean nothing outside the app.
  const json = JSON.stringify(T).replace(/ (id|aria-controls|aria-labelledby|aria-describedby|for)=\\"(radix|_r_|«)[^"\\]*\\"/g, "");
  // The app's public brand files, which the shell points at by absolute path.
  const brand = join(OUT, "brand");
  mkdirSync(brand, { recursive: true });
  for (const [, file] of json.matchAll(/src=\\"\/brand\/([^"\\]+)\\"/g)) copyFileSync(join(repo, "apps/desktop/public/brand", file), join(brand, file));
  writeFileSync(join(OUT, `templates-${lang}.json`), json.replace(/src=\\"\/brand\//g, 'src=\\"/assets/demo/brand/'));
  console.log(lang, `${(json.length / 1024).toFixed(0)} KB`, Object.keys(T.pages).join(" "));
  await browser.close();
}

stylesheet();
const langs = (process.argv.slice(2) as Lang[]).filter((l) => l in COPY);
for (const lang of langs.length ? langs : (["pt", "en"] as Lang[])) await capture(lang);
