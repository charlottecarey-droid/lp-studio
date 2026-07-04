/**
 * Layout-shift regression guard for the sales one-pager PDF headers.
 *
 * The ROI and Agreement Summary one-pagers (and the Pilot / Comparison /
 * Partner built-ins) expose header spacing sliders — "Heading Offset X",
 * "Logo Group Offset X" and "Logo Group Offset Y" — that all default to 0 so
 * every previously-saved layout renders byte-for-byte unchanged. There was no
 * automated coverage asserting that the default output stays put, so a future
 * generator tweak could silently nudge every existing customer's header title
 * or brand logo without anyone noticing.
 *
 * This test pins the header title and brand-logo anchor positions at their
 * known-good (offset = 0) baseline, and proves the three sliders actually move
 * the right element — the heading offset moves only the title, the logo-group
 * offsets move only the logo cluster.
 *
 * How positions are recovered:
 *   jsPDF writes every text() call as a `BT … x y Td … Tj … ET` block. The
 *   `x y Td` operator carries the absolute anchor position (jsPDF resets the
 *   text matrix at each BT), and it is emitted regardless of the font — so the
 *   Agreement Summary headline and wordmark, which render in the embedded
 *   "Bagoss" face and are NOT recoverable as readable `(text) Tj` glyphs, are
 *   still position-checkable via their Td coordinate (their `text` reads back
 *   as "" precisely because the glyphs carry no ToUnicode map). Note the PDF
 *   user space is bottom-left origin, so a larger Logo-Group-Offset-Y (which
 *   pushes the logo DOWN the page in jsPDF's top-down space) yields a SMALLER
 *   Td y here.
 */
import { describe, it, expect } from "vitest";
import type { jsPDF } from "jspdf";
import {
  generateAgreementSummaryOnePager,
  generateROIOnePager,
  generatePilotOnePager,
  generateComparisonOnePager,
  generateNewPartnerOnePager,
  defaultAgreementSummaryContent,
  defaultAudienceContent,
} from "@workspace/one-pager-types/generators";

type Anchor = { x: number; y: number; text: string };

/** Extract every text anchor ({ x, y } from the Td operator, plus the readable
 *  `(text) Tj` payload when the font is a standard recoverable face). */
function headerAnchors(doc: jsPDF): Anchor[] {
  const stream = Buffer.from(doc.output("arraybuffer")).toString("latin1");
  const anchors: Anchor[] = [];
  const blockRe = /BT([\s\S]*?)ET/g;
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(stream))) {
    const block = m[1];
    const td = /(-?[\d.]+)\s+(-?[\d.]+)\s+Td/.exec(block);
    if (!td) continue;
    const tj = /\(([^)]*)\)\s*Tj/.exec(block);
    anchors.push({
      x: +(+td[1]).toFixed(2),
      y: +(+td[2]).toFixed(2),
      text: tj ? tj[1] : "",
    });
  }
  return anchors;
}

/** First anchor within `tol` points of (x, y), or undefined. */
function anchorAt(anchors: Anchor[], x: number, y: number, tol = 0.5): Anchor | undefined {
  return anchors.find((a) => Math.abs(a.x - x) <= tol && Math.abs(a.y - y) <= tol);
}

/** Non-zero slider values used to prove an element actually moves. Within every
 *  generator's clamp ranges (Agreement clamps to ±80 X / ±60 Y). */
const DX = 40;
const DY = 24;

type HeaderOffsets = {
  headingOffsetX?: number;
  logoGroupOffsetX?: number;
  logoGroupOffsetY?: number;
};

/** Wrap header offsets the way the layoutOverrides-based generators expect. */
const layout = (h: HeaderOffsets) => ({ layoutOverrides: { headerCfg: { ...h } } });

interface OnePagerCase {
  name: string;
  render: (h: HeaderOffsets) => Promise<jsPDF>;
  /** Known-good baseline Td anchor of the header title at offset = 0. */
  title: { x: number; y: number; text: string };
  /** Known-good baseline Td anchor of the brand logo / wordmark at offset = 0. */
  logo: { x: number; y: number; text: string };
}

