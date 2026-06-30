import { describe, it, expect } from "vitest";
import { applyEventPageBranding } from "./generate-page";

type Block = Record<string, unknown>;

function eventPageBlock(theme?: Record<string, unknown>): Block {
  return {
    id: "event-page-1",
    type: "event-page",
    props: {
      eventName: "Forge / 2026",
      ...(theme ? { theme } : {}),
    },
  };
}

function themeOf(block: Block): Record<string, unknown> {
  const props = block.props as Record<string, unknown>;
  return (props.theme ?? {}) as Record<string, unknown>;
}

describe("applyEventPageBranding", () => {
  it("swaps theme.primary for a light-enough brand accent and preserves other theme keys", () => {
    const blocks = [eventPageBlock({ bg: "#0c0f12", primary: "#b59a6e" })];
    applyEventPageBranding(blocks, { accentColor: "#C7E738" });
    expect(themeOf(blocks[0]).primary).toBe("#C7E738");
    expect(themeOf(blocks[0]).bg).toBe("#0c0f12");
  });

  it("keeps the premium gold default when the brand accent is too dark for the dark background", () => {
    const blocks = [eventPageBlock({ bg: "#0c0f12", primary: "#b59a6e" })];
    applyEventPageBranding(blocks, { accentColor: "#0a0a0a" });
    expect(themeOf(blocks[0]).primary).toBe("#b59a6e");
  });

  it("falls back to primaryColor when accentColor is absent", () => {
    const blocks = [eventPageBlock({ primary: "#b59a6e" })];
    applyEventPageBranding(blocks, { primaryColor: "#3b82f6" });
    expect(themeOf(blocks[0]).primary).toBe("#3b82f6");
  });

  it("creates a theme object when the event-page has none", () => {
    const blocks = [eventPageBlock()];
    applyEventPageBranding(blocks, { accentColor: "#C7E738" });
    expect(themeOf(blocks[0]).primary).toBe("#C7E738");
  });

  it("no-ops when there is no brand color", () => {
    const blocks = [eventPageBlock({ primary: "#b59a6e" })];
    applyEventPageBranding(blocks, {});
    expect(themeOf(blocks[0]).primary).toBe("#b59a6e");
  });

  it("ignores an invalid brand color string", () => {
    const blocks = [eventPageBlock({ primary: "#b59a6e" })];
    applyEventPageBranding(blocks, { accentColor: "not-a-color" });
    expect(themeOf(blocks[0]).primary).toBe("#b59a6e");
  });

  it("ignores non-event-page blocks", () => {
    const blocks: Block[] = [
      { id: "h", type: "hero", props: { theme: { primary: "#000000" } } },
    ];
    applyEventPageBranding(blocks, { accentColor: "#C7E738" });
    expect(themeOf(blocks[0]).primary).toBe("#000000");
  });
});
