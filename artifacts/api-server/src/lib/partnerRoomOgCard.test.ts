import { describe, expect, it } from "vitest";
import { roomOgCardCopy } from "./partnerRoom";

const hub = (props: Record<string, unknown>) => [{ type: "room-workspace", props: { title: "launch plan", partnerLogoUrl: "https://x.test/logo.png", ...props } }];

describe("roomOgCardCopy", () => {
  it("is null for a page that is not a hub", () => {
    expect(roomOgCardCopy([{ type: "hero", props: { headline: "Hi" } }], "Dandy")).toBeNull();
    expect(roomOgCardCopy(null, "Dandy")).toBeNull();
  });

  it("uses the default cover headline, never the block's internal title", () => {
    const copy = roomOgCardCopy(hub({ partnerName: "Southeast Dental Partners", lede: "The plan we run together." }), "Dandy");
    expect(copy).toEqual({ headline: "Southeast Dental Partners × Dandy Partnership Hub", subheadline: "The plan we run together." });
  });

  it("uses the typed headline, with the account name filled in", () => {
    expect(roomOgCardCopy(hub({ partnerName: "Acme Dental", headline: "Welcome, {{account}}" }), "Dandy")?.headline).toBe("Welcome, Acme Dental");
  });

  it("leaves a placeholder name out", () => {
    expect(roomOgCardCopy(hub({ partnerName: "[Partner name]" }), "Dandy")?.headline).toBe("Dandy Partnership Hub");
  });
});
