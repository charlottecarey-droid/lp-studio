// Idempotent seed for LP Studio's own first-party marketing blog (blog_posts).
//
// Five high-quality how-to posts in LP Studio's brand voice (confident,
// plainspoken, short sentences, real mechanics, sentence-case headlines, no
// banned words, no invented stats). Each post leads with the answer in the
// first two sentences (GEO best practice), uses clear H2 structure + a stepped
// body, ends with a one-paragraph conclusion + CTA, and embeds ONE simple
// inline-SVG infographic (cream/ink/indigo, coral spark only for emphasis;
// responsive via viewBox, no external deps).
//
// Bodies are markdown TEXT; they're rendered (and sanitized) on the FE. The
// seed is applied marker-guarded in migrate.ts and inserted ON CONFLICT (slug)
// DO NOTHING so a superadmin's later edits / deletions are never clobbered.

export interface BlogPostSeed {
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  authorName: string;
  tags: string[];
  seoTitle: string;
  seoDescription: string;
  readingTimeMin: number;
  /** Days-ago offset for staggered publishedAt (0 = most recent). */
  publishedDaysAgo: number;
}

// ── Inline-SVG infographics ───────────────────────────────────────────────────
// Each uses a viewBox (responsive), brand tokens as literal hex (the FE renderer
// runs raw SVG through an allowlist sanitizer, so we keep attributes simple).

const SVG_SEVEN_SECTIONS = `<svg viewBox="0 0 600 360" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="The 7-section landing page structure, top to bottom">
  <rect x="0" y="0" width="600" height="360" fill="#F6F2E9"/>
  <g font-family="Inter, sans-serif" font-size="13" fill="#1A1815">
    <rect x="40" y="16" width="520" height="40" rx="6" fill="#FFFFFF" stroke="#4B47E5" stroke-width="1.5"/>
    <text x="56" y="40" font-weight="600">1 · Hero — promise + proof + one CTA</text>
    <rect x="40" y="64" width="520" height="36" rx="6" fill="#FFFFFF" stroke="#1A1815" stroke-width="1"/>
    <text x="56" y="86">2 · Problem — name the pain in their words</text>
    <rect x="40" y="108" width="520" height="36" rx="6" fill="#FFFFFF" stroke="#1A1815" stroke-width="1"/>
    <text x="56" y="130">3 · Solution — how it works, in three steps</text>
    <rect x="40" y="152" width="520" height="36" rx="6" fill="#FFFFFF" stroke="#1A1815" stroke-width="1"/>
    <text x="56" y="174">4 · Proof — logos, numbers, quotes</text>
    <rect x="40" y="196" width="520" height="36" rx="6" fill="#FFFFFF" stroke="#1A1815" stroke-width="1"/>
    <text x="56" y="218">5 · Objections — answer the top three</text>
    <rect x="40" y="240" width="520" height="36" rx="6" fill="#FFFFFF" stroke="#1A1815" stroke-width="1"/>
    <text x="56" y="262">6 · Offer — what they get, what it costs</text>
    <rect x="40" y="284" width="520" height="40" rx="6" fill="#FFFFFF" stroke="#E26B4F" stroke-width="1.5"/>
    <text x="56" y="308" font-weight="600">7 · Final CTA — repeat the one action</text>
  </g>
</svg>`;

