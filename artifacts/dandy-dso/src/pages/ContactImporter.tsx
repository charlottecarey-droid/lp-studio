import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Upload, Loader2, Check, AlertTriangle, Database, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import * as XLSX from "xlsx";

type ParsedContact = {
  parentCompany: string;
  firstName: string;
  lastName: string;
  title: string;
  titleLevel: string;
  department: string;
  contactRole: string;
  email: string;
  phone: string;
  linkedinUrl: string;
  gender?: string;
  dsoSize?: string;
  peFirm?: string;
  salesforceId?: string;
  abmStage?: string;
  website?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  segment?: string;
  accountOwner?: string;
};

const FIELD_ALIASES: Record<keyof ParsedContact, string[]> = {
  parentCompany: ["parent company", "parent account", "company", "account name", "parent company name"],
  firstName: ["first name", "first"],
  lastName: ["last name", "last", "surname"],
  title: ["title", "job title", "position"],
  titleLevel: ["title level", "seniority", "level"],
  department: ["department", "function"],
  contactRole: ["contact role", "role"],
  email: ["email", "email address", "work email"],
  phone: ["phone", "phone number", "mobile phone", "mobile"],
  linkedinUrl: ["linkedin url", "linkedin", "linkedin profile"],
  gender: ["gender"],
  dsoSize: ["dso size", "dso size group"],
  peFirm: ["pe firm", "private equity firm", "pe backer"],
  salesforceId: ["salesforce id", "account id", "sfdc id", "sf id", "id"],
  abmStage: ["abm stage", "abm", "stage", "account stage"],
  website: ["website", "website url", "url", "company website", "account website"],
  address: ["address", "street", "street address", "billing street", "mailing street", "address line 1", "address line1"],
  city: ["city", "billing city", "mailing city"],
  state: ["state", "billing state", "mailing state", "state province"],
  zip: ["zip", "zip code", "postal code", "billing zip", "mailing zip", "postal"],
  country: ["country", "billing country", "mailing country"],
  segment: ["segment", "account segment", "tier segment"],
  accountOwner: ["account owner", "owner", "owner name", "rep", "sales rep", "assigned to", "assigned rep"],
};

const EXACT_HEADER_MAP = Object.entries(FIELD_ALIASES).reduce((acc, [field, aliases]) => {
  for (const alias of aliases) acc[alias] = field as keyof ParsedContact;
  return acc;
}, {} as Record<string, keyof ParsedContact>);

