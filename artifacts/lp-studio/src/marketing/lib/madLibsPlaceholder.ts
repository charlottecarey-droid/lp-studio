import { useEffect, useState } from "react";

// 14 templates — mix of sentence structures so the placeholder doesn't
// feel like the same shape every time. Each has exactly one {subject} slot.
const templates = [
  // Verb-first action
  "Build a pilot landing page for {subject}",
  "Design a microsite for {subject}",
  "Make a business case for {subject}",
  "Spin up a one-pager about {subject}",
  "Create an event landing for {subject}",

  // Subject-first
  "{subject}'s Q4 renewal page",
  "{subject}'s expansion announcement",
  "{subject}, but as a hero block",

  // Outcome-first
  "Get {subject} to book a demo",
  "Convince {subject} to upgrade — one-pager",

  // Casual / conversational
  "Make me something for {subject} that doesn't sound generic",
  "I need a page for the {subject} thing — punchy",

  // Specific format
  "Case study about {subject} — short version",
  "Comparison page: us vs the legacy stack, for {subject}",
];

// Subjects are SPLIT into two arrays so the picker can weight selection:
// outlandish/personality subjects should surface ~1 in 10 placeholders,
// not equal-probability with serious ones. With auto-rotation, equal
// weighting would make the page feel jokey; capped weighting keeps it
// B2B-credible while still surfacing personality regularly.

// 35 serious B2B subjects — picked ~90% of the time.
// Avoid famous fictional company names (Northwind, Initech, Acme, Vandelay).
// Lean on plausible-sounding generic business names + descriptive scenarios.
const seriousSubjects = [
  // SaaS / tech (10)
  "Atlas Logistics' Q2 platform migration",
  "the Northstar Devtools partnership",
  "our top 10 enterprise accounts in retail",
  "mid-market HR tech buyers",
  "the Pinnacle Cloud expansion",
  "a Series B fintech we're piloting with",
  "RevOps leads at companies under 500",
  "developer relations teams scaling past 50",
  "AI ops platforms doing enterprise sales",
  "vertical SaaS founders considering ABM",

  // Healthcare / dental / vet (6)
  "the Smilist's 16-location rollout",
  "Bright Smile DSO's pilot",
  "Mercer Veterinary's Q4 growth plan",
  "Heartland Dental's renewal cycle",
  "a 200-clinic urgent care network",
  "specialty pediatric practices",

  // Field services (5)
  "ServiceTitan-style HVAC operators",
  "the Q3 plumbing-tech roundup",
  "our top 5 home services accounts",
  "regional roofing contractors at $10M+ ARR",
  "a national pool service expansion",

  // Finance / insurance (4)
  "B2B insurance buyers post-renewal",
  "lending platforms targeting SMBs",
  "the Q4 risk-mgmt conference outreach",
  "credit unions over $5B in assets",

  // Marketing / agencies (4)
  "an in-house creative team of 12",
  "demand gen leaders at mid-market SaaS",
  "agencies pitching the holding-co RFP",
  "the Q4 'state of ABM' content push",

  // Generic / scenario (5)
  "our top 10 renewal accounts",
  "the partnership we just signed",
  "anyone evaluating us against the legacy stack",
  "the prospects on this week's pipeline",
  "Q4 outbound to our ICP",
];

// 19 outlandish/personality subjects — picked ~10% of the time only.
// These are deliberately specific (not generic "weird products") and
// plausible-real-adjacent ("could almost be a real bored startup pivot").
const outlandishSubjects = [
  "our experimental llama-themed pricing tier",
  "the office's new 18-foot pinball machine",
  "the Q4 'whose dishes are these' campaign",
  "our line of ergonomic cat keyboards",
  "the new espresso machine, marketed as B2B SaaS",
  "the dog who comes to work on Tuesdays",
  "the haunted printer on floor 3",
  "Susan from accounting's farewell tour",
  "the Tuesday 'did you eat my lunch' situation",
  "the conference room booking war of '26",
  "our quarterly mandatory escape room initiative",
  "the chatbot we built to apologize for our other chatbot",
  "our new B2B SaaS marketplace for B2B SaaS marketplaces",
  "the AI we trained on our CEO's Slack messages",
  "our launch page generator's own launch page",
  "our pivot into NFT trading cards for accountants",
  "our line of corporate-branded hot sauces",
  "the dental SaaS we built for cats",
  "our pet insurance product for houseplants",
];

// 14 qualifiers — empty 4/14 of the time (~28% no qualifier), otherwise
// adds a short voice/tone instruction after the main clause. Always
// starts with " — " so grammar stays valid no matter what template ran.
const qualifiers = [
  "", "", "", "",
  " — heavy on the ROI",
  " — for the legal team",
  " — keep it short",
  " — lean into urgency",
  " — for the C-suite, not procurement",
  " — don't mention pricing",
  " — punchy, under 200 words",
  " — match their voice, not ours",
  " — make it scannable",
  " — outcomes first, features last",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Weighted subject picker — outlandish/personality subjects appear at most
 * ~10% of the time (1 in 10 placeholders). Keeps the page B2B-credible
 * while still surfacing personality regularly under auto-rotation.
 */
function pickSubject(): string {
  return Math.random() < 0.1 ? pick(outlandishSubjects) : pick(seriousSubjects);
}

export function generatePlaceholder(): string {
  const template = pick(templates);
  const subject = pickSubject();
  const qualifier = pick(qualifiers);
  return template.replace("{subject}", subject) + qualifier;
}

export interface MadLibsPlaceholder {
  /** The current placeholder text to render. */
  text: string;
  /** Drives a crossfade: drops to false just before each swap, back to true
   *  after the new text is set. Bind to an overlay's opacity for an ease. */
  visible: boolean;
}

/**
 * Auto-rotating Mad-Libs placeholder. Starts from a fixed default on first
 * paint (avoids SSR/prerender hydration mismatches), swaps to a random combo
 * once mounted, then rotates to a fresh combo on an interval so visitors see
 * a variety of examples. Each swap fades out then in (via `visible`) so the
 * change eases instead of snapping. Pass `paused` (e.g. when the field is
 * focused or has text) to freeze rotation so the user isn't fighting a moving
 * target.
 */
export function useMadLibsPlaceholder(
  paused = false,
  intervalMs = 3600,
  fadeMs = 320,
): MadLibsPlaceholder {
  const [text, setText] = useState<string>("Describe the landing page you want");
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // Pick an initial random combo on mount (post-hydration).
    setText(generatePlaceholder());
  }, []);

  useEffect(() => {
    if (paused) {
      setVisible(true);
      return;
    }
    let fadeTimer: ReturnType<typeof setTimeout>;
    const cycle = setInterval(() => {
      // Fade the current text out, swap underneath, then fade the new one in.
      setVisible(false);
      fadeTimer = setTimeout(() => {
        setText(generatePlaceholder());
        setVisible(true);
      }, fadeMs);
    }, intervalMs);
    return () => {
      clearInterval(cycle);
      clearTimeout(fadeTimer);
    };
  }, [paused, intervalMs, fadeMs]);

  return { text, visible };
}
