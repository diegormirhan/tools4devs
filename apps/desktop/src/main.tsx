import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { migratePreferences } from "./domain/preference-migration";
import { LanguageProvider, useT } from "./i18n/language";

function MigrationFailure() {
  const t = useT();
  return <p role="alert">{t("Could not migrate your saved settings. Your previous data is unchanged. Close the app and try again.")}</p>;
}

const root = createRoot(document.getElementById("root")!);
try {
  migratePreferences(window.localStorage);
  root.render(<StrictMode><App /></StrictMode>);
} catch {
  root.render(<LanguageProvider><MigrationFailure /></LanguageProvider>);
}
