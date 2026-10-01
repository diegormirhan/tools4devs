import { hostCalls } from "./host";
import { expect, search, test } from "./fixtures";

test.describe("UC-05: a built-in tool", () => {
  test.use({ permissions: ["clipboard-read", "clipboard-write"] });

  test("answers as you type, reports a bad pattern in place of the result, and clears", async ({ page }) => {
    await page.goto("/");
    await search(page, "find and replace");
    const tool = page.getByRole("region", { name: "Find and replace" });
    await expect(tool.getByRole("button", { name: "Run" })).toHaveCount(0);

    await tool.getByRole("textbox", { name: "Your text" }).fill("The colour of the sky");
    await tool.getByRole("textbox", { name: "Find" }).fill("colour");
    await tool.getByRole("textbox", { name: "Replace with" }).fill("color");
    await expect(tool.getByRole("textbox", { name: "Result" })).toHaveValue("The color of the sky");

    await tool.getByRole("button", { name: "Copy" }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("The color of the sky");

    await tool.getByRole("switch", { name: "Treat it as a pattern" }).click();
    await tool.getByRole("textbox", { name: "Find" }).fill("(");
    await expect(tool.getByRole("alert")).toBeVisible();

    await tool.getByRole("button", { name: "Clear" }).click();
    await expect(tool.getByRole("textbox", { name: "Your text" })).toHaveValue("");
  });

  test("a calculator leads with its answer and follows each number", async ({ page }) => {
    await page.goto("/");
    await search(page, "financing simulator");
    const answer = page.getByRole("region", { name: "Monthly payment" });
    const before = await answer.getByTestId("headline").textContent();

    const months = page.getByRole("spinbutton", { name: "Months" });
    await months.fill("12");
    await expect(answer.getByTestId("headline")).not.toHaveText(before ?? "");
    await expect(answer).toContainText("Total paid");
  });

  test("a CSS generator moves with its sliders and copies its CSS", async ({ page }) => {
    await page.goto("/");
    await search(page, "box shadow");
    const css = page.getByRole("region", { name: "CSS" });
    await expect(css).toContainText("24px");

    await page.getByRole("slider", { name: "Blur" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(css).toContainText("25px");

    await page.getByRole("radiogroup", { name: "Preview on" }).getByRole("radio", { name: "Card" }).click();
    await css.getByRole("button", { name: "Copy" }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("box-shadow:");
  });
});

test("UC-08: theme and language change at once and survive a restart", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Settings", exact: true }).click();

  await page.getByRole("radio", { name: "Dark theme" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);

  await page.getByRole("combobox", { name: "Language" }).click();
  await page.getByRole("option", { name: "Português (Brasil)" }).click();
  await expect(page.getByRole("heading", { name: "Configurações" })).toBeVisible();

  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(page.getByRole("tree", { name: "Todas as ferramentas" })).toBeVisible();
});

test("the window controls sit in the header and drive the window", async ({ page }) => {
  await page.goto("/");
  const header = page.locator("header").filter({ has: page.getByRole("navigation", { name: "Where you are" }) });
  // Dragging the header's empty space moves the window, and a double click maximises it.
  await expect(header.locator("[data-tauri-drag-region]").first()).toBeAttached();

  await header.getByRole("button", { name: "Minimise" }).click();
  await header.getByRole("button", { name: "Maximise" }).click();
  await header.getByRole("button", { name: "Close" }).click();
  const calls = (await hostCalls(page)).map((call) => call.cmd).filter((cmd) => cmd.startsWith("plugin:window|"));
  expect(calls).toEqual(expect.arrayContaining(["plugin:window|minimize", "plugin:window|toggle_maximize", "plugin:window|close"]));
});

test("UC-09: leaving unsaved work asks first, and the safe answer is the default", async ({ page }) => {
  await page.goto("/");
  await search(page, "change case");
  await page.getByRole("textbox", { name: "Your text" }).fill("hello");

  await page.getByRole("button", { name: "History", exact: true }).click();
  const ask = page.getByRole("alertdialog", { name: "Discard this work?" });
  await expect(ask.getByRole("button", { name: "Keep editing" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("textbox", { name: "Your text" })).toHaveValue("hello");

  await page.getByRole("button", { name: "History", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Discard" }).click();
  await expect(page.getByRole("heading", { name: "Result history" })).toBeVisible();
});

test("UC-12: the chat mockup follows each edit and saves the picture it shows", async ({ page }) => {
  await page.goto("/");
  await search(page, "chat mockup");
  await page.getByRole("button", { name: "Add a message" }).click();
  const row = page.getByRole("group", { name: "Message 3" });
  await row.getByRole("textbox", { name: "Message" }).fill("Bring the files");
  await expect(page.getByText("Bring the files", { exact: true }).last()).toBeVisible();

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save as image" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("whatsapp-mockup.png");
});

test("music recognition says what leaves the machine, listens and names the track", async ({ page }) => {
  await page.goto("/");
  await search(page, "name the music");
  const tool = page.getByRole("region", { name: "Name the music" });
  await expect(tool.getByText(/only the fingerprint is sent/i)).toBeVisible();

  await tool.getByRole("button", { name: "Listen and identify" }).click();
  const track = tool.getByRole("article", { name: "What was recognised" });
  await expect(track.getByRole("heading", { name: "Bohemian Rhapsody" })).toBeVisible();
  await track.getByRole("button", { name: "Spotify" }).click();
  expect(await hostCalls(page, "open_link")).toHaveLength(1);
});

test.describe("reverse image search", () => {
  test.use({ host: { openDialog: "C:/pictures/cat.png" } });

  test("uploads only to the engine that takes a file, and opens the results", async ({ page }) => {
    await page.goto("/");
    await search(page, "find where a picture came from");
    const tool = page.getByRole("region", { name: "Find where a picture came from" });
    await expect(tool.getByText(/the one tool here that leaves your machine/i)).toBeVisible();

    await tool.getByRole("button", { name: "Choose a picture" }).click();
    await tool.getByRole("button", { name: "Search" }).click();
    await expect(tool.getByText("Opened in your browser.")).toBeVisible();
    const [call] = await hostCalls(page, "search_by_image");
    expect(call?.args).toMatchObject({ request: { engine: "google", path: "C:/pictures/cat.png", imageUrl: null } });
  });
});

test("About lists every component with its version, licence and hash, and opens its project", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Components and licences" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "About Tools4Devs" })).toBeVisible();
  await expect(page.getByText("MIT", { exact: true }).first()).toBeVisible();
  const components = page.getByRole("list", { name: "Components" }).getByRole("listitem");
  await expect(components).toHaveCount(26);

  const ffmpeg = components.filter({ hasText: "FFmpeg" }).first();
  await expect(ffmpeg).toContainText("9.0.1");
  await expect(ffmpeg).toContainText("LGPL-2.1-or-later OR GPL-2.0-or-later");
  await expect(ffmpeg).toContainText("Downloaded when you ask");
  await expect(ffmpeg).toContainText("2484854ad698");
  await ffmpeg.getByRole("button", { name: "Open the FFmpeg project" }).click();
  const [call] = await hostCalls(page, "open_link");
  expect(call?.args).toEqual({ url: "https://github.com/FFmpeg/FFmpeg" });

  await expect(components.filter({ hasText: "jq" }).first()).toContainText("In the installer");
  await expect(page.getByText(/FRONTEND-NOTICES\.txt/)).toBeVisible();
});
