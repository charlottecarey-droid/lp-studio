import { useEffect, useState, useRef, useCallback, useMemo, Component, type ReactNode, type ErrorInfo } from "react";
import { motion, useInView, type TargetAndTransition } from "framer-motion";
import { safeNavigate } from "@/lib/safe-url";
import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useGetPageConfig, useTrackEvent, type LinkedPage } from "@workspace/api-client-react";
import { useVisitorSession } from "@/hooks/use-visitor-session";
import { 
  Loader2, 
  ArrowRight, 
  ShieldCheck, 
  Zap, 
  ScanLine, 
  RefreshCcw, 
  HeadphonesIcon, 
  BarChart2, 
  DollarSign, 
  XCircle, 
  AlertTriangle, 
  Quote,
  CheckCircle2,
  ChevronDown
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ExtendedVariantConfig, BuilderPageResponse } from "@/lib/page-types";
import { isBuilderPageResponse } from "@/lib/page-types";
import { useHeatmapTracker } from "@/hooks/use-heatmap-tracker";
import { BrandLogo } from "@/components/BrandLogo";
import { fetchBrandConfig, DEFAULT_BRAND, getButtonClasses, getBrandStyleVars, getBrandButtonCss, getBrandSurfaceCss, resolveOnePagerColors, SECTION_PY, type BrandConfig } from "@/lib/brand-config";
import { CustomBlocksProvider, customBlockRowToSource, type CustomBlockSource } from "@/lib/custom-blocks-context";
import { useAuth } from "@/context/AuthContext";
import { BrandFontLoader } from "@/components/BrandFontLoader";
import { BlockRenderer, NO_REVEAL } from "@/blocks/BlockRenderer";
import { ChiliPiperModal } from "@/blocks/ChiliPiperModal";
import { LinkedFormStyleProvider } from "@/components/LinkedFormStyleContext";
import { readLinkedFormStyle } from "@/lib/linked-form-style";
import { getDtrParams, applyDtr } from "@/lib/dtr";

// Builder pages that contain the one-pager hero are sales one-pagers, not
// landing pages. They should read like a printed document — a centered,
// fixed-width "sheet" on a neutral backdrop — instead of stretching full-bleed
// across wide screens. We avoid `overflow-hidden` here so any block using
// position:sticky inside the sheet keeps working.
const ONE_PAGER_BLOCK_TYPES = new Set(["one-pager-hero"]);
// Page-chrome blocks that may legitimately precede the hero without changing
// the page's layout identity (a nav / sticky bar above a one-pager hero still
// makes a one-pager).
const ONE_PAGER_LEADING_CHROME = new Set([
  "nav-header", "sticky-header", "sticky-bar", "popup", "dandy-site-header",
]);
// A page reads as an interactive one-pager only when it LEADS with the
// one-pager hero — the structural signature of a generated / sales one-pager.
// The `one-pager-hero` block carries the generic "hero" role tag, so the AI
// page builder can drop it into a regular landing page as a mid-page section.
// We must NOT treat those landing pages as one-pagers (doing so squeezes their
// full-bleed design into the centered PDF-like sheet). Only the leading content
// block decides the layout; a buried one-pager-hero leaves the page full-bleed.
function isOnePagerLayout(blocks: { type: string }[]): boolean {
  const lead = blocks.find((b) => !ONE_PAGER_LEADING_CHROME.has(b.type));
  return !!lead && ONE_PAGER_BLOCK_TYPES.has(lead.type);
}
// On the One Pager sheet, content blocks carry a generous fixed horizontal
// padding (paddingX "md" = 40px) so they line up with the hero band's internal
// text inset on desktop. That fixed inset is too tight on phones (40px + each
// block's own ~24px inner padding eats most of a ~390px screen). This scoped
// rule dials the block paddingX down on narrow viewports so content reads ~28px
// from the edge — matching the hero's mobile inset — while desktop is untouched.
// Scoped to `.one-pager-frame` so non-One-Pager landing pages keep their spacing.
const ONE_PAGER_MOBILE_PADDING = `
  @media (max-width: 768px) {
    .one-pager-frame [data-blk-px] {
      padding-left: 4px !important;
      padding-right: 4px !important;
    }
  }
`;
function OnePagerFrame({ active, bg, children }: { active: boolean; bg?: string; children: ReactNode }) {
  if (!active) return <>{children}</>;
  return (
    <div className="one-pager-frame bg-muted/40 min-h-screen md:py-10">
      <style>{ONE_PAGER_MOBILE_PADDING}</style>
      <div
        className="mx-auto w-full max-w-[960px] bg-background md:shadow-[0_10px_50px_-15px_rgba(0,0,0,0.25)] md:ring-1 md:ring-border/50"
        style={bg ? { background: bg } : undefined}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Task #547 — small, unobtrusive provenance footer rendered on every published
 * microsite: "Sent by [Tenant] for [Target Account]" (falls back to "Sent by
 * [Tenant]" with no account). Signals to crawlers + human reviewers that the
 * page is legitimate personalized B2B outreach, not brand impersonation.
 *
 * Rendered inside the SPA so the prerendered R2 snapshot captures it too —
 * keeping the live and prerendered paths in sync without a separate injection.
 * Brand-styled via the page's `--brand-*` CSS vars so it never clashes.
 * Server omits `provenance` for the Dandy tenant, so this renders nothing there.
 */
function ProvenanceBanner({
  provenance,
}: {
  provenance?: { tenantName: string; accountName: string | null } | null;
}) {
  if (!provenance?.tenantName) return null;
  return (
    <div
      data-lp-provenance="1"
      className="w-full border-t border-black/10 bg-[var(--brand-surface,#f8fafc)] px-4 py-3 text-center text-[11px] leading-relaxed text-black/55"
    >
      <span>
        Sent by{" "}
        <span className="font-semibold text-[var(--brand-primary,inherit)]">
          {provenance.tenantName}
        </span>
        {provenance.accountName ? (
          <>
            {" "}for{" "}
            <span className="font-semibold text-[var(--brand-primary,inherit)]">
              {provenance.accountName}
            </span>
          </>
        ) : null}
      </span>
    </div>
  );
}

/** Catches render errors in individual blocks so one bad block can't blank the entire page. */
class BlockErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }
  componentDidCatch(err: Error, info: ErrorInfo) {
    console.error("[BlockErrorBoundary] block render error:", err, info.componentStack);
  }
  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

/**
 * Scope all selectors in a CSS string with a prefix attribute selector.
 * Handles: selector lists, @media rules (scoping inner rules), @keyframes
 * (left as-is), :root (replaced with prefix), and top-level rules.
 */
function scopeCustomCss(css: string, scope: string): string {
  const AT_RULE_PASSTHROUGH = /^@(keyframes|font-face|charset|import|namespace|layer)\b/i;

  function scopeSelector(sel: string): string {
    return sel
      .split(",")
      .map(s => {
        const trimmed = s.trim();
        if (!trimmed) return "";
        if (trimmed === ":root") return scope;
        if (trimmed.startsWith(":root")) return `${scope}${trimmed.slice(5)}`;
        return `${scope} ${trimmed}`;
      })
      .filter(Boolean)
      .join(", ");
  }

  function processBlock(css: string): string {
    let result = "";
    let i = 0;
    while (i < css.length) {
      const remaining = css.slice(i);

      const commentMatch = remaining.match(/^\/\*[\s\S]*?\*\//);
      if (commentMatch) {
        result += commentMatch[0];
        i += commentMatch[0].length;
        continue;
      }

      const atMatch = remaining.match(/^(@[^{;]+)\s*(\{|;)/);
      if (atMatch) {
        const directive = atMatch[1].trim();
        const terminator = atMatch[2];
        i += atMatch[0].length;

        if (terminator === ";") {
          result += atMatch[0];
          continue;
        }

        const blockStart = i;
        let depth = 1;
        while (i < css.length && depth > 0) {
          if (css[i] === "{") depth++;
          else if (css[i] === "}") depth--;
          i++;
        }
        const innerBlock = css.slice(blockStart, i - 1);

        if (AT_RULE_PASSTHROUGH.test(directive)) {
          result += `${directive} {${innerBlock}}`;
        } else {
          result += `${directive} {${processBlock(innerBlock)}}`;
        }
        continue;
      }

      const ruleMatch = remaining.match(/^([^{]+)\{/);
      if (ruleMatch) {
        const selector = ruleMatch[1].trim();
        i += ruleMatch[0].length;
        const declStart = i;
        let depth = 1;
        while (i < css.length && depth > 0) {
          if (css[i] === "{") depth++;
          else if (css[i] === "}") depth--;
          i++;
        }
        const declarations = css.slice(declStart, i - 1);
        if (selector) {
          result += `${scopeSelector(selector)} {${declarations}}`;
        }
        continue;
      }

      result += css[i];
      i++;
    }
    return result;
  }

  return processBlock(css);
}

const DANDY_VIDEO_URL = window.location.origin + "/dandy-lab-video-2/";

type AnimationStyle = "fade-up" | "fade-in" | "slide-left" | "slide-right" | "scale-in" | "none";

type AnimVariant = { initial: TargetAndTransition; animate: TargetAndTransition };
const ANIMATION_VARIANTS: Record<AnimationStyle, AnimVariant> = {
  "fade-up":    { initial: { opacity: 0, y: 40 },   animate: { opacity: 1, y: 0 } },
  "fade-in":    { initial: { opacity: 0 },           animate: { opacity: 1 } },
  "slide-left": { initial: { opacity: 0, x: -60 },  animate: { opacity: 1, x: 0 } },
  "slide-right":{ initial: { opacity: 0, x: 60 },   animate: { opacity: 1, x: 0 } },
  "scale-in":   { initial: { opacity: 0, scale: 0.92 }, animate: { opacity: 1, scale: 1 } },
  "none":       { initial: {}, animate: {} },
};

const EASE = [0.16, 1, 0.3, 1] as const;

function ScrollReveal({
  children,
  delay = 0,
  style = "fade-up",
  enabled = true,
}: {
  children: React.ReactNode;
  delay?: number;
  style?: AnimationStyle;
  enabled?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.08 });

  if (!enabled || style === "none") return <>{children}</>;
  const { initial, animate } = ANIMATION_VARIANTS[style] ?? ANIMATION_VARIANTS["fade-up"];
  return (
    <motion.div
      ref={ref}
      initial={initial}
      animate={isInView ? animate : initial}
      transition={{ duration: 0.65, ease: EASE, delay: delay / 1000 }}
    >
      {children}
    </motion.div>
  );
}

function useParallax(strength = 0.25) {
  const ref = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);
  const handler = useCallback(() => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    animRef.current = requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const offset = (rect.top / window.innerHeight) * strength * 100;
      el.style.transform = `translateY(${offset.toFixed(2)}px)`;
    });
  }, [strength]);
  useEffect(() => {
    window.addEventListener("scroll", handler, { passive: true });
    return () => { window.removeEventListener("scroll", handler); cancelAnimationFrame(animRef.current); };
  }, [handler]);
  return ref;
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Zap,
  ScanLine,
  RefreshCcw,
  HeadphonesIcon,
  BarChart2,
  DollarSign,
};

// Deep-replace {{var}} placeholders in any JSON structure (blocks, props, etc.)
function deepApplyVars(value: unknown, vars: Record<string, string>): unknown {
  if (typeof value === "string") {
    let result = value;
    for (const [k, v] of Object.entries(vars)) result = result.split(k).join(v);
    return result;
  }
  if (Array.isArray(value)) return value.map(item => deepApplyVars(item, vars));
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, deepApplyVars(v, vars)]),
    );
  }
  return value;
}

