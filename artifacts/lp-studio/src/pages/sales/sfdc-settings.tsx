import { useState, useEffect } from "react";
import { format } from "date-fns";
import {
  Cloud,
  RefreshCw,
  LogOut,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Calculator,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SalesLayout } from "@/components/layout/sales-layout";
import { SalesPageHeader } from "@/components/sales/sales-page-header";

const API_BASE = "/api";

interface SfdcConnection {
  connected: boolean;
  orgId?: string;
  instanceUrl?: string;
  lastSyncTime?: string;
  status?: "connected" | "syncing" | "error";
}

interface SyncLog {
  id: number;
  object: string;
  type: "full" | "incremental";
  recordsProcessed: number;
  created: number;
  updated: number;
  skipped: number;
  status: "running" | "completed" | "failed";
  errorMessage?: string;
  startedAt: string;
  completedAt?: string;
}

interface FieldMapping {
  id: number;
  sfdcObject: string;
  sfdcField: string;
  localTable: string;
  localField: string;
  active: boolean;
}

// Per-object inbound sync filters (Task #1356). The form keeps everything as
// strings; helpers below convert to/from the API's typed shape. An empty form
// means "sync everything".
interface SyncFiltersForm {
  accountTypes: string;
  accountIndustries: string;
  accountOwners: string;
  contactCreatedWithinYears: string;
  leadStatuses: string;
  leadCreatedWithinYears: string;
  oppStages: string;
  oppClosedWithinYears: string;
  oppStatus: "all" | "open" | "won";
}

const EMPTY_FILTERS_FORM: SyncFiltersForm = {
  accountTypes: "",
  accountIndustries: "",
  accountOwners: "",
  contactCreatedWithinYears: "",
  leadStatuses: "",
  leadCreatedWithinYears: "",
  oppStages: "",
  oppClosedWithinYears: "",
  oppStatus: "all",
};

const NO_WINDOW = "none";

// Comma-separated text -> trimmed, de-duped string array (or undefined).
function parseList(csv: string): string[] | undefined {
  const items = csv
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const unique = Array.from(new Set(items));
  return unique.length > 0 ? unique : undefined;
}

function parseYears(value: string): number | undefined {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 50 ? n : undefined;
}

// Build the API payload, omitting empty objects/fields entirely.
function buildFiltersPayload(form: SyncFiltersForm): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  const accounts: Record<string, unknown> = {};
  if (parseList(form.accountTypes)) accounts.types = parseList(form.accountTypes);
  if (parseList(form.accountIndustries)) accounts.industries = parseList(form.accountIndustries);
  if (parseList(form.accountOwners)) accounts.owners = parseList(form.accountOwners);
  if (Object.keys(accounts).length > 0) payload.accounts = accounts;

  const contactYears = parseYears(form.contactCreatedWithinYears);
  if (contactYears) payload.contacts = { createdWithinYears: contactYears };

  const leads: Record<string, unknown> = {};
  if (parseList(form.leadStatuses)) leads.statuses = parseList(form.leadStatuses);
  const leadYears = parseYears(form.leadCreatedWithinYears);
  if (leadYears) leads.createdWithinYears = leadYears;
  if (Object.keys(leads).length > 0) payload.leads = leads;

  const opportunities: Record<string, unknown> = {};
  if (parseList(form.oppStages)) opportunities.stages = parseList(form.oppStages);
  const oppYears = parseYears(form.oppClosedWithinYears);
  if (oppYears) opportunities.closedWithinYears = oppYears;
  if (form.oppStatus !== "all") opportunities.status = form.oppStatus;
  if (Object.keys(opportunities).length > 0) payload.opportunities = opportunities;

  return payload;
}

