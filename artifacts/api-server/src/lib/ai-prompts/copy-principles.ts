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
/**
 * Worked examples for the principles below. They used to be dental-lab copy
 * for EVERY tenant ("96% first-time fit rate", "5-day crown delivery", "Zero
 * lab drama") and the model copied them verbatim onto non-dental brands — a
 * generic "Testa" page shipped "dental lab services … every crown, bridge and
 * implant" and the fit-rate bullets word for word (Oct 2026). The neutral set
 * keeps the same shape (a number, a policy, a consequence) without naming any
 * industry; the dental set is used only for Dandy tenants, where the examples
 * are the brand's real facts.
 */
export type CopyExampleVertical = "neutral" | "dental";

const COPY_EXAMPLES: Record<CopyExampleVertical, {
  r1good1: string; r1good2: string; r2bad: string; r2good: string; r3bad: string; r3good: string;
  r5badTail: string; r5good: string; r8good: string; capJoin: string; specBar: string; consequences: string;
}> = {
  neutral: {
    r1good1: "Orders ship in 2 business days, tracked to the door",
    r1good2: "98% of support requests answered within the hour. If we miss it, that month is free.",
    r2bad: "run automated quality checks on every order",
    r2good: "You get the right result the first time, without the follow-up calls",
    r3bad: "Leveraging next-generation digital workflows to optimize operational efficiency",
    r3good: "Send the brief. Get the finished work back in 5 days.",
    r5badTail: "help your business grow",
    r5good: "More done. Fewer handoffs.",
    r8good: "A partner that backs every order with a guarantee",
    capJoin: "Join hundreds of teams already using",
    specBar: "2-day turnaround on every order",
    consequences: "hours saved, rework avoided, margin gained, deadlines met",
  },
  dental: {
    r1good1: "5-day crown delivery with real-time case tracking",
    r1good2: "96% first-time fit rate. If a case doesn't seat, we remake it for free.",
    r2bad: "use AI-powered quality control on every case",
    r2good: "You get a better-fitting result without the back-and-forth phone calls",
    r3bad: "Leveraging next-generation digital workflows to optimize practice efficiency",
    r3good: "Send a scan. Get a perfect-fit crown in 5 days.",
    r5badTail: "help your practice grow",
    r5good: "More cases. Zero lab drama.",
    r8good: "A lab that backs every case with a guarantee",
    capJoin: "Join hundreds of practices already using",
    specBar: "96% first-time seat rate",
    consequences: "chair time saved, remakes avoided, margin gained, hours back",
  },
};

function titleCaseWords(s: string): string {
  return s.replace(/\b([a-z])/g, (m) => m.toUpperCase());
}

export function getCopyPrinciplesSection(opts: {
  brandName?: string;
  matchedSegment?: boolean;
  forbiddenList: string[];
  /** Which worked examples to show. Default "neutral"; "dental" only for Dandy tenants. */
  vertical?: CopyExampleVertical;
}): string {
  const brandName = opts.brandName ?? "";
  const matchedSegment = opts.matchedSegment ?? false;
  const forbiddenList = opts.forbiddenList;
  const ex = COPY_EXAMPLES[opts.vertical ?? "neutral"];
  return `
COPY QUALITY PRINCIPLES — follow every one of these without exception:

1. Specific always beats vague. Every claim needs a number, a process, or a policy behind it.
   BAD: "Faster turnaround times that improve efficiency"
   GOOD: "${ex.r1good1}"
   BAD: "${brandName || "Our"}'s advanced technology ensures better outcomes"
   GOOD: "${ex.r1good2}"

2. Lead with the customer's benefit — not ${brandName || "the seller"}'s features.
   BAD: "${brandName || "We"} ${ex.r2bad}"
   GOOD: "${ex.r2good}"

3. Write like one person talking directly to another across a desk. Not a press release. Not a brochure.
   BAD: "${ex.r3bad}"
   GOOD: "${ex.r3good}"

4. Short sentences. Active voice. One idea per sentence. If you can cut a word without losing meaning, cut it.

5. Headlines are declarative and direct. No vague questions. No "How to..." or "Why...".
   BAD: "Discover how ${brandName || "we"} can ${ex.r5badTail}"
   GOOD: "${ex.r5good}"

6. Every subheadline should deepen or add to the headline — not just restate it in different words.

7. Reference this specific account — their name, their scale, their situation — naturally throughout. It should feel written for them, not filled in with a mail-merge.

8. Never stack adjectives. One strong word beats three weak ones.
   BAD: "Powerful, comprehensive, industry-leading digital solutions"
   GOOD: "${ex.r8good}"

9. Prefer specific, concrete brand facts — the value props, differentiators, product details, and proof points given in BRAND CONTEXT — over generic marketing filler, and use the brand's own vocabulary and product names. When BRAND CONTEXT provides a fact, stat, quote, or phrase that fits a slot, use it instead of writing something generic.

${matchedSegment ? `10. VALIDATED FACTS ONLY — when this prompt includes a TARGET SEGMENT section with pre-validated stats, comparisons, and persona pain points, you MUST use ONLY those exact facts:
   a) STATS: Pull every number, percentage, dollar amount, and time-frame ONLY from the "Pre-validated stats" list. Never invent statistics. Never round, embellish, or extrapolate. If no stat fits a slot, write a different sentence rather than fabricating a number.
   b) COMPARISONS: In any comparison block (oldWayBullets/newWayBullets, comparison rows, "us vs them" tables), use ONLY the "Pre-validated comparisons" entries. Never invent contrasts.
   c) PERSONA PAIN POINTS: When writing pain-section copy or addressing buyer concerns, use ONLY the pain points listed under "Key personas". Never fabricate a persona or invent a pain point not on the list.

