/**
 * Hermetic regression guard for the Content Series subscriber-notification
 * safeguards (Task #806 → #812).
 *
 * The "email subscribers about new episodes" feature carries three safety rules
 * that, until now, were only verified by hand:
 *
 *   1. Claim-then-send dedupe — a recipient gets AT MOST ONE email per episode,
 *      even if `sendEpisodeNotifications` runs again (a re-publish, a manual
 *      re-send, a retry). The per-(page, episode, recipient) row in
 *      `content_series_episode_sends` is claimed BEFORE the send, so a second
 *      pass finds the claim and skips.
 *   2. Opt-out / unsubscribe filtering — a lead who unsubscribed (a row in
 *      `content_series_unsubscribes`) is excluded from all future episode mail,
 *      and test/junk leads are never subscribers in the first place.
 *   3. First-publish baseline — the very first publish of a page records its
 *      current episodes as "seen" WITHOUT sending, so enabling auto-send never
 *      blasts the pre-existing backlog. Only episodes added AFTER the baseline
 *      auto-send.
 *
 * This exercises the REAL `contentSeriesNotify` engine against a HERMETIC,
 * throwaway Postgres (see `.agents/memory/hermetic-ephemeral-pg-tests.md`):
 * dev's `NEON_DATABASE_URL` points at PRODUCTION Neon, so any DB-touching test
 * must stand up its own ephemeral cluster and repoint the env BEFORE the first
 * `@workspace/db` import. The schema is built straight from the drizzle schema
 * via `drizzle-kit push` (the full migration set can't replay on a blank DB).
 *
 * The ONLY things stubbed are the outbound Resend HTTP call (`globalThis.fetch`)
 * and `RESEND_API_KEY` / `NOTIFICATION_PREFS_SECRET`, so no real email leaves
 * the box and we can count exactly how many sends were attempted.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import { dbAvailable } from "../test-utils/dbAvailable";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { startEphemeralPg, type EphemeralPg } from "../test-utils/ephemeralPg";

// Imported dynamically in beforeAll AFTER the ephemeral DB env is set, because
// both modules transitively load `@workspace/db`, whose pool reads the
// connection string at import time. Typed via `typeof import(...)` so the rest
// of the file stays type-checked.
type Pg = typeof import("@workspace/db");
type Notify = typeof import("./contentSeriesNotify");
let pgMod: Pg;
let notify: Notify;

let epg: EphemeralPg;

/** Walk up from cwd to find the repo's `lib/db` package dir. */
function resolveLibDbDir(): string {
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    const candidate = path.join(dir, "lib", "db");
    if (existsSync(path.join(candidate, "drizzle.config.ts"))) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error("Could not locate lib/db from " + process.cwd());
}

beforeAll(async () => {
  // 1. Stand up the throwaway cluster and repoint the db env at it BEFORE any
  //    `@workspace/db` import resolves.
  epg = startEphemeralPg();
  process.env.NEON_DATABASE_URL = epg.connectionString;
  process.env.DATABASE_URL = epg.connectionString;
  // The engine reads these at call time; a fake key keeps the send path alive
  // (it bails early when RESEND_API_KEY is unset) while the stubbed fetch makes
  // sure nothing actually leaves the box.
  process.env.RESEND_API_KEY = "re_test_fake";
  process.env.NOTIFICATION_PREFS_SECRET = "test-unsub-secret";

  // 2. Build the real schema straight from the drizzle schema definitions.
  const libDb = resolveLibDbDir();
  const push = spawnSync(
    "npx",
    ["drizzle-kit", "push", "--force", "--config", "./drizzle.config.ts"],
    { cwd: libDb, encoding: "utf8", env: process.env },
  );
  if (push.status !== 0) {
    throw new Error(
      `drizzle-kit push failed (status ${push.status}):\n${push.stdout}\n${push.stderr}`,
    );
  }

  // 3. Now it is safe to load the db layer + the engine under test.
  pgMod = await import("@workspace/db");
  notify = await import("./contentSeriesNotify");
}, 120_000);

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await pgMod?.pool.end().catch(() => {});
  epg?.stop();
});

/** Stub Resend's HTTP endpoint with a 200, returning the spy so callers can
 *  assert exactly how many sends were attempted. */
