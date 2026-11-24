/**
 * In-process dispatch for the Claude connector's tools.
 *
 * Each tool calls an existing LP Studio API route as the rep who approved
 * the connection, through the real express app. That way tenant scoping,
 * permission checks, plan gates, rate limits and validation are exactly the
 * app's — a tool can never see or do more than the rep could in the browser.
 *
 * Identity rides on `setInternalAuthUser` (a WeakMap keyed by the fabricated
 * request), which `requireAuth` honours. No session cookie is sent, so CSRF
 * is skipped the same way it is for every cookie-less caller; the host is
 * loopback, which maps to no tenant, so the host check never applies.
 */
import type { Express, Request, Response } from "express";
import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import crypto from "node:crypto";
import type { AuthUser } from "../../middleware/requireAuth";
import { setInternalAuthUser } from "../../middleware/internalAuth";

let dispatchApp: Express | null = null;

/** Called once from app.ts after the app is built (avoids an import cycle). */
export function setDispatchApp(app: Express): void {
  dispatchApp = app;
}

export interface DispatchResult {
  status: number;
  json: unknown;
}

export interface DispatchOptions {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** Path under /api, with query string, e.g. `/sales/accounts/search?q=x`. */
  path: string;
  body?: unknown;
  timeoutMs?: number;
}

/**
 * A stable private (ULA, fd00::/8) IPv6 address per user. express-rate-limit
 * keys IPv6 by /56, so the hash fills the first 56 bits.
 */
export function rateLimitAddressFor(userId: number): string {
  const h = crypto.createHash("sha256").update(`lpstudio-mcp-user:${userId}`).digest("hex");
  return `fd${h.slice(0, 2)}:${h.slice(2, 6)}:${h.slice(6, 10)}:${h.slice(10, 14)}::1`;
}

export function dispatch(user: AuthUser, opts: DispatchOptions): Promise<DispatchResult> {
  const app = dispatchApp;
  if (!app) return Promise.reject(new Error("dispatch app not initialised"));
  if (!opts.path.startsWith("/")) return Promise.reject(new Error("dispatch path must start with /"));

  const socket = new Socket();
  const req = new IncomingMessage(socket);
  req.method = opts.method;
  req.url = `/api${opts.path}`;
  const bodyBuf = opts.body === undefined ? undefined : Buffer.from(JSON.stringify(opts.body));
  const headers: Record<string, string> = {
    host: "127.0.0.1",
    accept: "application/json",
    "user-agent": "lpstudio-claude-connector",
  };
  // IP-keyed rate limits (e.g. microsite generation) must count per rep, as
  // they do in the browser — not per Claude server, which every rep shares.
  headers["x-forwarded-for"] = rateLimitAddressFor(user.userId);
  if (bodyBuf) {
    headers["content-type"] = "application/json";
    headers["content-length"] = String(bodyBuf.length);
  }
  req.headers = headers;
  setInternalAuthUser(req, user);

  const res = new ServerResponse(req);
  const chunks: Buffer[] = [];
  res.write = ((chunk: unknown, enc?: unknown, cb?: unknown) => {
    if (chunk && typeof chunk !== "function") chunks.push(Buffer.from(chunk as Buffer));
    if (typeof enc === "function") enc();
    else if (typeof cb === "function") cb();
    return true;
  }) as typeof res.write;

  return new Promise<DispatchResult>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error("LP Studio took too long to answer"));
    }, opts.timeoutMs ?? 90_000);

    res.end = ((chunk?: unknown) => {
      if (chunk && typeof chunk !== "function") chunks.push(Buffer.from(chunk as Buffer));
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        const text = Buffer.concat(chunks).toString("utf8");
        let json: unknown;
        try {
          json = JSON.parse(text);
        } catch {
          json = text ? { text: text.slice(0, 2000) } : undefined;
        }
        resolve({ status: res.statusCode, json });
      }
      // Let per-request listeners (logging, cleanup) run as they would on a real response.
      res.emit("finish");
      return res;
    }) as typeof res.end;

    req.on("end", () => {
      req.complete = true;
    });

    try {
      app(req as unknown as Request, res as unknown as Response);
    } catch (err) {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(err);
      }
      return;
    }
    if (bodyBuf) req.push(bodyBuf);
    req.push(null);
  });
}

/** Readable error message from a non-2xx dispatch result. */
export function dispatchError(r: DispatchResult): string {
  const body = (r.json ?? {}) as Record<string, unknown>;
  const msg = typeof body.error === "string" ? body.error : typeof body.message === "string" ? body.message : "";
  if (r.status === 401) return "The LP Studio connection is no longer signed in. Reconnect LP Studio in Claude's connector settings.";
  if (r.status === 402) return `This workspace's plan doesn't include that feature.${msg ? ` (${msg})` : ""}`;
  if (r.status === 403) return msg || "You don't have permission to do that in this LP Studio workspace.";
  if (r.status === 404) return msg || "Not found in this LP Studio workspace.";
  if (r.status === 429) return msg || "LP Studio is rate-limiting this right now. Try again in a minute.";
  return msg || `LP Studio returned an error (${r.status}).`;
}
