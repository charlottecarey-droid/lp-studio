import pg from "pg";
import { pool } from "@workspace/db";
import { logger } from "./logger";
import type { InAppStreamPayload } from "./notificationStream";

const { Client } = pg;

/**
 * Cross-instance pub/sub for in-app notification pushes, built on Postgres
 * LISTEN/NOTIFY.
 *
 * Why this exists: `notificationStream` only fans a push out to SSE clients held
 * open by THIS Node process. In a multi-replica deploy a notification created on
 * instance B can't reach a tab connected to instance A, so that user only sees
 * it on the next polling cycle. This broker carries the cross-instance hop so
 * delivery is near-instant regardless of which replica a tab is pinned to.
 *
 * Transport:
 *   - PUBLISH uses `pg_notify` over the shared (pooled) pool. NOTIFY is a single
 *     statement that fires at commit, so it works fine through PgBouncer's
 *     transaction-pooling mode.
 *   - SUBSCRIBE needs a *session* that stays bound to one backend for the life
 *     of the LISTEN, which transaction-pooling does NOT support. So the listener
 *     opens a dedicated, NON-pooled connection (the Neon direct host, derived by
 *     dropping the `-pooler` suffix, or `NOTIFY_DATABASE_URL` if provided).
 *
 * Loop avoidance: every process stamps its messages with a unique INSTANCE_ID.
 * The listener ignores messages it published itself — the originating instance
 * already delivered them in-process (the fast local path in notificationStream),
 * so the broker only ever drives delivery on the OTHER instances.
 *
 * Failure posture: best-effort. If the listener connection is down, or a payload
 * is too large for NOTIFY's 8000-byte limit, cross-instance delivery degrades to
 * the client's polling backstop — never an error surfaced to a request.
 */

/** Postgres channel both sides agree on. Must be a valid identifier. */
const CHANNEL = "notification_events";

