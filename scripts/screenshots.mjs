/**
 * Regenerates the README screenshots by driving headless Chrome over the DevTools
 * protocol. Nothing is captured but the page itself, and running it again reproduces
 * every image — a screenshot nobody can regenerate quietly starts lying after the next
 * change to the interface.
 *
 *   npm run dev            # in one terminal
 *   node scripts/screenshots.mjs [url] [--lang pt]
 *
 * --lang pt captures the Portuguese interface into docs/screenshots/pt/, for the
 * landing page's Portuguese version.
 */
import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";

const args = process.argv.slice(2);
const language = args.includes("--lang") ? args[args.indexOf("--lang") + 1] : "en";
const url = args.find((arg) => arg.startsWith("http")) ?? "http://127.0.0.1:5173/";
const outputDirectory = fileURLToPath(
  new URL(language === "en" ? "../docs/screenshots/" : `../docs/screenshots/${language}/`, import.meta.url),
);
const profileDirectory = path.join(os.tmpdir(), `tools4devs-shots-${process.pid}`);
const port = 9333;

const viewport = { width: 1280, height: 860, deviceScaleFactor: 3 };
const shots = [
  { file: "catalog-dark.png", theme: "dark" },
  { file: "catalog-light.png", theme: "light" },
  {
    file: "bundled-tools.png",
    theme: "dark",
    // Text and data is the category the installer-bundled tools live in.
    prepare: `document.querySelector("#section-data").scrollIntoView({ block: "center" })`,
  },
  {
    file: "install-dialog.png",
    theme: "dark",
    prepare: `document.querySelector('[aria-label="Get yt-dlp"]').click()`,
  },
];

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    path.join(os.homedir(), "AppData\\Local\\Google\\Chrome\\Application\\chrome.exe"),
  ].filter(Boolean);
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) throw new Error("Chrome not found. Set CHROME_PATH to its executable.");
  return found;
}

async function waitForDevTools() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (response.ok) return (await response.json()).webSocketDebuggerUrl;
    } catch {
      // Chrome has not opened the port yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error("Chrome never exposed its DevTools port.");
}

/** Minimal CDP client: send a command, resolve when its id comes back. */
function connect(endpoint) {
  const socket = new WebSocket(endpoint);
  const pending = new Map();
  let nextId = 0;

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    const entry = pending.get(message.id);
    if (!entry) return;
    pending.delete(message.id);
    if (message.error) entry.reject(new Error(message.error.message));
    else entry.resolve(message.result);
  });

  const ready = new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", () => reject(new Error("DevTools socket failed")), { once: true });
  });

  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      nextId += 1;
      pending.set(nextId, { resolve, reject });
      socket.send(JSON.stringify({ id: nextId, method, params, sessionId }));
    });

  return { ready, send, close: () => socket.close() };
}

async function main() {
  await mkdir(outputDirectory, { recursive: true });
  const chrome = spawn(
    findChrome(),
    [
      "--headless=new",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profileDirectory}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--hide-scrollbars",
      "--force-device-scale-factor=1",
      "about:blank",
    ],
    { stdio: "ignore" },
  );

  try {
    const client = connect(await waitForDevTools());
    await client.ready;

    // The landing page only uses the two catalog shots in other languages.
    for (const shot of language === "en" ? shots : shots.filter((s) => s.file.startsWith("catalog-"))) {
      const { targetId } = await client.send("Target.createTarget", { url: "about:blank" });
      const { sessionId } = await client.send("Target.attachToTarget", { targetId, flatten: true });

      await client.send("Emulation.setDeviceMetricsOverride", { ...viewport, mobile: false }, sessionId);
      // Setting the preference before the document runs shows the theme switch on the
      // segment that is actually active, instead of leaving it on "System".
      await client.send(
        "Page.addScriptToEvaluateOnNewDocument",
        {
          source:
            `localStorage.setItem("toolhaven.theme-preference", ${JSON.stringify(shot.theme)});` +
            `localStorage.setItem("toolhaven.language", ${JSON.stringify(language)});`,
        },
        sessionId,
      );
      await client.send("Page.enable", {}, sessionId);
      await client.send("Page.navigate", { url }, sessionId);
      // Vite serves instantly; the wait is for fonts and the entry animations to settle.
      await new Promise((resolve) => setTimeout(resolve, 2500));

      await client.send("Runtime.evaluate", { expression: "document.fonts.ready", awaitPromise: true }, sessionId);

      if (shot.prepare) {
        await client.send("Runtime.evaluate", { expression: shot.prepare }, sessionId);
        await new Promise((resolve) => setTimeout(resolve, 1200));
      }

      const { data } = await client.send("Page.captureScreenshot", { format: "png" }, sessionId);
      await writeFile(path.join(outputDirectory, shot.file), Buffer.from(data, "base64"));
      process.stdout.write(`${shot.file}  ${viewport.width}×${viewport.height} @${viewport.deviceScaleFactor}x\n`);

      await client.send("Target.closeTarget", { targetId });
    }
    client.close();
  } finally {
    chrome.kill();
    await rm(profileDirectory, { recursive: true, force: true }).catch(() => {});
  }
}

main().catch((error) => {
  process.stderr.write(`Screenshot run failed: ${error.message}\n`);
  process.exitCode = 1;
});
