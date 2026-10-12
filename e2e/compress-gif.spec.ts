import { hostCalls } from "./host";
import { expect, search, test } from "./fixtures";

const installed = ["jq", "yq", "ripgrep", "fd", "oxipng", "miller", "hexyl", "tokei", "dust", "qpdf", "gifsicle"];

test.describe("compressing a GIF", () => {
  test.use({
    host: { available: installed, openDialog: "C:/memes/party.gif", saveDialog: "C:/memes/party-small.gif" },
  });

  test("the loss, colours and width chosen on the card reach the host as written", async ({ page }) => {
    await page.goto("/");
    await search(page, "compress gif");
    const tool = page.getByRole("region", { name: "Compress GIFs" });
    await expect(tool.getByRole("combobox", { name: "Operation" })).toHaveText(/Compress GIF/);
    // The defaults are the middle of the road: some loss, every colour, the original width.
    await expect(tool.getByRole("combobox", { name: "Loss" })).toHaveText(/Balanced/);
    await expect(tool.getByRole("combobox", { name: "Colours" })).toHaveText(/256/);

    await tool.getByRole("combobox", { name: "Loss" }).click();
    await page.getByRole("option", { name: /Strong/ }).click();
    await tool.getByRole("combobox", { name: "Colours" }).click();
    await page.getByRole("option", { name: "64", exact: true }).click();
    await tool.getByRole("spinbutton", { name: "Width (pixels)" }).fill("480");

    await tool.getByRole("button", { name: /choose files/i }).click();
    await expect(tool.getByRole("button", { name: "party.gif 1 file selected" })).toBeVisible();
    await tool.getByRole("button", { name: "Run" }).click();
    await expect(tool.getByText("Done, and recorded in the history.")).toBeVisible();

    const [call] = await hostCalls(page, "execute_operation");
    expect(call?.args).toMatchObject({
      request: {
        toolId: "gifsicle",
        operationId: "compress",
        inputPaths: ["C:/memes/party.gif"],
        options: { lossy: "150", colors: "64", width: "480" },
      },
    });

    await page.getByRole("button", { name: "History", exact: true }).click();
    await expect(page.getByRole("article", { name: "Compress GIF — Compress GIFs" })).toContainText("party.gif");
  });
});

test.describe("a file that is not a GIF", () => {
  test.use({ host: { available: installed, openDialog: "C:/photos/photo.png" } });

  test("is refused before anything runs, and says what the tool does read", async ({ page }) => {
    await page.goto("/");
    await search(page, "compress gif");
    const tool = page.getByRole("region", { name: "Compress GIFs" });
    await tool.getByRole("button", { name: /choose files/i }).click();

    await expect(tool.getByText(/A \.png file is not something this tool reads\. It takes gif files\./)).toBeVisible();
    await expect(tool.getByRole("button", { name: "Run" })).toBeDisabled();
    expect(await hostCalls(page, "execute_operation")).toHaveLength(0);
  });
});

test.describe("before Gifsicle is installed", () => {
  test.use({ host: { available: installed.filter((id) => id !== "gifsicle"), stepMs: 100 } });

  test("the card offers the in-app download of the pinned build, and nothing downloads until the click", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Get Gifsicle" }).click();
    const dialog = page.getByRole("dialog", { name: /Install Gifsicle/ });
    // 230,072 bytes in the manifest, shown the way the app words sizes.
    await expect(dialog.getByText(/225 kB in total/)).toBeVisible();
    expect(await hostCalls(page, "install_component")).toHaveLength(0);

    await dialog.getByRole("button", { name: "Download and install" }).click();
    await expect(dialog.getByRole("button", { name: /Open Gifsicle/ })).toBeVisible();
    const [install] = await hostCalls(page, "install_component");
    expect(install?.args).toMatchObject({ toolId: "gifsicle" });
  });
});