const CASES: OnePagerCase[] = [
  {
    name: "ROI",
    render: (h) => generateROIOnePager("Acme Group", 10, layout(h)),
    title: { x: 68.68, y: 700, text: "Acme Group" },
    logo: { x: 48, y: 733.6, text: "dandy" },
  },
  {
    name: "Agreement Summary",
    render: (h) => generateAgreementSummaryOnePager({ ...defaultAgreementSummaryContent, ...h }),
    // July 2026: the bundled Bagoss face is gated to callers passing
    // brand.isDandy (matching the other four generators — real Dandy surfaces
    // all pass it). A brand-less render like this one now uses helvetica, so
    // the headline glyphs read back as text; the Td anchors are unchanged.
    title: { x: 48, y: 662, text: "Summary of" },
    logo: { x: 48, y: 732.16, text: "dandy" },
  },
  {
    name: "Pilot",
    render: (h) =>
      generatePilotOnePager(
        "Acme Group",
        "executive",
        [],
        "",
        null,
        { w: 0, h: 0 },
        defaultAudienceContent.executive,
        undefined,
        undefined,
        layout(h),
      ),
    title: { x: 48, y: 672, text: "Dandy x Acme" },
    logo: { x: 48, y: 719.6, text: "dandy" },
  },
  {
    name: "Comparison",
    render: (h) =>
      generateComparisonOnePager("Acme Group", [], "", null, { w: 0, h: 0 }, undefined, undefined, layout(h)),
    title: { x: 48, y: 702, text: "Stronger Systems." },
    logo: { x: 48, y: 750.8, text: "dandy" },
  },
  {
    name: "Partner",
    render: (h) =>
      generateNewPartnerOnePager("Acme Group", null, { w: 0, h: 0 }, "https://meetdandy.com", undefined, layout(h)),
    title: { x: 48, y: 701, text: "The Winning Combo for" },
    logo: { x: 48, y: 750.8, text: "dandy" },
  },
];

describe.each(CASES)("$name one-pager header layout-shift guard", (c) => {
  it("default (offset = 0) render keeps the title and logo at the known-good baseline", async () => {
    const anchors = headerAnchors(await c.render({}));

    const title = anchorAt(anchors, c.title.x, c.title.y);
    expect(title, `header title must sit at its baseline (${c.title.x}, ${c.title.y})`).toBeDefined();
    expect(title!.text, "header title text content unchanged").toBe(c.title.text);

    const logo = anchorAt(anchors, c.logo.x, c.logo.y);
    expect(logo, `brand logo must sit at its baseline (${c.logo.x}, ${c.logo.y})`).toBeDefined();
    expect(logo!.text, "brand logo/wordmark text content unchanged").toBe(c.logo.text);
  });

  it("Heading Offset X moves the title horizontally and leaves the logo fixed", async () => {
    const anchors = headerAnchors(await c.render({ headingOffsetX: DX }));

    expect(
      anchorAt(anchors, c.title.x + DX, c.title.y),
      `title must shift +${DX}pt in X`,
    ).toBeDefined();
    expect(
      anchorAt(anchors, c.title.x, c.title.y),
      "title must no longer sit at the baseline X",
    ).toBeUndefined();
    expect(anchorAt(anchors, c.logo.x, c.logo.y), "logo must stay put").toBeDefined();
  });

  it("Logo Group Offset X/Y moves the logo cluster and leaves the title fixed", async () => {
    const anchors = headerAnchors(await c.render({ logoGroupOffsetX: DX, logoGroupOffsetY: DY }));

    expect(
      anchorAt(anchors, c.logo.x + DX, c.logo.y - DY),
      `logo must shift +${DX}pt in X and down ${DY}pt`,
    ).toBeDefined();
    expect(
      anchorAt(anchors, c.logo.x, c.logo.y),
      "logo must no longer sit at the baseline",
    ).toBeUndefined();
    expect(anchorAt(anchors, c.title.x, c.title.y), "title must stay put").toBeDefined();
  });
});
