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
//
// As of task #87 the BlockDso* family no longer hardcodes Dandy's forest /
// lime colors as CSS-var fallbacks (they fall back to neutral slate/blue
// instead) and the catalog seed overrides every meetdandy.com URL the
// BLOCK_REGISTRY would otherwise merge in. The map is intentionally left
// in place (empty) so that any future regression can be marked as known
// debt without reshaping the test.
const KNOWN_DEBT_BLOCKS = new Map<string, Set<string>>();

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

  // ---------------------------------------------------------------------------
  // Catalog-in-builder verification (task #86)
  //
  // The Landing Page Studio builder renders catalog blocks by passing each
  // block's defaultProps to <BlockRenderer block={...} brand={brand} />
  // (artifacts/lp-studio/src/pages/builder/BuilderEditor.tsx:~2660). The
  // generic-catalog fixture mounts every catalog row through that same
  // BlockRenderer with DEFAULT_BRAND, which is exactly the render path a
  // non-Dandy tenant sees when adding a catalog block to a fresh page. The
  // only difference vs. the builder UI is the surrounding editor chrome
  // (selection handles, toolbars), which doesn't affect the rendered block
  // itself — so this fixture is the right surface to verify the catalog.
  //
  // This test also captures browser console errors during render and fails
  // on any new ones, so a future change can't silently start logging while
  // a catalog block mounts.
  // ---------------------------------------------------------------------------

  // Pre-existing benign console noise that this verification should not be
  // gated on. Each entry is a short, specific snippet matched against the
  // raw console message text. Keep this list narrow — broad matches will
  // hide real regressions.
  const BENIGN_CONSOLE_NOISE: ReadonlyArray<RegExp> = [
    // React warns when an `<img src="">` (or similar) is rendered. Several
    // catalog seed entries intentionally leave imageUrl empty so the block
    // renders text-only by default (e.g. dso-network-map, dso-particle-mesh,
    // dso-scroll-story chapters). Tracked separately as a seed cleanup.
    /An empty string \(""\) was passed to the .* attribute/i,
    // Cross-origin font / asset fetches that are blocked by the browser in
    // the headless test environment but render fine in the live builder.
    // Scoped narrowly to the cross-origin block so genuine fetch regressions
    // (e.g. broken image URLs in the seed) still bubble up.
    /Failed to load resource:.*ERR_BLOCKED_BY_RESPONSE\.NotSameOrigin/i,
    // framer-motion's useScroll() warns when the parent has the default
    // static position. The scroll-story blocks render fine in the builder
    // (which provides the positioned scroll container); the fixture mounts
    // them in a static parent so the lib emits this informational warning.
    /container has a non-static position/i,
  ];

  test("catalog renders cleanly through BlockRenderer with neutral defaults", async ({ page }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() !== "error" && msg.type() !== "warning") return;
      const text = msg.text();
      if (BENIGN_CONSOLE_NOISE.some((rx) => rx.test(text))) return;
      consoleErrors.push(`[${msg.type()}] ${text}`);
    });
    page.on("pageerror", (err) => {
      pageErrors.push(err.message);
    });

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

    await page.waitForSelector('[data-testid="generic-catalog-fixture"]', { timeout: 15_000 });
    await page.waitForSelector('[data-testid="fixture-ready"]', { timeout: 30_000 });

    // Every catalog-exposed DSO block should produce a section with real
    // rendered content (height > 0 and non-trivial markup). A regression
    // that breaks a single block would show up as a near-empty section.
    const dsoSizes = await page.evaluate(() => {
      const sections = Array.from(document.querySelectorAll("[data-fixture-block]"));
      return sections
        .filter((s) => (s.getAttribute("data-fixture-block") ?? "").startsWith("dso-"))
        .map((s) => ({
          type: s.getAttribute("data-fixture-block") ?? "<unknown>",
          height: Math.round(s.getBoundingClientRect().height),
          innerLen: (s.innerHTML ?? "").length,
        }));
    });
    expect(dsoSizes.length, "no DSO blocks rendered from the catalog seed").toBeGreaterThan(0);
    const empties = dsoSizes.filter((d) => d.height < 20 || d.innerLen < 50);
    expect(empties, `DSO blocks rendered with no visible content: ${JSON.stringify(empties)}`).toEqual([]);

    // Lock in the two neutral default labels introduced when providerLabel
    // and terminalLabel were added. Without these assertions, a future
    // refactor could re-introduce the hardcoded "Dandy" / "Traditional Labs"
    // / "DSO Insights" headers for non-Dandy tenants and the broader leak
    // spec above wouldn't catch it (those strings aren't in
    // FORBIDDEN_PATTERNS — they're tenant-neutral words on their own).
    const compLocator = page.locator('[data-fixture-block="dso-comparison"]').first();
    await expect(compLocator, "dso-comparison block was not in the fixture").toHaveCount(1);
    const compText = await compLocator.innerText();
    // The block uses `text-transform: uppercase` on the table headers, so
    // assertions are case-insensitive.
    expect(compText, "dso-comparison must render the neutral 'Our Platform' header").toMatch(/our platform/i);
    expect(compText, "dso-comparison must render a 'Traditional' header").toMatch(/\btraditional\b/i);
    expect(compText, "dso-comparison must not leak the legacy 'Traditional Labs' header").not.toMatch(/traditional labs/i);
    expect(compText.match(/dandy/i), "dso-comparison must not leak a 'Dandy' label").toBeNull();

    const liveLocator = page.locator('[data-fixture-block="dso-live-feed"]').first();
    await expect(liveLocator, "dso-live-feed block was not in the fixture").toHaveCount(1);
    const liveText = await liveLocator.innerText();
    expect(liveText, "dso-live-feed terminal header must render the neutral 'Live Insights'").toMatch(/live insights/i);
    expect(liveText, "dso-live-feed must not leak the legacy 'DSO Insights' terminal header").not.toMatch(/dso insights/i);

    // Catch any non-benign browser console errors / page errors that fired
    // while the catalog rendered.
    expect(pageErrors, `uncaught page errors during catalog render: ${pageErrors.join(" | ")}`).toEqual([]);
    expect(
      consoleErrors,
      `unexpected console errors/warnings during catalog render:\n  ${consoleErrors.join("\n  ")}`,
    ).toEqual([]);
  });
});
