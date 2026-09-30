import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
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
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("shows the tools4devs name in the sidebar", () => {
    render(<App />);

    expect(within(screen.getByRole("complementary")).getByRole("img", { name: "tools4devs" })).toBeVisible();
  });

  it("offers to install a pinned component without leaving the app", async () => {
    render(<App />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /get qpdf/i }));

    const dialog = screen.getByRole("dialog", { name: /install qpdf/i });
    expect(within(dialog).getByText(/never leave the app/i)).toBeVisible();
    expect(within(dialog).getByRole("button", { name: "Download and install" })).toBeEnabled();
  });

  it("offers an in-app install for every tool, including the ones that needed a manual one", async () => {
    render(<App />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /get 7-zip/i }));

    const dialog = screen.getByRole("dialog", { name: /install 7-zip/i });
    // Four tools used to reach this dialog only to be told the app could not
    // install them. None does now, and the size is on screen before the click.
    expect(within(dialog).getByRole("button", { name: "Download and install" })).toBeEnabled();
    expect(within(dialog).getAllByText(/1.6 MB/).length).toBeGreaterThan(0);
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

  it("finds an action by the words the person reads, in Portuguese too", async () => {
    localStorage.setItem("tools4devs.language", "pt");
    render(<App />);
    const user = userEvent.setup();

    await user.keyboard("{Control>}k{/Control}");
    await user.keyboard("extrair audio");

    const palette = screen.getByRole("dialog", { name: "Buscar ferramentas" });
    expect(within(palette).getAllByRole("option", { name: /Extrair áudio/ })[0]).toBeVisible();
  });

  it("closes the detail panel with Escape", async () => {
    render(<App />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /get qpdf/i }));
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog", { name: /install qpdf/i })).not.toBeInTheDocument();
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

  it("lets the user choose an operation in an available tool panel", async () => {
    render(<App />);
    const user = userEvent.setup();
    const tool = createCatalogRows().flatMap((row) => row.tools).find((item) => item.id === "qpdf");
    if (!tool) throw new Error("qpdf catalog entry missing");
    render(<ToolPanel tool={tool} />);
    const panel = screen.getByRole("region", { name: "Organise PDFs" });
    // The trigger is a button now, so the selection is what it reads, not a
    // form value — and the options exist only while the list is open.
    const operation = within(panel).getByRole("combobox", { name: "Operation" });
    expect(operation).toHaveTextContent("Merge PDFs");
    expect(screen.queryByRole("option")).not.toBeInTheDocument();

    await user.click(operation);
    expect(await screen.findByRole("option", { name: "Split pages" })).toBeInTheDocument();
    await user.click(screen.getByRole("option", { name: /rotate/i }));
    expect(within(panel).getByLabelText("Degrees")).toHaveValue(90);
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

  it("keeps the theme choice on the document root", async () => {
    window.localStorage.clear();
    render(<App />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Settings" }));
    const themes = screen.getByRole("radiogroup", { name: "Interface theme" });

    await user.click(within(themes).getByRole("radio", { name: "Dark theme" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(within(themes).getByRole("radio", { name: "Dark theme" })).toHaveAttribute("aria-checked", "true");

    await user.click(within(themes).getByRole("radio", { name: "Light theme" }));
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(window.localStorage.getItem("tools4devs.theme-preference")).toBe("light");
  });

  it("keeps the theme control in the settings view, and only there", async () => {
    render(<App />);
    const user = userEvent.setup();
    expect(screen.queryByRole("radiogroup", { name: "Interface theme" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Settings" }));

    expect(screen.getByRole("heading", { name: "Theme" })).toBeVisible();
    expect(screen.getAllByRole("radiogroup", { name: "Interface theme" })).toHaveLength(1);
    expect(screen.getByRole("heading", { name: "How many at once" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "When the file already exists" })).toBeVisible();
  });

  it("explains that the queue survives closing a tool panel", async () => {
    render(<App />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Queue" }));

    expect(screen.getByText(/keeps running here after you close the panel/i)).toBeVisible();
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

  it("opens one group at a time, and remembers it after a restart (UC-03)", async () => {
    const { unmount } = render(<App />);
    const user = userEvent.setup();

    await user.click(item(/^Video and audio/));
    expect(item(/^Video and audio/)).toHaveAttribute("aria-expanded", "true");
    expect(item("Convert media")).toBeVisible();

    await user.click(item(/^Images/));
    expect(item(/^Video and audio/)).toHaveAttribute("aria-expanded", "false");
    expect(within(tree()).queryByRole("treeitem", { name: "Convert media" })).not.toBeInTheDocument();

    unmount();
    render(<App />);
    expect(item(/^Images/)).toHaveAttribute("aria-expanded", "true");
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

  it("asks before a switch would throw away unsaved work (UC-09)", async () => {
    render(<App />);
    const user = userEvent.setup();

    await user.click(item(/^Quick tools/));
    await user.click(item("Work on text"));
    await user.type(within(screen.getByRole("region", { name: "Work on text" })).getAllByRole("textbox")[0]!, "hello");

    await user.keyboard("{Control>}k{/Control}");
    await user.keyboard("rotate pages{Enter}");
    expect(screen.getByRole("alertdialog", { name: "Discard this work?" })).toBeVisible();
    // The safe answer has the focus, and Esc gives it too.
    expect(screen.getByRole("button", { name: "Keep editing" })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Work on text" })).toBeVisible();

    await user.keyboard("{Control>}k{/Control}");
    await user.keyboard("rotate pages{Enter}");
    await user.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(screen.getByRole("region", { name: "Work on text" })).toBeVisible();

    await user.keyboard("{Control>}k{/Control}");
    await user.keyboard("rotate pages{Enter}");
    await user.click(screen.getByRole("button", { name: "Discard" }));
    const panel = await screen.findByRole("region", { name: "Organise PDFs" });
    expect(within(panel).getByRole("combobox", { name: "Operation" })).toHaveTextContent("Rotate pages");
  });

  it("asks in Portuguese too", async () => {
    localStorage.setItem("tools4devs.language", "pt");
    render(<App />);
    const user = userEvent.setup();

    const ptTree = within(screen.getByRole("tree", { name: "Todas as ferramentas" }));
    await user.click(ptTree.getByRole("treeitem", { name: /^Ferramentas rápidas/ }));
    await user.click(ptTree.getByRole("treeitem", { name: "Trabalhar com texto" }));
    await user.type(within(screen.getByRole("region", { name: "Trabalhar com texto" })).getAllByRole("textbox")[0]!, "olá");
    await user.click(screen.getByRole("button", { name: "Fila" }));

    expect(screen.getByRole("alertdialog", { name: "Descartar este trabalho?" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Continuar editando" })).toBeVisible();
  });
});

describe("a tool as a page in the main area", () => {
  const tree = () => within(screen.getByRole("complementary")).getByRole("tree", { name: "All tools" });
  const item = (name: string | RegExp) => within(tree()).getByRole("treeitem", { name });

  it("opens in the main area, not over it, and takes the focus", async () => {
    render(<App />);
    const user = userEvent.setup();

    await user.click(item(/^PDFs and documents/));
    await user.click(item("Organise PDFs"));

    const page = screen.getByRole("region", { name: "Organise PDFs" });
    expect(page).toHaveFocus();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "What do you want to do?" })).not.toBeInTheDocument();
  });

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
    const page = screen.getByRole("region", { name: "Work on text" });
    await user.type(within(page).getAllByRole("textbox")[0]!, "hello");

    const utilities = tree().querySelectorAll<HTMLElement>('[role="treeitem"][aria-level="3"]');
    await user.click(utilities[1]!);

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Work on text" })).getAllByRole("textbox")[0]).toHaveValue("hello");
  });
});