const SVG_BRAND_TO_PAGE = `<svg viewBox="0 0 600 220" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Brand guidelines flow into a finished page">
  <rect x="0" y="0" width="600" height="220" fill="#F6F2E9"/>
  <g font-family="Inter, sans-serif" font-size="12" fill="#1A1815">
    <rect x="30" y="50" width="150" height="120" rx="8" fill="#FFFFFF" stroke="#1A1815" stroke-width="1"/>
    <text x="46" y="78" font-weight="600">Brand guidelines</text>
    <text x="46" y="102">Colors</text>
    <text x="46" y="122">Fonts</text>
    <text x="46" y="142">Voice + facts</text>
    <rect x="240" y="80" width="120" height="60" rx="8" fill="#4B47E5"/>
    <text x="300" y="115" fill="#F6F2E9" text-anchor="middle" font-weight="600">LP Studio</text>
    <path d="M188 110 L232 110" stroke="#1A1815" stroke-width="1.5"/>
    <path d="M226 104 L234 110 L226 116" fill="#1A1815"/>
    <path d="M368 110 L412 110" stroke="#E26B4F" stroke-width="1.5"/>
    <path d="M406 104 L414 110 L406 116" fill="#E26B4F"/>
    <rect x="420" y="50" width="150" height="120" rx="8" fill="#FFFFFF" stroke="#4B47E5" stroke-width="1.5"/>
    <text x="495" y="78" text-anchor="middle" font-weight="600">On-brand page</text>
    <rect x="438" y="92" width="114" height="10" rx="3" fill="#1A1815"/>
    <rect x="438" y="110" width="80" height="8" rx="3" fill="#8B857C"/>
    <rect x="438" y="126" width="64" height="20" rx="5" fill="#4B47E5"/>
  </g>
</svg>`;

const SVG_VS_TABLE = `<svg viewBox="0 0 600 280" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Landing page versus microsite comparison">
  <rect x="0" y="0" width="600" height="280" fill="#F6F2E9"/>
  <g font-family="Inter, sans-serif" font-size="12.5" fill="#1A1815">
    <rect x="200" y="20" width="180" height="36" rx="6" fill="#4B47E5"/>
    <text x="290" y="44" fill="#F6F2E9" text-anchor="middle" font-weight="600">Landing page</text>
    <rect x="400" y="20" width="180" height="36" rx="6" fill="#FFFFFF" stroke="#1A1815"/>
    <text x="490" y="44" text-anchor="middle" font-weight="600">Microsite</text>
    <text x="30" y="86">Pages</text><text x="290" y="86" text-anchor="middle">One</text><text x="490" y="86" text-anchor="middle">Many</text>
    <line x1="20" y1="98" x2="580" y2="98" stroke="#1A1815" stroke-opacity="0.1"/>
    <text x="30" y="124">Goal</text><text x="290" y="124" text-anchor="middle">One action</text><text x="490" y="124" text-anchor="middle">Explore a topic</text>
    <line x1="20" y1="136" x2="580" y2="136" stroke="#1A1815" stroke-opacity="0.1"/>
    <text x="30" y="162">Build time</text><text x="290" y="162" text-anchor="middle" fill="#4B47E5" font-weight="600">Minutes</text><text x="490" y="162" text-anchor="middle">Days</text>
    <line x1="20" y1="174" x2="580" y2="174" stroke="#1A1815" stroke-opacity="0.1"/>
    <text x="30" y="200">Best for</text><text x="290" y="200" text-anchor="middle">A campaign</text><text x="490" y="200" text-anchor="middle">A program</text>
    <line x1="20" y1="212" x2="580" y2="212" stroke="#1A1815" stroke-opacity="0.1"/>
    <text x="30" y="238">Measure</text><text x="290" y="238" text-anchor="middle">Conversion rate</text><text x="490" y="238" text-anchor="middle" fill="#E26B4F">Engagement</text>
  </g>
</svg>`;

