import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, CircleSlash, FilePlus2, FolderOpen, Play } from "lucide-react";
import { open, save } from "@tauri-apps/plugin-dialog";
import type { CatalogTool } from "../catalog/catalog";
import { findJob, type ToolJob } from "../domain/job-queue";
import { isNativeHost, type OperationRequest } from "../hooks/useOperationRunner";
import { FilePreview, previewKind } from "./FilePreview";
import { defaultCrop, type CropRect } from "./CropOverlay";
import { Select } from "./Select";
import { NumberField } from "./NumberField";
import { acceptsFile, operationFormats } from "../catalog/formats";
import { useT, type Translate } from "../i18n/language";

export type RunOperationInput = {
  request: OperationRequest;
  toolName: string;
  operationLabel: string;
  sourceLabel: string;
};

type ToolPanelProps = {
  tool: CatalogTool;
  /** The operation shown, as the sidebar and the palette name it; the first when absent. */
  subId?: string;
  /** Asked to show another operation, so the sidebar and the breadcrumb follow. */
  onSubChange?: (subId: string) => void;
  initialPath?: string | null;
  droppedPaths?: string[];
  jobs?: ToolJob[];
  /** Where the save dialog should open, chosen in Settings. */
  defaultFolder?: string;
  /** Raised when there is work a close would throw away. */
  onDirtyChange?: (dirty: boolean) => void;
  onRun?: (input: RunOperationInput) => string;
  /** Stops the job this panel started, without leaving the panel. */
  onCancel?: (jobId: string) => void;
};

type SelectedFile = { name: string; path: string };

