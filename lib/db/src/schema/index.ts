export * from "./lpTests";
export * from "./lpVariants";
export * from "./lpSessions";
export * from "./lpEvents";
export * from "./lpBrandSettings";
export * from "./lpPages";
export * from "./lpCollaboration";
export * from "./lpMedia";
export * from "./lpPageVisits";
export * from "./lpLeads";
export * from "./lpForms";
export * from "./lpPageAdCopyRuns";
export * from "./lpSmartTraffic";
export * from "./lpHeatmapEvents";
export * from "./lpProofPoints";
export * from "./lpPageFactFlags";
export * from "./lpTemplateUsage";
export * from "./lpTenantFeaturedTemplates";
export * from "./micrositeTemplateOverrides";

// Sales Console tables
export * from "./salesAccounts";
export * from "./salesContacts";
export * from "./salesHotlinks";
export * from "./salesEmails";
export * from "./salesSignals";
export * from "./salesBriefings";
export * from "./salesContactBriefings";
export * from "./salesInbound";
export * from "./salesLayoutDefaults";
export * from "./salesOnePagerTemplates";

// Salesforce Integration
export * from "./sfdcIntegration";

// Marketo Integration (Phase 2 — bidirectional)
export * from "./marketoIntegration";
export * from "./hubspotIntegration";

// Slack Notifier (outbound-only)
export * from "./slackIntegration";

// Multi-tenant identity tables
export * from "./tenants";
export * from "./appUsers";
export * from "./appSessions";
export * from "./authExchangeCodes";
export * from "./oauthLoginStates";
export * from "./authEmailTokens";
export * from "./tenantRoles";
export * from "./tenantMembers";

// Block catalog (per-industry library configuration)
export * from "./blockCatalog";
// Tenant block governance (per-tenant enabled / AI-mode / segment approval)
export * from "./tenantBlockGovernance";
export * from "./aiGenerationLog";

// Shared conversation engine (Builder Copilot v1 + future bots) — one
// mode-tagged transcript table for every conversational surface.
export * from "./conversations";

// Per-tenant inbound webhook secrets
export * from "./tenantWebhookSecrets";

// SuperAdmin-configurable plan/pricing tiers
export * from "./planConfig";

// Superadmin-editable list of featured templates shown on the marketing homepage
export * from "./featuredTemplates";

// Trial phone gating (one free trial per SMS-verified phone number)
export * from "./trialPhoneVerifications";
// Audit trail for superadmin trial-phone releases
export * from "./trialPhoneReleaseLog";
// Audit trail for superadmin trial-phone lookups
export * from "./trialPhoneLookupLog";

// General-purpose, system-wide audit trail for sensitive superadmin actions
export * from "./auditLog";

// In-app notifications + lifecycle email system
export * from "./notificationTemplates";
export * from "./notificationSends";
export * from "./notificationPreferences";
export * from "./emailShellTemplates";
export * from "./tenantEmailShells";
export * from "./emailTemplateEditLog";
export * from "./broadcastAlertRecipients";
export * from "./broadcastRecipientGroups";

// Content Series block — episode-notification bookkeeping (subscribers, dedupe)
export * from "./contentSeriesNotifications";

// Marketing homepage share card (Open Graph) — superadmin-editable, single row
export * from "./marketingHomepageOg";
export * from "./marketingAnnouncementBanner";
export * from "./marketingPageOg";

// LP Studio's own first-party marketing blog (single, NOT per-tenant) —
// authored from /superadmin, rendered on the public marketing apex for SEO/GEO.
export * from "./blogPosts";

// Blog Phase 4 — content program (themes, topic pipeline, program settings)
// powering the autonomous-publishing backlog. Superadmin-owned, NOT per-tenant.
export * from "./blogContentProgram";

// Admin-configurable generator presets (marketing starter chips + sales
// objective cards): global superadmin defaults + per-tenant overrides.
export * from "./generatorPresets";
