export interface HeaderFontOption {
  label: string;
  value: string;
}

/**
 * Curated header font stacks. The leading family in each stack matches a
 * `FONT_CATALOG` entry so the runtime `useBlockFonts` hook in BlockNavHeader /
 * BlockDandySiteHeader can detect and load it. Plain system stacks (no quoted
 * family at the front) skip injection and rely on the OS font.
 */
export const HEADER_FONT_OPTIONS: HeaderFontOption[] = [
  { label: "System sans", value: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif" },
  { label: "System serif", value: 'Georgia, "Times New Roman", serif' },
  { label: "System mono", value: 'ui-monospace, "SF Mono", Menlo, monospace' },

  // Sans-serifs (catalog Google Fonts — auto-loaded)
  { label: "Inter", value: '"Inter", system-ui, sans-serif' },
  { label: "Geist", value: '"Geist", "Inter", system-ui, sans-serif' },
  { label: "DM Sans", value: '"DM Sans", system-ui, sans-serif' },
  { label: "Manrope", value: '"Manrope", system-ui, sans-serif' },
  { label: "Plus Jakarta Sans", value: '"Plus Jakarta Sans", system-ui, sans-serif' },
  { label: "Work Sans", value: '"Work Sans", system-ui, sans-serif' },
  { label: "Space Grotesk", value: '"Space Grotesk", system-ui, sans-serif' },
  { label: "Sora", value: '"Sora", system-ui, sans-serif' },
  { label: "Figtree", value: '"Figtree", system-ui, sans-serif' },
  { label: "Outfit", value: '"Outfit", system-ui, sans-serif' },

  // Serifs (catalog Google Fonts — auto-loaded)
  { label: "Playfair Display", value: '"Playfair Display", Georgia, serif' },
  { label: "Fraunces", value: '"Fraunces", Georgia, serif' },
  { label: "Lora", value: '"Lora", Georgia, serif' },
  { label: "Source Serif", value: '"Source Serif 4", Georgia, serif' },
];
