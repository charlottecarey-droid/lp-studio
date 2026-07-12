/**
 * Dead-link resolution (July 2026, launch-prep).
 *
 * The block-schema prompts deliberately teach the model `ctaUrl ("#")` and
 * `navLinks [{label, href ("#")}]` as placeholders. Tenants with a
 * `defaultCtaUrl` get CTAs rewritten by prompt instruction, but nav links
 * never resolve for anyone, and prompt-only rules leak — the pre-publish
 * check's first live run found 5 dead "#" links on one generated page
 * (mega-menu navbar especially). This is the deterministic POST-PARSE pass
 * (post-parse lock beats prompt-only, same reasoning as
 * enforceRecipeHeroFidelity): it runs on the parsed blocks right before the
 * sentence-case normalizer and leaves nothing pointing at "#".
 *
 * Resolution rules ("empty beats dead" — a link we can't ground gets dropped,
 * never left broken):
 *   • Nav-link items ({label, url|href} objects, found recursively, so
 *     mega-menu `menuGroups[].links[]` are covered): the label is matched to
 *     a page section by topic (pricing → a pricing block, FAQ → a faq block,
 *     …). A match assigns the target block a `blockSettings.anchorId` (the
 *     viewer wraps anchored blocks in <div id=…>) and rewrites the link to
 *     "#<anchor>". Conversion-flavored labels (Contact, Get started, Book a
 *     demo…) prefer the page's form block, then the tenant defaultCtaUrl.
 *     No target → the item is REMOVED from its array.
 *   • Paired CTA props (ctaUrl↔ctaText/ctaLabel, navCtaUrl↔navCtaText, …):
 *     resolved via tenant defaultCtaUrl first (explicit config), then the
 *     form-block anchor. No target → BOTH the url and its label are cleared,
 *     which hides the button (a dead button is worse than no button).
 *     Blocks whose ctaAction/ctaMode is non-URL (chilipiper, modal-form,
 *     video…) are skipped — the url is inert there, and this pass must never
 *     flip CTA actions (capability-aware Page CTA lesson: never assume a
 *     block can render an action it wasn't configured for).
 *   • `redirectUrl` (form post-submit) is left alone — "#" means "no
 *     redirect" there. `featuredUrl` ("#") is cleared (card not clickable).
 *
 * Anchors are only assigned to TOP-LEVEL blocks (the viewer's anchor wrapper
 * is per-rendered-block; nested children stay out to keep ids predictable).
 * Existing anchorIds are reused; new ones dedupe against everything on the
 * page. Real values ("#pricing", "https://…", "/path", "mailto:…") are never
 * touched — only exactly "#" (and, for labeled links, "").
 */

export interface DeadLinkBlock {
  id?: string;
  type: string;
  props?: Record<string, unknown>;
  blockSettings?: Record<string, unknown> | null;
  children?: DeadLinkBlock[] | null;
}

export interface DeadLinkFixResult {
  /** Nav-link items rewritten to a section anchor / conversion target. */
  anchored: number;
  /** CTA props resolved to the defaultCtaUrl or the form anchor. */
  resolved: number;
  /** Nav-link items removed / CTA buttons hidden — nothing to point at. */
  dropped: number;
  /** Per-fix breadcrumbs for logging, e.g. `mega-menu-nav:links "Pricing" → #pricing`. */
  details: string[];
}

/** CTA url→label prop pairs seen across the block library. Only these are
 *  treated as clearable buttons; unknown `*Url` keys are left alone. */
const CTA_PAIRS: ReadonlyArray<{ url: string; labels: string[]; action?: string[] }> = [
  { url: "ctaUrl", labels: ["ctaText", "ctaLabel"], action: ["ctaAction", "ctaMode"] },
  { url: "ctaSecondaryUrl", labels: ["ctaSecondaryText"], action: ["ctaSecondaryAction"] },
  { url: "navCtaUrl", labels: ["navCtaText"] },
  { url: "navSignInUrl", labels: ["navSignInText"] },
  { url: "buttonUrl", labels: ["buttonText", "buttonLabel"] },
  { url: "primaryCtaUrl", labels: ["primaryCtaText"], action: ["primaryCtaAction"] },
  { url: "secondaryCtaUrl", labels: ["secondaryCtaText"], action: ["secondaryCtaAction"] },
];

/** Actions for which the url prop is the live destination. Anything else
 *  (chilipiper, modal-form, video-modal, …) makes the url inert — skip. */
