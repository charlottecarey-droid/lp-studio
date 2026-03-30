import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { format } from "date-fns";
import {
  Users,
  Search,
  Building2,
  Mail,
  ArrowLeft,
  Activity,
  Eye,
  MousePointerClick,
  FileText,
  Phone,
  Trash2,
  Upload,
  Loader2,
  X,
  Sparkles,
  Filter,
  UsersRound,
  ChevronDown,
  List,
  LayoutList,
  ExternalLink,
  Download,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SalesLayout } from "@/components/layout/sales-layout";
import DraftEmailModal from "./DraftEmailModal";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { usePagination } from "@/hooks/use-pagination";

const API_BASE = "/api";

const TIER_COLORS: Record<string, string> = {
  ENT: "bg-purple-100 text-purple-700",
  STRAT: "bg-primary/10 text-primary",
  IW: "bg-blue-100 text-blue-700",
  LENT: "bg-amber-100 text-amber-700",
};
const STAGE_COLORS: Record<string, string> = {
  Prospect: "bg-slate-100 text-slate-600",
  Discovery: "bg-blue-100 text-blue-700",
  Evaluation: "bg-violet-100 text-violet-700",
  Champion: "bg-emerald-100 text-emerald-700",
  "Closed Won": "bg-green-100 text-green-700",
  "Closed Lost": "bg-red-100 text-red-600",
};

interface Contact {
  id: number;
  accountId: number;
  firstName: string;
  lastName: string;
  email: string | null;
  title: string | null;
  role: string | null;
  phone?: string | null;
  tier?: string | null;
  titleLevel?: string | null;
  contactRole?: string | null;
  department?: string | null;
  status: string;
  createdAt: string;
  // From accounts join
  accountName?: string | null;
  abmTier?: string | null;
  abmStage?: string | null;
  practiceSegment?: string | null;
  accountOwner?: string | null;
  dsoSize?: string | null;
}