export function ToolPanel({ tool, subId, onSubChange, initialPath, droppedPaths, jobs = [], defaultFolder = "", onRun, onCancel, onDirtyChange }: ToolPanelProps) {
  const t = useT();
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>(() =>
    initialPath && ![...urlTools, ...folderTools].includes(tool.id)
      ? [{ path: initialPath, name: fileNameOnly(initialPath) }]
      : [],
  );
  const pickOperation = (id?: string) =>
    tool.operations.find((operation) => operation.id === id)?.id ?? tool.operations[0]?.id ?? "";
  const [selectedOperationId, setSelectedOperationId] = useState(() => pickOperation(subId));
  const [sourceUrl, setSourceUrl] = useState("");
  const [operationOptions, setOperationOptions] = useState<Record<string, string>>({});
  const [outputPath, setOutputPath] = useState("");
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [formError, setFormError] = useState("");
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const pageRef = useRef<HTMLElement>(null);

  const selectedOperation = tool.operations.find((operation) => operation.id === selectedOperationId);
  /**
   * Where this will be saved without asking, when a default folder is set.
   *
   * A folder chosen in Settings used to be only the dialog's starting point,
   * which meant the setting changed nothing about how many questions you were
   * asked. It now decides the destination outright, and the row below says so
   * before the run rather than after it. The folder button still overrides it.
   */
  // Only once there is something to name it after: a destination invented from
  // no input reads as a real decision, and it is a placeholder with a made-up
  // extension.
  const hasSource = selectedFiles.length > 0 || sourceUrl.trim().length > 0;
  const automaticOutput =
    defaultFolder && hasSource && requiresOutput(tool.id, selectedOperationId)
      ? writesToDirectory(tool.id, selectedOperationId)
        ? defaultFolder
        : startingPath()
      : "";
  const effectiveOutput = outputPath || automaticOutput;
  const selectedFileNames = selectedFiles.map((file) => file.name);
  const currentJob = findJob(jobs, currentJobId);
  const isRunning = currentJob?.status === "running";
  const needsTwoFiles = tool.id === "difftastic";
  const canRun =
    (needsTwoFiles ? selectedFiles.length >= 2 : selectedFiles.length > 0) ||
    (urlTools.includes(tool.id) && sourceUrl.trim().length > 0);
  // The crop rectangle is not separate state: it is the same four options the
  // fields write, read back. Two sources would drift the moment one is edited.
  const cropsVisually =
    selectedOperationId === "crop" && (tool.id === "libvips" || tool.id === "ffmpeg");
  const crop: CropRect | null = cropsVisually
    ? {
        left: Number(operationOptions.left ?? 0),
        top: Number(operationOptions.top ?? 0),
        width: Number(operationOptions.width ?? 0),
        height: Number(operationOptions.height ?? 0),
      }
    : null;

  /** Keeps files the tool cannot read out, with a reason rather than a later failure. */
  function admitFiles(paths: string[]): SelectedFile[] {
    const rejected: string[] = [];
    const admitted = paths.filter((path) => {
      const verdict = acceptsFile(tool.id, path, selectedOperationId);
      if (!verdict.ok) rejected.push(verdict.reason);
      return verdict.ok;
    });
    if (rejected.length > 0) setFormError(rejected[0]!);
    return admitted.map((path) => ({ path, name: fileNameOnly(path) }));
  }

  const applyCrop = (rect: CropRect) => {
    setOperationOptions((current) => ({
      ...current,
      left: String(rect.left),
      top: String(rect.top),
      width: String(rect.width),
      height: String(rect.height),
    }));
    resetFeedback();
  };

  // Work worth a question before discarding: a file chosen, a URL typed, or
  // options touched. Asking when there is nothing to lose trains people to
  // dismiss the question without reading it.
  // Once the operation has been started the work is in the queue, and the
  // panel itself says so — closing loses nothing, so asking would contradict
  // the promise printed two lines below it.
  const dirty =
    !currentJob &&
    (selectedFiles.length > 0 ||
      sourceUrl.trim().length > 0 ||
      Object.values(operationOptions).some((value) => value.trim().length > 0));

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  // A conversion should say what it produces, instead of leaving it to whatever
  // extension the user types into the save dialog.
  const formatChoice = operationFormats[`${tool.id}/${selectedOperationId}`];
  const targetFormat = operationOptions.format || formatChoice?.default || "";

  const previewable = previewKind(selectedFiles[0]?.path) !== "none";

  // Seeding has to react to both orders: choosing the file first, or switching
  // to the crop operation with one already open. Waiting for the image to load
  // only covers the first, and left the rectangle at zero for the second.
  useEffect(() => {
    if (!cropsVisually || naturalSize.width === 0) return;
    if (Number(operationOptions.width) > 0) return;
    applyCrop(defaultCrop(naturalSize));
  }, [cropsVisually, naturalSize, operationOptions.width]);
  const resultMessage = formError || (currentJob && currentJob.status !== "running" ? jobResultText(currentJob) : "");
  const resultIsError = Boolean(formError) || currentJob?.status === "failed";

  // Arriving from the keyboard lands on the page, not back at the top of the sidebar.
  useEffect(() => pageRef.current?.focus({ preventScroll: true }), []);

  // The files stay; the options and the destination belong to the operation that is left.
  function showOperation(id: string) {
    setSelectedOperationId(id);
    setOperationOptions({});
    setOutputPath("");
    resetFeedback();
  }

  // The sidebar or the palette chose another operation of this tool.
  useEffect(() => {
    const next = pickOperation(subId);
    if (next !== selectedOperationId) showOperation(next);
    // Only a change from outside matters; the selection follows it, not the other way round.
  }, [subId]);

  // A file dropped on the window belongs to the tool the user already has open.
  useEffect(() => {
    if (!droppedPaths?.length || urlTools.includes(tool.id)) return;
    // Clearing first: admitFiles reports why a file was refused, and doing
    // this after would wipe the only explanation the user gets.
    setFormError("");
    setCurrentJobId(null);
    setSelectedFiles(admitFiles(droppedPaths));
  }, [droppedPaths, tool.id]);

  return (
    <section
      ref={pageRef}
      tabIndex={-1}
      className={`tool-panel tool-panel--page${previewable ? " tool-panel--wide" : ""}`}
      aria-labelledby="tool-panel-title"
    >
      <div className="tool-panel__topbar">
        <span>{tool.integrationName}</span>
      </div>
      <div className={`tool-panel__body${previewable ? " tool-panel__body--split" : ""}`}>
        {previewable && (
          <section className="tool-panel__workspace" aria-label={t("File preview")}>
            <FilePreview
              path={selectedFiles[0]?.path}
              crop={crop}
              onCropChange={applyCrop}
              seekTo={
                selectedOperationId === "thumbnail"
                  ? Number(operationOptions.at ?? 1)
                  : selectedOperationId === "trim"
                    ? Number(operationOptions.start ?? 0)
                    : undefined
              }
              onNatural={setNaturalSize}
            />
          </section>
        )}

        <section className="tool-panel__controls">
        <h2 id="tool-panel-title">{t(tool.title)}</h2>
        <p>{t(tool.description)}</p>

        {tool.operations.length > 0 && (
          <label className="operation-select">
            <span>{t("Operation")}</span>
            <Select
              label={t("Operation")}
              value={selectedOperationId}
              choices={tool.operations.map((operation) => ({
                value: operation.id,
                label: t(operation.label),
              }))}
              onChange={(next) => {
                showOperation(next);
                onSubChange?.(next);
              }}
            />
            <small>{selectedOperation ? t(selectedOperation.description) : ""}</small>
          </label>
        )}

        {formatChoice && formatChoice.formats.length > 1 && (
          <label className="operation-select">
            <span>{formatChoice.label}</span>
            <Select
              label={formatChoice.label}
              value={targetFormat}
              choices={formatChoice.formats.map((format) => ({
                value: format,
                label: format.toUpperCase(),
              }))}
              onChange={(next) => {
                setOperationOptions((current) => ({ ...current, format: next }));
                // The destination carried the old extension, so it has to go.
                setOutputPath("");
                resetFeedback();
              }}
            />
          </label>
        )}

        <OperationOptions
          onPickFile={(key) => {
            void open({ multiple: false })
              .then((selected) => {
                if (typeof selected === "string") {
                  setOperationOptions((current) => ({ ...current, [key]: selected }));
                }
              })
              .catch(handleFormError);
          }}
          toolId={tool.id}
          operationId={selectedOperationId}
          values={operationOptions}
          onChange={(key, value) => {
            setOperationOptions((currentValues) => {
              const next = { ...currentValues, [key]: value };
              // "Sign in" is one control over two host options: a browser
              // name, or a cookie file. Sending both is rejected, so the
              // unused one is cleared rather than left behind.
              if (key === "signIn") {
                next.cookiesFrom = value === "file" ? "" : value;
                if (value !== "file") next.cookieFile = "";
              }
              return next;
            });
            resetFeedback();
          }}
        />

        {urlTools.includes(tool.id) && (
          <label className="source-url">
            <span>{t("Media URL")}</span>
            <input
              aria-label={t("Media URL")}
              type="url"
              placeholder="https://..."
              value={sourceUrl}
              onChange={(event) => {
                setSourceUrl(event.target.value);
                resetFeedback();
              }}
            />
            <small className="source-url__hint">{supportedSitesHint(tool.id, t)}</small>
          </label>
        )}

        {!urlTools.includes(tool.id) && <FileField />}

        {requiresOutput(tool.id, selectedOperationId) && (
          <div className="tool-option">
            <span>
              <strong>{t("Destination")}</strong>
              <small>
                {effectiveOutput ||
                  t("Choose the destination when you run it. The extension decides the format.")}
              </small>
              {!outputPath && automaticOutput && (
                <small className="tool-option__note">
                  {t("Your default folder, from Settings. Pick another with the button.")}
                </small>
              )}
            </span>
            <button
              className="icon-button"
              type="button"
              aria-label={t("Choose destination")}
              onClick={() => void chooseNativeOutput().catch(handleFormError)}
            >
              <FolderOpen size={18} />
            </button>
          </div>
        )}

        {resultMessage && (
          <pre
            className={`run-message${resultIsError ? " run-message--error" : ""}`}
            role={resultIsError ? "alert" : "status"}
          >
            {resultMessage}
          </pre>
        )}
        </section>
      </div>
      <div className="tool-panel__footer">
        <div className="tool-panel__status" aria-live="polite">
          {isRunning ? (
            <>
              <div className="tool-panel__status-line">
                <strong>{currentJob.message}</strong>
                <span>{currentJob.progress == null ? "…" : `${Math.round(currentJob.progress * 100)}%`}</span>
              </div>
              <div
                className={`progress-track progress-track--operation${currentJob.progress == null ? " progress-track--indeterminate" : ""}`}
                role="progressbar"
                aria-label={t("Operation progress")}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={currentJob.progress == null ? undefined : Math.round(currentJob.progress * 100)}
              >
                <span
                  style={{ inlineSize: currentJob.progress == null ? undefined : `${currentJob.progress * 100}%` }}
                />
              </div>
              <p className="tool-panel__hint">{t("You can close this tool: the job keeps running in the Queue.")}</p>
            </>
          ) : (
            <p>
              {currentJob?.status === "succeeded" ? (
                <>
                  <Check size={14} aria-hidden="true" /> {t("Done, and recorded in the history.")}
                </>
              ) : currentJob?.status === "failed" ? (
                <>
                  <AlertTriangle size={14} aria-hidden="true" /> {t("The job failed. Your original file was left untouched.")}
                </>
              ) : (
                canRun ? readyHint(tool.id, selectedOperationId, t) : idleHint(tool.id, t)
              )}
            </p>
          )}
        </div>
        {isRunning && onCancel && currentJobId ? (
          <button className="button button--light" type="button" onClick={() => onCancel(currentJobId)}>
            <CircleSlash size={16} aria-hidden="true" /> {t("Stop")}
          </button>
        ) : (
          <button
            className="button button--primary"
            type="button"
            disabled={!canRun || isRunning}
            onClick={() => void startOperation()}
          >
            <Play size={16} aria-hidden="true" /> {t(isRunning ? "Running" : "Run")}
          </button>
        )}
      </div>
    </section>
  );

  function FileField() {
    const label = selectedFileNames.length
      ? selectedFileNames.join(", ")
      : folderTools.includes(tool.id)
        ? t("Choose the project folder")
        : tool.id === "difftastic"
          ? t("Choose both files")
          : t("Choose files");
    const hint = selectedFileNames.length
      ? t(selectedFileNames.length === 1 ? "{count} file selected" : "{count} files selected", {
          count: selectedFileNames.length,
        })
      : t("or click to choose");

    // The native host must receive real Windows paths, so it opens a system dialog.
    // A file input would only expose a bare file name to the WebView.
    if (isNativeHost()) {
      return (
        <button
          type="button"
          className="file-drop file-drop--compact"
          onClick={() => void chooseNativeFiles().catch(handleFormError)}
        >
          <FilePlus2 size={24} aria-hidden="true" />
          <strong>{label}</strong>
          <span>{hint}</span>
        </button>
      );
    }

    return (
      <label className="file-drop file-drop--compact">
        <input
          type="file"
          multiple
          aria-label={t("Choose files")}
          onChange={(event) => {
            setSelectedFiles(admitFiles(Array.from(event.target.files ?? []).map((file) => file.name)));
            resetFeedback();
          }}
        />
        <FilePlus2 size={24} aria-hidden="true" />
        <strong>{label}</strong>
        <span>{hint}</span>
      </label>
    );
  }

  function resetFeedback() {
    setFormError("");
    setCurrentJobId(null);
  }

  async function chooseNativeFiles() {
    const directory = folderTools.includes(tool.id);
    const multiple =
      multiInputOperations.includes(selectedOperationId) ||
      (tool.id === "7zip" && selectedOperationId === "compress");
    const selected = await open({ multiple: !directory && multiple, directory });
    if (!selected) return;
    const paths = Array.isArray(selected) ? selected : [selected];
    // Same order as the drop path: the refusal message has to survive.
    resetFeedback();
    setSelectedFiles(admitFiles(paths));
  }

  /**
   * Where the save dialog opens. The configured folder replaces the suggested
   * file's own folder; the name each operation picked is kept, because it
   * carries the extension that decides the format.
   */
  function startingPath() {
    const suggested = suggestedOutputName(
      selectedFiles[0]?.path,
      selectedOperationId,
      tool.id,
      operationOptions,
    );
    if (!defaultFolder) return suggested;
    const name = suggested.split(/[\\/]/).pop() ?? suggested;
    return `${defaultFolder.replace(/[\\/]+$/, "")}${"\\"}${name}`;
  }

  async function chooseNativeOutput() {
    if (!isNativeHost()) return;
    if (writesToDirectory(tool.id, selectedOperationId)) {
      const selected = await open({ directory: true, multiple: false });
      if (typeof selected === "string") setOutputPath(selected);
      return;
    }
    const selected = await save({
      defaultPath: startingPath(),
    });
    if (selected) setOutputPath(selected);
  }

  async function startOperation() {
    if (!canRun || isRunning) return;
    resetFeedback();
    try {
      const resolvedOutput =
        effectiveOutput ||
        (isNativeHost() && requiresOutput(tool.id, selectedOperationId) ? await pickOutputForOperation() : "");
      const jobId = onRun?.({
        request: {
          toolId: tool.id,
          operationId: selectedOperationId,
          inputPaths: selectedFiles.map((file) => file.path),
          outputPath: resolvedOutput || null,
          options: operationOptions,
          sourceUrl: sourceUrl.trim() || null,
        },
        toolName: tool.title,
        operationLabel: t(selectedOperation?.label ?? "Run operation"),
        sourceLabel: sourceUrl.trim() || selectedFileNames.join(", ") || tool.integrationName,
      });
      if (jobId) setCurrentJobId(jobId);
    } catch (error) {
      handleFormError(error);
    }
  }

  async function pickOutputForOperation() {
    if (writesToDirectory(tool.id, selectedOperationId)) {
      const selected = await open({ directory: true, multiple: false });
      if (typeof selected !== "string") throw new Error(t("Choose a destination folder to continue."));
      setOutputPath(selected);
      return selected;
    }
    const selected = await save({
      defaultPath: startingPath(),
    });
    if (!selected) throw new Error(t("Choose an output file to continue."));
    setOutputPath(selected);
    return selected;
  }

  function handleFormError(error: unknown) {
    setFormError(
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : t("The operation could not be started."),
    );
  }
}

