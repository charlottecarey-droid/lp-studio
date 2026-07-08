import { Router } from "express";
import accountsRouter from "./accounts";
import contactsRouter from "./contacts";
import signalsRouter from "./signals";
import templatesRouter from "./templates";
import campaignsRouter from "./campaigns";
import hotlinksRouter from "./hotlinks";
import linkExportRouter from "./link-export";
import campaignPagesRouter from "./campaign-pages";
import audiencesRouter from "./audiences";
import emailGenerateRouter from "./email-generate";
import draftEmailRouter from "./draft-email";
import assistantRouter from "./assistant";
import briefingsRouter from "./briefings";
import generateMicrositeRouter from "./generate-microsite";
import micrositeExemplarFetchRouter from "./microsite-exemplar-fetch";
import sfdcRouter from "./sfdc";
import marketoRouter from "./marketo";
import hubspotRouter from "./hubspot";
import slackRouter from "./slack";
import inboundRouter from "./inbound";
import importRouter from "./import";
import personBriefRouter from "./person-brief";
import layoutDefaultsRouter from "./layout-defaults";
import onePagerTemplatesRouter from "./one-pager-templates";
import webOnePagerRouter from "./web-one-pager";
import resendWebhookRouter from "./resend-webhook";
import brandContextRouter from "./brand-context";
import brandFontRouter from "./brand-font";
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

// Brand-font resolver for PDF one-pagers. One-pagers are available on every
// plan (the Dandy-only built-in gate was retired), so this proxy must stay
// open to all plans too — mount it BEFORE the salesConsole plan gate. It reads
// no tenant data (pure Google Fonts → TTF proxy) and is auth-gated by the
// global /sales guard.
router.use(brandFontRouter);

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
router.use(linkExportRouter);
router.use(campaignPagesRouter);
router.use(audiencesRouter);
router.use(emailGenerateRouter);
router.use(draftEmailRouter);
router.use(assistantRouter);
router.use(briefingsRouter);
router.use(generateMicrositeRouter);
router.use(micrositeExemplarFetchRouter);
router.use(sfdcRouter);
router.use(marketoRouter);
router.use(hubspotRouter);
router.use(slackRouter);
router.use("/inbound", inboundRouter);
router.use(importRouter);
router.use(personBriefRouter);
router.use(layoutDefaultsRouter);
router.use(onePagerTemplatesRouter);
router.use(webOnePagerRouter);
router.use("/webhooks", resendWebhookRouter);
router.use(brandContextRouter);

export default router;
