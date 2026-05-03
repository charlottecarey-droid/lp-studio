import { FONT_CATALOG } from "@/lib/font-catalog";

const FONT_GROUPS: Array<{ label: string; fonts: typeof FONT_CATALOG }> = [
  { label: "Display", fonts: FONT_CATALOG.filter((f) => f.category === "display") },
  { label: "Serif", fonts: FONT_CATALOG.filter((f) => f.category === "serif") },
  { label: "Sans-serif", fonts: FONT_CATALOG.filter((f) => f.category === "sans") },
  { label: "Monospace", fonts: FONT_CATALOG.filter((f) => f.category === "mono") },
];

interface Props {
  value: string | undefined;
  onChange: (v: string | undefined) => void;
  inheritLabel?: string;
  className?: string;
}

/**
 * Curated font picker, grouped by category. Every option is a family from
 * {@link FONT_CATALOG} so the matching block-side `useBlockFonts` loader can
 * actually fetch and apply the typeface. The empty value clears the override
 * so the block falls back to the brand's font (or its own default).
 */
export function FontSelect({ value, onChange, inheritLabel = "Inherit from brand", className }: Props) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || undefined)}
      className={
        className ||
        "w-full h-8 text-xs rounded-md border border-border bg-background px-2"
      }
    >
      <option value="">{inheritLabel}</option>
      {FONT_GROUPS.map((group) =>
        group.fonts.length === 0 ? null : (
          <optgroup key={group.label} label={group.label}>
            {group.fonts.map((f) => (
              <option key={f.family} value={f.family} style={{ fontFamily: f.family }}>
                {f.label || f.family}
              </option>
            ))}
          </optgroup>
        ),
      )}
    </select>
  );
}
