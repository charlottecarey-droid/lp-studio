/**
 * Per-tenant Sales Console configuration.
 *
 * All sales-related branding (sender name, sending domain, reply-to,
 * cold-email opener, value-prop pairs, etc.) lives on
 * lp_brand_settings.config.salesConsole as a JSON blob. This helper
 * reads that blob for a given tenant and returns a typed view, falling
 * back to safe empty defaults for tenants that haven't configured the
 * Sales Console yet.
 *
 * IMPORTANT: defaults are intentionally empty / brand-neutral — they
 * never leak "Dandy" or any other tenant's strings. Dandy's behavior
 * is preserved because migration 0020 seeds tenant 1 with the values
 * that were previously hardcoded throughout the codebase.
 */
import { eq } from "drizzle-orm";
import { db, lpBrandSettingsTable } from "@workspace/db";

export interface ValuePropPair {
  roles: string[];
  theme: string;
  pain: string;
  proof: string;
}

export interface SalesBrandContext {
  tenantId: number;
  brandName: string;                  // e.g. "Dandy" or company name
  /** First non-empty entry from brand.taglines — empty when unset. */
  tagline: string;
  /** Flat list of brand.taglines (drops empties). */
  taglines: string[];
  /** Brand-level default CTA URL (brand.defaultCtaUrl) — empty when unset. */
  defaultCtaUrl: string;
  /** Chili Piper URL from brand config — empty when unset. */
  chilipiperUrl: string;
  senderName: string;                 // From-header display name
  senderLocalPart: string;            // local part of sending address
  sendingDomain: string;              // verified domain (e.g. ent.meetdandy.com)
  /**
   * Tier 2 auto-provisioned branded sending subdomain (e.g.
   * mail.<slug>.lpstudio.ai). Empty when not provisioned. Routing fails
   * closed: the resolver only sends from it once Resend reports it verified,
   * and a verified custom `sendingDomain` (Tier 3) takes precedence.
   */
  brandedEmailSubdomain: string;
  replyTo: string;                    // reply-to address
  notificationsLocalPart: string;     // local part for visit-alert emails
  emailSignature: string;
  emailFooter: string;
  salesIntroLine: string;             // first line of draft-email system prompt
  briefBlurb: string;                 // parenthetical after brand name in person-brief
  useBuiltInExemplars: boolean;       // gate the hardcoded Dandy microsite exemplars
  customerNameRules: string;          // optional inline customer naming rules
  valuePropPairs: ValuePropPair[];
}

export interface SalesBrandSetupChecklist {
  hasSendingDomain: boolean;
  hasReplyTo: boolean;
  hasValuePropPairs: boolean;
  hasSenderName: boolean;
  hasSenderLocalPart: boolean;
  isReadyToSend: boolean;
}

export function summarizeSalesBrandSetup(ctx: SalesBrandContext): SalesBrandSetupChecklist {
  // Trim before length-checking so whitespace-only values (which the UI
  // also treats as missing) never count as "configured" on the server.
  const hasSendingDomain = ctx.sendingDomain.trim().length > 0;
  const hasReplyTo = ctx.replyTo.trim().length > 0;
  const hasSenderName = ctx.senderName.trim().length > 0;
  const hasSenderLocalPart = ctx.senderLocalPart.trim().length > 0;
  // A pair only counts when its theme has real content — an empty
  // theme leaves the AI with nothing to anchor a draft on, and the UI
  // hides such pairs from the checklist as well.
  const hasValuePropPairs = ctx.valuePropPairs.some(
    p => typeof p?.theme === "string" && p.theme.trim().length > 0,
  );
  return {
    hasSendingDomain,
    hasReplyTo,
    hasSenderName,
    hasSenderLocalPart,
    hasValuePropPairs,
    // Must be able to address the envelope before send is allowed —
    // a missing local part means buildFromHeader() returns null too.
    isReadyToSend: hasSendingDomain && hasReplyTo && hasSenderName && hasSenderLocalPart,
  };
}

/**
 * Render the same "missing items" sentence the brand-settings UI shows
 * under "Saved status on the server", so backend tests can lock down
 * the exact human-readable string and catch UI/server drift.
 */
