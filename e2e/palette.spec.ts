import { expect, test } from "./fixtures";

test("searching puts the highlight and the scroll back on the first result", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Control+k");
  const search = page.getByRole("combobox");
  const list = page.locator("[cmdk-list]");
  await search.fill("a");

  // A search that keeps the list long, so the old row is still there to be scrolled to.
  expect(await page.getByRole("option").count()).toBeGreaterThan(14);
  // Walk the highlight well down the list, so the list itself has scrolled.
  await page.keyboard.press("ArrowDown", { delay: 20 });
  for (let step = 0; step < 12; step += 1) await page.keyboard.press("ArrowDown");
  expect(await list.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);

  // Typing again used to leave both where they were, and the list scrolled to the old row.
  await search.pressSequentially("n");
  const first = page.getByRole("option").first();
  await expect(first).toHaveAttribute("aria-selected", "true");
  await expect.poll(() => list.evaluate((element) => element.scrollTop)).toBe(0);
});
