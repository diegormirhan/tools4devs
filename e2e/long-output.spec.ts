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
