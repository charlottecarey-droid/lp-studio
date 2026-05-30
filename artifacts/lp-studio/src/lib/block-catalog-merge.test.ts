import { describe, it, expect } from "vitest";
import { getDefaultBlockTags } from "@workspace/lp-template-engine";
import { BLOCK_REGISTRY } from "./block-types";
import {
  INDUSTRIES,
  mergeSuperadminCatalog,
  resolveBlocksForIndustry,
  type CatalogEntry,
  type CatalogRow,
} from "./block-catalog-merge";

// A registry block we can safely use as a "code-default" block to override.
// Pick the first registry entry so the test stays valid as the registry grows.
const SAMPLE = BLOCK_REGISTRY[0];

function dbRow(over: Partial<CatalogRow> & Pick<CatalogRow, "block_type" | "industry">): CatalogRow {
  return {
    label: "Overridden label",
    category: "Content",
    default_props: {},
    is_enabled: true,
    sort_order: 0,
    updated_at: new Date().toISOString(),
    updated_by: 7,
    ...over,
  };
}

function catalogEntry(over: Partial<CatalogEntry> & Pick<CatalogEntry, "blockType" | "industry">): CatalogEntry {
  return {
    label: "Overridden label",
    category: "Content",
    defaultProps: {},
    sortOrder: 0,
    isEnabled: true,
    ...over,
  };
}

describe("mergeSuperadminCatalog (superadmin merged block list)", () => {
  it("shows every registry block once per industry — count = registry × industries", () => {
    const merged = mergeSuperadminCatalog([]);
    expect(merged).toHaveLength(BLOCK_REGISTRY.length * INDUSTRIES.length);

    // Every (block_type, industry) pair from the registry is represented exactly once.
    for (const industry of INDUSTRIES) {
      for (const def of BLOCK_REGISTRY) {
        const hits = merged.filter(r => r.block_type === def.type && r.industry === industry);
        expect(hits, `${def.type}/${industry}`).toHaveLength(1);
      }
    }
  });

  it("marks blocks with no DB row as 'Code default' (source: code)", () => {
    const merged = mergeSuperadminCatalog([]);
    expect(merged.every(r => r.source === "code")).toBe(true);
  });

  it("marks blocks with a DB override row as 'Customized' (source: db) and surfaces its values", () => {
    const override = dbRow({
      block_type: SAMPLE.type,
      industry: "generic",
      label: "My Custom Hero",
      category: "Hero",
      default_props: { headline: "Saved headline" },
    });
    const merged = mergeSuperadminCatalog([override]);

    // Total count is unchanged — the override replaces the code-default slot.
    expect(merged).toHaveLength(BLOCK_REGISTRY.length * INDUSTRIES.length);

    const row = merged.find(r => r.block_type === SAMPLE.type && r.industry === "generic")!;
    expect(row.source).toBe("db");
    expect(row.label).toBe("My Custom Hero");
    expect(row.default_props).toEqual({ headline: "Saved headline" });

    // The SAME block in the OTHER industry (no row) is still a code default.
    const other = merged.find(r => r.block_type === SAMPLE.type && r.industry === "dental")!;
    expect(other.source).toBe("code");
  });

  it("fills code-default rows with the effective in-code role tags", () => {
    const merged = mergeSuperadminCatalog([]);
    const row = merged.find(r => r.block_type === SAMPLE.type && r.industry === "generic")!;
    expect(row.source).toBe("code");
    expect(row.tags).toEqual(getDefaultBlockTags(SAMPLE.type));
  });

  it("carries a DB override's role tags through to the merged row", () => {
    const override = dbRow({
      block_type: SAMPLE.type,
      industry: "generic",
      tags: ["cta", "form"],
    });
    const merged = mergeSuperadminCatalog([override]);
    const row = merged.find(r => r.block_type === SAMPLE.type && r.industry === "generic")!;
    expect(row.source).toBe("db");
    expect(row.tags).toEqual(["cta", "form"]);
  });

  it("preserves a DB override's null tags (null = inherit code defaults)", () => {
    const override = dbRow({
      block_type: SAMPLE.type,
      industry: "generic",
      tags: null,
    });
    const merged = mergeSuperadminCatalog([override]);
    const row = merged.find(r => r.block_type === SAMPLE.type && r.industry === "generic")!;
    expect(row.source).toBe("db");
    expect(row.tags).toBeNull();
  });

  it("appends custom DB-only rows whose block_type is not in the registry", () => {
    const custom = dbRow({ block_type: "totally-custom-block", industry: "generic", label: "Custom" });
    const merged = mergeSuperadminCatalog([custom]);

    expect(merged).toHaveLength(BLOCK_REGISTRY.length * INDUSTRIES.length + 1);
    const row = merged.find(r => r.block_type === "totally-custom-block")!;
    expect(row.source).toBe("db");
    expect(row.industry).toBe("generic");
  });
});

