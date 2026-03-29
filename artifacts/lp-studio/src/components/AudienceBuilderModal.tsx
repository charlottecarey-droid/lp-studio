import { useState, useEffect, useCallback, useRef } from "react";
import {
  X, Users, Building2, Briefcase, Tag, Search, Check, Loader2,
  Plus, ChevronDown, ChevronUp, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const API_BASE = "/api";

interface AudienceFilters {
  accountIds?: number[];
  titleKeywords?: string[];
  departments?: string[];
  contactRoles?: string[];
  contactIds?: number[];
}

export interface Audience {
  id: number;
  name: string;
  description?: string;
  filters: AudienceFilters;
  contact_count: number;
  created_at: string;
  updated_at: string;
}

interface Account {
  id: number;
  name: string;
}

interface Contact {
  id: number;
  firstName: string;
  lastName: string;
  email: string | null;
  title: string | null;
  department: string | null;
  accountId: number;
  accountName: string | null;
}

interface PreviewContact {
  id: number;
  firstName: string;
  lastName: string;
  email: string | null;
  title: string | null;
  accountName: string | null;
}

interface Props {
  audience?: Audience | null;
  onClose: () => void;
  onSaved: (audience: Audience) => void;
}

function TagInput({
  values,
  onChange,
  placeholder,
}: {
  values: string[];
  onChange: (vals: string[]) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState("");

  function add() {
    const trimmed = input.trim();
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed]);
    }
    setInput("");
  }

  return (
    <div className="flex flex-wrap gap-1.5 p-2 border border-input rounded-md bg-background min-h-[38px] focus-within:ring-2 focus-within:ring-ring">
      {values.map(v => (
        <span key={v} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
          {v}
          <button onClick={() => onChange(values.filter(x => x !== v))} className="hover:text-destructive transition-colors">
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      <input
        className="flex-1 min-w-[120px] text-sm outline-none bg-transparent placeholder:text-muted-foreground"
        placeholder={values.length === 0 ? placeholder : "Add more…"}
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => {
          if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); }
          if (e.key === "Backspace" && !input && values.length > 0) {
            onChange(values.slice(0, -1));
          }
        }}
        onBlur={add}
      />
    </div>
  );
}

