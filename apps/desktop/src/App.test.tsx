import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "./App";
import { ToolPanel } from "./components/ToolPanel";
import { createCatalogRows } from "./catalog/catalog";
import { migratePreferences } from "./domain/preference-migration";

describe("desktop catalog", () => {
  it("preserves ToolHaven language and theme preferences after the rename", () => {
    localStorage.setItem("toolhaven.language", "pt");
    localStorage.setItem("toolhaven.theme-preference", "light");
    migratePreferences(localStorage);
    render(<App />);
    expect(screen.getByRole("heading", { name: "O que você quer fazer?" })).toBeVisible();
    expect(document.documentElement).not.toHaveClass("dark");
  });

  it("shows the complete dependency plan before installing", async () => {
    render(<App />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /get yt-dlp/i }));

    const panel = screen.getByRole("dialog", { name: /install yt-dlp/i });
    expect(within(panel).getByText("Deno")).toBeVisible();
    expect(within(panel).getByText("FFmpeg")).toBeVisible();
    expect(within(panel).getByText("ffprobe")).toBeVisible();
    expect(within(panel).getByText(/SHA-256 checked before anything is activated/i)).toBeVisible();
    expect(within(panel).getByRole("button", { name: "Download and install" })).toBeEnabled();
  });

  it("opens the search with Ctrl+K, or from the sidebar", async () => {
    render(<App />);
    const user = userEvent.setup();

    await user.keyboard("{Control>}k{/Control}");
    expect(within(screen.getByRole("dialog", { name: "Search tools" })).getByRole("combobox")).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Search tools" })).not.toBeInTheDocument();

    await user.click(within(screen.getByRole("complementary")).getByRole("button", { name: /search tools/i }));
    expect(screen.getByRole("dialog", { name: "Search tools" })).toBeVisible();
  });

  it("accepts a media URL for yt-dlp", async () => {
    const tool = createCatalogRows().flatMap((row) => row.tools).find((item) => item.id === "yt-dlp");
    if (!tool) throw new Error("yt-dlp catalog entry missing");
    render(<ToolPanel tool={tool} />);
    const user = userEvent.setup();
    const panel = screen.getByRole("region", { name: "Download media" });
    const execute = within(panel).getByRole("button", { name: "Run" });
    expect(execute).toBeDisabled();
    await user.type(within(panel).getByLabelText("Media URL"), "https://example.com/video");
    expect(execute).toBeEnabled();
  });
});

describe("finding a tool in the sidebar and the search", () => {
  const tree = () => within(screen.getByRole("complementary")).getByRole("tree", { name: "All tools" });
  const item = (name: string | RegExp) => within(tree()).getByRole("treeitem", { name });

  it("opens the tool on the action chosen in the search, and shows it in the tree (UC-01)", async () => {
    render(<App />);
    const user = userEvent.setup();

    await user.keyboard("{Control>}k{/Control}");
    await user.keyboard("extract au{Enter}");

    const panel = screen.getByRole("region", { name: "Convert media" });
    expect(within(panel).getByRole("combobox", { name: "Operation" })).toHaveTextContent("Extract audio");
    expect(item(/^Video and audio/)).toHaveAttribute("aria-expanded", "true");
    expect(item("Extract audio")).toHaveAttribute("aria-current", "page");
    expect(within(screen.getByRole("navigation", { name: "Where you are" })).getByText("Extract audio")).toBeVisible();
  });

  it("walks the tree with the keyboard alone (UC-10)", async () => {
    render(<App />);
    const user = userEvent.setup();

    item(/^Video and audio/).focus();
    await user.keyboard("{ArrowRight}");
    expect(item(/^Video and audio/)).toHaveAttribute("aria-expanded", "true");

    await user.keyboard("{ArrowDown}");
    expect(item("Convert media")).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    await user.keyboard("{ArrowDown}");
    expect(item("Convert format")).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(item("Convert media")).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(screen.getByRole("region", { name: "Convert media" })).toBeVisible();
  });

  it("lists five sub-tools of a long tool and the rest on request", async () => {
    render(<App />);
    const user = userEvent.setup();

    await user.click(item(/^Video and audio/));
    await user.click(item("Convert media"));
    await user.keyboard("{Escape}");

    expect(within(tree()).queryByRole("treeitem", { name: "Extract audio" })).not.toBeInTheDocument();
    await user.click(item("9 more…"));
    expect(item("Extract audio")).toBeVisible();
  });

  it("pins a tool to the top of the sidebar, across restarts", async () => {
    const { unmount } = render(<App />);
    const user = userEvent.setup();

    await user.click(item(/^Downloads/));
    await user.click(screen.getByRole("button", { name: "Pin Download media" }));

    unmount();
    render(<App />);
    const sidebar = within(screen.getByRole("complementary"));
    expect(sidebar.getByText("Pinned")).toBeVisible();
    await user.click(sidebar.getAllByRole("button", { name: "Download media" })[0]!);
    expect(screen.getByRole("region", { name: "Download media" })).toBeVisible();
  });
});

describe("a tool as a page in the main area", () => {
  const tree = () => within(screen.getByRole("complementary")).getByRole("tree", { name: "All tools" });
  const item = (name: string | RegExp) => within(tree()).getByRole("treeitem", { name });

  it("follows an operation chosen on the page in the tree and the path (UC-03)", async () => {
    render(<App />);
    const user = userEvent.setup();

    await user.click(item(/^PDFs and documents/));
    await user.click(item("Organise PDFs"));
    const page = screen.getByRole("region", { name: "Organise PDFs" });
    await user.click(within(page).getByRole("combobox", { name: "Operation" }));
    await user.click(screen.getByRole("option", { name: /split pages/i }));

    expect(item("Split pages")).toHaveAttribute("aria-current", "page");
    expect(within(screen.getByRole("navigation", { name: "Where you are" })).getByText("Split pages")).toBeVisible();
  });

  it("switches operation from the tree without losing what was typed (UC-05)", async () => {
    render(<App />);
    const user = userEvent.setup();

    await user.click(item(/^Quick tools/));
    await user.click(item("Work on text"));
    const page = screen.getByRole("region", { name: "Change case" });
    await user.type(within(page).getAllByRole("textbox")[0]!, "hello");

    const utilities = tree().querySelectorAll<HTMLElement>('[role="treeitem"][aria-level="3"]');
    await user.click(utilities[1]!);

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Reverse text" })).getAllByRole("textbox")[0]).toHaveValue("hello");
  });
});
