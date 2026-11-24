import { pgTable, text, integer, jsonb, timestamp, index } from "drizzle-orm/pg-core";

/**
 * Claude connector (Nov 2026) — OAuth 2.1 behind the LP Studio MCP endpoint
 * (`/api/mcp`). See migration 0172 and `api-server/src/lib/mcp/`.
 *
 * Secrets (codes, access and refresh tokens) are stored only as SHA-256
 * hashes in `mcp_oauth_tokens.token_hash`.
 */
export const mcpOauthClientsTable = pgTable("mcp_oauth_clients", {
  clientId: text("client_id").primaryKey(),
  clientName: text("client_name"),
  redirectUris: jsonb("redirect_uris").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const mcpOauthRequestsTable = pgTable("mcp_oauth_requests", {
  id: text("id").primaryKey(),
  clientId: text("client_id").notNull(),
  redirectUri: text("redirect_uri").notNull(),
  codeChallenge: text("code_challenge").notNull(),
  state: text("state"),
  scope: text("scope"),
  resource: text("resource"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const mcpOauthGrantsTable = pgTable(
  "mcp_oauth_grants",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id").notNull(),
    userId: integer("user_id").notNull(),
    tenantId: integer("tenant_id").notNull(),
    scope: text("scope"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [index("mcp_oauth_grants_user_idx").on(t.userId, t.tenantId)],
);

export const mcpOauthTokensTable = pgTable(
  "mcp_oauth_tokens",
  {
    tokenHash: text("token_hash").primaryKey(),
    /** "code" | "access" | "refresh" */
    kind: text("kind").notNull(),
    grantId: text("grant_id").notNull(),
    redirectUri: text("redirect_uri"),
    codeChallenge: text("code_challenge"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("mcp_oauth_tokens_grant_idx").on(t.grantId)],
);
