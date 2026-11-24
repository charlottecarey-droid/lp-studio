import { describe, expect, it } from "vitest";
import { allGifts, applyWizardDefaults, buildGiftProps, composeSource, fixCountCopy, majorityTier, giftNames, giftSourceLabel, manualRow, parseWizardCsv, wizardCsvTemplate } from "./gift-wizard";

const source = {
  "gift-hero": { headline: "Pick the gift", envelopeIntro: false, kicker: "Happy holidays from Dandy", tagFrom: "From your Dandy team" },
  "gift-picker": { options: [{ name: "A" }, { name: "B" }] },
  "gift-form": { source: "holiday-gift", submitText: "Send my gift" },
  "gift-note": { headline: "Thank you for a great year.", signature: "Amanda Seek", repTitle: "Inside AE" },
};

describe("buildGiftProps", () => {
  it("customer + classic keeps the source copy and adds personalisation tokens", () => {
    const out = buildGiftProps(source, { tier: "premium", audience: "customer", layout: "classic", envelope: false });
    expect(out["gift-hero"].headline).toBe("Pick the gift");
    expect(out["gift-hero"].envelopeIntro).toBe(false);
    expect(out["gift-hero"].tagFrom).toBe("From {{rep_first_name|Dandy}}");
    expect(out["gift-note"].signature).toBe("{{rep_name|Your Dandy rep}}");
    expect(out["gift-note"].personalNote).toBe("{{personal_note}}");
    expect(out["gift-form"].repEmail).toBe("{{rep_email}}");
    expect(out["gift-form"].source).toBe("holiday-gift-customer");
    expect(out["gift-picker"].options).toEqual(source["gift-picker"].options);
    expect(source["gift-note"].signature).toBe("Amanda Seek"); // source untouched
  });
  it("prospect + atelier + envelope", () => {
    const out = buildGiftProps(source, { tier: "swag", audience: "prospect", layout: "atelier", envelope: true });
    expect(out["gift-hero"].headline).toBe("A small thank-you,\nno strings attached.");
    expect(out["gift-hero"].envelopeIntro).toBe(true);
    expect(out["gift-hero"].kicker).toBe("The 2026 holiday collection");
    for (const t of Object.keys(out)) expect(out[t].layout).toBe("atelier");
    expect(out["gift-form"].submitText).toBe("Accept my gift");
    expect(out["gift-form"].source).toBe("holiday-swag-prospect");
    expect(out["gift-note"].headline).toBe("Wishing you a\nwonderful new year.");
  });
  it("atelier customer note headline", () => {
    expect(buildGiftProps(source, { tier: "mid", audience: "customer", layout: "atelier", envelope: false })["gift-note"].headline).toBe("Thank you for\na wonderful year.");
  });
  it("labels sources and lists gift names", () => {
    expect(giftSourceLabel("mid", "prospect")).toBe("holiday-gift-mid-prospect");
    expect(giftNames(source)).toEqual(["A", "B"]);
    expect(giftNames(undefined)).toEqual([]);
  });
});

describe("recipient list", () => {
  it("round-trips its own CSV template", () => {
    const { rows, problems } = parseWizardCsv(wizardCsvTemplate());
    expect(problems).toEqual([]);
    expect(rows[0].variables.first_name).toBe("Jordan");
  });
  it("flags rows missing required fields", () => {
    const { rows, problems } = parseWizardCsv("first_name,company\nAda,\nBo,Acme\n");
    expect(rows).toHaveLength(1);
    expect(problems).toEqual(["Row 2: missing company"]);
  });
  it("fills blank rep and note, keeps row overrides", () => {
    const out = applyWizardDefaults(
      [{ slug: "a", variables: { first_name: "A" } }, { slug: "b", variables: { rep_email: "x@y.com", personal_note: "hi" } }],
      "me@y.com", "Thanks!",
    );
    expect(out[0].variables).toMatchObject({ rep_email: "me@y.com", personal_note: "Thanks!" });
    expect(out[1].variables).toMatchObject({ rep_email: "x@y.com", personal_note: "hi" });
  });
  it("builds a manual row slug", () => {
    expect(manualRow({ first_name: "Ada", last_name: "Lovelace", company: "Acme Dental" })?.slug).toBe("ada-lovelace-acme-dental");
    expect(manualRow({ first_name: "Ada" })).toBeNull();
  });
});

describe("pick-your-own gifts", () => {
  const sources = {
    premium: { pageId: 1, title: "P", blocks: { "gift-hero": { subheadline: "Choose your gift", ctaText: "See the options" }, "gift-picker": { headline: "x", options: [{ name: "AirPods" }, { name: "Ray-Bans" }] }, "gift-form": { sizeOptions: [], sizeLabel: "", subheadline: "Three quick steps." } } },
    mid: { pageId: 2, title: "M", blocks: { "gift-hero": { subheadline: "Choose one of three, tell us where to send it", ctaText: "See the three gifts" }, "gift-picker": { headline: "x", options: [{ name: "Yeti" }, { name: "Candy" }, { name: "Bears" }] }, "gift-form": { sizeOptions: [], sizeLabel: "" } } },
    swag: { pageId: 3, title: "S", blocks: { "gift-picker": { options: [{ name: "Jacket" }] }, "gift-form": { sizeOptions: ["S", "M"], sizeLabel: "Size (if it applies)" } } },
  };
  it("lists every gift with a tier key", () => {
    expect(allGifts(sources).map((g) => g.key)).toEqual(["premium::AirPods", "premium::Ray-Bans", "mid::Yeti", "mid::Candy", "mid::Bears", "swag::Jacket"]);
  });
  it("composes the picked gifts onto the base page and fixes count copy", () => {
    const all = allGifts(sources);
    const picked = [all[0], all[2]]; // AirPods + Yeti
    const out = composeSource(sources, picked, "mid");
    expect((out["gift-picker"].options as Array<{ name: string }>).map((o) => o.name)).toEqual(["AirPods", "Yeti"]);
    expect(out["gift-hero"].subheadline).toBe("Choose one of two, tell us where to send it");
    expect(out["gift-hero"].ctaText).toBe("See the two gifts");
    expect(out["gift-form"].sizeOptions).toEqual([]);
    expect(sources.mid.blocks["gift-picker"].options).toHaveLength(3); // source untouched
  });
  it("adds the size select only when a swag gift is picked", () => {
    const all = allGifts(sources);
    const out = composeSource(sources, [all[0], all[5]], "premium");
    expect(out["gift-form"].sizeOptions).toEqual(["S", "M"]);
    expect(out["gift-form"].sizeLabel).toBe("Size (if it applies)");
  });
  it("picks the majority tier as the base and rewrites counts", () => {
    const all = allGifts(sources);
    expect(majorityTier([all[2], all[3], all[0]])).toBe("mid");
    expect(majorityTier([all[0], all[2]])).toBe("premium");
    expect(fixCountCopy("Choose one of three", 1)).toBe("Choose your gift");
    expect(fixCountCopy("Choose one of three", 3)).toBe("Choose one of three");
  });
});
