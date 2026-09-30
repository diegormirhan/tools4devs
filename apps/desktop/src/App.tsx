import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Upload } from "lucide-react";
import toolManifest from "../../../tooling/tools.json";
import { open } from "@tauri-apps/plugin-dialog";
import { createCatalogRows, type CatalogTool } from "./catalog/catalog";
import { InstallDialog } from "./components/InstallDialog";
import { ToolPanel, type RunOperationInput } from "./components/ToolPanel";
import { ImageSearchPanel } from "./components/ImageSearchPanel";
import { UtilityPanel } from "./components/UtilityPanel";
import { UpdateCard } from "./components/UpdateCard";
import { LanguageProvider, useLanguage, useT } from "./i18n/language";
import { utilityGroupIds } from "./utilities/registry";
import { useUpdate } from "./hooks/useUpdate";
import { MusicPanel } from "./components/MusicPanel";
import { ChatMockupPanel } from "./components/ChatMockupPanel";
import { PostMockupPanel } from "./components/PostMockupPanel";
import { ToolSection } from "./components/ToolSection";
import { CategoryFilter } from "./components/CategoryFilter";
import { useFileDrop } from "./hooks/useFileDrop";
import { isNativeHost, useOperationRunner } from "./hooks/useOperationRunner";
import { useInstallationState } from "./hooks/useInstallationState";
import { useStoredState } from "./hooks/useStoredState";
import { useTheme } from "./hooks/useTheme";
import { AppShell } from "./navigation/AppShell";
import { NavigationProvider, useNavigation, type View } from "./navigation/navigation";
import { JobView } from "./views/JobView";
import { SettingsView } from "./views/SettingsView";
import "./styles/theme.css";
import "./styles/app.css";

type SidebarChoice = "collapsed" | "expanded" | null;
type ShownTool = { tool: CatalogTool; subId?: string };

export function App() {
  return (
    <LanguageProvider>
      <NavigationProvider>
        <Shell />
      </NavigationProvider>
    </LanguageProvider>
  );
}

