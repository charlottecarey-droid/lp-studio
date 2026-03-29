import { Router, type IRouter } from "express";
import healthRouter from "./health";
import lpRouter from "./lp";
import storageRouter from "./storage";
import dsoRouter from "./dso";
import salesRouter from "./sales";

const router: IRouter = Router();

router.use(healthRouter);
router.use(lpRouter);
router.use(storageRouter);
router.use("/dso", dsoRouter);
router.use("/sales", salesRouter);

export default router;
