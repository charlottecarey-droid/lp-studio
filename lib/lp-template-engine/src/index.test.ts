// Unit tests for the shared template engine. Run via `pnpm --filter
// @workspace/lp-template-engine test`. These tests pin the contract that
// both the api-server validator and the lp-studio runtime/preview rely on
// — so a regression here breaks server-side validation AND client render
// in lock-step (which is exactly what we want).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseAndValidate,
  parseTemplate,
  renderTemplate,
  defaultsFromSchema,
  type FieldDef,
} from "./index.ts";

describe("renderTemplate — flat scalars", () => {
  const schema: FieldDef[] = [
    { id: "headline", type: "text" },
    { id: "count", type: "number" },
    { id: "active", type: "boolean" },
  ];

  it("interpolates scalar fields and HTML-escapes text", () => {
    const out = renderTemplate("<h1>{{headline}}</h1> <p>{{count}}</p>", schema, {
      headline: "<script>alert(1)</script>",
      count: 7,
      active: true,
    });
    assert.equal(
      out,
      "<h1>&lt;script&gt;alert(1)&lt;/script&gt;</h1> <p>7</p>",
    );
  });

  it("renders booleans as 'true'/'false' for plain {{}}", () => {
    const out = renderTemplate("{{active}}", schema, { headline: "", count: 0, active: false });
    assert.equal(out, "false");
  });

  it("uses defaultsFromSchema fallback for missing values", () => {
    const out = renderTemplate("[{{headline}}/{{count}}]", schema, defaultsFromSchema(schema));
    assert.equal(out, "[/0]");
  });
});

describe("renderTemplate — #if / else", () => {
  const schema: FieldDef[] = [
    { id: "show", type: "boolean" },
    { id: "label", type: "text" },
  ];
  it("renders the truthy branch", () => {
    const out = renderTemplate("{{#if show}}YES{{else}}NO{{/if}}", schema, { show: true, label: "" });
    assert.equal(out, "YES");
  });
  it("renders the else branch when falsy", () => {
    const out = renderTemplate("{{#if show}}YES{{else}}NO{{/if}}", schema, { show: false, label: "" });
    assert.equal(out, "NO");
  });
  it("treats empty strings/zero as falsy", () => {
    const out = renderTemplate("{{#if label}}A{{else}}B{{/if}}", schema, { show: false, label: "" });
    assert.equal(out, "B");
  });
});

describe("renderTemplate — #each (single level)", () => {
  const schema: FieldDef[] = [
    {
      id: "links",
      type: "list",
      itemSchema: [
        { id: "label", type: "text" },
        { id: "url", type: "url" },
      ],
    },
  ];

  it("iterates rows and exposes this.subfield", () => {
    const out = renderTemplate(
      "<ul>{{#each links}}<li><a href=\"{{this.url}}\">{{this.label}}</a></li>{{/each}}</ul>",
      schema,
      {
        links: [
          { label: "A", url: "/a" },
          { label: "B", url: "/b" },
        ],
      },
    );
    assert.equal(
      out,
      "<ul><li><a href=\"/a\">A</a></li><li><a href=\"/b\">B</a></li></ul>",
    );
  });

  it("renders nothing for empty list", () => {
    const out = renderTemplate("[{{#each links}}x{{/each}}]", schema, { links: [] });
    assert.equal(out, "[]");
  });
});

describe("renderTemplate — nested #each (two levels, e.g. nav columns)", () => {
  const schema: FieldDef[] = [
    {
      id: "columns",
      type: "list",
      itemSchema: [
        { id: "heading", type: "text" },
        {
          id: "links",
          type: "list",
          itemSchema: [
            { id: "label", type: "text" },
            { id: "url", type: "url" },
          ],
        },
      ],
    },
  ];

  it("iterates an inner list via {{#each this.subList}}", () => {
    const tpl =
      "{{#each columns}}<div><h3>{{this.heading}}</h3><ul>" +
      "{{#each this.links}}<li><a href=\"{{this.url}}\">{{this.label}}</a></li>{{/each}}" +
      "</ul></div>{{/each}}";
    const out = renderTemplate(tpl, schema, {
      columns: [
        { heading: "Co", links: [{ label: "About", url: "/about" }] },
        { heading: "Help", links: [{ label: "FAQ", url: "/faq" }, { label: "Docs", url: "/docs" }] },
      ],
    });
    assert.equal(
      out,
      '<div><h3>Co</h3><ul><li><a href="/about">About</a></li></ul></div>' +
        '<div><h3>Help</h3><ul>' +
        '<li><a href="/faq">FAQ</a></li><li><a href="/docs">Docs</a></li>' +
        '</ul></div>',
    );
  });
});

describe("parseAndValidate — error surface", () => {
  const flatSchema: FieldDef[] = [{ id: "title", type: "text" }];

  it("accepts a clean flat template", () => {
    const { issues } = parseAndValidate("<h1>{{title}}</h1>", flatSchema);
    assert.deepEqual(issues, []);
  });

  it("rejects an undeclared {{token}}", () => {
    const { issues } = parseAndValidate("<h1>{{title}}</h1><p>{{ghost}}</p>", flatSchema);
    assert.ok(issues.some(i => i.code === "token.unknown_field"), JSON.stringify(issues));
  });

  it("rejects an unused declared field", () => {
    const schema: FieldDef[] = [
      { id: "title", type: "text" },
      { id: "subtitle", type: "text" },
    ];
    const { issues } = parseAndValidate("<h1>{{title}}</h1>", schema);
    assert.ok(issues.some(i => i.code === "field.unused"), JSON.stringify(issues));
  });

  it("rejects mismatched #each / #if tags", () => {
    const { issues } = parseAndValidate("{{#each links}}...", [
      { id: "links", type: "list", itemSchema: [{ id: "x", type: "text" }] },
    ]);
    assert.ok(issues.length > 0);
  });

  it("rejects deeper-than-two #each nesting", () => {
    const schema: FieldDef[] = [
      {
        id: "a",
        type: "list",
        itemSchema: [
          {
            id: "b",
            type: "list",
            itemSchema: [
              { id: "c", type: "text" },
            ],
          },
        ],
      },
    ];
    // Three levels of #each — outer "a", inner "this.b", and a third bogus one.
    const tpl =
      "{{#each a}}{{#each this.b}}{{#each this.c}}{{this}}{{/each}}{{/each}}{{/each}}";
    const { issues } = parseAndValidate(tpl, schema);
    assert.ok(issues.length > 0, "expected at least one parse/validation issue for 3-level nesting");
  });

  it("rejects {{this.x}} outside of #each", () => {
    const { issues } = parseAndValidate("<p>{{this.foo}}</p>", flatSchema);
    assert.ok(issues.some(i => i.code === "template.this_outside_each"), JSON.stringify(issues));
  });
});
