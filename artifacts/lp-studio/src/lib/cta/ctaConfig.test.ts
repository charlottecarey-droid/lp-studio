import { describe, expect, it } from "vitest";

import {
  legacyBlockPropsToCtaConfig,
  ctaConfigToBlockProps,
  resolveCtaConfig,
  brandDefaultCtaConfig,
  ctaConfigHasValue,
  toLogicalAction,
  fromLogicalAction,
  CTA_MODAL_KEYS,
  type CtaConfig,
} from "./ctaConfig";
import type { BrandConfig } from "@/lib/brand-config";

/** Full set of modal + handoff fields with non-default values, for round-trip. */
function fullModal(): Record<string, unknown> {
  return {
    modalChilipiperUrl: "https://acme.chilipiper.com/router/x",
    modalFormSource: "marketo",
    modalFormId: 42,
    modalMarketoBaseUrl: "//acme.marketo.com",
    modalMarketoMunchkinId: "123-ABC-456",
    modalMarketoFormId: 99,
    modalChiliPiperHandoffUrl: "https://acme.chilipiper.com/router/handoff",
    modalChiliPiperHandoffMode: "redirect",
    modalChiliPiperHandoffFieldMap: { Email: "email", FirstName: "firstName" },
    modalHeadline: "Pick a time",
    modalSubheadline: "We'll be in touch",
    modalSubmitText: "Book",
    modalSuccessMessage: "Thanks!",
    modalDisclaimer: "By submitting…",
    modalShowFirstName: true,
    modalShowLastName: false,
    modalShowPhone: true,
    modalShowCompany: true,
  };
}

describe("legacyBlockPropsToCtaConfig — label namings", () => {
  it("normalizes ctaText → label", () => {
    expect(legacyBlockPropsToCtaConfig("hero", { ctaText: "Go", ctaUrl: "#" }).label).toBe("Go");
  });
  it("normalizes ctaLabel → label", () => {
    expect(legacyBlockPropsToCtaConfig("pas", { ctaLabel: "Talk", ctaUrl: "#" }).label).toBe("Talk");
  });
  it("normalizes primaryCtaText → label", () => {
    expect(legacyBlockPropsToCtaConfig("x", { primaryCtaText: "Start", ctaUrl: "#" }).label).toBe("Start");
  });
  it("prefers ctaText when multiple aliases present (read priority)", () => {
    const cfg = legacyBlockPropsToCtaConfig("x", { ctaText: "A", ctaLabel: "B", primaryCtaText: "C" });
    expect(cfg.label).toBe("A");
  });
  it("does not invent a label when the block declares none", () => {
    expect(legacyBlockPropsToCtaConfig("x", { ctaUrl: "#" }).label).toBeUndefined();
  });
});

describe("legacyBlockPropsToCtaConfig — action modes", () => {
  it("normalizes ctaAction", () => {
    expect(legacyBlockPropsToCtaConfig("x", { ctaAction: "chilipiper" }).action).toBe("chilipiper");
  });
  it("normalizes ctaMode alias", () => {
    expect(legacyBlockPropsToCtaConfig("x", { ctaMode: "modal-form" } as Record<string, unknown>).action).toBe("modal-form");
  });
  it("normalizes primaryCtaMode alias", () => {
    expect(legacyBlockPropsToCtaConfig("x", { primaryCtaMode: "video-modal" } as Record<string, unknown>).action).toBe("video-modal");
  });
  it("captures per-action destinations", () => {
    const cfg = legacyBlockPropsToCtaConfig("x", {
      ctaUrl: "https://a.com",
      chilipiperUrl: "https://cp",
      videoUrl: "v.mp4",
      videoPosterUrl: "p.jpg",
    });
    expect(cfg.url).toBe("https://a.com");
    expect(cfg.chilipiper).toBe("https://cp");
    expect(cfg.videoUrl).toBe("v.mp4");
    expect(cfg.videoPosterUrl).toBe("p.jpg");
  });
});

