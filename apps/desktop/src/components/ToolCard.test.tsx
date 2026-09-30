import { render, screen } from "@testing-library/react";
import { Clapperboard } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import type { CatalogTool } from "../catalog/catalog";
import { ToolCard } from "./ToolCard";

const tool: CatalogTool = {
  id: "ffmpeg",
  integrationName: "FFmpeg",
  title: "Convert media",
  description: "Convert media locally.",
  category: "downloads",
  availability: "available",
  delivery: "on-demand",
  status: "planned",
  accent: "cool",
  size: "standard",
  keywords: [],
  capabilities: [],
  operations: [],
  downloadLabel: "Download interno",
  icon: Clapperboard,
};

describe("ToolCard error state", () => {
  it("explains a recoverable error and offers retry", () => {
    render(
      <ToolCard
        tool={tool}
        installation={{
          availability: "available",
          phase: "idle",
          activeVersion: null,
          candidateVersion: null,
          progress: null,
          lastError: "The file could not be verified.",
        }}
        onOpen={vi.fn()}
        onInstall={vi.fn()}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("The file could not be verified.");
    expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
  });
});
