import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ExternalLink, Mic, Speaker } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { CatalogTool } from "../catalog/catalog";
import { isNativeHost } from "../hooks/useOperationRunner";
import { PanelShell } from "./PanelShell";
import { useT } from "../i18n/language";
import { Select } from "./Select";

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
  leaving = false,
  onClose,
  onExited,
  onDirtyChange,
}: {
  tool: CatalogTool;
  leaving?: boolean;
  onClose: () => void;
  onExited?: () => void;
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
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => closeButtonRef.current?.focus(), []);

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
    <PanelShell
      ref={closeButtonRef}
      title={tool.integrationName}
      leaving={leaving}
      onClose={onClose}
      onExited={onExited}
    >
      <section className="tool-panel__controls">
        <h2 id="tool-panel-title">{t(tool.title)}</h2>
        <p>{t(tool.description)}</p>

        <p className="notice notice--outbound">
          <ExternalLink size={14} aria-hidden="true" />
          <span>
            {t(
              "The clip is fingerprinted on this machine and deleted straight after. Only the fingerprint is sent — never the recording itself.",
            )}
          </span>
        </p>

        <label className="operation-select">
          <span>{t("Listen to")}</span>
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
          <small>
            {kind === "playback"
              ? t("Records the machine's own sound, without a cable or a virtual device.")
              : chosen
                ? t("Records the room through {name}.", { name: chosen.label })
                : t("Records the room.")}
          </small>
        </label>

        {kind === "playback" && playback.length > 1 && (
          <label className="operation-select">
            <span>{t("Sound source")}</span>
            <Select
              label={t("Sound source")}
              value={deviceId}
              choices={playback.map((source) => ({ value: source.id, label: source.label }))}
              onChange={setDeviceId}
            />
          </label>
        )}

        {kind === "microphone" && microphones.length > 1 && (
          <label className="operation-select">
            <span>{t("Sound source")}</span>
            <Select
              label={t("Sound source")}
              value={deviceId}
              choices={microphones.map((source) => ({ value: source.id, label: source.label }))}
              onChange={setDeviceId}
            />
          </label>
        )}

        <div className="listen">
          <button
            className={`listen__button${busy ? " listen__button--busy" : ""}`}
            type="button"
            // Not `disabled` while listening: that greys it out, and a button
            // that is working is not a button that is unavailable. The click is
            // ignored in the handler instead.
            disabled={!deviceId}
            aria-busy={busy}
            onClick={listenNow}
            aria-label={t(busy ? "Listening" : "Listen and identify")}
          >
            <span className="listen__ring" style={{ "--through": through } as React.CSSProperties} />
            {kind === "playback" ? <Speaker size={30} aria-hidden="true" /> : <Mic size={30} aria-hidden="true" />}
          </button>
          <Meter levels={levels} active={busy} />
          <p className="listen__caption" role="status" data-tried={tried}>
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
        </div>

        {error && (
          <p className="panel-result panel-result--error" role="status">
            <AlertTriangle size={15} aria-hidden="true" />
            <span>{error}</span>
          </p>
        )}

        <div ref={resultRef}>{result && <RecognitionCard result={result} />}</div>
      </section>
    </PanelShell>
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
    <div className={`meter${active ? " meter--active" : ""}`} aria-hidden="true">
      {levels.map((level, index) => (
        <span
          key={index}
          className="meter__bar"
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
    return (
      <p className="panel-result" role="status">
        <Speaker size={15} aria-hidden="true" />
        <span>{result.message}</span>
      </p>
    );
  }
  const rows = [
    [t("Album"), result.album],
    [t("Released"), result.released],
    [t("Genre"), result.genre],
    [t("Label"), result.label],
  ].filter(([, value]) => value);

  return (
    <article className="recognition" aria-label={t("What was recognised")}>
      {result.coverUrl && (
        <img className="recognition__cover" src={result.coverUrl} alt={t("Cover art for {name}", { name: result.title })} />
      )}
      <div className="recognition__detail">
        <h3>{result.title || t("Untitled")}</h3>
        {result.artist && <p className="recognition__artist">{result.artist}</p>}
        {rows.length > 0 && (
          <dl className="recognition__rows">
            {rows.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        )}
        {result.links.length > 0 && (
          // Links would open inside this window, which has no way back, so the
          // host opens the browser after checking each address. The services
          // rather than the recogniser's own page: that page answers 405.
          <div className="recognition__links">
            {result.links.map((link) => (
              <button
                key={link.url}
                className="recognition__link"
                type="button"
                onClick={() => void invoke("open_link", { url: link.url })}
              >
                <ExternalLink size={13} aria-hidden="true" />
                {link.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
