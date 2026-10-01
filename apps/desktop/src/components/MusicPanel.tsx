import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ExternalLink, Mic, Speaker } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { CatalogTool } from "../catalog/catalog";
import { isNativeHost } from "../hooks/useOperationRunner";
import { OutboundNotice, PageCard, PageResult, ToolPage } from "./ToolPage";
import { useT } from "../i18n/language";
import { Select } from "./Select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type AudioSource = { id: string; label: string; kind: "microphone" | "playback"; isDefault: boolean };

type TrackLink = { label: string; url: string };

type Recognition = {
  matched: boolean;
  title: string;
  artist: string;
  album: string;
  released: string;
  label: string;
  genre: string;
  links: TrackLink[];
  coverUrl: string;
  message: string;
};

/** How many bars the meter holds, which is also how far back it remembers. */
const BAR_COUNT = 40;

/**
 * Names the music that is playing.
 *
 * One button. Pressing it listens and answers — there is nothing to configure
 * about a clip beforehand, because nobody knows what to pick and the only thing
 * that matters is whether it matched.
 *
 * The meter shows the sound as it arrives, from levels the host reports while
 * it is still recording. That is the difference between a window that is
 * listening and a window that merely says so.
 */
export function MusicPanel({
  tool,
  onDirtyChange,
}: {
  tool: CatalogTool;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const t = useT();
  const [sources, setSources] = useState<AudioSource[]>([]);
  const [kind, setKind] = useState<"playback" | "microphone">("playback");
  const [deviceId, setDeviceId] = useState("");
  const [busy, setBusy] = useState(false);
  const [levels, setLevels] = useState<number[]>(() => Array(BAR_COUNT).fill(0));
  const [through, setThrough] = useState(0);
  /** Lookups already tried and not matched, so the caption can say so. */
  const [tried, setTried] = useState(0);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Recognition | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isNativeHost()) return;
    void invoke<AudioSource[]>("list_audio_sources")
      .then(setSources)
      .catch((reason: unknown) => setError(String(reason)));
  }, []);

  // The device follows the kind: the default of whichever was chosen, unless
  // the one already picked is of that kind.
  useEffect(() => {
    const ofKind = sources.filter((source) => source.kind === kind);
    if (ofKind.some((source) => source.id === deviceId)) return;
    setDeviceId((ofKind.find((source) => source.isDefault) ?? ofKind[0])?.id ?? "");
  }, [sources, kind, deviceId]);

  useEffect(() => {
    onDirtyChange?.(Boolean(result) || busy);
  }, [result, busy, onDirtyChange]);

  useEffect(() => {
    if (result || error) {
      // Optional call: jsdom has the element but not the method.
      resultRef.current?.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
    }
  }, [result, error]);

  // The host reports what it is hearing while it records, so the meter is the
  // sound rather than a decoration on a timer.
  useEffect(() => {
    if (!isNativeHost()) return;
    let active = true;
    let stop: (() => void) | undefined;

    void listen<{ level: number; through: number }>("listening-level", (event) => {
      if (!active) return;
      setLevels((current) => [...current.slice(1), event.payload.level]);
      setThrough(event.payload.through);
    })
      .then((cleanup) => {
        if (active) stop = cleanup;
        else cleanup();
      })
      .catch(() => {
        // The browser preview has no event bridge; the meter simply stays flat.
      });

    return () => {
      active = false;
      stop?.();
    };
  }, []);

  // It does not wait for the whole clip before looking: it asks as soon as it
  // has enough, and keeps asking. Saying so is the difference between a window
  // that is working and one that has stalled.
  useEffect(() => {
    if (!isNativeHost()) return;
    let active = true;
    let stop: (() => void) | undefined;

    void listen<{ seconds: number; matched: boolean }>("listening-attempt", (event) => {
      if (active && !event.payload.matched) setTried((count) => count + 1);
    })
      .then((cleanup) => {
        if (active) stop = cleanup;
        else cleanup();
      })
      .catch(() => undefined);

    return () => {
      active = false;
      stop?.();
    };
  }, []);

  const playback = sources.filter((source) => source.kind === "playback");
  const microphones = sources.filter((source) => source.kind === "microphone");
  const chosen = sources.find((source) => source.id === deviceId);

  function listenNow() {
    if (busy || !deviceId) return;
    if (!isNativeHost()) {
      setError(t("Open the tools4devs app to listen. This page is the interface preview only."));
      return;
    }
    setBusy(true);
    setError("");
    setResult(null);
    setThrough(0);
    setTried(0);
    setLevels(Array(BAR_COUNT).fill(0));
    void invoke<Recognition>("recognize_music", { request: { deviceId } })
      .then(setResult)
      .catch((reason: unknown) => setError(String(reason)))
      .finally(() => {
        setBusy(false);
        setThrough(0);
        setLevels(Array(BAR_COUNT).fill(0));
      });
  }

  return (
    <ToolPage tool={tool}>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid min-w-0 gap-4">
          <PageCard className="justify-items-center gap-4 py-10">
            <button
              type="button"
              className={cn(
                "group relative grid size-[86px] cursor-pointer place-items-center rounded-full bg-primary text-primary-foreground shadow-md outline-none transition-[transform,background-color] duration-200 ease-out",
                "hover:not-disabled:not-aria-busy:scale-104 hover:not-disabled:not-aria-busy:bg-primary/90 active:not-disabled:scale-97",
                "focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-default disabled:opacity-45 aria-busy:cursor-default",
                busy && "animate-listen-pulse motion-reduce:animate-none",
              )}
              // Not `disabled` while listening: that greys it out, and a button
              // that is working is not a button that is unavailable. The click is
              // ignored in the handler instead.
              disabled={!deviceId}
              aria-busy={busy}
              onClick={listenNow}
              aria-label={t(busy ? "Listening" : "Listen and identify")}
            >
              {/* A conic sweep masked to a band, so it reads as progress rather
                  than as a pie chart: from the top, clockwise. */}
              <span
                className="absolute -inset-2.5 rounded-full bg-[conic-gradient(from_-90deg,var(--primary)_calc(var(--through,0)*360deg),var(--muted)_0)] opacity-0 transition-opacity duration-300 [mask:radial-gradient(farthest-side,transparent_calc(100%-5px),currentColor_calc(100%-4px))] group-aria-busy:opacity-100 motion-reduce:transition-none"
                style={{ "--through": through } as React.CSSProperties}
              />
              {kind === "playback" ? (
                <Speaker className="relative size-[30px]" aria-hidden="true" />
              ) : (
                <Mic className="relative size-[30px]" aria-hidden="true" />
              )}
            </button>
            <Meter levels={levels} active={busy} />
            <p className="text-sm text-muted-foreground" role="status" data-tried={tried}>
              {t(
                busy
                  ? tried > 0
                    ? "Still listening…"
                    : "Listening…"
                  : deviceId
                    ? "Tap to identify what is playing."
                    : "No sound device found.",
              )}
            </p>
          </PageCard>

          {error && (
            <PageResult error icon={<AlertTriangle aria-hidden="true" />}>
              {error}
            </PageResult>
          )}

          <div ref={resultRef}>{result && <RecognitionCard result={result} />}</div>
        </div>

        <PageCard title={t("Options")} className="gap-4 lg:sticky lg:top-4">
          <OutboundNotice icon={<ExternalLink aria-hidden="true" />}>
            {t(
              "The clip is fingerprinted on this machine and deleted straight after. Only the fingerprint is sent — never the recording itself.",
            )}
          </OutboundNotice>

          <label className="grid gap-2">
            <span className="text-sm font-medium">{t("Listen to")}</span>
            <Select
              label={t("Listen to")}
              value={kind}
              choices={[
                { value: "playback", label: t("What this PC is playing") },
                { value: "microphone", label: t("The microphone") },
              ]}
              onChange={(next) => {
                setKind(next as "playback" | "microphone");
                setError("");
                setResult(null);
              }}
            />
            <small className="text-xs text-muted-foreground">
              {kind === "playback"
                ? t("Records the machine's own sound, without a cable or a virtual device.")
                : chosen
                  ? t("Records the room through {name}.", { name: chosen.label })
                  : t("Records the room.")}
            </small>
          </label>

          {(kind === "playback" ? playback : microphones).length > 1 && (
            <label className="grid gap-2">
              <span className="text-sm font-medium">{t("Sound source")}</span>
              <Select
                label={t("Sound source")}
                value={deviceId}
                choices={(kind === "playback" ? playback : microphones).map((source) => ({
                  value: source.id,
                  label: source.label,
                }))}
                onChange={setDeviceId}
              />
            </label>
          )}
        </PageCard>
      </div>
    </ToolPage>
  );
}

