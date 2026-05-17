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
  senderName: string;                 // From-header display name
  senderLocalPart: string;            // local part of sending address
  sendingDomain: string;              // verified domain (e.g. ent.meetdandy.com)
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
  isReadyToSend: boolean;
}

export function summarizeSalesBrandSetup(ctx: SalesBrandContext): SalesBrandSetupChecklist {
  const hasSendingDomain = ctx.sendingDomain.length > 0;
  const hasReplyTo = ctx.replyTo.length > 0;
  const hasSenderName = ctx.senderName.length > 0;
  const hasValuePropPairs = ctx.valuePropPairs.length > 0;
  return {
    hasSendingDomain,
    hasReplyTo,
    hasSenderName,
    hasValuePropPairs,
    // Must be able to address the envelope before send is allowed.
    isReadyToSend: hasSendingDomain && hasReplyTo && hasSenderName,
  };
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
  const brand  = (config["brand"] ?? {}) as Record<string, unknown>;

  // Brand name fallback: salesConsole.senderName → brand.companyName → "".
  const brandName = asString(sales["senderName"])
    || asString(brand["companyName"])
    || asString(brand["name"])
    || "";

  return {
    tenantId,
    brandName,
    senderName:             asString(sales["senderName"]),
    senderLocalPart:        asString(sales["senderLocalPart"]),
    sendingDomain:          asString(sales["sendingDomain"]),
    replyTo:                asString(sales["replyTo"]),
    notificationsLocalPart: asString(sales["notificationsLocalPart"], "notifications"),
    emailSignature:         asString(sales["emailSignature"]),
    emailFooter:            asString(sales["emailFooter"]),
    salesIntroLine:         asString(sales["salesIntroLine"]),
    briefBlurb:             asString(sales["briefBlurb"]),
    useBuiltInExemplars:    asBool(sales["useBuiltInExemplars"], false),
    customerNameRules:      asString(sales["customerNameRules"]),
    valuePropPairs:         asValuePropPairs(sales["valuePropPairs"]),
  };
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
