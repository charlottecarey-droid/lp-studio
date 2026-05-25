#!/usr/bin/env bash
# Provision a Cloudflare Custom Hostname for a customer-owned domain so
# that the tenant-host-router worker can serve traffic on it.
#
# Customer onboarding is a TWO-step process (see wrangler.toml header):
#   1. Add a Custom Hostname (THIS SCRIPT) — provisions the SSL cert and
#      routes traffic into Cloudflare via Fallback Origin.
#   2. Add a Worker Route in wrangler.toml + `wrangler deploy` — causes
#      the worker to actually fire on that hostname.
# Both are required; either alone silently falls back to passthrough.
#
# Usage:
#   ./scripts/provision-custom-hostname.sh <hostname> [<hostname> ...]
#
# Example:
#   ./scripts/provision-custom-hostname.sh partners.meetdandy.com lp.meetdandy.com
#
# Requirements:
#   - CLOUDFLARE_API_TOKEN env var, with these zone permissions on lpstudio.ai:
#       Zone:Read, SSL and Certificates:Edit, Workers Routes:Edit
#   - python3 and curl in PATH
#
# Prints a customer-ready summary of the TXT records to add to the
# customer's authoritative DNS zone. Send the output directly to the
# customer — they add the records, Cloudflare validates within minutes,
# SSL cert issues, and the hostname becomes serveable. After that, add
# the route in wrangler.toml and `wrangler deploy`.

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <hostname> [<hostname> ...]" >&2
  exit 2
fi

if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  echo "Error: CLOUDFLARE_API_TOKEN env var is required." >&2
  echo "       Token needs Zone:Read + SSL and Certificates:Edit on lpstudio.ai." >&2
  exit 2
fi

ZONE_NAME="${LP_STUDIO_ZONE:-lpstudio.ai}"
API="https://api.cloudflare.com/client/v4"

cf_api() {
  local method="$1"; shift
  local path="$1"; shift
  curl -sS -X "$method" "$API$path" \
    -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
    -H "Content-Type: application/json" \
    "$@"
}

# Resolve zone ID once.
ZONE_ID="$(cf_api GET "/zones?name=$ZONE_NAME" \
  | python3 -c '
import sys, json
d = json.load(sys.stdin)
if not d.get("success") or not d.get("result"):
    sys.stderr.write("Failed to resolve zone " + repr(d) + "\n")
    sys.exit(1)
print(d["result"][0]["id"])
')"

echo "Zone: $ZONE_NAME ($ZONE_ID)"
echo

for HOSTNAME in "$@"; do
  echo "================================================================"
  echo "Provisioning Custom Hostname: $HOSTNAME"
  echo "================================================================"

  # Idempotency: check if it already exists. CF rejects duplicates with
  # a 1411 error, but we want to re-print the validation records for
  # pending ones rather than fail.
  EXISTING="$(cf_api GET "/zones/$ZONE_ID/custom_hostnames?hostname=$HOSTNAME" \
    | python3 -c '
import sys, json
d = json.load(sys.stdin)
if not d.get("success"):
    sys.stderr.write("List failed: " + json.dumps(d) + "\n"); sys.exit(1)
matches = [c for c in (d.get("result") or []) if c.get("hostname") == sys.argv[1]]
print(matches[0]["id"] if matches else "")
' "$HOSTNAME")"

  if [[ -n "$EXISTING" ]]; then
    echo "  → Already exists (id=$EXISTING). Re-fetching validation records..."
    RESP="$(cf_api GET "/zones/$ZONE_ID/custom_hostnames/$EXISTING")"
  else
    RESP="$(cf_api POST "/zones/$ZONE_ID/custom_hostnames" --data "$(cat <<JSON
{
  "hostname": "$HOSTNAME",
  "ssl": {
    "method": "txt",
    "type": "dv",
    "settings": { "min_tls_version": "1.2" }
  }
}
JSON
)")"
  fi

  echo "$RESP" | python3 -c '
import sys, json
d = json.load(sys.stdin)
if not d.get("success"):
    sys.stderr.write("API error: " + json.dumps(d.get("errors"), indent=2) + "\n")
    sys.exit(1)
r = d["result"]
host = r["hostname"]
print(f"  hostname:    {host}")
print(f"  id:          {r[\"id\"]}")
print(f"  status:      {r.get(\"status\", \"?\")}")
ssl = r.get("ssl", {})
print(f"  ssl.status:  {ssl.get(\"status\", \"?\")}")
print(f"  ssl.method:  {ssl.get(\"method\", \"?\")}")
print()
print("  --- TXT records the customer must add to their zone ---")
ov = r.get("ownership_verification") or {}
if ov:
    print(f"  [1] Ownership verification (proves CF can manage this hostname)")
    print(f"      Type:  {ov.get(\"type\", \"TXT\")}")
    print(f"      Name:  {ov.get(\"name\", \"?\")}")
    print(f"      Value: {ov.get(\"value\", \"?\")}")
else:
    print("  [1] Ownership verification: (none — already validated or HTTP method)")
print()
val = ssl.get("validation_records") or []
if val:
    for i, v in enumerate(val, start=2):
        print(f"  [{i}] SSL DCV (proves we control the hostname for cert issuance)")
        print(f"      Type:  TXT")
        print(f"      Name:  {v.get(\"txt_name\", \"?\")}")
        print(f"      Value: {v.get(\"txt_value\", \"?\")}")
        print()
else:
    print("  [2+] SSL DCV records: (none yet — CF may still be generating; re-run status script in 30s)")
'
  echo
done

echo "================================================================"
echo "Next steps:"
echo "  1. Send the TXT records above to the customer's DNS admin."
echo "     (Names are FQDNs — customer's DNS UI may need them shortened"
echo "     to the relative form, e.g. _cf-custom-hostname.partners"
echo "     instead of _cf-custom-hostname.partners.meetdandy.com)"
echo "  2. After they add them, run:"
echo "       ./scripts/check-custom-hostname.sh $*"
echo "     Both 'status' and 'ssl.status' must be 'active' before any"
echo "     CNAME flip — otherwise visitors get TLS handshake failures."
echo "  3. Add a worker route for each hostname in wrangler.toml, then"
echo "     'npx wrangler deploy'. (Routes can be added before SSL is"
echo "      active — they're harmless until customer DNS points at CF.)"
echo "================================================================"
