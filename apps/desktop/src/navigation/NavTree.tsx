import { useEffect, useState, type KeyboardEvent } from "react";
import { ChevronRight, Star } from "lucide-react";
import type { CatalogRow, CatalogTool } from "../catalog/catalog";
import { useT } from "../i18n/language";
import {
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/cn";
import { useNavigation } from "./navigation";

/** Sub-tools shown before "N more…"; FFmpeg alone has fourteen. */
const visibleSubTools = 5;

type TreeProps = {
  rows: CatalogRow[];
  openGroupId: string | null;
  onOpenGroupChange: (groupId: string | null) => void;
  pinnedIds: string[];
  onTogglePin: (toolId: string) => void;
};

/**
 * Group → tool → sub-tool, as an ARIA tree: arrows move between the visible
 * items, → and ← open and close, Enter goes. One group is open at a time so the
 * tree fits; the current tool's sub-tools are the only ones listed.
 */
export function NavTree({ rows, openGroupId, onOpenGroupChange, pinnedIds, onTogglePin }: TreeProps) {
  const t = useT();
  const { location } = useNavigation();
  const { state, setOpen } = useSidebar();
  const [expandedToolId, setExpandedToolId] = useState<string | null>(location.toolId ?? null);
  const [showAllSubTools, setShowAllSubTools] = useState(false);

  // Arriving at a tool from anywhere — the palette, a card — reveals it here.
  useEffect(() => {
    if (!location.toolId) return;
    setExpandedToolId(location.toolId);
    const row = rows.find((candidate) => candidate.tools.some((tool) => tool.id === location.toolId));
    if (row) onOpenGroupChange(row.id);
  }, [location.toolId, rows, onOpenGroupChange]);

  useEffect(() => setShowAllSubTools(false), [expandedToolId]);

  // The one item Tab lands on: the deepest visible item on the way to where the window is.
  const toolShowing = rows.some((row) => row.id === openGroupId && row.tools.some((tool) => tool.id === location.toolId));
  const collapsed = state === "collapsed";
  const tabStop =
    collapsed
      ? (rows.find((row) => row.tools.some((tool) => tool.id === location.toolId))?.id ?? rows[0]?.id)
      : toolShowing && location.subId && expandedToolId === location.toolId
      ? `${location.toolId}/${location.subId}`
      : toolShowing
        ? location.toolId
        : (openGroupId ?? rows[0]?.id);

  function toggleGroup(groupId: string) {
    if (state === "collapsed") {
      // The icon strip has no room for the tree; opening a group opens the sidebar.
      setOpen(true);
      onOpenGroupChange(groupId);
      return;
    }
    onOpenGroupChange(openGroupId === groupId ? null : groupId);
  }

  return (
    <SidebarMenu role="tree" aria-label={t("All tools")} onKeyDown={moveFocus}>
      {rows.map((row) => {
        const open = openGroupId === row.id;
        const Icon = row.icon;
        return (
          <SidebarMenuItem key={row.id} role="none">
            <SidebarMenuButton asChild tooltip={t(row.title)}>
              <div
                role="treeitem"
                aria-level={1}
                aria-expanded={open}
                data-tree-id={row.id}
                tabIndex={tabStop === row.id ? 0 : -1}
                onClick={() => toggleGroup(row.id)}
                onKeyDown={(event) =>
                  handleItemKeys(event, {
                    activate: () => toggleGroup(row.id),
                    expand: open ? undefined : () => onOpenGroupChange(row.id),
                    collapse: open ? () => onOpenGroupChange(null) : undefined,
                  })
                }
              >
                <Icon className="text-group-icon" style={{ "--hue": row.hue } as React.CSSProperties} />
                <span className="truncate">{t(row.title)}</span>
                <span className="ml-auto text-xs text-sidebar-foreground/70 tabular-nums">{row.tools.length}</span>
                <ChevronRight className={cn("transition-transform", open && "rotate-90")} />
              </div>
            </SidebarMenuButton>
            {open && (
              <SidebarMenuSub role="group" className="mr-0 pr-0">
                {row.tools.map((tool) => (
                  <ToolItem
                    key={tool.id}
                    tool={tool}
                    parentId={row.id}
                    expanded={expandedToolId === tool.id}
                    onExpandedChange={(expanded) => setExpandedToolId(expanded ? tool.id : null)}
                    showAll={showAllSubTools}
                    onShowAll={() => setShowAllSubTools(true)}
                    tabStop={tabStop}
                    pinned={pinnedIds.includes(tool.id)}
                    onTogglePin={() => onTogglePin(tool.id)}
                  />
                ))}
              </SidebarMenuSub>
            )}
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}

function ToolItem({
  tool,
  parentId,
  expanded,
  onExpandedChange,
  showAll,
  onShowAll,
  tabStop,
  pinned,
  onTogglePin,
}: {
  tool: CatalogTool;
  parentId: string;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  showAll: boolean;
  onShowAll: () => void;
  tabStop: string | undefined;
  pinned: boolean;
  onTogglePin: () => void;
}) {
  const t = useT();
  const { location, go } = useNavigation();
  const hasSubTools = tool.operations.length > 1;
  const current = location.view === "tool" && location.toolId === tool.id;
  const currentIndex = tool.operations.findIndex((operation) => operation.id === location.subId);
  const listed =
    showAll || currentIndex >= visibleSubTools ? tool.operations : tool.operations.slice(0, visibleSubTools);
  const hidden = tool.operations.length - listed.length;
  const Icon = tool.icon;

  function open() {
    go({ view: "tool", toolId: tool.id });
    if (hasSubTools) onExpandedChange(true);
  }

  return (
    <SidebarMenuSubItem role="none" className="group/menu-item relative">
      <SidebarMenuSubButton asChild isActive={current && !location.subId}>
        <div
          role="treeitem"
          aria-level={2}
          aria-expanded={hasSubTools ? expanded : undefined}
          aria-current={current && !location.subId ? "page" : undefined}
          data-tree-id={tool.id}
          data-tree-parent={parentId}
          tabIndex={tabStop === tool.id ? 0 : -1}
          // Room for the pin star, which sits over the end of the row.
          className="pr-8"
          onClick={open}
          onKeyDown={(event) =>
            handleItemKeys(event, {
              activate: open,
              expand: hasSubTools && !expanded ? () => onExpandedChange(true) : undefined,
              collapse: hasSubTools && expanded ? () => onExpandedChange(false) : undefined,
            })
          }
        >
          <Icon />
          <span>{t(tool.title)}</span>
        </div>
      </SidebarMenuSubButton>
      <SidebarMenuAction
        showOnHover={!pinned}
        className="top-1"
        onClick={onTogglePin}
        aria-label={t(pinned ? "Unpin {name}" : "Pin {name}", { name: t(tool.title) })}
        aria-pressed={pinned}
      >
        <Star className={cn(pinned && "fill-sidebar-primary text-sidebar-primary")} />
      </SidebarMenuAction>
      {hasSubTools && expanded && (
        <SidebarMenuSub role="group" className="mr-0 pr-0">
          {listed.map((operation) => {
            const active = current && location.subId === operation.id;
            return (
              <SidebarMenuSubItem key={operation.id} role="none">
                <SidebarMenuSubButton asChild isActive={active}>
                  <div
                    role="treeitem"
                    aria-level={3}
                    aria-current={active ? "page" : undefined}
                    data-tree-id={`${tool.id}/${operation.id}`}
                    data-tree-parent={tool.id}
                    tabIndex={tabStop === `${tool.id}/${operation.id}` ? 0 : -1}
                    onClick={() => go({ view: "tool", toolId: tool.id, subId: operation.id })}
                    onKeyDown={(event) =>
                      handleItemKeys(event, {
                        activate: () => go({ view: "tool", toolId: tool.id, subId: operation.id }),
                      })
                    }
                  >
                    <span>{t(operation.label)}</span>
                  </div>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            );
          })}
          {hidden > 0 && (
            <SidebarMenuSubItem role="none">
              <SidebarMenuSubButton asChild>
                <div
                  role="treeitem"
                  aria-level={3}
                  data-tree-parent={tool.id}
                  tabIndex={-1}
                  className="italic text-sidebar-foreground/70"
                  onClick={onShowAll}
                  onKeyDown={(event) => handleItemKeys(event, { activate: onShowAll })}
                >
                  <span>{t("{count} more…", { count: hidden })}</span>
                </div>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          )}
        </SidebarMenuSub>
      )}
    </SidebarMenuSubItem>
  );
}

/** Enter and Space act, → opens (or steps in), ← closes (or steps out to the parent). */
function handleItemKeys(
  event: KeyboardEvent<HTMLElement>,
  actions: { activate: () => void; expand?: () => void; collapse?: () => void },
) {
  const item = event.currentTarget;
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    actions.activate();
  } else if (event.key === "ArrowRight") {
    event.preventDefault();
    if (actions.expand) actions.expand();
    else if (item.getAttribute("aria-expanded") === "true") focusSibling(item, 1);
  } else if (event.key === "ArrowLeft") {
    event.preventDefault();
    if (actions.collapse) actions.collapse();
    else {
      const parent = item.dataset.treeParent;
      const tree = item.closest('[role="tree"]');
      if (parent && tree) tree.querySelector<HTMLElement>(`[data-tree-id="${CSS.escape(parent)}"]`)?.focus();
    }
  }
}

/** ↑ ↓ Home End move between the items that are showing, in reading order. */
function moveFocus(event: KeyboardEvent<HTMLElement>) {
  const steps: Record<string, number> = { ArrowDown: 1, ArrowUp: -1, Home: -Infinity, End: Infinity };
  const step = steps[event.key];
  const item = (event.target as HTMLElement).closest<HTMLElement>('[role="treeitem"]');
  if (step === undefined || !item) return;
  event.preventDefault();
  focusSibling(item, step);
}

function focusSibling(item: HTMLElement, step: number) {
  const tree = item.closest('[role="tree"]');
  if (!tree) return;
  // The icon strip keeps open groups in the DOM but hides their tools.
  const items = [...tree.querySelectorAll<HTMLElement>('[role="treeitem"]')].filter(
    (candidate) => candidate === item || (candidate.checkVisibility?.() ?? true),
  );
  const index = items.indexOf(item);
  const target =
    step === -Infinity ? 0 : step === Infinity ? items.length - 1 : Math.min(items.length - 1, Math.max(0, index + step));
  items[target]?.focus();
}
