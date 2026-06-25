// AccountSearchTypeahead — Step 1 of the redesigned New Microsite flow.
//
// "Who is this for?" A debounced typeahead over GET /sales/accounts/search that
// shows, per result: the company name + domain, a CONFIDENCE indicator (how
// well it matches the query) and a DATA-RICHNESS hint (how much context the
// generator can personalise from). The search already groups same-company rows
// and flags the non-canonical ones `isLikelyDuplicateOf`, so we surface the
// richest first. This is a pure SELECTION flow — it never creates an account,
// so it shows no "duplicate account" creation warning. A "Continue without an
// account" escape hatch is always available.
//
// Selecting a result lifts the chosen account up to the modal; the existing
// account-context pull happens server-side at generate time.
import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Building2,
  Database,
  Loader2,
  Search,
  Target,
  UserX,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const API_BASE = "/api";

export interface AccountSearchResult {
  id: number | string;
  name: string;
  domain: string | null;
  crmId?: string;
  source: "crm" | "local";
  dataRichness: number;
  confidence: number;
  isLikelyDuplicateOf?: number | string;
}

/** The account a rep settled on — lifted to the modal. `numericId` is set only
 *  for a local DB row (a number we can POST to /accounts/:id/...). CRM-only
 *  rows carry a string id + crmId and have no numericId until imported. */
export interface SelectedAccount {
  id: number | string;
  numericId: number | null;
  name: string;
  domain: string | null;
  crmId?: string;
  source: "crm" | "local";
}

interface Props {
  selected: SelectedAccount | null;
  onSelect: (account: SelectedAccount | null) => void;
  /** Rep chose "continue without an account". */
  noAccount: boolean;
  onNoAccount: (value: boolean) => void;
}

function richnessLabel(score: number): { label: string; tone: string } {
  if (score >= 60) return { label: "Rich context", tone: "text-emerald-600" };
  if (score >= 25) return { label: "Some context", tone: "text-amber-600" };
  return { label: "Little context", tone: "text-muted-foreground" };
}

function confidenceLabel(score: number): { label: string; dots: number } {
  if (score >= 85) return { label: "Strong match", dots: 3 };
  if (score >= 60) return { label: "Likely match", dots: 2 };
  return { label: "Possible match", dots: 1 };
}

