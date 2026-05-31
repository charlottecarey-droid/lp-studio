import { pool } from "@workspace/db";
import {
  DEFAULT_EMAIL_SHELL,
  PLATFORM_DEFAULT_SHELL,
  escapeHtml,
  type EmailShell,
} from "./emailRender";

/**
 * Resolve the SHELL a tenant's notification emails render into (Task #588).
 *
 * Resolution order (each layer falls back to the next so a send can never break
 * or leak the platform's LP Studio chrome to a tenant under normal operation):
 *   1. tenant_email_shells row  — explicit per-tenant overrides (cols null → next)
 *   2. brand-derived shell      — computed from lp_brand_settings (logo, colors)
 *   3. platform default         — last-resort fail-safe (only on DB error)
 *
 * The brand-derived shell reuses the platform's master shell HTML *container*
 * (which carries no LP Studio strings — those live only in the logo/footer slots
 * we replace), so a tenant email is fully on-brand with the tenant's own logo,
 * accent color, and footer.
 */

export type TenantShellSource = "tenant" | "brand" | "platform";

/** Minimal slice of the tenant brand config we map onto the shell. */
interface TenantBrandForEmail {
  brandName?: string;
  primaryColor?: string;
  accentColor?: string;
  ctaBackground?: string;
  logoUrl?: string;
  copyrightName?: string;
}

const DEFAULT_BRAND_HEADER_BG = "#1A1815";

/** Only allow a CSS hex color through to the shell to avoid style injection. */
function safeHexColor(value: string | undefined, fallback: string): string {
  if (value && /^#[0-9a-fA-F]{3,8}$/.test(value.trim())) return value.trim();
  return fallback;
}

/**
 * Public host that serves tenant brand assets (`/api/storage/...`) to email
 * clients. Uploaded brand logos are stored as root-relative serve paths, but an
 * email `<img>` src MUST be absolute (relative paths render broken in every mail
 * client), so we resolve them against this host. The storage serve route allows
 * anonymous reads and the app host always proxies `/api/storage`, so this is the
 * canonical place an email recipient can fetch the logo from.
 *
 * Mirrors the env precedence the rest of the app uses for its public host
 * (`triggerPublishedRender`): explicit public host → dev domain → prod default.
 */
function emailAssetHost(): string {
  return (
    (process.env.LP_STUDIO_PUBLIC_HOST || "").trim().toLowerCase() ||
    (process.env.REPLIT_DEV_DOMAIN || "").trim().toLowerCase() ||
    "app.lpstudio.ai"
  );
}

/**
 * Normalize a stored logo URL to an absolute, email-safe `http(s)` URL, mirroring
 * `injectPageMeta`'s `toAbsoluteUrl`: pass through already-absolute URLs, fix
 * protocol-relative (`//host/...`), and resolve root-relative (`/uploads/...`)
 * or bare relative paths against the app's public host. Returns "" for genuinely
 * empty or unusable values so the caller falls back to the brand-name text.
 */
function toAbsoluteLogoUrl(raw: string): string {
  const url = (raw || "").trim();
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("//")) return `https:${url}`;
  const host = emailAssetHost();
  const abs = url.startsWith("/") ? `https://${host}${url}` : `https://${host}/${url}`;
  // Guard: only emit an <img> for a value we resolved to a real http(s) URL.
  return /^https?:\/\//i.test(abs) ? abs : "";
}

function buildBrandLogoHtml(brand: TenantBrandForEmail): string {
  const name = (brand.brandName ?? "").trim();
  const logoUrl = toAbsoluteLogoUrl(brand.logoUrl ?? "");
  if (logoUrl) {
    return `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(
      name,
    )}" height="40" style="height:40px;max-height:48px;width:auto;margin:0 auto;display:block;border:0;">`;
  }
  const label = name || "Notifications";
  return `<span style="font-family:'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:26px;font-weight:800;letter-spacing:-0.04em;color:#1A1815;">${escapeHtml(
    label,
  )}</span>`;
}

/**
 * Brand-neutral, CAN-SPAM-shaped tenant footer (no LP Studio strings). The
 * brand name / copyright are baked (escaped) at build time; per-send tokens
 * ({{physicalAddress}}, {{unsubscribeUrl}}, {{currentYear}}) are interpolated by
 * `renderEmail`.
 *
 * NOTE: {{unsubscribeUrl}} defaults (via expandEmailVars) to the workspace
 * settings page — fine for the internal lead/comment/review notifications. A
 * true recipient-side CAN-SPAM unsubscribe store for external form-followup
 * recipients is tenant+external scoped and tracked separately (coordinate with
 * Task #587's per-user opt-out; do not reuse that link shape).
 */
function buildTenantFooterHtml(brand: TenantBrandForEmail): string {
  const name = (brand.brandName ?? "").trim();
  const copyright = (brand.copyrightName ?? "").trim() || name || "All rights reserved";
  const addressLead = name ? `${escapeHtml(name)} &middot; ` : "";
  return `<table role="presentation" class="container" cellpadding="0" cellspacing="0" border="0" width="720" style="max-width:720px;background:#F6F2E9;">
          <tr>
            <td class="px-pad" style="padding:48px 56px 0 56px;">
              <div style="height:1px;background:rgba(26,24,21,0.10);line-height:1px;font-size:1px;">&nbsp;</div>
            </td>
          </tr>
          <tr>
            <td class="px-pad" style="padding:28px 56px 48px 56px;">
              <p style="margin:0 0 8px 0;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:11px;line-height:1.6;color:#8B857C;">
                <a href="{{unsubscribeUrl}}" style="color:#5C5853;text-decoration:underline;">Manage email preferences</a>
              </p>
              <p style="margin:0;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:11px;line-height:1.6;color:#B5AEA2;">
                ${addressLead}{{physicalAddress}}<br>
                &copy; {{currentYear}} ${escapeHtml(copyright)}.
              </p>
            </td>
          </tr>
        </table>`;
}

