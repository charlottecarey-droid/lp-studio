#!/usr/bin/env bash
# Check the validation status of one or more Cloudflare Custom Hostnames
# on the lpstudio.ai zone. Use this after asking a customer to add the
# TXT records produced by provision-custom-hostname.sh — once both
# `status` and `ssl.status` show `active`, the hostname is ready for the
# CNAME flip to Cloudflare.
#
# Usage:
#   ./scripts/check-custom-hostname.sh                            # all hostnames
#   ./scripts/check-custom-hostname.sh partners.meetdandy.com ... # specific ones
#
# Requirements:
#   - CLOUDFLARE_API_TOKEN env var with Zone:Read + SSL and Certificates:Read.
#
# Exit code is 0 iff every requested hostname is fully active. Use in
# CI/scripts to gate a downstream DNS flip on cert readiness.

set -euo pipefail

if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  echo "Error: CLOUDFLARE_API_TOKEN env var is required." >&2
  exit 2
fi

ZONE_NAME="${LP_STUDIO_ZONE:-lpstudio.ai}"
API="https://api.cloudflare.com/client/v4"

ZONE_ID="$(curl -sS "$API/zones?name=$ZONE_NAME" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  | python3 -c '
import sys, json
d = json.load(sys.stdin)
if not d.get("success") or not d.get("result"):
    sys.stderr.write("Failed to resolve zone " + repr(d) + "\n"); sys.exit(1)
print(d["result"][0]["id"])
')"

ALL="$(curl -sS "$API/zones/$ZONE_ID/custom_hostnames?per_page=500" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN")"

# If no args, print every hostname. Otherwise filter to the args.
echo "$ALL" | python3 -c '
import sys, json
d = json.load(sys.stdin)
if not d.get("success"):
    sys.stderr.write("API error: " + json.dumps(d.get("errors"), indent=2) + "\n"); sys.exit(2)
filt = set(sys.argv[1:])
rows = d.get("result") or []
if filt:
    rows = [r for r in rows if r["hostname"] in filt]
    missing = filt - {r["hostname"] for r in rows}
    for m in sorted(missing):
        print("%-40s NOT FOUND" % m)
print("%-40s %-10s %-10s %-8s %s" % ("HOSTNAME", "STATUS", "SSL", "METHOD", "ERRORS"))
print("-" * 100)
all_active = True
for r in rows:
    host = r["hostname"]
    status = r.get("status", "?")
    ssl = r.get("ssl", {})
    ssl_status = ssl.get("status", "?")
    method = ssl.get("method", "?")
    # Surface anything blocking validation so we know what to chase.
    errs = []
    for e in (r.get("verification_errors") or []):
        errs.append("verif:" + str(e))
    for v in (ssl.get("validation_errors") or []):
        m = v.get("message") if isinstance(v, dict) else str(v)
        errs.append("ssl:" + str(m))
    err_str = "; ".join(errs)[:80] if errs else ""
    line_ok = (status == "active" and ssl_status == "active")
    all_active = all_active and line_ok
    marker = "✓" if line_ok else "·"
    print("%s %-38s %-10s %-10s %-8s %s" % (marker, host, status, ssl_status, method, err_str))

if filt and len(rows) < len(filt):
    sys.exit(3)
sys.exit(0 if all_active else 1)
' "$@"
