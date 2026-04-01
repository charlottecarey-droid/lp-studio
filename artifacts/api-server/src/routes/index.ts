import { Router, type IRouter } from "express";
import healthRouter from "./health";
import lpRouter from "./lp";
import storageRouter from "./storage";
import dsoRouter from "./dso";
import salesRouter from "./sales";
import videoRouter from "./video";
import authRouter from "./auth";
import adminRouter from "./admin";
import { requireAuth } from "../middleware/requireAuth";

const router: IRouter = Router();

// Public LP paths — called from unauthenticated landing pages / review links
const LP_PUBLIC = [
  /^\/lp\/track/,
  /^\/lp\/page\//,           // GET /lp/page/:slug (variant config for public viewer)
  /^\/lp\/leads$/,           // POST /lp/leads (form submissions)
  /^\/lp\/review\//,         // GET/PATCH /lp/review/:token
  /^\/lp\/resolve-token\//,  // GET /lp/resolve-token/:token
  /^\/lp\/personalized\//,   // personalized link tracking
];

// Auth guard for /lp/* and /sales/* (applied before the routers)
router.use((req, _res, next) => {
  const path = req.path;
  const isProtected =
    path.startsWith("/lp/") || path.startsWith("/sales/");
  if (!isProtected || LP_PUBLIC.some((p) => p.test(path))) {
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

export default router;
