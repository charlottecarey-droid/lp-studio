/**
 * Tenant default email sender resolution.
 *
 * Every tenant must be able to send branded email immediately — before any
 * operator adds their domain to Resend and before they touch DNS. This module
 * resolves the effective from / reply-to envelope for a tenant:
 *
 *   Tier 1 (all plans, zero setup): when the tenant has no VERIFIED custom
 *     sending domain, send as `{Brand Name} <{slug}@mail.lpstudio.ai>` with a
 *     reply-to of the tenant's configured replyTo (falling back to the
 *     workspace owner's email). `mail.lpstudio.ai` is already verified in
 *     Resend, so any local part under it sends with no new setup.
 *
 *   Custom domain: when the tenant HAS configured a sending domain AND Resend
 *     reports it `verified`, send from that domain (sales uses the sender
 *     local part, notifications use the notifications local part), preserving
 *     existing behavior.
 *
 * FAIL CLOSED: an unverified (or unverifiable) custom domain NEVER sends —
 * we fall back to the Tier 1 shared default instead. The resolver also never
 * borrows another tenant's domain: the only non-tenant domain it ever emits
 * is the shared, account-wide `mail.lpstudio.ai`.
 *
 * The pure `buildSenderIdentity` core takes every input explicitly so it is
 * unit-testable without a DB or the Resend API; `resolveTenantSender` is the
 * thin async wrapper that gathers the inputs (brand context, slug, owner
 * email, verification status) and delegates to it.
 */

import { pool } from "@workspace/db";
import { getSalesBrandContext, type SalesBrandContext } from "./salesBrandContext";
import { getResendDomainStatus } from "./resendDomainStatus";
import { logger } from "./logger";

/**
 * The shared, already-verified sending domain every tenant can send under
 * with zero setup. Any local part below it is deliverable.
 */
export const SHARED_SENDING_DOMAIN = "mail.lpstudio.ai";

/**
 * The platform apex zone, derived from the shared sending domain
 * (`mail.lpstudio.ai` → `lpstudio.ai`). Tier 2 branded subdomains live under
 * this apex so we can publish their DNS into our own Cloudflare zone.
 */
export const PLATFORM_APEX = SHARED_SENDING_DOMAIN.split(".").slice(1).join(".");

/**
 * Derive the Tier 2 branded sending subdomain for a tenant:
 * `mail.<label>.<apex>` (e.g. `mail.acme.lpstudio.ai`). The label is a safe,
 * single DNS label sanitized from the slug (lowercase [a-z0-9-], no dots,
 * trimmed hyphens, ≤63 chars), falling back to `tenant-{id}` so the result is
 * always a valid, unique hostname.
 */
export function deriveBrandedSubdomain(slug: string | null | undefined, tenantId: number): string {
  let label = clean(slug)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!label) label = `tenant-${tenantId}`;
  if (label.length > 63) label = label.slice(0, 63).replace(/-+$/g, "");
  return `mail.${label}.${PLATFORM_APEX}`;
}

export type SenderKind = "sales" | "notifications";

/**
 * Per-call overrides (e.g. a campaign's stored senderName / senderEmail /
 * replyTo). `senderLocalPart` is only honored on a VERIFIED custom domain —
 * the shared default always uses the slug-derived local part so we never emit
 * an arbitrary local part under the shared domain.
 */
export interface SenderOverrides {
  senderName?: string | null;
  senderLocalPart?: string | null;
  replyTo?: string | null;
}

export interface ResolvedSender {
  /** Display-name form ready for Resend's `from`: `Name <local@domain>`. */
  from: string;
  /** Reply-to address; omit the key entirely when undefined. */
  replyTo?: string;
  /** The domain the mail is sent from. */
  domain: string;
  /** True when sending from the tenant's verified custom domain. */
  usingCustomDomain: boolean;
}

function clean(v: string | null | undefined): string {
  return (v ?? "").trim();
}