const normalizeHeader = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\uFEFF/g, "")
    .toLowerCase()
    .replace(/[_\-./]+/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const splitDelimitedLine = (line: string, delimiter: string) => {
  const parts: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      parts.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  parts.push(current.trim());
  return parts;
};

const maybeExpandDelimitedRows = (rows: Record<string, unknown>[]) => {
  if (!rows.length) return rows;

  const firstKeys = Object.keys(rows[0]);
  if (firstKeys.length !== 1) return rows;

  const onlyHeader = firstKeys[0];
  const delimiter = onlyHeader.includes(";") ? ";" : onlyHeader.includes("\t") ? "\t" : null;
  if (!delimiter) return rows;

  const headers = splitDelimitedLine(onlyHeader, delimiter);
  if (headers.length < 2) return rows;

  return rows.map((row) => {
    const value = String(row[onlyHeader] ?? "");
    const cells = splitDelimitedLine(value, delimiter);
    return headers.reduce<Record<string, unknown>>((acc, header, index) => {
      acc[header] = cells[index] ?? "";
      return acc;
    }, {});
  });
};

const resolveField = (header: string): keyof ParsedContact | null => {
  if (!header) return null;

  const exact = EXACT_HEADER_MAP[header];
  if (exact) return exact;

  for (const [field, aliases] of Object.entries(FIELD_ALIASES) as [keyof ParsedContact, string[]][]) {
    if (aliases.some((alias) => header.startsWith(alias) || alias.startsWith(header))) return field;
  }

  for (const [field, aliases] of Object.entries(FIELD_ALIASES) as [keyof ParsedContact, string[]][]) {
    if (aliases.some((alias) => header.includes(alias) || alias.includes(header))) return field;
  }

  return null;
};

const looksLikeCompanyValue = (value: string) => {
  const text = String(value || "").trim();
  if (!text) return false;
  if (text.includes("@") || text.startsWith("http") || /^\+?[0-9()\-\s]{7,}$/.test(text)) return false;
  return /[a-zA-Z]/.test(text);
};

const rowsToContacts = (rawRows: Record<string, unknown>[]) => {
  const rows = maybeExpandDelimitedRows(rawRows);
  if (!rows.length) return [] as ParsedContact[];

  const headers = Object.keys(rows[0]);
  const mappedHeaders = headers.map((header) => ({
    original: header,
    field: resolveField(normalizeHeader(header)),
  }));

  let fallbackParentCompanyKey: string | null = null;
  if (!mappedHeaders.some((h) => h.field === "parentCompany")) {
    const scored = headers
      .map((header) => {
        const score = rows.slice(0, 100).reduce((sum, row) => {
          const value = String(row[header] ?? "").trim();
          return sum + (looksLikeCompanyValue(value) ? 1 : 0);
        }, 0);
        return { header, score };
      })
      .sort((a, b) => b.score - a.score);

    if (scored[0]?.score >= 2) fallbackParentCompanyKey = scored[0].header;
  }

  const contacts: ParsedContact[] = [];

  for (const row of rows) {
    const contact: Partial<Record<keyof ParsedContact, string>> = {};

    for (const { original, field } of mappedHeaders) {
      if (!field || contact[field]) continue;
      contact[field] = String(row[original] ?? "").trim();
    }

    if (!contact.parentCompany && fallbackParentCompanyKey) {
      contact.parentCompany = String(row[fallbackParentCompanyKey] ?? "").trim();
    }

    if (contact.parentCompany) {
      contacts.push({
        parentCompany: contact.parentCompany || "",
        firstName: contact.firstName || "",
        lastName: contact.lastName || "",
        title: contact.title || "",
        titleLevel: contact.titleLevel || "",
        department: contact.department || "",
        contactRole: contact.contactRole || "",
        email: contact.email || "",
        phone: contact.phone || "",
        linkedinUrl: contact.linkedinUrl || "",
        gender: contact.gender || "",
        dsoSize: contact.dsoSize || "",
        peFirm: contact.peFirm || "",
        salesforceId: contact.salesforceId || "",
        abmStage: contact.abmStage || "",
        website: contact.website || "",
        address: contact.address || "",
        city: contact.city || "",
        state: contact.state || "",
        zip: contact.zip || "",
        country: contact.country || "",
        segment: contact.segment || "",
        accountOwner: contact.accountOwner || "",
      });
    }
  }

  return contacts;
};

function parseSpreadsheet(file: File): Promise<ParsedContact[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });

        let bestContacts: ParsedContact[] = [];
        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
          if (!sheet) continue;

          const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
          const contacts = rowsToContacts(rows);
          if (contacts.length > bestContacts.length) bestContacts = contacts;
        }

        if (!bestContacts.length) {
          throw new Error("No contact rows detected. Include a company column like Parent Company, Parent Account, or Company.");
        }

        resolve(bestContacts);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