/**
 * The sound arriving, as bars that scroll.
 *
 * Purely presentational, and deliberately not a canvas: forty elements whose
 * height is a number the host sent is cheaper to reason about than a redraw
 * loop, and it animates itself between values.
 */
function Meter({ levels, active }: { levels: number[]; active: boolean }) {
  return (
    // A baseline behind the bars: silence is a line and sound grows out of it,
    // in both directions, which is what a waveform is.
    <div
      className="relative flex h-[60px] w-full items-center justify-center gap-[3px] before:absolute before:top-1/2 before:left-1/2 before:h-px before:w-[296px] before:-translate-1/2 before:bg-border"
      aria-hidden="true"
    >
      {levels.map((level, index) => (
        <span
          key={index}
          data-meter-bar
          className={cn(
            "relative w-[3px] rounded-full transition-[height,background-color] duration-100 ease-out motion-reduce:transition-none",
            // Quiet while nothing is being recorded: the baseline alone carries it.
            active ? "h-[max(3px,calc(var(--level,0)*60px))] bg-primary" : "h-px bg-border opacity-0",
          )}
          // A square root opens up the quiet end, where speech and most music
          // actually sit; a linear bar spends its height on peaks nobody hits.
          style={{ "--level": Math.min(1, Math.sqrt(level)) } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

function RecognitionCard({ result }: { result: Recognition }) {
  const t = useT();
  if (!result.matched) {
    return <PageResult icon={<Speaker aria-hidden="true" />}>{result.message}</PageResult>;
  }
  const rows = [
    [t("Album"), result.album],
    [t("Released"), result.released],
    [t("Genre"), result.genre],
    [t("Label"), result.label],
  ].filter(([, value]) => value);

  // Cover art earns its place: it is how anyone confirms at a glance that the
  // answer is the right one, faster than reading the title.
  return (
    <article
      className="flex flex-col items-start gap-4 rounded-xl border bg-card p-5 text-card-foreground shadow-xs animate-in fade-in slide-in-from-bottom-2 duration-500 motion-reduce:animate-none sm:flex-row"
      aria-label={t("What was recognised")}
    >
      {result.coverUrl && (
        <img
          className="size-[92px] shrink-0 rounded-lg border object-cover"
          src={result.coverUrl}
          alt={t("Cover art for {name}", { name: result.title })}
        />
      )}
      <div className="grid min-w-0 gap-2">
        <h3 className="font-heading text-lg font-semibold break-words">{result.title || t("Untitled")}</h3>
        {result.artist && <p className="text-sm text-muted-foreground">{result.artist}</p>}
        {rows.length > 0 && (
          <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
            {rows.map(([label, value]) => (
              <div key={label} className="grid min-w-0 gap-px">
                <dt className="text-[0.65rem] tracking-wider text-muted-foreground uppercase">{label}</dt>
                <dd className="text-sm break-words">{value}</dd>
              </div>
            ))}
          </dl>
        )}
        {result.links.length > 0 && (
          // Links would open inside this window, which has no way back, so the
          // host opens the browser after checking each address. The services
          // rather than the recogniser's own page: that page answers 405.
          <div className="mt-1 flex flex-wrap gap-2">
            {result.links.map((link) => (
              <Button
                key={link.url}
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => void invoke("open_link", { url: link.url })}
              >
                <ExternalLink aria-hidden="true" />
                {link.label}
              </Button>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
