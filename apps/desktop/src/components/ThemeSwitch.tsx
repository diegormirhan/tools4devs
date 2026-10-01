import { Monitor, Moon, Sun } from "lucide-react";
import type { ThemePreference } from "../hooks/useTheme";
import { useT } from "../i18n/language";
import { cn } from "@/lib/cn";

type ThemeSwitchProps = {
  preference: ThemePreference;
  onChange: (preference: ThemePreference) => void;
};

const options: Array<{ id: ThemePreference; label: string; icon: typeof Sun }> = [
  { id: "system", label: "System", icon: Monitor },
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
];

/** Three choices, one of them current: a radio group drawn as a segmented control. */
export function ThemeSwitch({ preference, onChange }: ThemeSwitchProps) {
  const t = useT();
  return (
    <div
      data-slot="theme-switch"
      className="inline-flex overflow-hidden rounded-md border shadow-xs"
      role="radiogroup"
      aria-label={t("Interface theme")}
    >
      {options.map((option) => {
        const Icon = option.icon;
        const selected = preference === option.id;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={t("{name} theme", { name: t(option.label) })}
            className={cn(
              "flex h-9 items-center gap-1.5 border-r px-3 text-sm outline-none last:border-r-0 hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50",
              selected && "bg-accent font-medium",
            )}
            onClick={() => onChange(option.id)}
          >
            <Icon className="size-4" aria-hidden="true" />
            {t(option.label)}
          </button>
        );
      })}
    </div>
  );
}
