import { pgTable, text, serial, timestamp, jsonb, boolean, integer } from "drizzle-orm/pg-core";
import { salesEmailTemplatesTable } from "./salesEmails";

export const lpFormsTable = pgTable("lp_forms", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  steps: jsonb("steps").notNull().default([]),
  multiStep: boolean("multi_step").notNull().default(false),
  submitButtonText: text("submit_button_text").default("Submit"),
  successMessage: text("success_message"),
  redirectUrl: text("redirect_url"),
  backgroundStyle: text("background_style").default("white"),
  emailRecipients: jsonb("email_recipients").notNull().default([]),
  webhookUrl: text("webhook_url"),
  marketoConfig: jsonb("marketo_config"),
  salesforceConfig: jsonb("salesforce_config"),
  chiliPiperConfig: jsonb("chili_piper_config"),
  // Per-form GTM dataLayer push config. NULL = use built-in defaults
  // (see DEFAULT_GTM_DATALAYER_CONFIG in artifacts/lp-studio/src/lib/gtm-datalayer.ts).
  // Shape: { enabled: boolean, event: string, formName: string }.
  gtmDataLayerConfig: jsonb("gtm_data_layer_config"),
  // Per-form visual styling (FormStyling shape in
  // artifacts/lp-studio/src/lib/form-styling.ts). NULL = fall through to
  // the block-level styling already on each rendered form block. When set,
  // BlockForm overrides its own surface/input/button/font tokens with
  // these values so a single global form can carry the Inside Dandy /
  // Apple Vision Pro look across every CTA that links to it.
  styling: jsonb("styling"),
  sendFollowUpToSubmitter: boolean("send_follow_up_to_submitter").notNull().default(false),
  followUpTemplateId: integer("follow_up_template_id").references(() => salesEmailTemplatesTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type LpForm = typeof lpFormsTable.$inferSelect;
export type InsertLpForm = typeof lpFormsTable.$inferInsert;