export function formatSalesBrandSetupSummary(checklist: SalesBrandSetupChecklist): string {
  const missing = [
    checklist.hasSenderName ? null : "sender name",
    checklist.hasSenderLocalPart ? null : "sender local part",
    checklist.hasSendingDomain ? null : "sending domain",
    checklist.hasReplyTo ? null : "reply-to",
    checklist.hasValuePropPairs ? null : "value-prop pairs",
  ].filter((s): s is string => !!s);
  return missing.length === 0 ? "all essentials saved" : missing.join(", ");
}

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}
function asBool(v: unknown, fallback = false): boolean {
  return typeof v === "boolean" ? v : fallback;
}
function asValuePropPairs(v: unknown): ValuePropPair[] {
  if (!Array.isArray(v)) return [];
  return v
    .map(item => {
      if (!item || typeof item !== "object") return null;
      const obj = item as Record<string, unknown>;
      // Accept either `roles: string[]` (new shape) or `role: string`
      // (legacy/seed shape) — normalize to roles[].
      const rawRoles = obj["roles"];
      const rawRole = obj["role"];
      const roles = Array.isArray(rawRoles)
        ? rawRoles.filter((r): r is string => typeof r === "string" && r.length > 0)
        : (typeof rawRole === "string" && rawRole.length > 0
            ? rawRole.split(/\s*[/,]\s*/).filter(Boolean)
            : []);
      return {
        roles,
        theme: asString(obj["theme"]),
        pain:  asString(obj["pain"]),
        proof: asString(obj["proof"]),
      } as ValuePropPair;
    })
    .filter((p): p is ValuePropPair => !!p && p.theme.length > 0);
}

/**
 * Load the Sales Console context for a tenant. Always returns a value
 * — never throws on missing config — so callers can render UI / build
 * prompts without try/catch noise.
 */
export async function getSalesBrandContext(tenantId: number): Promise<SalesBrandContext> {
  const [row] = await db.select({ config: lpBrandSettingsTable.config })
    .from(lpBrandSettingsTable)
    .where(eq(lpBrandSettingsTable.tenantId, tenantId))
    .limit(1);

  const config = (row?.config ?? {}) as Record<string, unknown>;
  const sales  = (config["salesConsole"] ?? {}) as Record<string, unknown>;
  // lp_brand_settings.config may store brand fields at the top level
  // (lp-studio BrandConfig shape) OR nested under "brand". Read both so
  // callers see brand strings regardless of how the row was written.
  const nestedBrand = (config["brand"] ?? {}) as Record<string, unknown>;
  const brandTop = config;

  const pickBrandStr = (key: string): string =>
    asString(nestedBrand[key]) || asString(brandTop[key]);

  // Brand name fallback: salesConsole.senderName → brand.brandName /
  // companyName / name → "".
  const brandName = asString(sales["senderName"])
    || pickBrandStr("brandName")
    || pickBrandStr("companyName")
    || pickBrandStr("name")
    || "";

  const rawTaglines = (nestedBrand["taglines"] ?? brandTop["taglines"]) as unknown;
  const taglines = Array.isArray(rawTaglines)
    ? rawTaglines.filter((t): t is string => typeof t === "string" && t.trim().length > 0)
    : [];

  // Value-prop fallback chain: salesConsole.valuePropPairs (explicit) →
  // derived from brand-level config (messagingPillars / productLines /
  // segments) so a tenant who has set up brand config but not the Sales
  // Console still gets brand-aware fallback copy in microsites and
  // emails — never empty arrays that force literal-Dandy defaults.
  let valuePropPairs = asValuePropPairs(sales["valuePropPairs"]);
  if (valuePropPairs.length === 0) {
    valuePropPairs = deriveValuePropsFromBrand(nestedBrand, brandTop);
  }

  return {
    tenantId,
    brandName,
    tagline: taglines[0] ?? "",
    taglines,
    defaultCtaUrl: pickBrandStr("defaultCtaUrl"),
    chilipiperUrl: pickBrandStr("chilipiperUrl"),
    senderName:             asString(sales["senderName"]),
    senderLocalPart:        asString(sales["senderLocalPart"]),
    sendingDomain:          asString(sales["sendingDomain"]),
    brandedEmailSubdomain:  asString(sales["brandedEmailSubdomain"]),
    replyTo:                asString(sales["replyTo"]),
    notificationsLocalPart: asString(sales["notificationsLocalPart"], "notifications"),
    emailSignature:         asString(sales["emailSignature"]),
    emailFooter:            asString(sales["emailFooter"]),
    salesIntroLine:         asString(sales["salesIntroLine"]),
    briefBlurb:             asString(sales["briefBlurb"]),
    useBuiltInExemplars:    asBool(sales["useBuiltInExemplars"], false),
    customerNameRules:      asString(sales["customerNameRules"]),
    valuePropPairs,
  };
}

