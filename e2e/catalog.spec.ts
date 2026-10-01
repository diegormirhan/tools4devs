import { expect, test } from "./fixtures";

test("UC-02: hovering a card plays its clip after a pause, one at a time", async ({ page }) => {
  await page.goto("/");
  const ffmpeg = page.getByRole("button", { name: "Get FFmpeg" });
  await ffmpeg.hover();
  // Not at once: a pointer crossing the grid should not set off every card.
  await expect(page.locator("video")).toHaveCount(0);
  const clip = page.locator("video");
  await expect(clip).toHaveCount(1);
  await expect(clip).toHaveAttribute("src", /ffmpeg\.webm$/);
  await expect.poll(() => clip.evaluate((video: HTMLVideoElement) => video.muted && !video.paused)).toBe(true);

  await page.getByRole("button", { name: /Get Inspect media|Get ffprobe/i }).first().hover();
  await expect(page.locator("video")).toHaveCount(1);
  await expect(page.locator("video")).not.toHaveAttribute("src", /ffmpeg\.webm$/);

  await page.mouse.move(5, 5);
  await expect(page.locator("video")).toHaveCount(0);
});

test("UC-02: keyboard focus opens the preview too", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Get FFmpeg" }).focus();
  await expect(page.locator("video")).toHaveCount(1);
});

test.describe("UC-02 with reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("shows the still and plays nothing", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Get FFmpeg" }).hover();
    await expect(page.locator('img[src$="ffmpeg.jpg"]')).toBeVisible();
    await expect(page.locator("video")).toHaveCount(0);
  });
});

test("UC-13: a file dropped on the window suggests the tools that read it, and arrives selected", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "What do you want to do?" })).toBeVisible();
  await page.evaluate(() => (window as unknown as { __host: { drop(p: string[]): void } }).__host.drop(["C:/docs/contrato.pdf"]));

  const suggestions = page.getByRole("group", { name: "Tools that read this file" });
  await expect(suggestions).toBeVisible();
  await expect(suggestions.getByRole("button", { name: /Organise PDFs/ })).toBeVisible();

  // The palette offers the same tools for the file.
  await page.keyboard.press("Control+k");
  await expect(page.getByRole("group", { name: "For contrato.pdf" })).toBeVisible();
  await page.keyboard.press("Escape");

  await suggestions.getByRole("button", { name: /Organise PDFs/ }).click();
  const tool = page.getByRole("region", { name: "Organise PDFs" });
  await expect(tool.getByText("contrato.pdf")).toBeVisible();
  await expect(tool.getByText("1 file selected")).toBeVisible();
});
