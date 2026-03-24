import { Router } from "express";
import testsRouter from "./tests";
import variantsRouter from "./variants";
import trackingRouter from "./tracking";
import resultsRouter from "./results";
import brandRouter from "./brand";
import pagesRouter from "./pages";
import collaborationRouter from "./collaboration";
import analyticsRouter from "./analytics";
import libraryRouter from "./library";
import blockDefaultsRouter from "./block-defaults";
import customBlocksRouter from "./custom-blocks";
import brandPresetsRouter from "./brand-presets";
import brandImportRouter from "./brand-import";
import copyGenerateRouter from "./copy-generate";
import leadsRouter from "./leads";
import formNotificationsRouter from "./form-notifications";

const router = Router();

router.use(testsRouter);
router.use(variantsRouter);
router.use(trackingRouter);
router.use(resultsRouter);
router.use(brandRouter);
router.use(pagesRouter);
router.use(collaborationRouter);
router.use(analyticsRouter);
router.use(libraryRouter);
router.use(blockDefaultsRouter);
router.use(customBlocksRouter);
router.use(brandPresetsRouter);
router.use(brandImportRouter);
router.use(copyGenerateRouter);
router.use(leadsRouter);
router.use(formNotificationsRouter);

export default router;
