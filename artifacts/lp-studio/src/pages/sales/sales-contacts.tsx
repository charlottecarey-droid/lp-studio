import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "wouter";
import { format } from "date-fns";
import {
  Users,
  Search,
  Mail,
  Building2,
  Upload,
  X,
  ChevronDown,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  FileText,
  Loader2,
  Trash2,
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

const API_BASE = "/api";

interface Contact {
  id: number;
  accountId: number;
  firstName: string;
  lastName: string;
  email: string | null;
  title: string | null;
  role: string | null;
  status: string;
  createdAt: string;
  accountName?: string;
}

// ─── CSV Parser ────────────────────────────────────────────────
// Handles quoted fields (including commas and newlines inside quotes)
function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "\n" && !inQuotes) {
      lines.push(current);
      current = "";
    } else if (ch === "\r" && !inQuotes) {
      // skip \r
    } else {
      current += ch;
    }
  }
  if (current.trim()) lines.push(current);

  function splitRow(line: string): string[] {
    const cells: string[] = [];
    let cell = "";
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (q && line[i + 1] === '"') { cell += '"'; i++; }
        else q = !q;
      } else if (ch === "," && !q) {
        cells.push(cell.trim());
        cell = "";
      } else {
        cell += ch;
      }
    }
    cells.push(cell.trim());
    return cells;
  }

  const [headerLine, ...dataLines] = lines;
  const headers = splitRow(headerLine ?? "");
  const rows = dataLines
    .filter((l) => l.trim())
    .map(splitRow);

  return { headers, rows };
}

// ─── Column mapping ────────────────────────────────────────────
type TargetField =
  // Contact core
  | "firstName"
  | "lastName"
  | "email"
  | "title"
  | "role"
  | "phone"
  | "sfdcContactId"
  // Contact ABM / enrichment
  | "tier"
  | "titleLevel"
  | "contactRole"
  | "department"
  | "linkedinUrl"
  // Account linking
  | "accountName"
  | "sfdcAccountId"
  | "accountOwner"
  | "accountAddress"
  | "accountCity"
  | "accountState"
  | "accountZip"
  | "accountCountry"
  | "accountDomain"
  | "accountSegment"
  | "accountIndustry"
  // Account ABM / enrichment
  | "accountAbmTier"
  | "accountAbmStage"
  | "accountPracticeSegment"
  | "accountNumLocations"
  | "accountMsaSigned"
  | "accountEnterprisePilot"
  | "accountDsoSize"
  | "accountPrivateEquityFirm"
  | "(skip)";

const TARGET_FIELDS: { value: TargetField; label: string; group?: string; required?: boolean }[] = [
  { value: "(skip)", label: "— Skip this column —" },
  // Contact — core
  { value: "firstName", label: "First Name", group: "Contact", required: true },
  { value: "lastName", label: "Last Name", group: "Contact", required: true },
  { value: "email", label: "Email", group: "Contact" },
  { value: "title", label: "Job Title", group: "Contact" },
  { value: "role", label: "Buyer Role", group: "Contact" },
  { value: "phone", label: "Phone / Direct Dial", group: "Contact" },
  { value: "sfdcContactId", label: "SFDC Contact ID", group: "Contact" },
  // Contact — ABM enrichment
  { value: "tier", label: "Contact Tier (ENT/IW/LENT)", group: "Contact" },
  { value: "titleLevel", label: "Title Level (C Suite, VP…)", group: "Contact" },
  { value: "contactRole", label: "Contact Role (CEO/President…)", group: "Contact" },
  { value: "department", label: "Department", group: "Contact" },
  { value: "linkedinUrl", label: "LinkedIn URL", group: "Contact" },
  // Account — core
  { value: "accountName", label: "Account Name", group: "Account" },
  { value: "sfdcAccountId", label: "SFDC Account ID", group: "Account" },
  { value: "accountOwner", label: "Account Owner", group: "Account" },
  { value: "accountDomain", label: "Account Domain", group: "Account" },
  { value: "accountSegment", label: "Account Segment", group: "Account" },
  { value: "accountIndustry", label: "Account Industry", group: "Account" },
  { value: "accountAddress", label: "Address", group: "Account" },
  { value: "accountCity", label: "City", group: "Account" },
  { value: "accountState", label: "State", group: "Account" },
  { value: "accountZip", label: "Zip / Postal Code", group: "Account" },
  { value: "accountCountry", label: "Country", group: "Account" },
  // Account — ABM enrichment
  { value: "accountAbmTier", label: "ABM Org Tier (Tier 1/2/3)", group: "Account" },
  { value: "accountAbmStage", label: "ABM Org Stage (Mapped, Engaged…)", group: "Account" },
  { value: "accountPracticeSegment", label: "Practice Profile Segment", group: "Account" },
  { value: "accountNumLocations", label: "Number of Locations", group: "Account" },
  { value: "accountMsaSigned", label: "Enterprise MSA Signed", group: "Account" },
  { value: "accountEnterprisePilot", label: "Enterprise Pilot", group: "Account" },
  { value: "accountDsoSize", label: "DSO Size", group: "Account" },
  { value: "accountPrivateEquityFirm", label: "Private Equity Firm", group: "Account" },
];

