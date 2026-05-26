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
import draftEmailRouter from "./draft-email";
import briefingsRouter from "./briefings";
import generateMicrositeRouter from "./generate-microsite";
import sfdcRouter from "./sfdc";
import inboundRouter from "./inbound";
import importRouter from "./import";
import personBriefRouter from "./person-brief";
import layoutDefaultsRouter from "./layout-defaults";
import onePagerTemplatesRouter from "./one-pager-templates";
import webOnePagerRouter from "./web-one-pager";
import resendWebhookRouter from "./resend-webhook";
import brandContextRouter from "./brand-context";
import { requirePlanFeature } from "../../middleware/requirePlanFeature";

const router = Router();

// /sales/templates/* is shared with the Marketing tool: the "Follow-up
// email to submitter" panel on landing-page Forms (FollowUpEmailSection
// in lp-studio) reads/writes templates through this router and stores
// the chosen templateId on the form. Marketing-only (starter) tenants
// must keep CRUD access here even though the rest of the Sales Console
// is gated. MUST be mounted BEFORE the requirePlanFeature line below so
// Express matches /sales/templates/* before the gate runs.
router.use(templatesRouter);

// Everything below this line is gated to plans that include the
// Sales Console. Mount order matters: gate middleware applies only to
// routes registered AFTER it. The middleware is a no-op when
// req.authUser is unset (public visitor endpoints) and bypasses for
// superadmin; see middleware/requirePlanFeature.ts for the full
// behaviour.
router.use(requirePlanFeature("salesConsole"));

router.use(accountsRouter);
router.use(contactsRouter);
router.use(signalsRouter);
router.use(campaignsRouter);
router.use(hotlinksRouter);
router.use(campaignPagesRouter);
router.use(audiencesRouter);
router.use(emailGenerateRouter);
router.use(draftEmailRouter);
router.use(briefingsRouter);
router.use(generateMicrositeRouter);
router.use(sfdcRouter);
router.use("/inbound", inboundRouter);
router.use(importRouter);
router.use(personBriefRouter);
router.use(layoutDefaultsRouter);
router.use(onePagerTemplatesRouter);
router.use(webOnePagerRouter);
router.use("/webhooks", resendWebhookRouter);
router.use(brandContextRouter);

export default router;
