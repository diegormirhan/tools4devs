import { invoke } from "@tauri-apps/api/core";
import { ExternalLink } from "lucide-react";
import toolManifest from "../../../../tooling/tools.json";
import { useT } from "../i18n/language";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "./PageHeader";

/**
 * Who made what is inside. Read from the same manifest that pins every download, so a
 * version, licence or hash shown here is the one the app actually installs.
 */
export function AboutView({ version }: { version: string }) {
  const t = useT();

  return (
    <div data-slot="page" className="grid max-w-[760px] gap-6 px-6 pt-4 pb-16 lg:px-8">
      <PageHeader
        title={t("About Tools4Devs")}
        lead={t("Its own code is under the MIT licence. Every tool it runs keeps its own licence, listed below.")}
      />

      <section className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border bg-card px-6 py-5 text-sm text-card-foreground shadow-xs">
        <span>
          {t("Version")} <span className="font-mono text-muted-foreground">{version || "—"}</span>
        </span>
        <span>
          {t("Licence")} <span className="font-mono text-muted-foreground">MIT</span>
        </span>
      </section>

      <section className="grid gap-3" aria-labelledby="about-components">
        <h2 id="about-components" className="font-heading text-lg font-semibold">
          {t("Components")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("Each one runs as its own program, never linked into the app. The hash is the one checked before it is used.")}
        </p>
        <ul aria-labelledby="about-components" className="grid gap-2">
          {toolManifest.tools.map((tool) => (
            <li
              key={tool.id}
              className="grid gap-2 rounded-xl border bg-card px-5 py-4 text-card-foreground shadow-xs"
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <strong className="font-medium">{tool.displayName}</strong>
                <span className="font-mono text-xs text-muted-foreground">{tool.version}</span>
                <Badge variant="outline">{t(tool.delivery === "embedded" ? "In the installer" : "Downloaded when you ask")}</Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="ml-auto size-8"
                  aria-label={t("Open the {name} project", { name: tool.displayName })}
                  onClick={() => void invoke("open_link", { url: tool.sourceRepository }).catch(() => undefined)}
                >
                  <ExternalLink aria-hidden="true" />
                </Button>
              </div>
              <span className="text-sm">{tool.licenseExpression}</span>
              <span className="truncate font-mono text-xs text-muted-foreground" title={tool.artifacts[0]?.sha256}>
                SHA-256 {tool.artifacts[0]?.sha256}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <p className="text-sm text-muted-foreground">
        {t("The interface's own libraries and fonts, with their licence texts, are in FRONTEND-NOTICES.txt, in the tools folder beside the app.")}
      </p>
    </div>
  );
}
