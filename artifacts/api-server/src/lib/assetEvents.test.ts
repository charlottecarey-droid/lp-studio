import { describe, expect, it } from "vitest";
import { parseAssetEventBody } from "./assetEvents";

const good = { pageId: 42, sessionId: "s-1", blockId: "seed-hub-library-3", assetKey: "screening-guide", assetTitle: "Sleep apnea screening", assetKind: "pdf", action: "view" };

describe("parseAssetEventBody — Content Hub beacon validation", () => {
  it("accepts a well-formed event and normalises optional fields", () => {
    expect(parseAssetEventBody(good)).toEqual(good);
    expect(parseAssetEventBody({ ...good, blockId: "  ", assetTitle: "" })).toMatchObject({ blockId: null, assetTitle: null });
  });

  it("rejects missing / malformed required fields", () => {
    expect(parseAssetEventBody(null)).toBeNull();
    expect(parseAssetEventBody({ ...good, pageId: "42" })).toBeNull();
    expect(parseAssetEventBody({ ...good, pageId: 0 })).toBeNull();
    expect(parseAssetEventBody({ ...good, sessionId: "" })).toBeNull();
    expect(parseAssetEventBody({ ...good, sessionId: "x".repeat(129) })).toBeNull();
    expect(parseAssetEventBody({ ...good, assetKey: " " })).toBeNull();
    expect(parseAssetEventBody({ ...good, assetKind: "docx" })).toBeNull();
    expect(parseAssetEventBody({ ...good, action: "hover" })).toBeNull();
  });

  it("caps free-text lengths so a hostile beacon can't bloat rows", () => {
    const out = parseAssetEventBody({ ...good, assetKey: "k".repeat(500), assetTitle: "t".repeat(500), blockId: "b".repeat(500) });
    expect(out?.assetKey).toHaveLength(120);
    expect(out?.assetTitle).toHaveLength(200);
    expect(out?.blockId).toHaveLength(120);
  });
});
