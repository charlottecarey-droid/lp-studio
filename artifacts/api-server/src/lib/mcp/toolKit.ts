/**
 * Shared plumbing for the Claude connector's tools (tools.ts, pageTools.ts):
 * the tool shape, calling an LP Studio route as the rep, and small helpers.
 */
import type { z } from "zod";
import type { AuthUser } from "../../middleware/requireAuth";
import { dispatch, dispatchError, type DispatchResult } from "./dispatch";
import type { SCOPE_DRAFTS, SCOPE_PAGES, SCOPE_READ } from "./oauthStore";

export interface ToolContext {
  user: AuthUser;
  scope: string;
  /** Public origin the rep reached LP Studio on, for links back into the app. */
  origin: string;
}

export type ToolContent = { type: "text"; text: string } | { type: "image"; data: string; mimeType: string };

export interface ToolResult {
  [key: string]: unknown;
  content: ToolContent[];
  isError?: boolean;
}

/** A tool may return this to send images (e.g. screenshots) alongside JSON. */
export class RichResult {
  constructor(readonly data: unknown, readonly images: { data: string; mimeType: string }[] = []) {}
}

export interface ToolDef {
  name: string;
  title: string;
  description: string;
  scope: typeof SCOPE_READ | typeof SCOPE_DRAFTS | typeof SCOPE_PAGES;
  readOnly: boolean;
  /** Changes or removes something people can see (live page, restore). Hints the client to confirm. */
  destructive?: boolean;
  input: z.ZodRawShape;
  run: (ctx: ToolContext, args: Record<string, unknown>) => Promise<unknown>;
}

export class ToolError extends Error {
  constructor(message: string, readonly status?: number, readonly body?: unknown) {
    super(message);
  }
}

/**
 * Call an LP Studio route as the rep. A 503 (the DB pool briefly saturated,
 * see lib/dbResilience.ts) is retried twice with a short backoff, so a busy
 * moment doesn't surface as a failed save.
 */
export async function call(ctx: ToolContext, method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE", path: string, body?: unknown, timeoutMs?: number): Promise<unknown> {
  let r: DispatchResult = await dispatch(ctx.user, { method, path, body, timeoutMs });
  for (let attempt = 1; r.status === 503 && attempt <= 2; attempt++) {
    await new Promise((res) => setTimeout(res, 400 * attempt));
    r = await dispatch(ctx.user, { method, path, body, timeoutMs });
  }
  if (r.status < 200 || r.status >= 300) throw new ToolError(dispatchError(r), r.status, r.json);
  return r.json;
}

export const qs = (params: Record<string, string | number | undefined | null>): string => {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  const s = sp.toString();
  return s ? `?${s}` : "";
};

export const pick = (o: Record<string, unknown>, keys: string[]): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const k of keys) if (o[k] !== undefined && o[k] !== null && o[k] !== "") out[k] = o[k];
  return out;
};

export const links = (ctx: ToolContext) => ({
  account: (id: unknown) => `${ctx.origin}/sales/accounts/${id}`,
  page: (id: unknown) => `${ctx.origin}/builder/${id}`,
  hub: (id: unknown) => `${ctx.origin}/sales/partnerships/${id}`,
});