function AccountMultiSelect({
  accounts,
  selected,
  onChange,
}: {
  accounts: Account[];
  selected: number[];
  onChange: (ids: number[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = accounts.filter(a => a.name.toLowerCase().includes(search.toLowerCase()));
  const selectedNames = accounts.filter(a => selected.includes(a.id)).map(a => a.name);

  function toggle(id: number) {
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 border border-input rounded-md bg-background text-sm hover:border-primary/40 transition-colors"
      >
        <span className="text-left flex-1 min-w-0 truncate">
          {selected.length === 0
            ? <span className="text-muted-foreground">All accounts</span>
            : <span>{selectedNames.slice(0, 3).join(", ")}{selected.length > 3 ? ` +${selected.length - 3} more` : ""}</span>
          }
        </span>
        {selected.length > 0 && (
          <span className="ml-2 shrink-0 text-xs font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
            {selected.length}
          </span>
        )}
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground ml-2 shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground ml-2 shrink-0" />}
      </button>
      {open && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-xl shadow-xl overflow-hidden">
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                autoFocus
                className="w-full pl-7 pr-3 py-1.5 text-sm border border-input rounded-md bg-background outline-none focus:ring-2 focus:ring-ring"
                placeholder="Search accounts…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            {selected.length > 0 && (
              <button
                className="mt-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors"
                onClick={() => onChange([])}
              >
                Clear selection
              </button>
            )}
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-sm text-muted-foreground text-center">No accounts found</div>
            ) : (
              filtered.map(a => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => toggle(a.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/60 transition-colors text-left"
                >
                  <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${selected.includes(a.id) ? "bg-primary border-primary" : "border-input"}`}>
                    {selected.includes(a.id) && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                  </div>
                  {a.name}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AudienceBuilderModal({ audience, onClose, onSaved }: Props) {
  const [name, setName] = useState(audience?.name ?? "");
  const [description, setDescription] = useState(audience?.description ?? "");
  const [filters, setFilters] = useState<AudienceFilters>(audience?.filters ?? {});

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [preview, setPreview] = useState<PreviewContact[] | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [contactSearch, setContactSearch] = useState("");

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/sales/accounts`).then(r => r.ok ? r.json() : []),
      fetch(`${API_BASE}/sales/contacts`).then(r => r.ok ? r.json() : []),
    ]).then(([accs, cons]) => {
      setAccounts(Array.isArray(accs) ? accs : accs.accounts ?? []);
      setContacts(Array.isArray(cons) ? cons : cons.contacts ?? []);
    }).catch(() => {}).finally(() => setLoadingData(false));
  }, []);

  const previewDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerPreview = useCallback((f: AudienceFilters) => {
    if (previewDebounce.current) clearTimeout(previewDebounce.current);
    previewDebounce.current = setTimeout(async () => {
      setPreviewLoading(true);
      try {
        const res = await fetch(`${API_BASE}/sales/audiences/preview`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filters: f }),
        });
        const data = await res.json();
        setPreview(data.contacts ?? []);
        setShowPreview(true);
      } catch {} finally { setPreviewLoading(false); }
    }, 400);
  }, []);

  function updateFilters(update: Partial<AudienceFilters>) {
    const next = { ...filters, ...update };
    Object.keys(next).forEach(k => {
      const key = k as keyof AudienceFilters;
      if (Array.isArray(next[key]) && (next[key] as unknown[]).length === 0) {
        delete next[key];
      }
    });
    setFilters(next);
    triggerPreview(next);
  }

  function toggleContact(id: number) {
    const cur = filters.contactIds ?? [];
    updateFilters({ contactIds: cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id] });
  }

  async function handleSave() {
    if (!name.trim()) { setError("Name is required"); return; }
    setSaving(true);
    setError(null);
    try {
      const body = JSON.stringify({ name: name.trim(), description: description.trim() || undefined, filters });
      const url = audience ? `${API_BASE}/sales/audiences/${audience.id}` : `${API_BASE}/sales/audiences`;
      const method = audience ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Failed to save");
      }
      const saved = await res.json() as Audience;
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save audience");
    } finally {
      setSaving(false);
    }
  }

  const filteredContacts = contacts.filter(c => {
    const q = contactSearch.toLowerCase();
    return !q || [c.firstName, c.lastName, c.email, c.title, c.accountName].some(f => f?.toLowerCase().includes(q));
  });

  const selectedContactIds = filters.contactIds ?? [];
  const hasFilters = Object.keys(filters).length > 0;
  const previewCount = preview?.length ?? (audience?.contact_count ?? null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-background rounded-2xl shadow-2xl border border-border w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">
                {audience ? "Edit Audience" : "New Audience"}
              </h2>
              <p className="text-xs text-muted-foreground">Define who will receive this campaign</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-5">
            {/* Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Audience Name *</label>
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. DSO Leaders — C-Suite"
                className="h-9"
              />
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Filters</span>
              <div className="flex-1 h-px bg-border" />
            </div>
            <p className="text-xs text-muted-foreground -mt-2">
              Filters combine with AND logic — contacts must match all active filters. Leave empty to include everyone with an email.
            </p>

            {/* Accounts */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Building2 className="w-3 h-3" />
                Accounts
              </label>
              {loadingData ? (
                <div className="h-9 bg-muted animate-pulse rounded-md" />
              ) : (
                <AccountMultiSelect
                  accounts={accounts}
                  selected={filters.accountIds ?? []}
                  onChange={ids => updateFilters({ accountIds: ids })}
                />
              )}
            </div>

            {/* Title Keywords */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Briefcase className="w-3 h-3" />
                Job Title Contains
              </label>
              <TagInput
                values={filters.titleKeywords ?? []}
                onChange={vals => updateFilters({ titleKeywords: vals })}
                placeholder="e.g. CEO, VP, Director — press Enter to add"
              />
              <p className="text-[11px] text-muted-foreground">Any contact whose title contains one of these terms</p>
            </div>

            {/* Departments */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Tag className="w-3 h-3" />
                Department
              </label>
              <TagInput
                values={filters.departments ?? []}
                onChange={vals => updateFilters({ departments: vals })}
                placeholder="e.g. Operations, Clinical — press Enter to add"
              />
            </div>

            {/* Specific Contacts */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Users className="w-3 h-3" />
                  Specific Contacts
                </label>
                {selectedContactIds.length > 0 && (
                  <button
                    className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                    onClick={() => updateFilters({ contactIds: [] })}
                  >
                    Clear ({selectedContactIds.length})
                  </button>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                If you select specific contacts, other filters are ignored — only these contacts will be included.
              </p>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  className="w-full pl-8 pr-3 py-2 text-sm border border-input rounded-md bg-background outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Search contacts by name, title, or email…"
                  value={contactSearch}
                  onChange={e => setContactSearch(e.target.value)}
                />
              </div>
              {loadingData ? (
                <div className="h-32 bg-muted/50 animate-pulse rounded-lg" />
              ) : (
                <div className="border border-border rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                  {filteredContacts.length === 0 ? (
                    <div className="px-4 py-6 text-sm text-muted-foreground text-center">No contacts found</div>
                  ) : (
                    filteredContacts.slice(0, 200).map(c => {
                      const isSelected = selectedContactIds.includes(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => toggleContact(c.id)}
                          className={`w-full flex items-center gap-3 px-3 py-2 text-sm border-b border-border/50 last:border-0 transition-colors text-left ${isSelected ? "bg-primary/5" : "hover:bg-muted/50"}`}
                        >
                          <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${isSelected ? "bg-primary border-primary" : "border-input"}`}>
                            {isSelected && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-foreground truncate">{c.firstName} {c.lastName}</span>
                              {c.accountName && <span className="text-muted-foreground truncate text-xs">· {c.accountName}</span>}
                            </div>
                            {(c.title || c.email) && (
                              <div className="text-xs text-muted-foreground truncate">
                                {[c.title, c.email].filter(Boolean).join(" · ")}
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Preview bar */}
        <div className="border-t border-border bg-muted/30 px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {previewLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              ) : (
                <Users className="w-4 h-4 text-muted-foreground" />
              )}
              <span className="text-sm text-muted-foreground">
                {previewLoading
                  ? "Calculating…"
                  : previewCount !== null
                    ? <><span className="font-bold text-foreground">{previewCount}</span> contacts match</>
                    : hasFilters ? "Preview to see count" : "No filters set"
                }
              </span>
              {!previewLoading && hasFilters && (
                <button
                  onClick={() => triggerPreview(filters)}
                  className="ml-1 text-xs text-primary hover:underline flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  Refresh
                </button>
              )}
            </div>
            {preview && preview.length > 0 && (
              <button
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setShowPreview(!showPreview)}
              >
                {showPreview ? "Hide preview" : "Show preview"}
              </button>
            )}
          </div>

          {showPreview && preview && preview.length > 0 && (
            <div className="mt-2 border border-border rounded-lg overflow-hidden max-h-36 overflow-y-auto bg-background">
              {preview.slice(0, 50).map(c => (
                <div key={c.id} className="flex items-center gap-3 px-3 py-1.5 border-b border-border/40 last:border-0 text-xs">
                  <span className="font-medium text-foreground">{c.firstName} {c.lastName}</span>
                  {c.accountName && <span className="text-muted-foreground">· {c.accountName}</span>}
                  {c.title && <span className="text-muted-foreground hidden sm:block">· {c.title}</span>}
                </div>
              ))}
              {preview.length > 50 && (
                <div className="px-3 py-2 text-xs text-muted-foreground text-center bg-muted/30">
                  +{preview.length - 50} more contacts
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-6 py-4 flex items-center gap-3">
          {error && <p className="flex-1 text-sm text-destructive">{error}</p>}
          <div className="flex items-center gap-2 ml-auto">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !name.trim()} className="gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {saving ? "Saving…" : audience ? "Save Changes" : "Create Audience"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