function stubResendOk(): ReturnType<typeof vi.spyOn> {
  return vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(new Response("{}", { status: 200 }));
}

/** A content-series block tree for an `lp_pages.blocks` jsonb column. */
function contentSeriesBlocks(opts: {
  seriesTitle: string;
  autoSend: boolean;
  episodes: { slug: string; title: string }[];
}): unknown[] {
  return [
    {
      type: "content-series",
      props: {
        seriesTitle: opts.seriesTitle,
        subscribeNotifyAutoSend: opts.autoSend,
        episodes: opts.episodes.map((e) => ({
          slug: e.slug,
          title: e.title,
          description: "",
        })),
      },
    },
  ];
}

let seq = 0;

/** Seed a tenant + a page and return their ids. */
async function seedTenantAndPage(blocks: unknown = []): Promise<{
  tenantId: number;
  pageId: number;
}> {
  const { pool } = pgMod;
  const uniq = `${Date.now()}-${seq++}-${randomUUID().slice(0, 8)}`;
  const t = await pool.query<{ id: number }>(
    `INSERT INTO tenants (name, slug, status, settings)
     VALUES ($1, $2, 'active', '{"industry":"generic"}'::jsonb) RETURNING id`,
    [`CS Notify ${uniq}`, `cs-notify-${uniq}`],
  );
  const tenantId = t.rows[0].id;
  const p = await pool.query<{ id: number }>(
    `INSERT INTO lp_pages (tenant_id, title, slug, blocks, status)
     VALUES ($1, $2, $3, $4::jsonb, 'published') RETURNING id`,
    [tenantId, `Series Page ${uniq}`, `series-${uniq}`, JSON.stringify(blocks)],
  );
  return { tenantId, pageId: p.rows[0].id };
}

/** Seed a subscriber lead captured via the block's built-in Subscribe form. */
async function seedSubscriber(
  tenantId: number,
  pageId: number,
  email: string,
  name = "Real Person",
): Promise<number> {
  const { pool } = pgMod;
  const fields = JSON.stringify({ _source: "content-series-subscribe", email, name });
  const r = await pool.query<{ id: number }>(
    `INSERT INTO lp_leads (tenant_id, page_id, fields) VALUES ($1, $2, $3::jsonb) RETURNING id`,
    [tenantId, pageId, fields],
  );
  return r.rows[0].id;
}

async function countSends(pageId: number, episodeKey: string): Promise<number> {
  const { pool } = pgMod;
  const r = await pool.query<{ c: string }>(
    `SELECT count(*)::text AS c FROM content_series_episode_sends
       WHERE page_id = $1 AND episode_key = $2`,
    [pageId, episodeKey],
  );
  return Number(r.rows[0].c);
}

async function countSeen(pageId: number): Promise<number> {
  const { pool } = pgMod;
  const r = await pool.query<{ c: string }>(
    `SELECT count(*)::text AS c FROM content_series_seen_episodes WHERE page_id = $1`,
    [pageId],
  );
  return Number(r.rows[0].c);
}

const EPISODE = (key: string, title: string): import("./contentSeriesNotify").SubscribeEpisode => ({
  key,
  title,
  description: "",
  ctaUrl: "https://example.org/watch",
  ctaText: "Watch",
});