interface Signal {
  id: number;
  accountId: number | null;
  contactId: number | null;
  type: string;
  source: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

interface Hotlink {
  id: number;
  token: string;
  contactId: number;
  pageId: number;
  isActive: boolean;
  createdAt: string;
}

const signalConfig: Record<string, { icon: typeof Activity; label: string; color: string }> = {
  page_view: { icon: Eye, label: "Viewed Page", color: "text-blue-500" },
  email_open: { icon: Mail, label: "Opened Email", color: "text-amber-500" },
  email_click: { icon: MousePointerClick, label: "Clicked Link", color: "text-emerald-500" },
  form_submit: { icon: FileText, label: "Submitted Form", color: "text-purple-500" },
};

function getEngagementScore(signals: Signal[]): { label: string; color: string; score: number } {
  if (signals.length === 0) return { label: "No activity", color: "text-muted-foreground bg-muted/50", score: 0 };

  // Score based on recency and frequency
  const now = Date.now();
  const recentSignals = signals.filter(s => now - new Date(s.createdAt).getTime() < 7 * 24 * 60 * 60 * 1000); // last 7 days
  const formSubmits = signals.filter(s => s.type === "form_submit").length;
  const emailClicks = signals.filter(s => s.type === "email_click").length;

  // Weighted score: form submits worth 5, clicks worth 3, opens worth 2, views worth 1
  const score = signals.reduce((sum, s) => {
    if (s.type === "form_submit") return sum + 5;
    if (s.type === "email_click") return sum + 3;
    if (s.type === "email_open") return sum + 2;
    return sum + 1;
  }, 0);

  // Boost for recent activity
  const recencyBoost = recentSignals.length > 0 ? 1.5 : 1;
  const finalScore = Math.round(score * recencyBoost);

  if (finalScore >= 15 || formSubmits > 0) return { label: "Hot", color: "text-red-600 bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/50", score: finalScore };
  if (finalScore >= 8 || emailClicks > 0) return { label: "Warm", color: "text-amber-600 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/50", score: finalScore };
  if (finalScore >= 3) return { label: "Cool", color: "text-blue-600 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900/50", score: finalScore };
  return { label: "Cold", color: "text-slate-500 bg-slate-50 dark:bg-slate-950/30 border-slate-200 dark:border-slate-900/50", score: finalScore };
}

/* ─── CSV Import Modal ───────────────────────────────────────── */

const CSV_TEMPLATE_HEADERS = [
  "sfdcAccountId",   // Salesforce Account ID — preferred join key
  "accountName",     // Account name — used if sfdcAccountId is blank
  "accountOwner",    // Account owner / rep name
  "accountAbmStage",    // ABM stage (e.g. Awareness | Consideration | Decision)
  "accountNumLocations", // Number of practices / locations
  "salesforceId",    // SFDC Contact ID (003…) — optional
  "firstName",
  "lastName",
  "email",
  "title",           // job title
  "role",            // buyer persona label
  "phone",
  "tier",            // ENT | IW | LENT | STRAT
  "titleLevel",      // C Suite | VP Level | Director Level | Manager Level | Individual Contributor
  "contactRole",     // Decision Maker | Champion | Influencer | Other
  "department",      // C Suite | Operations | Finance | Sales and Marketing
  "linkedinUrl",
  "status",          // active | unsubscribed | bounced  (defaults to "active")
];

const CSV_TEMPLATE_EXAMPLE = [
  "0015d00003WBzFNAA1",  // sfdcAccountId
  "Acme Dental Group",   // accountName
  "Jane Doe",            // accountOwner
  "Consideration",       // accountAbmStage
  "12",                  // accountNumLocations
  "0035d00003XCzGOAA2",  // salesforceId
  "Jane",
  "Smith",
  "jane.smith@acmedental.com",
  "Chief Executive Officer",
  "CEO",
  "555-123-4567",
  "ENT",
  "C Suite",
  "Decision Maker",
  "C Suite",
  "https://linkedin.com/in/janesmith",
  "active",
];

function downloadCsvTemplate() {
  const rows = [CSV_TEMPLATE_HEADERS, CSV_TEMPLATE_EXAMPLE];
  const csv = rows.map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "contacts_import_template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

/* Auto-map CSV header → DB field name */
const DB_FIELD_ALIASES: Record<string, string[]> = {
  sfdcAccountId:  ["sfdcaccountid", "sfdc_account_id", "account_id", "accountid", "salesforce_account_id", "salesforceaccountid"],
  accountName:    ["accountname", "account_name", "account", "organization", "practice", "practicename", "practice_name", "company", "companyname", "company_name"],
  accountOwner:   ["accountowner", "account_owner", "owner", "rep", "ownername", "owner_name", "accountrep", "account_rep"],
  accountAbmStage:     ["accountabmstage", "account_abm_stage", "abmstage", "abm_stage", "stage", "accountstage", "account_stage"],
  accountNumLocations: ["accountnumlocations", "account_num_locations", "numlocations", "num_locations", "numberoflocations", "number_of_locations", "practices", "numberofpractices", "number_of_practices", "locations"],
  salesforceId:   ["salesforceid", "sfdc_id", "sfdcid", "salesforce_contact_id", "contact_sfdc_id", "salesforceid"],
  firstName:      ["firstname", "first_name", "first"],
  lastName:       ["lastname", "last_name", "last"],
  email:          ["email", "emailaddress", "email_address"],
  title:          ["title", "jobtitle", "job_title"],
  role:           ["role", "persona", "buyer_persona"],
  phone:          ["phone", "phonenumber", "phone_number", "mobile", "cell"],
  tier:           ["tier", "abmtier", "abm_tier", "contact_tier"],
  titleLevel:     ["titlelevel", "title_level", "seniority", "seniorlevel", "seniority_level"],
  contactRole:    ["contactrole", "contact_role", "buyerrole", "buyer_role", "buyingcommitteerole"],
  department:     ["department", "dept"],
  linkedinUrl:    ["linkedinurl", "linkedin_url", "linkedin", "linkedinprofile", "linkedin_profile"],
  status:         ["status"],
};

const DB_FIELD_LABELS: Record<string, string> = {
  sfdcAccountId: "SFDC Account ID ★",
  accountName:   "Account Name ★",
  accountOwner:    "Account Owner",
  accountAbmStage:     "ABM Stage",
  accountNumLocations: "# of Practices",
  salesforceId:        "SFDC Contact ID",
  firstName:     "First Name",
  lastName:      "Last Name",
  email:         "Email",
  title:         "Job Title",
  role:          "Role / Persona",
  phone:         "Phone",
  tier:          "Tier (ENT/IW/LENT)",
  titleLevel:    "Title Level",
  contactRole:   "Contact Role",
  department:    "Department",
  linkedinUrl:   "LinkedIn URL",
  status:        "Status",
};

function autoDetectField(csvHeader: string): string {
  const normalized = csvHeader.toLowerCase().replace(/[\s_-]/g, "");
  for (const [field, aliases] of Object.entries(DB_FIELD_ALIASES)) {
    if (aliases.includes(normalized)) return field;
  }
  // Exact camelCase match
  if (normalized in DB_FIELD_LABELS) return normalized;
  return "";
}

// Parse CSV text robustly (handles quoted fields with commas)
function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.trim().split(/\r?\n/);
  const parseRow = (line: string): string[] => {
    const vals: string[] = [];
    let cur = "";
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuote = !inQuote; continue; }
      if (ch === "," && !inQuote) { vals.push(cur.trim()); cur = ""; continue; }
      cur += ch;
    }
    vals.push(cur.trim());
    return vals;
  };
  const headers = parseRow(lines[0]);
  const rows = lines.slice(1).filter(l => l.trim()).map(line => {
    const vals = parseRow(line);
    return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? ""]));
  });
  return { headers, rows };
}

