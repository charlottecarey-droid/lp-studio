import { describe, it, expect } from "vitest";
import {
  PREFERENCE_GROUP_DEFS,
  groupMemberKeys,
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

  it("hides groups that have no live members", () => {
    // No catch-all members and no account_alerts template present.
    const sparse = ["welcome"];
    const views = buildPreferenceGroups(sparse, []);
    expect(views.map((v) => v.id)).toEqual(["getting_started"]);
  });

  it("reads a group as subscribed unless EVERY member is opted out", () => {
    // Fully opted out of the trial trio → off.
    const allTrialOut = ["trial_day_7", "trial_day_11", "trial_day_13"];
    const views = buildPreferenceGroups(LIVE, allTrialOut);
    expect(views.find((v) => v.id === "trial_billing")?.subscribed).toBe(false);
    // The other groups are untouched → still on.
    expect(views.find((v) => v.id === "getting_started")?.subscribed).toBe(true);
    expect(views.find((v) => v.id === "news_offers")?.subscribed).toBe(true);
  });

  it("treats a partially opted-out group as still subscribed", () => {
    const partial = ["trial_day_7"]; // one of three
    const views = buildPreferenceGroups(LIVE, partial);
    expect(views.find((v) => v.id === "trial_billing")?.subscribed).toBe(true);
  });

  it("isKnownPreferenceGroup only accepts defined ids", () => {
    expect(isKnownPreferenceGroup("news_offers")).toBe(true);
    expect(isKnownPreferenceGroup("welcome")).toBe(false); // a template key, not a group
    expect(isKnownPreferenceGroup("")).toBe(false);
  });
});
