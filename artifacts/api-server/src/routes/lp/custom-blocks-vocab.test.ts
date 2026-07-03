/**
 * Custom blocks in the generator vocabulary (July 2026) — hermetic tests for
 * the pure halves: the prompt section the model sees and the post-parse
 * hardening of whatever it emitted. The DB-backed wrappers are thin
 * (fetch/resolve + these cores) and fail-open.
 */
import { describe, it, expect } from "vitest";
import {
  buildCustomBlocksPromptSection,
  applyCustomSchemaSources,
  fieldSignature,
  type CustomBlockVocabEntry,
} from "./custom-blocks-vocab";
import type { SchemaFieldDef } from "./custom-blocks-validator";

const SCHEMA: SchemaFieldDef[] = [
  { id: "headline", label: "Headline", type: "text" },
  {
    id: "quotes",
    label: "Quotes",
    type: "list",
    itemSchema: [
      { id: "text", label: "Text", type: "text" },
      { id: "author", label: "Author", type: "text" },
    ],
  },
];

const ENTRY: CustomBlockVocabEntry = {
  id: 42,
  name: "Testimonial Wall",
  description: "A grid of customer quotes.",
  schema: SCHEMA,
  template: '<div class="blk-testimonial-wall">{{headline}}</div>',
  sample: {
    headline: "Loved by dental teams everywhere",
    quotes: [
      { text: "Cut our remake rate in half within a quarter", author: "Dr. Alvarez" },
      { text: "The dashboard alone is worth the switch", author: "Priya N., COO" },
    ],
  },
};

describe("fieldSignature", () => {
  it("renders scalars and list row shapes", () => {
    expect(fieldSignature(SCHEMA)).toBe("headline (text), quotes (list of { text, author }, 4-6 rows)");
  });
});

describe("buildCustomBlocksPromptSection", () => {
  it("advertises each block with id, name, description, and fields, plus the emit contract", () => {
    const section = buildCustomBlocksPromptSection([ENTRY]);
    expect(section).toContain('customBlockId 42 "Testimonial Wall" — A grid of customer quotes.');
    expect(section).toContain("headline (text), quotes (list of { text, author }");
    expect(section).toContain('"type": "custom-schema"');
    expect(section).toContain('"customBlockId": <number>');
    expect(section).toContain("never force one in");
  });

  it("returns an empty string when the tenant has no custom blocks", () => {
    expect(buildCustomBlocksPromptSection([])).toBe("");
  });
});

describe("applyCustomSchemaSources", () => {
  const sources = new Map([[42, ENTRY]]);

  it("snapshots the master schema/template and keeps the model's values", () => {
    const degradations: Array<{ code: string }> = [];
    const out = applyCustomSchemaSources(
      [
        { type: "hero", props: { headline: "H" } },
        {
          type: "custom-schema",
          props: {
            customBlockId: 42,
            values: { headline: "What Heartland's clinicians say" },
          },
        },
      ],
      sources,
      degradations as never,
    );
    expect(out).toHaveLength(2);
    const custom = out[1] as { props: Record<string, unknown> };
    expect(custom.props.customBlockId).toBe(42);
    expect(custom.props.customBlockName).toBe("Testimonial Wall");
    expect(custom.props.schema).toBe(SCHEMA);
    expect(custom.props.template).toContain("blk-testimonial-wall");
    const values = custom.props.values as Record<string, unknown>;
    // Model's value wins for the field it wrote…
    expect(values.headline).toBe("What Heartland's clinicians say");
    // …and the master sample backfills the field it skipped, so the block
    // still renders finished.
    expect(Array.isArray(values.quotes)).toBe(true);
    expect((values.quotes as unknown[]).length).toBe(2);
    expect(degradations).toEqual([]);
  });

  it("drops a block referencing an unknown id and records a warn degradation", () => {
    const degradations: Array<{ code: string; severity: string }> = [];
    const out = applyCustomSchemaSources(
      [{ type: "custom-schema", props: { customBlockId: 999, values: {} } }],
      sources,
      degradations as never,
    );
    expect(out).toEqual([]);
    expect(degradations).toHaveLength(1);
    expect(degradations[0].code).toBe("custom_block_unresolved");
    expect(degradations[0].severity).toBe("warn");
  });

  it("accepts a numeric-string id (models stringify numbers) and drops junk ids", () => {
    const degradations: unknown[] = [];
    const out = applyCustomSchemaSources(
      [
        { type: "custom-schema", props: { customBlockId: "42", values: {} } },
        { type: "custom-schema", props: { customBlockId: "not-a-number", values: {} } },
        { type: "custom-schema", props: {} },
      ],
      sources,
      degradations as never,
    );
    expect(out).toHaveLength(1);
    expect((out[0] as { props: { customBlockId: number } }).props.customBlockId).toBe(42);
    expect(degradations).toHaveLength(2);
  });

  it("coerces model values to the schema — unknown fields are dropped, empties fall back to the sample", () => {
    const out = applyCustomSchemaSources(
      [
        {
          type: "custom-schema",
          props: {
            customBlockId: 42,
            values: { headline: "  ", quotes: [], invented_field: "junk" },
          },
        },
      ],
      sources,
      [] as never,
    );
    const values = (out[0] as { props: { values: Record<string, unknown> } }).props.values;
    expect(values.invented_field).toBeUndefined();
    expect(values.headline).toBe(ENTRY.sample.headline); // blank → sample backfill
    expect((values.quotes as unknown[]).length).toBe(2); // empty list → sample backfill
  });

  it("passes non-custom blocks through untouched", () => {
    const hero = { type: "hero", props: { headline: "H" } };
    const out = applyCustomSchemaSources([hero], sources, [] as never);
    expect(out[0]).toBe(hero);
  });
});