export default function LandingPageViewer() {
  const [, paramsLp] = useRoute("/lp/:slug");
  const [, paramsPreview] = useRoute("/preview/:slug");
  const [, paramsShort] = useRoute("/:slug");
  const slug = paramsPreview?.slug || paramsLp?.slug || paramsShort?.slug || "";

  // Draft preview route (/preview/:slug). Always non-tracked, fetches from
  // the auth/token-gated /api/lp/preview/:slug endpoint instead of the
  // public /api/lp/page/:slug. Renders draft pages — the live URL never
  // does. See task-107 (Stop drafts from leaking publicly).
  const isPreviewRoute = !!paramsPreview;

  // Preview mode: ?previewVariantId=123 forces a specific variant, no tracking
  const searchParams = new URLSearchParams(window.location.search);
  const previewVariantId = searchParams.get("previewVariantId")
    ? parseInt(searchParams.get("previewVariantId")!, 10)
    : undefined;
  // Review token (passed when a reviewer opens /preview/:slug?reviewToken=…)
  const previewReviewToken = searchParams.get("reviewToken");
  // Either A/B variant preview OR /preview/:slug route disables tracking.
  const isPreviewMode = !!previewVariantId || isPreviewRoute;

  // Personalized link token: ?_plToken=<token> — enables engagement attribution
  const plToken = searchParams.get("_plToken") ?? null;

  // Sales hotlink token: ?hl=<token> — resolves contact for signal attribution
  const hlToken = searchParams.get("hl") ?? null;
  const [hotlinkData, setHotlinkData] = useState<{ hotlinkId: number; contactId: number; accountId: number; contactName: string | null } | null>(null);

  useEffect(() => {
    if (!hlToken) return;
    fetch(`/api/sales/resolve/${hlToken}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data) setHotlinkData(data); })
      .catch(() => {});
  }, [hlToken]);

  const sessionId = useVisitorSession(slug);
  const trackEvent = useTrackEvent();

  const apiParams = isPreviewMode
    ? { previewVariantId }
    : { sessionId };

  // Standard /api/lp/page/:slug fetch (skipped on the /preview/:slug route).
  const standard = useGetPageConfig(
    slug,
    apiParams,
    {
      query: {
        enabled: !!slug && !isPreviewRoute && (isPreviewMode || !!sessionId),
        // Retry transient failures (network blips, brief 5xx, edge cold-start)
        // up to 3 times with exponential backoff capped at 8 s. 404s are
        // surfaced immediately so a missing slug doesn't sit on a spinner.
        // Without this, a single hiccup → "Page Not Found" / blank screen,
        // which is one of the most common drivers of the
        // "something went wrong, please refresh" reports.
        retry: (failureCount, err) => {
          const status = (err as { status?: number } | null)?.status;
          if (status === 404 || status === 410) return false;
          return failureCount < 3;
        },
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
        staleTime: 60_000,
        queryKey: ["pageConfig", slug, apiParams],
      },
    },
  );

  // /preview/:slug fetch — auth-or-token gated, returns drafts. Direct
  // fetch instead of the generated client so we don't have to round-trip
  // openapi codegen for a single endpoint. Response shape mirrors the
  // builder branch of /api/lp/page/:slug. See task-107.
  const previewQuery = useQuery<BuilderPageResponse>({
    queryKey: ["lp-preview", slug, previewReviewToken ?? ""],
    enabled: !!slug && isPreviewRoute,
    // Same retry policy as the public viewer: ride out transient 5xx /
    // network blips, but surface 404/403 immediately so a missing draft
    // doesn't spin forever.
    retry: (failureCount, err) => {
      const status = (err as { status?: number } | null)?.status;
      if (status === 404 || status === 403 || status === 410) return false;
      return failureCount < 3;
    },
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    staleTime: 0,
    queryFn: async () => {
      const url = previewReviewToken
        ? `/api/lp/preview/${encodeURIComponent(slug)}?reviewToken=${encodeURIComponent(previewReviewToken)}`
        : `/api/lp/preview/${encodeURIComponent(slug)}`;
      // 10 s hard timeout so a stalled connection doesn't leave the
      // viewer on the loading spinner indefinitely.
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 10_000);
      let r: Response;
      try {
        r = await fetch(url, { credentials: "include", signal: controller.signal });
      } finally {
        window.clearTimeout(timeoutId);
      }
      if (!r.ok) {
        const err = new Error(`Preview unavailable (${r.status})`) as Error & { status: number };
        err.status = r.status;
        throw err;
      }
      return (await r.json()) as BuilderPageResponse;
    },
  });

  const { data: config, isLoading, error } = isPreviewRoute
    ? { data: previewQuery.data, isLoading: previewQuery.isLoading, error: previewQuery.error }
    : { data: standard.data, isLoading: standard.isLoading, error: standard.error };

  const [hasTrackedImpression, setHasTrackedImpression] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [brand, setBrand] = useState<BrandConfig>(DEFAULT_BRAND);
  // Tracks whether the async brand fetch has resolved at least once. Until
  // it does, we hold back the page render so blocks never paint with neutral
  // DEFAULT_BRAND values (e.g. blue accent) and then snap to the tenant's
  // real palette one frame later. This was causing a visible blue flash
  // and — for blocks that imperatively cache `--brand-accent` at mount time
  // (BlockDsoParticleMesh canvas) — particles would stay blue forever.
  const [brandLoaded, setBrandLoaded] = useState(false);
  const [dtrParams] = useState(() => getDtrParams());
  const [chilipiperUrl, setChilipiperUrl] = useState<string | null>(null);

  // Personalization vars written by the hotlink resolver into sessionStorage (key: `pv:<slug>`)
  const [sessionPageVars] = useState<Record<string, string>>(() => {
    try {
      const raw = sessionStorage.getItem(`pv:${slug}`);
      return raw ? (JSON.parse(raw) as Record<string, string>) : {};
    } catch {
      return {};
    }
  });
  // Page-record variables (lp_pages.pageVariables) — fetched alongside the
  // page payload. These are persisted by the editor (e.g. `__linkedFormStyle`)
  // and must take precedence over session vars for the same key.
  const recordPageVars = useMemo<Record<string, string>>(() => {
    if (!config) return {};
    if (isBuilderPageResponse(config)) {
      return (config as BuilderPageResponse).pageVariables ?? {};
    }
    const av = config.assignedVariant as typeof config.assignedVariant & { linkedPage?: { pageVariables?: Record<string, string> } | null };
    return av?.linkedPage?.pageVariables ?? {};
  }, [config]);
  const pageVars = useMemo<Record<string, string>>(
    () => ({ ...recordPageVars, ...sessionPageVars }),
    [recordPageVars, sessionPageVars]
  );
  const hasPageVars = Object.keys(pageVars).length > 0;

  // RB2B visitor identification — resolves async after page load on partners.meetdandy.com
  const [accountNameRB2B, setAccountNameRB2B] = useState("");
  useEffect(() => {
    // RB2B only loads on partners.meetdandy.com — skip everywhere else
    if (typeof window === "undefined" || !(window as { reb2b?: unknown }).reb2b) return;

    function tryRegister(): boolean {
      const rb2b = (window as { reb2b?: { push?: (fn: () => void) => void } }).reb2b;
      if (!rb2b?.push) return false;
      rb2b.push(function (this: Record<string, string>) {
        const name = this?.company || this?.organization || this?.companyName || "";
        if (name) setAccountNameRB2B(name);
      });
      return true;
    }

    if (!tryRegister()) {
      // Script still loading — poll until ready, give up after 10 s
      const interval = setInterval(() => { if (tryRegister()) clearInterval(interval); }, 300);
      const timeout = setTimeout(() => clearInterval(interval), 10_000);
      return () => { clearInterval(interval); clearTimeout(timeout); };
    }
    return undefined;
  }, []);

  // Merge URL-based vars + Apollo + RB2B into one substitution map.
  // Keys use the {{varName}} literal format consumed by deepApplyVars.
  const enrichedVars = useMemo<Record<string, string>>(() => {
    const apolloName = isBuilderPageResponse(config)
      ? ((config as BuilderPageResponse).accountNameApollo ?? "")
      : "";
    return {
      ...pageVars,
      "{{accountNameApollo}}": apolloName,
      "{{accountNameRB2B}}": accountNameRB2B,
    };
  }, [config, pageVars, accountNameRB2B]);
  const hasEnrichedVars = Object.keys(enrichedVars).length > 0;

  // Derive pageId for heatmap tracking across all render paths
  const heatmapPageId = (() => {
    if (!config) return undefined;
    if (isBuilderPageResponse(config)) return (config as BuilderPageResponse).id;
    const av = config.assignedVariant as typeof config.assignedVariant & { linkedPage?: { id?: number } | null };
    if (av?.linkedPage?.id) return av.linkedPage.id;
    return undefined;
  })();
  useHeatmapTracker(heatmapPageId, sessionId, !isPreviewMode && !!heatmapPageId);

  useEffect(() => {
    let cancelled = false;
    // Pass the slug so the brand endpoint can resolve the tenant from the
    // page record when the request host isn't a tenant microsite (e.g.
    // `app.lpstudio.ai/preview/:slug` review-token views).
    fetchBrandConfig(slug ?? null, undefined, previewReviewToken)
      .then((b) => { if (!cancelled) setBrand(b); })
      .finally(() => { if (!cancelled) setBrandLoaded(true); });
    return () => { cancelled = true; };
  }, [slug, previewReviewToken]);

  // Watchdog — if we're still sitting on the loading spinner after 15 s,
  // surface a friendly "Trouble loading" screen with a retry button instead
  // of leaving the visitor staring at a perpetual spinner. iOS Safari has
  // been observed leaving fetch() hanging indefinitely across network
  // transitions (Wi-Fi ↔ cellular, iCloud Private Relay reconnects, Low
  // Power Mode) — those would otherwise stick the page-config or brand
  // queries forever. This is a last-resort net; the individual fetches
  // (brand-config, domain-context) already have their own bounded timeouts.
  const [spinnerTimedOut, setSpinnerTimedOut] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setSpinnerTimedOut(true), 15000);
    return () => window.clearTimeout(t);
  }, []);

  // Live custom-block sources for `custom-schema` rendering (task #120).
  // Schema-driven custom blocks store only a customBlockId reference, so
  // the renderer needs the live schema/template to interpolate values.
  //
  // Anonymous public visitors don't need this fetch — `/api/lp/custom-blocks`
  // is a tenant-scoped admin endpoint that 401s without a session, and the
  // viewer falls back to the per-instance snapshot embedded in each block's
  // props. Gating on `user` skips a wasted round-trip + console 401 noise on
  // every public pageview (the dominant traffic on partners.meetdandy.com).
  const { user: authUser } = useAuth();
  const [customBlockSources, setCustomBlockSources] = useState<CustomBlockSource[]>([]);
  useEffect(() => {
    if (!authUser) return;
    let cancelled = false;
    fetch("/api/lp/custom-blocks")
      .then(r => (r.ok ? r.json() : []))
      .then((rows: Array<{ id: number; name: string; block_type?: string; props?: Record<string, unknown> | null }>) => {
        if (cancelled) return;
        const sources: CustomBlockSource[] = [];
        for (const row of rows ?? []) {
          const src = customBlockRowToSource(row);
          if (src) sources.push(src);
        }
        setCustomBlockSources(sources);
      })
      .catch(() => { /* viewer falls back to per-instance snapshot */ });
    return () => { cancelled = true; };
  }, [authUser]);

  // ── Page-specific title + OG meta tags ──────────────────────────────────────
  // Updates the browser tab title and social media meta tags as soon as page
  // data is available. This works for JS-enabled crawlers (Twitter/X, Google,
  // some LinkedIn) and fixes the browser tab title for all users.
  // For non-JS bots (Facebook, Slack), route /lp/:slug through the API server's
  // /api/lp/og-preview/:slug endpoint via a Cloudflare Worker.
  useEffect(() => {
    if (!config) return;
    const originalTitle = document.title;

    let pageTitle = "";
    let pageMeta = "";
    let pageOgImage = "";
    let pageRobots: string | null = null;

    if (isBuilderPageResponse(config)) {
      const bp = config as import("@/lib/page-types").BuilderPageResponse;
      pageTitle = bp.metaTitle || bp.title || "";
      pageMeta = bp.metaDescription || "";
      pageOgImage = bp.ogImage || "";
      pageRobots = bp.robots ?? null;
    } else if (config.assignedVariant) {
      pageTitle = (config.assignedVariant as { name?: string }).name || "";
    }

    if (pageTitle) document.title = pageTitle;

    function setOrCreateMeta(selector: string, attrKey: string, attrValue: string, content: string) {
      let el = document.querySelector<HTMLMetaElement>(selector);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attrKey, attrValue);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    }

    if (pageTitle) {
      setOrCreateMeta('meta[property="og:title"]', "property", "og:title", pageTitle);
      setOrCreateMeta('meta[name="twitter:title"]', "name", "twitter:title", pageTitle);
    }
    if (pageMeta) {
      setOrCreateMeta('meta[name="description"]', "name", "description", pageMeta);
      setOrCreateMeta('meta[property="og:description"]', "property", "og:description", pageMeta);
      setOrCreateMeta('meta[name="twitter:description"]', "name", "twitter:description", pageMeta);
    }
    if (pageOgImage) {
      setOrCreateMeta('meta[property="og:image"]', "property", "og:image", pageOgImage);
      setOrCreateMeta('meta[name="twitter:image"]', "name", "twitter:image", pageOgImage);
      setOrCreateMeta('meta[name="twitter:card"]', "name", "twitter:card", "summary_large_image");
    }
    setOrCreateMeta('meta[property="og:url"]', "property", "og:url", window.location.href);

    // Task #494 — robots directive (crawlers only). Mirror the prerendered
    // static HTML: emit a tag ONLY when the resolved state requires it; when
    // fully allowed (pageRobots == null) we REMOVE any tag we previously
    // added so toggling a page back to "allow" doesn't leave a stale noindex.
    const existingRobots = document.querySelector<HTMLMetaElement>('meta[name="robots"][data-lp-managed="1"]');
    if (pageRobots) {
      if (existingRobots) {
        existingRobots.setAttribute("content", pageRobots);
      } else {
        const el = document.createElement("meta");
        el.setAttribute("name", "robots");
        el.setAttribute("data-lp-managed", "1");
        el.setAttribute("content", pageRobots);
        document.head.appendChild(el);
      }
    } else if (existingRobots) {
      existingRobots.remove();
    }

    // Restore on unmount so navigating back to the app doesn't leave stale tags
    return () => {
      document.title = originalTitle;
      const managedRobots = document.querySelector('meta[name="robots"][data-lp-managed="1"]');
      if (managedRobots) managedRobots.remove();
    };
  }, [config]);

  // Task #1103 — runtime tenant favicon override for the live SPA view of a
  // landing page / microsite. The published R2 snapshot bakes the favicon via
  // injectPageMeta, but the live React route swaps the document icon here so a
  // visitor on the JS path sees the tenant's favicon too. A single uploaded
  // image drives the SVG icon, the .ico icon, and the apple-touch-icon. When
  // unset (or the brand hasn't loaded), we restore the default LP Studio icons
  // — including on unmount, so navigating back into the admin shell keeps the
  // LP Studio favicon. Dandy hosts keep their main.tsx swap because their
  // brand_settings carry no faviconUrl.
  useEffect(() => {
    const favicon = (brand.faviconUrl ?? "").trim();
    const svgIcon = document.querySelector<HTMLLinkElement>('link[rel="icon"][type="image/svg+xml"]');
    const icoIcon = document.querySelector<HTMLLinkElement>('link[rel="icon"][type="image/x-icon"]');
    const appleIcon = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
    if (!favicon) return;
    const originals = {
      svg: svgIcon?.getAttribute("href") ?? null,
      ico: icoIcon?.getAttribute("href") ?? null,
      apple: appleIcon?.getAttribute("href") ?? null,
    };
    if (svgIcon) svgIcon.href = favicon;
    if (icoIcon) icoIcon.href = favicon;
    if (appleIcon) appleIcon.href = favicon;
    return () => {
      if (svgIcon && originals.svg !== null) svgIcon.href = originals.svg;
      if (icoIcon && originals.ico !== null) icoIcon.href = originals.ico;
      if (appleIcon && originals.apple !== null) appleIcon.href = originals.apple;
    };
  }, [brand.faviconUrl]);

  useEffect(() => {
    const onScroll = () => { if (window.scrollY > 40) setScrolled(true); };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    // Never track impressions in preview mode
    if (isPreviewMode) return;
    // Builder pages don't carry an `assignedVariant` — only A/B variant
    // configs do. Narrow with isBuilderPageResponse before reading variant
    // fields so the BuilderPageResponse | PageConfig union type-checks.
    if (config && !isBuilderPageResponse(config) && config.assignedVariant && sessionId && !hasTrackedImpression) {
      trackEvent.mutate({
        data: {
          sessionId,
          testId: config.testId,
          variantId: config.assignedVariant.id,
          eventType: "impression",
          ...(hotlinkData ? { hotlinkId: hotlinkData.hotlinkId } : {}),
        }
      });
      setHasTrackedImpression(true);
    }
  }, [config, sessionId, hasTrackedImpression, trackEvent, isPreviewMode, hotlinkData]);

  // Personalized link engagement tracking: scroll depth + CTA clicks via _plToken
  useEffect(() => {
    if (!plToken) return;

    const engagementUrl = `/api/lp/personalized-links/${plToken}/engagement`;

    let maxScrollDepth = 0;
    let ctaClicksDelta = 0;
    let flushTimeout: ReturnType<typeof setTimeout> | null = null;

    function flush() {
      if (maxScrollDepth === 0 && ctaClicksDelta === 0) return;
      const payload = { scrollDepthPct: maxScrollDepth, ctaClicks: ctaClicksDelta };
      ctaClicksDelta = 0;
      fetch(engagementUrl, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), keepalive: true }).catch(() => undefined);
    }

    function scheduleFlush() {
      if (flushTimeout) clearTimeout(flushTimeout);
      flushTimeout = setTimeout(flush, 3000);
    }

    function onScroll() {
      const scrolled = window.scrollY + window.innerHeight;
      const total = document.documentElement.scrollHeight;
      const pct = total > 0 ? Math.round((scrolled / total) * 100) : 0;
      if (pct > maxScrollDepth) {
        maxScrollDepth = Math.min(pct, 100);
        scheduleFlush();
      }
    }

    function onCtaClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest("a[href], button[data-cta]");
      if (anchor) {
        ctaClicksDelta++;
        scheduleFlush();
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("click", onCtaClick, true);
    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flush(); });

    return () => {
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("click", onCtaClick, true);
      window.removeEventListener("beforeunload", flush);
      if (flushTimeout) clearTimeout(flushTimeout);
      flush();
    };
  }, [plToken]);

  if (isLoading || !brandLoaded || (!isPreviewMode && !sessionId)) {
    // Watchdog tripped — surface a friendly retry UI rather than a forever
    // spinner. See the `spinnerTimedOut` declaration above for context.
    if (spinnerTimedOut) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-white px-6">
          <div className="text-center max-w-sm">
            <h1 className="text-xl font-semibold mb-2" style={{ color: "#0A0A0A" }}>
              Trouble loading this page
            </h1>
            <p className="text-sm text-slate-500 mb-6">
              Your connection may have dropped. Please try again.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-lg text-sm font-medium"
              style={{ background: "#0A0A0A", color: "#fff" }}
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        {/* Use an explicit dark color rather than `text-foreground` — public LP
         *  routes don't always inherit tenant theme tokens, which previously
         *  made the spinner invisible (page appeared all-white). */}
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#0A0A0A" }} />
      </div>
    );
  }

  // Defensive: if the page query finished but produced no usable config
  // (e.g. an empty 304 body, a transient network blip, or a query error),
  // never fall through to the variant render branch — it dereferences
  // `config.assignedVariant.config` and would throw a TypeError that
  // surfaces as the top-level Sentry "Something went wrong" screen.
  //
  // When the query finished with a hard error (e.g. /api/lp/page/:slug
  // returned 404 because the slug was never published), show the proper
  // "Page Not Found" screen instead of a perpetual spinner — the dedicated
  // not-found branch further down was unreachable because this defensive
  // branch was returning the spinner first.
  //
  // For the transient case (no error, just no data yet), keep the spinner
  // so React Query has a chance to refetch in the background.
  if (!config || (!isBuilderPageResponse(config) && !config.assignedVariant)) {
    if (error) {
      console.warn("[LandingPageViewer] page config unavailable:", error);
      // Distinguish 404 (slug really doesn't exist) from 5xx / network
      // failures. Previously *any* error → "Page Not Found", which made
      // transient API outages look like missing pages to visitors and was
      // a major driver of "something went wrong, please refresh" reports.
      const status = (error as { status?: number } | null)?.status;
      const isNotFound = status === 404 || status === 410;
      if (isNotFound) {
        return (
          <div className="min-h-screen flex items-center justify-center bg-slate-50">
            <div className="text-center p-8 bg-card rounded-lg border border-border max-w-md">
              <h1 className="text-2xl font-bold mb-2 text-foreground font-display">Page Not Found</h1>
              <p className="text-slate-500">The landing page you're looking for doesn't exist or the test has ended.</p>
            </div>
          </div>
        );
      }
      // Transient failure — React Query already retried 3× with backoff
      // before we got here. Offer a manual retry and keep the spinner UI
      // calm rather than scaring the visitor with "Not Found".
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="text-center p-8 bg-card rounded-lg border border-border max-w-md space-y-4">
            <h1 className="text-xl font-semibold text-foreground font-display">Trouble loading this page</h1>
            <p className="text-sm text-slate-500">We couldn't reach the server. Please check your connection and try again.</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#0A0A0A" }} />
      </div>
    );
  }

  // Handle builder pages (blocks array format)
  if (isBuilderPageResponse(config)) {
    const builderPage: BuilderPageResponse = config;
    const rawBlocks = builderPage.blocks ?? [];
    // Apply {{company}}, {{first_name}}, {{accountNameApollo}} etc.
    const blocks = hasEnrichedVars
      ? (deepApplyVars(rawBlocks, enrichedVars) as typeof rawBlocks)
      : rawBlocks;
    const customCss = builderPage.customCss ?? "";
    const animationsEnabled = builderPage.animationsEnabled !== false;
    const smoothScroll = builderPage.smoothScroll !== false;

    const handleBuilderCtaClick = (ctaUrl: string) => {
      if (ctaUrl.startsWith("chilipiper:")) {
        setChilipiperUrl(ctaUrl.slice("chilipiper:".length));
        return;
      }
      const dest = ctaUrl && ctaUrl !== "#" ? ctaUrl : brand.defaultCtaUrl;
      if (!dest) return;
      // In-page anchor links scroll smoothly instead of opening a new tab.
      if (dest.startsWith("#") && dest.length > 1) {
        const target = document.getElementById(dest.slice(1));
        if (target) {
          target.scrollIntoView({ behavior: smoothScroll ? "smooth" : "auto", block: "start" });
          history.replaceState(null, "", dest);
          return;
        }
      }
      safeNavigate(dest, "_blank");
    };

    const scopedCss = customCss ? scopeCustomCss(customCss, "[data-lp-page]") : "";

    // One-pager pages apply the workspace-default one-pager color overrides
    // (salesConsole.onePager*Color) so the override reaches BOTH the CSS-var
    // layer and any block reading the brand prop directly. Landing pages are
    // untouched (renderBrand === brand).
    const isOnePagerPage = isOnePagerLayout(blocks);
    const renderBrand = isOnePagerPage ? resolveOnePagerColors(brand) : brand;

    return (
      <LinkedFormStyleProvider value={readLinkedFormStyle(pageVars)}>
      <div className="min-h-screen w-full font-sans" data-lp-page style={{ ...getBrandStyleVars(renderBrand), scrollBehavior: smoothScroll ? undefined : "auto" }}>
        <BrandFontLoader brand={brand} />
        <style>{`
          @keyframes marquee {
            from { transform: translateX(0); }
            to { transform: translateX(-50%); }
          }
          .animate-marquee { animation: marquee 40s linear infinite; }
          .animate-marquee:hover { animation-play-state: paused; }
        `}</style>
        {getBrandButtonCss(renderBrand) && <style>{getBrandButtonCss(renderBrand)}</style>}
        {getBrandSurfaceCss(renderBrand) && <style>{getBrandSurfaceCss(renderBrand)}</style>}
        {!smoothScroll && <style>{`html { scroll-behavior: auto !important; }`}</style>}
        {scopedCss && <style>{scopedCss}</style>}
        {isPreviewRoute && (
          <div data-testid="preview-banner" className="bg-card text-foreground py-2 px-4 flex items-center justify-between z-50 relative">
            <div className="flex items-center gap-2 text-xs font-bold tracking-widest uppercase">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-foreground opacity-70" />
                Draft Preview — not publicly visible
              </span>
            </div>
            <button
              onClick={() => window.close()}
              className="text-xs font-semibold underline underline-offset-2 opacity-60 hover:opacity-100 transition-opacity"
            >
              Close Preview
            </button>
          </div>
        )}
        <OnePagerFrame active={isOnePagerPage} bg={isOnePagerPage ? renderBrand.pageBackground : undefined}>
        {blocks.map((block, i) => {
          const dtrBlock = Object.keys(dtrParams).length > 0
            ? { ...block, props: applyDtr(block.props, dtrParams) }
            : block;
          return (
            <BlockErrorBoundary key={block.id ?? i}>
              <ScrollReveal
                delay={i === 0 ? 0 : Math.min((i - 1) * 60, 180)}
                style={block.blockSettings?.animationStyle ?? "fade-up"}
                enabled={animationsEnabled && !NO_REVEAL.has(block.type)}
              >
                <BlockRenderer block={dtrBlock as typeof block} brand={renderBrand} onCtaClick={handleBuilderCtaClick} animationsEnabled={animationsEnabled} pageId={builderPage.id} pageVars={pageVars} pageCta={builderPage.ctaDefault ?? null} />
              </ScrollReveal>
            </BlockErrorBoundary>
          );
        })}
        </OnePagerFrame>
        {blocks.length === 0 && (
          <div className="min-h-screen flex items-center justify-center text-slate-400 text-sm">
            This page has no blocks yet.
          </div>
        )}
        <ProvenanceBanner provenance={builderPage.provenance} />
        {chilipiperUrl && (
          <ChiliPiperModal
            url={chilipiperUrl}
            pageId={builderPage.id}
            onClose={() => setChilipiperUrl(null)}
          />
        )}
      </div>
      </LinkedFormStyleProvider>
    );
  }

  if (error || !config || !config.assignedVariant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center p-8 bg-card rounded-lg border border-border max-w-md">
          <h1 className="text-2xl font-bold mb-2 text-foreground font-display">Page Not Found</h1>
          <p className="text-slate-500">The landing page you're looking for doesn't exist or the test has ended.</p>
        </div>
      </div>
    );
  }

  // If the assigned variant has a linked builder page, render it as blocks.
  // `linkedPage` is typed in the generated Variant schema as LinkedPage | null | undefined.
  const assignedVariantWithPage = config.assignedVariant as typeof config.assignedVariant & { linkedPage?: (LinkedPage & { ctaDefault?: import("@/lib/cta/ctaConfig").CtaConfig | null }) | null };
  if (assignedVariantWithPage.linkedPage !== undefined && assignedVariantWithPage.linkedPage !== null) {
    const linkedPage = assignedVariantWithPage.linkedPage;
    const rawLinkedBlocks = (linkedPage?.blocks ?? []) as import("@/lib/block-types").PageBlock[];
    const blocks = hasEnrichedVars
      ? (deepApplyVars(rawLinkedBlocks, enrichedVars) as typeof rawLinkedBlocks)
      : rawLinkedBlocks;
    const linkedPageCss = linkedPage?.customCss ?? "";
    const linkedPageScopedCss = linkedPageCss ? scopeCustomCss(linkedPageCss, "[data-lp-page]") : "";
    const linkedAnimationsEnabled = (linkedPage as { animationsEnabled?: boolean })?.animationsEnabled !== false;
    const linkedSmoothScroll = (linkedPage as { smoothScroll?: boolean })?.smoothScroll !== false;

    const handleBuilderCtaClick = (ctaUrl: string) => {
      if (ctaUrl.startsWith("chilipiper:")) {
        setChilipiperUrl(ctaUrl.slice("chilipiper:".length));
        return;
      }
      const dest = ctaUrl && ctaUrl !== "#" ? ctaUrl : brand.defaultCtaUrl;
      if (!dest) return;
      if (!isPreviewMode) {
        trackEvent.mutate({
          data: {
            sessionId,
            testId: config.testId,
            variantId: config.assignedVariant.id,
            eventType: "conversion",
            conversionType: "cta_click"
          }
        });
      }
      // In-page anchor links scroll smoothly instead of opening a new tab.
      if (dest.startsWith("#") && dest.length > 1) {
        const target = document.getElementById(dest.slice(1));
        if (target) {
          target.scrollIntoView({ behavior: linkedSmoothScroll ? "smooth" : "auto", block: "start" });
          history.replaceState(null, "", dest);
          return;
        }
      }
      safeNavigate(dest, "_blank");
    };

    const isOnePagerPage = isOnePagerLayout(blocks);
    const renderBrand = isOnePagerPage ? resolveOnePagerColors(brand) : brand;

    return (
      <LinkedFormStyleProvider value={readLinkedFormStyle(pageVars)}>
      <div className="min-h-screen w-full font-sans" data-lp-page style={{ ...getBrandStyleVars(renderBrand), scrollBehavior: linkedSmoothScroll ? undefined : "auto" }}>
        <BrandFontLoader brand={brand} />
        <style>{`
          @keyframes marquee {
            from { transform: translateX(0); }
            to { transform: translateX(-50%); }
          }
          .animate-marquee { animation: marquee 40s linear infinite; }
          .animate-marquee:hover { animation-play-state: paused; }
        `}</style>
        {getBrandButtonCss(renderBrand) && <style>{getBrandButtonCss(renderBrand)}</style>}
        {getBrandSurfaceCss(renderBrand) && <style>{getBrandSurfaceCss(renderBrand)}</style>}
        {!linkedSmoothScroll && <style>{`html { scroll-behavior: auto !important; }`}</style>}
        {linkedPageScopedCss && <style>{linkedPageScopedCss}</style>}
        {isPreviewMode && (
          <div className="bg-card text-foreground py-2 px-4 flex items-center justify-between z-50 relative">
            <div className="flex items-center gap-2 text-xs font-bold tracking-widest uppercase">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-foreground opacity-70" />
                {isPreviewRoute ? "Draft Preview — not publicly visible" : "Preview Mode"}
              </span>
              {!isPreviewRoute && (
                <span className="font-mono font-normal normal-case tracking-normal opacity-70">— {config.assignedVariant.name}</span>
              )}
            </div>
            <button
              onClick={() => window.close()}
              className="text-xs font-semibold underline underline-offset-2 opacity-60 hover:opacity-100 transition-opacity"
            >
              Close Preview
            </button>
          </div>
        )}
        {blocks.length > 0
          ? (
            <OnePagerFrame active={isOnePagerPage} bg={isOnePagerPage ? renderBrand.pageBackground : undefined}>
            {blocks.map((block, i) => {
              const dtrBlock = Object.keys(dtrParams).length > 0
                ? { ...block, props: applyDtr(block.props, dtrParams) }
                : block;
              return (
                <BlockErrorBoundary key={block.id ?? i}>
                  <ScrollReveal
                    delay={i === 0 ? 0 : Math.min((i - 1) * 60, 180)}
                    style={block.blockSettings?.animationStyle ?? "fade-up"}
                    enabled={linkedAnimationsEnabled && !NO_REVEAL.has(block.type)}
                  >
                    <BlockRenderer block={dtrBlock as typeof block} brand={renderBrand} onCtaClick={handleBuilderCtaClick} animationsEnabled={linkedAnimationsEnabled} pageId={linkedPage?.id} testId={config.testId} variantId={config.assignedVariant.id} sessionId={sessionId} pageVars={pageVars} pageCta={linkedPage?.ctaDefault ?? null} />
                  </ScrollReveal>
                </BlockErrorBoundary>
              );
            })}
            </OnePagerFrame>
          )
          : (
            <div className="min-h-screen flex flex-col items-center justify-center text-slate-400 text-sm gap-4">
              <div className="text-4xl">🧱</div>
              <p className="font-medium text-slate-500">This builder page has no blocks yet.</p>
              <p className="text-xs max-w-xs text-center leading-relaxed">
                Open the builder to add blocks to "{linkedPage?.title ?? config.assignedVariant.name}".
              </p>
            </div>
          )
        }
        {chilipiperUrl && (
          <ChiliPiperModal
            url={chilipiperUrl}
            pageId={linkedPage?.id}
            testId={config.testId}
            variantId={config.assignedVariant.id}
            sessionId={sessionId}
            onClose={() => setChilipiperUrl(null)}
          />
        )}
      </div>
      </LinkedFormStyleProvider>
    );
  }

  const variantConf = config.assignedVariant.config as unknown as ExtendedVariantConfig;
  const dtrConf = applyDtr(variantConf, dtrParams);
  const LIME = brand.accentColor;
  const FOREST = brand.primaryColor;
  const ctaColor = dtrConf.ctaColor || LIME;

  const handleCtaClick = () => {
    trackEvent.mutate({
      data: {
        sessionId,
        testId: config.testId,
        variantId: config.assignedVariant.id,
        eventType: "conversion",
        conversionType: "cta_click"
      }
    });

    const dest = dtrConf.ctaUrl && dtrConf.ctaUrl !== "#"
      ? dtrConf.ctaUrl
      : brand.defaultCtaUrl;
    if (dest) {
      safeNavigate(dest);
    } else {
      alert("Conversion Tracked! (No URL configured)");
    }
  };

  const isDark = dtrConf.backgroundStyle === "dark";
  const isMinimal = dtrConf.layout === "minimal";
  const isSplit = dtrConf.layout === "split";
  const sectionPy = SECTION_PY[brand.sectionPadding];

  return (
    <CustomBlocksProvider blocks={customBlockSources}>
    <div className={cn(
      "min-h-screen w-full font-sans",
      isDark ? "bg-background text-foreground" : "bg-background text-foreground"
    )} style={getBrandStyleVars(brand)} data-lp-page data-smooth-scroll>
      <BrandFontLoader brand={brand} />
      <style>{`
        @keyframes marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 40s linear infinite;
        }
        .animate-marquee:hover {
          animation-play-state: paused;
        }
      `}</style>
      {getBrandButtonCss(brand) && <style>{getBrandButtonCss(brand)}</style>}
      {getBrandSurfaceCss(brand) && <style>{getBrandSurfaceCss(brand)}</style>}

      {/* Above-fold wrapper — 80vh so the video peeks below */}
      <div className="min-h-[80vh] flex flex-col">

      {/* 1. Banner — preview stripe or running stripe */}
      {isPreviewMode ? (
        <div className="bg-card text-foreground py-2 px-4 flex items-center justify-between z-50 relative">
          <div className="flex items-center gap-2 text-xs font-bold tracking-widest uppercase">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-foreground opacity-70" />
              Preview Mode
            </span>
            <span className="font-mono font-normal normal-case tracking-normal opacity-70">— {config.assignedVariant.name}</span>
          </div>
          <button
            onClick={() => window.close()}
            className="text-xs font-semibold underline underline-offset-2 opacity-60 hover:opacity-100 transition-opacity"
          >
            Close Preview
          </button>
        </div>
      ) : (
        <div className="bg-black text-white text-[10px] md:text-xs py-1.5 text-center font-mono tracking-[0.2em] uppercase opacity-80 hover:opacity-100 transition-opacity z-50 relative">
          RUNNING • VARIANT: {config.assignedVariant.name}
        </div>
      )}

      {/* 2. Nav */}
      <nav className="w-full px-6 pt-1 pb-[7px] flex items-center justify-between z-40 relative bg-background">
        <BrandLogo brand={brand} tone="onDark" alt={brand.brandName || brand.copyrightName || "Logo"} className="h-8 w-auto" />
        <button
          className="px-4 py-2 rounded-lg bg-foreground text-background font-semibold"
        >
          {brand.navCtaText}
        </button>
      </nav>

      {/* 3. Hero Section (text + CTA only, plus video in split mode) */}
      <section className={cn(
        "relative w-full px-6 flex flex-col items-center justify-center flex-1 bg-background"
      )}>
        <div className={cn(
          "max-w-7xl mx-auto w-full",
          isSplit ? "grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center" : "flex flex-col items-center text-center"
        )}>
          
          <div className={cn("space-y-8 z-10", !isSplit && "max-w-4xl mx-auto flex flex-col items-center")}>
            <h1 className={cn(
              "font-display font-bold tracking-tight leading-[1.05] text-foreground",
              isMinimal ? "text-5xl md:text-6xl lg:text-7xl" : "text-4xl md:text-6xl lg:text-7xl"
            )}>
              {dtrConf.headline}
            </h1>
            
            {dtrConf.subheadline && (
              <p className={cn(
                "text-lg md:text-xl leading-relaxed font-sans text-foreground/70",
                !isSplit && "max-w-2xl"
              )}>
                {dtrConf.subheadline}
              </p>
            )}

            <div className={cn("flex flex-col gap-4 w-full sm:w-auto pt-2", !isSplit && "items-center")}>
              <button
                onClick={handleCtaClick}
                className={getButtonClasses(brand, "inline-flex items-center justify-center")}
                style={{ backgroundColor: ctaColor, color: FOREST }}
              >
                {dtrConf.ctaText}
                <ArrowRight className="w-4 h-4 ml-2" />
              </button>

              {dtrConf.showSocialProof && (
                <div className={cn(
                  "flex items-center gap-2 text-sm font-medium opacity-80",
                  !isSplit && "justify-center"
                )}>
                  <ShieldCheck className="w-4 h-4" />
                  <span>{dtrConf.socialProofText}</span>
                </div>
              )}
            </div>
          </div>

          {/* 4. Full-bleed Video (Split Mode) */}
          {isSplit && dtrConf.heroType !== "none" && (
            <div className="relative w-full aspect-[16/9] z-10 bg-black">
              {dtrConf.heroType === "dandy-video" ? (
                <iframe 
                  src={DANDY_VIDEO_URL} 
                  className="w-full h-full border-0"
                  title="Demo Video"
                />
              ) : (
                <img 
                  src="https://images.unsplash.com/photo-1606811841689-23dfddce3e95?q=80&w=1600" 
                  alt="Dental Office" 
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              )}
            </div>
          )}
        </div>

        {/* Scroll indicator */}
        <div className={cn(
          "absolute bottom-[10px] left-1/2 -translate-x-1/2 flex flex-col items-center gap-0.5 pointer-events-none select-none transition-opacity duration-500",
          scrolled ? "opacity-0" : "opacity-100"
        )}>
          <div className={cn("w-px h-6 rounded-full bg-foreground/15")} />
          <div className="animate-bounce">
            <ChevronDown className={cn("w-5 h-5 text-foreground/30")} />
          </div>
        </div>
      </section>

      </div>{/* end min-h-screen above-fold wrapper */}

      {/* 4. Video (Centered Mode — contained with white padding) */}
      {!isSplit && dtrConf.heroType !== "none" && (
        <section className="w-full bg-white py-8 px-6 md:px-10">
          <div className="max-w-5xl mx-auto">
            <div className="relative w-full aspect-video rounded-lg overflow-hidden">
              {dtrConf.heroType === "dandy-video" ? (
                <iframe 
                  src={DANDY_VIDEO_URL} 
                  className="w-full h-full border-0"
                  title="Demo Video"
                />
              ) : (
                <img 
                  src="https://images.unsplash.com/photo-1606811841689-23dfddce3e95?q=80&w=1600" 
                  alt="Dental Office" 
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              )}
            </div>
          </div>
        </section>
      )}

      {/* 5. Trust Bar */}
      {dtrConf.trustBar?.enabled && (
        <section className="w-full bg-[#F8FAF9] py-12 border-y border-slate-100">
          <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-4 divide-x-0 md:divide-x divide-slate-200">
            {dtrConf.trustBar.items.map((item, i) => (
              <div key={i} className="flex flex-col items-center text-center px-4">
                <span className="text-3xl md:text-4xl font-display font-bold text-foreground mb-1">{item.value}</span>
                <span className="text-sm text-[#4A6358] font-medium uppercase tracking-wider">{item.label}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 6. Photo Strip */}
      {dtrConf.photoStrip?.enabled && (
        <section className="w-full h-64 md:h-80 overflow-hidden relative bg-white">
          <div className="absolute inset-y-0 left-0 w-16 md:w-32 bg-gradient-to-r from-white via-white/80 to-transparent z-10 pointer-events-none" />
          <div className="absolute inset-y-0 right-0 w-16 md:w-32 bg-gradient-to-l from-white via-white/80 to-transparent z-10 pointer-events-none" />
          
          <div className="flex h-full animate-marquee w-max">
            {/* Render array twice for seamless loop */}
            {[...dtrConf.photoStrip.images, ...dtrConf.photoStrip.images].map((img, i) => (
              <img
                key={i}
                src={img.src}
                alt={img.alt}
                loading="lazy"
                className="h-full aspect-square md:w-[280px] shrink-0 object-cover"
              />
            ))}
          </div>
        </section>
      )}

      {/* 7. Pain Section (PAS) */}
      {dtrConf.painSection?.enabled && (
        <section className={cn("w-full bg-background text-foreground px-6", sectionPy)}>
          <div className="max-w-4xl mx-auto flex flex-col md:flex-row gap-12">
            <div className="md:w-1/2 space-y-6">
              <h2 className="text-3xl md:text-5xl font-display font-bold leading-tight">
                {dtrConf.painSection.headline}
              </h2>
              <p className="text-lg text-white/80 leading-relaxed">
                {dtrConf.painSection.body}
              </p>
            </div>
            <div className="md:w-1/2">
              <ul className="space-y-4">
                {dtrConf.painSection.bullets?.map((bullet, i) => (
                  <li key={i} className="flex items-start gap-4 p-4 rounded-lg bg-muted/5 border border-border">
                    <AlertTriangle className="w-6 h-6 text-foreground shrink-0 mt-0.5" />
                    <span className="text-white/90 font-medium leading-relaxed">{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      {/* 8. Comparison Section */}
      {dtrConf.comparisonSection?.enabled && (
        <section className={cn("w-full bg-slate-50 px-6", sectionPy)}>
          <div className="max-w-6xl mx-auto">
            {dtrConf.comparisonSection.headline && (
              <h2 className="text-4xl md:text-5xl font-display font-bold text-center text-foreground mb-16">
                {dtrConf.comparisonSection.headline}
              </h2>
            )}
            
            <div className="grid md:grid-cols-2 gap-8 items-stretch mb-16">
              {/* Old Way */}
              <div className="bg-muted rounded-lg p-8 md:p-12 opacity-80 flex flex-col">
                <div className="mb-8">
                  <span className="text-sm font-bold tracking-widest text-slate-500 uppercase mb-2 block">
                    {dtrConf.comparisonSection.oldWay.sublabel || "OLD WAY"}
                  </span>
                  <h3 className="text-2xl font-bold text-foreground">
                    {dtrConf.comparisonSection.oldWay.label}
                  </h3>
                </div>
                <ul className="space-y-6 flex-1">
                  {dtrConf.comparisonSection.oldWay.bullets.map((bullet, i) => (
                    <li key={i} className="flex items-start gap-4">
                      <XCircle className="w-6 h-6 text-red-400 shrink-0 mt-0.5" />
                      <span className="text-[#4A6358] font-medium leading-relaxed">{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* New Way */}
              <div className="bg-card rounded-lg p-8 md:p-12 flex flex-col border border-border relative overflow-hidden">
                {/* Subtle highlight */}

                <div className="mb-8 relative z-10">
                  <span className="text-sm font-bold tracking-widest text-foreground uppercase mb-2 block">
                    {dtrConf.comparisonSection.newWay.sublabel || "NEW WAY"}
                  </span>
                  <h3 className="text-2xl font-bold text-foreground">
                    {dtrConf.comparisonSection.newWay.label}
                  </h3>
                </div>
                <ul className="space-y-6 flex-1 relative z-10">
                  {dtrConf.comparisonSection.newWay.bullets.map((bullet, i) => (
                    <li key={i} className="flex items-start gap-4">
                      <CheckCircle2 className="w-6 h-6 text-foreground shrink-0 mt-0.5" />
                      <span className="text-foreground/90 font-medium leading-relaxed">{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="text-center">
              <button
                onClick={handleCtaClick}
                className={getButtonClasses(brand, "inline-flex items-center")}
                style={{ backgroundColor: ctaColor, color: FOREST }}
              >
                {dtrConf.comparisonSection.ctaText || dtrConf.ctaText}
                <ArrowRight className="w-4 h-4 ml-2" />
              </button>
            </div>
          </div>
        </section>
      )}

      {/* 9. Stat Callout */}
      {dtrConf.statCallout?.enabled && (
        <section className={cn("w-full bg-background px-6 text-center text-foreground", sectionPy)}>
          <div className="max-w-4xl mx-auto flex flex-col items-center">
            <div className="text-8xl md:text-[10rem] font-display font-bold leading-none mb-6 text-foreground">
              {dtrConf.statCallout.stat}
            </div>
            <p className="text-xl md:text-2xl text-foreground font-medium max-w-xl mx-auto mb-8 leading-relaxed">
              {dtrConf.statCallout.description}
            </p>
            {dtrConf.statCallout.footnote && (
              <p className="text-sm text-foreground/50 max-w-lg mx-auto">
                {dtrConf.statCallout.footnote}
              </p>
            )}
          </div>
        </section>
      )}

      {/* 10. Benefits Grid */}
      {dtrConf.benefits?.enabled && (
        <section className={cn("w-full bg-background px-6", sectionPy)}>
          <div className="max-w-7xl mx-auto">
            {dtrConf.benefits.headline && (
              <h2 className="text-3xl md:text-5xl font-display font-bold text-center text-foreground mb-16 max-w-3xl mx-auto leading-tight">
                {dtrConf.benefits.headline}
              </h2>
            )}
            <div className={cn(
              "grid gap-8",
              dtrConf.benefits.columns === 2 ? "md:grid-cols-2" : "md:grid-cols-3"
            )}>
              {dtrConf.benefits.items.map((benefit, i) => {
                const Icon = ICON_MAP[benefit.icon] || Zap;
                return (
                  <div key={i} className="flex flex-col p-8 rounded-lg bg-card border border-border">
                    <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-6">
                      <Icon className="w-7 h-7 text-foreground" />
                    </div>
                    <h3 className="text-xl font-bold text-foreground mb-3">{benefit.title}</h3>
                    <p className="text-foreground/70 leading-relaxed">{benefit.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* 11. Testimonial */}
      {dtrConf.testimonial?.enabled && (
        <section className={cn("w-full bg-background px-6 relative overflow-hidden", sectionPy)}>
          <div className="max-w-4xl mx-auto relative z-10 flex flex-col items-center text-center">
            <Quote className="w-16 h-16 text-foreground mb-8 opacity-50" />
            <blockquote className="text-2xl md:text-4xl font-display font-medium text-foreground leading-snug mb-10">
              "{dtrConf.testimonial.quote}"
            </blockquote>
            <div className="flex flex-col items-center">
              <strong className="text-lg text-foreground">{dtrConf.testimonial.author}</strong>
              <span className="text-foreground/70">{dtrConf.testimonial.role}</span>
              {dtrConf.testimonial.practiceName && (
                <span className="text-sm text-foreground/70 mt-1 opacity-80">{dtrConf.testimonial.practiceName}</span>
              )}
            </div>
          </div>
        </section>
      )}

      {/* 12. How It Works */}
      {dtrConf.howItWorks?.enabled && (
        <section className={cn("w-full bg-background px-6", sectionPy)}>
          <div className="max-w-6xl mx-auto">
            {dtrConf.howItWorks.headline && (
              <h2 className="text-3xl md:text-5xl font-display font-bold text-center text-foreground mb-20">
                {dtrConf.howItWorks.headline}
              </h2>
            )}
            <div className="grid md:grid-cols-3 gap-12 relative">
              <div className="hidden md:block absolute top-8 left-1/6 right-1/6 h-[2px] bg-border z-0" />
              {dtrConf.howItWorks.steps.map((step, i) => (
                <div key={i} className="relative z-10 flex flex-col items-center text-center">
                  <div className="w-16 h-16 rounded-full bg-foreground text-background font-display font-bold text-2xl flex items-center justify-center mb-6 border-4 border-background">
                    {step.number}
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-4">{step.title}</h3>
                  <p className="text-foreground/70 leading-relaxed">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 13. Product Grid */}
      {dtrConf.productGrid?.enabled && (
        <section className={cn("w-full bg-background px-6", sectionPy)}>
          <div className="max-w-7xl mx-auto">
            <div className="text-center max-w-3xl mx-auto mb-16">
              {dtrConf.productGrid.headline && (
                <h2 className="text-3xl md:text-5xl font-display font-bold text-foreground mb-6">
                  {dtrConf.productGrid.headline}
                </h2>
              )}
              {dtrConf.productGrid.subheadline && (
                <p className="text-lg md:text-xl text-foreground/70 leading-relaxed">
                  {dtrConf.productGrid.subheadline}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {dtrConf.productGrid.items.map((item, i) => (
                <div key={i} className="group rounded-lg overflow-hidden border border-border transition-all duration-300 bg-card flex flex-col">
                  <div className="w-full h-52 overflow-hidden bg-muted">
                    <img
                      src={item.image}
                      alt={item.title}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  <div className="p-6 flex-1 flex flex-col">
                    <h3 className="text-lg font-bold text-foreground mb-2">{item.title}</h3>
                    <p className="text-foreground/70 text-sm leading-relaxed flex-1">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 14. Bottom CTA Band */}
      {dtrConf.bottomCta?.enabled && (
        <section className={cn("w-full bg-background text-foreground px-6 text-center", sectionPy)}>
          <div className="max-w-3xl mx-auto">
            <h2 className="text-4xl md:text-6xl font-display font-bold mb-6">
              {dtrConf.bottomCta.headline}
            </h2>
            {dtrConf.bottomCta.subheadline && (
              <p className="text-xl text-foreground/80 mb-10">
                {dtrConf.bottomCta.subheadline}
              </p>
            )}
            <button
              onClick={handleCtaClick}
              className={getButtonClasses(brand, "inline-flex items-center")}
              style={{ backgroundColor: ctaColor, color: FOREST }}
            >
              {dtrConf.bottomCta.ctaText || dtrConf.ctaText}
              <ArrowRight className="w-4 h-4 ml-2" />
            </button>
          </div>
        </section>
      )}

      {/* 15. Guarantee Bar */}
      {dtrConf.guaranteeBar?.enabled && (
        <div className="w-full py-4 px-6 text-center text-sm font-bold tracking-wide" style={{ backgroundColor: LIME, color: FOREST }}>
          {dtrConf.guaranteeBar.text}
        </div>
      )}

      {/* 16. Footer */}
      <footer className="w-full bg-background text-foreground">
        <div className="max-w-6xl mx-auto px-8 pt-16 pb-10">
          {/* Top row: logo + nav columns */}
          <div className="flex flex-col md:flex-row gap-12 md:gap-16">
            {/* Logo */}
            <div className="flex-shrink-0">
              <BrandLogo brand={brand} tone="onDark" alt={brand.brandName || brand.copyrightName || "Logo"} className="w-40 h-auto" style={{ opacity: 0.9 }} />
            </div>

            {/* Nav columns */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-10 flex-1">
              <div>
                <p className="text-xs font-semibold tracking-widest uppercase mb-4" style={{ color: LIME }}>Dandy</p>
                <ul className="space-y-2.5">
                  {[
                    ["Home", "https://www.meetdandy.com/"],
                    ["Pricing", "https://www.meetdandy.com/pricing/"],
                    ["Get in touch", "https://www.meetdandy.com/get-in-touch/"],
                    ["Dandy Reviews", "https://www.meetdandy.com/reviews/"],
                    ["Careers", "https://www.meetdandy.com/careers/"],
                    ["Privacy Policy", "https://www.meetdandy.com/privacy-policy/"],
                    ["Terms of Use", "https://www.meetdandy.com/terms-of-use/"],
                    ["Privacy Requests", "https://www.meetdandy.com/privacy-requests/"],
                    ["Your Privacy Rights", "https://www.meetdandy.com/privacy-rights/"],
                  ].map(([label, href]) => (
                    <li key={label}><a href={href} target="_blank" rel="noopener noreferrer" className="text-white/50 text-sm hover:text-white/80 transition-colors">{label}</a></li>
                  ))}
                  <li id="ot-sdk-btn" className="ot-sdk-show-settings menu-item menu-item-type-custom menu-item-object-custom menu-item-15259 text-white/50 text-sm hover:text-white/80 transition-colors cursor-pointer"><span className="menu-item-without-link">Do Not Sell or Share My Personal Information</span></li>
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold tracking-widest uppercase mb-4" style={{ color: LIME }}>Products & Technology</p>
                <ul className="space-y-2.5">
                  {[
                    ["Vision Scanner & Cart", "https://www.meetdandy.com/vision-scanner/"],
                    ["Chairside", "https://www.meetdandy.com/chairside/"],
                    ["Lab Services", "https://www.meetdandy.com/lab-services/"],
                    ["Posterior Crown and Bridge", "https://www.meetdandy.com/posterior-crown-and-bridge/"],
                    ["Partial Dentures", "https://www.meetdandy.com/partial-dentures/"],
                    ["Digital Dentures", "https://www.meetdandy.com/digital-dentures/"],
                    ["Implant Solutions", "https://www.meetdandy.com/implant-solutions/"],
                    ["Splints and Guards", "https://www.meetdandy.com/splints-and-guards/"],
                    ["Dandy Clear Aligners", "https://www.meetdandy.com/clear-aligners/"],
                    ["Sleep Apnea", "https://www.meetdandy.com/sleep-apnea/"],
                  ].map(([label, href]) => (
                    <li key={label}><a href={href} target="_blank" rel="noopener noreferrer" className="text-white/50 text-sm hover:text-white/80 transition-colors">{label}</a></li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold tracking-widest uppercase mb-4" style={{ color: LIME }}>Practices</p>
                <ul className="space-y-2.5">
                  {[
                    ["Private Practice", "https://www.meetdandy.com/solutions/private-practice/"],
                    ["Group Practice", "https://www.meetdandy.com/solutions/group-practice/"],
                    ["DSO", "https://www.meetdandy.com/solutions/dso/"],
                    ["Refer a Practice", "https://www.meetdandy.com/refer/"],
                    ["Login", "https://app.meetdandy.com/"],
                  ].map(([label, href]) => (
                    <li key={label}><a href={href} target="_blank" rel="noopener noreferrer" className="text-white/50 text-sm hover:text-white/80 transition-colors">{label}</a></li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold tracking-widest uppercase mb-4" style={{ color: LIME }}>Resources</p>
                <ul className="space-y-2.5">
                  {[
                    ["Learning Center", "https://www.meetdandy.com/learning-center/"],
                    ["Articles", "https://www.meetdandy.com/articles/"],
                    ["Webinars", "https://www.meetdandy.com/webinars/"],
                    ["eBooks", "https://www.meetdandy.com/ebooks/"],
                    ["Lab Product Catalog", "https://www.meetdandy.com/lab-product-catalog/"],
                    ["Newsroom", "https://www.meetdandy.com/newsroom/"],
                  ].map(([label, href]) => (
                    <li key={label}><a href={href} target="_blank" rel="noopener noreferrer" className="text-white/50 text-sm hover:text-white/80 transition-colors">{label}</a></li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="mt-14 pt-6 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-white/40 text-xs">© {new Date().getFullYear()} {brand.copyrightName}. All rights reserved.</p>
            {/* Social icons */}
            <div className="flex items-center gap-5">
              {brand.socialUrls.facebook && (
                <a href={brand.socialUrls.facebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="text-white/40 hover:text-white/70 transition-colors">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
                </a>
              )}
              {brand.socialUrls.instagram && (
                <a href={brand.socialUrls.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="text-white/40 hover:text-white/70 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
                </a>
              )}
              {brand.socialUrls.linkedin && (
                <a href={brand.socialUrls.linkedin} target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className="text-white/40 hover:text-white/70 transition-colors">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>
                </a>
              )}
            </div>
          </div>
        </div>
      </footer>

    </div>
    </CustomBlocksProvider>
  );
}