function Shell() {
  const t = useT();
  const { language, setLanguage } = useLanguage();
  const navigation = useNavigation();
  const { location, go } = navigation;
  const catalogRows = useMemo(() => createCatalogRows(), []);
  const toolsById = useMemo(
    () => new Map(catalogRows.flatMap((row) => row.tools.map((tool) => [tool.id, tool] as const))),
    [catalogRows],
  );
  // The page behind a tool panel, and where closing the panel returns to.
  const [page, setPage] = useState<Exclude<View, "tool">>("catalog");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [pendingTool, setPendingTool] = useState<CatalogTool | null>(null);
  const [pendingFile, setPendingFile] = useState<string | null>(null);
  const [fileMessage, setFileMessage] = useState("");
  const installations = useInstallationState();
  const fileDrop = useFileDrop();
  const theme = useTheme();
  const [concurrency, setConcurrency] = useState(() => readNumberSetting("tools4devs.concurrency", 2));
  const [conflictPolicy, setConflictPolicy] = useState(
    () => readSetting("tools4devs.conflict") || "keep-both",
  );
  const runner = useOperationRunner({ concurrency, conflictPolicy });
  const update = useUpdate();

  useEffect(() => writeSetting("tools4devs.concurrency", String(concurrency)), [concurrency]);
  useEffect(() => writeSetting("tools4devs.conflict", conflictPolicy), [conflictPolicy]);

  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [defaultFolder, setDefaultFolder] = useState(() => {
    try {
      return localStorage.getItem('tools4devs.destination') ?? '';
    } catch {
      return '';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('tools4devs.destination', defaultFolder);
    } catch {
      /* A blocked store is not worth failing a render over. */
    }
  }, [defaultFolder]);

  // A narrow window starts with the sidebar as an icon strip; once someone opens
  // or collapses it by hand, that choice wins and is remembered.
  const [sidebarChoice, setSidebarChoice] = useStoredState<SidebarChoice>(
    "tools4devs.sidebar-choice",
    legacySidebarChoice(),
    (value): value is SidebarChoice => value === null || value === "collapsed" || value === "expanded",
  );
  const narrowWindow = useMediaQuery("(max-width: 999px)");
  const sidebarCollapsed = sidebarChoice ? sidebarChoice === "collapsed" : narrowWindow;
  const setSidebarCollapsed = (collapsed: boolean) => setSidebarChoice(collapsed ? "collapsed" : "expanded");

  const visibleRows = useMemo(
    () => (activeCategory === null ? catalogRows : catalogRows.filter((row) => row.id === activeCategory)),
    [catalogRows, activeCategory],
  );
  const installationPlan = pendingTool ? installations.planInstallation(pendingTool.id) : [];
  const pinnedToolIds = useMemo(
    () => new Set(toolManifest.tools.filter((tool) => tool.status === "downloadable").map((tool) => tool.id)),
    [],
  );
  const labelsById = useMemo(
    () => Object.fromEntries(toolManifest.tools.map((tool) => [tool.id, tool.displayName])),
    [],
  );
  const runningCount = runner.runningJobs.length;

  const navigatedTool = location.view === "tool" ? (toolsById.get(location.toolId ?? "") ?? null) : null;
  // The panel outlives the navigation by its exit animation, so it is tracked apart from it.
  const [shownTool, setShownTool] = useState<ShownTool | null>(null);
  const [panelLeaving, setPanelLeaving] = useState(false);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (location.view !== "tool") setPage(location.view);
  }, [location.view]);

  useEffect(() => {
    if (navigatedTool) {
      if (!shownTool && document.activeElement instanceof HTMLElement) returnFocusRef.current = document.activeElement;
      setShownTool({ tool: navigatedTool, subId: location.subId });
      setPanelLeaving(false);
    } else if (shownTool) {
      setPanelLeaving(true);
    }
  }, [navigatedTool, location.subId]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (pendingTool) setPendingTool(null);
      else if (navigation.pending) navigation.cancelPending();
      else if (location.view === "tool") closeTool();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pendingTool, navigation, location.view, page]);

  useEffect(() => {
    if (fileDrop.droppedPaths.length === 0) return;
    setFileMessage("");
    if (!navigatedTool) setPendingFile(fileDrop.droppedPaths[0]!);
  }, [fileDrop.droppedPaths]);

  useEffect(() => {
    function openPalette(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen(true);
      }
    }
    window.addEventListener("keydown", openPalette);
    return () => window.removeEventListener("keydown", openPalette);
  }, []);

  function openTool(tool: CatalogTool) {
    go({ view: "tool", toolId: tool.id });
  }

  /** Back to the page behind the panel; the guard asks first when there is work to lose. */
  function closeTool() {
    go({ view: page });
  }

  function finishClosingTool() {
    setShownTool(null);
    setPanelLeaving(false);
    const trigger = returnFocusRef.current;
    window.setTimeout(() => trigger?.isConnected && trigger.focus(), 0);
  }

  function requestInstallation(tool: CatalogTool) {
    setPendingTool(tool);
  }

  function runToolOperation(input: RunOperationInput): string {
    return runner.runOperation(input.request, {
      toolName: input.toolName,
      operationLabel: input.operationLabel,
      sourceLabel: input.sourceLabel,
      options: Object.fromEntries(Object.entries(input.request.options).filter(([key]) => key !== "password")),
    });
  }

  const panelKey = shownTool ? `${shownTool.tool.id}/${shownTool.subId ?? ""}` : "";
  const panelProps = shownTool && {
    tool: shownTool.tool,
    leaving: panelLeaving,
    onDirtyChange: navigation.setDirty,
    onClose: closeTool,
    onExited: finishClosingTool,
  };

  return (
    <AppShell
      rows={catalogRows}
      runningCount={runningCount}
      wordmarkSrc={`/brand/wordmark-${theme.resolvedTheme}.svg`}
      collapsed={sidebarCollapsed}
      onCollapsedChange={setSidebarCollapsed}
      paletteOpen={paletteOpen}
      onPaletteOpenChange={setPaletteOpen}
      overlays={
        <>
          {pendingTool && (
            <InstallDialog
              tool={pendingTool}
              plan={installationPlan}
              labelsById={labelsById}
              states={installations.states}
              canInstall={pinnedToolIds.has(pendingTool.id)}
              onInstall={() => void installations.installTool(pendingTool.id)}
              onClose={() => setPendingTool(null)}
            />
          )}
          <UpdateCard state={update.state} onRestart={update.restart} onDismiss={update.dismiss} />
          {shownTool && panelProps && (
            <>
              <div
                className="panel-scrim"
                role="presentation"
                data-leaving={panelLeaving ? "true" : undefined}
                onMouseDown={closeTool}
              />
              {navigation.pending && (
                <div className="confirm-layer" role="presentation">
                  <div className="confirm-card" role="alertdialog" aria-modal="true" aria-labelledby="confirm-close-title">
                    <h2 id="confirm-close-title">Discard this work?</h2>
                    <p>The file you chose and the settings you changed will be cleared. Nothing on disk is touched either way.</p>
                    <div className="dialog-actions">
                      <button className="button button--light" type="button" autoFocus onClick={navigation.cancelPending}>
                        Keep editing
                      </button>
                      <button className="button button--primary" type="button" onClick={navigation.confirmPending}>
                        Discard
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {utilityGroupIds.includes(shownTool.tool.id) ? (
                <UtilityPanel key={panelKey} {...panelProps} initialSubId={shownTool.subId} />
              ) : shownTool.tool.id === "image-search" ? (
                <ImageSearchPanel
                  key={panelKey}
                  {...panelProps}
                  initialPath={pendingFile}
                  droppedPaths={fileDrop.droppedPaths}
                />
              ) : shownTool.tool.id === "songrec" ? (
                <MusicPanel key={panelKey} {...panelProps} />
              ) : shownTool.tool.id === "chat-mockup" ? (
                <ChatMockupPanel key={panelKey} {...panelProps} />
              ) : shownTool.tool.id === "post-mockup" ? (
                <PostMockupPanel key={panelKey} {...panelProps} />
              ) : (
                <ToolPanel
                  key={panelKey}
                  {...panelProps}
                  initialSubId={shownTool.subId}
                  initialPath={pendingFile}
                  droppedPaths={fileDrop.droppedPaths}
                  jobs={runner.jobs}
                  defaultFolder={defaultFolder}
                  onRun={runToolOperation}
                  onCancel={runner.cancelOperation}
                />
              )}
            </>
          )}
        </>
      }
    >
      {page === "catalog" ? (
        <div className="catalog-view">
          <section className="drop-workspace" aria-labelledby="workspace-title">
            <div className="drop-workspace__copy">
              <h1 id="workspace-title">{t("What do you want to do?")}</h1>
              <p>{t("Pick a tool below. You can also drop a file onto this window, or choose one first.")}</p>
            </div>
            <button
              type="button"
              className="file-drop"
              data-dragging={fileDrop.isDraggingOver ? "true" : undefined}
              onClick={async () => {
                if (!isNativeHost()) {
                  setFileMessage(t("Open tools4devs on Windows to pick local files."));
                  return;
                }
                try {
                  const selected = await open({ multiple: false, directory: false });
                  if (typeof selected === "string") {
                    setPendingFile(selected);
                    setFileMessage("");
                  }
                } catch (error) {
                  setFileMessage(String(error));
                }
              }}
            >
              <Upload size={23} aria-hidden="true" />
              <span>
                <strong>
                  {fileDrop.isDraggingOver
                    ? t("Drop the file here")
                    : (pendingFile?.split(/[\\/]/).pop() ?? t("Drop a file, or choose one"))}
                </strong>
                <small>{t(pendingFile ? "Now open a tool below" : "Processed on your own machine")}</small>
              </span>
            </button>
            {fileMessage && (
              <p className="drop-workspace__notice" role="alert">
                {fileMessage}
              </p>
            )}
          </section>

          <CategoryFilter rows={catalogRows} active={activeCategory} onChange={setActiveCategory} />

          <div className="catalog-rows">
            {visibleRows.map((row) => (
              <ToolSection
                key={row.id}
                row={row}
                installations={installations.states}
                onOpen={openTool}
                onInstall={requestInstallation}
              />
            ))}
          </div>
        </div>
      ) : page === "settings" ? (
        <SettingsView
          preference={theme.preference}
          onThemeChange={theme.setPreference}
          sidebarCollapsed={sidebarCollapsed}
          onSidebarChange={setSidebarCollapsed}
          defaultFolder={defaultFolder}
          onDefaultFolderChange={setDefaultFolder}
          concurrency={concurrency}
          onConcurrencyChange={setConcurrency}
          conflictPolicy={conflictPolicy}
          onConflictPolicyChange={setConflictPolicy}
          language={language}
          onLanguageChange={setLanguage}
          version={update.version}
          updateState={update.state}
          onCheckForUpdates={update.checkNow}
          finishedCount={runner.finishedJobs.length}
          onClearHistory={runner.clearHistory}
          onReturn={() => go({ view: "catalog" })}
        />
      ) : (
        <JobView
          activeNavigation={page}
          runningJobs={runner.runningJobs}
          finishedJobs={runner.finishedJobs}
          onClearHistory={runner.clearFinishedJobs}
          onCancel={runner.cancelOperation}
          onReturn={() => go({ view: "catalog" })}
        />
      )}
    </AppShell>
  );
}

/** The sidebar used to be remembered as expanded on every launch; only "collapsed" was ever a choice. */
function legacySidebarChoice(): SidebarChoice {
  return readSetting("tools4devs.sidebar") === "collapsed" ? "collapsed" : null;
}

function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia?.(query);
      media?.addEventListener?.("change", onChange);
      return () => media?.removeEventListener?.("change", onChange);
    },
    () => window.matchMedia?.(query).matches ?? false,
  );
}

/** Reads a saved setting, tolerating a storage that refuses to answer. */
function readSetting(key: string): string {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function readNumberSetting(key: string, fallback: number): number {
  const value = Number(readSetting(key));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function writeSetting(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // A blocked store costs the preference, never the session.
  }
}