describe("resolveBlocksForIndustry (builder block resolution)", () => {
  it("returns the in-code registry as fallback when rows are null", () => {
    const blocks = resolveBlocksForIndustry(null, "generic");
    expect(blocks).toHaveLength(BLOCK_REGISTRY.length);
    expect(blocks.every(b => b.source === "registry")).toBe(true);
  });

  it("reflects a saved override for a tenant of that industry (generic)", () => {
    const rows: CatalogEntry[] = [
      catalogEntry({
        blockType: SAMPLE.type,
        industry: "generic",
        label: "Generic Hero",
        category: "Hero",
        defaultProps: { headline: "Inherited from override" },
      }),
    ];
    const blocks = resolveBlocksForIndustry(rows, "generic");

    const resolved = blocks.find(b => b.type === SAMPLE.type)!;
    expect(resolved.source).toBe("catalog");
    expect(resolved.label).toBe("Generic Hero");
    // Override defaultProps are shallow-merged on top of the in-code default.
    const props = resolved.defaultProps();
    expect(props.headline).toBe("Inherited from override");
    // Untouched registry keys still survive the merge.
    const codeProps = SAMPLE.defaultProps();
    for (const key of Object.keys(codeProps)) {
      if (key === "headline") continue;
      expect(props[key]).toEqual(codeProps[key]);
    }
  });

  it("leaves code-default blocks (no row) inheriting the registry default", () => {
    const rows: CatalogEntry[] = [
      catalogEntry({ blockType: SAMPLE.type, industry: "generic", label: "Only this one is overridden" }),
    ];
    const blocks = resolveBlocksForIndustry(rows, "generic");
    // A different registry block with no row stays a registry-sourced default.
    const untouched = BLOCK_REGISTRY.find(d => d.type !== SAMPLE.type)!;
    const resolved = blocks.find(b => b.type === untouched.type)!;
    expect(resolved.source).toBe("registry");
  });

  it("reflects a saved override for a dental tenant", () => {
    const rows: CatalogEntry[] = [
      catalogEntry({
        blockType: SAMPLE.type,
        industry: "dental",
        label: "Dental Hero",
        defaultProps: { headline: "Dental override" },
      }),
    ];
    const blocks = resolveBlocksForIndustry(rows, "dental");
    const resolved = blocks.find(b => b.type === SAMPLE.type)!;
    expect(resolved.source).toBe("catalog");
    expect(resolved.label).toBe("Dental Hero");
    expect(resolved.defaultProps().headline).toBe("Dental override");
  });

  it("hides a block in generic when an explicit disabled row is present", () => {
    const rows: CatalogEntry[] = [
      catalogEntry({ blockType: SAMPLE.type, industry: "generic", label: "Hidden", isEnabled: false }),
    ];
    const blocks = resolveBlocksForIndustry(rows, "generic");
    expect(blocks.find(b => b.type === SAMPLE.type)).toBeUndefined();
  });
});