const AUTO_MAP: Record<string, TargetField> = {
  // Contact name
  "first name": "firstName",
  first_name: "firstName",
  firstname: "firstName",
  first: "firstName",
  "last name": "lastName",
  last_name: "lastName",
  lastname: "lastName",
  last: "lastName",
  "full name": "(skip)",  // skip — we use first+last separately
  full_name: "(skip)",
  // Contact info
  email: "email",
  "email address": "email",
  email_address: "email",
  "e-mail": "email",
  "job title": "title",
  job_title: "title",
  title: "title",
  position: "title",
  role: "role",
  "buyer role": "role",
  buyer_role: "role",
  phone: "phone",
  mobile: "phone",
  telephone: "phone",
  "phone number": "phone",
  "direct dial": "phone",
  direct_dial: "phone",
  // SFDC IDs
  "contact id": "sfdcContactId",
  contact_id: "sfdcContactId",
  salesforce_contact_id: "sfdcContactId",
  sfdc_contact_id: "sfdcContactId",
  "sfdc contact id": "sfdcContactId",
  "salesforce contact id": "sfdcContactId",
  "salesforce id": "sfdcAccountId",  // this CSV uses "Salesforce ID" for the account ID
  salesforce_id: "sfdcAccountId",
  "account id": "sfdcAccountId",
  account_id: "sfdcAccountId",
  accountid: "sfdcAccountId",
  salesforce_account_id: "sfdcAccountId",
  sfdc_account_id: "sfdcAccountId",
  "sfdc account id": "sfdcAccountId",
  "salesforce account id": "sfdcAccountId",
  // Contact ABM enrichment
  tier: "tier",
  "contact tier": "tier",
  contact_tier: "tier",
  "title level": "titleLevel",
  title_level: "titleLevel",
  seniority: "titleLevel",
  "contact role": "contactRole",
  contact_role: "contactRole",
  function: "contactRole",
  department: "department",
  "linkedin url": "linkedinUrl",
  linkedin_url: "linkedinUrl",
  linkedin: "linkedinUrl",
  "linkedin profile": "linkedinUrl",
  // Account info
  "account name": "accountName",
  account_name: "accountName",
  accountname: "accountName",
  company: "accountName",
  "company name": "accountName",
  organization: "accountName",
  organisation: "accountName",
  account: "accountName",
  "account owner": "accountOwner",
  account_owner: "accountOwner",
  owner: "accountOwner",
  "sales rep": "accountOwner",
  sales_rep: "accountOwner",
  rep: "accountOwner",
  address: "accountAddress",
  "billing street": "accountAddress",
  billing_street: "accountAddress",
  street: "accountAddress",
  "mailing street": "accountAddress",
  city: "accountCity",
  "billing city": "accountCity",
  billing_city: "accountCity",
  state: "accountState",
  "billing state": "accountState",
  billing_state: "accountState",
  province: "accountState",
  zip: "accountZip",
  "zip code": "accountZip",
  "postal code": "accountZip",
  "billing zip": "accountZip",
  billing_zip: "accountZip",
  country: "accountCountry",
  "billing country": "accountCountry",
  billing_country: "accountCountry",
  domain: "accountDomain",
  website: "accountDomain",
  "account domain": "accountDomain",
  account_domain: "accountDomain",
  segment: "accountSegment",
  "account segment": "accountSegment",
  account_segment: "accountSegment",
  industry: "accountIndustry",
  "account industry": "accountIndustry",
  account_industry: "accountIndustry",
  // Account ABM enrichment
  "abm org tier": "accountAbmTier",
  abm_org_tier: "accountAbmTier",
  "abm tier": "accountAbmTier",
  abm_tier: "accountAbmTier",
  "abm org stage": "accountAbmStage",
  abm_org_stage: "accountAbmStage",
  "abm stage": "accountAbmStage",
  abm_stage: "accountAbmStage",
  "practice profile segment": "accountPracticeSegment",
  practice_profile_segment: "accountPracticeSegment",
  "practice segment": "accountPracticeSegment",
  "number of practice locations": "accountNumLocations",
  number_of_practice_locations: "accountNumLocations",
  "# locations": "accountNumLocations",
  locations: "accountNumLocations",
  "enterprise msa signed": "accountMsaSigned",
  enterprise_msa_signed: "accountMsaSigned",
  "msa signed": "accountMsaSigned",
  msa_signed: "accountMsaSigned",
  "enterprise pilot": "accountEnterprisePilot",
  enterprise_pilot: "accountEnterprisePilot",
  pilot: "accountEnterprisePilot",
  "dso size": "accountDsoSize",
  dso_size: "accountDsoSize",
  "org size": "accountDsoSize",
  "private equity firm": "accountPrivateEquityFirm",
  private_equity_firm: "accountPrivateEquityFirm",
  "pe firm": "accountPrivateEquityFirm",
  pe_firm: "accountPrivateEquityFirm",
  "private equity": "accountPrivateEquityFirm",
  "equity firm": "accountPrivateEquityFirm",
  "investor": "accountPrivateEquityFirm",
};

