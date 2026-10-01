import { expect, search, test } from "./fixtures";

test("UC-01: Ctrl+K finds an action by what it does, in any word order and without accents", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Control+k");
  const palette = page.getByRole("dialog");
  await palette.getByRole("combobox").fill("pages split");
  await expect(palette.getByRole("option", { name: /split pages/i }).first()).toBeVisible();

  await page.keyboard.press("Enter");
  const tool = page.getByRole("region", { name: "Organise PDFs" });
  await expect(tool).toBeVisible();
  await expect(tool.getByRole("combobox", { name: "Operation" })).toHaveText(/Split pages/);
  await expect(page.getByRole("navigation", { name: "Where you are" })).toContainText("Split pages");
});

test("UC-01: Portuguese search ignores accents", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("tools4devs.language", "pt"));
  await page.goto("/");
  await page.keyboard.press("Control+k");
  await page.getByRole("combobox").fill("musica");
  await expect(page.getByRole("option", { name: /música/i }).first()).toBeVisible();
});

test("UC-03: the tree opens one group at a time and remembers it after a restart", async ({ page }) => {
  await page.goto("/");
  const tree = page.getByRole("tree", { name: "All tools" });
  await tree.getByRole("treeitem", { name: /^PDFs and documents/ }).click();
  await expect(tree.getByRole("treeitem", { name: /^PDFs and documents/ })).toHaveAttribute("aria-expanded", "true");

  await tree.getByRole("treeitem", { name: /^Images/ }).click();
  await expect(tree.getByRole("treeitem", { name: /^Images/ })).toHaveAttribute("aria-expanded", "true");
  await expect(tree.getByRole("treeitem", { name: /^PDFs and documents/ })).toHaveAttribute("aria-expanded", "false");

  await page.reload();
  await expect(page.getByRole("tree", { name: "All tools" }).getByRole("treeitem", { name: /^Images/ })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
});

test("UC-10: the keyboard alone reaches a tool, and focus lands on its page", async ({ page }) => {
  await page.goto("/");
  const tree = page.getByRole("tree", { name: "All tools" });
  await tree.getByRole("treeitem").first().focus();
  await expect(tree.getByRole("treeitem", { name: /^Video and audio/ })).toBeFocused();

  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await expect(tree.getByRole("treeitem", { name: /^PDFs and documents/ })).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(tree.getByRole("treeitem", { name: /^PDFs and documents/ })).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");

  const tool = page.getByRole("region", { name: "Organise PDFs" });
  await expect(tool).toBeFocused();

  // Esc closes the palette and gives the page back.
  await page.keyboard.press("Control+k");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
});

test.describe("UC-11: a small window", () => {
  test.use({ viewport: { width: 800, height: 600 } });

  test("folds the sidebar to icons, never scrolls sideways, and keeps Ctrl+K", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("tree", { name: "All tools" }).getByText("Video and audio")).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(800);

    await search(page, "change case");
    await expect(page.getByRole("region", { name: "Change case" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(800);
  });
});

test("the path above the page leads back up, and Back retraces the way", async ({ page }) => {
  await page.goto("/");
  const back = page.getByRole("button", { name: "Back" });
  await expect(back).toBeDisabled();

  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await search(page, "split pages");
  const path = page.getByRole("navigation", { name: "Where you are" });
  // The group is not a page, so the path skips it.
  await expect(path.locator("a[href]")).toHaveText(["Home", "Organise PDFs"]);
  await expect(path).not.toContainText("PDFs and documents");
  await expect(path.locator('[aria-current="page"]')).toHaveText("Split pages");

  await path.getByRole("link", { name: "Organise PDFs" }).click();
  await expect(path.locator('[aria-current="page"]')).toHaveText("Organise PDFs");

  await back.click();
  await expect(path.locator('[aria-current="page"]')).toHaveText("Split pages");
  await page.keyboard.press("Alt+ArrowLeft");
  await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();

  await path.getByRole("link", { name: "Home" }).click();
  await expect(page.getByRole("heading", { name: "What do you want to do?" })).toBeVisible();
});

test("Back from unsaved work asks first, like any other way out", async ({ page }) => {
  await page.goto("/");
  await search(page, "change case");
  await page.getByRole("textbox", { name: "Your text" }).fill("draft");
  await page.getByRole("button", { name: "Back" }).click();

  const ask = page.getByRole("alertdialog");
  await expect(ask).toBeVisible();
  await ask.getByRole("button", { name: "Keep editing" }).click();
  await expect(page.getByRole("textbox", { name: "Your text" })).toHaveValue("draft");
});
