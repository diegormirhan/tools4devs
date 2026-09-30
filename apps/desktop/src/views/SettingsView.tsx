import { open } from "@tauri-apps/plugin-dialog";
import { NumberField } from "../components/NumberField";
import { Select } from "../components/Select";
import { ThemeSwitch } from "../components/ThemeSwitch";
import type { ThemePreference } from "../hooks/useTheme";
import type { UpdateState } from "../hooks/useUpdate";
import { useT, type Language, type Translate } from "../i18n/language";

export function SettingsView({
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
