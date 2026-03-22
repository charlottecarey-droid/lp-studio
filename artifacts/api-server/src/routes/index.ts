import { Router, type IRouter } from "express";
import healthRouter from "./health";
import lpRouter from "./lp";

const router: IRouter = Router();

router.use(healthRouter);
router.use(lpRouter);

export default router;
