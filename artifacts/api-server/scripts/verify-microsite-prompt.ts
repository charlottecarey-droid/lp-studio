/**
 * VERIFICATION HARNESS (temporary, delete after review).
 *
 * Proves the segment-driven microsite prompt builder degrades cleanly when a
 * segment has empty copy fields. Reads the proposed merged Dandy brand config
 * emitted by scripts/src/seed-dandy-microsite-block-lists.ts (--emit) and prints
 * the REAL assembled system prompt for:
 *   1. Private Practice (description only, all other copy empty) — should emit
 *      BRAND VOICE + a single "AUDIENCE: <description>" line + AVAILABLE BLOCKS
 *      from the legacy independent list. NO "Messaging angle:" / "Unique
 *      context:" / "Messaging themes:" lines.
 *   2. DSO Practices (rich messagingAngle / uniqueContext / valueProps) — should
 *      emit the same BRAND VOICE plus the full augmenting AUDIENCE add-on.
 *
 * Run:  pnpm --filter @workspace/api-server exec tsx scripts/verify-microsite-prompt.ts /tmp/dandy_merged.json
 */
import { readFileSync } from "node:fs";
import { buildSystemPrompt, type BrandAudienceSegment } from "../src/routes/sales/generate-microsite";

const path = process.argv[2];
if (!path) { console.error("Usage: tsx scripts/verify-microsite-prompt.ts <merged-config.json>"); process.exit(1); }

const config = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
const segments = (config.segments ?? []) as BrandAudienceSegment[];

function find(pred: (s: BrandAudienceSegment) => boolean, label: string): BrandAudienceSegment {
  const s = segments.find(pred);
  if (!s) { console.error(`✗ Could not find ${label} segment in ${path}`); process.exit(1); }
  return s;
}

const privatePractice = find(s => (s.name ?? "").trim().toLowerCase() === "private practice", "Private Practice");
const dsoPractices    = find(s => (s.name ?? "").toLowerCase().includes("dso practices"), "DSO Practices");

const sc = (config.salesConsole ?? {}) as { useBuiltInExemplars?: boolean };
console.log("=".repeat(100));
console.log("ENVIRONMENT");
console.log("=".repeat(100));
console.log(`brand.salesConsole.useBuiltInExemplars = ${sc.useBuiltInExemplars === true}`);
console.log(`brand.defaultMicrositeBlockList = [${((config.defaultMicrositeBlockList ?? []) as Array<{type?:string}>).map(b => b.type).join(", ")}]`);
console.log(`segments: ${segments.map(s => `"${s.name}"(blocks=${(s.micrositeBlockList ?? []).length})`).join(", ")}`);

function dump(title: string, seg: BrandAudienceSegment) {
  const prompt = buildSystemPrompt(seg, config, undefined, null);
  console.log("\n" + "=".repeat(100));
  console.log(`SYSTEM PROMPT — ${title}  (segment id=${seg.id})`);
  console.log("=".repeat(100));
  console.log(prompt);
  // Targeted assertions
  const hasAudience = /^AUDIENCE: /m.test(prompt);
  const hasAngle = /^Messaging angle: /m.test(prompt);
  const hasUnique = /^Unique context: /m.test(prompt);
  const hasThemes = /^Messaging themes: /m.test(prompt);
  const hasBrandVoice = /BRAND VOICE & GUIDELINES:/.test(prompt);
  const hasAvailBlocks = /AVAILABLE BLOCKS \(use only these/.test(prompt);
  console.log("\n--- assertions ---");
  console.log(`  BRAND VOICE present:        ${hasBrandVoice}`);
  console.log(`  AVAILABLE BLOCKS present:   ${hasAvailBlocks}`);
  console.log(`  AUDIENCE line present:      ${hasAudience}`);
  console.log(`  Messaging angle present:    ${hasAngle}`);
  console.log(`  Unique context present:     ${hasUnique}`);
  console.log(`  Messaging themes present:   ${hasThemes}`);
}

dump("PRIVATE PRACTICE (empty copy → BRAND VOICE only)", privatePractice);
dump("DSO PRACTICES (rich copy → augmenting AUDIENCE)", dsoPractices);

process.exit(0);
