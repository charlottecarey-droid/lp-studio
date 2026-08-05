/**
 * Third-party embed surface for published event agendas (Groundbreak-style).
 *
 * A customer pastes ONE snippet into their own website (e.g. procore.com's
 * event page):
 *
 *   <div id="lp-agenda"></div>
 *   <script async src="https://<tenant-host>/api/embed/agenda.js"
 *           data-default="<token-of-generic-agenda>"></script>
 *
 * Reps then send links to THAT page with `?lp_agenda=<token>` appended. The
 * loader reads the param, iframes `/api/embed/agenda/<token>`, and this
 * router 302s the iframe to the published `/lp/<slug>?embed=1` page. No
 * token on the URL → the `data-default` agenda renders, so the widget always
 * shows something.
 *
 * PARAM NAME: `lp_agenda`, NOT `agenda` — RainFocus (which runs on the same
 * customer event pages this widget targets, e.g. procore.com/groundbreak)
 * already uses `?agenda` for its own widget state, and colliding with it
 * would break both. `data-param` on the snippet overrides the name per site.
 *
 * COEXISTING WITH THE SITE'S OWN AGENDA WIDGET: two snippet attributes make
 * this widget an overlay on RainFocus rather than a replacement —
 *   - omit `data-default` and the loader renders NOTHING for tokenless
 *     visitors (RainFocus stays);
 *   - `data-hide="<selector>"` names the RainFocus container: hidden when a
 *     token renders, restored if the token is dead (the 404 page posts
 *     `lp-embed-missing` and the loader removes itself), so a stale link
 *     degrades to the site's normal agenda, never an apology frame.
 *
 * STICKY PERSONALISATION: the loader stores a link's token in localStorage
 * (key `lp-embed-token:<param>`), so a visitor who comes back WITHOUT the
 * link — site nav, typed URL, days later — still sees their agenda.
 * Precedence: URL param > stored > data-default; only URL tokens are
 * stored. Dead tokens clear the stored value and cascade default → site
 * widget, so storage can never pin a visitor to an apology frame.
 *
 *  PUBLIC (no auth — the `/embed/` prefix is outside the routes/index.ts
 *  auth guard, which only protects `/lp/` and `/sales/`):
 *   - GET /embed/agenda.js       — the agenda loader script. Served with
 *     `Cross-Origin-Resource-Policy: cross-origin`: helmet's default
 *     `same-origin` CORP would make the customer's `<script src>` tag fail.
 *   - GET /embed/agenda/:token   — resolve + redirect. The token is the
 *     opaque `sales_event_agendas.embed_token` (minted at publish); the page
 *     slug is deliberately NOT accepted here — slugs read
 *     `agenda-<account>-<event>`, and URLs on a customer's site shouldn't
 *     leak their account list.
 *   - GET /embed/page.js         — generic loader: any PUBLISHED landing
 *     page inline in a section (or replacing one via data-hide). See its
 *     own doc block for why it keys on slug and forwards all params.
 *   - GET /embed/page/:slug      — resolve + redirect for the above.
 *
 * WHY A REDIRECT AND NOT A RENDER: the published /lp/ page (CF worker → SPA
 * viewer) already carries tracking, RSVP, .ics and brand styling, and —
 * verified against production — is served with NO X-Frame-Options, so it can
 * live inside a foreign iframe as-is. Rendering a second copy here would
 * fork that contract. The api-server's own helmet-set `X-Frame-Options:
 * SAMEORIGIN` is stripped from these responses because some engines evaluate
 * frame headers on every hop of a redirect chain, not just the final
 * document.
 *
 * TENANT SCOPING: embed_token is globally unique (migration 0135), so the
 * lookup runs with no tenant in hand. The request host's tenant is verified
 * against the agenda's tenant AFTER lookup — without this, tenant A's token
 * on tenant B's host would redirect into B's slug namespace (404 at best,
 * slug collision at worst).
 */
