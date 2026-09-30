import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Upload } from "lucide-react";
import toolManifest from "../../../tooling/tools.json";
import { open } from "@tauri-apps/plugin-dialog";
import { createCatalogRows, type CatalogTool } from "./catalog/catalog";
import { suggestToolsFor } from "./catalog/formats";
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
import { NavigationProvider, useNavigation } from "./navigation/navigation";
import { JobView } from "./views/JobView";
import { SettingsView } from "./views/SettingsView";
import "./styles/theme.css";
import "./styles/app.css";

type SidebarChoice = "collapsed" | "expanded" | null;

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
  // A file chosen or dropped before any tool: the tools made for it, in catalog order.
  const suggestedTools = useMemo(() => {
    if (!pendingFile) return [];
    const ids = new Set(suggestToolsFor(pendingFile));
    return catalogRows.flatMap((row) => row.tools.filter((tool) => ids.has(tool.id)));
  }, [pendingFile, catalogRows]);

  const openedTool = location.view === "tool" ? (toolsById.get(location.toolId ?? "") ?? null) : null;

  useEffect(() => {
    if (fileDrop.droppedPaths.length === 0) return;
    setFileMessage("");
    if (!openedTool) setPendingFile(fileDrop.droppedPaths[0]!);
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

  const showSub = (subId: string) => go({ view: "tool", toolId: location.toolId, subId });

  return (
    <AppShell
      rows={catalogRows}
      runningCount={runningCount}
      wordmarkSrc={`/brand/wordmark-${theme.resolvedTheme}.svg`}
      collapsed={sidebarCollapsed}
      onCollapsedChange={setSidebarCollapsed}
      paletteOpen={paletteOpen}
      onPaletteOpenChange={setPaletteOpen}
      file={pendingFile}
      suggestedTools={suggestedTools}
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
              onOpen={() => {
                setPendingTool(null);
                openTool(pendingTool);
              }}
              onClose={() => setPendingTool(null)}
            />
          )}
          <UpdateCard state={update.state} onRestart={update.restart} onDismiss={update.dismiss} />
        </>
      }
    >
      {openedTool ? (
        utilityGroupIds.includes(openedTool.id) ? (
          <UtilityPanel
            key={openedTool.id}
            tool={openedTool}
            subId={location.subId}
            onSubChange={showSub}
            onDirtyChange={navigation.setDirty}
          />
        ) : openedTool.id === "image-search" ? (
          <ImageSearchPanel
            key={openedTool.id}
            tool={openedTool}
            initialPath={pendingFile}
            droppedPaths={fileDrop.droppedPaths}
            onDirtyChange={navigation.setDirty}
          />
        ) : openedTool.id === "songrec" ? (
          <MusicPanel key={openedTool.id} tool={openedTool} onDirtyChange={navigation.setDirty} />
        ) : openedTool.id === "chat-mockup" ? (
          <ChatMockupPanel key={openedTool.id} tool={openedTool} onDirtyChange={navigation.setDirty} />
        ) : openedTool.id === "post-mockup" ? (
          <PostMockupPanel key={openedTool.id} tool={openedTool} onDirtyChange={navigation.setDirty} />
        ) : (
          <ToolPanel
            key={openedTool.id}
            tool={openedTool}
            subId={location.subId}
            onSubChange={showSub}
            onDirtyChange={navigation.setDirty}
            initialPath={pendingFile}
            droppedPaths={fileDrop.droppedPaths}
            jobs={runner.jobs}
            defaultFolder={defaultFolder}
            onRun={runToolOperation}
            onCancel={runner.cancelOperation}
          />
        )
      ) : location.view === "catalog" ? (
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
            {suggestedTools.length > 0 && (
              <div className="category-filter" role="group" aria-label={t("Tools that read this file")}>
                {suggestedTools.map((tool) => (
                  <button key={tool.id} type="button" className="category-chip" onClick={() => openTool(tool)}>
                    {t(tool.title)}
                  </button>
                ))}
              </div>
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
      ) : location.view === "settings" ? (
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
          activeNavigation={location.view === "history" ? "history" : "queue"}
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
