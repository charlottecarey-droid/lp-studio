/**
 * One-shot programmatic test of the streaming brand importer.
 *
 * Usage:
 *   pnpm --filter @workspace/api-server exec tsx scripts/test-brand-import.ts <url>
 *
 * Runs `runOrchestrator` against the single URL passed on the command line
 * and merges the result into `.local/brand-import-test-results.json`
 * (keyed by URL). We run URLs one-at-a-time from the shell with a sleep
 * between invocations to let the AI proxy's per-minute rate-limit window
 * cool down between bursts.
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "fs";
import path from "path";
import { runOrchestrator } from "../src/lib/brand-import/index.ts";

interface PerUrlResult {
  url: string;
  events: unknown[];
  durationMs: number;
  done: unknown | null;
  error: string | null;
}

async function runOne(url: string): Promise<PerUrlResult> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) throw new Error("FIRECRAWL_API_KEY not set");
  const t0 = Date.now();
  const events: unknown[] = [];
  let done: unknown | null = null;
  let error: string | null = null;
  try {
    for await (const ev of runOrchestrator(url, apiKey, { forceRefresh: true })) {
      events.push(ev);
      if ((ev as { event: string }).event === "done") done = (ev as { payload: unknown }).payload;
      if ((ev as { event: string }).event === "error") error = String((ev as { error: unknown }).error);
    }
  } catch (e) {
    error = String(e);
  }
  return { url, events, done, error, durationMs: Date.now() - t0 };
}

async function main(): Promise<void> {
  const url = process.argv[2];
  if (!url) {
    process.stderr.write("usage: test-brand-import.ts <url>\n");
    process.exit(2);
  }
  process.stdout.write(`[brand-import-test] ${url}\n`);
  const r = await runOne(url);
  const counts: Record<string, string> = {};
  for (const ev of r.events) {
    const e = ev as { event: string; dimension?: string; result?: { status?: string } };
    if (e.event === "dimension" && e.dimension) counts[e.dimension] = e.result?.status ?? "?";
  }
  process.stdout.write(
    `  ${r.durationMs}ms  ${JSON.stringify(counts)}${r.error ? `  ERROR: ${r.error}` : ""}\n`,
  );

  const dir = path.resolve(process.cwd(), "../../.local");
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "brand-import-test-results.json");
  let existing: PerUrlResult[] = [];
  if (existsSync(file)) {
    try { existing = JSON.parse(readFileSync(file, "utf8")) as PerUrlResult[]; } catch { /* reset */ }
  }
  const filtered = existing.filter((e) => e.url !== url);
  filtered.push(r);
  writeFileSync(file, JSON.stringify(filtered, null, 2));
  process.stdout.write(`[brand-import-test] merged into ${file} (${filtered.length} urls)\n`);
}

main().catch((e) => {
  process.stderr.write(`fatal: ${String(e)}\n`);
  process.exit(1);
});
