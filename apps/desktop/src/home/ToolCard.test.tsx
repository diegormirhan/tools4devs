import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createInstallationState } from "../../../../scripts/component-installation/installation-state.mjs";
import { createCatalogRows, type CatalogRow, type CatalogTool } from "../catalog/catalog";
import { ToolCard } from "./ToolCard";

const rows = createCatalogRows();
const find = (id: string): [CatalogTool, CatalogRow] => {
  const row = rows.find((candidate) => candidate.tools.some((tool) => tool.id === id))!;
  return [row.tools.find((tool) => tool.id === id)!, row];
};
const available = createInstallationState({});
const ready = createInstallationState({ activeVersion: "7.1" });

function renderCard(id: string, installation = available) {
  const [tool, row] = find(id);
  const onOpen = vi.fn();
  const onInstall = vi.fn();
  render(
    <ToolCard
      tool={tool}
      row={row}
      installation={installation}
      onOpen={onOpen}
      onInstall={onInstall}
      previewing={false}
      onPreviewChange={vi.fn()}
    />,
  );
  return { onOpen, onInstall };
}

describe("the tool card", () => {
  it("opens a tool that is ready", () => {
    const { onOpen } = renderCard("ffmpeg", ready);
    fireEvent.click(screen.getByRole("button", { name: "Open FFmpeg" }));
    expect(onOpen).toHaveBeenCalled();
  });

  it("explains a recoverable error and offers retry", () => {
    const { onInstall } = renderCard("ffmpeg", { ...available, lastError: "The file could not be verified." });
    expect(screen.getByRole("alert")).toHaveTextContent("The file could not be verified.");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onInstall).toHaveBeenCalled();
  });

  it("shows the download while it runs", () => {
    renderCard("ffmpeg", { ...available, phase: "downloading", progress: 0.4 });
    expect(screen.getByRole("progressbar", { name: "Progress of FFmpeg" })).toHaveAttribute("aria-valuenow", "40");
  });
});

describe("the hover preview", () => {
  it("falls back to the icon and the actions for a tool with no clip", () => {
    // Every card ships a clip today; one added later may not, and must still preview.
    const [tool, row] = find("ffprobe");
    render(
      <ToolCard
        tool={{ ...tool, preview: undefined }}
        row={row}
        installation={available}
        onOpen={vi.fn()}
        onInstall={vi.fn()}
        previewing
        onPreviewChange={vi.fn()}
      />,
    );
    expect(document.querySelector("video")).toBeNull();
    expect(screen.getByText("What you can do")).toBeVisible();
  });
});
