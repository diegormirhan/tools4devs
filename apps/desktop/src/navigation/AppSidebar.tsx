import { History, ListTodo, Search, Settings, Star } from "lucide-react";
import type { CatalogRow } from "../catalog/catalog";
import { useT } from "../i18n/language";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useStoredState } from "@/hooks/useStoredState";
import { useNavigation, type View } from "./navigation";
import { NavTree } from "./NavTree";

const pages: Array<{ view: View; label: string; icon: typeof ListTodo }> = [
  { view: "queue", label: "Queue", icon: ListTodo },
  { view: "history", label: "History", icon: History },
  { view: "settings", label: "Settings", icon: Settings },
];

export function AppSidebar({
  rows,
  runningCount,
  wordmarkSrc,
  onSearch,
}: {
  rows: CatalogRow[];
  runningCount: number;
  wordmarkSrc: string;
  onSearch: () => void;
}) {
  const t = useT();
  const { location, go } = useNavigation();
  const [openGroupId, setOpenGroupId] = useStoredState<string | null>(
    "tools4devs.nav-open-group",
    null,
    (value): value is string | null => value === null || typeof value === "string",
  );
  const [pinnedIds, setPinnedIds] = useStoredState<string[]>("tools4devs.pinned", [], isStringArray);
  const tools = rows.flatMap((row) => row.tools);
  const pinned = pinnedIds.flatMap((id) => tools.filter((tool) => tool.id === id));

  function togglePin(toolId: string) {
    setPinnedIds((ids) => (ids.includes(toolId) ? ids.filter((id) => id !== toolId) : [...ids, toolId]));
  }

  return (
    <Sidebar variant="inset" collapsible="icon" role="complementary" aria-label={t("Main navigation")}>
      <SidebarHeader>
        {/* Collapsed, the mark loses its wordmark and sits right on the search icon without this. */}
        <SidebarMenu className="group-data-[collapsible=icon]:gap-3">
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" onClick={() => go({ view: "catalog" })} tooltip={t("Tools")}>
              <img src="/brand/tools4devs-mark.svg" alt="" width="32" height="32" className="size-8 rounded-lg" />
              <span className="grid leading-tight">
                <img src={wordmarkSrc} alt="tools4devs" width="96" height="22" className="h-[22px] w-auto" />
                <small className="text-xs text-sidebar-foreground/70">{t("Local tools")}</small>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              variant="outline"
              onClick={onSearch}
              tooltip={t("Search tools")}
              className="text-muted-foreground"
            >
              <Search />
              <span className="min-w-0 truncate">{t("Search tools…")}</span>
              <kbd className="ml-auto shrink-0 rounded border px-1.5 font-mono text-[11px] whitespace-nowrap">Ctrl K</kbd>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="[scrollbar-width:thin]">
        {pinned.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>{t("Pinned")}</SidebarGroupLabel>
            <SidebarMenu>
              {pinned.map((tool) => {
                const Icon = tool.icon;
                return (
                  <SidebarMenuItem key={tool.id}>
                    <SidebarMenuButton
                      isActive={location.view === "tool" && location.toolId === tool.id}
                      onClick={() => go({ view: "tool", toolId: tool.id })}
                      tooltip={t(tool.title)}
                    >
                      <Icon />
                      <span>{t(tool.title)}</span>
                      <Star className="ml-auto fill-sidebar-primary text-sidebar-primary" aria-hidden="true" />
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        )}
        <SidebarGroup>
          <SidebarGroupLabel>{t("All tools")}</SidebarGroupLabel>
          <NavTree
            rows={rows}
            openGroupId={openGroupId}
            onOpenGroupChange={setOpenGroupId}
            pinnedIds={pinnedIds}
            onTogglePin={togglePin}
          />
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          {pages.map((page) => {
            const Icon = page.icon;
            const badge = page.view === "queue" ? runningCount : 0;
            return (
              <SidebarMenuItem key={page.view}>
                <SidebarMenuButton
                  isActive={location.view === page.view}
                  aria-current={location.view === page.view ? "page" : undefined}
                  onClick={() => go({ view: page.view })}
                  tooltip={t(page.label)}
                  aria-label={
                    badge > 0 ? t("{name}, {count} running", { name: t(page.label), count: badge }) : undefined
                  }
                >
                  <Icon />
                  <span>{t(page.label)}</span>
                </SidebarMenuButton>
                {badge > 0 && (
                  <SidebarMenuBadge className="rounded-md bg-sidebar-primary text-sidebar-primary-foreground" aria-hidden="true">
                    {badge}
                  </SidebarMenuBadge>
                )}
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}
