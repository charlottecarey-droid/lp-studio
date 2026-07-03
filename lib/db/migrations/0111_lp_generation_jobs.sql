-- Async generation job records (July 2026 reliability workstream).
-- See lib/db/src/schema/lpGenerationJobs.ts for the full rationale.
CREATE TABLE IF NOT EXISTS lp_generation_jobs (
        id text PRIMARY KEY,
        tenant_id integer NOT NULL,
        kind text NOT NULL,
        status text NOT NULL DEFAULT 'queued',
        request jsonb NOT NULL,
        stage text,
        result jsonb,
        error text,
        created_at timestamptz NOT NULL DEFAULT now(),
        started_at timestamptz,
        finished_at timestamptz,
        heartbeat_at timestamptz
);
CREATE INDEX IF NOT EXISTS lp_generation_jobs_tenant_created_idx
        ON lp_generation_jobs (tenant_id, created_at);
