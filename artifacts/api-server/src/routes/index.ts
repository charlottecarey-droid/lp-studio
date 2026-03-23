import { Router, type IRouter } from "express";
import healthRouter from "./health";
import lpRouter from "./lp";
import storageRouter from "./storage";

const router: IRouter = Router();

router.use(healthRouter);
router.use(lpRouter);
router.use(storageRouter);

export default router;
