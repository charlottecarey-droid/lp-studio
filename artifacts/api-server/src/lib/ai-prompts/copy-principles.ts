/**
 * Shared AI copy-quality rules used by BOTH the sales-microsite generator and
 * the LP-from-prompt generator.
 *
 * Extracted verbatim from generate-microsite.ts so the LP route enforces the
 * same strong copy-quality principles + forbidden-phrase list the microsite
 * route already did. Keep this the single source of truth.
 */

/**
 * Core forbidden phrases — cliches and filler that must never appear in
 * generated copy. Callers merge their brand-level `avoidPhrases` on top.
 */
export function getCoreForbiddenPhrases(): string[] {
  return [
    "cutting-edge", "state-of-the-art", "best-in-class", "world-class", "industry-leading",
    "leverage", "utilize", "streamline", "synergy", "empower", "enable", "facilitate",
    "revolutionize", "transformative", "game-changing", "innovative", "disruptive",
    "seamless", "seamlessly", "effortlessly", "frictionless",
    "comprehensive", "holistic", "robust", "scalable solutions", "end-to-end",
    "in today's competitive landscape", "in the current climate", "now more than ever",
    "take it to the next level", "elevate your practice",
    "partner of choice", "trusted partner", "strategic partner",
    "unique positioning", "competitive advantage",
    "solution", "ecosystem", "Discover", "Unlock", "Unleash",
    "optimize", "maximize" ,"best practices", "value-add",
    // June 2026 copy-quality audit — the four generic openers that regressed
    // page + microsite copy. Banned in the prompt AND caught by the output
    // banned-phrase validator (both paths pass this list to findBannedPhrases).
    "transform your business", "unlock your potential",
    "revolutionize your workflow", "take things to the next level",
    // June 2026 — the buzzword the Dandy brand guideline calls out by name, plus
    // the generic "with ease" filler family it stands for.
    "transform with ease", "with ease",
  ];
}

/**
 * The COPY QUALITY PRINCIPLES block injected into the system prompt.
 */
export function getCopyPrinciplesSection(opts: {
  brandName?: string;
  matchedSegment?: boolean;
  forbiddenList: string[];
}): string {
  const brandName = opts.brandName ?? "";
  const matchedSegment = opts.matchedSegment ?? false;
  const forbiddenList = opts.forbiddenList;
  return `
COPY QUALITY PRINCIPLES — follow every one of these without exception:

1. Specific always beats vague. Every claim needs a number, a process, or a policy behind it.
   BAD: "Faster turnaround times that improve efficiency"
   GOOD: "5-day crown delivery with real-time case tracking"
   BAD: "${brandName || "Our"}'s advanced technology ensures better outcomes"
   GOOD: "96% first-time fit rate. If a case doesn't seat, we remake it for free."

2. Lead with the customer's benefit — not ${brandName || "the seller"}'s features.
   BAD: "${brandName || "We"} use AI-powered quality control on every case"
   GOOD: "You get a better-fitting result without the back-and-forth phone calls"

3. Write like one person talking directly to another across a desk. Not a press release. Not a brochure.
   BAD: "Leveraging next-generation digital workflows to optimize practice efficiency"
   GOOD: "Send a scan. Get a perfect-fit crown in 5 days."

4. Short sentences. Active voice. One idea per sentence. If you can cut a word without losing meaning, cut it.

5. Headlines are declarative and direct. No vague questions. No "How to..." or "Why...".
   BAD: "Discover how ${brandName || "we"} can help your practice grow"
   GOOD: "More cases. Zero lab drama."

6. Every subheadline should deepen or add to the headline — not just restate it in different words.

7. Reference this specific account — their name, their scale, their situation — naturally throughout. It should feel written for them, not filled in with a mail-merge.

8. Never stack adjectives. One strong word beats three weak ones.
   BAD: "Powerful, comprehensive, industry-leading digital solutions"
   GOOD: "A lab that backs every case with a guarantee"

9. Prefer specific, concrete brand facts — the value props, differentiators, product details, and proof points given in BRAND CONTEXT — over generic marketing filler, and use the brand's own vocabulary and product names. When BRAND CONTEXT provides a fact, stat, quote, or phrase that fits a slot, use it instead of writing something generic.

${matchedSegment ? `10. VALIDATED FACTS ONLY — when this prompt includes a TARGET SEGMENT section with pre-validated stats, comparisons, and persona pain points, you MUST use ONLY those exact facts:
   a) STATS: Pull every number, percentage, dollar amount, and time-frame ONLY from the "Pre-validated stats" list. Never invent statistics. Never round, embellish, or extrapolate. If no stat fits a slot, write a different sentence rather than fabricating a number.
   b) COMPARISONS: In any comparison block (oldWayBullets/newWayBullets, comparison rows, "us vs them" tables), use ONLY the "Pre-validated comparisons" entries. Never invent contrasts.
   c) PERSONA PAIN POINTS: When writing pain-section copy or addressing buyer concerns, use ONLY the pain points listed under "Key personas". Never fabricate a persona or invent a pain point not on the list.

