import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { History, Loader2, RefreshCw, Search, Smartphone, X } from "lucide-react";

// Page size for the paginated "Recent releases" history (Task #671).
const RELEASE_PAGE_SIZE = 50;

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// One row per phone that has consumed its free trial. Only the SHA-256 hash of
// the normalized E.164 number is ever stored/returned — never the raw number.
// `tenant_id`/name are nullable: the tenant may have been deleted (the link is
// SET NULL while the "already trialed" fact is preserved).
interface TrialPhoneRow {
  phone_hash: string;
  tenant_id: number | null;
  tenant_name: string | null;
  tenant_slug: string | null;
  created_at: string;
}

// One row per past release (append-only audit). Prior-tenant name/slug are a
// snapshot taken at release time so the history stays readable even after the
// tenant is deleted. Only the SHA-256 hash of the number is ever returned.
interface ReleaseLogRow {
  id: number;
  phone_hash: string;
  prior_tenant_id: number | null;
  prior_tenant_name: string | null;
  prior_tenant_slug: string | null;
  original_created_at: string | null;
  actor_user_id: number | null;
  actor_email: string | null;
  released_at: string;
}

function parseError(message: string): string {
  try {
    const parsed = JSON.parse(message) as { error?: string };
    if (parsed?.error) return parsed.error;
  } catch {
    /* not JSON — fall through */
  }
  return message || "Something went wrong";
}

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    credentials: "include",
    headers: { "content-type": "application/json", ...(opts?.headers ?? {}) },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || String(res.status));
  }
  return res.json();
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// Result of a phone lookup. `row` is the matching trial record (when `found`),
// or null when the (valid, normalized) number has never used a trial. The raw
// number the operator typed is never echoed back — only the resulting hash.
interface LookupResult {
  phoneHash: string;
  found: boolean;
  row: TrialPhoneRow | null;
}