const ContactImporter = () => {
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedContact[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ inserted: number; errors?: string[] } | null>(null);
  const [clearExisting, setClearExisting] = useState(false);
  const [dbCount, setDbCount] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Check current DB count on mount
  useEffect(() => {
    supabase.from("target_contacts").select("id", { count: "exact", head: true }).then(({ count }) => {
      setDbCount(count || 0);
    });
  }, []);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setResult(null);
    try {
      const contacts = await parseSpreadsheet(f);
      setParsed(contacts);
      toast.success(`Parsed ${contacts.length} contacts from ${f.name}`);
    } catch (err: any) {
      toast.error("Failed to parse file: " + err.message);
      setParsed([]);
    }
  };

  const handleImport = async () => {
    if (parsed.length === 0) return;
    setImporting(true);
    setResult(null);

    try {
      // Batch client-side to avoid payload size limits (200 contacts per request)
      const batchSize = 200;
      let totalInserted = 0;
      const allErrors: string[] = [];

      for (let i = 0; i < parsed.length; i += batchSize) {
        const batch = parsed.slice(i, i + batchSize);
        const isFirst = i === 0;

        const { data, error } = await supabase.functions.invoke("import-contacts", {
          body: { contacts: batch, clearExisting: isFirst && clearExisting },
        });

        if (error) {
          allErrors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${error.message}`);
        } else if (data) {
          totalInserted += data.inserted || 0;
          if (data.errors) allErrors.push(...data.errors);
        }

        // Show progress
        toast.info(`Imported batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(parsed.length / batchSize)}`);
      }

      setResult({ inserted: totalInserted, errors: allErrors.length > 0 ? allErrors : undefined });
      toast.success(`Imported ${totalInserted} contacts total`);
      await refreshCount();
    } catch (err: any) {
      toast.error("Import failed: " + err.message);
    } finally {
      setImporting(false);
    }
  };

  const refreshCount = async () => {
    const { count } = await supabase.from("target_contacts").select("id", { count: "exact", head: true });
    setDbCount(count || 0);
  };

  const handleDeleteAll = async () => {
    setDeleting(true);
    setShowDeleteConfirm(false);
    try {
      const { data, error } = await supabase.functions.invoke("delete-all-contacts", { body: {} });
      if (error) throw new Error(error.message);
      toast.success(`Deleted ${data.deleted ?? "all"} contacts`);
      await refreshCount();
      setResult(null);
    } catch (err: any) {
      toast.error("Delete failed: " + err.message);
    } finally {
      setDeleting(false);
    }
  };

  const companies = [...new Set(parsed.map((c) => c.parentCompany))];

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-3xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold text-foreground mb-1">Contact Importer</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Upload an XLSX/CSV file to bulk-import contacts into the database.
          </p>

          {/* DB count + delete */}
          {dbCount !== null && (
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Database className="w-4 h-4" />
                <span>{dbCount.toLocaleString()} contacts currently in database</span>
              </div>
              {dbCount > 0 && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={deleting}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors disabled:opacity-50"
                >
                  {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                  {deleting ? "Deleting…" : "Delete All Contacts"}
                </button>
              )}
            </div>
          )}

          {/* Delete confirmation dialog */}
          {showDeleteConfirm && (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-6 rounded-xl border border-destructive/40 bg-destructive/5 p-4"
            >
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">Delete all {dbCount?.toLocaleString()} contacts?</p>
                  <p className="text-xs text-muted-foreground mt-1">This action cannot be undone. All contact records will be permanently removed from the database.</p>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={handleDeleteAll}
                      className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
                    >
                      Yes, delete all
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="px-4 py-1.5 text-xs font-medium rounded-lg border border-border hover:bg-muted transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Upload */}
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl p-8 cursor-pointer hover:border-primary/50 transition-colors">
            <Upload className="w-8 h-8 text-muted-foreground mb-2" />
            <span className="text-sm text-muted-foreground">
              {file ? file.name : "Click to select XLSX or CSV file"}
            </span>
            <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" />
          </label>

          {/* Preview */}
          {parsed.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6 space-y-4">
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-sm font-semibold text-foreground mb-2">
                  Preview: {parsed.length} contacts across {companies.length} companies
                </p>
                <div className="max-h-48 overflow-y-auto text-xs text-muted-foreground space-y-0.5">
                  {companies.slice(0, 20).map((co) => {
                    const count = parsed.filter((c) => c.parentCompany === co).length;
                    return <div key={co}>{co} — {count} contacts</div>;
                  })}
                  {companies.length > 20 && <div>...and {companies.length - 20} more companies</div>}
                </div>
              </div>

              {/* Import button */}
              <button
                onClick={handleImport}
                disabled={importing}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {importing ? "Importing…" : `Import ${parsed.length} Contacts`}
              </button>
            </motion.div>
          )}

          {/* Result */}
          {result && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-sm">
                <Check className="w-4 h-4 text-emerald-400" />
                <span className="font-semibold text-foreground">Imported {result.inserted} contacts</span>
              </div>
              {result.errors && result.errors.length > 0 && (
                <div className="mt-2 space-y-1">
                  {result.errors.map((e, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-destructive">
                      <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                      {e}
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default ContactImporter;
