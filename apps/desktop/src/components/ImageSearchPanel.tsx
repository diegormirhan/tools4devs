import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ExternalLink, FilePlus2, Search } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import type { CatalogTool } from "../catalog/catalog";
import { isNativeHost } from "../hooks/useOperationRunner";
import { acceptsFile } from "../catalog/formats";
import { FilePreview } from "./FilePreview";
import { OutboundNotice, PageCard, PageResult, ToolPage } from "./ToolPage";
import { useT } from "../i18n/language";
import { Select } from "./Select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

  const showsPicture = Boolean(path) && !usingUrl;

  return (
    <ToolPage tool={tool}>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid min-w-0 gap-4">
          {showsPicture && (
            <section aria-label={t("Picture preview")}>
              <FilePreview path={path} />
            </section>
          )}

          <PageCard title={t("Picture")}>
            <div className="flex items-center justify-between gap-4">
              <span className="grid min-w-0 gap-0.5">
                <strong className="text-sm font-medium">{t("Picture on this machine")}</strong>
                <small className="truncate text-xs text-muted-foreground">
                  {path ? fileNameOnly(path) : t("No picture chosen.")}
                </small>
              </span>
              <Button
                variant="outline"
                size="icon"
                aria-label={t("Choose a picture")}
                onClick={() =>
                  void open({ multiple: false })
                    .then((selected) => {
                      if (typeof selected === "string") admit(selected);
                    })
                    .catch((reason: unknown) => setError(String(reason)))
                }
              >
                <FilePlus2 />
              </Button>
            </div>

            <label className="grid gap-2">
              <span className="text-sm font-medium">{t("Or the address of a picture online")}</span>
              <Input
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
              <small className="text-xs text-muted-foreground">
                {t("An address is searched without uploading anything, and every engine accepts one.")}
              </small>
            </label>
          </PageCard>

          {(error || opened) && (
            <PageResult
              ref={resultRef}
              error={Boolean(error)}
              icon={error ? <AlertTriangle aria-hidden="true" /> : <ExternalLink aria-hidden="true" />}
            >
              {error || t("Opened in your browser.")}
            </PageResult>
          )}
        </div>

        <PageCard aria-labelledby="tool-summary-title" className="gap-4 lg:sticky lg:top-4">
          <h2 id="tool-summary-title" className="font-heading text-lg font-semibold">{t("Search")}</h2>
          <OutboundNotice icon={<ExternalLink aria-hidden="true" />}>
            {t("This is the one tool here that leaves your machine.")}{" "}
            {engine?.uploads
              ? t("The picture is uploaded to the search engine, and the results open in your browser.")
              : t("Only the address you paste is sent; the picture is never uploaded by this app.")}
          </OutboundNotice>
          <label className="grid gap-2">
            <span className="text-sm font-medium">{t("Search with")}</span>
            <Select label={t("Search with")} value={engineId} choices={choices} onChange={setEngineId} />
            <small className="text-xs text-muted-foreground">
              {showsPicture
                ? t("A picture from this machine has to be uploaded, and Google Lens is the engine that accepts one.")
                : t("Paste a link and any of these will take it.")}
            </small>
          </label>
          <Button className="w-full" disabled={!canSearch || busy} onClick={search}>
            <Search aria-hidden="true" />
            {t(busy ? "Searching…" : "Search")}
          </Button>
        </PageCard>
      </div>
    </ToolPage>
  );
}

function fileNameOnly(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}