// Hits the real Postgres pool — skipped when unreachable (see test-utils/dbAvailable.ts).
describe.skipIf(!dbAvailable)("content-series notify — at-most-once dedupe (Task #812)", () => {
  it("never sends the same episode to a subscriber twice across repeated notify calls", async () => {
    const { tenantId, pageId } = await seedTenantAndPage();
    await seedSubscriber(tenantId, pageId, "alice@gmail.com");
    await seedSubscriber(tenantId, pageId, "bob@gmail.com");

    const ep = EPISODE("ep-1", "Episode One");

    const fetchSpy = stubResendOk();
    const first = await notify.sendEpisodeNotifications({
      tenantId,
      pageId,
      seriesTitle: "My Series",
      episode: ep,
      requestHost: "tenant.lpstudio.ai",
    });

    expect(first.sent).toBe(2);
    expect(first.alreadyNotified).toBe(0);
    expect(first.failed).toBe(0);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(await countSends(pageId, "ep-1")).toBe(2);

    // Second pass: the dedupe claims already exist → no new mail.
    const second = await notify.sendEpisodeNotifications({
      tenantId,
      pageId,
      seriesTitle: "My Series",
      episode: ep,
      requestHost: "tenant.lpstudio.ai",
    });

    expect(second.sent).toBe(0);
    expect(second.alreadyNotified).toBe(2);
    // No additional Resend calls were made on the second pass.
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(await countSends(pageId, "ep-1")).toBe(2);
  });

  it("releases the dedupe claim on a failed send so a later retry re-attempts", async () => {
    const { tenantId, pageId } = await seedTenantAndPage();
    await seedSubscriber(tenantId, pageId, "carol@gmail.com");

    const ep = EPISODE("ep-fail", "Flaky Episode");

    // First attempt fails at the provider → claim must be released.
    const failSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("nope", { status: 500 }));
    const failed = await notify.sendEpisodeNotifications({
      tenantId,
      pageId,
      seriesTitle: "My Series",
      episode: ep,
      requestHost: "tenant.lpstudio.ai",
    });
    expect(failed.sent).toBe(0);
    expect(failed.failed).toBe(1);
    expect(failSpy).toHaveBeenCalledTimes(1);
    // The released claim leaves no lingering ledger row.
    expect(await countSends(pageId, "ep-fail")).toBe(0);

    // Retry now succeeds — the recipient is still eligible (claim was released).
    vi.restoreAllMocks();
    const okSpy = stubResendOk();
    const retried = await notify.sendEpisodeNotifications({
      tenantId,
      pageId,
      seriesTitle: "My Series",
      episode: ep,
      requestHost: "tenant.lpstudio.ai",
    });
    expect(retried.sent).toBe(1);
    expect(okSpy).toHaveBeenCalledTimes(1);
    expect(await countSends(pageId, "ep-fail")).toBe(1);
  });
});

// Hits the real Postgres pool — skipped when unreachable (see test-utils/dbAvailable.ts).
describe.skipIf(!dbAvailable)("content-series notify — opt-out / unsubscribe filtering (Task #812)", () => {
  it("skips unsubscribed leads and never counts test leads as subscribers", async () => {
    const { tenantId, pageId } = await seedTenantAndPage();
    await seedSubscriber(tenantId, pageId, "dave@gmail.com");
    await seedSubscriber(tenantId, pageId, "erin@gmail.com");
    // A throwaway/test lead must never be treated as a subscriber.
    await seedSubscriber(tenantId, pageId, "qa@example.com", "Test User");

    // Erin unsubscribes via the signed-token flow.
    const token = notify.makeLeadUnsubToken(tenantId, pageId, "erin@gmail.com");
    const payload = notify.verifyLeadUnsubToken(token);
    expect(payload).toEqual({ tenantId, pageId, email: "erin@gmail.com" });
    await notify.recordLeadUnsubscribe(payload!.tenantId, payload!.pageId, payload!.email);

    const ep = EPISODE("ep-optout", "Opt-out Episode");

    const fetchSpy = stubResendOk();
    const res = await notify.sendEpisodeNotifications({
      tenantId,
      pageId,
      seriesTitle: "My Series",
      episode: ep,
      requestHost: "tenant.lpstudio.ai",
    });

    // Dave + Erin are subscribers (the test lead is filtered upstream, proving
    // totalSubscribers is 2 not 3); only Dave is EMAILED (Erin opted out).
    expect(res.totalSubscribers).toBe(2);
    expect(res.sent).toBe(1);
    expect(res.optedOut).toBe(1);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Exactly one send row, and it is NOT for the unsubscribed address.
    expect(await countSends(pageId, "ep-optout")).toBe(1);
    const { pool } = pgMod;
    const erin = await pool.query(
      `SELECT 1 FROM content_series_episode_sends
         WHERE page_id = $1 AND episode_key = $2 AND recipient_email = $3`,
      [pageId, "ep-optout", "erin@gmail.com"],
    );
    expect(erin.rows).toHaveLength(0);

    // getEpisodeNotifyStatus reports the same picture.
    const status = await notify.getEpisodeNotifyStatus(tenantId, pageId, "ep-optout");
    expect(status).toEqual({
      totalSubscribers: 2,
      optedOut: 1,
      alreadyNotified: 1,
      pending: 0,
    });
  });

  it("rejects a tampered or malformed unsubscribe token", () => {
    const token = notify.makeLeadUnsubToken(7, 9, "x@gmail.com");
    expect(notify.verifyLeadUnsubToken(token + "tamper")).toBeNull();
    expect(notify.verifyLeadUnsubToken("not-a-token")).toBeNull();
  });
});