/** Unique per process — used to skip our own NOTIFY echoes on the listener. */
export const INSTANCE_ID = `${process.pid}-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;

/**
 * NOTIFY payloads are capped at 8000 bytes by Postgres. Stay comfortably under
 * so a long notification body never throws; oversize messages skip the broker
 * hop and lean on the client poll backstop instead.
 */
const MAX_NOTIFY_BYTES = 7000;

const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;

export interface BrokerMessage {
  originId: string;
  tenantId: number;
  appUserId: number;
  payload: InAppStreamPayload;
}

type RemoteHandler = (msg: BrokerMessage) => void;

let started = false;
let listener: pg.Client | null = null;
let reconnectAttempt = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let remoteHandler: RemoteHandler | null = null;

/**
 * Resolve a NON-pooled connection string for the LISTEN session. Prefers an
 * explicit `NOTIFY_DATABASE_URL`; otherwise derives the Neon direct host by
 * stripping the `-pooler` suffix from the configured connection string.
 */
function resolveDirectConnectionString(): string | null {
  const explicit = process.env["NOTIFY_DATABASE_URL"];
  if (explicit) return explicit;
  const base = process.env["NEON_DATABASE_URL"] ?? process.env["DATABASE_URL"];
  if (!base) return null;
  // `-pooler` only ever appears in the Neon pooled hostname; dropping it yields
  // the direct (session-capable) endpoint.
  return base.replace("-pooler", "");
}

function scheduleReconnect(): void {
  if (!started || reconnectTimer) return;
  const delay = Math.min(RECONNECT_BASE_MS * 2 ** reconnectAttempt, RECONNECT_MAX_MS);
  const jitter = Math.floor(Math.random() * 250);
  reconnectAttempt += 1;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    void connectListener();
  }, delay + jitter);
  // Don't keep the event loop alive solely for a reconnect attempt.
  reconnectTimer.unref?.();
}

async function connectListener(): Promise<void> {
  if (!started) return;
  const connectionString = resolveDirectConnectionString();
  if (!connectionString) {
    logger.warn("[notificationBroker] no database URL — cross-instance push disabled");
    return;
  }

  const client = new Client({ connectionString, connectionTimeoutMillis: 5_000 });

  client.on("error", (err) => {
    logger.warn({ err }, "[notificationBroker] listener connection error; reconnecting");
    // Tear down and reconnect; a half-dead client never recovers on its own.
    try {
      void client.end().catch(() => {});
    } catch {
      /* already gone */
    }
    if (listener === client) listener = null;
    scheduleReconnect();
  });

  client.on("end", () => {
    if (listener === client) {
      listener = null;
      scheduleReconnect();
    }
  });

  client.on("notification", (msg) => {
    if (!msg.payload) return;
    let parsed: BrokerMessage;
    try {
      parsed = JSON.parse(msg.payload) as BrokerMessage;
    } catch (err) {
      logger.warn({ err }, "[notificationBroker] dropping unparseable notification payload");
      return;
    }
    // Skip our own echo — the originating instance already delivered locally.
    if (parsed.originId === INSTANCE_ID) return;
    if (parsed.tenantId == null || parsed.appUserId == null || !parsed.payload) return;
    try {
      remoteHandler?.(parsed);
    } catch (err) {
      logger.warn({ err }, "[notificationBroker] remote delivery handler threw");
    }
  });

  try {
    await client.connect();
    await client.query(`LISTEN ${CHANNEL}`);
    listener = client;
    reconnectAttempt = 0;
    logger.info("[notificationBroker] listening for cross-instance notification pushes");
  } catch (err) {
    logger.warn({ err }, "[notificationBroker] failed to start listener; will retry");
    try {
      void client.end().catch(() => {});
    } catch {
      /* ignore */
    }
    scheduleReconnect();
  }
}

/**
 * Start the cross-instance listener (idempotent). Wires remote messages to the
 * supplied handler, which should perform the local SSE fan-out. Safe to call
 * from the server boot path: it never throws and never blocks (the connect runs
 * detached).
 */
export function startNotificationBroker(onRemoteMessage: RemoteHandler): void {
  if (started) return;
  started = true;
  remoteHandler = onRemoteMessage;
  void connectListener();
}

/**
 * Publish a notification to every OTHER instance via NOTIFY. No-op until the
 * broker has been started, so unit tests and single-process dev that never call
 * `startNotificationBroker` don't issue stray DB writes. Best-effort: a publish
 * failure just means remote tabs fall back to polling.
 */
export function publishNotificationEvent(msg: BrokerMessage): void {
  if (!started) return;
  let serialized: string;
  try {
    serialized = JSON.stringify(msg);
  } catch (err) {
    logger.warn({ err }, "[notificationBroker] failed to serialize message; skipping broker hop");
    return;
  }
  if (Buffer.byteLength(serialized, "utf8") > MAX_NOTIFY_BYTES) {
    // Too big for NOTIFY — local clients already got it in-process; remote tabs
    // will pick it up on their next poll. Don't risk a payload-too-large throw.
    logger.debug("[notificationBroker] payload exceeds NOTIFY limit; skipping broker hop");
    return;
  }
  // pg_notify takes channel + payload as bind params, so no SQL-injection risk
  // from the JSON body. Fire-and-forget over the pooled pool.
  pool
    .query("SELECT pg_notify($1, $2)", [CHANNEL, serialized])
    .catch((err) => logger.warn({ err }, "[notificationBroker] NOTIFY publish failed"));
}

/** Test/observability helper — whether the broker has been started. */
export function isBrokerStarted(): boolean {
  return started;
}

/**
 * Stop the listener and reset state. Primarily for tests / graceful shutdown.
 */
export async function stopNotificationBroker(): Promise<void> {
  started = false;
  remoteHandler = null;
  reconnectAttempt = 0;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  const client = listener;
  listener = null;
  if (client) {
    try {
      await client.end();
    } catch {
      /* already closed */
    }
  }
}
