import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Check, Copy, Download, Eraser, ExternalLink, RefreshCw } from "lucide-react";
import type { CatalogTool } from "../catalog/catalog";
import { utilityById, utilityGroup, type Utility } from "../utilities/registry";
import { PanelShell } from "./PanelShell";
import { Select } from "./Select";
import { NumberField } from "./NumberField";
import { useT } from "../i18n/language";

/**
 * The panel for tools the app performs itself.
 *
 * There is no file, no destination and no queue here: the work is a pure
 * function of what you typed, so the result appears as you type rather than
 * behind a Run button. A button implies a wait, and there is none.
 */
export function UtilityPanel({
  tool,
  subId,
  onSubChange,
  onDirtyChange,
}: {
  tool: CatalogTool;
  /** The utility shown, as the sidebar and the palette name it; the first when absent. */
  subId?: string;
  /** Asked to show another utility, so the sidebar and the breadcrumb follow. */
  onSubChange?: (subId: string) => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const t = useT();
  const group = utilityGroup(tool.id);
  const pickUtility = (id?: string) =>
    group?.utilities.find((utility) => utility.id === id)?.id ?? group?.utilities[0]?.id ?? "";
  const [utilityId, setUtilityId] = useState(() => pickUtility(subId));
  const [input, setInput] = useState("");
  const [options, setOptions] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);
  const [touched, setTouched] = useState(false);

  // What was typed stays; the options belong to the utility that is left.
  function showUtility(id: string) {
    setUtilityId(id);
    setOptions({});
    setTouched(false);
  }

  // The sidebar or the palette chose another utility of this group.
  useEffect(() => {
    const next = pickUtility(subId);
    if (next !== utilityId) showUtility(next);
    // Only a change from outside matters; utilityId follows it, not the other way round.
  }, [subId]);

  const [seed, setSeed] = useState(0);
  const isRandomized = group?.id === "random-picks";
  const [previewSurface, setPreviewSurface] = useState<"box" | "text" | "button" | "card">("box");

  const utility = useMemo(
    () => (group ? utilityById(group.id, utilityId) : undefined),
    [group, utilityId],
  );

  const values = useMemo(() => withDefaults(utility, options), [utility, options]);
  const preview = useMemo(() => utility?.preview?.(values), [utility, values]);

  // A "mode" field offering both "generate" and "validate" means the input
  // box only matters for the second: generating one ignores whatever is
  // typed, so showing an unused box beside it would just invite confusion.
  const modeField = utility?.fields?.find((field) => field.key === "mode");
  const hasGenerateMode = Boolean(
    modeField?.choices?.some((choice) => choice.value === "generate") &&
      modeField?.choices?.some((choice) => choice.value === "validate"),
  );
  const isGenerating = hasGenerateMode && (values.mode ?? modeField?.defaultValue) !== "validate";
  const showRegenerate = isRandomized || isGenerating;

  // Most utilities answer synchronously, but the hashes reach for the
  // platform's crypto API, which does not. Everything is awaited the same
  // way, and a `current` flag drops a stale answer that resolves after the
  // input has already moved on rather than letting it flash on screen.
  const [state, setState] = useState<{ output: string; facts?: Array<[string, string]>; failure: string }>({
    output: "",
    failure: "",
  });

  useEffect(() => {
    if (!utility) {
      setState({ output: "", failure: "" });
      return;
    }
    let current = true;
    void (async () => {
      try {
        const [output, facts] = await Promise.all([
          utility.run(input, values, t),
          utility.facts ? utility.facts(input, values, t) : Promise.resolve(undefined),
        ]);
        if (current) setState({ output, facts, failure: "" });
      } catch (error) {
        // A pattern somebody is halfway through typing is not a crash; it is
        // an invalid regular expression, and saying so is the right answer.
        if (current) setState({ output: "", facts: undefined, failure: describe(error) });
      }
    })();
    return () => {
      current = false;
    };
    // `t` is included so switching the language while a fact value like
    // "Ethanol" or "3 weeks, 2 days" is on screen recomputes it immediately,
    // instead of leaving the old language showing until the input changes.
  }, [utility, input, values, t, seed]);

  const { output, facts } = state;
  const failure = touched ? state.failure : "";

  useEffect(() => {
    onDirtyChange?.(input.trim().length > 0);
  }, [input, onDirtyChange]);

  useEffect(() => {
    setCopied(false);
  }, [output]);

  if (!group || !utility) return null;

  const result = facts ? facts.map(([name, value]) => `${name}: ${value}`).join("\n") : output;

  return (
    <PanelShell
      title={tool.integrationName}
      wide={group.id === "dates-time"}
    >
      <section className="tool-panel__controls">
        <h2 id="tool-panel-title">{t(tool.title)}</h2>
        <p>{t(tool.description)}</p>

        <div className="tool-panel__menu" role="tablist" aria-label={t("Tool")}>
          {group.utilities.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={entry.id === utilityId}
              className={`tool-panel__menu-item${entry.id === utilityId ? " is-active" : ""}`}
              onClick={() => {
                showUtility(entry.id);
                onSubChange?.(entry.id);
              }}
            >
              {t(entry.label)}
            </button>
          ))}
        </div>
        <p className="tool-panel__menu-description">{t(utility.description)}</p>

        {utility.outbound && (
          <p className="notice notice--outbound">
            <ExternalLink size={14} aria-hidden="true" />
            <span>{t(utility.outbound)}</span>
          </p>
        )}

        {utility.input === "text" && !isGenerating && (
          <label className="utility-field">
            <span className="utility-field__label-row">
              {t(utility.inputLabel ?? "Your text")}
              {utility.acceptFiles && (
                <span className="utility-file-upload">
                  <input
                    type="file"
                    accept={utility.acceptFiles.join(",")}
                    aria-label={t("Upload a file")}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      if (!file) return;
                      void file.text().then((text) => {
                        setInput(text);
                        setTouched(true);
                      });
                    }}
                  />
                  {t("Upload a file")}
                </span>
              )}
            </span>
            <textarea
              className="utility-input"
              value={input}
              spellCheck={false}
              placeholder={t("Type or paste here")}
              onChange={(event) => {
                setInput(event.target.value);
                setTouched(true);
              }}
            />
          </label>
        )}

        {utility.fields && utility.fields.length > 0 && (
          <div className="operation-options" aria-label={t("Options")}>
            {utility.fields
              .filter((field) => field.showWhen?.(values) ?? true)
              .map((field) => (
                <label key={field.key}>
                  <span>{t(field.label)}</span>
                  {field.type === "select" ? (
                    <Select
                      label={t(field.label)}
                      value={values[field.key] ?? ""}
                      choices={(field.choices ?? []).map((choice) => ({
                        value: choice.value,
                        label: t(choice.label),
                      }))}
                      onChange={(next) => {
                        setOptions((current) => ({ ...current, [field.key]: next }));
                        setTouched(true);
                      }}
                    />
                  ) : field.type === "color" ? (
                    <span className="utility-color-field">
                      <input
                        aria-label={t(field.label)}
                        type="color"
                        value={/^#[0-9a-fA-F]{6}$/.test(values[field.key] ?? "") ? values[field.key] : "#000000"}
                        onChange={(event) => {
                          setOptions((current) => ({ ...current, [field.key]: event.target.value }));
                          setTouched(true);
                        }}
                      />
                      <input
                        aria-label={t(field.label)}
                        type="text"
                        className="utility-color-field__hex"
                        value={values[field.key] ?? ""}
                        placeholder={field.placeholder && t(field.placeholder)}
                        onChange={(event) => {
                          setOptions((current) => ({ ...current, [field.key]: event.target.value }));
                          setTouched(true);
                        }}
                      />
                    </span>
                  ) : field.type === "number" ? (
                    <NumberField
                      label={t(field.label)}
                      value={values[field.key] ?? ""}
                      min={field.min}
                      max={field.max}
                      onChange={(next) => {
                        setOptions((current) => ({ ...current, [field.key]: next }));
                        setTouched(true);
                      }}
                    />
                  ) : (
                    <input
                      aria-label={t(field.label)}
                      type="text"
                      value={values[field.key] ?? ""}
                      placeholder={field.placeholder && t(field.placeholder)}
                      onChange={(event) => {
                        setOptions((current) => ({ ...current, [field.key]: event.target.value }));
                        setTouched(true);
                      }}
                    />
                  )}
                  {field.hint && <small className="operation-options__hint">{t(field.hint)}</small>}
                </label>
              ))}
          </div>
        )}

        {preview && !failure && (
          <div className="utility-preview-section">
            {preview.kind === "box" && (
              <label className="utility-preview-surface">
                <span>{t("Preview on")}</span>
                <Select
                  label={t("Preview on")}
                  value={previewSurface}
                  choices={[
                    { value: "box", label: t("Box") },
                    { value: "text", label: t("Text") },
                    { value: "button", label: t("Button") },
                    { value: "card", label: t("Card") },
                  ]}
                  onChange={(next) => setPreviewSurface(next as typeof previewSurface)}
                />
              </label>
            )}
            <div className="utility-preview-frame" aria-hidden="true">
              {preview.kind !== "box" || previewSurface === "box" ? (
                <span className={`utility-preview utility-preview--${preview.kind}`} style={preview.style as CSSProperties}>
                  {preview.label}
                </span>
              ) : previewSurface === "text" ? (
                <p className="utility-preview utility-preview--surface-text" style={preview.style as CSSProperties}>
                  {t("The quick brown fox jumps over the lazy dog.")}
                </p>
              ) : previewSurface === "button" ? (
                <button type="button" className="utility-preview utility-preview--surface-button" style={preview.style as CSSProperties}>
                  {t("Sample button")}
                </button>
              ) : (
                <div className="utility-preview utility-preview--surface-card" style={preview.style as CSSProperties}>
                  <strong>{t("Card title")}</strong>
                  <p>{t("Supporting text for the card.")}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {failure ? (
          <p className="run-message run-message--error" role="alert">
            {failure}
          </p>
        ) : facts ? (
          <dl className="utility-facts">
            {facts.map(([name, value]) => (
              <div key={name}>
                <dt>{t(name)}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        ) : utility.outputKind === "image" && output ? (
          <div className="utility-image-frame">
            <img src={output} alt={t(utility.label)} />
          </div>
        ) : (
          <label className="utility-field">
            <span>{t("Result")}</span>
            <textarea className="utility-input utility-input--result" value={output} readOnly spellCheck={false} />
          </label>
        )}
      </section>

      <div className="tool-panel__footer">
        <div className="tool-panel__status" aria-live="polite">
          <p>{failure ? t("Nothing to copy while that is being fixed.") : t("It runs here, as you type.")}</p>
        </div>
        {utility.input === "text" && !isGenerating && (
          <button className="button button--light" type="button" onClick={() => setInput("")} disabled={!input}>
            <Eraser size={16} aria-hidden="true" /> {t("Clear")}
          </button>
        )}
        {showRegenerate && (
          <button className="button button--light" type="button" onClick={() => setSeed((value) => value + 1)}>
            <RefreshCw size={16} aria-hidden="true" /> {t(isGenerating ? "Generate" : "Regenerate")}
          </button>
        )}
        {utility.outputKind === "image" ? (
          <button
            className="button button--primary"
            type="button"
            disabled={!output}
            onClick={() => downloadImage(output, `${utility.id}.svg`)}
          >
            <Download size={16} aria-hidden="true" /> {t("Save image")}
          </button>
        ) : (
          <button
            className="button button--primary"
            type="button"
            disabled={!result}
            onClick={() => {
              void navigator.clipboard
                ?.writeText(result)
                .then(() => {
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 2000);
                })
                .catch(() => undefined);
            }}
          >
            {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
            {t(copied ? "Copied" : "Copy the result")}
          </button>
        )}
      </div>
    </PanelShell>
  );
}

/** The options a utility was given, over the defaults it declares. */
function withDefaults(utility: Utility | undefined, options: Record<string, string>) {
  const values: Record<string, string> = {};
  for (const field of utility?.fields ?? []) {
    if (field.defaultValue != null) values[field.key] = field.defaultValue;
  }
  return { ...values, ...options };
}

/** A `data:` URL has no filename of its own, so this hands the browser one. */
function downloadImage(dataUrl: string, filename: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  link.click();
}

function describe(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "That could not be worked out.";
}
