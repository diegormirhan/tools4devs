import { useEffect, useMemo, useState } from "react";
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
import { CatalogView } from "./home/CatalogView";
import { useFileDrop } from "./hooks/useFileDrop";
import { isNativeHost, useOperationRunner } from "./hooks/useOperationRunner";
import { useInstallationState } from "./hooks/useInstallationState";
import { useMediaQuery } from "./hooks/useMediaQuery";
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

  async function chooseFile() {
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
        <div data-legacy>
        {utilityGroupIds.includes(openedTool.id) ? (
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
        )}
        </div>
      ) : location.view === "catalog" ? (
        <CatalogView
          rows={catalogRows}
          installations={installations.states}
          onOpen={openTool}
          onInstall={requestInstallation}
          file={pendingFile}
          fileMessage={fileMessage}
          dragging={fileDrop.isDraggingOver}
          onChooseFile={() => void chooseFile()}
          suggestedTools={suggestedTools}
        />
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
        />
      ) : (
        <JobView
          activeNavigation={location.view === "history" ? "history" : "queue"}
          runningJobs={runner.runningJobs}
          finishedJobs={runner.finishedJobs}
          onClearHistory={runner.clearFinishedJobs}
          onCancel={runner.cancelOperation}
          onReturn={() => go({ view: "catalog" })}
          iconFor={(toolId) => toolsById.get(toolId)?.icon}
        />
      )}
    </AppShell>
  );
}

/** The sidebar used to be remembered as expanded on every launch; only "collapsed" was ever a choice. */
function legacySidebarChoice(): SidebarChoice {
  return readSetting("tools4devs.sidebar") === "collapsed" ? "collapsed" : null;
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