export default function SuperAdminTrialPhones() {
  const [rows, setRows] = useState<TrialPhoneRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyHash, setBusyHash] = useState<string | null>(null);

  // Lookup box state. `phoneInput` is kept only in component memory so the raw
  // number never lands in a URL/query (and thus never in access logs).
  const [phoneInput, setPhoneInput] = useState("");
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookup, setLookup] = useState<LookupResult | null>(null);
  // Hash of the most recent match, so the matching table row can be highlighted.
  const [highlightHash, setHighlightHash] = useState<string | null>(null);
  const highlightRowRef = useRef<HTMLTableRowElement | null>(null);

  // "Recent releases" history — searchable + paginated (Task #671).
  const [releases, setReleases] = useState<ReleaseLogRow[] | null>(null);
  const [releaseSearch, setReleaseSearch] = useState("");
  const [releasesHasMore, setReleasesHasMore] = useState(false);
  const [releasesLoading, setReleasesLoading] = useState(false);
  const [releasesError, setReleasesError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch("/api/admin/superadmin/trial-phones");
      setRows(data ?? []);
    } catch (err) {
      setError(parseError(err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  }, []);

  // Monotonic request token so a slower earlier search response can't overwrite
  // the results of a newer one (debounced typing can fire overlapping fetches).
  const releaseReqId = useRef(0);

  // Fetch a page of the release history. `append` keeps the rows already shown
  // (for "load more"); otherwise it replaces them (a fresh search/refresh).
  const loadReleases = useCallback(
    async (opts?: { q?: string; offset?: number; append?: boolean }) => {
      const q = (opts?.q ?? "").trim();
      const offset = opts?.offset ?? 0;
      const reqId = ++releaseReqId.current;
      setReleasesLoading(true);
      setReleasesError(null);
      try {
        const params = new URLSearchParams();
        if (q) params.set("q", q);
        params.set("limit", String(RELEASE_PAGE_SIZE));
        params.set("offset", String(offset));
        const data = await apiFetch(
          `/api/admin/superadmin/trial-phones/release-log?${params.toString()}`,
        );
        // A newer request superseded this one — drop the stale response.
        if (reqId !== releaseReqId.current) return;
        const newRows: ReleaseLogRow[] = data?.rows ?? [];
        setReleasesHasMore(Boolean(data?.hasMore));
        setReleases((prev) =>
          opts?.append && prev ? [...prev, ...newRows] : newRows,
        );
      } catch (err) {
        if (reqId !== releaseReqId.current) return;
        setReleasesError(parseError(err instanceof Error ? err.message : String(err)));
      } finally {
        if (reqId === releaseReqId.current) setReleasesLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    load();
  }, [load]);

  // Scroll the highlighted row into view once a match is found.
  useEffect(() => {
    if (highlightHash && highlightRowRef.current) {
      highlightRowRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlightHash, rows]);

  // Debounce the search box so each keystroke doesn't fire a request. Also
  // covers the initial load (releaseSearch starts empty).
  useEffect(() => {
    const t = setTimeout(() => {
      loadReleases({ q: releaseSearch });
    }, 300);
    return () => clearTimeout(t);
  }, [releaseSearch, loadReleases]);

  const handleLookup = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const phone = phoneInput.trim();
    if (!phone) return;
    setLookupBusy(true);
    setLookupError(null);
    setLookup(null);
    setHighlightHash(null);
    try {
      const data = (await apiFetch("/api/admin/superadmin/trial-phones/lookup", {
        method: "POST",
        body: JSON.stringify({ phone }),
      })) as LookupResult;
      setLookup(data);
      setHighlightHash(data.found ? data.phoneHash : null);
    } catch (err) {
      setLookupError(parseError(err instanceof Error ? err.message : String(err)));
    } finally {
      setLookupBusy(false);
    }
  };

  const handleRelease = async (row: TrialPhoneRow) => {
    if (
      !window.confirm(
        "Release this phone record? The number tied to this hash will be able " +
          "to start a fresh free trial again. This cannot be undone.",
      )
    ) {
      return;
    }
    setBusyHash(row.phone_hash);
    setError(null);
    try {
      await apiFetch(`/api/admin/superadmin/trial-phones/${row.phone_hash}`, {
        method: "DELETE",
      });
      // Clear any lookup result pointing at the just-released record.
      if (lookup?.phoneHash === row.phone_hash) {
        setLookup(null);
        setHighlightHash(null);
      }
      await Promise.all([load(), loadReleases({ q: releaseSearch })]);
    } catch (err) {
      setError(parseError(err instanceof Error ? err.message : String(err)));
    } finally {
      setBusyHash(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Smartphone className="w-4 h-4" /> Trial phones
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5 max-w-2xl">
            Phone numbers that have already used a free trial. Only a one-way
            hash of each number is stored — never the raw number. Release a
            record to let that number start a fresh trial (e.g. a legitimate
            user who changed numbers, or a leftover test number).
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            load();
            loadReleases({ q: releaseSearch });
          }}
          disabled={loading}
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <form
        onSubmit={handleLookup}
        className="rounded-lg border bg-muted/30 p-3 space-y-2"
      >
        <label htmlFor="trial-phone-lookup" className="text-sm font-medium">
          Check a phone number
        </label>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            id="trial-phone-lookup"
            value={phoneInput}
            onChange={(e) => setPhoneInput(e.target.value)}
            placeholder="+15551234567"
            autoComplete="off"
            className="sm:max-w-xs font-mono"
          />
          <Button type="submit" size="sm" disabled={lookupBusy || !phoneInput.trim()}>
            {lookupBusy ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <Search className="w-3.5 h-3.5 mr-1.5" />
            )}
            Look up
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Enter the full number including country code (e.g. +1 for the US). The
          number is hashed exactly like the trial gate and discarded — it is
          never stored or logged.
        </p>
        {lookupError && <p className="text-sm text-destructive">{lookupError}</p>}
        {lookup && (
          <div
            className={`rounded-md border p-3 text-sm ${
              lookup.found
                ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200"
                : "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200"
            }`}
          >
            {lookup.found && lookup.row ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-medium">
                    This number has already used a free trial.
                  </span>{" "}
                  {lookup.row.tenant_id === null ? (
                    <span className="italic">Tenant deleted.</span>
                  ) : (
                    <span>
                      Workspace: {lookup.row.tenant_name ?? `#${lookup.row.tenant_id}`}
                      {lookup.row.tenant_slug && (
                        <span className="font-mono ml-1">{lookup.row.tenant_slug}</span>
                      )}
                      {" · "}Trialed on {fmtDate(lookup.row.created_at)}.
                    </span>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  disabled={busyHash === lookup.row.phone_hash}
                  onClick={() => handleRelease(lookup.row!)}
                >
                  {busyHash === lookup.row.phone_hash ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    "Release"
                  )}
                </Button>
              </div>
            ) : (
              <span className="font-medium">
                This number has not used a free trial.
              </span>
            )}
          </div>
        )}
      </form>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Phone hash</TableHead>
              <TableHead>Workspace</TableHead>
              <TableHead>Trialed on</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows === null && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-12">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {rows?.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-12">
                  No phones have used a trial yet.
                </TableCell>
              </TableRow>
            )}
            {rows?.map((row) => {
              const isHighlighted = highlightHash === row.phone_hash;
              return (
              <TableRow
                key={row.phone_hash}
                ref={isHighlighted ? highlightRowRef : undefined}
                className={isHighlighted ? "bg-amber-100/70 dark:bg-amber-950/40" : undefined}
              >
                <TableCell>
                  <code className="font-mono text-xs" title={row.phone_hash}>
                    {row.phone_hash.slice(0, 16)}…
                  </code>
                </TableCell>
                <TableCell>
                  {row.tenant_id === null ? (
                    <span className="text-xs text-muted-foreground italic">
                      Tenant deleted
                    </span>
                  ) : (
                    <span className="text-sm">
                      {row.tenant_name ?? `#${row.tenant_id}`}
                      {row.tenant_slug && (
                        <span className="text-xs text-muted-foreground ml-1.5 font-mono">
                          {row.tenant_slug}
                        </span>
                      )}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {fmtDate(row.created_at)}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-destructive hover:text-destructive"
                    disabled={busyHash === row.phone_hash}
                    onClick={() => handleRelease(row)}
                  >
                    {busyHash === row.phone_hash ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      "Release"
                    )}
                  </Button>
                </TableCell>
              </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="pt-2">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <History className="w-4 h-4" /> Recent releases
        </h3>
        <p className="text-sm text-muted-foreground mt-0.5 max-w-2xl">
          Durable, append-only history of past releases — who released which
          hash, the workspace it had trialed for (snapshotted, so it survives
          tenant deletion), and when. Kept as an audit trail even after the
          record itself is gone.
        </p>

        <div className="relative mt-3 max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <Input
            type="search"
            value={releaseSearch}
            onChange={(e) => setReleaseSearch(e.target.value)}
            placeholder="Search by phone hash, workspace name/slug, or admin email…"
            className="pl-8 pr-8 h-9 text-sm"
          />
          {releaseSearch && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setReleaseSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {releasesError && (
          <p className="text-sm text-destructive mt-2">{releasesError}</p>
        )}

        <div className="border rounded-lg overflow-hidden mt-3">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Phone hash</TableHead>
                <TableHead>Prior workspace</TableHead>
                <TableHead>Released by</TableHead>
                <TableHead>Released at</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {releases === null && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    Loading…
                  </TableCell>
                </TableRow>
              )}
              {releases?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    {releaseSearch.trim()
                      ? "No releases match your search."
                      : "No releases yet."}
                  </TableCell>
                </TableRow>
              )}
              {releases?.map((rel) => (
                <TableRow key={rel.id}>
                  <TableCell>
                    <code className="font-mono text-xs" title={rel.phone_hash}>
                      {rel.phone_hash.slice(0, 16)}…
                    </code>
                  </TableCell>
                  <TableCell>
                    {rel.prior_tenant_id === null && !rel.prior_tenant_name ? (
                      <span className="text-xs text-muted-foreground italic">
                        No workspace
                      </span>
                    ) : (
                      <span className="text-sm">
                        {rel.prior_tenant_name ?? `#${rel.prior_tenant_id}`}
                        {rel.prior_tenant_slug && (
                          <span className="text-xs text-muted-foreground ml-1.5 font-mono">
                            {rel.prior_tenant_slug}
                          </span>
                        )}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {rel.actor_email ?? (
                      <span className="text-xs text-muted-foreground italic">Unknown</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {fmtDateTime(rel.released_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {releasesHasMore && (
          <div className="flex justify-center mt-3">
            <Button
              size="sm"
              variant="outline"
              disabled={releasesLoading}
              onClick={() =>
                loadReleases({
                  q: releaseSearch,
                  offset: releases?.length ?? 0,
                  append: true,
                })
              }
            >
              {releasesLoading ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : null}
              Load more
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
