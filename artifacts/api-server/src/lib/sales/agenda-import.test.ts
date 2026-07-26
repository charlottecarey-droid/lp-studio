import { describe, it, expect } from "vitest";
import {
  chunkAgendaMarkdown,
  buildAgendaExtractionPrompt,
  normalizeExtractedSessions,
} from "./agenda-import";

describe("chunkAgendaMarkdown", () => {
  it("returns a single chunk for short input and [] for empty", () => {
    expect(chunkAgendaMarkdown("hello world")).toEqual(["hello world"]);
    expect(chunkAgendaMarkdown("   \n  ")).toEqual([]);
  });

  it("splits on blank-line boundaries so a session never straddles chunks", () => {
    const para = (n: number) => `Session ${n}\nTime: 9:00\nRoom: A`.padEnd(40, ".");
    const md = Array.from({ length: 10 }, (_, i) => para(i)).join("\n\n");
    const chunks = chunkAgendaMarkdown(md, 100);
    expect(chunks.length).toBeGreaterThan(1);
    // No chunk starts or ends mid-paragraph: joining with blank lines restores everything.
    expect(chunks.join("\n\n")).toBe(md);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(100);
  });

  it("hard-splits a pathological single paragraph", () => {
    const md = "x".repeat(250);
    const chunks = chunkAgendaMarkdown(md, 100);
    expect(chunks).toHaveLength(3);
    expect(chunks.join("")).toBe(md);
  });
});

describe("buildAgendaExtractionPrompt", () => {
  const event = { name: "Summit 2026", startDate: "2026-10-20", endDate: "2026-10-22" };

  it("pins the anti-fabrication and roles-only-when-stated rules", () => {
    const { systemPrompt } = buildAgendaExtractionPrompt("md", event, 0, 1);
    expect(systemPrompt).toContain("never fabricate");
    expect(systemPrompt).toContain("never invent them");
    expect(systemPrompt).toContain('{"sessions": [...]}');
    expect(systemPrompt).toContain("do NOT write new copy");
  });

  it("gives the model the event date range to resolve weekday labels", () => {
    const { systemPrompt } = buildAgendaExtractionPrompt("md", event, 0, 1);
    expect(systemPrompt).toContain("2026-10-20 to 2026-10-22");
    const noDates = buildAgendaExtractionPrompt("md", { name: "E", startDate: null, endDate: null }, 0, 1);
    expect(noDates.systemPrompt).toContain("otherwise omit `day`");
  });

  it("labels the chunk position and embeds the markdown", () => {
    const { userPrompt } = buildAgendaExtractionPrompt("THE-MARKDOWN", event, 1, 3);
    expect(userPrompt).toContain("chunk 2 of 3");
    expect(userPrompt).toContain("THE-MARKDOWN");
    expect(userPrompt).toContain("Summit 2026");
  });
});

describe("normalizeExtractedSessions", () => {
  it("coerces 12h times, keeps ISO days, drops non-ISO days", () => {
    const rows = normalizeExtractedSessions({
      sessions: [
        { title: "A", day: "2026-10-20", startTime: "9:00 AM", endTime: "12:30 PM" },
        { title: "B", day: "Tuesday, Oct 20", startTime: "14:00" },
      ],
    });
    expect(rows[0]).toMatchObject({ title: "A", day: "2026-10-20", startTime: "09:00", endTime: "12:30" });
    expect(rows[1].day).toBeUndefined();
    expect(rows[1].startTime).toBe("14:00");
  });

  it("drops titleless rows and survives garbage payloads", () => {
    expect(normalizeExtractedSessions({ sessions: [{ day: "2026-10-20" }, null, 42] })).toEqual([]);
    expect(normalizeExtractedSessions(null)).toEqual([]);
    expect(normalizeExtractedSessions({ sessions: "nope" })).toEqual([]);
  });

  it("keeps only named speakers and string tags", () => {
    const [row] = normalizeExtractedSessions({
      sessions: [{
        title: "T",
        speakers: [{ name: "Ada", title: "CEO" }, { title: "orphan" }, "junk"],
        tags: { roles: ["COO", 7, ""], industries: null, topics: ["Ops"] },
      }],
    });
    expect(row.speakers).toEqual([{ name: "Ada", title: "CEO" }]);
    expect(row.tags).toEqual({ roles: ["COO"], industries: [], topics: ["Ops"] });
  });

  it("rejects impossible times rather than passing them to the catalog", () => {
    const [row] = normalizeExtractedSessions({ sessions: [{ title: "T", startTime: "25:00" }] });
    expect(row.startTime).toBeUndefined();
  });
});
