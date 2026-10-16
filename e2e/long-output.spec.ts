import { expect, search, test } from "./fixtures";

const files = { openDialog: "C:/docs/contract.pdf", saveDialog: "C:/out/contract-rotated.pdf" };
const bundled = ["jq", "yq", "ripgrep", "fd", "oxipng", "miller", "hexyl", "tokei", "dust", "qpdf"];

// What a downloader really prints: one line per moment, and URLs that never break.
const progressLine = "[download] 87.5% of ~ 255.25KiB at 58.39KiB/s ETA Unknown (frag 13/15) and a very long tail that goes on and on and on, as a progress line does when it carries a URL";
const log = [
  "[Pinterest] Extracting URL: https://www.pinterest.com/pin/1133288693748930875/sent/?invite_code=ca43936f82ac46a0b810bd63e440037&sender=734720264117477261&sfo=1",
  ...Array.from({ length: 40 }, (_, index) => `[download]  ${(index / 4 + 0.3).toFixed(1)}% of ~ 14.53KiB at 1.03KiB/s ETA Unknown (frag ${index % 15}/15)`),
  "[download] 100% of 1.52MiB in 00:00:09 at 164.01KiB/s",
  "[Merger] Merging formats into video.mp4",
].join("\n");

async function startJob(page: import("@playwright/test").Page) {
  await page.goto("/");
  await search(page, "rotate pages");
  const tool = page.getByRole("region", { name: "Organise PDFs" });
  await tool.getByRole("button", { name: /choose files/i }).click();
  await tool.getByRole("button", { name: "Run" }).click();
  return tool;
}

test.describe("a long progress line in a narrow window", () => {
  test.use({ host: { available: bundled, ...files, progressMessage: progressLine, stepMs: 400 }, viewport: { width: 520, height: 900 } });

  test("stays inside the Summary card and never widens the page", async ({ page }) => {
    const tool = await startJob(page);
    const summary = tool.getByRole("region", { name: "Summary" });
    await expect(summary.getByText(/87\.5% of/)).toBeVisible();

    const box = await summary.boundingBox();
    expect(box!.x + box!.width).toBeLessThanOrEqual(520);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });
});

test.describe("a download that leaves a long log", () => {
  test.use({ host: { available: bundled, ...files, stdout: log }, viewport: { width: 1280, height: 900 } });

  test("keeps the last progress line only, wraps what cannot break, and leaves the Summary alone", async ({ page }) => {
    const tool = await startJob(page);
    const result = tool.getByRole("status").filter({ hasText: "Extracting URL" });
    await expect(result).toBeVisible();

    const text = (await result.textContent()) ?? "";
    expect((text.match(/\[download\]/g) ?? []).length).toBe(1);
    expect(text).toContain("100% of 1.52MiB");
    expect(text).toContain("Merging formats");

    const [logBox, summaryBox] = await Promise.all([result.boundingBox(), tool.getByRole("region", { name: "Summary" }).boundingBox()]);
    expect(logBox!.x + logBox!.width).toBeLessThanOrEqual(summaryBox!.x);
  });
});

// The Summary card is a fixed 320 px column in a wide window; what it holds must stay inside it.
test.describe("a long progress line in a wide window", () => {
  test.use({ host: { available: bundled, ...files, progressMessage: progressLine, stepMs: 600 }, viewport: { width: 1280, height: 900 } });

  test("keeps the progress line and the bar inside the Summary card", async ({ page }) => {
    const tool = await startJob(page);
    const summary = tool.getByRole("region", { name: "Summary" });
    await expect(summary.getByText(/87\.5% of/)).toBeVisible();

    const card = (await summary.boundingBox())!;
    for (const part of [summary.getByRole("progressbar"), summary.getByText(/87\.5% of/), summary.getByRole("button", { name: "Stop" })]) {
      const box = (await part.boundingBox())!;
      expect(box.x + box.width, "right edge").toBeLessThanOrEqual(card.x + card.width);
      expect(box.x, "left edge").toBeGreaterThanOrEqual(card.x);
    }
  });
});

test.describe("the same long lines in the Queue and the History", () => {
  test.use({ host: { available: bundled, ...files, progressMessage: progressLine, stdout: log, stepMs: 700 }, viewport: { width: 900, height: 900 } });

  test("stay inside their cards and never widen the page", async ({ page }) => {
    await startJob(page);
    const noSideScroll = () =>
      page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

    await page.getByRole("button", { name: /^Queue/ }).click();
    const job = page.getByRole("article", { name: "Rotate pages — Organise PDFs" });
    await expect(job.getByText(/87\.5% of/)).toBeVisible();
    const card = (await job.boundingBox())!;
    const line = (await job.getByText(/87\.5% of/).boundingBox())!;
    expect(line.x + line.width).toBeLessThanOrEqual(card.x + card.width);
    expect(await noSideScroll()).toBeLessThanOrEqual(0);

    await page.getByRole("button", { name: "History", exact: true }).click();
    const entry = page.getByRole("article", { name: "Rotate pages — Organise PDFs" });
    await expect(entry).toContainText("Done");
    const entryBox = (await entry.boundingBox())!;
    expect(entryBox.x + entryBox.width).toBeLessThanOrEqual(900);
    expect(await noSideScroll()).toBeLessThanOrEqual(0);
  });
});
