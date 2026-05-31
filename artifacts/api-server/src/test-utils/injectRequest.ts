/**
 * In-process HTTP request injection for express apps — no TCP socket.
 *
 * The vitest worker pool in this environment never fires `app.listen`'s
 * callback, so route tests that bind a real port + fetch hang forever. This
 * helper drives an express app's `(req, res)` handler directly with a
 * fabricated IncomingMessage / ServerResponse pair, feeding an optional JSON
 * body through the real body parser and capturing the response once the handler
 * calls `res.end()`.
 *
 * The full middleware chain still runs (cookie-parser, body parsing, auth
 * middleware, route handlers) — only the network layer is bypassed.
 */
import type { Express, Request, Response } from "express";
import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";

export interface InjectOptions {
  method: string;
  url: string;
  headers?: Record<string, string>;
  /** JSON-serialized when an object; sent verbatim when a string. */
  body?: unknown;
}

export interface InjectResponse {
  status: number;
  /** Parsed response body, or undefined when the body is not valid JSON. */
  json: unknown;
  text: string;
  /** Response headers set by the handler (lowercased names), e.g. `location`. */
  headers: Record<string, number | string | string[] | undefined>;
}

export function inject(app: Express, opts: InjectOptions): Promise<InjectResponse> {
  const socket = new Socket();
  const req = new IncomingMessage(socket);
  req.method = opts.method;
  req.url = opts.url;

  const bodyStr =
    opts.body === undefined ? undefined : typeof opts.body === "string" ? opts.body : JSON.stringify(opts.body);

  // Node lowercases incoming header names; mirror that so express's
  // case-insensitive `req.header()`/cookie-parser lookups resolve correctly.
  const headers: Record<string, string> = { host: "127.0.0.1" };
  for (const [k, v] of Object.entries(opts.headers ?? {})) headers[k.toLowerCase()] = v;
  if (bodyStr !== undefined) {
    if (!headers["content-type"]) headers["content-type"] = "application/json";
    headers["content-length"] = String(Buffer.byteLength(bodyStr));
  }
  req.headers = headers;

  const res = new ServerResponse(req);
  const chunks: Buffer[] = [];
  res.write = ((chunk: unknown, enc?: unknown, cb?: unknown) => {
    if (chunk) chunks.push(Buffer.from(chunk as Buffer));
    if (typeof enc === "function") enc();
    else if (typeof cb === "function") cb();
    return true;
  }) as typeof res.write;

  return new Promise<InjectResponse>((resolve) => {
    res.end = ((chunk?: unknown) => {
      if (chunk && typeof chunk !== "function") chunks.push(Buffer.from(chunk as Buffer));
      const text = Buffer.concat(chunks).toString("utf8");
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        json = undefined;
      }
      resolve({ status: res.statusCode, json, text, headers: res.getHeaders() });
      return res;
    }) as typeof res.end;

    app(req as unknown as Request, res as unknown as Response);
    if (bodyStr !== undefined) req.push(bodyStr);
    req.push(null);
  });
}