// Convert the API's typed shape back into the string-based form.
function filtersToForm(data: any): SyncFiltersForm {
  const f: SyncFiltersForm = { ...EMPTY_FILTERS_FORM };
  if (!data || typeof data !== "object") return f;
  const list = (v: unknown) => (Array.isArray(v) ? v.join(", ") : "");
  const years = (v: unknown) => (typeof v === "number" ? String(v) : "");
  if (data.accounts) {
    f.accountTypes = list(data.accounts.types);
    f.accountIndustries = list(data.accounts.industries);
    f.accountOwners = list(data.accounts.owners);
  }
  if (data.contacts) f.contactCreatedWithinYears = years(data.contacts.createdWithinYears);
  if (data.leads) {
    f.leadStatuses = list(data.leads.statuses);
    f.leadCreatedWithinYears = years(data.leads.createdWithinYears);
  }
  if (data.opportunities) {
    f.oppStages = list(data.opportunities.stages);
    f.oppClosedWithinYears = years(data.opportunities.closedWithinYears);
    if (data.opportunities.status === "open" || data.opportunities.status === "won") {
      f.oppStatus = data.opportunities.status;
    }
  }
  return f;
}

const YEAR_WINDOW_OPTIONS = [1, 2, 3, 5, 10];

// Which objects currently have an active filter. A 0-count only signals a
// "filter excludes everything" problem when a filter is actually applied to
// that object — otherwise a 0 just means the org has no records of that type
// and there's nothing for the admin to fix. Account filters also constrain
// contacts (contacts are scoped to matching accounts), so a contact filter is
// "active" when either an account filter or the contact window is set.
function filteredObjects(form: SyncFiltersForm): Record<keyof PreviewCounts, boolean> {
  const accountFilter = !!(
    parseList(form.accountTypes) ||
    parseList(form.accountIndustries) ||
    parseList(form.accountOwners)
  );
  return {
    accounts: accountFilter,
    contacts: accountFilter || !!parseYears(form.contactCreatedWithinYears),
    leads: !!(parseList(form.leadStatuses) || parseYears(form.leadCreatedWithinYears)),
    opportunities: !!(
      parseList(form.oppStages) ||
      parseYears(form.oppClosedWithinYears) ||
      form.oppStatus !== "all"
    ),
  };
}

// Per-object record counts returned by the preview endpoint. A null count means
// the count query for that object failed (e.g. missing permission).
interface PreviewCounts {
  accounts: number | null;
  contacts: number | null;
  leads: number | null;
  opportunities: number | null;
}

const PREVIEW_OBJECTS: { key: keyof PreviewCounts; label: string }[] = [
  { key: "accounts", label: "Accounts" },
  { key: "contacts", label: "Contacts" },
  { key: "leads", label: "Leads" },
  { key: "opportunities", label: "Opportunities" },
];

function ConnectionStatusBadge({ status }: { status?: string }) {
  switch (status) {
    case "connected":
      return (
        <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Connected
        </Badge>
      );
    case "syncing":
      return (
        <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30">
          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
          Syncing
        </Badge>
      );
    case "error":
      return (
        <Badge className="bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/30">
          <AlertCircle className="w-3 h-3 mr-1" />
          Error
        </Badge>
      );
    default:
      return (
        <Badge className="bg-muted text-muted-foreground">
          <AlertTriangle className="w-3 h-3 mr-1" />
          Disconnected
        </Badge>
      );
  }
}

function SyncStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "running":
      return (
        <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-400">
          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
          Running
        </Badge>
      );
    case "completed":
      return (
        <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Completed
        </Badge>
      );
    case "failed":
      return (
        <Badge className="bg-red-500/20 text-red-700 dark:text-red-400">
          <AlertCircle className="w-3 h-3 mr-1" />
          Failed
        </Badge>
      );
    default:
      return (
        <Badge variant="outline">{status}</Badge>
      );
  }
}

