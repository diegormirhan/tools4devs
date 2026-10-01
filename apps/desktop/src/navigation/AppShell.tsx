import { Fragment, useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { ArrowLeft, PanelLeft } from "lucide-react";
import type { CatalogRow, CatalogTool } from "../catalog/catalog";
import { useT } from "../i18n/language";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { CommandPalette } from "./CommandPalette";
import { DiscardDialog } from "./DiscardDialog";
import { useNavigation, type Location, type View } from "./navigation";

const pageTitles: Record<Exclude<View, "tool">, string> = {
  catalog: "Home",
  queue: "Queue",
  history: "History",
  settings: "Settings",
  about: "About",
};

/**
 * The window frame: sidebar, header and the scrolling page.
 */
export function AppShell({
  rows,
  runningCount,
  wordmarkSrc,
  collapsed,
  onCollapsedChange,
  paletteOpen,
  onPaletteOpenChange,
  file,
  suggestedTools,
  overlays,
  children,
}: {
  rows: CatalogRow[];
  runningCount: number;
  wordmarkSrc: string;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  paletteOpen: boolean;
  onPaletteOpenChange: (open: boolean) => void;
  /** A file chosen before any tool, and the tools made for it. */
  file: string | null;
  suggestedTools: CatalogTool[];
  overlays: ReactNode;
  children: ReactNode;
}) {
  const { location } = useNavigation();
  const pageRef = useRef<HTMLDivElement>(null);
  // Every page starts at its top; the scroll of the previous one means nothing here.
  useEffect(() => {
    if (pageRef.current) pageRef.current.scrollTop = 0;
  }, [location.view, location.toolId]);

  // Marks the few hundred milliseconds the sidebar spends opening or closing, so the
  // stylesheet can hold back what would otherwise appear squeezed into a narrow rail.
  const mounted = useRef(false);
  // Before paint, or the first frame of the opening shows them squeezed.
  useLayoutEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const root = document.documentElement;
    root.dataset.sidebarMoving = "true";
    const timer = window.setTimeout(() => delete root.dataset.sidebarMoving, 450);
    return () => {
      window.clearTimeout(timer);
      delete root.dataset.sidebarMoving;
    };
  }, [collapsed]);

  return (
    <SidebarProvider
      open={!collapsed}
      onOpenChange={(open) => onCollapsedChange(!open)}
      className="h-svh font-sans"
    >
      <AppSidebar
        rows={rows}
        runningCount={runningCount}
        wordmarkSrc={wordmarkSrc}
        onSearch={() => onPaletteOpenChange(true)}
      />
      <SidebarInset className="min-h-0 overflow-hidden">
        <ShellHeader rows={rows} />
        <div ref={pageRef} className="min-h-0 flex-1 overflow-auto">
          {children}
        </div>
      </SidebarInset>
      {overlays}
      <CommandPalette
        rows={rows}
        open={paletteOpen}
        onOpenChange={onPaletteOpenChange}
        file={file}
        suggestedTools={suggestedTools}
      />
      <DiscardDialog />
    </SidebarProvider>
  );
}

function ShellHeader({ rows }: { rows: CatalogRow[] }) {
  const t = useT();
  const { location, go, back, canGoBack } = useNavigation();
  const { open, toggleSidebar } = useSidebar();
  const label = t(open ? "Hide the sidebar" : "Show the sidebar");

  useEffect(() => {
    function goBack(event: KeyboardEvent) {
      if (event.altKey && event.key === "ArrowLeft") {
        event.preventDefault();
        back();
      }
    }
    window.addEventListener("keydown", goBack);
    return () => window.removeEventListener("keydown", goBack);
  }, [back]);

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 px-4">
      <Button
        variant="ghost"
        size="icon"
        className="-ml-1 size-7"
        onClick={toggleSidebar}
        aria-label={label}
        title={label}
      >
        <PanelLeft />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        onClick={back}
        disabled={!canGoBack}
        aria-label={t("Back")}
        title={`${t("Back")} (Alt+←)`}
      >
        <ArrowLeft />
      </Button>
      <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
      <Breadcrumb aria-label={t("Where you are")}>
        <BreadcrumbList>
          {trail(location, rows).map((crumb, index, crumbs) => (
            <Fragment key={crumb.label}>
              {index > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem>
                {index === crumbs.length - 1 ? (
                  <BreadcrumbPage>{t(crumb.label)}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink
                    href="#"
                    onClick={(event) => {
                      event.preventDefault();
                      go(crumb.to);
                    }}
                  >
                    {t(crumb.label)}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
    </header>
  );
}

type Crumb = { label: string; to: Location };

/**
 * Home › tool › sub-tool, or Home › page; every step but the last leads somewhere.
 * The group a tool sits in has no page of its own, so it is left out. English, translated where shown.
 */
function trail(location: Location, rows: CatalogRow[]): Crumb[] {
  const home: Crumb = { label: pageTitles.catalog, to: { view: "catalog" } };
  if (location.view === "catalog") return [home];
  if (location.view !== "tool") return [home, { label: pageTitles[location.view], to: location }];
  const tool = rows.flatMap((row) => row.tools).find((candidate) => candidate.id === location.toolId);
  const operation = tool?.operations.find((candidate) => candidate.id === location.subId);
  return [
    home,
    ...(tool ? [{ label: tool.title, to: { view: "tool" as const, toolId: tool.id } }] : []),
    ...(operation ? [{ label: operation.label, to: location }] : []),
  ];
}
