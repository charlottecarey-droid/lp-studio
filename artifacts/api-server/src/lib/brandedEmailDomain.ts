/**
 * Branded email subdomain provisioning (Tier 2 sending domain).
 *
 * Paid tenants (plans with the `brandedEmailSubdomain` feature) get an
 * auto-provisioned `{slug}.lpstudio.ai` sending domain. Unlike the Tier 3
 * bring-your-own custom domain (where the tenant edits their own DNS), the
 * subdomain lives under OUR `lpstudio.ai` Cloudflare zone, so we publish the
 * SPF/DKIM/MX records ourselves and the tenant never touches DNS.
 *
 * Flow:
 *   1. Register `{slug}.lpstudio.ai` in Resend → get back the DNS records.
 *   2. Write each returned record into the Cloudflare `lpstudio.ai` zone.
 *   3. Persist the Resend domain id + created CF record ids on the tenant's
 *      salesConsole config (done by the route, not here).
 *   4. Resend verifies asynchronously (minutes). Until verified, the tenant
 *      keeps sending from the Tier 1 shared default — the sender resolver
 *      fail-closes on the live Resend status.
 *
 * Rollback: if any CF record write fails mid-provision, every record created
 * so far is deleted AND the Resend domain is removed, so a half-provisioned
 * state never leaks external resources.
 */

import {
  createDnsRecord,
  deleteDnsRecord,
  findDnsRecordsByName,
  type DnsRecordInput,
} from "./cloudflare";
import {
  createResendDomain,
  deleteResendDomain,
  type ResendDnsRecord,
  type ResendDomain,
} from "./resendDomainStatus";

/** Default local part used for the From address on a branded subdomain when
 * the tenant hasn't set their own sender local part. */
export const BRANDED_SUBDOMAIN_DEFAULT_LOCAL_PART = "hello";

export class BrandedEmailDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BrandedEmailDomainError";
  }
}

/**
 * Build the branded subdomain host for a tenant slug under the given zone.
 * Validates the slug is a single DNS label (lowercase letters, digits,
 * hyphens; no leading/trailing hyphen) so we never hand Cloudflare/Resend a
 * malformed name.
 */
export function buildBrandedSubdomainHost(slug: string, zoneName: string): string {
  const s = (slug ?? "").trim().toLowerCase();
  const zone = (zoneName ?? "").trim().toLowerCase().replace(/\.$/, "");
  if (!zone) throw new BrandedEmailDomainError("zone name unavailable");
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(s)) {
    throw new BrandedEmailDomainError(`invalid slug for subdomain: "${slug}"`);
  }
  return `${s}.${zone}`;
}

/** Strip a single pair of wrapping double-quotes (Resend quotes TXT values). */
function unquote(value: string): string {
  const v = value.trim();
  if (v.length >= 2 && v.startsWith('"') && v.endsWith('"')) {
    return v.slice(1, -1);
  }
  return v;
}

/**
 * Convert the relative-named records Resend returns into fully-qualified
 * Cloudflare DNS record inputs rooted at `host`. Resend names are relative to
 * the registered domain (e.g. `send`, `resend._domainkey`) or empty/`@` for
 * the apex; TXT values may arrive wrapped in quotes Cloudflare doesn't want.
 */
export function mapResendRecordsToCfInputs(
  records: ResendDnsRecord[],
  host: string,
): DnsRecordInput[] {
  const root = host.trim().toLowerCase().replace(/\.$/, "");
  const out: DnsRecordInput[] = [];
  for (const rec of records) {
    const type = (rec.type ?? "").trim().toUpperCase();
    const rawValue = (rec.value ?? "").trim();
    if (!type || !rawValue) continue;
    const rel = (rec.name ?? "").trim().toLowerCase().replace(/\.$/, "");
    let name: string;
    if (!rel || rel === "@" || rel === root) {
      name = root;
    } else if (rel.endsWith(`.${root}`)) {
      name = rel;
    } else {
      name = `${rel}.${root}`;
    }
    const content = type === "TXT" ? unquote(rawValue) : rawValue;
    const input: DnsRecordInput = { type, name, content };
    if (type === "MX" && typeof rec.priority === "number") {
      input.priority = rec.priority;
    }
    out.push(input);
  }
  return out;
}