export function AccountSearchTypeahead({
  selected,
  onSelect,
  noAccount,
  onNoAccount,
}: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AccountSearchResult[]>([]);
  const [crmConnected, setCrmConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const abortRef = useRef<AbortController | null>(null);
  const listboxId = "account-search-listbox";

  // Debounced search. Empty query clears results; aborts the in-flight request
  // on each keystroke so stale responses can't overwrite fresh ones.
  useEffect(() => {
    const q = query.trim();
    if (selected) return; // a selection is showing — don't re-search
    if (!q) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const handle = setTimeout(() => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      fetch(`${API_BASE}/sales/accounts/search?q=${encodeURIComponent(q)}`, {
        signal: ac.signal,
      })
        .then((r) => (r.ok ? r.json() : { results: [], crmConnected: false }))
        .then((data: { results?: AccountSearchResult[]; crmConnected?: boolean }) => {
          setResults(Array.isArray(data.results) ? data.results : []);
          setCrmConnected(Boolean(data.crmConnected));
          setActiveIdx(-1);
          setLoading(false);
        })
        .catch((err) => {
          if (err?.name === "AbortError") return;
          setResults([]);
          setLoading(false);
        });
    }, 250);
    return () => clearTimeout(handle);
  }, [query, selected]);

  function choose(r: AccountSearchResult) {
    onSelect({
      id: r.id,
      numericId: typeof r.id === "number" ? r.id : null,
      name: r.name,
      domain: r.domain,
      crmId: r.crmId,
      source: r.source,
    });
    onNoAccount(false);
    setQuery("");
    setResults([]);
  }

  function clearSelection() {
    onSelect(null);
    setQuery("");
    setResults([]);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && activeIdx >= 0) {
      e.preventDefault();
      choose(results[activeIdx]);
    }
  }

  // ── Selected state ──────────────────────────────────────────────────────
  if (selected) {
    return (
      <div className="rounded-lg border border-primary/40 bg-primary/5 p-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
            <Building2 className="w-4 h-4 text-primary" aria-hidden />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{selected.name}</p>
            <p className="text-[11px] text-muted-foreground truncate">
              {selected.domain || (selected.source === "crm" ? "From your CRM" : "No domain on file")}
              {selected.source === "crm" && selected.numericId === null
                ? " · we'll import it on generate"
                : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={clearSelection}
            className="text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded px-1"
          >
            Change
          </button>
        </div>
      </div>
    );
  }

  // ── "Without an account" state ──────────────────────────────────────────
  if (noAccount) {
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-muted-foreground inline-flex items-center gap-2">
            <UserX className="w-4 h-4" aria-hidden />
            Creating without an account
          </span>
          <button
            type="button"
            className="text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded px-1"
            onClick={() => onNoAccount(false)}
          >
            Pick an account instead
          </button>
        </div>
      </div>
    );
  }

  // ── Search state ────────────────────────────────────────────────────────
  return (
    <div className="space-y-2">
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none"
          aria-hidden
        />
        <Input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Search by company name or domain…"
          className="pl-9"
          role="combobox"
          aria-expanded={results.length > 0}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={activeIdx >= 0 ? `${listboxId}-opt-${activeIdx}` : undefined}
          autoFocus
        />
        {loading && (
          <Loader2
            className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin motion-reduce:animate-none"
            aria-hidden
          />
        )}
      </div>

      {/* Results */}
      {query.trim() && !loading && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Matching accounts"
          className="rounded-lg border border-border divide-y divide-border overflow-hidden max-h-64 overflow-y-auto"
        >
          {results.length === 0 ? (
            <li className="px-3 py-4 text-sm text-center text-muted-foreground">
              No matching accounts found.
            </li>
          ) : (
            results.map((r, i) => {
              const conf = confidenceLabel(r.confidence);
              const rich = richnessLabel(r.dataRichness);
              const isDup = r.isLikelyDuplicateOf !== undefined;
              return (
                <li key={`${r.source}-${r.id}`} role="option" id={`${listboxId}-opt-${i}`} aria-selected={i === activeIdx}>
                  <button
                    type="button"
                    onClick={() => choose(r)}
                    onMouseEnter={() => setActiveIdx(i)}
                    className={cn(
                      "w-full text-left px-3 py-2.5 flex items-start gap-2.5 transition-colors focus-visible:outline-none",
                      i === activeIdx ? "bg-accent" : "hover:bg-accent/60",
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground truncate">{r.name}</span>
                        {r.source === "crm" && (
                          <span className="text-[9px] uppercase tracking-wide font-semibold text-muted-foreground bg-muted rounded px-1 py-0.5 shrink-0">
                            CRM
                          </span>
                        )}
                        {isDup && (
                          <span className="inline-flex items-center gap-0.5 text-[9px] uppercase tracking-wide font-semibold text-amber-700 bg-amber-100 rounded px-1 py-0.5 shrink-0">
                            <AlertTriangle className="w-2.5 h-2.5" aria-hidden />
                            Possible dup
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                        <span className="text-[11px] text-muted-foreground truncate">
                          {r.domain || "no domain"}
                        </span>
                        <span className={cn("inline-flex items-center gap-1 text-[11px]", rich.tone)}>
                          <Database className="w-3 h-3" aria-hidden />
                          {rich.label}
                        </span>
                      </div>
                    </div>
                    {/* Confidence dots */}
                    <span
                      className="inline-flex items-center gap-1 shrink-0 mt-0.5"
                      title={`${conf.label} (${r.confidence}%)`}
                      aria-label={`${conf.label}, confidence ${r.confidence} percent`}
                    >
                      <Target className="w-3 h-3 text-muted-foreground" aria-hidden />
                      <span className="flex gap-0.5" aria-hidden>
                        {[0, 1, 2].map((d) => (
                          <span
                            key={d}
                            className={cn(
                              "w-1.5 h-1.5 rounded-full",
                              d < conf.dots ? "bg-primary" : "bg-muted-foreground/25",
                            )}
                          />
                        ))}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      )}

      {/* Footer actions */}
      <div className="flex items-center justify-between gap-2 pt-0.5">
        <button
          type="button"
          onClick={() => {
            onNoAccount(true);
            clearSelection();
          }}
          className="text-[11px] text-muted-foreground hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded px-1"
        >
          Continue without an account
        </button>
      </div>

      {!crmConnected && query.trim() && results.length === 0 && !loading && (
        <p className="text-[11px] text-muted-foreground">
          Connect your CRM in settings to search accounts that aren't in LP Studio yet.
        </p>
      )}
    </div>
  );
}