const URL_ACTIONS = new Set(["", "url", "link", "anchor"]);

/** Section topics an in-page nav link can point at. Order = specificity. */
const TOPIC_RULES: ReadonlyArray<{ topic: string; anchor: string; types: RegExp; labels: RegExp }> = [
  { topic: "pricing", anchor: "pricing", types: /pricing/, labels: /pricing|^plans?$|^prices?$/ },
  { topic: "faq", anchor: "faq", types: /faq/, labels: /faq|questions/ },
  { topic: "how-it-works", anchor: "how-it-works", types: /how-it-works|pilot-steps|stepper|timeline/, labels: /how it works|process|workflow|how we work/ },
  { topic: "testimonials", anchor: "testimonials", types: /testimonial|quote|review|rating|avatar-social/, labels: /testimonials?|reviews?|customers?|stories|loved/ },
  { topic: "results", anchor: "results", types: /case-stud|stat-callout|stat-counter|stat-row|metrics|roi-calculator/, labels: /results|case stud|impact|roi|proof/ },
  { topic: "resources", anchor: "resources", types: /resources|blog|content-series|webinar/, labels: /resources|blog|guides?|learn|insights/ },
  { topic: "about", anchor: "about", types: /about-team|speaker-grid/, labels: /about|team|company|who we are/ },
  { topic: "video", anchor: "video", types: /video-section|media-video/, labels: /watch|video|demo video/ },
  // Broad feature-ish match LAST so "Pricing"/"FAQ" never lands here.
  { topic: "features", anchor: "features", types: /feature|benefit|zigzag|comparison|switchback|vertical-tabs|product-grid|product-showcase|glass-bento|dandy-columns/, labels: /features?|solutions?|products?|platform|capabilities|services|what (we|you) (do|get)/ },
];

/** Labels that mean "take me to the conversion point". */
const CONVERSION_LABEL = /contact|get started|start|demo|book|talk|sign ?up|quote|schedule|apply|join|trial|reserve/;

// Dedicated capture blocks — always render a form, so they're valid anchor
// targets for conversion CTAs. split-form-final-cta captures inline (its
// email field IS the conversion); blocks that merely OFFER an email-capture
// ctaStyle don't belong here.
const FORM_BLOCK_TYPES = new Set(["form", "id-form", "dandy-form-right-alt", "split-form-final-cta"]);

function isDeadUrl(v: unknown): boolean {
  return typeof v === "string" && (v.trim() === "#" || v.trim() === "");
}

/** {label, url|href} object with a dead destination — a nav-link item. */
function asDeadLinkItem(v: unknown): { label: string; urlKey: "url" | "href" } | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  if (typeof o.label !== "string" || !o.label.trim()) return null;
  const urlKey = typeof o.url === "string" ? "url" : typeof o.href === "string" ? "href" : null;
  if (!urlKey) return null;
  if (!isDeadUrl(o[urlKey])) return null;
  return { label: o.label, urlKey };
}

function slugCollisions(blocks: DeadLinkBlock[]): Set<string> {
  const used = new Set<string>();
  for (const b of blocks) {
    const a = b.blockSettings?.anchorId;
    if (typeof a === "string" && a) used.add(a);
  }
  return used;
}