const SVG_AB_LOOP = `<svg viewBox="0 0 600 260" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="The A/B testing loop">
  <rect x="0" y="0" width="600" height="260" fill="#F6F2E9"/>
  <g font-family="Inter, sans-serif" font-size="12.5" fill="#1A1815" text-anchor="middle">
    <circle cx="300" cy="130" r="6" fill="#E26B4F"/>
    <rect x="240" y="20" width="120" height="44" rx="8" fill="#FFFFFF" stroke="#4B47E5" stroke-width="1.5"/>
    <text x="300" y="47" font-weight="600">1 · Hypothesis</text>
    <rect x="430" y="108" width="120" height="44" rx="8" fill="#FFFFFF" stroke="#1A1815"/>
    <text x="490" y="135" font-weight="600">2 · Split traffic</text>
    <rect x="240" y="196" width="120" height="44" rx="8" fill="#FFFFFF" stroke="#1A1815"/>
    <text x="300" y="223" font-weight="600">3 · Measure</text>
    <rect x="50" y="108" width="120" height="44" rx="8" fill="#FFFFFF" stroke="#1A1815"/>
    <text x="110" y="135" font-weight="600">4 · Ship winner</text>
    <path d="M362 50 Q470 60 478 104" fill="none" stroke="#8B857C" stroke-width="1.5"/>
    <path d="M472 96 L480 106 L468 108" fill="#8B857C"/>
    <path d="M478 154 Q420 210 364 216" fill="none" stroke="#8B857C" stroke-width="1.5"/>
    <path d="M372 208 L362 218 L368 206" fill="#8B857C"/>
    <path d="M238 216 Q150 210 122 154" fill="none" stroke="#8B857C" stroke-width="1.5"/>
    <path d="M130 162 L120 152 L118 164" fill="#8B857C"/>
    <path d="M122 106 Q150 60 238 48" fill="none" stroke="#E26B4F" stroke-width="1.5"/>
    <path d="M230 56 L240 46 L242 58" fill="#E26B4F"/>
  </g>
</svg>`;

const SVG_PROMPT_ANATOMY = `<svg viewBox="0 0 600 250" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="The anatomy of a good AI page brief">
  <rect x="0" y="0" width="600" height="250" fill="#F6F2E9"/>
  <g font-family="Inter, sans-serif" font-size="12.5" fill="#1A1815">
    <rect x="40" y="20" width="520" height="40" rx="6" fill="#FFFFFF" stroke="#4B47E5" stroke-width="1.5"/>
    <text x="56" y="38" font-weight="600">Audience</text>
    <text x="56" y="54" fill="#8B857C">Who is this page for, and what do they already know?</text>
    <rect x="40" y="70" width="520" height="40" rx="6" fill="#FFFFFF" stroke="#1A1815"/>
    <text x="56" y="88" font-weight="600">One action</text>
    <text x="56" y="104" fill="#8B857C">The single thing you want them to do.</text>
    <rect x="40" y="120" width="520" height="40" rx="6" fill="#FFFFFF" stroke="#1A1815"/>
    <text x="56" y="138" font-weight="600">Proof you can use</text>
    <text x="56" y="154" fill="#8B857C">Real facts, numbers, and quotes — nothing invented.</text>
    <rect x="40" y="170" width="520" height="40" rx="6" fill="#FFFFFF" stroke="#E26B4F" stroke-width="1.5"/>
    <text x="56" y="188" font-weight="600">Constraints</text>
    <text x="56" y="204" fill="#8B857C">Tone, length, must-include and must-avoid.</text>
  </g>
</svg>`;

