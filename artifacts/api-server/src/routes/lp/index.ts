import { Router } from "express";
import testsRouter from "./tests";
import variantsRouter from "./variants";
import trackingRouter from "./tracking";
import resultsRouter from "./results";
import brandRouter from "./brand";

const router = Router();

router.use(testsRouter);
router.use(variantsRouter);
router.use(trackingRouter);
router.use(resultsRouter);
router.use(brandRouter);

export default router;