describe("legacyBlockPropsToCtaConfig — secondary + style + email-capture", () => {
  it("captures secondary CTA only when declared", () => {
    const cfg = legacyBlockPropsToCtaConfig("hero", {
      ctaText: "Primary",
      ctaSecondaryText: "Watch",
      ctaSecondaryAction: "video-modal",
      ctaSecondaryUrl: "#",
      secondaryChilipiperUrl: "https://cp2",
      secondaryVideoUrl: "trailer.mp4",
    });
    expect(cfg.secondary).toEqual({
      label: "Watch",
      action: "video-modal",
      url: "#",
      chilipiper: "https://cp2",
      videoUrl: "trailer.mp4",
    });
  });
  it("omits secondary entirely when no secondary keys present", () => {
    expect(legacyBlockPropsToCtaConfig("x", { ctaText: "Go" }).secondary).toBeUndefined();
  });
  it("captures style overrides", () => {
    const cfg = legacyBlockPropsToCtaConfig("x", { ctaButtonColor: "#4B47E5", ctaButtonTextColor: "#fff" });
    expect(cfg.buttonColor).toBe("#4B47E5");
    expect(cfg.buttonTextColor).toBe("#fff");
  });
  it("captures inline email-capture variant fields", () => {
    const cfg = legacyBlockPropsToCtaConfig("hero", {
      ctaStyle: "email-capture",
      emailCapturePlaceholder: "Work email",
      emailCaptureButtonText: "Get demo",
      submitMode: "modal-chilipiper",
    });
    expect(cfg.ctaStyle).toBe("email-capture");
    expect(cfg.emailCapturePlaceholder).toBe("Work email");
    expect(cfg.emailCaptureButtonText).toBe("Get demo");
    expect(cfg.submitMode).toBe("modal-chilipiper");
  });
});

describe("legacyBlockPropsToCtaConfig — modal fields round-trip losslessly", () => {
  it("captures all 19 modal/handoff fields", () => {
    const cfg = legacyBlockPropsToCtaConfig("x", fullModal()) as Record<string, unknown>;
    for (const k of CTA_MODAL_KEYS) {
      expect(cfg[k]).toEqual(fullModal()[k]);
    }
  });
});

describe("ctaConfigToBlockProps — reverse shim, no pollution, alias-aware", () => {
  it("writes label to the target's alias (ctaLabel)", () => {
    const cfg: CtaConfig = { label: "Book a meeting" };
    const out = ctaConfigToBlockProps("pas", cfg, { ctaLabel: "old", ctaUrl: "#" });
    expect(out.ctaLabel).toBe("Book a meeting");
    expect(out).not.toHaveProperty("ctaText");
  });
  it("writes label to primaryCtaText when that's the target's alias", () => {
    const out = ctaConfigToBlockProps("x", { label: "Start" }, { primaryCtaText: "old" });
    expect(out.primaryCtaText).toBe("Start");
  });
  it("writes action to the target's alias (ctaMode)", () => {
    const out = ctaConfigToBlockProps("x", { action: "chilipiper" }, { ctaMode: "url", chilipiperUrl: "" });
    expect(out.ctaMode).toBe("chilipiper");
    expect(out).not.toHaveProperty("ctaAction");
  });
  it("only writes keys the target declares (no pollution)", () => {
    const out = ctaConfigToBlockProps("x", { label: "Go", buttonColor: "#000", modalHeadline: "h" }, { ctaUrl: "old" });
    expect(out).toEqual({ ctaUrl: "old" }); // url not in cfg, label/style/modal not on target
    expect(out).not.toHaveProperty("ctaText");
    expect(out).not.toHaveProperty("ctaButtonColor");
    expect(out).not.toHaveProperty("modalHeadline");
  });
  it("does not mutate the input target props", () => {
    const target = { ctaText: "old", ctaUrl: "old" };
    const snap = { ...target };
    ctaConfigToBlockProps("x", { label: "new" }, target);
    expect(target).toEqual(snap);
  });
});