export function resolveDeadGeneratedLinks(
  blocks: DeadLinkBlock[],
  opts: { defaultCtaUrl?: string | null } = {},
): DeadLinkFixResult {
  const result: DeadLinkFixResult = { anchored: 0, resolved: 0, dropped: 0, details: [] };
  if (!Array.isArray(blocks) || blocks.length === 0) return result;

  const defaultCtaUrl =
    typeof opts.defaultCtaUrl === "string" && opts.defaultCtaUrl.trim() && opts.defaultCtaUrl.trim() !== "#"
      ? opts.defaultCtaUrl.trim()
      : null;

  const usedAnchors = slugCollisions(blocks);
  const anchorCache = new Map<string, string | null>(); // topic → "#anchor" | null

  /** Anchor the first TOP-LEVEL block matching `types`; cached per topic. */
  const anchorForTopic = (topic: string, anchor: string, types: RegExp): string | null => {
    if (anchorCache.has(topic)) return anchorCache.get(topic)!;
    const target = blocks.find((b) => typeof b.type === "string" && types.test(b.type));
    if (!target) {
      anchorCache.set(topic, null);
      return null;
    }
    let id = typeof target.blockSettings?.anchorId === "string" && target.blockSettings.anchorId
      ? (target.blockSettings.anchorId as string)
      : null;
    if (!id) {
      id = anchor;
      for (let n = 2; usedAnchors.has(id); n++) id = `${anchor}-${n}`;
      usedAnchors.add(id);
      target.blockSettings = { ...(target.blockSettings ?? {}), anchorId: id };
    }
    const href = `#${id}`;
    anchorCache.set(topic, href);
    return href;
  };

  /** "#<form anchor>" pointing at the first form block, or null. */
  const formAnchor = (): string | null =>
    anchorForTopic("__form", "get-started", new RegExp(`^(${[...FORM_BLOCK_TYPES].join("|")})$`));

  /** Destination for a conversion-flavored NAV link: in-page form first. */
  const navConversionTarget = (): string | null => formAnchor() ?? defaultCtaUrl;
  /** Destination for a button CTA: explicit tenant config first. */
  const ctaTarget = (): string | null => defaultCtaUrl ?? formAnchor();

  const resolveNavLabel = (label: string): string | null => {
    const l = label.trim().toLowerCase();
    if (CONVERSION_LABEL.test(l)) return navConversionTarget();
    for (const rule of TOPIC_RULES) {
      if (rule.labels.test(l)) {
        const href = anchorForTopic(rule.topic, rule.anchor, rule.types);
        if (href) return href;
      }
    }
    return null;
  };

  /** Recursively fix link-item arrays inside a props tree (nav `links`,
   *  mega-menu `menuGroups[].links`, hero `navLinks`, …). */
  const fixLinkArrays = (node: unknown, blockType: string, path: string): unknown => {
    if (Array.isArray(node)) {
      const kept: unknown[] = [];
      for (const item of node) {
        const link = asDeadLinkItem(item);
        if (!link) {
          kept.push(fixLinkArrays(item, blockType, path));
          continue;
        }
        const dest = resolveNavLabel(link.label);
        if (dest) {
          (item as Record<string, unknown>)[link.urlKey] = dest;
          kept.push(item);
          result.anchored++;
          result.details.push(`${blockType}:${path} "${link.label}" → ${dest}`);
        } else {
          result.dropped++;
          result.details.push(`${blockType}:${path} "${link.label}" dropped (no target)`);
        }
      }
      return kept;
    }
    if (node && typeof node === "object") {
      const o = node as Record<string, unknown>;
      for (const [k, v] of Object.entries(o)) {
        if (Array.isArray(v) || (v && typeof v === "object")) {
          o[k] = fixLinkArrays(v, blockType, path ? `${path}.${k}` : k);
        }
      }
    }
    return node;
  };

  const fixCtaPairs = (block: DeadLinkBlock): void => {
    const props = block.props;
    if (!props || typeof props !== "object") return;
    for (const pair of CTA_PAIRS) {
      const url = props[pair.url];
      if (!isDeadUrl(url)) continue;
      const labelKey = pair.labels.find((k) => typeof props[k] === "string" && (props[k] as string).trim());
      if (!labelKey) continue; // no visible button — nothing dead to fix
      const action = pair.action?.map((k) => props[k]).find((v) => typeof v === "string" && v);
      if (typeof action === "string" && !URL_ACTIONS.has(action)) continue; // url is inert
      const dest = ctaTarget();
      if (dest) {
        props[pair.url] = dest;
        result.resolved++;
        result.details.push(`${block.type}:${pair.url} → ${dest}`);
      } else {
        props[pair.url] = "";
        props[labelKey] = "";
        result.dropped++;
        result.details.push(`${block.type}:${pair.url} button hidden (no target)`);
      }
    }
    // Featured card link (mega-menu): "#" makes the whole card a dead link.
    if (isDeadUrl(props.featuredUrl) && typeof props.featuredUrl === "string" && props.featuredUrl.trim() === "#") {
      props.featuredUrl = "";
      result.dropped++;
      result.details.push(`${block.type}:featuredUrl cleared`);
    }
  };

  const visit = (list: DeadLinkBlock[]): void => {
    for (const block of list) {
      if (!block || typeof block !== "object") continue;
      if (block.props && typeof block.props === "object") {
        // redirectUrl means "no redirect" when "#" — shield it from the walk.
        const { redirectUrl, ...rest } = block.props as Record<string, unknown>;
        fixLinkArrays(rest, block.type, "");
        Object.assign(block.props, rest);
        fixCtaPairs(block);
        void redirectUrl;
      }
      if (Array.isArray(block.children)) visit(block.children);
    }
  };

  visit(blocks);
  return result;
}
