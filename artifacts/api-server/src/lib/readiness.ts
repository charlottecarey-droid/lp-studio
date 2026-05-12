// Boot-readiness flag.
//
// Deployment health probes (Replit autoscale) only wait ~60s for the artifact
// to bind its port. Our boot path runs a long batch of idempotent migrations
// + backfills BEFORE listening, which can exceed that window on cold starts —
// the deploy then SIGTERMs the process before it ever opens port 8080.
//
// To fix that, server.ts now binds the port first and runs migrations in
// parallel. This module is the tiny shared signal between the two: app.ts
// mounts a middleware that 503s `/api/*` requests until `setReady()` flips
// to true, so requests issued during the (usually sub-second) migration
// window get a clean retryable response instead of crashing on a missing
// table.
let ready = false;

export function isReady(): boolean {
  return ready;
}

export function setReady(): void {
  ready = true;
}
