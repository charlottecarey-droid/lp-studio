import { describe, expect, it } from "vitest";

import { buildSystemPrompt } from "./generate-microsite";
import type { ProofPoint } from "../../lib/proof-points";

// Oct 2026 — microsites never read the proof-point library (lp_proof_points);
// only brand-import stats/testimonials and the account briefing's model-written
// "proof points" reached the prompt. Dandy's 22 approved quotes were invisible.
const SEGMENT = { id: "dso", name: "DSO networks" };
const BRAND = { brandName: "Dandy" };

const SUTER: ProofPoint = {
  id: 44,
  value: "With Dandy's digital workflow, we're cutting almost two appointments per denture—that's a game-changer for a mobile practice where every visit involves travel, setup, and coordination.",
  label: "dentures",
  source_url: "",
  as_of_date: null,
  approved_for_ai: true,
  fact_kind: "quote",
  attribution_name: "Dr. Nathan Suter",
  attribution_title: "Chief Clinical Officer",
  attribution_company: "",
};
const STAT: ProofPoint = { ...SUTER, id: 1, value: "96%", label: "first-time fit rate", fact_kind: "stat", attribution_name: "", attribution_title: "" };

function prompt(points: ProofPoint[]): string {
  return buildSystemPrompt(SEGMENT, BRAND, undefined, null, true, undefined, null, [], false, undefined, undefined, new Set(), null, [], points);
}

describe("buildSystemPrompt — proof-point library", () => {
  it("lists approved stats and verbatim customer quotes with attribution", () => {
    const sys = prompt([SUTER, STAT]);
    expect(sys).toContain("Proof Points (reusable across pages and segments):");
    expect(sys).toContain("- 96% first-time fit rate");
    expect(sys).toContain("APPROVED CUSTOMER QUOTES");
    expect(sys).toContain(`"${SUTER.value}" — Dr. Nathan Suter, Chief Clinical Officer`);
    expect(sys).toContain("exempt from the banned-phrase");
    // A quote never appears as a bare stat line.
    expect(sys).not.toContain(`- ${SUTER.value} dentures`);
  });

  it("omits the sections when the tenant has no library (non-strict)", () => {
    const sys = prompt([]);
    expect(sys).not.toContain("APPROVED CUSTOMER QUOTES");
    expect(sys).not.toContain("Proof Points (reusable");
  });
});
