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

export const EMAIL_SHELL_ID = "platform_default";

interface ShellRow {
  shell_html: string | null;
  logo_html: string | null;
  header_bg: string | null;
  footer_html: string | null;
  physical_address: string | null;
}

/** Raw override row (nulls = "use code default"), for the shell editor screen. */
export interface EmailShellOverrides {
  shellHtml: string | null;
  logoHtml: string | null;
  headerBg: string | null;
  footerHtml: string | null;
  /** Platform CAN-SPAM postal address (null/"" = no address line). */
  physicalAddress: string | null;
}

/** Resolved platform shell plus the saved postal address for the footer token. */
interface ResolvedPlatformShell {
  shell: EmailShell;
  /** Saved `{{physicalAddress}}` value ("" when unset). */
  physicalAddress: string;
}

const CACHE_TTL_MS = 60_000;
let cache: ResolvedPlatformShell | null = null;
let cacheExpiresAt = 0;
let inFlight: Promise<ResolvedPlatformShell> | null = null;
let generation = 0;

function rowToResolved(row: ShellRow | undefined): ResolvedPlatformShell {
  if (!row) return { shell: { ...DEFAULT_EMAIL_SHELL }, physicalAddress: "" };
  return {
    shell: {
      shellHtml: row.shell_html ?? PLATFORM_DEFAULT_SHELL,
      logoHtml: row.logo_html ?? DEFAULT_LOGO_HTML,
      headerBg: row.header_bg ?? DEFAULT_HEADER_BG,
      footerHtml: row.footer_html ?? DEFAULT_FOOTER_HTML,
    },
    physicalAddress: (row.physical_address ?? "").trim(),
  };
}

async function loadFromDb(): Promise<ResolvedPlatformShell> {
  try {
    const r = await pool.query<ShellRow>(
      `SELECT shell_html, logo_html, header_bg, footer_html, physical_address
         FROM email_shell_templates WHERE id = $1`,
      [EMAIL_SHELL_ID],
    );
    return rowToResolved(r.rows[0]);
  } catch (err) {
    console.error("[emailShell] DB load failed, using code default:", err);
    return { shell: { ...DEFAULT_EMAIL_SHELL }, physicalAddress: "" };
  }
}

/** Resolved shell + saved address (DB overrides merged over code defaults), cached 60s. */
async function getResolvedPlatformShell(): Promise<ResolvedPlatformShell> {
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

/** Resolved shell (DB overrides merged over code defaults), cached 60s. */
export async function getEmailShell(): Promise<EmailShell> {
  return (await getResolvedPlatformShell()).shell;
}

/**
 * The platform's saved CAN-SPAM postal address for the footer `{{physicalAddress}}`
 * token ("" when unset). Shares the 60s shell cache. Injected into every
 * platform-shell render path (auth/welcome/invite + superadmin preview/test-send)
 * so the footer auto-fills the saved address instead of resolving empty.
 */
export async function getPlatformPhysicalAddress(): Promise<string> {
  return (await getResolvedPlatformShell()).physicalAddress;
}

/**
 * Raw override row for the editor (nulls preserved so the UI can distinguish
 * "overridden" from "using default"). Bypasses the cache.
 */
export async function getEmailShellOverrides(): Promise<EmailShellOverrides> {
  try {
    const r = await pool.query<ShellRow>(
      `SELECT shell_html, logo_html, header_bg, footer_html, physical_address
         FROM email_shell_templates WHERE id = $1`,
      [EMAIL_SHELL_ID],
    );
    const row = r.rows[0];
    return {
      shellHtml: row?.shell_html ?? null,
      logoHtml: row?.logo_html ?? null,
      headerBg: row?.header_bg ?? null,
      footerHtml: row?.footer_html ?? null,
      physicalAddress: row?.physical_address ?? null,
    };
  } catch (err) {
    console.error("[emailShell] overrides load failed:", err);
    return { shellHtml: null, logoHtml: null, headerBg: null, footerHtml: null, physicalAddress: null };
  }
}

/** Bust the cache after a superadmin save so edits go live immediately. */
export function bustEmailShellCache(): void {
  cache = null;
  cacheExpiresAt = 0;
  generation += 1;
}
