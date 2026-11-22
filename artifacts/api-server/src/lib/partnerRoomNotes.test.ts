import { describe, expect, it } from "vitest";
import { cleanSavedNote, savedNoteName } from "./partnerRoomNotes";

describe("saved Partner Hub notes", () => {
  it("keeps the words and the links that can open, nothing else", () => {
    const n = cleanSavedNote({
      eyebrow: " From your account team ",
      title: "Book your kickoff call",
      body: "Hi {first name},\n\nPick a time.",
      signedBy: "Someone",
      pinnedAt: "2026-01-01",
      items: [
        { title: "Book your kickoff call", url: "{booking link}" },
        { title: "Agenda", url: "https://example.com/agenda", description: "What we cover" },
        { title: "Bad", url: "javascript:alert(1)" },
        { title: "", url: "https://example.com/no-name" },
        { title: "Still filling in", url: "" },
      ],
    });
    expect(n).toEqual({
      eyebrow: "From your account team",
      title: "Book your kickoff call",
      body: "Hi {first name},\n\nPick a time.",
      items: [
        { title: "Book your kickoff call", url: "{booking link}", description: undefined },
        { title: "Agenda", url: "https://example.com/agenda", description: "What we cover" },
        { title: "Still filling in", url: "", description: undefined },
      ],
    });
  });

  it("an empty note is refused; an unset eyebrow stays unset (the hub's default)", () => {
    expect(cleanSavedNote({ title: " ", body: "", items: [] })).toBeNull();
    expect(cleanSavedNote(null)).toBeNull();
    expect(cleanSavedNote({ title: "Hi" })).not.toHaveProperty("eyebrow");
    expect(cleanSavedNote({ title: "Hi", eyebrow: "" })).toHaveProperty("eyebrow", "");
  });

  it("caps sizes", () => {
    const n = cleanSavedNote({ title: "x".repeat(500), body: "y".repeat(9000), items: Array.from({ length: 20 }, (_, i) => ({ title: `L${i}`, url: "https://e.com" })) })!;
    expect(n.title!.length).toBe(200);
    expect(n.body!.length).toBe(5000);
    expect(n.items!.length).toBe(8);
  });

  it("is saved under the name typed, else its title", () => {
    expect(savedNoteName("  Lab tour invite ", { title: "You're invited" })).toBe("Lab tour invite");
    expect(savedNoteName("", { title: "You're invited" })).toBe("You're invited");
    expect(savedNoteName(undefined, {})).toBe("Untitled note");
  });
});
