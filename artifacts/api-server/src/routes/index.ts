import { Router, type IRouter } from "express";
import healthRouter from "./health";
import lpRouter from "./lp";
import storageRouter from "./storage";
import dsoRouter from "./dso";
import salesRouter from "./sales";
import videoRouter from "./video";
import authRouter from "./auth";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(lpRouter);
router.use(storageRouter);
router.use("/dso", dsoRouter);
router.use("/sales", salesRouter);
router.use(videoRouter);
router.use("/admin", adminRouter);

export default router;