import { Router, type Request, type Response } from "express";
import { db, salesEventAgendasTable, lpPagesTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { findTenantByHost } from "../lib/tenantHosts";
import { getRequestHost } from "../lib/requestHost";
import { rateLimit, envLimit } from "../lib/rateLimit";

const router = Router();

// Generous but bounded — these are anonymous GETs off third-party pages, and
// the redirect route costs two indexed lookups.
const embedLimiter = rateLimit({
  name: "embed-agenda",
  windowMs: 60_000,
  max: envLimit("RATE_LIMIT_EMBED_PER_MIN", 300),
});

/** Query params forwarded from the host page through to the /lp/ page, so
 *  lp_page_visits attribution (extractUtm in tracking.ts) sees the campaign
 *  that brought the visitor to the CUSTOMER's page, not a bare iframe URL. */
const FORWARDED_PARAMS = /^(utm_[a-z]+|gclid|lpvh|lpmode)$/i;

/** Belt-and-braces framing headers for iframe-destined responses. */
function allowFraming(res: Response): void {
  res.removeHeader("X-Frame-Options");
  // frame-ancestors is the ONLY directive here — this must not widen the
  // page CSP, just permit framing. Published agenda pages are public
  // by-link already, so any-ancestor is not a new exposure.
  res.set("Content-Security-Policy", "frame-ancestors *");
}

/**
 * The loader. Kept dependency-free ES5 so it runs untranspiled on whatever
 * browser the customer's site supports. Height auto-sizing listens only to
 * messages from the iframe's own window AND origin — a hostile sibling frame
 * can't resize (or spoof) the widget.
 */
const LOADER_JS = `(function () {
  var script = document.currentScript;
  if (!script) return;
  var origin;
  try { origin = new URL(script.src).origin; } catch (_) { return; }
  // Default deliberately NOT "agenda" — RainFocus already claims that param
  // on customer event pages. data-param overrides per site.
  var param = script.getAttribute("data-param") || "lp_agenda";
  var defaultToken = script.getAttribute("data-default") || "";
  // Personalisation is sticky: the first visit through a personalised link
  // stores its token, so coming back WITHOUT the link (site nav, typed URL,
  // next week) still shows that account's agenda. Precedence: URL param
  // (a newly clicked link always wins and re-personalises the browser) >
  // stored token > data-default. Only URL tokens are stored — the generic
  // default is not a personalisation. Storage failures (private mode,
  // storage disabled) degrade silently to link-only behaviour, and a dead
  // stored token self-heals below via the lp-embed-missing signal.
  var storageKey = "lp-embed-token:" + param;
  var urlToken = "";
  try { urlToken = new URLSearchParams(window.location.search).get(param) || ""; } catch (_) {}
  var stored = "";
  try { stored = window.localStorage.getItem(storageKey) || ""; } catch (_) {}
  var token = urlToken || stored || defaultToken;
  // No token anywhere -> render NOTHING. This is the coexistence contract:
  // a site that keeps its existing agenda widget (RainFocus) simply omits
  // data-default, and that widget stays untouched for tokenless visitors.
  if (!token) return;
  if (urlToken) { try { window.localStorage.setItem(storageKey, urlToken); } catch (_) {} }

  // data-hide: CSS selector for the site's own agenda widget (e.g. the
  // RainFocus container). Hidden when we take over, restored if the token
  // turns out to be dead — the personalised link then degrades to the
  // site's normal agenda instead of an apology frame.
  var hideSel = script.getAttribute("data-hide");
  var hiddenEls = [];
  function hideFallback() {
    if (!hideSel) return;
    try {
      var els = document.querySelectorAll(hideSel);
      for (var i = 0; i < els.length; i++) {
        hiddenEls.push({ el: els[i], display: els[i].style.display });
        els[i].style.display = "none";
      }
    } catch (_) {}
  }
  function restoreFallback() {
    for (var i = 0; i < hiddenEls.length; i++) {
      hiddenEls[i].el.style.display = hiddenEls[i].display;
    }
    hiddenEls = [];
  }

  // Forward campaign params from the host page for visit attribution, plus
  // lpvh — this window's height, which the agenda resolves its 100vh sizing
  // against (see the page loader for why leaving it out loops).
  var forwarded = "";
  try {
    var src = new URLSearchParams(window.location.search);
    var out = new URLSearchParams();
    src.forEach(function (v, k) {
      if (/^utm_[a-z]+$/i.test(k) || k.toLowerCase() === "gclid") out.append(k, v);
    });
    out.set("lpvh", String(Math.max(320, Math.min(2000, Math.round(window.innerHeight) || 800))));
    if (script.getAttribute("data-mode") === "page") out.set("lpmode", "page");
    forwarded = out.toString();
  } catch (_) {}

  var iframe = document.createElement("iframe");
  // Guards the dead-token retry: once we're showing the default there is
  // nothing further to fall back to, so a dead DEFAULT can't loop.
  var triedDefault = token === defaultToken;
  iframe.src = origin + "/api/embed/agenda/" + encodeURIComponent(token) + (forwarded ? "?" + forwarded : "");
  iframe.title = "Event agenda";
  iframe.style.width = "100%";
  iframe.style.border = "0";
  iframe.style.display = "block";
  iframe.style.minHeight = "480px";
  iframe.setAttribute("loading", "lazy");

  window.addEventListener("message", function (e) {
    if (e.origin !== origin || e.source !== iframe.contentWindow) return;
    var d = e.data;
    if (!d) return;
    if (d.type === "lp-embed-height") {
      var h = Number(d.height);
      // 40000px cap: a page that sizes content in vh units would otherwise
      // feedback-loop (taller iframe -> taller vh -> taller report, forever).
      // The event-agenda block uses no vh sizing, so real agendas never hit it.
      if (isFinite(h) && h > 0 && h <= 40000) iframe.style.height = Math.ceil(h) + "px";
      return;
    }
    if (d.type === "lp-embed-missing") {
      // Dead token (revoked / unpublished / typo). Forget any stored
      // personalisation, then behave like a tokenless visit: retry once
      // with the generic default if one exists, else give the page back to
      // the site's own widget, else keep the frame — it shows the quiet
      // "isn't available" sentence.
      try { window.localStorage.removeItem(storageKey); } catch (_) {}
      if (defaultToken && !triedDefault) {
        triedDefault = true;
        iframe.src = origin + "/api/embed/agenda/" + encodeURIComponent(defaultToken) + (forwarded ? "?" + forwarded : "");
        return;
      }
      if (hideSel) {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
        restoreFallback();
      }
      return;
    }
  });

  hideFallback();
  var target = null;
  var sel = script.getAttribute("data-target");
  if (sel) { try { target = document.querySelector(sel); } catch (_) {} }
  if (!target) target = document.getElementById("lp-agenda");
  if (target) target.appendChild(iframe);
  else if (script.parentNode) script.parentNode.insertBefore(iframe, script);
})();
`;

/**
 * Generic landing-page loader — embeds ANY published page inline in a
 * section of the customer's site, or in place of one of its own widgets
 * (same data-hide contract as the agenda loader). Keyed by SLUG, not a
 * minted token: pages are already public at /lp/<slug>, there is no
 * account name inside a page slug to hide, and slug-keying makes every
 * existing published page embeddable with no backfill.
 *
 *   <div id="lp-page"></div>
 *   <script async src="https://<tenant-host>/api/embed/page.js"
 *           data-page="<slug>" [data-param="lp_page"] [data-hide="<selector>"]
 *           [data-target="<selector>"] [data-mode="page"]></script>
 *
 * PERSONALIZED PER VISITOR: a link carrying `?lp_page=<token>` selects WHICH
 * page fills the slot, so one installed snippet serves a different page per
 * account (`/embed/p/:token`). `data-page` is the fallback everyone else
 * sees; omit it and an unpersonalized visitor gets nothing, leaving the
 * host's own section in place. Tokens stick per browser like the agenda
 * widget's, and a dead token falls back to the generic page before giving
 * the section back.
 *
 * `data-mode="page"` marks a deliberate whole-page takeover, which keeps
 * full-screen heroes at true viewport height. Omitted (the default) the
 * embed is treated as a SECTION of the host page and viewport-height sizing
 * is scaled down — so any page embeds sensibly without an embed-specific
 * variant or per-section tuning.
 *
 * The HOST PAGE's entire query string is forwarded into the iframe (minus
 * our own `embed` flag) — unlike the agenda loader's utm-only allowlist —
 * because landing pages resolve DTR tokens ({{keyword}}, {{city}}, …)
 * from the visitor's URL params at runtime, and an embed that dropped
 * them would silently un-personalise dynamic-text pages. Forwarding is
 * not a new exposure: the page accepts arbitrary params at its own URL.
 */
const LOADER_PAGE_JS = `(function () {
  var script = document.currentScript;
  if (!script) return;
  var origin;
  try { origin = new URL(script.src).origin; } catch (_) { return; }
  // Personalized links: ?<param>=<token> picks WHICH page fills this slot,
  // so one installed snippet can render a different page per visitor.
  // data-page is the fallback everyone else sees; omit it and an
  // unpersonalized visitor gets nothing (leaving the host's own section in
  // place, same contract as the agenda widget's data-default).
  var param = script.getAttribute("data-param") || "lp_page";
  var storageKey = "lp-embed-page:" + param;
  var urlToken = "";
  try { urlToken = new URLSearchParams(window.location.search).get(param) || ""; } catch (_) {}
  var stored = "";
  try { stored = window.localStorage.getItem(storageKey) || ""; } catch (_) {}
  var token = urlToken || stored;
  var slug = script.getAttribute("data-page") || "";
  if (!token && !slug) return;
  if (urlToken) { try { window.localStorage.setItem(storageKey, urlToken); } catch (_) {} }

  var hideSel = script.getAttribute("data-hide");
  var hiddenEls = [];
  function hideFallback() {
    if (!hideSel) return;
    try {
      var els = document.querySelectorAll(hideSel);
      for (var i = 0; i < els.length; i++) {
        hiddenEls.push({ el: els[i], display: els[i].style.display });
        els[i].style.display = "none";
      }
    } catch (_) {}
  }
  function restoreFallback() {
    for (var i = 0; i < hiddenEls.length; i++) {
      hiddenEls[i].el.style.display = hiddenEls[i].display;
    }
    hiddenEls = [];
  }

  // Forward the whole host-page query string so DTR personalisation works
  // inside the embed exactly as it would at the page's own URL, plus lpvh —
  // THIS window's height, which the page resolves its 100vh sizing against.
  // Without it a full-screen hero sizes to the iframe, which we then size to
  // the hero: a feedback loop that lands the page ~3x too tall.
  var forwarded = "";
  try {
    var src = new URLSearchParams(window.location.search);
    src.delete("embed");
    src.set("lpvh", String(Math.max(320, Math.min(2000, Math.round(window.innerHeight) || 800))));
    // data-mode="page" = deliberate whole-page takeover, so full-screen
    // heroes stay full-screen. Default (a section of the host page) scales
    // them down, which is what makes any page embed sensibly with no
    // per-page authoring.
    if (script.getAttribute("data-mode") === "page") src.set("lpmode", "page");
    forwarded = src.toString();
  } catch (_) {}

  var iframe = document.createElement("iframe");
  // Token route when personalized, slug route otherwise.
  var path = token
    ? "/api/embed/p/" + encodeURIComponent(token)
    : "/api/embed/page/" + encodeURIComponent(slug);
  var triedFallback = !token;
  iframe.src = origin + path + (forwarded ? "?" + forwarded : "");
  iframe.title = "Embedded page";
  iframe.style.width = "100%";
  iframe.style.border = "0";
  iframe.style.display = "block";
  iframe.style.minHeight = "480px";
  iframe.setAttribute("loading", "lazy");

  window.addEventListener("message", function (e) {
    if (e.origin !== origin || e.source !== iframe.contentWindow) return;
    var d = e.data;
    if (!d) return;
    if (d.type === "lp-embed-height") {
      var h = Number(d.height);
      // Same 40000px vh-feedback-loop guard as the agenda loader. NOTE:
      // unlike agendas, arbitrary pages CAN carry min-h-screen heroes —
      // those cap here instead of growing forever, at the cost of a
      // scrollbar inside the frame. Prefer embedding non-viewport-sized
      // pages.
      if (isFinite(h) && h > 0 && h <= 40000) iframe.style.height = Math.ceil(h) + "px";
      return;
    }
    if (d.type === "lp-embed-missing") {
      // Dead token (unpublished, revoked, mistyped): forget it, then fall
      // back to the generic page if one is configured, and only failing
      // that give the section back to the site. Mirrors the agenda loader
      // so a stale personalized link can never strand a visitor.
      try { window.localStorage.removeItem(storageKey); } catch (_) {}
      if (slug && !triedFallback) {
        triedFallback = true;
        iframe.src = origin + "/api/embed/page/" + encodeURIComponent(slug) + (forwarded ? "?" + forwarded : "");
        return;
      }
      if (hideSel) {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
        restoreFallback();
      }
      return;
    }
  });

  hideFallback();
  var target = null;
  var sel = script.getAttribute("data-target");
  if (sel) { try { target = document.querySelector(sel); } catch (_) {} }
  if (!target) target = document.getElementById("lp-page");
  if (target) target.appendChild(iframe);
  else if (script.parentNode) script.parentNode.insertBefore(iframe, script);
})();
`;

router.get("/embed/page.js", embedLimiter, (_req: Request, res: Response): void => {
  res.set("Content-Type", "application/javascript; charset=utf-8");
  res.set("Cross-Origin-Resource-Policy", "cross-origin");
  res.set("Cache-Control", "public, max-age=3600, s-maxage=3600");
  res.send(LOADER_PAGE_JS);
});

/**
 * Resolve + redirect for the generic page loader. Tenant comes from the
 * request host (slugs are unique only per tenant), so a snippet on
 * procore.com pointing at the tenant's own host can only ever reach that
 * tenant's pages.
 */
/**
 * Send the iframe on to the published page. Shared by the slug route (the
 * generic embed everyone sees) and the token route (the personalized one),
 * so the two can never drift on framing headers or param forwarding.
 */
function redirectToPage(req: Request, res: Response, slug: string): void {
  const qs = new URLSearchParams({ embed: "1" });
  for (const [k, v] of Object.entries(req.query)) {
    if (k === "embed") continue; // ours — the loader strips it too, belt and braces
    if (typeof v === "string") qs.append(k, v);
  }
  allowFraming(res);
  res.set("Cache-Control", "no-store");
  res.redirect(302, `/lp/${encodeURIComponent(slug)}?${qs.toString()}`);
}

router.get("/embed/page/:slug", embedLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const rawSlug = req.params.slug;
    const slug = (typeof rawSlug === "string" ? rawSlug : "").trim();
    if (!slug || slug.length > 200) { embedNotFound(res); return; }

    const host = getRequestHost(req);
    const tenantMatch = host ? await findTenantByHost(host) : null;
    if (!tenantMatch) { embedNotFound(res); return; }

    const [page] = await db
      .select({ slug: lpPagesTable.slug, status: lpPagesTable.status })
      .from(lpPagesTable)
      .where(and(eq(lpPagesTable.tenantId, tenantMatch.tenantId), eq(lpPagesTable.slug, slug)));
    if (!page || page.status !== "published") { embedNotFound(res); return; }

    redirectToPage(req, res, page.slug);
  } catch (err) {
    console.error("[embed] page resolve error", err);
    res.status(500).set("Cache-Control", "no-store").send("Internal server error");
  }
});