11. CAPITALIZATION — Two absolute rules that BOTH apply at all times:` : `10. CAPITALIZATION — Two absolute rules that BOTH apply at all times:`}
   a) ALWAYS start every sentence, headline, eyebrow, bullet point, step title, card title, FAQ question, and label with a capital letter. Every piece of text that starts a new thought begins with a capital. Never begin any text with a lowercase letter.
   b) NEVER title-case — do not capitalize every word. Only the first word of a sentence + proper nouns (person names, companies, cities) + acronyms (DSO, AI, ROI) + official product names get capitals.
   WRONG (all lowercase start): "more cases. zero lab drama." → WRONG: sentence starts with lowercase
   WRONG (title case): "More Cases. Zero Lab Drama." → WRONG: mid-sentence words capitalized
   CORRECT: "More cases. Zero lab drama."
   WRONG: "send a scan. get a perfect-fit crown in 5 days." → WRONG
   CORRECT: "Send a scan. Get a perfect-fit crown in 5 days."
   WRONG: "join hundreds of practices already using ${(brandName || "us").toLowerCase()}" → WRONG: lowercase sentence start; brand names are proper nouns
   CORRECT: "Join hundreds of practices already using ${brandName || "us"}."

SPECIFICITY & SUBSTANCE — this is what separates good copy from generic filler. Apply it to every block:
- Be specific, never vague. Replace abstract claims with a concrete fact, number, process, name, or policy. "Better outcomes" is a failure; "96% first-time seat rate" is the bar.
- Explain WHY it matters to this reader, not just WHAT it is. Connect every feature to a consequence the audience actually feels (chair time saved, remakes avoided, margin gained, hours back).
- Demonstrate that you understand the audience's goals and pains. Name their real situation — their scale, their workflow, their daily friction — so the copy reads as written for THEM, not mail-merged.
- Use the concrete examples, proof points, stats, quotes, and product facts provided in the context. When a real number or customer story fits a slot, USE it — do not paraphrase it into something vaguer, and never invent one to fill a gap.
- Clarity over cleverness. A plain sentence the reader instantly understands beats a clever turn of phrase they have to decode.
- Maintain the tenant's voice and the messaging hierarchy at all times: segment + persona guidance leads, brand core supports, reference material is inspiration only.
- SYNTHESIZE the context you were given. Combine the brand voice, the segment's value props and pains, and the real proof points into copy that could only have been written for this brand and this audience. Defaulting to generic marketing language — buzzwords, stacked adjectives, hollow superlatives — is a failure even when no banned phrase appears.

NEVER USE any of the following — not in headlines, not in body copy, not anywhere:
${forbiddenList.map(p => `- "${p}"`).join("\n")}
`.trim();
}
