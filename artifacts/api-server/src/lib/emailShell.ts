import { pool } from "@workspace/db";
import {
  DEFAULT_EMAIL_SHELL,
  DEFAULT_FOOTER_HTML,
  DEFAULT_HEADER_BG,
  DEFAULT_LOGO_HTML,
  PLATFORM_DEFAULT_SHELL,
  type EmailShell,
} from "./emailRender";

/**
 * Cached accessor for the platform email SHELL (the branded wrapper shared by
 * every lifecycle email, the invite, and the superadmin preview/test-send).
 *
 * Same resilience contract as `notificationTemplates.ts`: the code default
 * (`DEFAULT_EMAIL_SHELL`) is the source of truth; the singleton DB row only
 * carries operator overrides, and ANY DB error or null column falls back to the
 * code default so a config hiccup can never break a send.
 */

export const EMAIL_SHELL_ID = "platform";

interface ShellRow {
  shell_html: string | null;
  logo_html: string | null;
  header_bg: string | null;
  footer_html: string | null;
}

/** Raw override row (nulls = "use code default"), for the shell editor screen. */
export interface EmailShellOverrides {
  shellHtml: string | null;
  logoHtml: string | null;
  headerBg: string | null;
  footerHtml: string | null;
}

const CACHE_TTL_MS = 60_000;
let cache: EmailShell | null = null;
let cacheExpiresAt = 0;
let inFlight: Promise<EmailShell> | null = null;
let generation = 0;

function rowToShell(row: ShellRow | undefined): EmailShell {
  if (!row) return { ...DEFAULT_EMAIL_SHELL };
  return {
    shellHtml: row.shell_html ?? PLATFORM_DEFAULT_SHELL,
    logoHtml: row.logo_html ?? DEFAULT_LOGO_HTML,
    headerBg: row.header_bg ?? DEFAULT_HEADER_BG,
    footerHtml: row.footer_html ?? DEFAULT_FOOTER_HTML,
  };
}

async function loadFromDb(): Promise<EmailShell> {
  try {
    const r = await pool.query<ShellRow>(
      `SELECT shell_html, logo_html, header_bg, footer_html
         FROM email_shell_templates WHERE id = $1`,
      [EMAIL_SHELL_ID],
    );
    return rowToShell(r.rows[0]);
  } catch (err) {
    console.error("[emailShell] DB load failed, using code default:", err);
    return { ...DEFAULT_EMAIL_SHELL };
  }
}

/** Resolved shell (DB overrides merged over code defaults), cached 60s. */
export async function getEmailShell(): Promise<EmailShell> {
  const now = Date.now();
  if (cache && now < cacheExpiresAt) return cache;
  if (inFlight) return inFlight;
  const myGeneration = generation;
  inFlight = loadFromDb()
    .then((loaded) => {
      if (myGeneration === generation) {
        cache = loaded;
        cacheExpiresAt = Date.now() + CACHE_TTL_MS;
      }
      return loaded;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

/**
 * Raw override row for the editor (nulls preserved so the UI can distinguish
 * "overridden" from "using default"). Bypasses the cache.
 */
export async function getEmailShellOverrides(): Promise<EmailShellOverrides> {
  try {
    const r = await pool.query<ShellRow>(
      `SELECT shell_html, logo_html, header_bg, footer_html
         FROM email_shell_templates WHERE id = $1`,
      [EMAIL_SHELL_ID],
    );
    const row = r.rows[0];
    return {
      shellHtml: row?.shell_html ?? null,
      logoHtml: row?.logo_html ?? null,
      headerBg: row?.header_bg ?? null,
      footerHtml: row?.footer_html ?? null,
    };
  } catch (err) {
    console.error("[emailShell] overrides load failed:", err);
    return { shellHtml: null, logoHtml: null, headerBg: null, footerHtml: null };
  }
}

/** Bust the cache after a superadmin save so edits go live immediately. */
export function bustEmailShellCache(): void {
  cache = null;
  cacheExpiresAt = 0;
  generation += 1;
}
