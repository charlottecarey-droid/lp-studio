/**
 * Snapshot-layer test for the domain-gated "Sent by" provenance footer
 * (task #635). The published snapshot is rendered ONCE in its maximal footer
 * state and then copied to one R2 object per host the tenant owns; this layer
 * strips the `[data-lp-provenance]` band per host so each stored variant
 * matches the LIVE rule for the host it is served on.
 *
 * Mirrors provenanceDomainGate.integration.test.ts (the live-path matrix) but
 * at the snapshot layer:
 *   - Tenant with a custom domain + shared subdomain: the SAME baked microsite
 *     snapshot keeps the footer on its `<slug>.lpstudio.ai` variant and has it
 *     stripped on the custom-domain variant (proves host-gating, not
 *     tenant-gating).
 *   - Regular landing pages (no target account) and the Dandy tenant never
 *     keep the footer on any host.
 */
import { describe, it, expect } from "vitest";
import {
  shouldShowProvenanceFooterOnHost,
  stripProvenanceFooter,
  applyProvenanceFooterForHost,
} from "./provenanceFooter";
import { WILDCARD_BASE_HOSTS } from "./tenantHosts";

const BASE = WILDCARD_BASE_HOSTS[0] ?? "lpstudio.ai";

/** The exact band the SPA's ProvenanceBanner renders (data-lp-provenance="1"). */
const FOOTER_BAND =
  '<div data-lp-provenance="1" class="w-full border-t"><span>Sent by ' +
  '<span class="font-semibold">Acme Co</span> for ' +
  '<span class="font-semibold">Target Account</span></span></div>';

/** A minimal baked snapshot with the footer present (maximal state). */
function bakedWithFooter(): string {
  return (
    "<!DOCTYPE html><html><head><title>Page</title></head><body>" +
    '<div id="root"><div data-lp-page><section>Hero</section>' +
    FOOTER_BAND +
    "</div></div></body></html>"
  );
}

const hasFooter = (html: string): boolean => /data-lp-provenance/.test(html);

describe("stripProvenanceFooter", () => {
  it("removes the band when present", () => {
    const out = stripProvenanceFooter(bakedWithFooter());
    expect(hasFooter(out)).toBe(false);
    // Surrounding content is preserved.
    expect(out).toContain("<section>Hero</section>");
    expect(out).toContain("</body></html>");
  });

  it("is a no-op when the band is absent", () => {
    const noFooter = "<html><body><div data-lp-page>x</div></body></html>";
    expect(stripProvenanceFooter(noFooter)).toBe(noFooter);
  });

  it("handles a nested <div> inside the band via balanced matching", () => {
    const nested =
      '<body><section>Keep</section><div data-lp-provenance="1">' +
      "<div>nested</div>Sent by Acme</div><footer>After</footer></body>";
    const out = stripProvenanceFooter(nested);
    expect(hasFooter(out)).toBe(false);
    expect(out).toContain("<section>Keep</section>");
    expect(out).toContain("<footer>After</footer>");
    expect(out).not.toContain("nested");
  });
});

describe("shouldShowProvenanceFooterOnHost", () => {
  const slug = "acme";
  const sharedHost = `${slug}.${BASE}`;
  const customDomain = "acme.example.com";

  it("shows for a microsite on the default shared host", () => {
    expect(
      shouldShowProvenanceFooterOnHost({ accountId: 7, tenantSlug: slug, host: sharedHost }),
    ).toBe(true);
  });

  it("hides for a microsite on the tenant's own custom domain", () => {
    expect(
      shouldShowProvenanceFooterOnHost({ accountId: 7, tenantSlug: slug, host: customDomain }),
    ).toBe(false);
  });

  it("hides for a regular landing page (no target account) on the shared host", () => {
    expect(
      shouldShowProvenanceFooterOnHost({ accountId: null, tenantSlug: slug, host: sharedHost }),
    ).toBe(false);
  });

  it("hides for the Dandy tenant even on the shared host", () => {
    expect(
      shouldShowProvenanceFooterOnHost({ accountId: 7, tenantSlug: "dandy", host: `dandy.${BASE}` }),
    ).toBe(false);
  });
});

describe("applyProvenanceFooterForHost — custom-domain + shared-subdomain matrix", () => {
  const slug = "acme";
  const sharedHost = `${slug}.${BASE}`;
  const customDomain = "acme.example.com";

  it("keeps the footer on the shared-subdomain snapshot of a microsite", () => {
    const out = applyProvenanceFooterForHost(bakedWithFooter(), {
      accountId: 7,
      tenantSlug: slug,
      host: sharedHost,
    });
    expect(hasFooter(out)).toBe(true);
  });

  it("strips the footer on the custom-domain snapshot of the SAME microsite", () => {
    const out = applyProvenanceFooterForHost(bakedWithFooter(), {
      accountId: 7,
      tenantSlug: slug,
      host: customDomain,
    });
    expect(hasFooter(out)).toBe(false);
  });

  it("strips the footer for a regular landing page on every host", () => {
    for (const host of [sharedHost, customDomain]) {
      const out = applyProvenanceFooterForHost(bakedWithFooter(), {
        accountId: null,
        tenantSlug: slug,
        host,
      });
      expect(hasFooter(out)).toBe(false);
    }
  });

  it("strips the footer for the Dandy tenant on every host", () => {
    for (const host of [`dandy.${BASE}`, "dandy.example.com"]) {
      const out = applyProvenanceFooterForHost(bakedWithFooter(), {
        accountId: 7,
        tenantSlug: "dandy",
        host,
      });
      expect(hasFooter(out)).toBe(false);
    }
  });
});