describe("shim round-trip: legacy props → CtaConfig → block props is identity for declared fields", () => {
  it("preserves a Chili-Piper-handoff Marketo CTA's behavior exactly", () => {
    const legacy = {
      // own copy (must pass through untouched)
      headline: "Sleep solutions for your DSO",
      // CTA contract
      ctaLabel: "Book a meeting",
      ctaAction: "modal-form",
      ctaUrl: "#",
      chilipiperUrl: "https://acme.chilipiper.com/router/abm",
      ctaButtonColor: "#4B47E5",
      ctaButtonTextColor: "#FFFFFF",
      ...fullModal(),
    };
    const cfg = legacyBlockPropsToCtaConfig("deal-room", legacy);
    const back = ctaConfigToBlockProps("deal-room", cfg, legacy);
    // Every CTA field round-trips identically — the renderer sees the same props.
    expect(back.ctaLabel).toBe("Book a meeting");
    expect(back.ctaAction).toBe("modal-form");
    expect(back.ctaUrl).toBe("#");
    expect(back.chilipiperUrl).toBe("https://acme.chilipiper.com/router/abm");
    expect(back.ctaButtonColor).toBe("#4B47E5");
    expect(back.ctaButtonTextColor).toBe("#FFFFFF");
    for (const k of CTA_MODAL_KEYS) {
      expect(back[k]).toEqual((legacy as Record<string, unknown>)[k]);
    }
    // own copy preserved
    expect(back.headline).toBe("Sleep solutions for your DSO");
  });

  it("round-trips all three label namings", () => {
    for (const key of ["ctaText", "ctaLabel", "primaryCtaText"] as const) {
      const legacy: Record<string, unknown> = { [key]: "Label", ctaUrl: "#" };
      const cfg = legacyBlockPropsToCtaConfig("x", legacy);
      const back = ctaConfigToBlockProps("x", cfg, legacy);
      expect(back[key]).toBe("Label");
    }
  });
});

describe("resolveCtaConfig — hierarchy + source marker", () => {
  const tenant: CtaConfig = { label: "Tenant CTA", url: "https://tenant.com", action: "url", buttonColor: "#111" };
  const page: CtaConfig = { label: "Page CTA", url: "https://page.com", action: "url" };
  const block: CtaConfig = { label: "Block CTA", action: "chilipiper", chilipiper: "https://cp" };

  it("block wins when it has a value (source = block)", () => {
    const r = resolveCtaConfig({ tenantDefault: tenant, pageOverride: page, blockOverride: block });
    expect(r.label).toBe("Block CTA");
    expect(r.action).toBe("chilipiper");
    expect(r.source).toBe("block");
  });
  it("page wins when block is empty (source = page)", () => {
    const r = resolveCtaConfig({ tenantDefault: tenant, pageOverride: page, blockOverride: {} });
    expect(r.label).toBe("Page CTA");
    expect(r.source).toBe("page");
  });
  it("tenant is the base when block + page are empty (source = tenant)", () => {
    const r = resolveCtaConfig({ tenantDefault: tenant, pageOverride: {}, blockOverride: {} });
    expect(r.label).toBe("Tenant CTA");
    expect(r.source).toBe("tenant");
  });
  it("source = none when no layer supplies a value", () => {
    const r = resolveCtaConfig({ tenantDefault: {}, pageOverride: {}, blockOverride: {} });
    expect(r.source).toBe("none");
  });
  it("an explicit-but-default url action (just ctaUrl='#') does not count as a value", () => {
    const r = resolveCtaConfig({ tenantDefault: tenant, pageOverride: { url: "#", action: "url" }, blockOverride: {} });
    expect(r.source).toBe("tenant"); // page's "#" is not a real CTA
  });
});

describe("resolveCtaConfig — per-field modal merge", () => {
  it("merges modal fields individually (block > page > tenant)", () => {
    const tenant: CtaConfig = {
      modalMarketoBaseUrl: "//tenant.marketo.com",
      modalMarketoMunchkinId: "TENANT-ID",
      modalHeadline: "Tenant headline",
    };
    const page: CtaConfig = {
      label: "Page CTA",
      action: "modal-form",
      modalHeadline: "Page headline", // page overrides headline
    };
    const block: CtaConfig = {}; // empty → inherits page primary, but contributes no modal
    const r = resolveCtaConfig({ tenantDefault: tenant, pageOverride: page, blockOverride: block });
    expect(r.source).toBe("page");
    // page wins headline; tenant's Marketo IDs are inherited (not clobbered)
    expect(r.modalHeadline).toBe("Page headline");
    expect(r.modalMarketoBaseUrl).toBe("//tenant.marketo.com");
    expect(r.modalMarketoMunchkinId).toBe("TENANT-ID");
  });
  it("block modal field beats page + tenant", () => {
    const r = resolveCtaConfig({
      tenantDefault: { modalHeadline: "T" },
      pageOverride: { label: "P", action: "modal-form", modalHeadline: "P" },
      blockOverride: { label: "B", action: "modal-form", modalHeadline: "B" },
    });
    expect(r.modalHeadline).toBe("B");
    expect(r.source).toBe("block");
  });
});

