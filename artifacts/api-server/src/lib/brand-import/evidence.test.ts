import { describe, expect, it } from "vitest";
import * as cheerio from "cheerio";

import { harvestCssColorHints } from "./evidence";
import type { FetchedStylesheet } from "./types";

function sheet(css: string): FetchedStylesheet {
  return { url: "https://example.com/app.css", css, bytes: css.length };
}

describe("harvestCssColorHints", () => {
  it("pulls hex colors from <style> tags, inline styles, and stylesheets", () => {
    const $ = cheerio.load(`
      <html>
        <head><style>.hero { color: #123456; }</style></head>
        <body>
          <div style="background: #abcdef">x</div>
        </body>
      </html>
    `);
    const sheets = [sheet(".btn { background: #FEDCBA; }")];

    const hints = harvestCssColorHints($, sheets);

    expect(hints).toContain("#123456");
    expect(hints).toContain("#ABCDEF");
    expect(hints).toContain("#FEDCBA");
  });

  it("parses rgb() / rgba() colors into normalized hex", () => {
    const $ = cheerio.load(
      `<div style="color: rgb(255, 99, 71)">x</div>`,
    );
    const sheets = [sheet(".a { background: rgba(16, 185, 129, 0.5); }")];

    const hints = harvestCssColorHints($, sheets);

    expect(hints).toContain("#FF6347");
    expect(hints).toContain("#10B981");
  });

  it("ignores out-of-range rgb() values", () => {
    const $ = cheerio.load(`<div>x</div>`);
    const sheets = [sheet(".a { color: rgb(300, 10, 10); }")];

    const hints = harvestCssColorHints($, sheets);

    expect(hints).not.toContain("#2C0A0A");
    expect(hints).toHaveLength(0);
  });

  it("normalizes 3-, 6-, and 8-digit hex to uppercase 6-digit", () => {
    const $ = cheerio.load(`<div>x</div>`);
    const sheets = [
      sheet(".short { color: #f00; }"),
      sheet(".mid { color: #00ff00; }"),
      sheet(".alpha { color: #0000ffcc; }"),
    ];

    const hints = harvestCssColorHints($, sheets);

    // 3-digit expands, 8-digit drops the alpha channel, all uppercased
    expect(hints).toContain("#FF0000");
    expect(hints).toContain("#00FF00");
    expect(hints).toContain("#0000FF");
  });

  it("ranks colors by descending frequency", () => {
    const $ = cheerio.load(`<div>x</div>`);
    const sheets = [
      sheet(`
        .a { color: #111111; }
        .b { color: #111111; }
        .c { color: #111111; }
        .d { color: #222222; }
        .e { color: #222222; }
        .f { color: #333333; }
      `),
    ];

    const hints = harvestCssColorHints($, sheets);

    expect(hints[0]).toBe("#111111");
    expect(hints[1]).toBe("#222222");
    expect(hints[2]).toBe("#333333");
  });

  it("counts a hex and its rgb() equivalent together", () => {
    const $ = cheerio.load(
      `<div style="color: rgb(17, 17, 17)">x</div>`,
    );
    const sheets = [sheet(".a { background: #111111; } .b { border-color: #111111; }")];

    const hints = harvestCssColorHints($, sheets);

    expect(hints[0]).toBe("#111111");
  });

  it("returns at most 12 colors", () => {
    const $ = cheerio.load(`<div>x</div>`);
    const many = Array.from({ length: 20 }, (_, i) => {
      const h = i.toString(16).padStart(2, "0");
      return `.c${i} { color: #${h}${h}${h}; }`;
    }).join("\n");

    const hints = harvestCssColorHints($, [sheet(many)]);

    expect(hints.length).toBeLessThanOrEqual(12);
  });

  it("returns an empty array when no colors are present", () => {
    const $ = cheerio.load(`<div style="display: flex">x</div>`);
    const sheets = [sheet(".a { font-size: 14px; }")];

    expect(harvestCssColorHints($, sheets)).toEqual([]);
  });
});
