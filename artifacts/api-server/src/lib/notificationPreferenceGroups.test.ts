import { describe, it, expect } from "vitest";
import {
  PREFERENCE_GROUP_DEFS,
  groupMemberKeys,
  groupIdForTemplateKey,
  groupOptOutKey,
  parseGroupOptOutKey,
  buildPreferenceGroups,
  isKnownPreferenceGroup,
} from "./notificationPreferenceGroups";

// The live lifecycle EMAIL keys this workspace ships, plus an operator-created
// (DB-only) template with a junk name — exactly the case the old per-template UI
// surfaced but the PATCH then rejected.
const LIVE = ["welcome", "trial_day_7", "trial_day_11", "trial_day_13", "slug_redirect_expiry", "whynot"];

describe("notification preference groups", () => {
  it("has exactly one catch-all group", () => {
    expect(PREFERENCE_GROUP_DEFS.filter((g) => g.catchAll)).toHaveLength(1);
  });

  it("maps the code-owned templates into their named groups", () => {
    expect(groupMemberKeys("getting_started", LIVE)).toEqual(["welcome"]);
    expect(groupMemberKeys("trial_billing", LIVE)).toEqual([
      "trial_day_7",
      "trial_day_11",
      "trial_day_13",
    ]);
    expect(groupMemberKeys("account_alerts", LIVE)).toEqual(["slug_redirect_expiry"]);
  });

  it("routes operator-created / unclaimed templates into the catch-all", () => {
    // The junk-named DB template lands in 'news_offers' rather than vanishing,
    // so unsubscribing from that category actually suppresses it.
    expect(groupMemberKeys("news_offers", LIVE)).toEqual(["whynot"]);
  });

  it("returns [] for an unknown group id", () => {
    expect(groupMemberKeys("does_not_exist", LIVE)).toEqual([]);
  });

  it("maps a template key to its owning group, unclaimed keys to the catch-all", () => {
    expect(groupIdForTemplateKey("welcome")).toBe("getting_started");
    expect(groupIdForTemplateKey("trial_day_11")).toBe("trial_billing");
    expect(groupIdForTemplateKey("slug_redirect_expiry")).toBe("account_alerts");
    // A DB-only / operator-created template the registry never names → catch-all.
    expect(groupIdForTemplateKey("whynot")).toBe("news_offers");
    expect(groupIdForTemplateKey("a_brand_new_promo")).toBe("news_offers");
  });

  it("round-trips a group-level opt-out key", () => {
    expect(groupOptOutKey("news_offers")).toBe("grp:news_offers");
    expect(parseGroupOptOutKey("grp:news_offers")).toBe("news_offers");
    // A real template key is NOT a group key.
    expect(parseGroupOptOutKey("welcome")).toBeNull();
  });

  it("classifies an unrecognized grp:* value as a per-template key (no phantom group)", () => {
    // Defense in depth: only grp:<knownGroupId> is a group row. (Real template
    // keys can never contain ':' — they're validated /^[a-z0-9_]{2,64}$/ — so this
    // is purely a guard against stray data.)
    expect(parseGroupOptOutKey("grp:does_not_exist")).toBeNull();
    expect(parseGroupOptOutKey("grp:")).toBeNull();
  });

  it("hides named groups with no live members but always shows the catch-all", () => {
    // Only 'welcome' is live: getting_started has a member; account_alerts and
    // trial_billing have none and are hidden; news_offers (catch-all) is always
    // shown so a recipient can pre-emptively unsubscribe from promotions.
    const sparse = ["welcome"];
    const views = buildPreferenceGroups(sparse, [], []);
    expect(views.map((v) => v.id)).toEqual(["getting_started", "news_offers"]);
  });

  it("reads a group as unsubscribed when a group-level opt-out row exists", () => {
    const views = buildPreferenceGroups(LIVE, [], ["trial_billing"]);
    expect(views.find((v) => v.id === "trial_billing")?.subscribed).toBe(false);
    // Other groups untouched → still on.
    expect(views.find((v) => v.id === "getting_started")?.subscribed).toBe(true);
    expect(views.find((v) => v.id === "news_offers")?.subscribed).toBe(true);
  });

  it("reads a group as unsubscribed (legacy) when EVERY member has a per-template opt-out", () => {
    const allTrialOut = ["trial_day_7", "trial_day_11", "trial_day_13"];
    const views = buildPreferenceGroups(LIVE, allTrialOut, []);
    expect(views.find((v) => v.id === "trial_billing")?.subscribed).toBe(false);
  });

  it("treats a partially opted-out group as still subscribed", () => {
    const partial = ["trial_day_7"]; // one of three, no group row
    const views = buildPreferenceGroups(LIVE, partial, []);
    expect(views.find((v) => v.id === "trial_billing")?.subscribed).toBe(true);
  });

  it("shows the catch-all as unsubscribed via its group row even with members present", () => {
    const views = buildPreferenceGroups(LIVE, [], ["news_offers"]);
    expect(views.find((v) => v.id === "news_offers")?.subscribed).toBe(false);
  });

  it("isKnownPreferenceGroup only accepts defined ids", () => {
    expect(isKnownPreferenceGroup("news_offers")).toBe(true);
    expect(isKnownPreferenceGroup("welcome")).toBe(false); // a template key, not a group
    expect(isKnownPreferenceGroup("")).toBe(false);
  });
});
