import { Router } from "express";
import accountsRouter from "./accounts";
import contactsRouter from "./contacts";
import signalsRouter from "./signals";
import templatesRouter from "./templates";
import campaignsRouter from "./campaigns";
import hotlinksRouter from "./hotlinks";
import emailGenerateRouter from "./email-generate";

const router = Router();

router.use(accountsRouter);
router.use(contactsRouter);
router.use(signalsRouter);
router.use(templatesRouter);
router.use(campaignsRouter);
router.use(hotlinksRouter);
router.use(emailGenerateRouter);

export default router;
