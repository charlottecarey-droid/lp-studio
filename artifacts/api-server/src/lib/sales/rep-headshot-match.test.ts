import { describe, expect, it } from "vitest";
import { buildHeadshotIndex, attachHeadshots, countHeadshotMatches, type HeadshotTarget } from "./rep-headshot-match";

const LIBRARY = [
  { name: "Maya Chen", email: "maya.chen@dandy.com", photo: "/api/storage/objects/uploads/maya.jpg" },
  { name: "Jordan Ellis", email: "jordan@dandy.com", photo: "/api/storage/objects/uploads/jordan.jpg" },
  // No headshot — tells us nothing, must not create a match.
  { name: "Priya Raman", email: "priya@dandy.com", photo: "" },
  // Two DIFFERENT people share this name, with different photos.
  { name: "Alex Kim", email: "alex.kim@dandy.com", photo: "/api/storage/objects/uploads/alex1.jpg" },
  { name: "Alex Kim", email: "a.kim@dandy.com", photo: "/api/storage/objects/uploads/alex2.jpg" },
];

const index = buildHeadshotIndex(LIBRARY);

describe("buildHeadshotIndex", () => {
  it("indexes by email and by name", () => {
    expect(index.byEmail.get("maya.chen@dandy.com")).toBe("/api/storage/objects/uploads/maya.jpg");
    expect(index.byName.get("maya chen")).toBe("/api/storage/objects/uploads/maya.jpg");
  });

  it("ignores records with no headshot", () => {
    expect(index.byEmail.has("priya@dandy.com")).toBe(false);
    expect(index.byName.has("priya raman")).toBe(false);
  });

  it("REFUSES an ambiguous name — better initials than the wrong face", () => {
    // Both Alex Kims are still reachable by email; the NAME is not usable.
    expect(index.byName.has("alex kim")).toBe(false);
    expect(index.byEmail.get("alex.kim@dandy.com")).toBe("/api/storage/objects/uploads/alex1.jpg");
    expect(index.byEmail.get("a.kim@dandy.com")).toBe("/api/storage/objects/uploads/alex2.jpg");
  });

  it("folds case and punctuation in names", () => {
    const i = buildHeadshotIndex([{ name: "Sean O'Brien-Smith", photo: "/p.jpg" }]);
    expect(i.byName.get("sean obriensmith")).toBe("/p.jpg");
  });

  it("an empty library yields empty maps, not a throw", () => {
    const i = buildHeadshotIndex([]);
    expect(i.byEmail.size).toBe(0);
    expect(i.byName.size).toBe(0);
  });
});

describe("attachHeadshots", () => {
  it("fills a missing image from the library", () => {
    const out = attachHeadshots<HeadshotTarget>([{ name: "Maya Chen", email: "maya.chen@dandy.com" }], index);
    expect(out[0].imageUrl).toBe("/api/storage/objects/uploads/maya.jpg");
  });

  it("MATCHES ON EMAIL FIRST — nobody shares a work email", () => {
    // Name is ambiguous in the library; the email resolves it.
    const out = attachHeadshots<HeadshotTarget>([{ name: "Alex Kim", email: "a.kim@dandy.com" }], index);
    expect(out[0].imageUrl).toBe("/api/storage/objects/uploads/alex2.jpg");
  });

  it("falls back to an unambiguous name when there's no email", () => {
    expect(attachHeadshots<HeadshotTarget>([{ name: "Jordan Ellis" }], index)[0].imageUrl)
      .toBe("/api/storage/objects/uploads/jordan.jpg");
  });

  it("leaves an ambiguous name with no image rather than guessing", () => {
    expect(attachHeadshots<HeadshotTarget>([{ name: "Alex Kim" }], index)[0].imageUrl).toBeUndefined();
  });

  it("NEVER overwrites an image already chosen for this page", () => {
    const out = attachHeadshots<HeadshotTarget>(
      [{ name: "Maya Chen", email: "maya.chen@dandy.com", imageUrl: "/custom.jpg" }],
      index,
    );
    expect(out[0].imageUrl).toBe("/custom.jpg");
  });

  it("leaves someone with no library record alone", () => {
    expect(attachHeadshots<HeadshotTarget>([{ name: "Nobody Here" }], index)[0].imageUrl).toBeUndefined();
  });

  it("does not mutate the input", () => {
    const people: HeadshotTarget[] = [{ name: "Maya Chen", email: "maya.chen@dandy.com" }];
    attachHeadshots(people, index);
    expect(people[0]).not.toHaveProperty("imageUrl");
  });

  it("counts how many faces the library can supply", () => {
    const people: HeadshotTarget[] = [
      { name: "Maya Chen", email: "maya.chen@dandy.com" },
      { name: "Alex Kim" },                                   // ambiguous
      { name: "Priya Raman", email: "priya@dandy.com" },       // no photo
      { name: "Jordan Ellis", imageUrl: "/already.jpg" },      // already set
    ];
    expect(countHeadshotMatches(people, index)).toBe(1);
  });
});
