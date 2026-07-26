import { describe, it, expect } from "vitest";
import { buildWhyAttendPrompt, parseBlurbPayload } from "./agenda-blurbs";

const ACCOUNT = {
  name: "Evergreen Dental Group",
  industry: "Dental",
  segment: "DSO",
  abmTier: "Tier 1",
  numLocations: 120,
  city: "Denver",
  state: "CO",
};

const SESSIONS = [
  { id: 11, title: "Scaling ops", description: "Multi-site workflows.", sessionType: "Breakout", track: "Operations", roles: ["COO"] },
  { id: 12, title: "Roadmap keynote" },
];

describe("buildWhyAttendPrompt", () => {
  it("pins the grounding contract — provided facts only, nothing invented", () => {
    const { systemPrompt } = buildWhyAttendPrompt(ACCOUNT, ["COO"], SESSIONS);
    expect(systemPrompt).toContain("use ONLY the account facts and session content provided");
    expect(systemPrompt).toContain("Never invent metrics, initiatives, tools, deals, or history");
    expect(systemPrompt).toContain("26 words maximum");
    // Internal labels must not leak onto a customer-facing page.
    expect(systemPrompt).toContain("Do not mention tiers, segments, or internal labels");
  });

  it("marks the tier as internal in the facts block and includes real facts", () => {
    const { userPrompt } = buildWhyAttendPrompt(ACCOUNT, ["COO", "CFO"], SESSIONS);
    expect(userPrompt).toContain("Company: Evergreen Dental Group");
    expect(userPrompt).toContain("Industry: Dental");
    expect(userPrompt).toContain("Locations: 120");
    expect(userPrompt).toContain("internal, do not mention");
    expect(userPrompt).toContain("Attending from Evergreen Dental Group: COO, CFO");
    expect(userPrompt).toContain("the only account information that exists");
  });

  it("lists every session with its id so blurbs can be joined back", () => {
    const { userPrompt } = buildWhyAttendPrompt(ACCOUNT, [], SESSIONS);
    expect(userPrompt).toContain("sessionId 11: Scaling ops");
    expect(userPrompt).toContain("sessionId 12: Roadmap keynote");
    expect(userPrompt).toContain("intended audience: COO");
  });

  it("omits absent facts instead of writing empty lines", () => {
    const { userPrompt } = buildWhyAttendPrompt({ name: "Acme" }, [], SESSIONS);
    expect(userPrompt).toContain("Company: Acme");
    expect(userPrompt).not.toContain("Industry:");
    expect(userPrompt).not.toContain("Locations:");
  });
});

describe("parseBlurbPayload", () => {
  it("keeps only requested ids and drops empty blurbs", () => {
    const out = parseBlurbPayload(
      {
        blurbs: [
          { sessionId: 11, blurb: "Maps to your rollout." },
          { sessionId: 99, blurb: "Not requested." },
          { sessionId: 12, blurb: "   " },
        ],
      },
      [11, 12],
    );
    expect([...out.entries()]).toEqual([[11, "Maps to your rollout."]]);
  });

  it("clamps blurb length and survives garbage payloads", () => {
    const long = parseBlurbPayload({ blurbs: [{ sessionId: 1, blurb: "x".repeat(500) }] }, [1]);
    expect(long.get(1)).toHaveLength(300);
    expect(parseBlurbPayload(null, [1]).size).toBe(0);
    expect(parseBlurbPayload({ blurbs: "nope" }, [1]).size).toBe(0);
    expect(parseBlurbPayload({ blurbs: [{ sessionId: "1", blurb: "typed wrong" }] }, [1]).size).toBe(0);
  });
});