function CsvImportModal({ open, onClose, onImported }: { open: boolean; onClose: () => void; onImported: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"pick" | "map" | "importing" | "done">("pick");
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({}); // csvHeader → dbField
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setStep("pick");
    setCsvHeaders([]);
    setCsvRows([]);
    setMapping({});
    setResult(null);
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleClose() { reset(); onClose(); }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    file.text().then((text) => {
      const { headers, rows } = parseCsv(text);
      const autoMap: Record<string, string> = {};
      headers.forEach(h => { autoMap[h] = autoDetectField(h); });
      setCsvHeaders(headers);
      setCsvRows(rows);
      setMapping(autoMap);
      setStep("map");
    }).catch(() => setError("Could not read file"));
  }

  async function handleImport() {
    setStep("importing");
    setError(null);
    try {
      // Apply mapping: transform rows using the column map
      const contacts = csvRows.map(row => {
        const contact: Record<string, string> = {};
        csvHeaders.forEach(csvCol => {
          const dbField = mapping[csvCol];
          if (dbField && row[csvCol]) contact[dbField] = row[csvCol];
        });
        return contact;
      }).filter(c => c.sfdcAccountId || c.accountName); // must have at least one join key

      const res = await fetch(`${API_BASE}/sales/import/contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: contacts }),
      });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json().catch(() => ({}));
      const summary = json.summary ?? {};
      setResult({ imported: (summary.created ?? 0) + (summary.updated ?? 0), skipped: (summary.skipped ?? 0) + (csvRows.length - contacts.length) });
      setStep("done");
      onImported();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
      setStep("map");
    }
  }

  const joinKeyMapped = Object.values(mapping).includes("sfdcAccountId") || Object.values(mapping).includes("accountName");
  const mappedCount = Object.values(mapping).filter(Boolean).length;
  const willImport = csvRows.filter(row => {
    const sfdcCol = csvHeaders.find(h => mapping[h] === "sfdcAccountId");
    const nameCol = csvHeaders.find(h => mapping[h] === "accountName");
    return (sfdcCol && row[sfdcCol]) || (nameCol && row[nameCol]);
  }).length;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-display font-bold text-foreground">Import Contacts</h2>
            {/* Step indicators */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {(["pick", "map", "importing", "done"] as const).map((s, i) => {
                const labels = ["Pick File", "Map Columns", "Import", "Done"];
                const isDone = ["pick", "map", "importing", "done"].indexOf(step) > i;
                const isActive = step === s;
                return (
                  <span key={s} className="flex items-center gap-1">
                    {i > 0 && <span className="text-border">›</span>}
                    <span className={`${isActive ? "text-primary font-semibold" : isDone ? "text-foreground" : "text-muted-foreground"}`}>
                      {labels[i]}
                    </span>
                  </span>
                );
              })}
            </div>
          </div>
          <button onClick={handleClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* ── Step: Pick ── */}
          {step === "pick" && (
            <div className="flex flex-col gap-4">
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <span className="font-semibold">sfdcAccountId or accountName is required</span> — used to link contacts to their account. Rows with neither will be skipped.
              </p>
              <button onClick={downloadCsvTemplate}
                className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg border border-primary/25 bg-primary/5 hover:bg-primary/10 text-primary text-sm font-medium transition-colors">
                <Download className="w-4 h-4 shrink-0" />
                <span>Download CSV Template</span>
                <span className="ml-auto text-xs text-primary/60 font-normal">{CSV_TEMPLATE_HEADERS.length} columns</span>
              </button>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <input ref={fileRef} type="file" accept=".csv" onChange={handleFileChange} className="hidden" id="csv-upload" />
              <label htmlFor="csv-upload"
                className="flex flex-col items-center justify-center gap-2 w-full py-12 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-all">
                <Upload className="w-6 h-6 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Click to choose a CSV file</span>
                <span className="text-xs text-muted-foreground/60">or drag and drop</span>
              </label>
            </div>
          )}

          {/* ── Step: Map ── */}
          {step === "map" && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">{csvRows.length} rows</span> · {csvHeaders.length} columns detected · {mappedCount} mapped
                </p>
                {!joinKeyMapped && (
                  <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-full">
                    ★ No account join key mapped
                  </span>
                )}
              </div>

              {/* Sample preview row */}
              <div className="rounded-xl border border-border overflow-hidden">
                <div className="grid grid-cols-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/40 px-3 py-2 border-b border-border">
                  <span>CSV Column</span>
                  <span>Sample Value</span>
                  <span>Maps To</span>
                </div>
                <div className="divide-y divide-border max-h-[340px] overflow-y-auto">
                  {csvHeaders.map((csvCol) => {
                    const sample = csvRows[0]?.[csvCol] ?? "";
                    const mapped = mapping[csvCol] ?? "";
                    const isRequired = mapped === "sfdcAccountId";
                    const isDuplicate = mapped && Object.entries(mapping).filter(([k, v]) => v === mapped && k !== csvCol).length > 0;
                    return (
                      <div key={csvCol} className={`grid grid-cols-3 items-center gap-2 px-3 py-2 text-sm ${isDuplicate ? "bg-amber-50/50" : ""}`}>
                        <span className="font-mono text-xs text-foreground truncate" title={csvCol}>{csvCol}</span>
                        <span className="text-xs text-muted-foreground truncate" title={sample}>{sample || <em className="opacity-40">empty</em>}</span>
                        <div className="relative">
                          <select
                            value={mapped}
                            onChange={(e) => setMapping(prev => ({ ...prev, [csvCol]: e.target.value }))}
                            className={`w-full text-xs appearance-none pl-2 pr-6 py-1.5 rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer ${
                              isRequired ? "border-primary text-primary font-semibold" :
                              mapped ? "border-border text-foreground" :
                              "border-dashed border-muted-foreground/40 text-muted-foreground"
                            }`}
                          >
                            <option value="">— Skip —</option>
                            {Object.entries(DB_FIELD_LABELS).map(([field, label]) => (
                              <option key={field} value={field}>{label}</option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {!joinKeyMapped && (
                <p className="text-xs text-amber-700">Map a column to "SFDC Account ID ★" or "Account Name ★" to enable import.</p>
              )}
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
          )}

          {/* ── Step: Importing ── */}
          {step === "importing" && (
            <div className="flex flex-col items-center justify-center gap-4 py-16">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Importing contacts…</p>
            </div>
          )}

          {/* ── Step: Done ── */}
          {step === "done" && result && (
            <div className="flex flex-col items-center justify-center gap-4 py-10 text-center">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="w-7 h-7 text-primary" />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground">{result.imported} contacts imported</p>
                {result.skipped > 0 && (
                  <p className="text-sm text-muted-foreground mt-1">{result.skipped} rows skipped (no matching SFDC Account ID)</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-border shrink-0">
          {step === "pick" && <Button variant="outline" onClick={handleClose}>Cancel</Button>}
          {step === "map" && (
            <>
              <Button variant="outline" onClick={reset}>← Back</Button>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">{willImport} of {csvRows.length} rows will import</span>
                <Button onClick={handleImport} disabled={!joinKeyMapped} className="gap-2">
                  <Upload className="w-4 h-4" />
                  Import {willImport} Contacts
                </Button>
              </div>
            </>
          )}
          {step === "done" && <Button onClick={handleClose} className="ml-auto">Done</Button>}
        </div>
      </div>
    </div>
  );
}

/* ─── Save as Audience Modal ─────────────────────────────────── */

function SaveAudienceModal({
  open, onClose, contactIds, defaultName,
}: { open: boolean; onClose: () => void; contactIds: number[]; defaultName: string }) {
  const [name, setName] = useState(defaultName);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (open) { setName(defaultName); setDone(false); setError(null); } }, [open, defaultName]);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/sales/audiences`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), filters: { contactIds } }),
      });
      if (!res.ok) throw new Error(await res.text());
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save audience");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <UsersRound className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-display font-bold text-foreground">Save as Audience</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {done ? (
          <div className="text-center py-6">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <UsersRound className="w-6 h-6 text-primary" />
            </div>
            <p className="font-semibold text-foreground">Audience saved!</p>
            <p className="text-sm text-muted-foreground mt-1">{contactIds.length} contacts added to "{name}"</p>
            <Button className="mt-4" onClick={onClose}>Done</Button>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-5">
              {contactIds.length} filtered contact{contactIds.length !== 1 ? "s" : ""} will be saved to this audience.
            </p>
            {error && <p className="text-sm text-destructive mb-3">{error}</p>}
            <div className="flex flex-col gap-3">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Audience name…"
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
                autoFocus
              />
              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
                <Button onClick={handleSave} disabled={saving || !name.trim()} className="flex-1 gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UsersRound className="w-4 h-4" />}
                  {saving ? "Saving…" : "Save Audience"}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Contact List View ──────────────────────────────────────── */

function ContactListView() {
  const [, navigate] = useLocation();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [contactSignals, setContactSignals] = useState<Record<number, Signal[]>>({});
  const [tierFilter, setTierFilter] = useState("");
  const [titleLevelFilter, setTitleLevelFilter] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showAudience, setShowAudience] = useState(false);
  const [draftContact, setDraftContact] = useState<Contact | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "grouped">("grouped");

  const fetchContacts = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch(`${API_BASE}/sales/contacts`).then((r) => (r.ok ? r.json() : [])),
      fetch(`${API_BASE}/sales/signals?limit=500`).then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([cts, signals]) => {
        setContacts(cts);
        const grouped: Record<number, Signal[]> = {};
        (signals || []).forEach((sig: Signal) => {
          if (sig.contactId) {
            if (!grouped[sig.contactId]) grouped[sig.contactId] = [];
            grouped[sig.contactId].push(sig);
          }
        });
        setContactSignals(grouped);
      })
      .catch(() => setContacts([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  async function handleDeleteAll() {
    setDeleting(true);
    try {
      await fetch(`${API_BASE}/sales/contacts`, { method: "DELETE" });
      setContacts([]);
      setDeleteConfirm(false);
    } finally {
      setDeleting(false);
    }
  }

  // Unique values for filter dropdowns (derived from loaded contacts)
  const uniqueTiers       = Array.from(new Set(contacts.map(c => c.tier).filter(Boolean))).sort() as string[];
  const uniqueTitleLevels = Array.from(new Set(contacts.map(c => c.titleLevel).filter(Boolean))).sort() as string[];
  const uniqueStages      = Array.from(new Set(contacts.map(c => c.abmStage).filter(Boolean))).sort() as string[];
  const uniqueOwners      = Array.from(new Set(contacts.map(c => c.accountOwner).filter(Boolean))).sort() as string[];

  const isFiltered = !!(search || tierFilter || titleLevelFilter || stageFilter || ownerFilter);

  const filtered = contacts.filter((c) => {
    const q = search.toLowerCase();
    const matchesSearch = !search ||
      `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
      (c.email ?? "").toLowerCase().includes(q) ||
      (c.title ?? "").toLowerCase().includes(q) ||
      (c.accountName ?? "").toLowerCase().includes(q);
    const matchesTier       = !tierFilter       || c.tier === tierFilter;
    const matchesTitleLevel = !titleLevelFilter || c.titleLevel === titleLevelFilter;
    const matchesStage      = !stageFilter      || c.abmStage === stageFilter;
    const matchesOwner      = !ownerFilter      || c.accountOwner === ownerFilter;
    return matchesSearch && matchesTier && matchesTitleLevel && matchesStage && matchesOwner;
  });

  function clearFilters() { setSearch(""); setTierFilter(""); setTitleLevelFilter(""); setStageFilter(""); setOwnerFilter(""); }

  const audienceName = [
    tierFilter, titleLevelFilter, stageFilter, ownerFilter, search ? `"${search}"` : "",
  ].filter(Boolean).join(" · ") || "Filtered Contacts";

  const accountGroups = useMemo(() => {
    const groups = new Map<number, { accountId: number; accountName: string; abmTier: string | null; abmStage: string | null; contacts: Contact[] }>();
    for (const c of filtered) {
      const key = c.accountId;
      if (!groups.has(key)) {
        groups.set(key, { accountId: key, accountName: c.accountName ?? "Unknown Account", abmTier: c.abmTier ?? null, abmStage: c.abmStage ?? null, contacts: [] });
      }
      groups.get(key)!.contacts.push(c);
    }
    return Array.from(groups.values()).sort((a, b) => a.accountName.localeCompare(b.accountName));
  }, [filtered]);

  const flatPag = usePagination(filtered, 25);
  const groupedPag = usePagination(accountGroups, 20);

  return (
    <SalesLayout>
      <div className="flex flex-col gap-6 pb-12">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Contacts</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {contacts.length} contact{contacts.length !== 1 ? "s" : ""} across your accounts
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex items-center rounded-lg border border-input bg-background overflow-hidden">
              <button
                onClick={() => setViewMode("list")}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${viewMode === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                title="Flat list"
              >
                <List className="w-3.5 h-3.5" />
                List
              </button>
              <button
                onClick={() => setViewMode("grouped")}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${viewMode === "grouped" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                title="Group by account"
              >
                <LayoutList className="w-3.5 h-3.5" />
                By Account
              </button>
            </div>
            {deleteConfirm ? (
              <>
                <span className="text-sm text-muted-foreground">Delete all {contacts.length} contacts?</span>
                <Button variant="destructive" size="sm" disabled={deleting} onClick={handleDeleteAll} className="gap-1.5">
                  {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  {deleting ? "Deleting…" : "Confirm"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setDeleteConfirm(false)}>Cancel</Button>
              </>
            ) : (
              <>
                {contacts.length > 0 && (
                  <Button variant="outline" size="sm" onClick={() => setDeleteConfirm(true)} className="gap-1.5 text-destructive hover:text-destructive hover:border-destructive/50">
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete All
                  </Button>
                )}
                <Button onClick={() => setShowImport(true)} className="gap-2">
                  <Upload className="w-4 h-4" />
                  Import CSV
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Search + Filters */}
        <div className="flex flex-col gap-2">
          {/* Row 1: search + primary filters */}
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, title, account…" className="pl-10" />
            </div>
            {/* Tier (ENT / IW / LENT / STRAT) */}
            {uniqueTiers.length > 0 && (
              <div className="relative">
                <select value={tierFilter} onChange={(e) => setTierFilter(e.target.value)}
                  className="h-10 appearance-none pl-3 pr-8 rounded-md border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                  <option value="">All Tiers</option>
                  {uniqueTiers.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              </div>
            )}
            {/* Title Level (C Suite, VP, etc.) */}
            {uniqueTitleLevels.length > 0 && (
              <div className="relative">
                <select value={titleLevelFilter} onChange={(e) => setTitleLevelFilter(e.target.value)}
                  className="h-10 appearance-none pl-3 pr-8 rounded-md border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                  <option value="">All Levels</option>
                  {uniqueTitleLevels.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              </div>
            )}
            {/* ABM Stage */}
            {uniqueStages.length > 0 && (
              <div className="relative">
                <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}
                  className="h-10 appearance-none pl-3 pr-8 rounded-md border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                  <option value="">All Stages</option>
                  {uniqueStages.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              </div>
            )}
            {/* Account Owner */}
            {uniqueOwners.length > 0 && (
              <div className="relative">
                <select value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)}
                  className="h-10 appearance-none pl-3 pr-8 rounded-md border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                  <option value="">All Owners</option>
                  {uniqueOwners.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              </div>
            )}
          </div>

          {/* Active filter bar */}
          {isFiltered && (
            <div className="flex items-center justify-between px-3 py-2 bg-primary/5 border border-primary/15 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Filter className="w-3.5 h-3.5 shrink-0" />
                <span>{filtered.length} contact{filtered.length !== 1 ? "s" : ""} match your filters</span>
                <button onClick={clearFilters} className="text-xs text-primary hover:underline ml-1">Clear all</button>
              </div>
              {filtered.length > 0 && (
                <Button size="sm" variant="outline" onClick={() => setShowAudience(true)} className="gap-1.5 border-primary/30 text-primary hover:bg-primary/5 shrink-0">
                  <UsersRound className="w-3.5 h-3.5" />
                  Save as Audience
                </Button>
              )}
            </div>
          )}
        </div>

        {/* List / Grouped */}
        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-[64px] rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="flex flex-col items-center justify-center gap-4 p-10 rounded-2xl border border-dashed border-border text-center">
            <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center">
              <Users className="w-6 h-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold text-foreground">
                {isFiltered ? "No contacts match your filters" : "No contacts yet"}
              </p>
              <p className="text-sm text-muted-foreground mt-0.5">
                {isFiltered ? "Try adjusting your filters" : "Import a CSV or add contacts from an account page"}
              </p>
            </div>
            {isFiltered ? (
              <Button variant="outline" onClick={clearFilters}>Clear Filters</Button>
            ) : (
              <Button onClick={() => setShowImport(true)} className="gap-2">
                <Upload className="w-4 h-4" />Import CSV
              </Button>
            )}
          </Card>
        ) : viewMode === "grouped" ? (
          /* ── Grouped by Account ── */
          <div className="flex flex-col gap-5">
            {groupedPag.pageItems.map(({ accountId, accountName, abmTier, abmStage, contacts: groupContacts }) => (
              <div key={accountId} className="flex flex-col gap-1.5">
                {/* Account header */}
                <Link href={`/sales/accounts/${accountId}`}>
                  <div className="flex items-center gap-2.5 px-1 py-1 rounded-lg hover:bg-muted/40 cursor-pointer transition-colors group/acct">
                    <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Building2 className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <span className="font-semibold text-sm text-foreground group-hover/acct:text-primary transition-colors">
                      {accountName}
                    </span>
                    {abmTier && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${TIER_COLORS[abmTier] ?? "bg-muted text-muted-foreground"}`}>
                        {abmTier}
                      </span>
                    )}
                    {abmStage && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${STAGE_COLORS[abmStage] ?? "bg-muted text-muted-foreground"}`}>
                        {abmStage}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground ml-1">{groupContacts.length} contact{groupContacts.length !== 1 ? "s" : ""}</span>
                    <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover/acct:opacity-100 transition-opacity ml-auto" />
                  </div>
                </Link>
                {/* Contact rows */}
                {groupContacts.map((contact) => {
                  const engagementScore = getEngagementScore(contactSignals[contact.id] || []);
                  const indicatorColor = engagementScore.label === "Hot" ? "bg-red-500" : engagementScore.label === "Warm" ? "bg-amber-500" : engagementScore.label === "Cool" ? "bg-blue-500" : "bg-slate-300";
                  return (
                    <div
                      key={contact.id}
                      onClick={() => navigate(`/sales/contacts/${contact.id}`)}
                      className="group/row flex items-center gap-3 pl-10 pr-5 py-2.5 bg-card border border-border/60 rounded-xl hover:border-primary/25 transition-all cursor-pointer"
                    >
                      <div className={`flex-shrink-0 w-1.5 h-1.5 rounded-full ${indicatorColor}`} />
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-[11px] font-bold text-primary uppercase">
                        {contact.firstName[0]}{contact.lastName[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-sm font-semibold text-foreground">{contact.firstName} {contact.lastName}</p>
                          {contact.contactRole && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium hidden md:inline">{contact.contactRole}</span>
                          )}
                          {contact.titleLevel && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/70 text-muted-foreground font-medium hidden lg:inline">{contact.titleLevel}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          {contact.title && <span>{contact.title}</span>}
                          {contact.email && <span className="flex items-center gap-0.5"><Mail className="w-3 h-3" />{contact.email}</span>}
                        </div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); setDraftContact(contact); }}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-primary/20 hover:border-primary/50 hover:bg-primary/5 text-primary text-xs font-medium transition-all shrink-0"
                        title="Draft AI email"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Draft Email</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}
            <PaginationBar
              page={groupedPag.page} totalPages={groupedPag.totalPages}
              from={groupedPag.from} to={groupedPag.to} total={groupedPag.total}
              onPage={groupedPag.setPage} label="accounts"
            />
          </div>
        ) : (
          /* ── Flat List ── */
          <div className="flex flex-col gap-2">
            {flatPag.pageItems.map((contact) => {

              const engagementScore = getEngagementScore(contactSignals[contact.id] || []);
              const indicatorColor = engagementScore.label === "Hot" ? "bg-red-500" :
                                    engagementScore.label === "Warm" ? "bg-amber-500" :
                                    engagementScore.label === "Cool" ? "bg-blue-500" :
                                    "bg-slate-300";
              return (
                <div
                  key={contact.id}
                  onClick={() => navigate(`/sales/contacts/${contact.id}`)}
                  className="group flex items-center gap-4 px-5 py-3.5 bg-card border border-border/60 rounded-xl hover:border-primary/25 transition-all cursor-pointer"
                >
                  <div className={`flex-shrink-0 w-2 h-2 rounded-full ${indicatorColor}`} />
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary uppercase">
                    {contact.firstName[0]}{contact.lastName[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                      {contact.firstName} {contact.lastName}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {contact.title && <span>{contact.title}</span>}
                      {contact.accountName && (
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3 h-3" />
                          {contact.accountName}
                        </span>
                      )}
                      {contact.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {contact.email}
                        </span>
                      )}
                    </div>
                  </div>
                  {contact.contactRole && (
                    <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-muted text-muted-foreground">
                      {contact.contactRole}
                    </span>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); setDraftContact(contact); }}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-primary/20 hover:border-primary/50 hover:bg-primary/5 text-primary text-xs font-medium transition-all shrink-0"
                    title="Draft AI email"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Draft Email</span>
                  </button>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {format(new Date(contact.createdAt), "MMM d")}
                  </span>
                </div>
              );
            })}
            <PaginationBar
              page={flatPag.page} totalPages={flatPag.totalPages}
              from={flatPag.from} to={flatPag.to} total={flatPag.total}
              onPage={flatPag.setPage} label="contacts"
            />
          </div>
        )}
      </div>

      <CsvImportModal
        open={showImport}
        onClose={() => setShowImport(false)}
        onImported={fetchContacts}
      />

      <SaveAudienceModal
        open={showAudience}
        onClose={() => setShowAudience(false)}
        contactIds={filtered.map((c) => c.id)}
        defaultName={audienceName}
      />

      {draftContact && (
        <DraftEmailModal
          contact={draftContact}
          accountId={draftContact.accountId}
          accountName={draftContact.accountName ?? ""}
          onClose={() => setDraftContact(null)}
        />
      )}
    </SalesLayout>
  );
}

/* ─── Contact Detail View ────────────────────────────────────── */

function ContactDetailView({ id }: { id: string }) {
  const [, navigate] = useLocation();
  const [contact, setContact] = useState<Contact | null>(null);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [hotlinks, setHotlinks] = useState<Hotlink[]>([]);
  const [loading, setLoading] = useState(true);
  const [accountName, setAccountName] = useState<string>("");

  const fetchData = useCallback(() => {
    Promise.all([
      fetch(`${API_BASE}/sales/contacts/${id}`).then((r) => (r.ok ? r.json() : null)),
      fetch(`${API_BASE}/sales/signals?contactId=${id}&limit=30`).then((r) => (r.ok ? r.json() : [])),
    ])
      .then(async ([ct, sigs]) => {
        setContact(ct);
        setSignals(sigs ?? []);
        // Fetch account name
        if (ct?.accountId) {
          try {
            const acct = await fetch(`${API_BASE}/sales/accounts/${ct.accountId}`).then((r) => r.ok ? r.json() : null);
            if (acct) setAccountName(acct.name);
          } catch {}
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <SalesLayout>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-8 w-48 rounded-lg" />
          <Skeleton className="h-[200px] rounded-2xl" />
          <Skeleton className="h-[300px] rounded-2xl" />
        </div>
      </SalesLayout>
    );
  }

  if (!contact) {
    return (
      <SalesLayout>
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <p className="text-lg font-semibold text-foreground">Contact not found</p>
          <Button variant="outline" onClick={() => navigate("/sales/contacts")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Contacts
          </Button>
        </div>
      </SalesLayout>
    );
  }

  return (
    <SalesLayout>
      <div className="flex flex-col gap-6 pb-12">

        {/* Back + Header */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg"
            onClick={() => navigate("/sales/contacts")}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-lg font-bold text-primary uppercase">
                {contact.firstName[0]}{contact.lastName[0]}
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-display font-bold text-foreground">
                    {contact.firstName} {contact.lastName}
                  </h1>
                  {(() => {
                    const engagementScore = getEngagementScore(signals);
                    return (
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${engagementScore.color}`}>
                        {engagementScore.label === "No activity" ? engagementScore.label : `${engagementScore.label} (${engagementScore.score})`}
                      </span>
                    );
                  })()}
                </div>
                <div className="flex items-center gap-3 text-sm text-muted-foreground mt-0.5">
                  {contact.title && <span>{contact.title}</span>}
                  {contact.role && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-muted text-muted-foreground">
                      {contact.role}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Contact Info Card */}
        <Card className="p-5 rounded-2xl border border-border/60">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Contact Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {contact.email && (
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Email</p>
                  <p className="text-sm text-foreground">{contact.email}</p>
                </div>
              </div>
            )}
            {contact.phone && (
              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Phone</p>
                  <p className="text-sm text-foreground">{contact.phone}</p>
                </div>
              </div>
            )}
            {accountName && (
              <div className="flex items-center gap-3">
                <Building2 className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Account</p>
                  <Link
                    href={`/sales/accounts/${contact.accountId}`}
                    className="text-sm text-primary hover:underline"
                  >
                    {accountName}
                  </Link>
                </div>
              </div>
            )}
            <div className="flex items-center gap-3">
              <Activity className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Status</p>
                <p className="text-sm text-foreground capitalize">{contact.status}</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Engagement Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Page Views", count: signals.filter(s => s.type === "page_view").length, color: "text-blue-500" },
            { label: "Email Opens", count: signals.filter(s => s.type === "email_open").length, color: "text-amber-500" },
            { label: "Email Clicks", count: signals.filter(s => s.type === "email_click").length, color: "text-emerald-500" },
            { label: "Form Submits", count: signals.filter(s => s.type === "form_submit").length, color: "text-purple-500" },
          ].map((stat) => (
            <Card key={stat.label} className="p-4 rounded-xl border border-border/60">
              <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">{stat.label}</p>
              <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.count}</p>
            </Card>
          ))}
        </div>

        {/* Engagement History */}
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-display font-bold text-foreground">Engagement History</h2>
          {signals.length === 0 ? (
            <Card className="flex items-center gap-4 p-5 rounded-2xl border border-dashed border-border">
              <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center">
                <Activity className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="font-semibold text-foreground text-sm">No engagement yet</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Signals will appear here when this contact interacts with microsites and emails
                </p>
              </div>
            </Card>
          ) : (
            <div className="flex flex-col gap-2">
              {signals.map((signal) => {
                const config = signalConfig[signal.type] ?? { icon: Activity, label: signal.type, color: "text-muted-foreground" };
                const Icon = config.icon;
                return (
                  <div key={signal.id} className="flex items-start gap-3 px-4 py-3 bg-card border border-border/60 rounded-xl">
                    <div className={`mt-0.5 ${config.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{config.label}</p>
                      {signal.source && (
                        <p className="text-xs text-muted-foreground mt-0.5">{signal.source}</p>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {format(new Date(signal.createdAt), "MMM d, h:mm a")}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </SalesLayout>
  );
}

/* ─── Route Handler ──────────────────────────────────────────── */

export default function SalesContacts() {
  const [matchDetail, params] = useRoute("/sales/contacts/:id");

  if (matchDetail && params?.id) {
    return <ContactDetailView id={params.id} />;
  }

  return <ContactListView />;
}
