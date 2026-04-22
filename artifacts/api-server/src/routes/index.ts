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
import webhooksRouter from "./webhooks";
import { requireAuth } from "../middleware/requireAuth";

const router: IRouter = Router();

// Public LP paths — called from unauthenticated landing pages / review links.
// Each entry is matched against (method, path). Use "*" for any method.
const LP_PUBLIC: { method: string; pattern: RegExp }[] = [
  { method: "*",    pattern: /^\/lp\/track/ },
  { method: "*",    pattern: /^\/lp\/page\// },           // GET /lp/page/:slug (variant config for public viewer)
  { method: "POST", pattern: /^\/lp\/leads$/ },           // POST /lp/leads (form submissions)
  { method: "GET",  pattern: /^\/lp\/forms\/\d+$/ },      // GET /lp/forms/:id — public form config for landing page rendering (writes still require auth)
  { method: "*",    pattern: /^\/lp\/review\// },         // GET/PATCH /lp/review/:token
  { method: "GET",  pattern: /^\/lp\/resolve-token\// },  // GET /lp/resolve-token/:token
  { method: "*",    pattern: /^\/lp\/personalized\// },   // personalized link tracking
  { method: "GET",  pattern: /^\/lp\/og-preview\// },     // GET /lp/og-preview/:slug — OG meta HTML for social bots
  { method: "GET",  pattern: /^\/sales\/resolve\// },     // GET /sales/resolve/:token — visited by contacts from email (no auth)
  { method: "*",    pattern: /^\/webhooks\// },           // POST /webhooks/rb2b, /webhooks/apollo — third-party visitor identification
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
router.use(authRouter);
router.use(lpRouter);
router.use(storageRouter);
router.use("/dso", dsoRouter);
router.use("/sales", salesRouter);
router.use(videoRouter);
router.use("/admin", adminRouter);
router.use(blockCatalogRouter);
router.use("/webhooks", webhooksRouter);

export default router;
