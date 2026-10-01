import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
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

function renderCard(
  id: string,
  installation = available,
  { previewing = false, onPreviewChange = vi.fn() }: { previewing?: boolean; onPreviewChange?: (open: boolean) => void } = {},
) {
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
      previewing={previewing}
      onPreviewChange={onPreviewChange}
    />,
  );
  return { tool, onOpen, onInstall, onPreviewChange };
}

afterEach(() => vi.useRealTimers());

describe("the tool card", () => {
  it("is one button, named for what it does", () => {
    const { onInstall } = renderCard("ffmpeg");
    fireEvent.click(screen.getByRole("button", { name: "Get FFmpeg" }));
    expect(onInstall).toHaveBeenCalled();
  });

  it("opens a tool that is ready", () => {
    const { onOpen } = renderCard("ffmpeg", ready);
    fireEvent.click(screen.getByRole("button", { name: "Open FFmpeg" }));
    expect(onOpen).toHaveBeenCalled();
  });

  it("says what it is before it is opened: engine, actions, download size", () => {
    renderCard("ffmpeg");
    const card = screen.getByRole("article", { name: "Convert media" });
    expect(within(card).getByText("FFmpeg")).toBeVisible();
    expect(within(card).getByText("14 actions")).toBeVisible();
    expect(within(card).getByText(/In-app download · \d+ MB/)).toBeVisible();
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
  it("asks to open after a short pause on the card, and to close when the pointer leaves", () => {
    vi.useFakeTimers();
    const { onPreviewChange } = renderCard("ffmpeg");
    const card = screen.getByRole("article", { name: "Convert media" });

    fireEvent.pointerEnter(card);
    act(() => vi.advanceTimersByTime(200));
    expect(onPreviewChange).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(150));
    expect(onPreviewChange).toHaveBeenLastCalledWith(true);

    fireEvent.pointerLeave(card);
    expect(onPreviewChange).toHaveBeenLastCalledWith(false);
  });

  it("opens from the keyboard too", () => {
    const { onPreviewChange } = renderCard("ffmpeg");
    fireEvent.focus(screen.getByRole("button", { name: "Get FFmpeg" }));
    expect(onPreviewChange).toHaveBeenLastCalledWith(true);
  });

  it("plays the muted clip, loading nothing until it opens", () => {
    renderCard("ffmpeg", available, { previewing: true });
    const video = document.querySelector("video")!;
    expect(video).toHaveAttribute("src", "/previews/ffmpeg.webm");
    expect(video).toHaveAttribute("poster", "/previews/ffmpeg.jpg");
    expect(video.muted).toBe(true);
    expect(video).toHaveAttribute("preload", "none");
    expect(screen.getByText("What you can do")).toBeVisible();
    expect(screen.getByText("+8")).toBeVisible();
  });

  it("shows only the poster to someone who asked for less motion", () => {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({ ...original(query), matches: query.includes("reduce") })) as typeof window.matchMedia;
    try {
      renderCard("ffmpeg", available, { previewing: true });
      expect(document.querySelector("video")).toBeNull();
      expect(document.querySelector('img[src="/previews/ffmpeg.jpg"]')).not.toBeNull();
    } finally {
      window.matchMedia = original;
    }
  });

  it("falls back to the icon and the actions for a tool with no clip", () => {
    renderCard("ffprobe", available, { previewing: true });
    expect(document.querySelector("video")).toBeNull();
    expect(screen.getByText("What you can do")).toBeVisible();
  });
});