/**
 * Personalized variant: resolve a page by its opaque embed token, so one
 * installed snippet can render a different page per visitor. The token is
 * looked up with NO tenant (it's globally unique), then the request host's
 * tenant is verified against the page's — without that check, one tenant's
 * token on another tenant's host would cross the namespace.
 */
router.get("/embed/p/:token", embedLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const rawToken = req.params.token;
    const token = (typeof rawToken === "string" ? rawToken : "").trim();
    if (!token || token.length > 64) { embedNotFound(res); return; }

    const [page] = await db
      .select({
        slug: lpPagesTable.slug,
        status: lpPagesTable.status,
        tenantId: lpPagesTable.tenantId,
      })
      .from(lpPagesTable)
      .where(eq(lpPagesTable.embedToken, token));
    if (!page || page.status !== "published") { embedNotFound(res); return; }

    const host = getRequestHost(req);
    const tenantMatch = host ? await findTenantByHost(host) : null;
    if (!tenantMatch || tenantMatch.tenantId !== page.tenantId) { embedNotFound(res); return; }

    redirectToPage(req, res, page.slug);
  } catch (err) {
    console.error("[embed] page token resolve error", err);
    res.status(500).set("Cache-Control", "no-store").send("Internal server error");
  }
});

router.get("/embed/agenda.js", embedLimiter, (_req: Request, res: Response): void => {
  res.set("Content-Type", "application/javascript; charset=utf-8");
  // Required: helmet's default CORP (same-origin) blocks cross-origin
  // <script src> loads of this file. That header exists to protect
  // resources from being read cross-site — this script is designed for it.
  res.set("Cross-Origin-Resource-Policy", "cross-origin");
  // One hour at the edge — the loader changes rarely, and a stale loader
  // still resolves tokens live via the redirect.
  res.set("Cache-Control", "public, max-age=3600, s-maxage=3600");
  res.send(LOADER_JS);
});

