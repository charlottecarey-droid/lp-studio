/**
 * Hermetic sanity checks for the golden-brief fixtures (src/evals/briefs/*).
 *
 * Catches the fixture rot that would otherwise only surface mid-way through a
 * (slow, paid) live eval run: malformed JSON, id/filename drift, missing
 * template seeds, thresholds for unknown scorers.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { SCORER_NAMES, type GoldenBrief } from "./types";

const BRIEFS_DIR = join(dirname(fileURLToPath(import.meta.url)), "briefs");

const briefFiles = readdirSync(BRIEFS_DIR).filter((f) => f.endsWith(".json")).sort();

function loadBrief(file: string): GoldenBrief {
  return JSON.parse(readFileSync(join(BRIEFS_DIR, file), "utf8")) as GoldenBrief;
}

describe("golden brief fixtures", () => {
  it("has at least 15 briefs", () => {
    expect(briefFiles.length).toBeGreaterThanOrEqual(15);
  });

  it("ids are unique and match their filenames", () => {
    const ids = briefFiles.map((f) => loadBrief(f).id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const f of briefFiles) {
      expect(loadBrief(f).id).toBe(basename(f, ".json"));
    }
  });

  it.each(briefFiles)("%s is a well-formed brief", (file) => {
    const brief = loadBrief(file);
    expect(typeof brief.description).toBe("string");
    expect(brief.description.length).toBeGreaterThan(0);

    // Request: a real POST /lp/generate-page body with a non-empty prompt.
    expect(typeof brief.request.prompt).toBe("string");
    expect(brief.request.prompt.trim().length).toBeGreaterThan(0);

    // Brand: config object present; "$TEMPLATE" requests must ship a template.
    expect(brief.brand && typeof brief.brand.config).toBe("object");
    if (brief.request.templateId === "$TEMPLATE") {
      expect(brief.brand.template).toBeDefined();
      expect(Array.isArray(brief.brand.template?.blocks)).toBe(true);
      expect(brief.brand.template?.blocks.length).toBeGreaterThan(0);
    }

    // Expectations: thresholds must reference known scorers with sane bounds.
    const thresholds = brief.expectations?.thresholds ?? {};
    for (const [name, min] of Object.entries(thresholds)) {
      expect(SCORER_NAMES).toContain(name);
      expect(min).toBeGreaterThanOrEqual(0);
      expect(min).toBeLessThanOrEqual(1);
    }
    // Non-Dandy fixtures: every brief carries subject-leak markers so
    // cross-tenant bleed is always scored.
    expect(brief.expectations.subjectLeakMarkers?.length ?? 0).toBeGreaterThan(0);
  });

  it("strict-facts briefs gate fabricated stats at 1.0", () => {
    for (const f of briefFiles) {
      const brief = loadBrief(f);
      if ((brief.brand.config as { aiStrictFactsMode?: boolean }).aiStrictFactsMode === true) {
        expect(brief.expectations.thresholds?.fabricatedStat).toBe(1);
      }
    }
  });
});
