import { describe, it, expect } from "vitest";
import { normalizeCopyrightYears } from "./copyright-year";

describe("normalizeCopyrightYears", () => {
  it("replaces a stale model-written year with the current one and reports the count", () => {
    const blocks = [
      { id: "f", type: "footer", props: { copyrightText: "© 2023 Testa. All rights reserved." } },
      { id: "h", type: "hero", props: { headline: "Since 1998" } },
    ];
    expect(normalizeCopyrightYears(blocks, 2026)).toBe(1);
    expect((blocks[0].props as { copyrightText: string }).copyrightText).toBe("© 2026 Testa. All rights reserved.");
    // Only copyrightText is touched — body copy years are content.
    expect((blocks[1].props as { headline: string }).headline).toBe("Since 1998");
  });

  it("leaves a current year alone and tolerates blocks without the field", () => {
    const blocks = [
      { id: "f", type: "footer", props: { copyrightText: "© 2026 Acme" } },
      { id: "x", type: "footer", props: {} },
      null,
    ];
    expect(normalizeCopyrightYears(blocks as unknown[], 2026)).toBe(0);
  });
});
