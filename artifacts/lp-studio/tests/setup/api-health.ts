// Fast-fail probe for the api-server's /healthz endpoint.
//
// The four tenant-backed e2e specs (page-review-workflow, webhook-tenant-routing,
// workspace-slug-rename, chili-piper-handoff) all hit the api-server directly
// on http://127.0.0.1:$E2E_API_PORT. If the api-server crashed during startup
// (e.g. a migration deadlock — see task #242), Playwright surfaces a bare
// `ECONNREFUSED` from the very first request, which is hard to triage.
//
// Calling `assertApiHealthy()` once in beforeAll converts that into a clear
// single-line failure pointing at the api-server workflow log.

const DEFAULT_API_PORT = "4319";

export async function assertApiHealthy(apiPort?: string): Promise<void> {
  const port = apiPort ?? process.env.E2E_API_PORT ?? DEFAULT_API_PORT;
  const url = `http://127.0.0.1:${port}/api/healthz`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "GET",
      // Health probe should be fast — if the server is wedged we want to know.
      signal: AbortSignal.timeout(5_000),
    });
  } catch (err) {
    throw new Error(
      `api-server not reachable on port ${port} — see api-server workflow logs ` +
        `(GET ${url} failed: ${(err as Error).message})`,
    );
  }
  if (!res.ok) {
    throw new Error(
      `api-server unhealthy on port ${port} — see api-server workflow logs ` +
        `(GET ${url} returned ${res.status})`,
    );
  }
}
