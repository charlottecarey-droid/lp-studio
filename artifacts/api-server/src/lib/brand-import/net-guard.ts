import dns from "dns/promises";
import net from "net";

/**
 * Shared SSRF guard for the brand-import routes. Extracted so the from-url,
 * from-url-stream, and image-refresh endpoints all validate a user-supplied
 * URL against the exact same private/reserved-range rules — a copy-pasted
 * per-route helper drifted in the past.
 */
export function isPrivateOrReservedIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split(".").map(Number);
    if (parts.length !== 4 || parts.some((p) => isNaN(p))) return true;
    const [a, b] = parts;
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a >= 224) return true;
    return false;
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === "::" || lower === "::1") return true;
    if (lower.startsWith("fe80:") || lower.startsWith("fe80::")) return true;
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
    if (lower.startsWith("ff")) return true;
    if (lower.startsWith("::ffff:")) {
      const v4 = lower.slice(7);
      if (net.isIPv4(v4)) return isPrivateOrReservedIp(v4);
    }
    return false;
  }
  return true;
}

/**
 * Resolve `hostname` and confirm every DNS answer is a public address. Rejects
 * localhost, DNS failures, and any host that resolves to a private/reserved IP
 * (defeats rebinding-style SSRF where a public name maps to an internal IP).
 */
export async function isSafePublicHost(hostname: string): Promise<boolean> {
  if (!hostname) return false;
  if (hostname === "localhost") return false;
  try {
    const records = await dns.lookup(hostname, { all: true });
    if (!records.length) return false;
    return records.every((r) => !isPrivateOrReservedIp(r.address));
  } catch {
    return false;
  }
}
