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
 * Reps then send links to THAT page with `?agenda=<token>` appended. The
 * loader reads the param, iframes `/api/embed/agenda/<token>`, and this
 * router 302s the iframe to the published `/lp/<slug>?embed=1` page. No
 * token on the URL → the `data-default` agenda renders, so the widget always
 * shows something.
 *
 *  PUBLIC (no auth — the `/embed/` prefix is outside the routes/index.ts
 *  auth guard, which only protects `/lp/` and `/sales/`):
 *   - GET /embed/agenda.js       — the loader script. Served with
 *     `Cross-Origin-Resource-Policy: cross-origin`: helmet's default
 *     `same-origin` CORP would make the customer's `<script src>` tag fail.
 *   - GET /embed/agenda/:token   — resolve + redirect. The token is the
 *     opaque `sales_event_agendas.embed_token` (minted at publish); the page
 *     slug is deliberately NOT accepted here — slugs read
 *     `agenda-<account>-<event>`, and URLs on a customer's site shouldn't
 *     leak their account list.
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
const FORWARDED_PARAMS = /^(utm_[a-z]+|gclid)$/i;

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
  var param = script.getAttribute("data-param") || "agenda";
  var token = "";
  try { token = new URLSearchParams(window.location.search).get(param) || ""; } catch (_) {}
  if (!token) token = script.getAttribute("data-default") || "";
  if (!token) return;

  // Forward campaign params from the host page for visit attribution.
  var forwarded = "";
  try {
    var src = new URLSearchParams(window.location.search);
    var out = new URLSearchParams();
    src.forEach(function (v, k) {
      if (/^utm_[a-z]+$/i.test(k) || k.toLowerCase() === "gclid") out.append(k, v);
    });
    forwarded = out.toString();
  } catch (_) {}

  var iframe = document.createElement("iframe");
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
    if (!d || d.type !== "lp-embed-height") return;
    var h = Number(d.height);
    // 40000px cap: a page that sizes content in vh units would otherwise
    // feedback-loop (taller iframe -> taller vh -> taller report, forever).
    // The event-agenda block uses no vh sizing, so real agendas never hit it.
    if (isFinite(h) && h > 0 && h <= 40000) iframe.style.height = Math.ceil(h) + "px";
  });

  var target = null;
  var sel = script.getAttribute("data-target");
  if (sel) { try { target = document.querySelector(sel); } catch (_) {} }
  if (!target) target = document.getElementById("lp-agenda");
  if (target) target.appendChild(iframe);
  else if (script.parentNode) script.parentNode.insertBefore(iframe, script);
})();
`;

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
 *  broken customer website; a quiet sentence does not. */
function embedNotFound(res: Response): void {
  allowFraming(res);
  res.status(404)
    .set("Content-Type", "text/html; charset=utf-8")
    .set("Cache-Control", "no-store")
    .send(
      "<!doctype html><html><body style=\"margin:0;font-family:system-ui,sans-serif;color:#666;display:flex;align-items:center;justify-content:center;min-height:120px\"><p>This agenda isn’t available.</p></body></html>",
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
