import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  AlertTriangle,
  Check,
  CircleSlash,
  Clock3,
  Copy,
  FolderClock,
  Grid2X2,
  ListTodo,
  Search,
  Settings,
  Upload,
  PanelLeftClose,
  PanelLeftOpen,
  FolderOpen,
} from "lucide-react";
import toolManifest from "../../../tooling/tools.json";
import { NumberField } from "./components/NumberField";
import { Select } from "./components/Select";
import { open } from "@tauri-apps/plugin-dialog";
import { createCatalogRows, filterCatalogRows, type CatalogTool } from "./catalog/catalog";
import { InstallDialog } from "./components/InstallDialog";
import { ThemeSwitch } from "./components/ThemeSwitch";
import { ToolPanel, type RunOperationInput } from "./components/ToolPanel";
import { ImageSearchPanel } from "./components/ImageSearchPanel";
import { UtilityPanel } from "./components/UtilityPanel";
import { UpdateCard } from "./components/UpdateCard";
import { LanguageProvider, useLanguage, useT, type Language, type Translate } from "./i18n/language";
import { utilityGroupIds } from "./utilities/registry";
import { useUpdate, type UpdateState } from "./hooks/useUpdate";
import { MusicPanel } from "./components/MusicPanel";
import { ChatMockupPanel } from "./components/ChatMockupPanel";
import { PostMockupPanel } from "./components/PostMockupPanel";
import { ToolSection } from "./components/ToolSection";
import { CategoryFilter } from "./components/CategoryFilter";
import type { ToolJob } from "./domain/job-queue";
import { useFileDrop } from "./hooks/useFileDrop";
import { isNativeHost, useOperationRunner } from "./hooks/useOperationRunner";
import { useInstallationState } from "./hooks/useInstallationState";
import { useTheme, type ThemePreference } from "./hooks/useTheme";
import "./styles/theme.css";
import "./styles/app.css";

type NavigationId = "catalog" | "queue" | "history" | "settings";


const navigationItems: Array<{ id: NavigationId; label: string; icon: typeof Grid2X2 }> = [
  { id: "catalog", label: "Tools", icon: Grid2X2 },
  { id: "queue", label: "Queue", icon: ListTodo },
  { id: "history", label: "History", icon: FolderClock },
  { id: "settings", label: "Settings", icon: Settings },
];

export function App() {
  return (
    <LanguageProvider>
      <Shell />
    </LanguageProvider>
  );
}

