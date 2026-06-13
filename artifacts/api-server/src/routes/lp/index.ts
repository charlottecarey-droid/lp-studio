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
import proofPointsRouter from "./proof-points";
import proofPointsImportRouter from "./proof-points-import";
import blockDefaultsRouter from "./block-defaults";
import customBlocksRouter from "./custom-blocks";
import customBlocksGenerateRouter from "./custom-blocks-generate";
import imageGenerateRouter from "./image-generate";
import brandPresetsRouter from "./brand-presets";
import brandImportRouter from "./brand-import";
import brandImportFromUrlRouter from "./brand-import-from-url";
import brandImportFromUrlStreamRouter from "./brand-import-from-url-stream";
import copyGenerateRouter from "./copy-generate";
import adCopyRouter from "./ad-copy";
import leadsRouter from "./leads";
import formNotificationsRouter from "./form-notifications";
import formsRouter from "./forms";
import generatePageRouter from "./generate-page";
import seoAnalyzeRouter from "./seo-analyze";
import seoMetaGenerateRouter from "./seo-meta-generate";
import integrationsRouter from "./integrations";
import smartTrafficRouter from "./smart-traffic";
import heatmapRouter from "./heatmap";
import performanceRouter from "./performance";
import personalizedLinksRouter from "./personalized-links";
import tokenResolveRouter from "./token-resolve";
import contentBriefRouter from "./content-brief";
import inUseImagesRouter from "./in-use-images";
import templatesRouter from "./templates";
import testSentryErrorRouter from "./test-sentry-error";
import adminTemplatesRouter from "./adminTemplates";
import conversionScoringRouter from "./conversion-scoring";
import pageSpeedRouter from "./page-speed";
import programmaticPagesRouter from "./programmatic-pages";
import adMapRouter from "./ad-map";
import pageDetailRouter from "./page-detail";
import rssSyncRouter from "./rss-sync";
import extractGuestsRouter from "./extract-guests";
import podcastAvailabilityRouter from "./podcast-availability";
import contentSeriesRouter from "./content-series";
import renderedRouter from "./rendered";
import seoFilesRouter from "./seo-files";
import planConfigRouter from "./plan-config";
import featuredTemplatesRouter from "./featured-templates";
import homepageOgRouter from "./homepage-og";
import marketingPageOgRouter from "./marketing-page-og";
import emailDomainRouter from "./email-domain";
import brandedEmailSubdomainRouter from "./branded-email-subdomain";
import factFlagsRouter from "./fact-flags";
import copilotChatRouter from "./copilot-chat";
import blogRouter from "./blog";

const router = Router();

router.use(testsRouter);
router.use(variantsRouter);
router.use(trackingRouter);
// Task #364: serves prerendered published landing-page HTML keyed by
// (tenant_id, slug). Public — tenant resolved from request host. Falls
// through to 404 for drafts/preview/unrendered pages so the SPA edge
// can take over.
router.use(renderedRouter);
// Host-scoped robots.txt + sitemap.xml for published tenant pages. Public —
// tenant resolved from request host; proxied to /robots.txt + /sitemap.xml
// at the edge by cloudflare/tenant-host-router.
router.use(seoFilesRouter);
router.use(planConfigRouter);
router.use(featuredTemplatesRouter);
router.use(homepageOgRouter);
router.use(marketingPageOgRouter);
// First-party marketing blog: public GET /lp/blog/* (allowlisted in LP_PUBLIC)
// + superadmin /admin/blog/* CRUD (requireSuperadmin per-route). NOT
// tenant-scoped — this is LP Studio's own blog for the marketing apex.
router.use(blogRouter);
router.use(emailDomainRouter);
router.use(brandedEmailSubdomainRouter);
router.use(resultsRouter);
router.use(brandRouter);
router.use(performanceRouter); // Must come before pagesRouter to avoid /lp/pages/:pageId catching /lp/pages/performance/batch
router.use(pagesRouter);
router.use(collaborationRouter);
router.use(analyticsRouter);
router.use(libraryRouter);
router.use(proofPointsRouter);
router.use(proofPointsImportRouter);
router.use(blockDefaultsRouter);
router.use(customBlocksRouter);
router.use(customBlocksGenerateRouter);
router.use(imageGenerateRouter);
router.use(brandPresetsRouter);
router.use(brandImportRouter);
router.use(brandImportFromUrlRouter);
router.use(brandImportFromUrlStreamRouter);
router.use(copyGenerateRouter);
router.use(adCopyRouter);
router.use(leadsRouter);
router.use(formNotificationsRouter);
router.use(formsRouter);
router.use(generatePageRouter);
router.use(seoAnalyzeRouter);
router.use(seoMetaGenerateRouter);
router.use(integrationsRouter);
router.use(smartTrafficRouter);
router.use(heatmapRouter);
router.use(pageSpeedRouter); // Page Speed Engine routes
router.use(personalizedLinksRouter);
router.use(tokenResolveRouter);
router.use(contentBriefRouter);
router.use(inUseImagesRouter);
router.use(templatesRouter);
router.use(adminTemplatesRouter);
router.use(conversionScoringRouter);
router.use(programmaticPagesRouter);
router.use(pageDetailRouter); // per-page analytics detail (static /lp/analytics/pages/:pageId/* — before any :pageId catch-alls)
router.use(adMapRouter);
router.use(rssSyncRouter);
router.use(extractGuestsRouter);
router.use(podcastAvailabilityRouter);
router.use(contentSeriesRouter);
router.use(factFlagsRouter);
router.use(copilotChatRouter);
router.use(testSentryErrorRouter);

export default router;
