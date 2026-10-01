import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

export type SelectChoice = { value: string; label: string };

/**
 * A select whose list the page actually draws.
 *
 * A native <select> renders its popup through the operating system, so no
 * stylesheet reaches it: on Windows the list comes back white-on-grey in the
 * middle of a dark window. Replacing it means owning the keyboard behaviour
 * that came for free, which is what the combobox pattern below is for —
 * arrows, Home/End, typeahead, Enter, Escape, and focus returning to the
 * trigger on close.
 */
export function Select({
  value,
  choices,
  label,
  onChange,
}: {
  value: string;
  choices: SelectChoice[];
  label: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(() => Math.max(0, choices.findIndex((c) => c.value === value)));
  const root = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const typed = useRef({ text: "", at: 0 });
  const listId = useId();

  const selected = choices.find((choice) => choice.value === value) ?? choices[0];

  const close = useCallback((focusTrigger = true) => {
    setOpen(false);
    if (focusTrigger) triggerRef.current?.focus();
  }, []);

  // Pointer-down rather than click: a list that waits for the release feels
  // stuck, and the same press should not immediately reopen it.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) close(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    setActive(Math.max(0, choices.findIndex((choice) => choice.value === value)));
  }, [open, choices, value]);

  // Keep the highlighted row in view without scrolling the panel behind it.
  useEffect(() => {
    if (!open) return;
    const row = listRef.current?.children[active] as HTMLElement | undefined;
    const list = listRef.current;
    if (!row || !list) return;
    if (row.offsetTop < list.scrollTop) list.scrollTop = row.offsetTop;
    else if (row.offsetTop + row.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = row.offsetTop + row.offsetHeight - list.clientHeight;
    }
  }, [active, open]);

  function commit(index: number) {
    const choice = choices[index];
    if (choice) onChange(choice.value);
    close();
  }

  function onKeyDown(event: React.KeyboardEvent) {
    const last = choices.length - 1;

    if (!open && (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      setOpen(true);
      return;
    }
    if (!open) return;

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActive((index) => Math.min(last, index + 1));
        return;
      case "ArrowUp":
        event.preventDefault();
        setActive((index) => Math.max(0, index - 1));
        return;
      case "Home":
        event.preventDefault();
        setActive(0);
        return;
      case "End":
        event.preventDefault();
        setActive(last);
        return;
      case "Enter":
      case " ":
        event.preventDefault();
        commit(active);
        return;
      case "Escape":
        event.preventDefault();
        close();
        return;
      case "Tab":
        close(false);
        return;
      default:
        break;
    }

    // Typeahead: consecutive letters build a prefix, a pause starts over.
    if (event.key.length === 1) {
      const now = Date.now();
      typed.current = {
        text: now - typed.current.at > 700 ? event.key : typed.current.text + event.key,
        at: now,
      };
      const prefix = typed.current.text.toLowerCase();
      const found = choices.findIndex((choice) => choice.label.toLowerCase().startsWith(prefix));
      if (found >= 0) setActive(found);
    }
  }

  return (
    <div data-slot="select" className="relative w-full" ref={root}>
      <button
        ref={triggerRef}
        type="button"
        className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-expanded:border-ring dark:bg-input/30"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-haspopup="listbox"
        aria-label={label}
        onPointerDown={(event) => {
          event.preventDefault();
          setOpen((current) => !current);
          triggerRef.current?.focus();
        }}
        onKeyDown={onKeyDown}
      >
        <span className="truncate text-left">{selected?.label ?? ""}</span>
        <ChevronDown aria-hidden="true" className={`size-4 shrink-0 opacity-50 transition-transform${open ? " rotate-180" : ""}`} />
      </button>

      {open && (
        <ul
          id={listId}
          ref={listRef}
          className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
          role="listbox"
          aria-label={label}
          tabIndex={-1}
        >
          {choices.map((choice, index) => (
            <li
              key={choice.value}
              role="option"
              aria-selected={choice.value === value}
              className={`flex cursor-default items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-sm${
                index === active ? " bg-accent text-accent-foreground" : ""
              }${choice.value === value ? " font-medium" : ""}`}
              onPointerEnter={() => setActive(index)}
              onPointerDown={(event) => {
                event.preventDefault();
                commit(index);
              }}
            >
              <span>{choice.label}</span>
              {choice.value === value && <Check className="size-4 text-primary" aria-hidden="true" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