// Hits the real Postgres pool — skipped when unreachable (see test-utils/dbAvailable.ts).
describe.skipIf(!dbAvailable)("content-series notify — first-publish baseline (Task #812)", () => {
  it("records the initial backlog as seen WITHOUT sending, then auto-sends only new episodes", async () => {
    const initialBlocks = contentSeriesBlocks({
      seriesTitle: "Auto Series",
      autoSend: true,
      episodes: [
        { slug: "backlog-1", title: "Backlog One" },
        { slug: "backlog-2", title: "Backlog Two" },
      ],
    });
    const { tenantId, pageId } = await seedTenantAndPage(initialBlocks);
    await seedSubscriber(tenantId, pageId, "frank@gmail.com");

    // First publish: establishes the baseline, sends nothing.
    const baselineSpy = stubResendOk();
    await notify.handlePagePublishNotifications({
      tenantId,
      pageId,
      requestHost: "tenant.lpstudio.ai",
    });
    expect(baselineSpy).not.toHaveBeenCalled();
    expect(await countSeen(pageId)).toBe(2);
    expect(await countSends(pageId, "backlog-1")).toBe(0);
    expect(await countSends(pageId, "backlog-2")).toBe(0);

    vi.restoreAllMocks();

    // A genuinely new episode is added and the page re-published.
    const updatedBlocks = contentSeriesBlocks({
      seriesTitle: "Auto Series",
      autoSend: true,
      episodes: [
        { slug: "backlog-1", title: "Backlog One" },
        { slug: "backlog-2", title: "Backlog Two" },
        { slug: "fresh-3", title: "Fresh Three" },
      ],
    });
    await pgMod.pool.query(`UPDATE lp_pages SET blocks = $2::jsonb WHERE id = $1`, [
      pageId,
      JSON.stringify(updatedBlocks),
    ]);

    const sendSpy = stubResendOk();
    await notify.handlePagePublishNotifications({
      tenantId,
      pageId,
      requestHost: "tenant.lpstudio.ai",
    });

    // Only the new episode is emailed; the backlog stays silent.
    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(await countSeen(pageId)).toBe(3);
    expect(await countSends(pageId, "fresh-3")).toBe(1);
    expect(await countSends(pageId, "backlog-1")).toBe(0);
    expect(await countSends(pageId, "backlog-2")).toBe(0);
  });

  it("does not auto-send when the block's auto-send toggle is off", async () => {
    const { tenantId, pageId } = await seedTenantAndPage(
      contentSeriesBlocks({
        seriesTitle: "Manual Series",
        autoSend: false,
        episodes: [{ slug: "m-1", title: "Manual One" }],
      }),
    );
    await seedSubscriber(tenantId, pageId, "grace@gmail.com");

    // Baseline publish (no send regardless of toggle).
    stubResendOk();
    await notify.handlePagePublishNotifications({
      tenantId,
      pageId,
      requestHost: "tenant.lpstudio.ai",
    });
    vi.restoreAllMocks();

    // Add a new episode but leave auto-send OFF → still no mail.
    await pgMod.pool.query(`UPDATE lp_pages SET blocks = $2::jsonb WHERE id = $1`, [
      pageId,
      JSON.stringify(
        contentSeriesBlocks({
          seriesTitle: "Manual Series",
          autoSend: false,
          episodes: [
            { slug: "m-1", title: "Manual One" },
            { slug: "m-2", title: "Manual Two" },
          ],
        }),
      ),
    ]);

    const sendSpy = stubResendOk();
    await notify.handlePagePublishNotifications({
      tenantId,
      pageId,
      requestHost: "tenant.lpstudio.ai",
    });
    expect(sendSpy).not.toHaveBeenCalled();
    expect(await countSends(pageId, "m-2")).toBe(0);
    // The episode is still recorded as seen for future diffs.
    expect(await countSeen(pageId)).toBe(2);
  });
});
