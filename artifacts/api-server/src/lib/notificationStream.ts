import type { Response } from "express";
import { logger } from "./logger";

/**
 * In-process Server-Sent-Events hub for in-app notifications.
 *
 * When an in-app notification row is created (see notificationDispatcher), we
 * push it to any SSE clients the same Node process is currently holding open
 * for that (tenant, user) pair. This surfaces time-sensitive nudges instantly
 * instead of waiting out the bell's polling interval.
 *
 * IMPORTANT — single-process reach: the registry lives in memory, so a push
 * only reaches clients connected to the SAME instance that ran the dispatch.
 * In a multi-replica deploy a client on instance A won't receive a push for a
 * notification dispatched on instance B. That's intentionally acceptable: the
 * client keeps a slow polling backstop (see use-notifications.ts) which closes
 * the gap within one poll cycle. SSE is the fast path, polling is the floor.
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
 * Push a freshly created in-app notification to every client connected for the
 * given (tenant, user) pair on this process. Best-effort: a write failure just
 * drops that client (its `close` handler will clean it up).
 */
export function publishInAppNotification(
  tenantId: number,
  appUserId: number,
  payload: InAppStreamPayload,
): void {
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

/** Test/observability helper — number of currently connected clients. */
export function streamClientCount(): number {
  return clients.size;
}
