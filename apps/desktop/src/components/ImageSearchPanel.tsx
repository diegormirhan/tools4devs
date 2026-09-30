import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ExternalLink, FilePlus2, Search } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import type { CatalogTool } from "../catalog/catalog";
import { isNativeHost } from "../hooks/useOperationRunner";
import { acceptsFile } from "../catalog/formats";
import { FilePreview } from "./FilePreview";
import { PanelShell } from "./PanelShell";
import { useT } from "../i18n/language";
import { Select } from "./Select";

type Engine = { id: string; label: string; uploads: boolean };

/** Mirrors the host's list, so the browser preview shows the same choices. */
const fallbackEngines: Engine[] = [
  { id: "google", label: "Google Lens", uploads: true },
  { id: "yandex", label: "Yandex", uploads: false },
  { id: "bing", label: "Bing", uploads: false },
  { id: "tineye", label: "TinEye", uploads: false },
];

/**
 * Finds where a picture came from.
 *
 * The one panel in the app that sends something out, so it says so plainly and
 * before the fact rather than in a footnote. A picture on this machine can only
 * go to the engine that accepts an upload; the rest take a link, and those send
 * nothing at all.
 */
export function ImageSearchPanel({
  tool,
  initialPath,
  droppedPaths,
  onDirtyChange,
}: {
  tool: CatalogTool;
  initialPath?: string | null;
  droppedPaths?: string[];
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const t = useT();
  const [engines, setEngines] = useState<Engine[]>(fallbackEngines);
  const [engineId, setEngineId] = useState("google");
  const [path, setPath] = useState(initialPath ?? "");
  const [imageUrl, setImageUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [opened, setOpened] = useState("");
  const resultRef = useRef<HTMLParagraphElement>(null);

  const engine = engines.find((candidate) => candidate.id === engineId) ?? engines[0];
  const usingUrl = imageUrl.trim().length > 0;
  const canSearch = usingUrl || path.length > 0;

  useEffect(() => {
    if (!isNativeHost()) return;
    void invoke<Engine[]>("image_search_engines")
      .then(setEngines)
      .catch(() => setEngines(fallbackEngines));
  }, []);

  useEffect(() => {
    onDirtyChange?.(canSearch && !opened);
  }, [canSearch, opened, onDirtyChange]);

  useEffect(() => {
    // Optional call: jsdom has the element but not the method.
    if (error || opened) resultRef.current?.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
  }, [error, opened]);

  useEffect(() => {
    const dropped = droppedPaths?.[0];
    if (!dropped) return;
    admit(dropped);
    // A dropped file is meant for this panel; admit reports its own refusal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [droppedPaths]);

  function admit(candidate: string) {
    const verdict = acceptsFile("libvips", candidate);
    if (!verdict.ok) {
      setError(verdict.reason);
      return;
    }
    setError("");
    setOpened("");
    setPath(candidate);
    setImageUrl("");
  }

  function search() {
    if (!canSearch || busy) return;
    if (!isNativeHost()) {
      setError(t("Open the tools4devs app to search. This page is the interface preview only."));
      return;
    }
    setBusy(true);
    setError("");
    setOpened("");
    void invoke<string>("search_by_image", {
      request: {
        engine: engineId,
        path: usingUrl ? null : path,
        imageUrl: usingUrl ? imageUrl.trim() : null,
      },
    })
      .then(setOpened)
      .catch((reason: unknown) => setError(String(reason)))
      .finally(() => setBusy(false));
  }

  // Only one engine takes a file from this machine; picking another while a
  // local file is chosen would fail at the host, so the choice is narrowed here.
  const choices = engines
    .filter((candidate) => usingUrl || !path || candidate.uploads)
    .map((candidate) => ({ value: candidate.id, label: candidate.label }));

  useEffect(() => {
    if (!choices.some((choice) => choice.value === engineId)) setEngineId(choices[0]?.value ?? "google");
  }, [choices, engineId]);

  return (
    <PanelShell
      title={tool.integrationName}
      wide={Boolean(path) && !usingUrl}
      bodyClassName={path && !usingUrl ? "tool-panel__body--split" : ""}
    >
      {path && !usingUrl && (
        <section className="tool-panel__workspace" aria-label={t("Picture preview")}>
          <FilePreview path={path} />
        </section>
      )}

      <section className="tool-panel__controls">
        <h2 id="tool-panel-title">{tool.title}</h2>
        <p>{tool.description}</p>

        <p className="notice notice--outbound">
          <ExternalLink size={14} aria-hidden="true" />
          <span>
            This is the one tool here that leaves your machine. {engine?.uploads
              ? t("The picture is uploaded to the search engine, and the results open in your browser.")
              : t("Only the address you paste is sent; the picture is never uploaded by this app.")}
          </span>
        </p>

        <label className="operation-select">
          <span>{t("Search with")}</span>
          <Select label={t("Search with")} value={engineId} choices={choices} onChange={setEngineId} />
          <small>
            {path && !usingUrl
              ? t("A picture from this machine has to be uploaded, and Google Lens is the engine that accepts one.")
              : t("Paste a link and any of these will take it.")}
          </small>
        </label>

        <div className="tool-option">
          <span>
            <strong>{t("Picture on this machine")}</strong>
            <small>{path ? fileNameOnly(path) : t("No picture chosen.")}</small>
          </span>
          <button
            className="icon-button"
            type="button"
            aria-label={t("Choose a picture")}
            onClick={() =>
              void open({ multiple: false })
                .then((selected) => {
                  if (typeof selected === "string") admit(selected);
                })
                .catch((reason: unknown) => setError(String(reason)))
            }
          >
            <FilePlus2 size={18} />
          </button>
        </div>

        <label className="source-url">
          <span>{t("Or the address of a picture online")}</span>
          <input
            aria-label={t("Picture address")}
            type="url"
            placeholder="https://..."
            value={imageUrl}
            onChange={(event) => {
              setImageUrl(event.target.value);
              setError("");
              setOpened("");
            }}
          />
          <small className="source-url__hint">
            An address is searched without uploading anything, and every engine accepts one.
          </small>
        </label>

        {(error || opened) && (
          <p ref={resultRef} className={`panel-result${error ? " panel-result--error" : ""}`} role="status">
            {error ? <AlertTriangle size={15} aria-hidden="true" /> : <ExternalLink size={15} aria-hidden="true" />}
            <span>{error || t("Opened in your browser.")}</span>
          </p>
        )}

        <div className="panel-actions">
          <button className="button button--primary" type="button" disabled={!canSearch || busy} onClick={search}>
            <Search size={16} aria-hidden="true" />
            {t(busy ? "Searching…" : "Search")}
          </button>
        </div>
      </section>
    </PanelShell>
  );
}

function fileNameOnly(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}