function jobResultText(job: ToolJob): string {
  return job.outputPath ? `${job.message}\nOutput: ${job.outputPath}` : job.message;
}

function idleHint(toolId: string, t: Translate): string {
  if (urlTools.includes(toolId)) return t("Add a URL to enable the run.");
  if (toolId === "difftastic") return t("Choose two files to compare.");
  if (folderTools.includes(toolId)) return t("Choose a folder to enable the run.");
  return t("Add files to enable the run.");
}

/** Shown once the run is possible, so the footer stops asking for what is done. */
function readyHint(toolId: string, operationId: string, t: Translate): string {
  if (operationId === "crop") return t("Drag the rectangle to choose what survives.");
  if (operationId === "trim") return t("Set the start and end, then run.");
  if (urlTools.includes(toolId)) return t("Ready. The download runs in the background.");
  return t("Ready to run.");
}

function OperationOptions({
  toolId,
  operationId,
  values,
  onChange,
  onPickFile,
}: {
  toolId: string;
  operationId: string;
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  onPickFile?: (key: string) => void;
}) {
  const t = useT();
  const fields = operationFields(toolId, operationId).filter(
    (field) => field.showWhen?.(values) ?? true,
  );
  if (fields.length === 0) return null;
  return (
    <div className="operation-options" aria-label={t("Operation options")}>
      {fields.map((field) => {
        const value = values[field.key] ?? field.defaultValue ?? "";
        return (
          <label key={field.key}>
            <span>{t(field.label)}</span>
            {field.type === "select" ? (
              <Select
                label={t(field.label)}
                value={value}
                choices={(field.choices ?? []).map((choice) => ({
                  value: choice.value,
                  label: t(choice.label),
                }))}
                onChange={(next) => onChange(field.key, next)}
              />
            ) : field.type === "file" ? (
              <span className="operation-options__file">
                <input
                  aria-label={t(field.label)}
                  type="text"
                  placeholder={field.placeholder && t(field.placeholder)}
                  value={value}
                  onChange={(event) => onChange(field.key, event.target.value)}
                />
                <button
                  type="button"
                  className="icon-button"
                  aria-label={t("Choose {name}", { name: t(field.label) })}
                  onClick={() => onPickFile?.(field.key)}
                >
                  <FilePlus2 size={16} />
                </button>
              </span>
            ) : field.type === "number" ? (
              <NumberField
                label={t(field.label)}
                value={value}
                placeholder={field.placeholder}
                min={field.min}
                max={field.max}
                step={field.step}
                onChange={(next) => onChange(field.key, next)}
              />
            ) : (
              <input
                aria-label={t(field.label)}
                type={field.type}
                placeholder={field.placeholder && t(field.placeholder)}
                value={value}
                onChange={(event) => onChange(field.key, event.target.value)}
              />
            )}
            {field.hint && <small className="operation-options__hint">{t(field.hint)}</small>}
          </label>
        );
      })}
    </div>
  );
}

