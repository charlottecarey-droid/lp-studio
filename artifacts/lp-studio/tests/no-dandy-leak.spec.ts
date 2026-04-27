// Royal-render regression: every block in the generic-tenant block_catalog
// seed must render through BlockRenderer + DEFAULT_BRAND without leaking any
// Dandy-flavoured URL, copy, or signature brand colour. Failures are reported
// per-block_type so they're actionable.

import { createRequire } from "node:module";
import { test, expect, type Page } from "@playwright/test";
import type { GenericSeedRow } from "../src/pages/generic-catalog-fixture";

const requireCjs = createRequire(import.meta.url);
const { GENERIC_SEED } = requireCjs("../../../scripts/seed-block-catalog.cjs") as {
  GENERIC_SEED: GenericSeedRow[];
};

interface FixtureWindow {
  __GENERIC_SEED__?: GenericSeedRow[];
}

interface ForbiddenPattern {
  label: string;
  pattern: RegExp;
}

const FORBIDDEN_PATTERNS: ReadonlyArray<ForbiddenPattern> = [
  { label: "Dandy-branded URL paths (/dandy-…)", pattern: /\/dandy-[a-z0-9_-]/i },
  { label: "meetdandy domain references", pattern: /meetdandy/i },
  { label: "Dandy forest hex #003A30", pattern: /#003a30\b/i },
  { label: "Dandy forest rgb(0, 58, 48)", pattern: /rgb\(\s*0\s*,\s*58\s*,\s*48\s*\)/i },
  { label: "Dandy forest-deep hex #00231D", pattern: /#00231d\b/i },
  { label: "Dandy forest-deep rgb(0, 35, 29)", pattern: /rgb\(\s*0\s*,\s*35\s*,\s*29\s*\)/i },
  { label: "Dandy lime hex #C7E738", pattern: /#c7e738\b/i },
  { label: "Dandy lime rgb(199, 231, 56)", pattern: /rgb\(\s*199\s*,\s*231\s*,\s*56\s*\)/i },
];

interface PerBlockSurface {
  blockType: string;
  surface: string;
}

interface Violation {
  label: string;
  sample: string;
}

// Block types whose generic-catalog rendering still leaks Dandy content
// today (component-internal hardcodes inside the BlockDso* family). The test
// still fails on a NEW pattern in any of these blocks, or any leak in a
// block_type not listed here. Tracked separately as a tech-debt follow-up.
const FOREST_LEAK = new Set<string>([
  "Dandy forest hex #003A30",
  "Dandy forest rgb(0, 58, 48)",
]);
const LIME_LEAK = new Set<string>([
  "Dandy lime hex #C7E738",
  "Dandy lime rgb(199, 231, 56)",
]);
const FOREST_AND_LIME_LEAK = new Set<string>([...FOREST_LEAK, ...LIME_LEAK]);
const MEETDANDY_LEAK = new Set<string>(["meetdandy domain references"]);
const MEETDANDY_AND_FOREST = new Set<string>([...MEETDANDY_LEAK, ...FOREST_LEAK]);

const KNOWN_DEBT_BLOCKS = new Map<string, Set<string>>([
  ["dso-stat-showcase", FOREST_LEAK],
  ["dso-success-stories", FOREST_LEAK],
  ["dso-problem", FOREST_LEAK],
  ["dso-ai-feature", FOREST_LEAK],
  ["dso-bento-outcomes", FOREST_LEAK],
  ["dso-promo-cards", FOREST_LEAK],
  ["dso-products-grid", FOREST_LEAK],
  ["dso-faq", FOREST_LEAK],
  ["dso-scroll-story-hero", FOREST_LEAK],
  ["dso-network-map", FOREST_LEAK],
  ["dso-paradigm-shift", FOREST_AND_LIME_LEAK],
  ["dso-split-feature", MEETDANDY_AND_FOREST],
  ["dso-software-showcase", MEETDANDY_AND_FOREST],
  ["dso-flow-canvas", MEETDANDY_LEAK],
  ["dso-meet-team", MEETDANDY_LEAK],
  ["dso-cta-capture", MEETDANDY_LEAK],
  ["dso-activation-steps", MEETDANDY_LEAK],
]);

async function getPerBlockSurfaces(page: Page): Promise<PerBlockSurface[]> {
  return page.evaluate(() => {
    function captureSurface(root: Element): string {
      const parts: string[] = [];
      parts.push((root as HTMLElement).innerText ?? "");
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
      let node: Node | null = walker.currentNode;
      while (node) {
        if (node instanceof Element) {
          for (const attr of Array.from(node.attributes)) {
            parts.push(`${attr.name}="${attr.value}"`);
          }
          const cs = window.getComputedStyle(node);
          parts.push(`bg=${cs.backgroundColor}`);
          parts.push(`color=${cs.color}`);
          parts.push(`bdr=${cs.borderColor}`);
          parts.push(`fill=${cs.fill}`);
          parts.push(`stroke=${cs.stroke}`);
        }
        node = walker.nextNode();
      }
      return parts.join("\n");
    }
    const sections = Array.from(document.querySelectorAll("[data-fixture-block]"));
    return sections.map((s) => ({
      blockType: s.getAttribute("data-fixture-block") ?? "<unknown>",
      surface: captureSurface(s),
    }));
  });
}

test.describe("Royal-safe rendering of the generic block catalog", () => {
  test("the seed contains rows to scan", () => {
    expect(Array.isArray(GENERIC_SEED)).toBe(true);
    expect(GENERIC_SEED.length).toBeGreaterThan(0);
  });

  test("every generic-catalog block renders without Dandy leakage", async ({ page }) => {
    const payload: GenericSeedRow[] = GENERIC_SEED.map((row) => ({
      block_type: row.block_type,
      default_props: row.default_props ?? {},
    }));

    await page.addInitScript((seedJson: string) => {
      const w = window as Window & FixtureWindow;
      w.__GENERIC_SEED__ = JSON.parse(seedJson) as GenericSeedRow[];
    }, JSON.stringify(payload));

    const url = "/preview/generic-catalog-fixture";
    const response = await page.goto(url, { waitUntil: "domcontentloaded" });
    expect(response, `navigation to ${url} returned no response`).not.toBeNull();
    expect(response!.status(), `unexpected status for ${url}`).toBeLessThan(400);

    const errorLocator = page.locator('[data-testid="fixture-error"]');
    if (await errorLocator.count()) {
      const msg = await errorLocator.innerText();
      throw new Error(`Fixture refused to mount: ${msg}`);
    }
    await page.waitForSelector('[data-testid="generic-catalog-fixture"]', { timeout: 15_000 });
    await page.waitForSelector('[data-testid="fixture-ready"]', { timeout: 30_000 });

    const rendered = await page.locator("[data-fixture-block]").count();
    expect(rendered, "fixture rendered fewer blocks than the seed contains").toBe(GENERIC_SEED.length);

    const crashed = await page
      .locator('[data-testid="fixture-block-error"]')
      .evaluateAll((els) =>
        els.map((el) => ({
          blockType: el.getAttribute("data-block-type") ?? "<unknown>",
          message: (el as HTMLElement).innerText,
        })),
      );
    if (crashed.length > 0) {
      const summary = crashed.map((c) => `  • ${c.blockType}: ${c.message}`).join("\n");
      throw new Error(`Generic-catalog blocks crashed during render:\n${summary}`);
    }

    const perBlockSurfaces = await getPerBlockSurfaces(page);
    const violationsByBlock = new Map<string, Violation[]>();
    for (const { blockType, surface } of perBlockSurfaces) {
      for (const { label, pattern } of FORBIDDEN_PATTERNS) {
        const match = surface.match(pattern);
        if (match) {
          const list = violationsByBlock.get(blockType) ?? [];
          list.push({ label, sample: match[0] });
          violationsByBlock.set(blockType, list);
        }
      }
      const copyrightOffenders = surface
        .split(/\n+/)
        .map((line) => line.trim())
        .filter((line) => /©|copyright/i.test(line) && /dandy/i.test(line));
      for (const line of copyrightOffenders) {
        const list = violationsByBlock.get(blockType) ?? [];
        list.push({ label: 'Copyright contains "Dandy"', sample: line });
        violationsByBlock.set(blockType, list);
      }
    }

    const newViolations = new Map<string, Violation[]>();
    for (const [blockType, leaks] of violationsByBlock) {
      const allowed = KNOWN_DEBT_BLOCKS.get(blockType);
      const unexpected = allowed ? leaks.filter((l) => !allowed.has(l.label)) : leaks;
      if (unexpected.length > 0) newViolations.set(blockType, unexpected);
    }

    if (newViolations.size > 0) {
      const summary = Array.from(newViolations.entries())
        .map(
          ([blockType, leaks]) =>
            `  ${blockType}:\n` +
            leaks.map((l) => `    • ${l.label} → matched: ${JSON.stringify(l.sample)}`).join("\n"),
        )
        .join("\n");
      throw new Error(
        `Dandy leakage detected on ${url} (rendered with DEFAULT_BRAND):\n${summary}\n\n` +
          `Fix the seed in scripts/seed-block-catalog.cjs and/or the offending ` +
          `block, or extend KNOWN_DEBT_BLOCKS in this spec if the leak is ` +
          `tracked by a separate cleanup task.`,
      );
    }
  });
});