/**
 * Derive ValuePropPair entries from the tenant's brand-level config when
 * no salesConsole.valuePropPairs are set. Pulls from (in priority order):
 *   1. brand.messagingPillars — { label, description }
 *   2. brand.productLines[].valueProps + product name
 *   3. brand.segments[].valueProps + segment name
 *
 * Capped at 6 entries. Returns an empty array if nothing usable exists.
 */
function deriveValuePropsFromBrand(
  nestedBrand: Record<string, unknown>,
  brandTop: Record<string, unknown>,
): ValuePropPair[] {
  const out: ValuePropPair[] = [];
  const seenThemes = new Set<string>();
  const addPair = (theme: string, proof: string) => {
    const t = theme.trim();
    if (!t || seenThemes.has(t.toLowerCase()) || out.length >= 6) return;
    seenThemes.add(t.toLowerCase());
    out.push({ roles: [], theme: t, pain: "", proof: proof.trim() });
  };

  const pillars = (nestedBrand["messagingPillars"] ?? brandTop["messagingPillars"]) as unknown;
  if (Array.isArray(pillars)) {
    for (const p of pillars) {
      if (!p || typeof p !== "object") continue;
      const obj = p as Record<string, unknown>;
      addPair(asString(obj["label"]), asString(obj["description"]));
    }
  }

  const productLines = (nestedBrand["productLines"] ?? brandTop["productLines"]) as unknown;
  if (Array.isArray(productLines) && out.length < 6) {
    for (const p of productLines) {
      if (!p || typeof p !== "object") continue;
      const obj = p as Record<string, unknown>;
      const name = asString(obj["name"]);
      const vps = obj["valueProps"];
      if (Array.isArray(vps)) {
        for (const v of vps) {
          if (typeof v === "string") addPair(name || v, v);
        }
      }
    }
  }

  const segments = (nestedBrand["segments"] ?? brandTop["segments"]) as unknown;
  if (Array.isArray(segments) && out.length < 6) {
    for (const s of segments) {
      if (!s || typeof s !== "object") continue;
      const obj = s as Record<string, unknown>;
      const name = asString(obj["name"]);
      const vps = obj["valueProps"];
      if (Array.isArray(vps)) {
        for (const v of vps) {
          if (typeof v === "string") addPair(name || v, v);
        }
      }
    }
  }

  return out;
}

/**
 * Render the from-header envelope address. Returns null if the tenant
 * hasn't set sending fields yet — callers should refuse to send in
 * that case rather than fall back to another tenant's domain.
 */
export function buildFromHeader(ctx: SalesBrandContext): string | null {
  if (!ctx.senderName || !ctx.senderLocalPart || !ctx.sendingDomain) return null;
  return `${ctx.senderName} <${ctx.senderLocalPart}@${ctx.sendingDomain}>`;
}

/**
 * Render the notifications-from address (visit alerts etc.). Returns
 * null when the tenant has no sending domain configured.
 */
export function buildNotificationsFrom(ctx: SalesBrandContext): string | null {
  if (!ctx.sendingDomain) return null;
  const local = ctx.notificationsLocalPart || "notifications";
  const display = ctx.senderName || "LP Studio";
  return `${display} <${local}@${ctx.sendingDomain}>`;
}
