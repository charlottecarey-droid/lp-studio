import { Router } from "express";
import accountsRouter from "./accounts";
import contactsRouter from "./contacts";
import signalsRouter from "./signals";
import templatesRouter from "./templates";
import campaignsRouter from "./campaigns";
import hotlinksRouter from "./hotlinks";
import campaignPagesRouter from "./campaign-pages";
import audiencesRouter from "./audiences";
import emailGenerateRouter from "./email-generate";
import briefingsRouter from "./briefings";
import generateMicrositeRouter from "./generate-microsite";
import sfdcRouter from "./sfdc";
import inboundRouter from "./inbound";
import importRouter from "./import";

const router = Router();

router.use(accountsRouter);
router.use(contactsRouter);
router.use(signalsRouter);
router.use(templatesRouter);
router.use(campaignsRouter);
router.use(hotlinksRouter);
router.use(campaignPagesRouter);
router.use(audiencesRouter);
router.use(emailGenerateRouter);
router.use(briefingsRouter);
router.use(generateMicrositeRouter);
router.use(sfdcRouter);
router.use("/inbound", inboundRouter);
router.use(importRouter);

export default router;
