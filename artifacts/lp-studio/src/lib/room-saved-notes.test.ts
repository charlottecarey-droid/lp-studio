import { describe, expect, it } from "vitest";
import { extraFromSaved, savedBodyFrom } from "./room-saved-notes";

describe("saved notes on a hub", () => {
  it("saving keeps the words and named links, never the signer or the date", () => {
    const body = savedBodyFrom({ key: "n", kind: "text", title: "Lab tour invite", body: "Hi {first name}", eyebrow: "", signedBy: "Alex", pinnedAt: "2026-01-01", items: [{ title: "Book a lab tour", url: "{booking link}" }, { title: "", url: "https://x.com" }] });
    expect(body).toEqual({ eyebrow: "", title: "Lab tour invite", body: "Hi {first name}", items: [{ title: "Book a lab tour", url: "{booking link}" }] });
  });

  it("adding one makes a fresh note: new key, pinned now, the hub's own signer, default eyebrow when the saved one had none", () => {
    const before = Date.now();
    const x = extraFromSaved({ id: 3, name: "Kickoff", updatedAt: "", note: { title: "Book your kickoff call", body: "Hi", items: [{ title: "Book", url: "{booking link}" }] } }, [{ key: "ov-text-1", kind: "text", title: "x" }]);
    expect(x.key).toBe("ov-text-2");
    expect(x.kind).toBe("text");
    expect(x.eyebrow).toBe("From your account team");
    expect(x.signedBy).toBeUndefined();
    expect(Date.parse(x.pinnedAt!)).toBeGreaterThanOrEqual(before);
    expect(x.items).toEqual([{ title: "Book", url: "{booking link}" }]);
  });
});