11. CAPITALIZATION — Two absolute rules that BOTH apply at all times:` : `10. CAPITALIZATION — Two absolute rules that BOTH apply at all times:`}
   a) ALWAYS start every sentence, headline, eyebrow, bullet point, step title, card title, FAQ question, and label with a capital letter. Every piece of text that starts a new thought begins with a capital. Never begin any text with a lowercase letter.
   b) NEVER title-case — do not capitalize every word. Only the first word of a sentence + proper nouns (person names, companies, cities) + acronyms (DSO, AI, ROI) + official product names get capitals.
   WRONG (all lowercase start): "${ex.r5good.toLowerCase()}" → WRONG: sentence starts with lowercase
   WRONG (title case): "${titleCaseWords(ex.r5good)}" → WRONG: mid-sentence words capitalized
   CORRECT: "${ex.r5good}"
   WRONG: "${ex.r3good.toLowerCase()}" → WRONG
   CORRECT: "${ex.r3good}"
   WRONG: "${ex.capJoin.toLowerCase()} ${(brandName || "us").toLowerCase()}" → WRONG: lowercase sentence start; brand names are proper nouns
   CORRECT: "${ex.capJoin} ${brandName || "us"}."

SPECIFICITY & SUBSTANCE — this is what separates good copy from generic filler. Apply it to every block:
- Be specific, never vague. Replace abstract claims with a concrete fact, number, process, name, or policy. "Better outcomes" is a failure; "${ex.specBar}" is the bar.
- Explain WHY it matters to this reader, not just WHAT it is. Connect every feature to a consequence the audience actually feels (${ex.consequences}).
- Demonstrate that you understand the audience's goals and pains. Name their real situation — their scale, their workflow, their daily friction — so the copy reads as written for THEM, not mail-merged.
- Use the concrete examples, proof points, stats, quotes, and product facts provided in the context. When a real number or customer story fits a slot, USE it — do not paraphrase it into something vaguer, and never invent one to fill a gap.
- Clarity over cleverness. A plain sentence the reader instantly understands beats a clever turn of phrase they have to decode.
- Maintain the tenant's voice and the messaging hierarchy at all times: segment + persona guidance leads, brand core supports, reference material is inspiration only.
- SYNTHESIZE the context you were given. Combine the brand voice, the segment's value props and pains, and the real proof points into copy that could only have been written for this brand and this audience. Defaulting to generic marketing language — buzzwords, stacked adjectives, hollow superlatives — is a failure even when no banned phrase appears.

NEVER USE any of the following — not in headlines, not in body copy, not anywhere:
${forbiddenList.map(p => `- "${p}"`).join("\n")}
`.trim();
}
