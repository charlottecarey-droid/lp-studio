import { describe, expect, it } from "vitest";

import {
  legacyBlockPropsToCtaConfig,
  resolveCtaConfig,
  ctaConfigHasValue,
  type CtaConfig,
} from "./ctaConfig";

/**
 * Render-contract guard for backward compat. CtaButton is a pure function of
 * its props (it renders ChiliPiperButton / EmailCaptureButton / a <button>
 * straight from action + destination + the modal* fields). So if a legacy
 * block's props, after passing through the shim + resolver, yield the SAME
 * effective {action, url, chilipiper, modal*} the renderer reads today, the
 * form / Chili Piper / Marketo / tracking behavior is provably unchanged.
 *
 * This mirrors the exact resolution CtaButton performs:
 *   blockCta = legacyBlockPropsToCtaConfig(block.props)
 *   eff = ctaConfigHasValue(blockCta) ? blockCta : resolveCtaConfig(...)
 */
function effectiveFor(
  blockProps: Record<string, unknown>,
  ctx: { pageCta?: CtaConfig | null; tenantDefaultCta?: CtaConfig | null } = {},
): CtaConfig {
  const blockCta = legacyBlockPropsToCtaConfig("any", blockProps);
  const shouldInherit =
    !ctaConfigHasValue(blockCta) &&
    (ctaConfigHasValue(ctx.pageCta) || ctaConfigHasValue(ctx.tenantDefaultCta));
  return shouldInherit
    ? resolveCtaConfig({ tenantDefault: ctx.tenantDefaultCta, pageOverride: ctx.pageCta, blockOverride: blockCta })
    : blockCta;
}

describe("backward compat: a block with its OWN CTA is never altered by inheritance", () => {
  it("preserves a Chili Piper popup CTA's behavior verbatim (even with a page CTA present)", () => {
    const eff = effectiveFor(
      { ctaText: "Book now", ctaAction: "chilipiper", chilipiperUrl: "https://acme.chilipiper.com/r/x" },
      { pageCta: { label: "Page", action: "url", url: "https://page" }, tenantDefaultCta: { label: "T", action: "url", url: "https://t" } },
    );
    expect(eff.action).toBe("chilipiper");
    expect(eff.chilipiper).toBe("https://acme.chilipiper.com/r/x");
  });

  it("preserves a Marketo modal-form + Chili-Piper-handoff CTA exactly", () => {
    const legacy = {
      ctaLabel: "Get pricing",
      ctaAction: "modal-form",
      modalFormSource: "marketo",
      modalMarketoBaseUrl: "//acme.marketo.com",
      modalMarketoMunchkinId: "123-ABC-456",
      modalMarketoFormId: 99,
      modalChiliPiperHandoffUrl: "https://acme.chilipiper.com/r/handoff",
      modalChiliPiperHandoffMode: "redirect",
      modalChiliPiperHandoffFieldMap: { Email: "email" },
    };
    const eff = effectiveFor(legacy, { pageCta: { label: "Page CTA", action: "url", url: "https://page" } });
    // The renderer reads these exact fields — all preserved, inheritance skipped.
    expect(eff.action).toBe("modal-form");
    expect(eff.modalFormSource).toBe("marketo");
    expect(eff.modalMarketoBaseUrl).toBe("//acme.marketo.com");
    expect(eff.modalMarketoMunchkinId).toBe("123-ABC-456");
    expect(eff.modalMarketoFormId).toBe(99);
    expect(eff.modalChiliPiperHandoffUrl).toBe("https://acme.chilipiper.com/r/handoff");
    expect(eff.modalChiliPiperHandoffMode).toBe("redirect");
    expect(eff.modalChiliPiperHandoffFieldMap).toEqual({ Email: "email" });
  });

  it("preserves a plain URL CTA", () => {
    const eff = effectiveFor(
      { ctaText: "Pricing", ctaAction: "url", ctaUrl: "https://acme.com/pricing" },
      { pageCta: { label: "Page", action: "chilipiper", chilipiper: "https://cp" } },
    );
    expect(eff.action).toBe("url");
    expect(eff.url).toBe("https://acme.com/pricing");
  });
});

describe("inheritance only fires when the block has no CTA of its own", () => {
  it("a block with no action/destination inherits the page CTA", () => {
    const eff = effectiveFor(
      { ctaText: "", ctaAction: "url", ctaUrl: "" }, // empty CTA
      { pageCta: { label: "Book a meeting", action: "chilipiper", chilipiper: "https://cp" }, tenantDefaultCta: { label: "T", action: "url", url: "https://t" } },
    );
    expect(eff.source).toBe("page");
    expect(eff.action).toBe("chilipiper");
    expect(eff.chilipiper).toBe("https://cp");
  });

  it("falls through to the tenant default when neither block nor page has a CTA", () => {
    const eff = effectiveFor(
      { ctaText: "", ctaUrl: "" },
      { pageCta: {}, tenantDefaultCta: { label: "Get Started", action: "url", url: "https://book" } },
    );
    expect(eff.source).toBe("tenant");
    expect(eff.url).toBe("https://book");
  });

  it("a block with no CTA and NO inheritable context stays empty (pre-feature pages unchanged)", () => {
    const eff = effectiveFor({ ctaText: "", ctaUrl: "" }, {});
    expect(ctaConfigHasValue(eff)).toBe(false);
  });

  it("inherits per-field modal config from the tenant while taking the page's primary action", () => {
    const eff = effectiveFor(
      {},
      {
        pageCta: { label: "Get pricing", action: "modal-form" },
        tenantDefaultCta: { modalMarketoBaseUrl: "//acme.marketo.com", modalMarketoMunchkinId: "ID" },
      },
    );
    expect(eff.source).toBe("page");
    expect(eff.action).toBe("modal-form");
    // tenant's Marketo IDs flow through so the inherited modal-form actually works
    expect(eff.modalMarketoBaseUrl).toBe("//acme.marketo.com");
    expect(eff.modalMarketoMunchkinId).toBe("ID");
  });
});
