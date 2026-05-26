export const BRAND_DISPLAY_FONT =
  "var(--brand-font-display, var(--app-font-display, system-ui))";

export const BRAND_BODY_FONT =
  "var(--brand-font-body, var(--app-font-sans, system-ui))";

/**
 * Numbers font. Used by stat-style blocks (TrustBar, StatCallout, DSO stat
 * blocks) for the big numeric value. Falls back to the brand display font
 * when unset, so tenants who never touch this setting see no change.
 */
export const BRAND_NUMBERS_FONT =
  "var(--brand-font-numbers, var(--brand-font-display, var(--app-font-display, system-ui)))";

export const BRAND_DISPLAY_STACK = `${BRAND_DISPLAY_FONT}, 'Inter', system-ui, sans-serif`;

export const BRAND_BODY_STACK = `${BRAND_BODY_FONT}, 'Inter', system-ui, sans-serif`;

export const BRAND_NUMBERS_STACK = `${BRAND_NUMBERS_FONT}, 'Inter', system-ui, sans-serif`;