/**
 * Derive a safe, RFC-5321-valid local part from a tenant slug (brand-name
 * fallback). Lowercases, keeps only [a-z0-9.-], collapses repeats, and trims
 * leading/trailing dots & hyphens. Falls back to `tenant-{id}` when nothing
 * usable remains, so the result is always a non-empty, deliverable local part.
 *
 * Slugs are already unique and constrained to lowercase alphanumerics +
 * hyphens, so the sanitized result is collision-safe in practice; the
 * `tenant-{id}` fallback guarantees uniqueness for any degenerate slug.
 */
export function deriveSlugLocalPart(slug: string | null | undefined, tenantId: number): string {
  const local = clean(slug)
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/[.-]{2,}/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "");
  return local || `tenant-${tenantId}`;
}

/**
 * Pure sender-identity resolution. No I/O — every dependency is passed in so
 * this is fully unit-testable. See module docs for the tiering rules.
 */
export function buildSenderIdentity(args: {
  kind: SenderKind;
  ctx: Pick<
    SalesBrandContext,
    "brandName" | "senderName" | "senderLocalPart" | "sendingDomain" | "replyTo" | "notificationsLocalPart"
  >;
  slug: string | null | undefined;
  tenantId: number;
  /** Whether the configured custom sending domain is verified in Resend. */
  customDomainVerified: boolean;
  /** Workspace owner email — the Tier 1 reply-to fallback. */
  ownerEmail?: string | null;
  overrides?: SenderOverrides;
}): ResolvedSender {
  const { kind, ctx, slug, tenantId, customDomainVerified } = args;
  const ov = args.overrides ?? {};

  const displayName =
    clean(ov.senderName) || clean(ctx.senderName) || clean(ctx.brandName) || "LP Studio";

  const customDomain = clean(ctx.sendingDomain).toLowerCase();

  // Custom domain path — only when configured AND verified (fail closed).
  if (customDomain && customDomainVerified) {
    const localPart =
      kind === "sales"
        ? clean(ov.senderLocalPart) || clean(ctx.senderLocalPart)
        : clean(ctx.notificationsLocalPart) || "notifications";
    if (localPart) {
      const replyTo = clean(ov.replyTo) || clean(ctx.replyTo) || undefined;
      return {
        from: `${displayName} <${localPart}@${customDomain}>`,
        ...(replyTo ? { replyTo } : {}),
        domain: customDomain,
        usingCustomDomain: true,
      };
    }
  }

  // Tier 1 shared default — works for every tenant with no setup.
  const local = deriveSlugLocalPart(slug, tenantId);
  const replyTo = clean(ov.replyTo) || clean(ctx.replyTo) || clean(args.ownerEmail) || undefined;
  return {
    from: `${displayName} <${local}@${SHARED_SENDING_DOMAIN}>`,
    ...(replyTo ? { replyTo } : {}),
    domain: SHARED_SENDING_DOMAIN,
    usingCustomDomain: false,
  };
}

/** A tenant's slug, or null when the row is missing. */
export async function getTenantSlug(tenantId: number): Promise<string | null> {
  try {
    const r = await pool.query<{ slug: string | null }>(
      `SELECT slug FROM tenants WHERE id = $1`,
      [tenantId],
    );
    return r.rows[0]?.slug ?? null;
  } catch (err) {
    logger.warn({ err, tenantId }, "getTenantSlug failed");
    return null;
  }
}

/**
 * Resolve the workspace owner's email — the earliest-accepted admin member —
 * used as the Tier 1 reply-to fallback when the tenant hasn't set one.
 * Prefers the linked app_user's email, falling back to the invite email.
 * Returns null when no admin member exists or the query fails.
 */