export interface BrandedEmailProvisionResult {
  resendId: string;
  host: string;
  /** Cloudflare record ids created for this subdomain (for later teardown). */
  dnsRecordIds: string[];
  /** Resend's current verification status at registration time. */
  status: ResendDomain["status"];
  /** The DNS records that were published (for display/debugging). */
  records: ResendDnsRecord[];
}

/**
 * Register the subdomain in Resend and publish its DNS records into the
 * Cloudflare zone. Rolls back (deletes created CF records + the Resend domain)
 * if any step fails, then throws. Never leaves a partial provision behind.
 */
export async function provisionBrandedEmailDomain(
  host: string,
): Promise<BrandedEmailProvisionResult> {
  const created = await createResendDomain(host);
  if (!created.available || !created.domain) {
    throw new BrandedEmailDomainError(
      created.error ? `Resend registration failed: ${created.error}` : "Resend registration failed",
    );
  }
  const domain = created.domain;
  const inputs = mapResendRecordsToCfInputs(domain.records, host);
  const recordIds: string[] = [];
  try {
    for (const input of inputs) {
      const rec = await createDnsRecord(input);
      recordIds.push(rec.id);
    }
  } catch (cfErr) {
    // Roll back: remove any CF records we already created, then drop the
    // Resend domain so nothing leaks. Best-effort — surface the ORIGINAL
    // error regardless of rollback outcome.
    for (const id of recordIds) {
      try {
        await deleteDnsRecord(id);
      } catch (rbErr) {
        console.error("[brandedEmailDomain] rollback deleteDnsRecord failed:", rbErr);
      }
    }
    try {
      await deleteResendDomain(domain.id);
    } catch (rbErr) {
      console.error("[brandedEmailDomain] rollback deleteResendDomain failed:", rbErr);
    }
    throw cfErr instanceof Error
      ? cfErr
      : new BrandedEmailDomainError("Cloudflare DNS provisioning failed");
  }

  return {
    resendId: domain.id,
    host,
    dnsRecordIds: recordIds,
    status: domain.status,
    records: domain.records,
  };
}

/**
 * Tear down a provisioned branded subdomain: delete the published CF DNS
 * records (by stored id, falling back to name lookup) and remove the Resend
 * domain. Continues past individual failures so a one-sided leak can still be
 * cleaned up; throws an aggregate only if something genuinely failed.
 */
export async function deprovisionBrandedEmailDomain(args: {
  host: string;
  resendId: string | null;
  dnsRecordIds: string[];
}): Promise<void> {
  const { host, resendId, dnsRecordIds } = args;
  const errors: unknown[] = [];

  if (dnsRecordIds.length > 0) {
    for (const id of dnsRecordIds) {
      try {
        await deleteDnsRecord(id);
      } catch (err) {
        errors.push(err);
      }
    }
  } else if (host) {
    // No stored ids (older/partial state) — find email records by name and
    // remove them so we don't leak SPF/DKIM/MX under the subdomain.
    try {
      const names = [host, `send.${host}`, `resend._domainkey.${host}`, `_dmarc.${host}`];
      for (const name of names) {
        const recs = await findDnsRecordsByName(name);
        for (const r of recs) await deleteDnsRecord(r.id);
      }
    } catch (err) {
      errors.push(err);
    }
  }

  if (resendId) {
    try {
      const res = await deleteResendDomain(resendId);
      if (!res.available && res.error) errors.push(new BrandedEmailDomainError(res.error));
    } catch (err) {
      errors.push(err);
    }
  }

  if (errors.length) {
    const first = errors[0];
    if (first instanceof Error) throw first;
    throw new BrandedEmailDomainError("branded email deprovisioning failed");
  }
}
