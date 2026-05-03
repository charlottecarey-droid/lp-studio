export interface HeaderFontOption {
  label: string;
  value: string;
}

export const HEADER_FONT_OPTIONS: HeaderFontOption[] = [
  { label: "System sans", value: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif" },
  { label: "Inter", value: '"Inter", system-ui, sans-serif' },
  { label: "Helvetica", value: '"Helvetica Neue", Helvetica, Arial, sans-serif' },
  { label: "Geist", value: '"Geist", "Inter", system-ui, sans-serif' },
  { label: "Geist Mono", value: '"Geist Mono", ui-monospace, monospace' },
  { label: "Times / Serif", value: 'Georgia, "Times New Roman", serif' },
  { label: "Playfair (display serif)", value: '"Playfair Display", Georgia, serif' },
  { label: "Mono", value: 'ui-monospace, "SF Mono", Menlo, monospace' },
];