export async function getTenantOwnerEmail(tenantId: number): Promise<string | null> {
  try {
    const r = await pool.query<{ email: string | null }>(
      `SELECT COALESCE(u.email, tm.email) AS email
         FROM tenant_members tm
         JOIN tenant_roles tr ON tr.id = tm.role_id
         LEFT JOIN app_users u ON u.id = tm.user_id
        WHERE tm.tenant_id = $1
          AND tr.is_admin = true
          AND tm.accepted_at IS NOT NULL
        ORDER BY tm.accepted_at ASC
        LIMIT 1`,
      [tenantId],
    );
    const email = clean(r.rows[0]?.email);
    return email || null;
  } catch (err) {
    logger.warn({ err, tenantId }, "getTenantOwnerEmail failed");
    return null;
  }
}

/**
 * Resolve the effective sender envelope for a tenant. Always returns a usable
 * `from` (falling back to the Tier 1 shared default), so callers can send
 * without their own "is the tenant configured?" guard.
 *
 * @param ctx     optional pre-loaded brand context (avoids a second query).
 * @param overrides per-call sender overrides (campaign metadata, etc).
 */
export async function resolveTenantSender(
  tenantId: number,
  kind: SenderKind,
  opts: { ctx?: SalesBrandContext; overrides?: SenderOverrides } = {},
): Promise<ResolvedSender> {
  const ctx = opts.ctx ?? (await getSalesBrandContext(tenantId));

  const customDomain = clean(ctx.sendingDomain).toLowerCase();          // Tier 3
  const brandedSubdomain = clean(ctx.brandedEmailSubdomain).toLowerCase(); // Tier 2

  const isVerified = async (domain: string): Promise<boolean> => {
    try {
      const status = await getResendDomainStatus(tenantId, domain);
      return status.status === "verified";
    } catch (err) {
      // Couldn't verify → fail closed to the shared default.
      logger.warn({ err, tenantId, domain }, "resolveTenantSender: domain status check failed");
      return false;
    }
  };

  // Precedence: a verified custom domain (Tier 3) wins; otherwise a verified
  // branded subdomain (Tier 2); otherwise the Tier 1 shared default. We never
  // emit an unverified domain — fail closed at every step.
  let activeDomain = "";
  let usingBranded = false;
  if (customDomain && (await isVerified(customDomain))) {
    activeDomain = customDomain;
  } else if (brandedSubdomain && (await isVerified(brandedSubdomain))) {
    activeDomain = brandedSubdomain;
    usingBranded = true;
  }

  const needsSharedDefault = !activeDomain;
  // Slug is needed for the shared-default local part AND for the branded
  // subdomain's sales local-part default. Owner email only when we have no
  // configured reply-to to fall back on. Fetch lazily/conditionally.
  const slug = needsSharedDefault || usingBranded ? await getTenantSlug(tenantId) : null;
  const ownerEmail =
    needsSharedDefault && !clean(opts.overrides?.replyTo) && !clean(ctx.replyTo)
      ? await getTenantOwnerEmail(tenantId)
      : null;

  // Present the chosen domain to the pure builder via ctx.sendingDomain so its
  // verified-custom-domain branch handles both Tier 2 and Tier 3 uniformly.
  const effectiveCtx = activeDomain && activeDomain !== customDomain
    ? { ...ctx, sendingDomain: activeDomain }
    : ctx;

  // The branded subdomain is zero-config, so give it a sensible sales local
  // part (the slug) when the tenant hasn't set one — otherwise the builder's
  // "no usable local part" guard would drop sales mail back to the shared
  // default. (Notifications already default to "notifications".)
  let overrides = opts.overrides;
  if (usingBranded && kind === "sales" && !clean(overrides?.senderLocalPart) && !clean(ctx.senderLocalPart)) {
    overrides = { ...(overrides ?? {}), senderLocalPart: deriveSlugLocalPart(slug, tenantId) };
  }

  return buildSenderIdentity({
    kind,
    ctx: effectiveCtx,
    slug,
    tenantId,
    customDomainVerified: !!activeDomain,
    ownerEmail,
    ...(overrides ? { overrides } : {}),
  });
}