describe("brandDefaultCtaConfig", () => {
  const brand = {
    defaultCtaText: "Get Started",
    defaultCtaUrl: "https://book.acme.com",
    chilipiperUrl: "https://acme.chilipiper.com/router/x",
    ctaBackground: "#0f172a",
    ctaText: "#ffffff",
  } as Pick<BrandConfig, "defaultCtaText" | "defaultCtaUrl" | "chilipiperUrl" | "ctaBackground" | "ctaText">;

  it("surfaces the brand default as a CtaConfig (source = tenant)", () => {
    const cfg = brandDefaultCtaConfig(brand);
    expect(cfg.label).toBe("Get Started");
    expect(cfg.url).toBe("https://book.acme.com");
    expect(cfg.action).toBe("url");
    expect(cfg.chilipiper).toBe("https://acme.chilipiper.com/router/x");
    expect(cfg.buttonColor).toBe("#0f172a");
    expect(cfg.buttonTextColor).toBe("#ffffff");
    expect(cfg.source).toBe("tenant");
  });
  it("does not force a URL action when defaultCtaUrl is '#' or empty", () => {
    const cfg = brandDefaultCtaConfig({ ...brand, defaultCtaUrl: "#" });
    expect(cfg.url).toBeUndefined();
    expect(cfg.action).toBeUndefined();
    expect(cfg.label).toBe("Get Started");
  });
  it("returns an empty tenant config when brand is null", () => {
    const cfg = brandDefaultCtaConfig(null);
    expect(cfg.source).toBe("tenant");
    expect(ctaConfigHasValue(cfg)).toBe(false);
  });

  it("plugs into resolveCtaConfig as the base layer", () => {
    const tenantDefault = brandDefaultCtaConfig(brand);
    const r = resolveCtaConfig({ tenantDefault, pageOverride: {}, blockOverride: {} });
    expect(r.label).toBe("Get Started");
    expect(r.source).toBe("tenant");
  });
});

describe("logical action mapping (editor-level, no renderer change)", () => {
  it("classifies url destinations into anchor / email / download / url", () => {
    expect(toLogicalAction("url", "#section")).toBe("anchor");
    expect(toLogicalAction("url", "mailto:sales@acme.com")).toBe("email");
    expect(toLogicalAction("url", "https://cdn.acme.com/guide.pdf")).toBe("download");
    expect(toLogicalAction("url", "https://acme.com/pricing")).toBe("url");
  });
  it("maps renderer modes to logical actions", () => {
    expect(toLogicalAction("chilipiper")).toBe("chilipiper");
    expect(toLogicalAction("modal-form")).toBe("open-form");
    expect(toLogicalAction("modal-chilipiper")).toBe("chilipiper");
    expect(toLogicalAction("video-modal")).toBe("video-modal");
  });
  it("fromLogicalAction round-trips back to renderer modes", () => {
    expect(fromLogicalAction("open-form")).toBe("modal-form");
    expect(fromLogicalAction("chilipiper")).toBe("chilipiper");
    expect(fromLogicalAction("video-modal")).toBe("video-modal");
    expect(fromLogicalAction("none")).toBeUndefined();
    // url / anchor / download / email all persist as "url"
    expect(fromLogicalAction("url")).toBe("url");
    expect(fromLogicalAction("anchor")).toBe("url");
    expect(fromLogicalAction("download")).toBe("url");
    expect(fromLogicalAction("email")).toBe("url");
  });
});