function autoDetectMapping(headers: string[]): TargetField[] {
  return headers.map((h) => AUTO_MAP[h.toLowerCase().trim()] ?? "(skip)");
}

// ─── CSV Import Modal ──────────────────────────────────────────
interface ImportResult {
  created: number;
  skipped: number;
  errors: Array<{ row: number; message: string }>;
  total: number;
}

type ImportStep = "upload" | "map" | "preview" | "result";

function CsvImportModal({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}) {
  const [step, setStep] = useState<ImportStep>("upload");
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<TargetField[]>([]);
  const [importing, setImporting] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setStep("upload");
    setDragging(false);
    setFileName("");
    setHeaders([]);
    setRows([]);
    setMapping([]);
    setImporting(false);
    setResult(null);
    setParseError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function processText(text: string, name: string) {
    setParseError(null);
    try {
      const parsed = parseCsv(text);
      if (parsed.headers.length === 0) {
        setParseError("Could not detect columns. Make sure the file has a header row.");
        return;
      }
      if (parsed.rows.length === 0) {
        setParseError("No data rows found in the file.");
        return;
      }
      setFileName(name);
      setHeaders(parsed.headers);
      setRows(parsed.rows);
      setMapping(autoDetectMapping(parsed.headers));
      setStep("map");
    } catch {
      setParseError("Failed to parse the file. Make sure it is a valid CSV.");
    }
  }

  function handleFile(file: File) {
    if (!file.name.endsWith(".csv") && file.type !== "text/csv") {
      setParseError("Please upload a .csv file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => processText(e.target?.result as string, file.name);
    reader.readAsText(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  // Build mapped rows for preview/import
  function buildMappedRows() {
    return rows.map((row) => {
      const obj: Record<string, string> = {};
      headers.forEach((_, i) => {
        const target = mapping[i];
        if (target && target !== "(skip)") {
          obj[target] = row[i] ?? "";
        }
      });
      return obj;
    });
  }

  const mappedRows = step === "preview" || step === "result" ? buildMappedRows() : [];
  const previewRows = mappedRows.slice(0, 5);

  const hasFirstName = mapping.includes("firstName");
  const hasLastName = mapping.includes("lastName");
  const hasAccount = mapping.includes("accountName") || mapping.includes("sfdcAccountId");
  const canProceed = hasFirstName && hasLastName && hasAccount;

  const BATCH_SIZE = 100;

  async function handleImport() {
    setImporting(true);
    setBatchProgress(null);
    const allMapped = buildMappedRows();
    const batches: Record<string, string>[][] = [];
    for (let i = 0; i < allMapped.length; i += BATCH_SIZE) {
      batches.push(allMapped.slice(i, i + BATCH_SIZE));
    }

    const totals: ImportResult = { created: 0, skipped: 0, errors: [], total: allMapped.length };

    try {
      for (let b = 0; b < batches.length; b++) {
        setBatchProgress({ done: b * BATCH_SIZE, total: allMapped.length });
        const res = await fetch(`${API_BASE}/sales/import/contacts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows: batches[b] }),
        });
        const data = await res.json() as { summary: { created: number; updated: number; skipped: number; errors: { row: number; reason: string }[] } };
        totals.created += data.summary?.created ?? 0;
        totals.skipped += (data.summary?.skipped ?? 0) + (data.summary?.updated ?? 0);
        if (data.summary?.errors?.length) {
          totals.errors.push(...data.summary.errors.map(e => ({ row: e.row + b * BATCH_SIZE, message: e.reason })));
        }
      }
      setBatchProgress({ done: allMapped.length, total: allMapped.length });
      setResult(totals);
      setStep("result");
      if (totals.created > 0) onImported();
    } finally {
      setImporting(false);
      setBatchProgress(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-2xl max-h-[88vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
              <Upload className="w-3.5 h-3.5 text-primary" />
            </div>
            Import Contacts from CSV
          </DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {(["upload", "map", "preview", "result"] as ImportStep[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              {i > 0 && <ArrowRight className="w-3 h-3 opacity-40" />}
              <span className={step === s ? "text-primary font-semibold" : ""}>
                {s === "upload" ? "Upload" : s === "map" ? "Map Columns" : s === "preview" ? "Preview" : "Done"}
              </span>
            </div>
          ))}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">

          {/* ── Step 1: Upload ── */}
          {step === "upload" && (
            <div className="space-y-4 py-2">
              <div
                className={`relative flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-10 transition-colors cursor-pointer ${
                  dragging
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/40 hover:bg-muted/30"
                }`}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={handleFileInput}
                />
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-primary" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-foreground">Drop a CSV file here</p>
                  <p className="text-xs text-muted-foreground mt-1">or click to browse your files</p>
                </div>
                <Button variant="outline" size="sm" className="pointer-events-none">
                  Choose file
                </Button>
              </div>

              {parseError && (
                <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  {parseError}
                </div>
              )}

              <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Supported columns (auto-detected)</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Salesforce, HubSpot, and custom export formats are supported. Column names are flexible — you can re-map anything manually in the next step.
                </p>
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Contact</p>
                  <div className="flex flex-wrap gap-1.5">
                    {["First Name", "Last Name", "Email", "Job Title", "Buyer Role", "Phone / Direct Dial", "SFDC Contact ID", "Contact Tier", "Title Level", "Contact Role", "Department", "LinkedIn URL"].map((f) => (
                      <span key={f} className="text-[11px] px-2 py-0.5 rounded bg-muted text-muted-foreground font-medium">{f}</span>
                    ))}
                  </div>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider pt-1">Account</p>
                  <div className="flex flex-wrap gap-1.5">
                    {["Account Name", "SFDC Account ID", "Account Owner", "Domain", "Segment", "Industry", "ABM Org Tier", "ABM Org Stage", "Practice Profile Segment", "# Locations", "MSA Signed", "Enterprise Pilot", "DSO Size", "Private Equity Firm", "Address", "City", "State", "Zip", "Country"].map((f) => (
                      <span key={f} className="text-[11px] px-2 py-0.5 rounded bg-muted text-muted-foreground font-medium">{f}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Step 2: Map columns ── */}
          {step === "map" && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileText className="w-4 h-4" />
                <span className="font-medium text-foreground truncate">{fileName}</span>
                <span>— {rows.length} rows detected</span>
              </div>

              {!canProceed && (
                <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>
                    Map <strong>First Name</strong>, <strong>Last Name</strong>, and <strong>Account Name</strong> (or SFDC Account ID) to continue.
                  </span>
                </div>
              )}

              <div className="rounded-xl border border-border overflow-hidden">
                <div className="grid grid-cols-2 gap-0 px-4 py-2 bg-muted/50 border-b border-border">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">CSV Column</span>
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Map to Field</span>
                </div>
                <div className="divide-y divide-border max-h-72 overflow-y-auto">
                  {headers.map((header, i) => (
                    <div key={i} className="grid grid-cols-2 gap-4 px-4 py-2.5 items-center hover:bg-muted/20">
                      <span className="text-sm text-foreground font-medium truncate">{header}</span>
                      <div className="relative">
                        <select
                          className="w-full appearance-none pl-3 pr-8 py-1.5 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                          value={mapping[i] ?? "(skip)"}
                          onChange={(e) => {
                            const next = [...mapping];
                            next[i] = e.target.value as TargetField;
                            setMapping(next);
                          }}
                        >
                          <option value="(skip)">— Skip this column —</option>
                          <optgroup label="── Contact ──">
                            {TARGET_FIELDS.filter(f => f.group === "Contact").map((f) => (
                              <option key={f.value} value={f.value}>{f.label}{f.required ? " *" : ""}</option>
                            ))}
                          </optgroup>
                          <optgroup label="── Account ──">
                            {TARGET_FIELDS.filter(f => f.group === "Account").map((f) => (
                              <option key={f.value} value={f.value}>{f.label}</option>
                            ))}
                          </optgroup>
                        </select>
                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  disabled={!canProceed}
                  onClick={() => setStep("preview")}
                  className="gap-2"
                >
                  Preview Import
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" onClick={reset}>Start over</Button>
              </div>
            </div>
          )}

          {/* ── Step 3: Preview ── */}
          {step === "preview" && (
            <div className="space-y-4 py-2">
              <div className="text-sm text-muted-foreground">
                Showing first {Math.min(5, rows.length)} of <strong className="text-foreground">{rows.length}</strong> rows.
                {rows.length > 5 && " All rows will be imported."}
              </div>

              <div className="rounded-xl border border-border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/50 border-b border-border">
                        {["First Name", "Last Name", "Email", "Title", "SFDC Contact ID", "Account", "SFDC Account ID", "Owner"].map((h) => (
                          <th key={h} className="text-left px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {previewRows.map((row, i) => (
                        <tr key={i} className="hover:bg-muted/20">
                          <td className="px-3 py-2 text-foreground">{row.firstName || <span className="text-red-400 italic">missing</span>}</td>
                          <td className="px-3 py-2 text-foreground">{row.lastName || <span className="text-red-400 italic">missing</span>}</td>
                          <td className="px-3 py-2 text-muted-foreground">{row.email || "—"}</td>
                          <td className="px-3 py-2 text-muted-foreground">{row.title || "—"}</td>
                          <td className="px-3 py-2 text-muted-foreground font-mono text-[11px]">{row.sfdcContactId || "—"}</td>
                          <td className="px-3 py-2 text-foreground font-medium">{row.accountName || <span className="text-muted-foreground">—</span>}</td>
                          <td className="px-3 py-2 text-muted-foreground font-mono text-[11px]">{row.sfdcAccountId || "—"}</td>
                          <td className="px-3 py-2 text-muted-foreground">{row.accountOwner || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-semibold text-foreground text-sm">What will happen</p>
                <ul className="space-y-0.5 list-disc list-inside">
                  <li>Accounts that don't exist yet will be <strong className="text-foreground">created automatically</strong></li>
                  <li>Existing accounts (matched by <strong className="text-foreground">Salesforce ID</strong>) will be updated — not duplicated</li>
                  <li>Contacts with the same email at the same account will be <strong className="text-foreground">skipped</strong></li>
                </ul>
              </div>

              <div className="flex items-center gap-3">
                <Button onClick={handleImport} disabled={importing} className="gap-2">
                  {importing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Importing {rows.length} rows…
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5" />
                      Import {rows.length} rows
                    </>
                  )}
                </Button>
                <Button variant="ghost" onClick={() => setStep("map")}>
                  Back to mapping
                </Button>
              </div>
            </div>
          )}

          {/* ── Step 4: Result ── */}
          {step === "result" && result && (
            <div className="space-y-4 py-2">
              <div className="rounded-xl border border-border overflow-hidden">
                <div className="grid grid-cols-3 divide-x divide-border">
                  <div className="flex flex-col items-center justify-center gap-1 p-5">
                    <span className="text-3xl font-bold text-emerald-600">{result.created}</span>
                    <span className="text-xs text-muted-foreground font-medium">Created</span>
                  </div>
                  <div className="flex flex-col items-center justify-center gap-1 p-5">
                    <span className="text-3xl font-bold text-muted-foreground">{result.skipped}</span>
                    <span className="text-xs text-muted-foreground font-medium">Skipped (duplicates)</span>
                  </div>
                  <div className="flex flex-col items-center justify-center gap-1 p-5">
                    <span className={`text-3xl font-bold ${result.errors.length > 0 ? "text-red-500" : "text-muted-foreground"}`}>
                      {result.errors.length}
                    </span>
                    <span className="text-xs text-muted-foreground font-medium">Errors</span>
                  </div>
                </div>
              </div>

              {result.created > 0 && (
                <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  {result.created} contact{result.created !== 1 ? "s" : ""} and their accounts are now in your CRM.
                </div>
              )}

              {result.errors.length > 0 && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 space-y-1 max-h-40 overflow-y-auto">
                  <p className="text-xs font-semibold text-red-700 uppercase tracking-wider mb-2">Errors</p>
                  {result.errors.map((e) => (
                    <div key={e.row} className="flex items-start gap-2 text-xs text-red-700">
                      <span className="font-medium shrink-0">Row {e.row}:</span>
                      <span>{e.message}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-3">
                <Button onClick={handleClose}>Done</Button>
                <Button variant="ghost" onClick={reset}>Import another file</Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Contacts Page ─────────────────────────────────────────────

export default function SalesContacts() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchContacts = useCallback(() => {
    setLoading(true);
    fetch(`${API_BASE}/sales/contacts`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setContacts)
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

  const filtered = contacts.filter(
    (c) =>
      `${c.firstName} ${c.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
      (c.email ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (c.title ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <SalesLayout>
      <div className="flex flex-col gap-6 pb-12">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Contacts</h1>
            <p className="text-sm text-muted-foreground mt-1">
              All contacts across your accounts
            </p>
          </div>
          <div className="flex items-center gap-2">
            {deleteConfirm ? (
              <>
                <span className="text-sm text-muted-foreground">Delete all {contacts.length} contacts?</span>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={deleting}
                  onClick={handleDeleteAll}
                  className="gap-1.5"
                >
                  {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  {deleting ? "Deleting…" : "Confirm"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setDeleteConfirm(false)}>Cancel</Button>
              </>
            ) : (
              <>
                {contacts.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeleteConfirm(true)}
                    className="gap-1.5 text-destructive hover:text-destructive hover:border-destructive/50"
                  >
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

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search contacts…"
            className="pl-10"
          />
        </div>

        {/* List */}
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
                {search ? "No contacts match your search" : "No contacts yet"}
              </p>
              <p className="text-sm text-muted-foreground mt-0.5">
                {search ? "Try a different search term" : "Import a CSV or add contacts from an account page"}
              </p>
            </div>
            {!search && (
              <Button onClick={() => setShowImport(true)} className="gap-2">
                <Upload className="w-4 h-4" />
                Import CSV
              </Button>
            )}
          </Card>
        ) : (
          <>
            <p className="text-xs text-muted-foreground -mt-2">
              {filtered.length} contact{filtered.length !== 1 ? "s" : ""}
              {search ? ` matching "${search}"` : ""}
            </p>
            <div className="flex flex-col gap-2">
              {filtered.map((contact) => (
                <div
                  key={contact.id}
                  className="flex items-center gap-4 px-5 py-3.5 bg-card border border-border/60 rounded-xl hover:border-primary/25 transition-all"
                >
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary uppercase">
                    {contact.firstName[0]}{contact.lastName[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                      {contact.firstName} {contact.lastName}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                      {contact.title && <span>{contact.title}</span>}
                      {contact.title && contact.email && <span>·</span>}
                      {contact.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {contact.email}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="hidden md:flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                    {contact.role && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-muted text-muted-foreground">
                        {contact.role}
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-muted-foreground/70">
                      <Building2 className="w-3 h-3" />
                      Account #{contact.accountId}
                    </span>
                    <span>{format(new Date(contact.createdAt), "MMM d")}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <CsvImportModal
        open={showImport}
        onClose={() => setShowImport(false)}
        onImported={fetchContacts}
      />
    </SalesLayout>
  );
}
