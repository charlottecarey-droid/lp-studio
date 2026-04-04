import { pgTable, text, serial, timestamp, jsonb, boolean, integer } from "drizzle-orm/pg-core";

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
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type LpForm = typeof lpFormsTable.$inferSelect;
export type InsertLpForm = typeof lpFormsTable.$inferInsert;