function Shell() {
  const t = useT();
  const { language, setLanguage } = useLanguage();
  const catalogRows = useMemo(() => createCatalogRows(), []);
  const [activeNavigation, setActiveNavigation] = useState<NavigationId>("catalog");
  const [query, setQuery] = useState("");
  const [selectedTool, setSelectedTool] = useState<CatalogTool | null>(null);
  const [panelLeaving, setPanelLeaving] = useState(false);
  const [scrolled, setScrolled] = useState(false);
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
  const searchRef = useRef<HTMLInputElement>(null);
  const toolTriggerRef = useRef<HTMLButtonElement | null>(null);

  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [panelDirty, setPanelDirty] = useState(false);
  const [confirmingClose, setConfirmingClose] = useState(false);
  // Remembered per machine: someone who works with the sidebar collapsed does
  // not want to collapse it again every launch.
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

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem("tools4devs.sidebar") === "collapsed";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("tools4devs.sidebar", sidebarCollapsed ? "collapsed" : "expanded");
    } catch {
      /* A blocked store is not worth failing a render over. */
    }
  }, [sidebarCollapsed]);
  const searchedRows = useMemo(() => filterCatalogRows(catalogRows, query), [catalogRows, query]);
  // A search spans every category, so narrowing by category on top of it would
  // hide matches the user just asked for.
  const visibleRows = useMemo(
    () =>
      query.trim() || activeCategory === null
        ? searchedRows
        : searchedRows.filter((row) => row.id === activeCategory),
    [searchedRows, activeCategory, query],
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

  useEffect(() => {
    function closeOverlay(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (pendingTool) setPendingTool(null);
      else closeTool();
    }
    window.addEventListener("keydown", closeOverlay);
    return () => window.removeEventListener("keydown", closeOverlay);
  }, [pendingTool]);

  useEffect(() => {
    if (fileDrop.droppedPaths.length === 0) return;
    setFileMessage("");
    if (!selectedTool) setPendingFile(fileDrop.droppedPaths[0]!);
  }, [fileDrop.droppedPaths]);

  useEffect(() => {
    function focusSearch(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  function openTool(tool: CatalogTool, trigger: HTMLButtonElement) {
    toolTriggerRef.current = trigger;
    setPanelLeaving(false);
    setSelectedTool(tool);
  }

  /** The panel leaves along the path it arrived on, so it is unmounted only after the exit. */
  /**
   * Asks first when there is work to lose.
   *
   * Deliberately takes no arguments: it is passed straight to onClick in
   * places, and a "force" parameter would quietly receive the click event —
   * which is truthy, so every X button would skip the question. Forcing is a
   * separate function instead of a flag nobody can see being set.
   */
  function closeTool() {
    if (!selectedTool || panelLeaving) return;
    if (panelDirty) {
      setConfirmingClose(true);
      return;
    }
    discardAndClose();
  }

  function discardAndClose() {
    if (!selectedTool || panelLeaving) return;
    setConfirmingClose(false);
    setPanelLeaving(true);
    window.setTimeout(() => toolTriggerRef.current?.focus(), 0);
  }

  function finishClosingTool() {
    setSelectedTool(null);
    setPanelLeaving(false);
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

  return (
    <div className={`app-shell${sidebarCollapsed ? " app-shell--narrow" : ""}`}>
      <aside className="sidebar" aria-hidden={sidebarCollapsed ? undefined : undefined}>
        <div className="app-mark">
          <span className="app-mark__symbol" aria-hidden="true">
            <img className="app-mark__logo" src="/brand/tools4devs-mark.svg" alt="" width="48" height="48" />
          </span>
          <span>
            <img className="app-mark__wordmark" src={`/brand/wordmark-${theme.resolvedTheme}.svg`} alt="tools4devs" width="118" height="27" />
            <small>{t("Local tools")}</small>
          </span>
        </div>

        <nav aria-label={t("Main navigation")}>
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const badge = item.id === "queue" ? runningCount : 0;
            return (
              <button
                key={item.id}
                type="button"
                className={activeNavigation === item.id ? "nav-item nav-item--active" : "nav-item"}
                onClick={() => setActiveNavigation(item.id)}
                aria-label={
                  badge > 0
                    ? t("{name}, {count} running", { name: t(item.label), count: badge })
                    : t(item.label)
                }
                title={t(item.label)}
                aria-current={activeNavigation === item.id ? "page" : undefined}
              >
                <Icon size={18} aria-hidden="true" />
                <span>{t(item.label)}</span>
                {badge > 0 && (
                  <span className="nav-item__badge" aria-hidden="true">
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="sidebar__status">
          <span className="status-light" aria-hidden="true" />
          <span>
            <strong>Windows x64</strong>
            <small>{t("Local execution enabled")}</small>
          </span>
        </div>
      </aside>

      <main
        className="workspace"
        data-scrolled={scrolled ? "true" : undefined}
        onScroll={(event) => setScrolled(event.currentTarget.scrollTop > 4)}
      >
        <header className="topbar">
          <button
            type="button"
            className="icon-button sidebar-toggle"
            onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
            aria-pressed={sidebarCollapsed}
            aria-label={t(sidebarCollapsed ? "Show the sidebar" : "Hide the sidebar")}
            title={t(sidebarCollapsed ? "Show the sidebar" : "Hide the sidebar")}
          >
            {sidebarCollapsed ? <PanelLeftOpen size={18} aria-hidden="true" /> : <PanelLeftClose size={18} aria-hidden="true" />}
          </button>
          <div className="search-control">
            <Search size={18} aria-hidden="true" />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("Search an action, a format or a tool")}
              aria-label={t("Search tools")}
            />
            <kbd aria-hidden="true">Ctrl K</kbd>
          </div>
          <div className="topbar__tools">
            <ThemeSwitch preference={theme.preference} onChange={theme.setPreference} />
            <button
              className="button button--quiet topbar__action"
              type="button"
              onClick={() => setActiveNavigation("history")}
            >
              <Clock3 size={16} aria-hidden="true" /> {t("History")} · {runner.finishedJobs.length}
            </button>
          </div>
        </header>

        {activeNavigation === "catalog" ? (
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

            {!query.trim() && (
              <CategoryFilter rows={searchedRows} active={activeCategory} onChange={setActiveCategory} />
            )}

            {visibleRows.length > 0 ? (
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
            ) : (
              <section className="empty-state">
                <Search size={24} aria-hidden="true" />
                <h2>{t("No tool matches that")}</h2>
                <p>{t("Try an action like “convert”, an extension like “.pdf”, or the name of the tool.")}</p>
                <button className="button button--light" type="button" onClick={() => setQuery("")}>
                  {t("Clear search")}
                </button>
              </section>
            )}
          </div>
        ) : activeNavigation === "settings" ? (
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
            onReturn={() => setActiveNavigation("catalog")}
          />
        ) : (
          <JobView
            activeNavigation={activeNavigation}
            runningJobs={runner.runningJobs}
            finishedJobs={runner.finishedJobs}
            onClearHistory={runner.clearFinishedJobs}
            onCancel={runner.cancelOperation}
            onReturn={() => setActiveNavigation("catalog")}
          />
        )}
      </main>

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
      {selectedTool && (
        <>
          <div
            className="panel-scrim"
            role="presentation"
            data-leaving={panelLeaving ? "true" : undefined}
            onMouseDown={closeTool}
          />
          {confirmingClose && (
            <div className="confirm-layer" role="presentation">
              <div className="confirm-card" role="alertdialog" aria-modal="true" aria-labelledby="confirm-close-title">
                <h2 id="confirm-close-title">Discard this work?</h2>
                <p>The file you chose and the settings you changed will be cleared. Nothing on disk is touched either way.</p>
                <div className="dialog-actions">
                  <button className="button button--light" type="button" autoFocus onClick={() => setConfirmingClose(false)}>
                    Keep editing
                  </button>
                  <button className="button button--primary" type="button" onClick={discardAndClose}>
                    Discard
                  </button>
                </div>
              </div>
            </div>
          )}

          {utilityGroupIds.includes(selectedTool.id) ? (
            <UtilityPanel
              key={selectedTool.id}
              tool={selectedTool}
              leaving={panelLeaving}
              onDirtyChange={setPanelDirty}
              onClose={closeTool}
              onExited={finishClosingTool}
            />
          ) : selectedTool.id === "image-search" ? (
            <ImageSearchPanel
              key={selectedTool.id}
              tool={selectedTool}
              initialPath={pendingFile}
              droppedPaths={fileDrop.droppedPaths}
              leaving={panelLeaving}
              onDirtyChange={setPanelDirty}
              onClose={closeTool}
              onExited={finishClosingTool}
            />
          ) : selectedTool.id === "songrec" ? (
            <MusicPanel
              key={selectedTool.id}
              tool={selectedTool}
              leaving={panelLeaving}
              onDirtyChange={setPanelDirty}
              onClose={closeTool}
              onExited={finishClosingTool}
            />
          ) : selectedTool.id === "chat-mockup" ? (
            <ChatMockupPanel
              key={selectedTool.id}
              tool={selectedTool}
              leaving={panelLeaving}
              onDirtyChange={setPanelDirty}
              onClose={closeTool}
              onExited={finishClosingTool}
            />
          ) : selectedTool.id === "post-mockup" ? (
            <PostMockupPanel
              key={selectedTool.id}
              tool={selectedTool}
              leaving={panelLeaving}
              onDirtyChange={setPanelDirty}
              onClose={closeTool}
              onExited={finishClosingTool}
            />
          ) : (
            <ToolPanel
              onDirtyChange={setPanelDirty}
              key={selectedTool.id}
              tool={selectedTool}
              initialPath={pendingFile}
              droppedPaths={fileDrop.droppedPaths}
              jobs={runner.jobs}
              defaultFolder={defaultFolder}
              leaving={panelLeaving}
              onClose={closeTool}
              onExited={finishClosingTool}
              onRun={runToolOperation}
              onCancel={runner.cancelOperation}
            />
          )}
        </>
      )}
    </div>
  );
}

function JobView({
  activeNavigation,
  runningJobs,
  finishedJobs,
  onClearHistory,
  onCancel,
  onReturn,
}: {
  activeNavigation: "queue" | "history";
  runningJobs: ToolJob[];
  finishedJobs: ToolJob[];
  onClearHistory: () => void;
  onCancel: (jobId: string) => void;
  onReturn: () => void;
}) {
  const t = useT();
  const isQueue = activeNavigation === "queue";
  const jobs = isQueue ? runningJobs : finishedJobs;
  const title = t(isQueue ? "Operation queue" : "Result history");
  const emptyTitle = t(isQueue ? "Nothing running" : "No results yet");
  const emptyDescription = t(
    isQueue
      ? "An operation started from a tool panel keeps running here after you close the panel, and can be stopped from here."
      : "Everything this app has run, kept across restarts until you clear it.",
  );
  const lead = jobs.length
    ? t(jobs.length === 1 ? "{count} operation in this section." : "{count} operations in this section.", {
        count: jobs.length,
      })
    : t(isQueue ? "Nothing is running right now." : "Nothing has finished yet.");

  return (
    <section className="job-view">
      <div className="job-view__header">
        <span className="placeholder-view__line" aria-hidden="true" />
        <h1>{title}</h1>
        <p>{lead}</p>
        {!isQueue && jobs.length > 0 && (
          <button className="button button--quiet button--small" type="button" onClick={onClearHistory}>
            {t("Clear the history")}
          </button>
        )}
      </div>
      {jobs.length ? (
        <div className="job-list">
          {jobs.map((job) => (
            <JobRow key={job.id} job={job} onCancel={isQueue ? onCancel : undefined} />
          ))}
        </div>
      ) : (
        <div className="job-empty">
          <h2>{emptyTitle}</h2>
          <p>{emptyDescription}</p>
          <button className="button button--light" type="button" onClick={onReturn}>
            {t("Back to the tools")}
          </button>
        </div>
      )}
    </section>
  );
}

/** Left in English here; each is put through the translator where it is shown. */
const statusLabels: Record<ToolJob["status"], string> = {
  queued: "Waiting",
  running: "Running",
  succeeded: "Done",
  failed: "Failed",
  cancelled: "Stopped",
  interrupted: "Interrupted",
};

function JobRow({ job, onCancel }: { job: ToolJob; onCancel?: (jobId: string) => void }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const [revealError, setRevealError] = useState("");
  const percentage = job.progress == null ? null : Math.round(job.progress * 100);
  const optionsLabel = Object.entries(job.options)
    .map(([key, value]) => `${key}: ${value}`)
    .join(" · ");
  async function copyOutputPath() {
    if (!job.outputPath) return;
    try {
      await navigator.clipboard?.writeText(job.outputPath);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied; the path stays visible in the row.
    }
  }

  function revealOutput() {
    setRevealError("");
    void invoke("reveal_path", { path: job.outputPath }).catch((error) =>
      setRevealError(describeError(error)),
    );
  }

  return (
    <article className={`job-row job-row--${job.status}`} aria-label={`${t(job.operationLabel)} — ${t(job.toolName)}`}>
      <div className="job-row__identity">
        <strong>{t(job.operationLabel)}</strong>
        <span>
          {t(job.toolName)} · {job.sourceLabel}
          {optionsLabel ? ` · ${optionsLabel}` : ""}
        </span>
        <span className="job-row__message">{hostMessage(job.message, t)}</span>
        {job.outputPath && (
          // The path itself is not shown: it is one long monospace line that
          // pushed the row wide and told nobody anything they could act on.
          // The two things anybody does with it are here instead, and the
          // whole path is on the buttons for anyone who hovers.
          <span className="job-row__actions">
            <button
              className="button button--quiet button--small"
              type="button"
              title={job.outputPath}
              onClick={revealOutput}
            >
              <FolderOpen size={13} aria-hidden="true" /> {t("Show in folder")}
            </button>
            <button
              className="button button--quiet button--small"
              type="button"
              title={job.outputPath}
              onClick={() => void copyOutputPath()}
              aria-live="polite"
            >
              {copied ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
              {t(copied ? "Copied" : "Copy path")}
            </button>
          </span>
        )}
        {revealError && (
          <span className="job-row__message job-row__message--error" role="alert">
            {t(revealError)}
          </span>
        )}
      </div>
      <div className="job-row__status">
        <span className="job-row__status-label">
          {job.status === "succeeded" && <Check size={13} aria-hidden="true" />}
          {(job.status === "failed" || job.status === "interrupted") && (
            <AlertTriangle size={13} aria-hidden="true" />
          )}
          {(job.status === "cancelled" || job.status === "queued") && (
            <CircleSlash size={13} aria-hidden="true" />
          )}
          {t(statusLabels[job.status])}
          {job.status === "running" && percentage != null ? ` ${percentage}%` : ""}
        </span>
        {onCancel && (job.status === "running" || job.status === "queued") && (
          <button
            className="button button--quiet button--small"
            type="button"
            onClick={() => onCancel(job.id)}
          >
            <CircleSlash size={13} aria-hidden="true" /> {t("Stop")}
          </button>
        )}
        {job.status === "running" && (
          <div
            className={`progress-track${percentage == null ? " progress-track--indeterminate" : ""}`}
            role="progressbar"
            aria-label={t("Progress of {name}", { name: job.operationLabel })}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percentage ?? undefined}
          >
            <span style={{ inlineSize: percentage == null ? undefined : `${percentage}%` }} />
          </div>
        )}
      </div>
    </article>
  );
}

function SettingsView({
  preference,
  onThemeChange,
  sidebarCollapsed,
  onSidebarChange,
  defaultFolder,
  onDefaultFolderChange,
  concurrency,
  onConcurrencyChange,
  conflictPolicy,
  onConflictPolicyChange,
  language,
  onLanguageChange,
  version,
  updateState,
  onCheckForUpdates,
  finishedCount,
  onClearHistory,
  onReturn,
}: {
  preference: ThemePreference;
  onThemeChange: (preference: ThemePreference) => void;
  sidebarCollapsed: boolean;
  onSidebarChange: (collapsed: boolean) => void;
  defaultFolder: string;
  onDefaultFolderChange: (folder: string) => void;
  concurrency: number;
  onConcurrencyChange: (value: number) => void;
  conflictPolicy: string;
  onConflictPolicyChange: (value: string) => void;
  language: Language;
  onLanguageChange: (language: Language) => void;
  version: string;
  updateState: UpdateState;
  onCheckForUpdates: () => Promise<void>;
  finishedCount: number;
  onClearHistory: () => void;
  onReturn: () => void;
}) {
  const t = useT();
  const answer = updateMessage(updateState, t);

  return (
    <section className="settings-view">
      <div className="job-view__header">
        <span className="placeholder-view__line" aria-hidden="true" />
        <h1>{t("Settings")}</h1>
      </div>

      <div className="settings-card">
        <div className="settings-card__copy">
          <h2>{t("Version")}</h2>
          {answer && <p>{answer}</p>}
        </div>
        <div className="settings-card__control">
          <span className="settings-card__path">{version ? `tools4devs ${version}` : "—"}</span>
          <button
            className="button button--light"
            type="button"
            onClick={() => void onCheckForUpdates()}
            disabled={updateState.phase === "checking" || updateState.phase === "downloading"}
          >
            {t(updateState.phase === "checking" ? "Checking…" : "Check now")}
          </button>
        </div>
      </div>

      <div className="settings-card">
        <div className="settings-card__copy">
          <h2>{t("Language")}</h2>
        </div>
        <div className="settings-card__control settings-card__control--wide">
          <Select
            label={t("Language")}
            value={language}
            choices={[
              { value: "en", label: "English" },
              { value: "pt", label: "Português (Brasil)" },
            ]}
            onChange={(value) => onLanguageChange(value === "pt" ? "pt" : "en")}
          />
        </div>
      </div>

      <div className="settings-card">
        <div className="settings-card__copy">
          <h2>{t("Theme")}</h2>
        </div>
        <ThemeSwitch preference={preference} onChange={onThemeChange} variant="labelled" />
      </div>

      <div className="settings-card">
        <div className="settings-card__copy">
          <h2>{t("Sidebar")}</h2>
        </div>
        <button
          className="button button--light"
          type="button"
          onClick={() => onSidebarChange(!sidebarCollapsed)}
          aria-pressed={sidebarCollapsed}
        >
          {t(sidebarCollapsed ? "Show it" : "Hide it")}
        </button>
      </div>

      <div className="settings-card">
        <div className="settings-card__copy">
          <h2>{t("Default destination")}</h2>
        </div>
        <div className="settings-card__control">
          <span className="settings-card__path">{defaultFolder || t("Not set")}</span>
          <button
            className="button button--light"
            type="button"
            onClick={() => {
              void open({ directory: true, multiple: false })
                .then((selected) => {
                  if (typeof selected === "string") onDefaultFolderChange(selected);
                })
                .catch(() => undefined);
            }}
          >
            {t("Choose")}
          </button>
          {defaultFolder && (
            <button className="button button--light" type="button" onClick={() => onDefaultFolderChange("")}>
              {t("Clear")}
            </button>
          )}
        </div>
      </div>

      <div className="settings-card">
        <div className="settings-card__copy">
          <h2>{t("History")}</h2>
          <p>
            {finishedCount > 0
              ? t(finishedCount === 1 ? "{count} finished operation" : "{count} finished operations", {
                  count: finishedCount,
                })
              : t("Nothing has finished yet")}
          </p>
        </div>
        <button
          className="button button--light"
          type="button"
          onClick={onClearHistory}
          disabled={finishedCount === 0}
        >
          {t("Clear")}
        </button>
      </div>

      <div className="settings-card">
        <div className="settings-card__copy">
          <h2>{t("How many at once")}</h2>
          <p>{t("Anything beyond this waits in the queue.")}</p>
        </div>
        <div className="settings-card__control">
          <NumberField
            label={t("Operations at once")}
            value={String(concurrency)}
            min={1}
            max={8}
            onChange={(value) => onConcurrencyChange(Math.min(8, Math.max(1, Number(value) || 1)))}
          />
        </div>
      </div>

      <div className="settings-card">
        <div className="settings-card__copy">
          <h2>{t("When the file already exists")}</h2>
        </div>
        <div className="settings-card__control settings-card__control--wide">
          <Select
            label={t("When the file already exists")}
            value={conflictPolicy}
            choices={[
              { value: "keep-both", label: t("Keep both — number the new one") },
              { value: "overwrite", label: t("Overwrite the old one") },
            ]}
            onChange={onConflictPolicyChange}
          />
        </div>
      </div>

      <div className="settings-card settings-card--pending">
        <div className="settings-card__copy">
          <h2>{t("Not available yet")}</h2>
          <ul>
            <li>{t("Pausing an operation, rather than stopping it")}</li>
            <li>{t("Scheduling one for later")}</li>
          </ul>
        </div>
      </div>

      <button className="button button--light" type="button" onClick={onReturn}>
        {t("Back to the tools")}
      </button>
    </section>
  );
}

/** What the last check found, in the one sentence the card has room for. */
function updateMessage(state: UpdateState, t: Translate): string {
  switch (state.phase) {
    case "current":
      return t("This is the newest version.");
    case "downloading":
      return t("A newer version is downloading.");
    case "ready":
      return t("Version {version} is ready — restart to use it.", { version: state.version });
    case "failed":
      return t("The last check failed: {message}", { message: state.message });
    default:
      return "";
  }
}

/**
 * Translates what the host said about a job.
 *
 * The host speaks English, like the rest of the source, and most of what it
 * says is a fixed sentence the dictionary holds. Two carry a value inside
 * them, so they are matched rather than looked up; anything unrecognised is
 * shown exactly as it arrived, which is right for a tool's own error text.
 */
function hostMessage(message: string, t: Translate): string {
  const starting = /^Starting (.+)…$/.exec(message);
  if (starting) return t("Starting {name}…", { name: starting[1]! });

  const enlarged = /^Image enlarged (.+)× with Lanczos3\.$/.exec(message);
  if (enlarged) return t("Image enlarged {factor}× with Lanczos3.", { factor: enlarged[1]! });

  return t(message);
}

/** What an error from the host is, once it stops being unknown. */
function describeError(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  return "That file could not be shown.";
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