type OperationField = {
  key: string;
  label: string;
  type: "text" | "number" | "password" | "select" | "file";
  placeholder?: string;
  defaultValue?: string;
  /** Present only for `select`. */
  choices?: Array<{ value: string; label: string }>;
  /** Guidance shown under the control, for rules the label cannot carry. */
  hint?: string;
  /** Limits for a number field, which its steppers clamp to. */
  min?: number;
  max?: number;
  step?: number;
  /** Lets a field depend on another one's value. */
  showWhen?: (values: Record<string, string>) => boolean;
};

/** Browsers yt-dlp can read cookies from; mirrors COOKIE_BROWSERS in the host. */
const cookieBrowsers = [
  { value: "firefox", label: "Firefox" },
  { value: "chrome", label: "Chrome" },
  { value: "chromium", label: "Chromium" },
  { value: "edge", label: "Edge" },
  { value: "brave", label: "Brave" },
  { value: "opera", label: "Opera" },
  { value: "vivaldi", label: "Vivaldi" },
];

function operationFields(toolId: string, operationId: string): OperationField[] {
  if (urlTools.includes(toolId)) {
    const fields: OperationField[] = [];
    if (toolId === "yt-dlp" && operationId === "download-video") {
      fields.push({
        key: "quality",
        label: "Quality",
        type: "select",
        defaultValue: "compatible",
        choices: [
          { value: "compatible", label: "Compatible — mp4, plays anywhere" },
          { value: "best", label: "Best available — mkv, 4K and beyond" },
        ],
        hint: "YouTube publishes nothing above 1080p in mp4, so the highest resolutions need Matroska.",
      });
    }
    fields.push({
      key: "signIn",
      label: "Sign in",
      type: "select",
      defaultValue: "",
      choices: [
        { value: "", label: "Not signed in" },
        { value: "file", label: "Cookie file…" },
        ...cookieBrowsers.map((browser) => ({
          value: browser.value,
          label: `Cookies from ${browser.label}`,
        })),
      ],
      hint: "Reaches what your account can already watch — age-restricted and members-only. It unlocks nothing your account cannot see, and using an account carries a risk of it being limited.",
    });
    fields.push({
      key: "cookieFile",
      label: "Cookie file",
      type: "file",
      placeholder: "cookies.txt",
      showWhen: (values) => values.signIn === "file",
      hint: "Export it from a private window and close that window straight away: YouTube rotates the cookies of any tab left open, which invalidates the file.",
    });
    return fields;
  }
  if (toolId === "libvips" && operationId === "upscale-model")
    return [
      {
        key: "scale",
        label: "Enlarge by",
        type: "select",
        defaultValue: "4",
        choices: [
          { value: "2", label: "2x" },
          { value: "3", label: "3x" },
          { value: "4", label: "4x — what the model produces" },
        ],
        hint: "The model always works at four times and a smaller result is that, resized down. It is the better way round: a model asked for a factor it was not trained on is where the artefacts come from.",
      },
    ];
  if (toolId === "ffmpeg") {
    // Every operation that re-encodes offers the same two choices, so they are
    // defined once rather than repeated per operation.
    const encoding: OperationField[] = [
      {
        key: "codec",
        label: "Codec",
        type: "select",
        defaultValue: "h264",
        choices: [
          { value: "h264", label: "H.264 — plays everywhere" },
          { value: "av1", label: "AV1 — much smaller, slower to encode" },
        ],
        hint: "The bundled FFmpeg is the LGPL build, so H.264 comes from OpenH264 rather than x264. AV1 compresses far better but older players will not open it.",
      },
      {
        key: "quality",
        label: "Quality",
        type: "select",
        defaultValue: "balanced",
        choices: [
          { value: "high", label: "High" },
          { value: "balanced", label: "Balanced" },
          { value: "small", label: "Smallest file" },
        ],
      },
    ];

    switch (operationId) {
      case "trim":
        return [
          { key: "start", label: "Start (seconds)", type: "number", defaultValue: "0", min: 0 },
          { key: "end", label: "End (seconds)", type: "number", defaultValue: "10", min: 0 },
        ];
      case "convert":
      case "compress":
      case "fps":
        return operationId === "fps"
          ? [{ key: "rate", label: "Frames per second", type: "number", defaultValue: "30", min: 1, max: 240 }, ...encoding]
          : encoding;
      case "resize":
        return [
          { key: "width", label: "Width (pixels)", type: "number", defaultValue: "1280", min: 1, step: 10 },
          ...encoding,
        ];
      case "crop":
        return [
          { key: "width", label: "Width", type: "number", defaultValue: "640" },
          { key: "height", label: "Height", type: "number", defaultValue: "480" },
          { key: "left", label: "Left", type: "number", defaultValue: "0" },
          { key: "top", label: "Top", type: "number", defaultValue: "0" },
          ...encoding,
        ];
      case "rotate":
        return [
          {
            key: "degrees",
            label: "Turn",
            type: "select",
            defaultValue: "90",
            choices: [
              { value: "90", label: "90° clockwise" },
              { value: "180", label: "180°" },
              { value: "270", label: "90° anticlockwise" },
            ],
          },
          ...encoding,
        ];
      case "change-speed":
        return [
          {
            key: "factor",
            label: "Speed",
            type: "number",
            defaultValue: "2",
            min: 0.25,
            max: 8,
            step: 0.25,
            hint: "2 plays twice as fast, 0.5 half as fast. Audio follows the picture.",
          },
          ...encoding,
        ];
      case "extract-audio":
        return [
          {
            key: "format",
            label: "Format",
            type: "select",
            defaultValue: "mp3",
            choices: [
              { value: "mp3", label: "MP3" },
              { value: "container", label: "Keep the original codec" },
            ],
          },
        ];
      case "to-gif":
        return [
          { key: "width", label: "Width (pixels)", type: "number", defaultValue: "480" },
          { key: "rate", label: "Frames per second", type: "number", defaultValue: "12" },
        ];
      case "thumbnail":
        return [{ key: "at", label: "At (seconds)", type: "number", defaultValue: "1", min: 0 }];
      case "contact-sheet":
        return [
          { key: "columns", label: "Columns", type: "number", defaultValue: "3", min: 1, max: 12 },
          { key: "rows", label: "Rows", type: "number", defaultValue: "3", min: 1, max: 12 },
          { key: "every", label: "Every N frames", type: "number", defaultValue: "48" },
          { key: "width", label: "Tile width", type: "number", defaultValue: "240" },
        ];
      default:
        return [];
    }
  }
  if (toolId === "qpdf" && operationId === "split")
    return [{ key: "pages", label: "Pages", type: "text", defaultValue: "1-z" }];
  if (toolId === "qpdf" && operationId === "rotate")
    return [{ key: "degrees", label: "Degrees", type: "number", defaultValue: "90" }];
  if (toolId === "qpdf" && operationId === "protect")
    return [{ key: "password", label: "PDF password", type: "password", placeholder: "Type a password" }];
  if ((toolId === "jq" || toolId === "yq") && operationId === "query")
    return [{ key: "query", label: "Expression", type: "text", defaultValue: "." }];
  if (toolId === "ripgrep" && operationId === "search")
    return [{ key: "query", label: "Text or regex", type: "text", placeholder: "e.g. TODO" }];
  if (toolId === "fd" && operationId === "find")
    return [{ key: "query", label: "Name or extension", type: "text", placeholder: "e.g. .ts" }];
  if (toolId === "libvips" && (operationId === "resize" || operationId === "upscale"))
    return [{ key: "scale", label: "Scale", type: "number", defaultValue: operationId === "upscale" ? "2" : "1" }];
  if (toolId === "libvips" && operationId === "crop")
    return [
      { key: "left", label: "Left", type: "number", defaultValue: "0" },
      { key: "top", label: "Top", type: "number", defaultValue: "0" },
      { key: "width", label: "Width", type: "number", defaultValue: "100" },
      { key: "height", label: "Height", type: "number", defaultValue: "100" },
    ];
  if (toolId === "libvips" && operationId === "compress")
    return [{ key: "quality", label: "Quality", type: "number", defaultValue: "80", min: 1, max: 100, step: 5 }];
  if (toolId === "poppler" && operationId === "rasterize")
    return [
      { key: "page", label: "Page", type: "number", defaultValue: "1", min: 1 },
      { key: "dpi", label: "Resolution (DPI)", type: "number", defaultValue: "150", min: 1, max: 2400, step: 50 },
    ];
  if (toolId === "oxipng" && operationId === "optimize")
    return [
      {
        key: "level",
        label: "Effort",
        type: "select",
        defaultValue: "2",
        choices: [
          { value: "0", label: "0 — fastest" },
          { value: "1", label: "1" },
          { value: "2", label: "2 — default" },
          { value: "3", label: "3" },
          { value: "4", label: "4" },
          { value: "5", label: "5" },
          { value: "6", label: "6 — slowest" },
          { value: "max", label: "Max — try everything" },
        ],
        hint: "Higher settings search harder for a smaller file. The picture is identical either way; only the time changes.",
      },
    ];
  if (toolId === "exiftool" && operationId === "set-title")
    return [{ key: "title", label: "Title", type: "text", placeholder: "e.g. Signed contract" }];
  if (toolId === "hexyl" && operationId === "preview")
    return [{ key: "length", label: "Bytes", type: "number", defaultValue: "256", min: 16, step: 16 }];
  if (toolId === "dust" && operationId === "usage")
    return [
      { key: "depth", label: "Depth", type: "number", defaultValue: "2", min: 1 },
      { key: "lines", label: "Rows", type: "number", defaultValue: "20", min: 1 },
    ];
  return [];
}

