import { Router, type IRouter } from "express";

const router: IRouter = Router();

/**
 * Dev-only deliberate error route used to verify Sentry wiring end-to-end.
 * Hard-gated: in production the route is never registered.
 */
if (process.env.NODE_ENV !== "production") {
  router.get("/lp/test-sentry-error", (_req, _res, next) => {
    next(new Error("Sentry test error — verifying error reporting pipeline"));
  });
}

export default router;
