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

/** The segments the microsite runner seeds: brand.segments wins over
 *  brand.config.segments (mirrors run.ts's validateMicrositeBrief). */
function seededSegments(brief: GoldenBrief): Array<Record<string, unknown>> {
  if (Array.isArray(brief.brand.segments)) return brief.brand.segments;
  const cfg = (brief.brand.config ?? {}) as { segments?: unknown };
  return Array.isArray(cfg.segments) ? (cfg.segments as Array<Record<string, unknown>>) : [];
}

describe("golden brief fixtures", () => {
  it("has at least 20 briefs", () => {
    expect(briefFiles.length).toBeGreaterThanOrEqual(20);
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

    const kind = brief.kind ?? "page";
    expect(["page", "microsite"]).toContain(kind);
    expect(brief.request && typeof brief.request).toBe("object");

    if (kind === "page") {
      // Request: a real POST /lp/generate-page body with a non-empty prompt.
      expect(typeof brief.request.prompt).toBe("string");
      expect((brief.request.prompt ?? "").trim().length).toBeGreaterThan(0);
    } else {
      // Microsite briefs must describe the sales_accounts row to seed…
      expect(typeof brief.account?.name).toBe("string");
      expect((brief.account?.name ?? "").trim().length).toBeGreaterThan(0);
      // …and a requested segmentId must resolve against the seeded segments
      // (the route fails closed with a 400 on an unknown segment id).
      const segmentId = typeof brief.request.segmentId === "string" ? brief.request.segmentId.trim() : "";
      if (segmentId) {
        const matched = seededSegments(brief).some((s) => {
          const sid =
            (typeof s["id"] === "string" ? s["id"] : "").trim() ||
            (typeof s["name"] === "string" ? s["name"] : "").trim();
          return sid === segmentId;
        });
        expect(matched).toBe(true);
      }
    }

    // Diversity probes: microsite-only, 2..8 accounts, and the brief must gate
    // the lineupDiversity score it exists to measure.
    if (brief.diversityProbe) {
      expect(kind).toBe("microsite");
      expect(Number.isInteger(brief.diversityProbe.accounts)).toBe(true);
      expect(brief.diversityProbe.accounts).toBeGreaterThanOrEqual(2);
      expect(brief.diversityProbe.accounts).toBeLessThanOrEqual(8);
      expect(brief.expectations.thresholds?.lineupDiversity ?? 0).toBeGreaterThan(0);
    }

    // Governance seeds: valid block types + AI modes.
    for (const rule of brief.governance ?? []) {
      expect(typeof rule.blockType).toBe("string");
      expect(rule.blockType.trim().length).toBeGreaterThan(0);
      if (rule.aiMode !== undefined) {
        expect(["open", "copy", "locked", "noai"]).toContain(rule.aiMode);
      }
    }

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
