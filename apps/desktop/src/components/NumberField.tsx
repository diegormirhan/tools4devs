import { Minus, Plus } from "lucide-react";

/**
 * A number input with a step either side of it.
 *
 * Chromium's own spinners only appear on hover, sit inside the field and are a
 * few pixels tall — two stacked arrows sharing the height of one line of text,
 * which is a target nobody can hit on purpose. These are full-height buttons
 * at either end, so the field reads as something you can nudge, and typing and
 * the arrow keys still work exactly as before.
 */
export function NumberField({
  label,
  value,
  placeholder,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: string) => void;
}) {
  const current = Number(value);

  function nudge(direction: 1 | -1) {
    // An empty or unparseable field starts from the floor rather than NaN.
    const from = Number.isFinite(current) ? current : (min ?? 0);
    let next = from + direction * step;
    if (min != null) next = Math.max(min, next);
    if (max != null) next = Math.min(max, next);
    // Rounded to the step's own precision, so 0.1 steps do not drift into
    // 0.30000000000000004.
    const decimals = (String(step).split(".")[1] ?? "").length;
    onChange(next.toFixed(decimals));
  }

  const atFloor = min != null && Number.isFinite(current) && current <= min;
  const atCeiling = max != null && Number.isFinite(current) && current >= max;

  return (
    // The input comes first in the source although the minus sits to its left:
    // a label wrapping this field labels its first form control, and that has
    // to be the number rather than a button nobody needs to hear named.
    <span
      data-slot="number-field"
      className="flex h-9 w-full items-stretch overflow-hidden rounded-md border border-input bg-background shadow-xs focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 dark:bg-input/30"
    >
      <input
        aria-label={label}
        type="number"
        inputMode="decimal"
        placeholder={placeholder}
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(event.target.value)}
        className="order-2 min-w-0 flex-1 bg-transparent px-2 text-center text-sm outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <button
        type="button"
        className="order-1 grid w-9 shrink-0 place-items-center border-r text-muted-foreground hover:bg-accent disabled:opacity-40"
        tabIndex={-1}
        aria-hidden="true"
        disabled={atFloor}
        onClick={() => nudge(-1)}
      >
        <Minus className="size-4" />
      </button>
      <button
        type="button"
        className="order-3 grid w-9 shrink-0 place-items-center border-l text-muted-foreground hover:bg-accent disabled:opacity-40"
        tabIndex={-1}
        aria-hidden="true"
        disabled={atCeiling}
        onClick={() => nudge(1)}
      >
        <Plus className="size-4" />
      </button>
    </span>
  );
}