export default function SfdcSettingsPage() {
  const [connection, setConnection] = useState<SfdcConnection | null>(null);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  const [filtersForm, setFiltersForm] = useState<SyncFiltersForm>(EMPTY_FILTERS_FORM);
  const [savingFilters, setSavingFilters] = useState(false);
  const [filtersSaved, setFiltersSaved] = useState(false);
  const [previewCounts, setPreviewCounts] = useState<PreviewCounts | null>(null);
  const [previewingCounts, setPreviewingCounts] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  function updateFilter<K extends keyof SyncFiltersForm>(key: K, value: SyncFiltersForm[K]) {
    setFiltersSaved(false);
    // The previewed counts no longer reflect the edited filters — clear them so
    // a stale number can't be mistaken for the current filter's impact.
    setPreviewCounts(null);
    setPreviewError(null);
    setFiltersForm((prev) => ({ ...prev, [key]: value }));
  }

  // Fetch connection status
  useEffect(() => {
    fetchConnectionStatus();
  }, []);

  async function fetchConnectionStatus() {
    try {
      setLoading(true);
      const [connRes, logsRes, mappingsRes, filtersRes] = await Promise.all([
        fetch(`${API_BASE}/sales/sfdc/connection`),
        fetch(`${API_BASE}/sales/sfdc/sync/log`),
        fetch(`${API_BASE}/sales/sfdc/field-mappings`),
        fetch(`${API_BASE}/sales/sfdc/sync-filters`),
      ]);

      if (connRes.ok) {
        const data = await connRes.json();
        setConnection(data);
      }

      if (logsRes.ok) {
        const logs = await logsRes.json();
        setSyncLogs(Array.isArray(logs) ? logs : []);
      }

      if (mappingsRes.ok) {
        const mappings = await mappingsRes.json();
        setFieldMappings(Array.isArray(mappings) ? mappings : []);
      }

      if (filtersRes.ok) {
        const filters = await filtersRes.json();
        setFiltersForm(filtersToForm(filters));
      }
    } catch (error) {
      console.error("Failed to fetch SFDC settings:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleConnect() {
    try {
      const res = await fetch(`${API_BASE}/sales/sfdc/auth-url`);
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error("Failed to get auth URL:", error);
    }
  }

  async function handleDisconnect() {
    try {
      await fetch(`${API_BASE}/sales/sfdc/disconnect`, { method: "POST" });
      await fetchConnectionStatus();
      setShowDisconnectDialog(false);
    } catch (error) {
      console.error("Failed to disconnect:", error);
    }
  }

  async function handleSyncAll() {
    try {
      setSyncing("all");
      await fetch(`${API_BASE}/sales/sfdc/sync`, { method: "POST" });
      await fetchConnectionStatus();
    } catch (error) {
      console.error("Failed to sync:", error);
    } finally {
      setSyncing(null);
    }
  }

  async function handleSyncObject(object: "accounts" | "contacts" | "leads" | "opportunities") {
    try {
      setSyncing(object);
      await fetch(`${API_BASE}/sales/sfdc/sync/${object}`, { method: "POST" });
      await fetchConnectionStatus();
    } catch (error) {
      console.error(`Failed to sync ${object}:`, error);
    } finally {
      setSyncing(null);
    }
  }

  async function handleToggleMapping(id: number, active: boolean) {
    try {
      const mapping = fieldMappings.find(m => m.id === id);
      if (!mapping) return;

      await fetch(`${API_BASE}/sales/sfdc/field-mappings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          sfdcObject: mapping.sfdcObject,
          sfdcField: mapping.sfdcField,
          localTable: mapping.localTable,
          localField: mapping.localField,
          active: !active,
        }),
      });

      await fetchConnectionStatus();
    } catch (error) {
      console.error("Failed to update field mapping:", error);
    }
  }

  async function handleSaveFilters() {
    try {
      setSavingFilters(true);
      setFiltersSaved(false);
      const res = await fetch(`${API_BASE}/sales/sfdc/sync-filters`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildFiltersPayload(filtersForm)),
      });
      if (res.ok) {
        const saved = await res.json();
        setFiltersForm(filtersToForm(saved));
        setFiltersSaved(true);
      } else {
        console.error("Failed to save sync filters:", res.status);
      }
    } catch (error) {
      console.error("Failed to save sync filters:", error);
    } finally {
      setSavingFilters(false);
    }
  }

  async function handlePreviewCounts() {
    try {
      setPreviewingCounts(true);
      setPreviewError(null);
      const res = await fetch(`${API_BASE}/sales/sfdc/sync-filters/preview-count`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildFiltersPayload(filtersForm)),
      });
      if (res.ok) {
        setPreviewCounts(await res.json());
      } else {
        setPreviewCounts(null);
        setPreviewError("Couldn't preview counts. Check your Salesforce connection and try again.");
      }
    } catch (error) {
      console.error("Failed to preview sync filter counts:", error);
      setPreviewCounts(null);
      setPreviewError("Couldn't preview counts. Check your Salesforce connection and try again.");
    } finally {
      setPreviewingCounts(false);
    }
  }

  if (loading) {
    return (
      <SalesLayout>
        <div className="space-y-6">
          <SalesPageHeader
            title="Salesforce Settings"
            description="Manage your Salesforce connection and sync settings"
          />
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-6">
                <Skeleton className="h-8 w-32 mb-4" />
                <Skeleton className="h-12 w-full" />
              </Card>
            ))}
          </div>
        </div>
      </SalesLayout>
    );
  }

  return (
    <SalesLayout>
      <div className="space-y-6">
        <SalesPageHeader
          title="Salesforce Settings"
          description="Manage your Salesforce connection and sync settings"
        />

        {/* Connection Status Card */}
        <Card className="p-6 border border-border/40 bg-card/50 backdrop-blur-sm">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-4">
                <Cloud className="w-5 h-5 text-blue-500" />
                <h2 className="text-lg font-semibold">Connection Status</h2>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Status:</span>
                  <ConnectionStatusBadge status={connection?.status || (connection?.connected ? "connected" : undefined)} />
                </div>
                {connection?.connected && (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Org ID:</span>
                      <code className="text-sm bg-muted px-2 py-1 rounded font-mono">{connection.orgId}</code>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Instance URL:</span>
                      <code className="text-sm bg-muted px-2 py-1 rounded font-mono truncate">{connection.instanceUrl}</code>
                    </div>
                    {connection.lastSyncTime && (
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          Last sync: {format(new Date(connection.lastSyncTime), "MMM d, h:mm a")}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              {connection?.connected ? (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowDisconnectDialog(true)}
                  className="gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  Disconnect
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={handleConnect}
                  className="gap-2"
                >
                  <Cloud className="w-4 h-4" />
                  Connect Salesforce
                </Button>
              )}
            </div>
          </div>
        </Card>

        {connection?.connected && (
          <>
            {/* Sync Controls Card */}
            <Card className="p-6 border border-border/40 bg-card/50 backdrop-blur-sm">
              <div className="mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-3">
                  <RefreshCw className="w-5 h-5 text-amber-500" />
                  Sync Controls
                </h2>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-3">
                    Trigger a sync to pull the latest data from Salesforce
                  </p>
                  <Button
                    onClick={handleSyncAll}
                    disabled={syncing === "all"}
                    className="w-full gap-2"
                  >
                    {syncing === "all" ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                    {syncing === "all" ? "Syncing..." : "Sync All Objects"}
                  </Button>
                </div>

                <Separator />

                <div>
                  <p className="text-sm text-muted-foreground mb-3">Sync individual objects</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {["accounts", "contacts", "leads", "opportunities"].map((object) => (
                      <Button
                        key={object}
                        variant="outline"
                        size="sm"
                        onClick={() => handleSyncObject(object as "accounts" | "contacts" | "leads" | "opportunities")}
                        disabled={syncing === object}
                        className="gap-2"
                      >
                        {syncing === object ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3 h-3" />
                        )}
                        {object.charAt(0).toUpperCase() + object.slice(1)}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </Card>

            {/* Sync Filters Card */}
            <Card className="p-6 border border-border/40 bg-card/50 backdrop-blur-sm">
              <div className="mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-3">
                  <RefreshCw className="w-5 h-5 text-sky-500" />
                  Sync Filters
                </h2>
                <p className="text-sm text-muted-foreground mt-2">
                  Limit which records each sync pulls from Salesforce. Leave a field
                  blank to sync everything for that object. Separate multiple values
                  with commas.
                </p>
              </div>

              <div className="space-y-6">
                {/* Accounts */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">Accounts</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="acct-types">Types</Label>
                      <Input
                        id="acct-types"
                        placeholder="e.g. Customer, Partner"
                        value={filtersForm.accountTypes}
                        onChange={(e) => updateFilter("accountTypes", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="acct-industries">Industries</Label>
                      <Input
                        id="acct-industries"
                        placeholder="e.g. Healthcare, Finance"
                        value={filtersForm.accountIndustries}
                        onChange={(e) => updateFilter("accountIndustries", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="acct-owners">Owner names</Label>
                      <Input
                        id="acct-owners"
                        placeholder="e.g. Jane Doe"
                        value={filtersForm.accountOwners}
                        onChange={(e) => updateFilter("accountOwners", e.target.value)}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Contacts are limited to the accounts matching these filters.
                  </p>
                </div>

                <Separator />

                {/* Contacts */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">Contacts</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Created within</Label>
                      <Select
                        value={filtersForm.contactCreatedWithinYears || NO_WINDOW}
                        onValueChange={(v) =>
                          updateFilter("contactCreatedWithinYears", v === NO_WINDOW ? "" : v)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Any time" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NO_WINDOW}>Any time</SelectItem>
                          {YEAR_WINDOW_OPTIONS.map((y) => (
                            <SelectItem key={y} value={String(y)}>
                              Last {y} {y === 1 ? "year" : "years"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Leads */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">Leads</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="lead-statuses">Statuses</Label>
                      <Input
                        id="lead-statuses"
                        placeholder="e.g. Open, Working"
                        value={filtersForm.leadStatuses}
                        onChange={(e) => updateFilter("leadStatuses", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Created within</Label>
                      <Select
                        value={filtersForm.leadCreatedWithinYears || NO_WINDOW}
                        onValueChange={(v) =>
                          updateFilter("leadCreatedWithinYears", v === NO_WINDOW ? "" : v)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Any time" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NO_WINDOW}>Any time</SelectItem>
                          {YEAR_WINDOW_OPTIONS.map((y) => (
                            <SelectItem key={y} value={String(y)}>
                              Last {y} {y === 1 ? "year" : "years"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Opportunities */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">Opportunities</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="opp-stages">Stages</Label>
                      <Input
                        id="opp-stages"
                        placeholder="e.g. Prospecting, Closed Won"
                        value={filtersForm.oppStages}
                        onChange={(e) => updateFilter("oppStages", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Close date within</Label>
                      <Select
                        value={filtersForm.oppClosedWithinYears || NO_WINDOW}
                        onValueChange={(v) =>
                          updateFilter("oppClosedWithinYears", v === NO_WINDOW ? "" : v)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Any time" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NO_WINDOW}>Any time</SelectItem>
                          {YEAR_WINDOW_OPTIONS.map((y) => (
                            <SelectItem key={y} value={String(y)}>
                              Last {y} {y === 1 ? "year" : "years"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Show</Label>
                      <Select
                        value={filtersForm.oppStatus}
                        onValueChange={(v) =>
                          updateFilter("oppStatus", v as "all" | "open" | "won")
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All opportunities</SelectItem>
                          <SelectItem value="open">Open only</SelectItem>
                          <SelectItem value="won">Won only</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <Button onClick={handleSaveFilters} disabled={savingFilters} className="gap-2">
                      {savingFilters ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                      {savingFilters ? "Saving..." : "Save Filters"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handlePreviewCounts}
                      disabled={previewingCounts}
                      className="gap-2"
                    >
                      {previewingCounts ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Calculator className="w-4 h-4" />
                      )}
                      {previewingCounts ? "Counting..." : "Preview count"}
                    </Button>
                    {filtersSaved && !savingFilters && (
                      <span className="text-sm text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" />
                        Saved
                      </span>
                    )}
                  </div>

                  {previewError && (
                    <p className="text-sm text-red-600 flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4" />
                      {previewError}
                    </p>
                  )}

                  {previewCounts && (() => {
                    const filtered = filteredObjects(filtersForm);
                    // Objects with an active filter that matches nothing — these
                    // are the ones an admin will be surprised to find empty
                    // after a sync, so we call them out explicitly.
                    const zeroMatch = PREVIEW_OBJECTS.filter(
                      ({ key }) => filtered[key] && previewCounts[key] === 0,
                    );
                    return (
                      <div className="space-y-3">
                        {zeroMatch.length > 0 && (
                          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                            <p className="text-sm text-amber-700 dark:text-amber-400">
                              <span className="font-medium">
                                {zeroMatch.length === 1
                                  ? `Your ${zeroMatch[0].label} filter matches 0 records.`
                                  : `These filters match 0 records: ${zeroMatch
                                      .map((o) => o.label)
                                      .join(", ")}.`}
                              </span>{" "}
                              Syncing with {zeroMatch.length === 1 ? "it" : "them"} would
                              pull nothing. Double-check the values before saving.
                            </p>
                          </div>
                        )}
                        <div className="rounded-lg border border-border/40 bg-muted/30 p-4">
                          <p className="text-xs text-muted-foreground mb-3">
                            Records that would sync with the current filters:
                          </p>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {PREVIEW_OBJECTS.map(({ key, label }) => {
                              const isZeroMatch = filtered[key] && previewCounts[key] === 0;
                              return (
                                <div key={key} className="text-center">
                                  <div
                                    className={`text-2xl font-semibold tabular-nums ${
                                      isZeroMatch ? "text-amber-600 dark:text-amber-400" : ""
                                    }`}
                                  >
                                    {previewCounts[key] === null
                                      ? "—"
                                      : previewCounts[key]!.toLocaleString()}
                                  </div>
                                  <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </Card>

            {/* Sync History Card */}
            {syncLogs.length > 0 && (
              <Card className="p-6 border border-border/40 bg-card/50 backdrop-blur-sm">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-3">
                  <Clock className="w-5 h-5 text-muted-foreground" />
                  Sync History
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/40">
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">Object</th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">Type</th>
                        <th className="text-right py-3 px-3 font-medium text-muted-foreground">Processed</th>
                        <th className="text-right py-3 px-3 font-medium text-muted-foreground">Created</th>
                        <th className="text-right py-3 px-3 font-medium text-muted-foreground">Updated</th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">Status</th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">Started</th>
                      </tr>
                    </thead>
                    <tbody>
                      {syncLogs.map((log) => (
                        <tr key={log.id} className="border-b border-border/40 hover:bg-muted/30 transition-colors">
                          <td className="py-3 px-3 font-medium">{log.object}</td>
                          <td className="py-3 px-3">
                            <Badge variant="outline" className="text-xs">
                              {log.type}
                            </Badge>
                          </td>
                          <td className="py-3 px-3 text-right">{log.recordsProcessed}</td>
                          <td className="py-3 px-3 text-right text-emerald-600 font-medium">{log.created}</td>
                          <td className="py-3 px-3 text-right text-amber-600 font-medium">{log.updated}</td>
                          <td className="py-3 px-3">
                            <SyncStatusBadge status={log.status} />
                          </td>
                          <td className="py-3 px-3 text-xs text-muted-foreground">
                            {format(new Date(log.startedAt), "MMM d, h:mm a")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {/* Field Mappings Card */}
            {fieldMappings.length > 0 && (
              <Card className="p-6 border border-border/40 bg-card/50 backdrop-blur-sm">
                <h2 className="text-lg font-semibold mb-4">Field Mappings</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/40">
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">SFDC Object</th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">SFDC Field</th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">Local Table</th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">Local Field</th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">Active</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fieldMappings.map((mapping) => (
                        <tr key={mapping.id} className="border-b border-border/40 hover:bg-muted/30 transition-colors">
                          <td className="py-3 px-3 font-medium">{mapping.sfdcObject}</td>
                          <td className="py-3 px-3">
                            <code className="text-xs bg-muted px-2 py-1 rounded">{mapping.sfdcField}</code>
                          </td>
                          <td className="py-3 px-3">{mapping.localTable}</td>
                          <td className="py-3 px-3">
                            <code className="text-xs bg-muted px-2 py-1 rounded">{mapping.localField}</code>
                          </td>
                          <td className="py-3 px-3">
                            <Switch
                              checked={mapping.active}
                              onCheckedChange={() => handleToggleMapping(mapping.id, mapping.active)}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </>
        )}
      </div>

      {/* Disconnect Confirmation Dialog */}
      <AlertDialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Salesforce?</AlertDialogTitle>
            <AlertDialogDescription>
              This will disconnect your Salesforce account and stop syncing data. You can reconnect anytime.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-3 justify-end">
            <AlertDialogCancel asChild>
              <Button variant="outline">Cancel</Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                variant="destructive"
                onClick={handleDisconnect}
              >
                Disconnect
              </Button>
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </SalesLayout>
  );
}
