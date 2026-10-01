import { hostCalls } from "./host";
import { expect, search, test } from "./fixtures";

const files = { openDialog: "C:/docs/contract.pdf", saveDialog: "C:/out/contract-rotated.pdf" };
const bundled = ["jq", "yq", "ripgrep", "fd", "oxipng", "miller", "hexyl", "tokei", "dust", "qpdf"];

test.describe("running an operation", () => {
  test.use({ host: { available: bundled, ...files } });

  test("UC-04: a file goes in, the host runs it, and the result lands in the history", async ({ page }) => {
    await page.goto("/");
    await search(page, "rotate pages");
    const tool = page.getByRole("region", { name: "Organise PDFs" });
    await expect(tool.getByRole("button", { name: "Run" })).toBeDisabled();

    await tool.getByRole("button", { name: /choose files/i }).click();
    await expect(tool.getByText("contract.pdf")).toBeVisible();
    await tool.getByRole("button", { name: "Run" }).click();

    await expect(tool.getByText("Done, and recorded in the history.")).toBeVisible();
    const [call] = await hostCalls(page, "execute_operation");
    expect(call?.args).toMatchObject({
      request: { toolId: "qpdf", operationId: "rotate", inputPaths: ["C:/docs/contract.pdf"] },
    });

    await page.getByRole("button", { name: "History", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Result history" })).toBeVisible();
    const entry = page.getByRole("article", { name: "Rotate pages — Organise PDFs" });
    await expect(entry).toContainText("contract.pdf");
    await expect(entry).toContainText("Done");
  });
});

test.describe("a job that is still running", () => {
  test.use({ host: { available: bundled, ...files, operation: "hold" } });

  test("UC-06: keeps running after leaving its page, and Stop ends it", async ({ page }) => {
    await page.goto("/");
    await search(page, "rotate pages");
    const tool = page.getByRole("region", { name: "Organise PDFs" });
    await tool.getByRole("button", { name: /choose files/i }).click();
    await tool.getByRole("button", { name: "Run" }).click();
    await expect(tool.getByRole("button", { name: "Stop" })).toBeVisible();

    // Leaving the tool does not touch the job.
    await page.getByRole("button", { name: /^Queue/ }).click();
    await expect(page.getByRole("heading", { name: "Operation queue" })).toBeVisible();
    const job = page.getByRole("article", { name: "Rotate pages — Organise PDFs" });
    await expect(job).toContainText("Running");
    await expect(page.getByRole("button", { name: /queue, 1 running/i })).toBeVisible();

    await job.getByRole("button", { name: "Stop" }).click();
    // A stopped job leaves the queue for the history.
    await expect(job).toBeHidden();
    await page.getByRole("button", { name: "History", exact: true }).click();
    await expect(page.getByRole("article", { name: "Rotate pages — Organise PDFs" })).toContainText("Stopped");
    expect(await hostCalls(page, "cancel_operation")).toHaveLength(1);
  });

  test("UC-06: the limit in Settings makes the next job wait", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page.getByRole("combobox", { name: "Operations at once" }).click();
    await page.getByRole("option", { name: "1 at a time" }).click();

    await search(page, "rotate pages");
    const tool = page.getByRole("region", { name: "Organise PDFs" });
    await tool.getByRole("button", { name: /choose files/i }).click();
    await tool.getByRole("button", { name: "Run" }).click();
    await search(page, "split pages");
    // Same tool, another operation: the file stays chosen.
    const split = page.getByRole("region", { name: "Organise PDFs" });
    await expect(split.getByRole("combobox", { name: "Operation" })).toHaveText(/Split pages/);
    await split.getByRole("button", { name: "Run" }).click();

    await page.getByRole("button", { name: /^Queue/ }).click();
    await expect(page.getByRole("article", { name: "Rotate pages — Organise PDFs" })).toContainText("Running");
    await expect(page.getByRole("article", { name: "Split pages — Organise PDFs" })).toContainText("Waiting");
    expect(await hostCalls(page, "execute_operation")).toHaveLength(1);
  });
});

test.describe("a job that fails", () => {
  test.use({ host: { available: bundled, ...files, operation: "fail" } });

  test("UC-07: the cause shows in the history, survives a restart, and clearing asks first", async ({ page }) => {
    await page.goto("/");
    await search(page, "rotate pages");
    const tool = page.getByRole("region", { name: "Organise PDFs" });
    await tool.getByRole("button", { name: /choose files/i }).click();
    await tool.getByRole("button", { name: "Run" }).click();
    await expect(tool.getByText("The job failed. Your original file was left untouched.")).toBeVisible();

    await page.reload();
    await page.getByRole("button", { name: "History", exact: true }).click();
    const entry = page.getByRole("article", { name: "Rotate pages — Organise PDFs" });
    await expect(entry).toContainText("Failed");
    await expect(entry).toContainText("The input is not a valid file for this operation.");

    await page.getByRole("button", { name: "Clear the history" }).click();
    const confirm = page.getByRole("alertdialog", { name: "Clear the history?" });
    await confirm.getByRole("button", { name: "Keep it" }).click();
    await expect(entry).toBeVisible();

    await page.getByRole("button", { name: "Clear the history" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Clear", exact: true }).click();
    await expect(page.getByRole("heading", { name: "No results yet" })).toBeVisible();
    await page.getByRole("button", { name: "Back to the tools" }).click();
    await expect(page.getByRole("heading", { name: "What do you want to do?" })).toBeVisible();
  });
});

test.describe("installing a tool", () => {
  test.use({ host: { available: bundled } });

  test("UC-04: the plan shows its size first, nothing downloads before the click, and the tool opens after", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Get 7-Zip" }).click();
    const dialog = page.getByRole("dialog", { name: /Install 7-Zip/ });
    await expect(dialog.getByText(/\d+ MB in total/)).toBeVisible();
    expect(await hostCalls(page, "install_component")).toHaveLength(0);

    await dialog.getByRole("button", { name: "Download and install" }).click();
    await expect(dialog.getByRole("button", { name: /Open 7-Zip/ })).toBeVisible();
    expect(await hostCalls(page, "install_component")).toHaveLength(1);

    await dialog.getByRole("button", { name: /Open 7-Zip/ }).click();
    await expect(page.getByRole("region", { name: "Compress files" })).toBeVisible();
    // The page and the catalog follow without a reload.
    await page.getByRole("button", { name: /tools4devs/ }).first().click();
    await expect(page.getByRole("button", { name: "Open 7-Zip" })).toBeVisible();
  });
});

test.describe("an installation that fails", () => {
  test.use({ host: { available: bundled, install: "fail" } });

  test("UC-04: shows the reason and offers to try again", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Get 7-Zip" }).click();
    const dialog = page.getByRole("dialog", { name: /Install 7-Zip/ });
    await dialog.getByRole("button", { name: "Download and install" }).click();
    await expect(dialog.getByText(/did not match its SHA-256/)).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Try again" })).toBeVisible();
  });
});
