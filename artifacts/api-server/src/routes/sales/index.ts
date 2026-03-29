import { Router } from "express";
import accountsRouter from "./accounts";
import contactsRouter from "./contacts";
import signalsRouter from "./signals";

const router = Router();

router.use(accountsRouter);
router.use(contactsRouter);
router.use(signalsRouter);

export default router;