/** Compute a full brand-derived EmailShell from a tenant's brand config. */
export function buildBrandDerivedShell(brand: TenantBrandForEmail): EmailShell {
  return {
    shellHtml: PLATFORM_DEFAULT_SHELL,
    logoHtml: buildBrandLogoHtml(brand),
    headerBg: safeHexColor(
      brand.primaryColor || brand.accentColor || brand.ctaBackground,
      DEFAULT_BRAND_HEADER_BG,
    ),
    footerHtml: buildTenantFooterHtml(brand),
  };
}

async function fetchTenantBrand(tenantId: number): Promise<TenantBrandForEmail> {
  try {
    const r = await pool.query<{ config: TenantBrandForEmail | null }>(
      `SELECT config FROM lp_brand_settings WHERE tenant_id = $1 LIMIT 1`,
      [tenantId],
    );
    return r.rows[0]?.config ?? {};
  } catch (err) {
    console.error("[tenantEmailShell] brand load failed:", err);
    return {};
  }
}

interface TenantShellRow {
  shell_html: string | null;
  logo_html: string | null;
  header_bg: string | null;
  footer_html: string | null;
}

/** Raw override row for the editor (nulls preserved). */
export interface TenantEmailShellOverrides {
  shellHtml: string | null;
  logoHtml: string | null;
  headerBg: string | null;
  footerHtml: string | null;
}

const CACHE_TTL_MS = 60_000;
interface ShellCacheEntry {
  shell: EmailShell;
  source: TenantShellSource;
  expiresAt: number;
}
const cache = new Map<number, ShellCacheEntry>();
let generation = 0;

async function loadShell(
  tenantId: number,
): Promise<{ shell: EmailShell; source: TenantShellSource }> {
  try {
    const [shellRes, brand] = await Promise.all([
      pool.query<TenantShellRow>(
        `SELECT shell_html, logo_html, header_bg, footer_html
           FROM tenant_email_shells WHERE tenant_id = $1`,
        [tenantId],
      ),
      fetchTenantBrand(tenantId),
    ]);
    const derived = buildBrandDerivedShell(brand);
    const row = shellRes.rows[0];
    if (row) {
      // Tenant overrides merge over the brand-derived shell (null = brand value).
      return {
        shell: {
          shellHtml: row.shell_html ?? derived.shellHtml,
          logoHtml: row.logo_html ?? derived.logoHtml,
          headerBg: row.header_bg ?? derived.headerBg,
          footerHtml: row.footer_html ?? derived.footerHtml,
        },
        source: "tenant",
      };
    }
    return { shell: derived, source: "brand" };
  } catch (err) {
    console.error(
      "[tenantEmailShell] resolve failed, using platform default:",
      err,
    );
    return { shell: { ...DEFAULT_EMAIL_SHELL }, source: "platform" };
  }
}

/** Resolved tenant shell (cached 60s per tenant), with its provenance label. */
export async function resolveTenantShell(
  tenantId: number,
): Promise<{ shell: EmailShell; source: TenantShellSource }> {
  const now = Date.now();
  const hit = cache.get(tenantId);
  if (hit && now < hit.expiresAt) return { shell: hit.shell, source: hit.source };
  const myGeneration = generation;
  const loaded = await loadShell(tenantId);
  if (myGeneration === generation) {
    cache.set(tenantId, {
      shell: loaded.shell,
      source: loaded.source,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
  }
  return loaded;
}

/** Raw override row for the editor (bypasses cache). Brand-derived defaults are
 *  returned alongside so the UI can show "using brand default" placeholders. */
export async function getTenantEmailShellOverrides(
  tenantId: number,
): Promise<{ overrides: TenantEmailShellOverrides; derived: EmailShell }> {
  const brand = await fetchTenantBrand(tenantId);
  const derived = buildBrandDerivedShell(brand);
  try {
    const r = await pool.query<TenantShellRow>(
      `SELECT shell_html, logo_html, header_bg, footer_html
         FROM tenant_email_shells WHERE tenant_id = $1`,
      [tenantId],
    );
    const row = r.rows[0];
    return {
      overrides: {
        shellHtml: row?.shell_html ?? null,
        logoHtml: row?.logo_html ?? null,
        headerBg: row?.header_bg ?? null,
        footerHtml: row?.footer_html ?? null,
      },
      derived,
    };
  } catch (err) {
    console.error("[tenantEmailShell] overrides load failed:", err);
    return {
      overrides: { shellHtml: null, logoHtml: null, headerBg: null, footerHtml: null },
      derived,
    };
  }
}

/** Bust the cache after a save so edits go live immediately. */
export function bustTenantEmailShellCache(tenantId?: number): void {
  if (tenantId == null) {
    cache.clear();
  } else {
    cache.delete(tenantId);
  }
  generation += 1;
}
