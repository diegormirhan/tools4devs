import { hostCalls } from "./host";
import { expect, search, test } from "./fixtures";

const installed = ["jq", "yq", "ripgrep", "fd", "oxipng", "miller", "hexyl", "tokei", "dust", "qpdf", "ffmpeg", "ffprobe"];

// The conversions people go looking for by name, found the way they would name them.
test.describe("MP4 to GIF", () => {
  test.use({ host: { available: installed, openDialog: "C:/clips/demo.mp4", saveDialog: "C:/clips/demo.gif" } });

  test("is found by its name, and the start, length and size reach the host", async ({ page }) => {
    await page.goto("/");
    await search(page, "mp4 to gif");
    const tool = page.getByRole("region", { name: "GIFs" });
    await expect(tool.getByRole("combobox", { name: "Operation" })).toHaveText(/Video to GIF/);

    await tool.getByRole("spinbutton", { name: "Start (seconds)" }).fill("2");
    await tool.getByRole("spinbutton", { name: "Length (seconds)" }).fill("3");
    await tool.getByRole("spinbutton", { name: "Width (pixels)" }).fill("320");
    await tool.getByRole("button", { name: /choose files/i }).click();
    await tool.getByRole("button", { name: "Run" }).click();
    await expect(tool.getByText("Done, and recorded in the history.")).toBeVisible();

    const [call] = await hostCalls(page, "execute_operation");
    expect(call?.args).toMatchObject({
      request: {
        toolId: "ffmpeg",
        operationId: "to-gif",
        inputPaths: ["C:/clips/demo.mp4"],
        options: { start: "2", length: "3", width: "320" },
      },
    });
  });
});

test.describe("GIF to MP4", () => {
  test.use({ host: { available: installed, openDialog: "C:/memes/party.gif", saveDialog: "C:/memes/party.mp4" } });

  test("takes a GIF, offers MP4 and WebM, and runs", async ({ page }) => {
    await page.goto("/");
    await search(page, "gif to mp4");
    const tool = page.getByRole("region", { name: "GIFs" });
    await expect(tool.getByRole("combobox", { name: "Operation" })).toHaveText(/GIF to video/);
    await expect(tool.getByRole("combobox", { name: "Convert to" })).toHaveText(/mp4/i);

    await tool.getByRole("button", { name: /choose files/i }).click();
    await expect(tool.getByRole("button", { name: "party.gif 1 file selected" })).toBeVisible();
    await tool.getByRole("button", { name: "Run" }).click();
    await expect(tool.getByText("Done, and recorded in the history.")).toBeVisible();
    const [call] = await hostCalls(page, "execute_operation");
    expect(call?.args).toMatchObject({
      request: { toolId: "ffmpeg", operationId: "gif-to-video", inputPaths: ["C:/memes/party.gif"] },
    });
  });
});

test.describe("a video offered to GIF to video", () => {
  test.use({ host: { available: installed, openDialog: "C:/clips/demo.mp4" } });

  test("is refused with what the operation does read", async ({ page }) => {
    await page.goto("/");
    await search(page, "gif to mp4");
    const tool = page.getByRole("region", { name: "GIFs" });
    await tool.getByRole("button", { name: /choose files/i }).click();
    await expect(tool.getByText(/A \.mp4 file is not something this operation reads\. It takes \.gif\./)).toBeVisible();
    await expect(tool.getByRole("button", { name: "Run" })).toBeDisabled();
  });
});

test.describe("converting audio", () => {
  test.use({ host: { available: installed, openDialog: "C:/music/song.wav", saveDialog: "C:/music/song.mp3" } });

  test("takes an audio file and offers the audio formats", async ({ page }) => {
    await page.goto("/");
    await search(page, "convert audio");
    const tool = page.getByRole("region", { name: "Audio" });
    await expect(tool.getByRole("combobox", { name: "Operation" })).toHaveText(/Convert audio/);
    await expect(tool.getByRole("combobox", { name: "Audio format" })).toHaveText(/mp3/i);

    await tool.getByRole("button", { name: /choose files/i }).click();
    await tool.getByRole("button", { name: "Run" }).click();
    await expect(tool.getByText("Done, and recorded in the history.")).toBeVisible();
    const [call] = await hostCalls(page, "execute_operation");
    expect(call?.args).toMatchObject({
      request: { toolId: "ffmpeg", operationId: "convert-audio", inputPaths: ["C:/music/song.wav"] },
    });
  });
});

// One card holds every GIF job, and each job needs only the program that does it.
test.describe("the GIF card with FFmpeg missing", () => {
  test.use({
    host: { available: installed.filter((id) => id !== "ffmpeg" && id !== "ffprobe").concat("gifsicle"), openDialog: "C:/clips/demo.mp4" },
  });

  test("asks for FFmpeg on the jobs that start from a video, and not on compressing a GIF", async ({ page }) => {
    await page.goto("/");
    await search(page, "mp4 to gif");
    const tool = page.getByRole("region", { name: "GIFs" });
    await tool.getByRole("button", { name: /choose files/i }).click();
    await expect(tool.getByText(/FFmpeg downloads once, the first time you use it/)).toBeVisible();
    await expect(tool.getByRole("button", { name: "Get FFmpeg" })).toBeVisible();
    await expect(tool.getByRole("button", { name: "Run" })).toHaveCount(0);

    // Gifsicle is installed, so the job that is its own needs nothing.
    await tool.getByRole("combobox", { name: "Operation" }).click();
    await page.getByRole("option", { name: "Compress GIF" }).click();
    await expect(tool.getByRole("button", { name: "Get FFmpeg" })).toHaveCount(0);
  });
});
