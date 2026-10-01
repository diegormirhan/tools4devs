import { useState, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { ThemeSwitch } from "../components/ThemeSwitch";
import type { ThemePreference } from "../hooks/useTheme";
import type { UpdateState } from "../hooks/useUpdate";
import { useT, type Language, type Translate } from "../i18n/language";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ClearHistoryDialog } from "./ClearHistoryDialog";
import { PageHeader } from "./PageHeader";

/** One setting: what it is and what it does on the left, its control on the right. */
function SettingRow({ title, description, children }: { title: string; description?: string; children?: ReactNode }) {
  return (
    <section className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-xl border bg-card px-6 py-5 text-card-foreground shadow-xs">
      <div className="grid min-w-0 gap-1">
        <h2 className="font-heading text-base font-semibold">{title}</h2>
        {description && <p className="text-[13px] text-muted-foreground">{description}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </section>
  );
}

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
}) {
  const t = useT();
  const [confirmingClear, setConfirmingClear] = useState(false);
  const checking = updateState.phase === "checking";

  return (
    <div data-slot="page" className="grid max-w-[760px] gap-3 px-6 pt-4 pb-16 lg:px-8">
      <div className="mb-3">
        <PageHeader title={t("Settings")} lead={t("Everything stays on this computer.")} />
      </div>

      <SettingRow title={t("Version")} description={updateMessage(updateState, t) || undefined}>
        <span className="font-mono text-[13px] text-muted-foreground">{version || "—"}</span>
        <Button variant="outline" onClick={() => void onCheckForUpdates()} disabled={checking || updateState.phase === "downloading"}>
          <RefreshCw className={checking ? "animate-spin" : undefined} aria-hidden="true" />
          {t(checking ? "Checking…" : "Check for updates")}
        </Button>
      </SettingRow>

      <SettingRow title={t("Language")} description={t("Tools, options and errors are all translated.")}>
        <Select value={language} onValueChange={(value) => onLanguageChange(value === "pt" ? "pt" : "en")}>
          <SelectTrigger className="w-[180px]" aria-label={t("Language")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="en">English</SelectItem>
            <SelectItem value="pt">Português (Brasil)</SelectItem>
          </SelectContent>
        </Select>
      </SettingRow>

      <SettingRow title={t("Theme")} description={t("Follow Windows, or pick one.")}>
        <ThemeSwitch preference={preference} onChange={onThemeChange} />
      </SettingRow>

      <SettingRow title={t("Sidebar")} description={t("Keep the tool tree open when the window is wide.")}>
        <Switch
          checked={!sidebarCollapsed}
          onCheckedChange={(checked) => onSidebarChange(!checked)}
          aria-label={t("Keep the tool tree open")}
        />
      </SettingRow>

      <SettingRow title={t("Default destination")} description={defaultFolder || t("Not set")}>
        <Button
          variant="outline"
          onClick={() => {
            void open({ directory: true, multiple: false })
              .then((selected) => {
                if (typeof selected === "string") onDefaultFolderChange(selected);
              })
              .catch(() => undefined);
          }}
        >
          {t("Choose")}
        </Button>
        {defaultFolder && (
          <Button variant="ghost" onClick={() => onDefaultFolderChange("")}>
            {t("Clear")}
          </Button>
        )}
      </SettingRow>

      <SettingRow
        title={t("History")}
        description={
          finishedCount > 0
            ? t(finishedCount === 1 ? "{count} finished operation" : "{count} finished operations", { count: finishedCount })
            : t("Nothing has finished yet")
        }
      >
        <Button variant="outline" onClick={() => setConfirmingClear(true)} disabled={finishedCount === 0}>
          {t("Clear")}
        </Button>
      </SettingRow>

      <SettingRow title={t("How many at once")} description={t("Anything beyond this waits in the queue.")}>
        <Select value={String(concurrency)} onValueChange={(value) => onConcurrencyChange(Number(value))}>
          <SelectTrigger className="w-[180px]" aria-label={t("Operations at once")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((count) => (
              <SelectItem key={count} value={String(count)}>
                {t("{count} at a time", { count })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingRow>

      <SettingRow title={t("When the file already exists")} description={t("Choose what happens to the old file.")}>
        <Select value={conflictPolicy} onValueChange={onConflictPolicyChange}>
          <SelectTrigger className="w-[300px]" aria-label={t("When the file already exists")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="keep-both">{t("Keep both — number the new one")}</SelectItem>
            <SelectItem value="overwrite">{t("Overwrite the old one")}</SelectItem>
          </SelectContent>
        </Select>
      </SettingRow>

      <SettingRow title={t("Not available yet")}>
        <ul className="list-disc pl-5 text-[13px] text-muted-foreground">
          <li>{t("Pausing an operation, rather than stopping it")}</li>
          <li>{t("Scheduling one for later")}</li>
        </ul>
      </SettingRow>

      <ClearHistoryDialog open={confirmingClear} onOpenChange={setConfirmingClear} onConfirm={onClearHistory} />
    </div>
  );
}

/** What the last check found, in the one sentence the row has room for. */
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