/** Friendly in-iframe 404 — an embedded frame showing raw JSON reads as a
 *  broken customer website; a quiet sentence does not. Also posts
 *  `lp-embed-missing` to the parent: a loader configured with `data-hide`
 *  removes the frame and restores the site's own agenda widget (RainFocus)
 *  instead of showing the sentence. targetOrigin "*" is fine — the message
 *  carries nothing, and the loader checks the source window regardless. */
function embedNotFound(res: Response): void {
  allowFraming(res);
  res.status(404)
    .set("Content-Type", "text/html; charset=utf-8")
    .set("Cache-Control", "no-store")
    .send(
      "<!doctype html><html><body style=\"margin:0;font-family:system-ui,sans-serif;color:#666;display:flex;align-items:center;justify-content:center;min-height:120px\">" +
      "<p>This agenda isn’t available.</p>" +
      "<script>try{if(window.parent!==window)window.parent.postMessage({type:\"lp-embed-missing\"},\"*\")}catch(e){}</script>" +
      "</body></html>",
    );
}

router.get("/embed/agenda/:token", embedLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const rawToken = req.params.token;
    const token = (typeof rawToken === "string" ? rawToken : "").trim();
    // Tokens are 22 chars of base64url; the cap just keeps junk out of the
    // index scan. No format check beyond that — cheap and future-proof.
    if (!token || token.length > 64) { embedNotFound(res); return; }

    const [agenda] = await db
      .select({
        tenantId: salesEventAgendasTable.tenantId,
        status: salesEventAgendasTable.status,
        lpPageId: salesEventAgendasTable.lpPageId,
      })
      .from(salesEventAgendasTable)
      .where(eq(salesEventAgendasTable.embedToken, token));
    if (!agenda || agenda.status !== "published" || agenda.lpPageId == null) {
      embedNotFound(res);
      return;
    }

    // Host↔tenant check — see module comment. A host that resolves to no
    // tenant (bare Replit dev domain, apex) can't scope the slug lookup the
    // /lp/ page will do after the redirect, so it 404s too.
    const host = getRequestHost(req);
    const tenantMatch = host ? await findTenantByHost(host) : null;
    if (!tenantMatch || tenantMatch.tenantId !== agenda.tenantId) {
      embedNotFound(res);
      return;
    }

    const [page] = await db
      .select({ slug: lpPagesTable.slug, status: lpPagesTable.status })
      .from(lpPagesTable)
      .where(and(eq(lpPagesTable.tenantId, agenda.tenantId), eq(lpPagesTable.id, agenda.lpPageId)));
    if (!page || page.status !== "published") { embedNotFound(res); return; }

    const qs = new URLSearchParams({ embed: "1" });
    for (const [k, v] of Object.entries(req.query)) {
      if (FORWARDED_PARAMS.test(k) && typeof v === "string" && v) qs.append(k, v);
    }

    allowFraming(res);
    // no-store: unpublish/revoke must take effect on the next load, and the
    // target page carries its own edge caching anyway.
    res.set("Cache-Control", "no-store");
    // Relative Location keeps the request host — which the tenant check
    // above just validated — so the /lp/ slug resolves in the right tenant.
    res.redirect(302, `/lp/${encodeURIComponent(page.slug)}?${qs.toString()}`);
  } catch (err) {
    console.error("[embed] agenda resolve error", err);
    res.status(500).set("Cache-Control", "no-store").send("Internal server error");
  }
});

export default router;