export const BLOG_POST_SEEDS: BlogPostSeed[] = [
  {
    slug: "how-to-write-a-landing-page-that-converts",
    title: "How to write a landing page that converts (the 7-section structure)",
    excerpt:
      "A landing page converts when it makes one promise and asks for one action. Use a seven-section structure — hero, problem, solution, proof, objections, offer, final CTA — and cut everything that doesn't move someone toward that action.",
    authorName: "LP Studio",
    tags: ["landing pages", "conversion"],
    seoTitle: "How to write a landing page that converts: the 7-section structure",
    seoDescription:
      "A landing page converts when it makes one promise and asks for one action. Here's the seven-section structure that does the work, section by section.",
    readingTimeMin: 5,
    publishedDaysAgo: 28,
    body: `A landing page converts when it makes one promise and asks for one action. Everything else is noise. The reliable way to get there is a seven-section structure — hero, problem, solution, proof, objections, offer, final CTA — where each section earns the next.

This is the skeleton most high-converting pages share. Learn it once and you can write a page in an afternoon.

${SVG_SEVEN_SECTIONS}

## Start with one promise, one action

Before you write a word, name two things: the promise (what the visitor gets) and the action (what they do next). One of each. A page that offers a demo, a download, and a newsletter signup offers nothing — the visitor picks the easiest option, which is to leave.

Write both down. Every section below either supports the promise or removes a reason not to take the action.

## Build the seven sections

1. **Hero.** State the promise in plain language, add one line of proof, and show the single CTA. The visitor should know what this is and what to do within five seconds.
2. **Problem.** Name the pain in the reader's own words. If they nod, they keep reading.
3. **Solution.** Show how it works in three steps. Not the feature list — the path from where they are to what you promised.
4. **Proof.** Logos, numbers, and a real quote. Specifics beat adjectives.
5. **Objections.** Answer the top three reasons someone hesitates. Price, effort, risk.
6. **Offer.** Spell out what they get and what it costs. Clarity removes friction.
7. **Final CTA.** Repeat the one action. Same words as the hero.

## Cut everything else

A second navigation bar. A "learn more" link that leaves the page. A video nobody asked for. Each one is an exit. On a landing page, every link that isn't the CTA is a leak.

Read your draft and ask one question of each element: does this move someone toward the action? If not, delete it.

## Test the order, not just the copy

Once the structure is in place, the highest-leverage change is usually order, not words. Move proof above the fold. Put objections before the offer. Small reorderings change conversion more than a new headline.

A landing page is a structured argument: promise, evidence, ask. Get the seven sections in order, keep one promise and one action, and cut the rest — that's most of the job. In LP Studio you can drop these sections in as blocks, keep them on-brand automatically, and publish in minutes. [Create your workspace](https://app.lpstudio.ai) and build your first page.`,
  },
  {
    slug: "how-to-turn-brand-guidelines-into-a-page-in-minutes",
    title: "How to turn your brand guidelines into a page in minutes",
    excerpt:
      "Turn brand guidelines into a page by encoding them once — colors, fonts, voice, and approved facts — then generating against that source of truth. The guidelines stop being a PDF nobody opens and become defaults every page inherits.",
    authorName: "LP Studio",
    tags: ["brand", "AI generation"],
    seoTitle: "How to turn brand guidelines into a landing page in minutes",
    seoDescription:
      "Encode your brand once — colors, fonts, voice, approved facts — then generate pages that inherit it. Here's how to make guidelines do real work.",
    readingTimeMin: 5,
    publishedDaysAgo: 21,
    body: `Turn brand guidelines into a page by encoding them once and generating against them. Colors, fonts, voice, and approved facts become defaults, so every page starts on-brand instead of being corrected into shape afterward.

Most teams keep guidelines in a PDF that nobody opens at 4pm on deadline. The fix isn't a longer PDF. It's making the guidelines the source the page is built from.

${SVG_BRAND_TO_PAGE}

## Encode the brand once

Pull the four things that actually shape a page out of the document and into a structured brand config:

- **Colors** with roles — primary, ink, background, accent — not just a swatch grid.
- **Fonts** for display and body, with the weights you actually use.
- **Voice** as a few concrete rules: short sentences, no jargon, words to avoid.
- **Facts** you're allowed to claim — real numbers, certifications, quotes.

This is a one-time setup. Done well, it's the last time anyone has to think about hex codes.

## Generate against the source of truth

With the brand encoded, generating a page is a different exercise. You describe what the page is for; the tools fill it with copy and layout that already obey your fonts, colors, and voice. You're not formatting — you're editing meaning.

The approved-facts library matters most here. It's what keeps generated copy honest: the page can only claim things you've said are true, so you don't ship an invented stat.

## Review for meaning, not formatting

When the brand is enforced by default, review gets faster because you're only checking one thing: is this true and is this the point? You're no longer hunting for the wrong blue or an off-brand headline font. Those can't happen.

That shift — from formatting review to meaning review — is where the minutes come from.

## Keep it current in one place

Rebrand, new tagline, a fact that changed? Update the brand config once. Pages generated after that inherit the change. The guidelines stay alive instead of drifting out of date the moment they're published.

Guidelines only pay off when they're enforced automatically. Encode your brand once, generate against it, and review for meaning — that's how a guideline becomes a page in minutes instead of a document nobody reads. [Create your workspace](https://app.lpstudio.ai) and set up your brand in one sitting.`,
  },
  {
    slug: "landing-page-vs-microsite-which-one-do-you-need",
    title: "Landing page vs. microsite: which one do you actually need?",
    excerpt:
      "Use a landing page when you want one action; use a microsite when you want someone to explore a topic across several pages. Pick by goal: a single conversion calls for a page, a program with depth calls for a microsite.",
    authorName: "LP Studio",
    tags: ["landing pages", "strategy"],
    seoTitle: "Landing page vs. microsite: which one do you actually need?",
    seoDescription:
      "A landing page drives one action; a microsite lets people explore a topic across several pages. Here's how to pick the right one by goal.",
    readingTimeMin: 4,
    publishedDaysAgo: 14,
    body: `Use a landing page when you want one action. Use a microsite when you want someone to explore a topic across several pages. The choice comes down to goal, not size — a single conversion calls for a page; a program with depth calls for a microsite.

People reach for "microsite" when they mean "important." But importance isn't the test. The test is how many things you're asking the visitor to do.

${SVG_VS_TABLE}

## Choose a landing page for one action

A landing page has one job: get the visitor to do the one thing. Book a demo. Download the guide. Start a trial. Everything on the page serves that action, and there's nothing to click except the CTA.

Reach for a landing page when:

- You're running a campaign with a single goal.
- You can measure success as a conversion rate.
- The decision is simple enough to make on one screen.

A landing page is fast to build and easy to test, which is most of why it works.

## Choose a microsite to explore a topic

A microsite is several connected pages around one theme — a product line, an event, a research program. The goal isn't a single conversion; it's depth. You want someone to wander, learn, and come away convinced.

Reach for a microsite when:

- The story needs more than one page to tell.
- Different visitors need different paths through the content.
- You'll measure engagement — pages per visit, time, return rate — not just one conversion.

The cost is real: more pages, more to maintain, more places to go off-brand. Only take it on when the depth earns it.

## When in doubt, start with the page

Most of the time the honest answer is a landing page. It forces the discipline of one promise and one action, and you can ship it today. If it turns out you genuinely need depth, a page is a clean first chapter of a microsite later.

Pick by goal: one action means a landing page; explore a topic means a microsite. Don't let "this is important" talk you into building five pages when one would convert better. In LP Studio you can start with a page and grow into a microsite when the story earns it. [Create your workspace](https://app.lpstudio.ai) to try both.`,
  },
  {
    slug: "how-to-ab-test-a-landing-page-without-a-cro-team",
    title: "How to A/B test a landing page without a CRO team",
    excerpt:
      "You can A/B test a landing page without a CRO team by testing one change at a time, sending real traffic to both versions, and shipping the winner. Start with the highest-leverage element — usually the headline or the CTA — and run the loop.",
    authorName: "LP Studio",
    tags: ["A/B testing", "conversion"],
    seoTitle: "How to A/B test a landing page without a CRO team",
    seoDescription:
      "A/B testing doesn't need a CRO team. Test one change at a time, split real traffic, and ship the winner. Here's the simple loop that works.",
    readingTimeMin: 5,
    publishedDaysAgo: 7,
    body: `You can A/B test a landing page without a CRO team. Test one change at a time, split real traffic between the two versions, and ship whichever converts better. The method is simple; the discipline is in changing only one thing so you know what caused the result.

You don't need a statistician on staff. You need a hypothesis, two versions, and the patience to wait for enough traffic.

${SVG_AB_LOOP}

## Run the loop

1. **Write a hypothesis.** "A shorter headline will lift signups because visitors get the promise faster." A guess with a reason, not a hunch.
2. **Change one thing.** Make version B differ from version A in exactly one element. Two changes and you'll never know which one worked.
3. **Split the traffic.** Send half your visitors to each version, at the same time. Same audience, same source, same days — or you're measuring the calendar, not the copy.
4. **Measure the action.** Track the conversion you actually care about, not clicks on the way to it.
5. **Ship the winner.** When one version clearly wins, make it the default. Then start again on the next element.

## Test the things that move first

Don't start with button color. Start where the leverage is:

- **The headline.** It's the first thing read and the most likely to change behavior.
- **The CTA.** Wording and placement both matter.
- **The hero.** What you lead with sets the whole frame.

Save the small stuff for when the big stuff is settled.

## Wait for enough traffic

The most common mistake is calling a winner too early. A page with twelve visitors and a "20% lift" is telling you nothing. Let the test run until each version has enough conversions that the result would hold if you ran it again. If your traffic is thin, test bigger, more obvious changes — small differences need big samples to detect.

## Keep a record

Write down every test: the hypothesis, the change, the result. Losing tests are data too — they tell you what your audience doesn't care about, which is half of knowing what they do.

A/B testing is a loop, not a project: hypothesize, change one thing, split traffic, measure, ship. Run it on the headline and the CTA first, wait for real numbers, and keep notes. In LP Studio you can spin up variants and split traffic without wiring anything up. [Create your workspace](https://app.lpstudio.ai) and run your first test this week.`,
  },
  {
    slug: "how-to-brief-an-ai-to-build-an-on-brand-page",
    title: "How to brief an AI to build an on-brand page (prompts that work)",
    excerpt:
      "Brief an AI well and it builds an on-brand page; brief it vaguely and it guesses. Give it four things — the audience, the one action, the proof it's allowed to use, and your constraints — and you'll get a usable draft on the first try.",
    authorName: "LP Studio",
    tags: ["AI generation", "prompts"],
    seoTitle: "How to brief an AI to build an on-brand page: prompts that work",
    seoDescription:
      "Give an AI the audience, the one action, the proof it can use, and your constraints, and it builds an on-brand page. Here's the brief that works.",
    readingTimeMin: 5,
    publishedDaysAgo: 1,
    body: `Brief an AI well and it builds an on-brand page. Brief it vaguely and it guesses — and its guesses are generic. The difference is four things: the audience, the one action, the proof it's allowed to use, and your constraints. Give it those and you'll get a usable draft on the first try.

A good brief isn't longer. It's more specific about the things that actually shape a page.

${SVG_PROMPT_ANATOMY}

## Give it the four things

- **Audience.** Who is this for, and what do they already know? "Dentists evaluating an intraoral scanner" produces a sharper page than "potential customers."
- **One action.** Name the single thing you want them to do. The model will build the whole page toward it.
- **Proof it can use.** Hand it the real facts, numbers, and quotes. This is what keeps it honest — it can only claim what you give it.
- **Constraints.** Tone, length, words to avoid, sections to include. The fences that keep the draft on-brand.

Miss one and the model fills the gap with an average of everything it's seen. That's where generic copy comes from.

## Write the prompt like a brief

Here's the shape that works:

\`\`\`
Write a landing page for [audience] who currently [situation].
The one action is [action].
Use only these facts: [list]. Do not invent statistics.
Voice: [rules]. Avoid: [words]. Include sections: [list].
\`\`\`

Notice what's doing the work: concrete audience, one action, a closed set of facts, explicit constraints. Everything the model needs to stop guessing.

## Lead with the answer

Tell the model to put the promise in the first two sentences. Both readers and AI engines reward pages that answer the question up front instead of warming up to it. It's good for conversion and good for getting cited.

## Edit the draft, don't accept it

The first draft is a starting point, not a final page. Read it for two things: is every claim one you actually authorized, and does it lead with the point? Fix those, sharpen the headline, and ship. The model gets you to 80% in a minute so you can spend your time on the 20% that matters.

A good brief gives the model an audience, one action, the proof it can use, and your constraints — then you edit for truth and focus. Do that and AI builds on-brand pages instead of average ones. In LP Studio the brand and approved facts are already wired in, so the brief is half-written for you. [Create your workspace](https://app.lpstudio.ai) and brief your first page.`,
  },
];
