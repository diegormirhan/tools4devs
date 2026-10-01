import { Fragment, useEffect, useRef, type ReactNode } from "react";
import { PanelLeft } from "lucide-react";
import type { CatalogRow, CatalogTool } from "../catalog/catalog";
import { useT } from "../i18n/language";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
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
  catalog: "Tools",
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
  const { location } = useNavigation();
  const { open, toggleSidebar } = useSidebar();
  const label = t(open ? "Hide the sidebar" : "Show the sidebar");

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
      <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
      <Breadcrumb aria-label={t("Where you are")}>
        <BreadcrumbList>
          {trail(location, rows).map((crumb, index, crumbs) => (
            <Fragment key={crumb}>
              {index > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem>
                {index === crumbs.length - 1 ? <BreadcrumbPage>{t(crumb)}</BreadcrumbPage> : t(crumb)}
              </BreadcrumbItem>
            </Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
    </header>
  );
}

/** Group › tool › sub-tool for a tool; the page's own name otherwise. English, translated where shown. */
function trail(location: Location, rows: CatalogRow[]): string[] {
  if (location.view !== "tool") return [pageTitles[location.view]];
  const row = rows.find((candidate) => candidate.tools.some((tool) => tool.id === location.toolId));
  const tool = row?.tools.find((candidate) => candidate.id === location.toolId);
  const operation = tool?.operations.find((candidate) => candidate.id === location.subId);
  return [row?.title, tool?.title, operation?.label].filter((crumb): crumb is string => Boolean(crumb));
}