function fileNameOnly(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

const readOnlyTools = [
  "ffprobe", "jq", "yq", "ripgrep", "fd",
  "miller", "hexyl", "tokei", "difftastic", "dust",
];
/** Where each downloader publishes the list of sites it handles. Naming the
 *  page beats embedding a list of eighteen hundred entries that goes stale. */
function supportedSitesHint(toolId: string, t: Translate): string {
  return toolId === "gallery-dl"
    ? t("Hundreds of gallery and art sites. The full list is supportedsites.md in the gallery-dl repository.")
    : t("Over a thousand video and audio sites. The full list is supportedsites.md in the yt-dlp repository.");
}

/** Tools driven by a URL rather than input files; mirrors URL_TOOLS in the host. */
const urlTools = ["yt-dlp", "gallery-dl"];
/** Operations whose destination is a folder, because they write more than one file. */
function writesToDirectory(toolId: string, operationId: string): boolean {
  return (
    (toolId === "7zip" && operationId === "extract") ||
    (toolId === "gallery-dl" && operationId === "download-gallery")
  );
}
/** Tools whose input is a folder, not a file. */
const folderTools = ["fd", "ripgrep", "tokei", "dust"];
/** Operations that need more than one input. */
const multiInputOperations = ["merge", "compare"];
const readOnlyOperations = ["inspect", "inspect-url"];

function requiresOutput(toolId: string, operationId: string): boolean {
  return !readOnlyTools.includes(toolId) && !readOnlyOperations.includes(operationId);
}

/** The destination extension decides the format, so each operation names its own. */
function outputExtension(toolId: string, operationId: string, originalExtension: string): string {
  const byOperation: Record<string, string> = {
    "7zip/compress": ".zip",
    "pandoc/convert": ".html",
    "ffmpeg/extract-audio": ".mp3",
    "ffmpeg/convert": ".mp4",
    "ffmpeg/compress": ".mp4",
    "ffmpeg/trim": ".mp4",
    "ffmpeg/resize": ".mp4",
    "ffmpeg/crop": ".mp4",
    "ffmpeg/rotate": ".mp4",
    "ffmpeg/change-speed": ".mp4",
    "ffmpeg/fps": ".mp4",
    "ffmpeg/remove-audio": ".mp4",
    "ffmpeg/normalize-audio": ".mp4",
    "ffmpeg/to-gif": ".gif",
    "ffmpeg/thumbnail": ".png",
    "ffmpeg/contact-sheet": ".png",
    "libvips/compress": ".jpg",
    "poppler/extract-text": ".txt",
    "poppler/rasterize": ".png",
    "oxipng/optimize": ".png",
    "mkvtoolnix/remux": ".mkv",
    "imagemagick/convert": ".png",
    "libvips/upscale-model": ".png",
  };
  return byOperation[`${toolId}/${operationId}`] ?? (toolId === "qpdf" ? ".pdf" : originalExtension);
}

export function suggestedOutputName(
  inputPath: string | undefined,
  operationId: string,
  toolId: string,
  options: Record<string, string> = {},
): string {
  // An explicit choice outranks the per-operation default.
  const chosen = options.format;
  if (toolId === "yt-dlp") {
    if (operationId === "download-audio") return "audio.mp3";
    return options.quality === "best" ? "video.mkv" : "video.mp4";
  }
  const path = inputPath ?? "resultado";
  const filename = fileNameOnly(path);
  const stem = filename.replace(/\.[^.]+$/, "");
  const folder = path.slice(0, path.length - filename.length);
  const originalExtension = filename.includes(".") ? filename.slice(filename.lastIndexOf(".")) : ".out";
  const extension = chosen ? `.${chosen}` : outputExtension(toolId, operationId, originalExtension);
  return `${folder}${stem}-${operationId}${extension}`;
}
