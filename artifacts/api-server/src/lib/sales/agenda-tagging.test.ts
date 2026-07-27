import { describe, it, expect } from "vitest";
import { buildRoleTaggingPrompt, parseRoleTagPayload } from "./agenda-tagging";

const SESSIONS = [
  { id: 1, title: "Scaling lab operations", description: "For multi-site teams.", sessionType: "Breakout", track: "Operations" },
  { id: 2, title: "Opening keynote", sessionType: "Keynote" },
];

describe("buildRoleTaggingPrompt", () => {
  it("pins the vocabulary-reuse rule — the whole point of the feature", () => {
    const { systemPrompt, userPrompt } = buildRoleTaggingPrompt(SESSIONS, ["Operations", "COO"]);
    expect(systemPrompt).toContain("Reuse a role from the existing vocabulary");
    expect(systemPrompt).toContain("exact same spelling");
    expect(userPrompt).toContain("EXISTING ROLE VOCABULARY");
    expect(userPrompt).toContain("- Operations");
    expect(userPrompt).toContain("- COO");
  });

  it("tells the model to leave plenaries untagged rather than narrowing them", () => {
    const { systemPrompt } = buildRoleTaggingPrompt(SESSIONS, []);
    expect(systemPrompt).toContain("EMPTY roles array");
    expect(systemPrompt).toMatch(/keynote/i);
  });

  it("refuses topic-as-role and guessing", () => {
    const { systemPrompt } = buildRoleTaggingPrompt(SESSIONS, []);
    expect(systemPrompt).toContain("Roles describe PEOPLE, not topics");
    expect(systemPrompt).toContain("rather than a guess");
    expect(systemPrompt).toContain("Never guess from the event name");
  });

  it("handles an empty vocabulary without pretending one exists", () => {
    const { userPrompt } = buildRoleTaggingPrompt(SESSIONS, []);
    expect(userPrompt).toContain("No roles exist yet");
    expect(userPrompt).not.toContain("EXISTING ROLE VOCABULARY");
  });

  it("passes each session's own signals and nothing else", () => {
    const { userPrompt } = buildRoleTaggingPrompt(SESSIONS, []);
    expect(userPrompt).toContain("sessionId 1: Scaling lab operations");
    expect(userPrompt).toContain("track: Operations");
    expect(userPrompt).toContain("type: Keynote");
  });
});

describe("parseRoleTagPayload", () => {
  it("keeps only requested ids", () => {
    const out = parseRoleTagPayload(
      { tags: [{ sessionId: 1, roles: ["Operations"] }, { sessionId: 99, roles: ["Nope"] }] },
      [1, 2],
    );
    expect([...out.keys()]).toEqual([1]);
  });

  it("snaps a case-variant back to the existing spelling so chips don't split", () => {
    const out = parseRoleTagPayload(
      { tags: [{ sessionId: 1, roles: ["operations", "COO"] }] },
      [1],
      ["Operations"],
    );
    expect(out.get(1)).toEqual(["Operations", "COO"]);
  });

  it("preserves an EMPTY array — 'considered, open to everyone' is an answer", () => {
    const out = parseRoleTagPayload({ tags: [{ sessionId: 2, roles: [] }] }, [2]);
    expect(out.has(2)).toBe(true);
    expect(out.get(2)).toEqual([]);
  });

  it("dedupes case-insensitively and caps the list", () => {
    const out = parseRoleTagPayload(
      { tags: [{ sessionId: 1, roles: ["Ops", "ops", "OPS", "A", "B", "C", "D", "E"] }] },
      [1],
    );
    const roles = out.get(1)!;
    expect(roles.filter((r) => r.toLowerCase() === "ops")).toHaveLength(1);
    expect(roles.length).toBeLessThanOrEqual(4);
  });

  it("clamps an over-long role instead of writing a sentence into a chip", () => {
    const long = "A".repeat(120);
    const out = parseRoleTagPayload({ tags: [{ sessionId: 1, roles: [long] }] }, [1]);
    expect(out.get(1)![0].length).toBeLessThanOrEqual(40);
  });

  it("survives garbage payloads", () => {
    expect(parseRoleTagPayload(null, [1]).size).toBe(0);
    expect(parseRoleTagPayload({ tags: "nope" }, [1]).size).toBe(0);
    expect(parseRoleTagPayload({ tags: [{ sessionId: "1", roles: ["x"] }] }, [1]).size).toBe(0);
    expect(parseRoleTagPayload({ tags: [{ sessionId: 1, roles: [42, null] }] }, [1]).get(1)).toEqual([]);
  });
});
