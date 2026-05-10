import { Router, type IRouter, type Request } from "express";
import express from "express";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.post(
  "/csp-report",
  express.json({
    type: ["application/csp-report", "application/reports+json", "application/json"],
    limit: "100kb",
  }),
  (req: Request, res) => {
    const body = req.body as unknown;
    logger.warn({ cspReport: body, ua: req.get("user-agent") }, "CSP violation report");
    res.status(204).end();
  },
);

export default router;
