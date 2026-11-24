-- Claude connector: OAuth 2.1 for the LP Studio MCP endpoint (/api/mcp).
-- A rep adds LP Studio to their Claude as a custom connector; Claude registers
-- itself as a client, the rep signs in and approves, and Claude gets tokens
-- that act as that rep in one workspace. Secrets are stored as SHA-256 hashes.

-- Clients Claude registers through dynamic client registration.
CREATE TABLE IF NOT EXISTS "mcp_oauth_clients" (
  "client_id" text PRIMARY KEY NOT NULL,
  "client_name" text,
  "redirect_uris" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- An authorization request waiting for the rep to sign in and approve.
CREATE TABLE IF NOT EXISTS "mcp_oauth_requests" (
  "id" text PRIMARY KEY NOT NULL,
  "client_id" text NOT NULL,
  "redirect_uri" text NOT NULL,
  "code_challenge" text NOT NULL,
  "state" text,
  "scope" text,
  "resource" text,
  "expires_at" timestamp with time zone NOT NULL,
  "decided_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- One approved connection: a rep, a workspace, a Claude client. Revoking it
-- kills every token issued under it.
CREATE TABLE IF NOT EXISTS "mcp_oauth_grants" (
  "id" text PRIMARY KEY NOT NULL,
  "client_id" text NOT NULL,
  "user_id" integer NOT NULL,
  "tenant_id" integer NOT NULL,
  "scope" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_used_at" timestamp with time zone,
  "revoked_at" timestamp with time zone
);
CREATE INDEX IF NOT EXISTS "mcp_oauth_grants_user_idx" ON "mcp_oauth_grants" USING btree ("user_id", "tenant_id");

-- Authorization codes (single use, short-lived) and access/refresh tokens.
CREATE TABLE IF NOT EXISTS "mcp_oauth_tokens" (
  "token_hash" text PRIMARY KEY NOT NULL,
  "kind" text NOT NULL,
  "grant_id" text NOT NULL,
  "redirect_uri" text,
  "code_challenge" text,
  "expires_at" timestamp with time zone NOT NULL,
  "used_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "mcp_oauth_tokens_grant_idx" ON "mcp_oauth_tokens" USING btree ("grant_id");
