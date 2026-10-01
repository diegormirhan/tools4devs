import { useEffect, useId, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Check, Copy, Download, Eraser, ExternalLink, RefreshCw, Upload } from "lucide-react";
import type { CatalogTool } from "../catalog/catalog";
import { utilityById, utilityGroup, type Utility } from "../utilities/registry";
import { OutboundNotice, PageCard, ToolPage } from "./ToolPage";
import { Select } from "./Select";
import { NumberField } from "./NumberField";
import { useT } from "../i18n/language";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";

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
  const inputLabelId = useId();
  const resultLabelId = useId();

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
  const takesText = utility.input === "text" && !isGenerating;
  const visibleFields = (utility.fields ?? []).filter((field) => field.showWhen?.(values) ?? true);
  const setOption = (key: string, value: string) => {
    setOptions((current) => ({ ...current, [key]: value }));
    setTouched(true);
  };

  return (
    <ToolPage tool={tool} title={t(utility.label)} description={t(utility.description)} showEngine={false}>
      {utility.outbound && (
        <OutboundNotice icon={<ExternalLink aria-hidden="true" />}>{t(utility.outbound)}</OutboundNotice>
      )}

      {visibleFields.length > 0 && (
        <PageCard title={t("Options")}>
          <div className="grid gap-5 sm:grid-cols-2" aria-label={t("Options")}>
            {visibleFields.map((field) => (
              <label key={field.key} className="grid content-start gap-2">
                <span className="text-sm font-medium">{t(field.label)}</span>
                {field.type === "select" ? (
                  <Select
                    label={t(field.label)}
                    value={values[field.key] ?? ""}
                    choices={(field.choices ?? []).map((choice) => ({
                      value: choice.value,
                      label: t(choice.label),
                    }))}
                    onChange={(next) => setOption(field.key, next)}
                  />
                ) : field.type === "color" ? (
                  <span className="flex gap-2">
                    <input
                      aria-label={t(field.label)}
                      type="color"
                      className="h-9 w-12 shrink-0 cursor-pointer rounded-md border bg-transparent p-1 shadow-xs"
                      value={/^#[0-9a-fA-F]{6}$/.test(values[field.key] ?? "") ? values[field.key] : "#000000"}
                      onChange={(event) => setOption(field.key, event.target.value)}
                    />
                    <Input
                      aria-label={t(field.label)}
                      className="font-mono"
                      value={values[field.key] ?? ""}
                      placeholder={field.placeholder && t(field.placeholder)}
                      onChange={(event) => setOption(field.key, event.target.value)}
                    />
                  </span>
                ) : field.type === "number" ? (
                  <NumberField
                    label={t(field.label)}
                    value={values[field.key] ?? ""}
                    min={field.min}
                    max={field.max}
                    onChange={(next) => setOption(field.key, next)}
                  />
                ) : (
                  <Input
                    aria-label={t(field.label)}
                    value={values[field.key] ?? ""}
                    placeholder={field.placeholder && t(field.placeholder)}
                    onChange={(event) => setOption(field.key, event.target.value)}
                  />
                )}
                {field.hint && <small className="text-xs text-muted-foreground">{t(field.hint)}</small>}
              </label>
            ))}
          </div>
        </PageCard>
      )}

      {preview && !failure && (
        <PageCard>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-heading text-lg font-semibold">{t("Preview")}</h2>
            {preview.kind === "box" && (
              <label className="flex items-center gap-2">
                <span className="text-sm whitespace-nowrap text-muted-foreground">{t("Preview on")}</span>
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
          </div>
          {/* The sample is drawn by utility-previews.css and the generator's own inline style. */}
          <div className="flex min-h-32 items-center justify-center rounded-lg border bg-muted/50 p-6" aria-hidden="true">
            {preview.kind !== "box" || previewSurface === "box" ? (
              <span className={`utility-preview utility-preview--${preview.kind}`} style={preview.style as CSSProperties}>
                {preview.label}
              </span>
            ) : previewSurface === "text" ? (
              <p className="utility-preview utility-preview--surface-text" style={preview.style as CSSProperties}>
                {t("The quick brown fox jumps over the lazy dog.")}
              </p>
            ) : previewSurface === "button" ? (
              <button type="button" tabIndex={-1} className="utility-preview utility-preview--surface-button" style={preview.style as CSSProperties}>
                {t("Sample button")}
              </button>
            ) : (
              <div className="utility-preview utility-preview--surface-card" style={preview.style as CSSProperties}>
                <strong>{t("Card title")}</strong>
                <p>{t("Supporting text for the card.")}</p>
              </div>
            )}
          </div>
        </PageCard>
      )}

      <div className={cn("grid items-stretch gap-4", takesText && "md:grid-cols-2")}>
        {takesText && (
          <IoCard
            labelId={inputLabelId}
            label={t(utility.inputLabel ?? "Your text")}
            action={
              utility.acceptFiles && (
                <Button asChild variant="ghost" size="sm" className="relative">
                  <label>
                    <input
                      type="file"
                      className="sr-only"
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
                    <Upload aria-hidden="true" />
                    {t("Upload a file")}
                  </label>
                </Button>
              )
            }
          >
            <textarea
              aria-labelledby={inputLabelId}
              className={ioText}
              value={input}
              spellCheck={false}
              placeholder={t("Type or paste here")}
              onChange={(event) => {
                setInput(event.target.value);
                setTouched(true);
              }}
            />
          </IoCard>
        )}

        <IoCard
          labelId={resultLabelId}
          label={t("Result")}
          action={
            utility.outputKind === "image" ? (
              <Button size="sm" disabled={!output} onClick={() => downloadImage(output, `${utility.id}.svg`)}>
                <Download aria-hidden="true" /> {t("Save image")}
              </Button>
            ) : (
              <Button
                size="sm"
                disabled={!result || Boolean(failure)}
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
                {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                {t(copied ? "Copied" : "Copy")}
              </Button>
            )
          }
        >
          {failure ? (
            <p className="m-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
              {failure}
            </p>
          ) : facts ? (
            <dl className="divide-y">
              {facts.map(([name, value]) => (
                <div key={name} className="flex items-baseline justify-between gap-4 px-6 py-2.5">
                  <dt className="text-sm text-muted-foreground">{t(name)}</dt>
                  <dd className="text-right font-mono text-sm break-all tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
          ) : utility.outputKind === "image" && output ? (
            // An SVG loaded as a picture, never inlined: no script in it ever runs.
            // White behind it in either theme, because a scanner needs the contrast.
            <div className="m-4 flex min-h-40 items-center justify-center rounded-lg border bg-white p-6">
              <img src={output} alt={t(utility.label)} />
            </div>
          ) : (
            <textarea
              aria-labelledby={resultLabelId}
              className={cn(ioText, "text-muted-foreground")}
              value={output}
              readOnly
              spellCheck={false}
            />
          )}
        </IoCard>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {failure ? t("Nothing to copy while that is being fixed.") : t("It runs here, as you type.")}
        </p>
        {takesText && (
          <Button variant="ghost" size="sm" onClick={() => setInput("")} disabled={!input}>
            <Eraser aria-hidden="true" /> {t("Clear")}
          </Button>
        )}
        {showRegenerate && (
          <Button variant="outline" size="sm" onClick={() => setSeed((value) => value + 1)}>
            <RefreshCw aria-hidden="true" /> {t(isGenerating ? "Generate" : "Regenerate")}
          </Button>
        )}
      </div>
    </ToolPage>
  );
}

/** The text boxes fill their card edge to edge, under its header. */
const ioText =
  "block min-h-36 w-full flex-1 resize-y bg-transparent px-6 py-4 font-mono text-sm leading-relaxed break-words outline-none placeholder:text-muted-foreground";

/** The input or the result: a header with its name and an action, the content below. */
function IoCard({
  labelId,
  label,
  action,
  children,
}: {
  labelId: string;
  label: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={labelId}
      className="flex min-w-0 flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-xs has-[textarea:focus-visible]:border-ring has-[textarea:focus-visible]:ring-[3px] has-[textarea:focus-visible]:ring-ring/50"
    >
      <header className="flex min-h-14 items-center justify-between gap-3 border-b px-6 py-2">
        <h2 id={labelId} className="text-sm font-medium">{label}</h2>
        {action}
      </header>
      {children}
    </section>
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
