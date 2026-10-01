import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Download } from "lucide-react";
import { expect, it, vi } from "vitest";
import type { ToolJob } from "../domain/job-queue";
import { JobView } from "./JobView";

const job = (over: Partial<ToolJob>): ToolJob => ({
  id: "1",
  toolId: "yt-dlp",
  toolName: "Download media",
  operationId: "download-video",
  operationLabel: "Download video",
  sourceLabel: "https://example.com/v",
  status: "succeeded",
  progress: null,
  message: "",
  outputPath: "C:\\videos\\v.mp4",
  options: {},
  startedAt: 0,
  ...over,
});

function renderHistory(jobs: ToolJob[], onClearHistory = vi.fn(), onReturn = vi.fn()) {
  render(
    <JobView
      activeNavigation="history"
      runningJobs={[]}
      finishedJobs={jobs}
      onClearHistory={onClearHistory}
      onCancel={vi.fn()}
      onReturn={onReturn}
      iconFor={() => Download}
    />,
  );
  return { onClearHistory, onReturn };
}

it("asks before clearing the history, and keeps it when the person changes their mind (UC-07)", async () => {
  const user = userEvent.setup();
  const { onClearHistory } = renderHistory([job({})]);

  await user.click(screen.getByRole("button", { name: "Clear the history" }));
  const dialog = screen.getByRole("alertdialog", { name: "Clear the history?" });
  await user.click(within(dialog).getByRole("button", { name: "Keep it" }));
  expect(onClearHistory).not.toHaveBeenCalled();

  await user.click(screen.getByRole("button", { name: "Clear the history" }));
  await user.click(screen.getByRole("button", { name: "Clear" }));
  expect(onClearHistory).toHaveBeenCalledOnce();
});

it("says why an operation failed, in the row itself", () => {
  renderHistory([job({ status: "failed", message: "yt-dlp.exe failed (exit code: 1)", outputPath: null })]);
  const row = screen.getByRole("article", { name: /download video/i });
  expect(within(row).getByText("Failed")).toBeVisible();
  expect(within(row).getByText(/exit code: 1/)).toBeVisible();
});

it("explains an empty history and leads back to the tools", async () => {
  const user = userEvent.setup();
  const { onReturn } = renderHistory([]);
  expect(screen.getByText(/kept across restarts until you clear it/i)).toBeVisible();
  expect(screen.queryByRole("button", { name: "Clear the history" })).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Back to the tools" }));
  expect(onReturn).toHaveBeenCalled();
});
