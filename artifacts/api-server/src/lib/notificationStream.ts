import type { Response } from "express";
import { logger } from "./logger";
import {
  INSTANCE_ID,
  publishNotificationEvent,
  startNotificationBroker,
} from "./notificationBroker";

/**
 * Server-Sent-Events hub for in-app notifications.
 *
 * When an in-app notification row is created (see notificationDispatcher), we
 * push it to any SSE clients currently held open for that (tenant, user) pair.
 * This surfaces time-sensitive nudges instantly instead of waiting out the
 * bell's polling interval.
 *
 * Two delivery paths, one fan-out:
 *   - LOCAL (fast path): the originating process delivers to its own SSE
 *     clients in-memory, with zero round-trip.
 *   - CROSS-INSTANCE: the same event is published to a Postgres LISTEN/NOTIFY
 *     broker (see notificationBroker). Every OTHER replica receives it and runs
 *     the same local fan-out, so a tab pinned to instance A gets a push for a
 *     notification created on instance B in near-real-time. The originating
 *     instance ignores its own broker echo (matched by INSTANCE_ID) since it
 *     already delivered locally.
 *
 * The client's polling backstop (see use-notifications.ts) remains as the floor
 * for the rare window when the broker connection is down. SSE is the fast path,
 * polling is the safety net.
 */

export interface InAppStreamPayload {
  id: number;
  templateKey: string;
  title: string | null;
  body: string | null;
  ctaUrl: string | null;
  ctaLabel: string | null;
  read: boolean;
  createdAt: string;
}

interface StreamClient {
  tenantId: number;
  appUserId: number;
  res: Response;
}

const clients = new Set<StreamClient>();

function streamKey(tenantId: number, appUserId: number): string {
  return `${tenantId}:${appUserId}`;
}

/**
 * Register an open SSE response for a (tenant, user) pair. Returns a cleanup
 * function the route must call when the connection closes.
 */
export function addStreamClient(tenantId: number, appUserId: number, res: Response): () => void {
  const client: StreamClient = { tenantId, appUserId, res };
  clients.add(client);
  logger.debug({ key: streamKey(tenantId, appUserId), total: clients.size }, "[notificationStream] client connected");
  return () => {
    clients.delete(client);
    logger.debug({ key: streamKey(tenantId, appUserId), total: clients.size }, "[notificationStream] client disconnected");
  };
}

/**
 * Deliver a notification to every SSE client connected for the given
 * (tenant, user) pair ON THIS PROCESS. Best-effort: a write failure just drops
 * that client (its `close` handler will clean it up). This is the shared local
 * fan-out used by both the originating push and cross-instance broker delivery.
 */
function deliverLocal(tenantId: number, appUserId: number, payload: InAppStreamPayload): void {
  if (!clients.size) return;
  const data = `event: notification\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const client of clients) {
    if (client.tenantId !== tenantId || client.appUserId !== appUserId) continue;
    try {
      client.res.write(data);
    } catch (err) {
      logger.warn({ err }, "[notificationStream] write failed; dropping client");
      clients.delete(client);
    }
  }
}

/**
 * Push a freshly created in-app notification to the given (tenant, user). Runs
 * the local fan-out immediately (fast path) and publishes the same event to the
 * cross-instance broker so tabs pinned to other replicas also get it in
 * near-real-time. Best-effort throughout.
 */
export function publishInAppNotification(
  tenantId: number,
  appUserId: number,
  payload: InAppStreamPayload,
): void {
  deliverLocal(tenantId, appUserId, payload);
  // Fan out to other instances. The broker drops our own echo (INSTANCE_ID), so
  // local clients are never double-delivered.
  publishNotificationEvent({ originId: INSTANCE_ID, tenantId, appUserId, payload });
}

/**
 * Start the cross-instance notification broker, wiring remote pushes to the
 * local SSE fan-out. Call once on server boot; idempotent and non-blocking.
 */
export function initNotificationStreamBroker(): void {
  startNotificationBroker((msg) => deliverLocal(msg.tenantId, msg.appUserId, msg.payload));
}

/** Test/observability helper — number of currently connected clients. */
export function streamClientCount(): number {
  return clients.size;
}
