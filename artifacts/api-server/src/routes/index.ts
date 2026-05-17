import { Router, type IRouter } from "express";
import healthRouter from "./health";
import lpRouter from "./lp";
import storageRouter from "./storage";
import dsoRouter from "./dso";
import salesRouter from "./sales";
import videoRouter from "./video";
import authRouter from "./auth";
import adminRouter from "./admin";
import blockCatalogRouter from "./blockCatalog";
import tenantBlockLibraryRouter from "./tenantBlockLibrary";
import webhooksRouter from "./webhooks";
import cspReportRouter from "./cspReport";
import { requireAuth } from "../middleware/requireAuth";

const router: IRouter = Router();

// Public LP paths — called from unauthenticated landing pages / review links.
// Each entry is matched against (method, path). Use "*" for any method.
const LP_PUBLIC: { method: string; pattern: RegExp }[] = [
  { method: "*",    pattern: /^\/lp\/track/ },
  { method: "*",    pattern: /^\/lp\/page\// },           // GET /lp/page/:slug (variant config for public viewer)
  { method: "GET",  pattern: /^\/lp\/preview\// },        // GET /lp/preview/:slug — does its own auth-or-token check; must skip blanket auth so unauth requests 404 instead of 401 (no enumeration)
  { method: "GET",  pattern: /^\/lp\/brand$/ },           // GET /lp/brand — brand for the published page (tenant resolved from host)
  { method: "POST", pattern: /^\/lp\/media\/shared\/upload$/ }, // POST /lp/media/shared/upload — admin-only, x-admin-key header
  { method: "POST", pattern: /^\/lp\/media\/reclassify$/ },     // POST /lp/media/reclassify — admin-only, x-admin-key header
  { method: "POST", pattern: /^\/lp\/leads$/ },           // POST /lp/leads (form submissions)
  { method: "POST", pattern: /^\/lp\/heatmap$/ },         // POST /lp/heatmap — anonymous visitor click/scroll ingest from published pages. Aggregate GET /lp/pages/:id/heatmap stays auth-gated.
  { method: "GET",  pattern: /^\/lp\/forms\/\d+$/ },      // GET /lp/forms/:id — public form config for landing page rendering (writes still require auth)
  { method: "*",    pattern: /^\/lp\/review\// },         // GET/PATCH /lp/review/:token
  { method: "GET",  pattern: /^\/lp\/resolve-token\// },  // GET /lp/resolve-token/:token
  { method: "*",    pattern: /^\/lp\/personalized\// },   // personalized link tracking
  { method: "POST", pattern: /^\/lp\/rss\/parse$/ },      // POST /lp/rss/parse — public RSS proxy/parser for content-series live sync
  { method: "GET",  pattern: /^\/lp\/podcast-availability$/ }, // GET /lp/podcast-availability?sheetId=…&tab=… — public Google Sheets-backed slot picker for content-series guest forms
  { method: "GET",  pattern: /^\/lp\/og-preview\// },     // GET /lp/og-preview/:slug — OG meta HTML for social bots
  { method: "GET",  pattern: /^\/sales\/resolve\// },     // GET /sales/resolve/:token — visited by contacts from email (no auth)
  { method: "GET",  pattern: /^\/sales\/track\// },        // GET /sales/track/click-hotlink, /sales/track/open — click/open tracking from emails
  { method: "*",    pattern: /^\/sales\/unsubscribe$/ },  // GET/POST /sales/unsubscribe — one-click unsubscribe links from emails
  { method: "*",    pattern: /^\/webhooks\// },           // POST /webhooks/rb2b, /webhooks/apollo — third-party visitor identification
  { method: "GET",  pattern: /^\/lp\/test-sentry-error$/ }, // dev-only — guarded by NODE_ENV in the route module itself
];

// Auth guard for /lp/* and /sales/* (applied before the routers)
router.use((req, _res, next) => {
  const path = req.path;
  const isProtected =
    path.startsWith("/lp/") || path.startsWith("/sales/");
  const isPublic = LP_PUBLIC.some(
    (e) => (e.method === "*" || e.method === req.method) && e.pattern.test(path),
  );
  if (!isProtected || isPublic) {
    return next();
  }
  return requireAuth(req, _res, next);
});

router.use(healthRouter);
router.use(cspReportRouter);
router.use(authRouter);
router.use(lpRouter);
router.use(storageRouter);
router.use("/dso", dsoRouter);
router.use("/sales", salesRouter);
router.use(videoRouter);
// blockCatalogRouter must be mounted BEFORE the "/admin" adminRouter mount.
// adminRouter contains a wildcard `router.use(requireAuth)` at admin.ts:707
// that 401s any request hitting the /admin prefix without a logged-in
// session — even if the request was actually destined for a sibling router
// with its own gate (here: blockCatalogRouter, which uses requireAdminKey
// for the superadmin /admin/block-catalog endpoints). Mounting
// blockCatalogRouter first lets its specific routes match before
// adminRouter gets a chance to swallow the request.
router.use(blockCatalogRouter);
router.use(tenantBlockLibraryRouter);
router.use("/admin", adminRouter);
router.use("/webhooks", webhooksRouter);

export default router;
