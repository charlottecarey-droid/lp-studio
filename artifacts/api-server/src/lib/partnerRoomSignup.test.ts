import { describe, expect, it, vi } from "vitest";

vi.mock("@workspace/db", () => ({ db: {}, lpPagesTable: {} }));
vi.mock("./logger", () => ({ logger: { warn: () => undefined, info: () => undefined, error: () => undefined } }));
import { roomSignupSlug } from "./partnerRoomPracticeSite";

describe("the sign-up page a hub links to", () => {
  it("is the practice-microsite link when the hub has one, else its first link", () => {
    expect(roomSignupSlug({ links: [{ title: "Brand folder", url: "https://drive.example.com/x" }, { key: "practice-site", title: "Sign up", url: "https://partners.example.com/acme-practices" }] })).toBe("acme-practices");
    expect(roomSignupSlug({ links: [{ title: "Sign up", url: "https://partners.example.com/lp/Acme-Practices/" }] })).toBe("acme-practices");
  });
  it("ignores hidden links, uploaded files and anything that is not a page address", () => {
    expect(roomSignupSlug({ links: [{ url: "https://x.example.com/a", hidden: true }] })).toBe("");
    expect(roomSignupSlug({ links: [{ url: "/api/storage/objects/uploads/abc", fileUrl: "/api/storage/objects/uploads/abc" }] })).toBe("");
    expect(roomSignupSlug({ links: [{ url: "https://x.example.com/" }] })).toBe("");
    expect(roomSignupSlug(null)).toBe("");
  });
});
