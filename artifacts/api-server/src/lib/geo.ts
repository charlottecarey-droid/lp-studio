import type { Request } from "express";

export interface GeoResult {
  city: string | null;
  region: string | null;
  country: string | null;
  countryCode: string | null;
}

const EMPTY: GeoResult = { city: null, region: null, country: null, countryCode: null };
const GEO_TIMEOUT_MS = 2_500;

const PRIVATE_IP = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|fc|fd)/;

export function getClientIp(req: Request): string {
  const fwd = req.headers["x-forwarded-for"];
  const raw = fwd
    ? (typeof fwd === "string" ? fwd : fwd[0]).split(",")[0].trim()
    : req.socket?.remoteAddress ?? req.ip ?? "";
  return raw.replace(/^::ffff:/, "");
}

export async function lookupGeoAsync(ip: string): Promise<GeoResult> {
  if (!ip || PRIVATE_IP.test(ip)) return EMPTY;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), GEO_TIMEOUT_MS);
    const res = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,city,regionName,country,countryCode`,
      { signal: controller.signal },
    );
    clearTimeout(timer);
    if (!res.ok) return EMPTY;

    const data = await res.json() as {
      status?: string;
      city?: string;
      regionName?: string;
      country?: string;
      countryCode?: string;
    };

    if (data.status !== "success") return EMPTY;
    return {
      city: data.city ?? null,
      region: data.regionName ?? null,
      country: data.country ?? null,
      countryCode: data.countryCode ?? null,
    };
  } catch {
    return EMPTY;
  }
}
