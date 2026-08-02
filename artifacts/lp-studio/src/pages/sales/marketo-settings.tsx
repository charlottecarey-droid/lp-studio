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
  Download,
  ListChecks,
  Search,
  Copy,
  Check,
  UserPlus,
  Users,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

interface MarketoConnection {
  id: number;
  munchkinId: string;
  restEndpoint: string;
  identityEndpoint: string;
  clientId: string;
  status?: "connected" | "syncing" | "error" | "disconnected";
  lastSyncAt?: string;
  lastSyncError?: string;
  syncEnabled: boolean;
  importUnlinkedLeads: boolean;
  enrollListId?: string | null;
  createdAt?: string;
}

interface SyncLog {
  id: number;
  objectType: string;
  syncType: "full" | "incremental" | "manual";
  recordsProcessed: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsSkipped: number;
  status: "running" | "completed" | "failed";
  errorMessage?: string;
  startedAt: string;
  completedAt?: string;
}

/**
 * A cached row from `marketo_lists` — populated by "Refresh lists & programs"
 * (and by a full sync). Marketo's /v1/lists.json and /asset/v1/programs.json
 * carry no member count, so we deliberately don't pretend to show one.
 */
interface MarketoList {
  id: number;
  marketoId: string;
  listType: string; // static_list | program | smart_list
  name: string;
  description?: string | null;
  fetchedAt?: string;
}

/** Result of importing one static list's members. `contactIds` is what a
 *  saved audience is built from. */
interface ImportResult {
  listId: string;
  listName: string;
  processed: number;
  created: number;
  updated: number;
  skipped: number;
  truncated: boolean;
  contactIds: number[];
}

interface FieldMapping {
  id: number;
  marketoField: string;
  localTable: string;
  localField: string;
  direction: "inbound" | "outbound" | "both";
  isActive: boolean;
}

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
      return <Badge variant="outline">{status}</Badge>;
  }
}

function DirectionBadge({ direction }: { direction: string }) {
  const label = direction === "inbound" ? "Import" : direction === "outbound" ? "Push" : "Two-way";
  return <Badge variant="outline" className="text-xs">{label}</Badge>;
}

const EMPTY_FORM = { munchkinId: "", restEndpoint: "", identityEndpoint: "", clientId: "", clientSecret: "" };

export default function MarketoSettingsPage() {
  const [connection, setConnection] = useState<MarketoConnection | null>(null);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([]);
  const [lists, setLists] = useState<MarketoList[]>([]);
  const [listSearch, setListSearch] = useState("");
  const [listTab, setListTab] = useState<"static_list" | "program">("static_list");
  const [copiedListId, setCopiedListId] = useState<string | null>(null);
  const [importingListId, setImportingListId] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [savingAudience, setSavingAudience] = useState(false);
  const [savedAudience, setSavedAudience] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);

  const [form, setForm] = useState(EMPTY_FORM);
  const [connecting, setConnecting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    fetchConnectionStatus();
  }, []);

  async function fetchConnectionStatus() {
    try {
      setLoading(true);
      const [connRes, logsRes, mappingsRes, listsRes] = await Promise.all([
        fetch(`${API_BASE}/sales/marketo/connection`),
        fetch(`${API_BASE}/sales/marketo/sync/log`),
        fetch(`${API_BASE}/sales/marketo/field-mappings`),
        fetch(`${API_BASE}/sales/marketo/discover/lists`),
      ]);

      if (connRes.ok) {
        setConnection(await connRes.json());
      } else {
        setConnection(null);
      }
      if (logsRes.ok) {
        const logs = await logsRes.json();
        setSyncLogs(Array.isArray(logs) ? logs : []);
      }
      if (mappingsRes.ok) {
        const mappings = await mappingsRes.json();
        setFieldMappings(Array.isArray(mappings) ? mappings : []);
      }
      // 404 here just means "no connection yet" — not an error worth surfacing.
      if (listsRes.ok) {
        const rows = await listsRes.json();
        setLists(Array.isArray(rows) ? rows : []);
      } else {
        setLists([]);
      }
    } catch (error) {
      console.error("Failed to fetch Marketo settings:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleTest() {
    setTestResult(null);
    try {
      const res = await fetch(`${API_BASE}/sales/marketo/test-connection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identityEndpoint: form.identityEndpoint,
          clientId: form.clientId,
          clientSecret: form.clientSecret,
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) setTestResult({ ok: true, message: "Credentials are valid." });
      else setTestResult({ ok: false, message: data.error || "Could not authenticate with Marketo." });
    } catch {
      setTestResult({ ok: false, message: "Could not reach the server." });
    }
  }

  async function handleConnect() {
    setConnecting(true);
    setTestResult(null);
    try {
      const res = await fetch(`${API_BASE}/sales/marketo/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setForm(EMPTY_FORM);
        await fetchConnectionStatus();
      } else {
        setTestResult({ ok: false, message: data.error || "Failed to connect Marketo." });
      }
    } catch {
      setTestResult({ ok: false, message: "Could not reach the server." });
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    try {
      await fetch(`${API_BASE}/sales/marketo/disconnect`, { method: "POST" });
      await fetchConnectionStatus();
      setShowDisconnectDialog(false);
    } catch (error) {
      console.error("Failed to disconnect:", error);
    }
  }

  async function handleSyncAll() {
    try {
      setSyncing("all");
      await fetch(`${API_BASE}/sales/marketo/sync`, { method: "POST" });
      await fetchConnectionStatus();
    } catch (error) {
      console.error("Failed to sync:", error);
    } finally {
      setSyncing(null);
    }
  }

  async function handleSyncObject(object: "leads") {
    try {
      setSyncing(object);
      await fetch(`${API_BASE}/sales/marketo/sync/${object}`, { method: "POST" });
      await fetchConnectionStatus();
    } catch (error) {
      console.error(`Failed to sync ${object}:`, error);
    } finally {
      setSyncing(null);
    }
  }

  /**
   * Re-fetch the list/program catalogue. Deliberately POSTs to discover/refresh
   * rather than sync/lists: both run the same discoverLists() call, but only
   * discover/refresh is sync-toggle-agnostic — it writes nothing but the cache,
   * so it must not require switching the whole lead sync on.
   */
  async function handleRefreshLists() {
    try {
      setSyncing("lists");
      await fetch(`${API_BASE}/sales/marketo/discover/refresh`, { method: "POST" });
      await fetchConnectionStatus();
    } catch (error) {
      console.error("Failed to refresh Marketo lists:", error);
    } finally {
      setSyncing(null);
    }
  }

  /** Pull one static list's members into sales_contacts. Bounded and
   *  user-initiated — unrelated to the lead sync toggle. */
  async function handleImportList(list: MarketoList) {
    setImportingListId(list.marketoId);
    setImportError(null);
    setImportResult(null);
    setSavedAudience(null);
    try {
      const res = await fetch(`${API_BASE}/sales/marketo/lists/${encodeURIComponent(list.marketoId)}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        setImportError(data.error || "Import failed.");
        return;
      }
      setImportResult(data as ImportResult);
      // Sync history + any newly-cached state.
      await fetchConnectionStatus();
    } catch {
      setImportError("Could not reach the server.");
    } finally {
      setImportingListId(null);
    }
  }

  /** Turn the imported members into a saved audience. Uses the ordinary
   *  audience endpoint with `filters.contactIds` — no new storage concept, and
   *  it shows up in the campaign wizard's "Start from a saved audience". */
  async function handleSaveAudience(result: ImportResult) {
    setSavingAudience(true);
    try {
      const res = await fetch(`${API_BASE}/sales/audiences`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: result.listName,
          description: `Imported from the Marketo static list "${result.listName}" (id ${result.listId}).`,
          filters: { contactIds: result.contactIds },
        }),
      });
      if (res.ok) setSavedAudience(result.listName);
      else setImportError("Couldn't save the audience.");
    } catch {
      setImportError("Could not reach the server.");
    } finally {
      setSavingAudience(false);
    }
  }

  async function handleCopyListId(marketoId: string) {
    try {
      await navigator.clipboard.writeText(marketoId);
      setCopiedListId(marketoId);
      setTimeout(() => setCopiedListId((cur) => (cur === marketoId ? null : cur)), 1500);
    } catch (error) {
      console.error("Failed to copy list id:", error);
    }
  }

  async function handleToggleSetting(field: "syncEnabled" | "importUnlinkedLeads", value: boolean) {
    try {
      await fetch(`${API_BASE}/sales/marketo/connection`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      await fetchConnectionStatus();
    } catch (error) {
      console.error("Failed to update setting:", error);
    }
  }

  async function handleToggleMapping(id: number, isActive: boolean) {
    try {
      await fetch(`${API_BASE}/sales/marketo/field-mappings/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      });
      await fetchConnectionStatus();
    } catch (error) {
      console.error("Failed to update field mapping:", error);
    }
  }

  const isConnected = connection?.status === "connected";

  const staticListCount = lists.filter((l) => l.listType === "static_list").length;
  const programCount = lists.filter((l) => l.listType === "program").length;
  const listQuery = listSearch.trim().toLowerCase();
  const visibleLists = lists
    .filter((l) => l.listType === listTab)
    .filter((l) =>
      !listQuery ||
      l.name.toLowerCase().includes(listQuery) ||
      l.marketoId.includes(listQuery) ||
      (l.description ?? "").toLowerCase().includes(listQuery),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
  const listsFetchedAt = lists.find((l) => l.fetchedAt)?.fetchedAt;

  if (loading) {
    return (
      <SalesLayout>
        <div className="space-y-6">
          <SalesPageHeader title="Marketo Settings" description="Manage your Marketo connection and two-way sync" />
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
        <SalesPageHeader title="Marketo Settings" description="Manage your Marketo connection and two-way sync" />

        {/* Connection Status Card */}
        <Card className="p-6 border border-border/40 bg-card/50 backdrop-blur-sm">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-4">
                <Cloud className="w-5 h-5 text-purple-500" />
                <h2 className="text-lg font-semibold">Connection Status</h2>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Status:</span>
                  <ConnectionStatusBadge status={connection?.status} />
                </div>
                {isConnected && (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Munchkin ID:</span>
                      <code className="text-sm bg-muted px-2 py-1 rounded font-mono">{connection?.munchkinId}</code>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">REST endpoint:</span>
                      <code className="text-sm bg-muted px-2 py-1 rounded font-mono truncate max-w-md">{connection?.restEndpoint}</code>
                    </div>
                    {connection?.lastSyncAt && (
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          Last sync: {format(new Date(connection.lastSyncAt), "MMM d, h:mm a")}
                        </span>
                      </div>
                    )}
                    {connection?.lastSyncError && (
                      <div className="flex items-center gap-2 text-red-600">
                        <AlertCircle className="w-4 h-4" />
                        <span className="text-sm">{connection.lastSyncError}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
            {isConnected && (
              <div className="flex gap-2">
                <Button variant="destructive" size="sm" onClick={() => setShowDisconnectDialog(true)} className="gap-2">
                  <LogOut className="w-4 h-4" />
                  Disconnect
                </Button>
              </div>
            )}
          </div>
        </Card>

        {/* Connect Form (shown when not connected) */}
        {!isConnected && (
          <Card className="p-6 border border-border/40 bg-card/50 backdrop-blur-sm">
            <h2 className="text-lg font-semibold mb-1">Connect Marketo</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Enter your Marketo REST API credentials. Create a custom service in Marketo
              (Admin → LaunchPoint) to obtain the Client ID and Client Secret. Your Client
              Secret is encrypted at rest and never shown again.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="mkto-munchkin">Munchkin ID</Label>
                <Input id="mkto-munchkin" placeholder="123-ABC-456" value={form.munchkinId}
                  onChange={(e) => setForm({ ...form, munchkinId: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mkto-rest">REST endpoint</Label>
                <Input id="mkto-rest" placeholder="https://123-ABC-456.mktorest.com/rest" value={form.restEndpoint}
                  onChange={(e) => setForm({ ...form, restEndpoint: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mkto-identity">Identity endpoint</Label>
                <Input id="mkto-identity" placeholder="https://123-ABC-456.mktorest.com/identity" value={form.identityEndpoint}
                  onChange={(e) => setForm({ ...form, identityEndpoint: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mkto-client-id">Client ID</Label>
                <Input id="mkto-client-id" placeholder="00000000-0000-0000-0000-000000000000" value={form.clientId}
                  onChange={(e) => setForm({ ...form, clientId: e.target.value })} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="mkto-client-secret">Client Secret</Label>
                <Input id="mkto-client-secret" type="password" placeholder="••••••••••••••••" value={form.clientSecret}
                  onChange={(e) => setForm({ ...form, clientSecret: e.target.value })} />
              </div>
            </div>

            {testResult && (
              <div className={`mt-4 flex items-center gap-2 text-sm ${testResult.ok ? "text-emerald-600" : "text-red-600"}`}>
                {testResult.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                {testResult.message}
              </div>
            )}

            <div className="flex gap-3 mt-5">
              <Button variant="outline" onClick={handleTest}
                disabled={!form.identityEndpoint || !form.clientId || !form.clientSecret}>
                Test connection
              </Button>
              <Button onClick={handleConnect} className="gap-2"
                disabled={connecting || !form.munchkinId || !form.restEndpoint || !form.identityEndpoint || !form.clientId || !form.clientSecret}>
                {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Cloud className="w-4 h-4" />}
                {connecting ? "Connecting..." : "Connect Marketo"}
              </Button>
            </div>
          </Card>
        )}

        {isConnected && (
          <>
            {/* Sync Settings Card */}
            <Card className="p-6 border border-border/40 bg-card/50 backdrop-blur-sm">
              <h2 className="text-lg font-semibold mb-4">Sync Settings</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">Sync enabled</p>
                    <p className="text-sm text-muted-foreground">Allow two-way syncing and outbound activity push.</p>
                  </div>
                  <Switch checked={connection!.syncEnabled} onCheckedChange={(v) => handleToggleSetting("syncEnabled", v)} />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">Import unlinked leads</p>
                    <p className="text-sm text-muted-foreground">
                      Also import Marketo leads with no Salesforce contact/account. When off, only
                      leads matching an existing Salesforce record are imported.
                    </p>
                  </div>
                  <Switch checked={connection!.importUnlinkedLeads} onCheckedChange={(v) => handleToggleSetting("importUnlinkedLeads", v)} />
                </div>
              </div>
            </Card>

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
                    Run a full sync to refresh lists and bulk-import leads from Marketo.
                  </p>
                  <Button onClick={handleSyncAll} disabled={syncing === "all"} className="w-full gap-2">
                    {syncing === "all" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    {syncing === "all" ? "Syncing..." : "Full Sync"}
                  </Button>
                </div>
                <Separator />
                <div>
                  <p className="text-sm text-muted-foreground mb-3">Run an individual sync step</p>
                  {/* "Refresh Lists" and "Refresh Programs" used to be two buttons
                      running the identical discoverLists() call — one button now
                      covers both, which is what it always did. */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Button variant="outline" size="sm" onClick={() => handleSyncObject("leads")}
                      disabled={syncing === "leads"} className="gap-2">
                      {syncing === "leads" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                      Import Leads
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleRefreshLists}
                      disabled={syncing === "lists"} className="gap-2">
                      {syncing === "lists" ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                      Refresh lists &amp; programs
                    </Button>
                  </div>
                </div>
              </div>
            </Card>

            {/* Lists & Programs Card */}
            <Card className="p-6 border border-border/40 bg-card/50 backdrop-blur-sm">
              <div className="flex items-start justify-between gap-4 mb-1">
                <h2 className="text-lg font-semibold flex items-center gap-3">
                  <ListChecks className="w-5 h-5 text-purple-500" />
                  Lists &amp; Programs
                </h2>
                {listsFetchedAt && (
                  <span className="text-xs text-muted-foreground whitespace-nowrap pt-1">
                    Cached {format(new Date(listsFetchedAt), "MMM d, h:mm a")}
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Your Marketo static lists and programs. Copy a static list id to use it as the
                destination when pushing personalized links from a campaign.
              </p>

              {lists.length === 0 ? (
                <div className="text-sm text-muted-foreground border border-dashed border-border/60 rounded-md py-8 text-center">
                  Nothing cached yet — run <span className="font-medium">Refresh lists &amp; programs</span> above.
                </div>
              ) : (
                <>
                  <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
                    <Tabs value={listTab} onValueChange={(v) => setListTab(v as "static_list" | "program")}>
                      <TabsList>
                        <TabsTrigger value="static_list">Static lists ({staticListCount})</TabsTrigger>
                        <TabsTrigger value="program">Programs ({programCount})</TabsTrigger>
                      </TabsList>
                    </Tabs>
                    <div className="relative flex-1 md:max-w-xs">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        className="pl-9"
                        placeholder="Search by name or id"
                        value={listSearch}
                        onChange={(e) => setListSearch(e.target.value)}
                      />
                    </div>
                  </div>

                  {visibleLists.length === 0 ? (
                    <div className="text-sm text-muted-foreground py-8 text-center">
                      No {listTab === "static_list" ? "static lists" : "programs"} match “{listSearch}”.
                    </div>
                  ) : (
                    <div className="overflow-x-auto max-h-[420px] overflow-y-auto rounded-md border border-border/40">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-card z-10">
                          <tr className="border-b border-border/40">
                            <th className="text-left py-3 px-3 font-medium text-muted-foreground">Name</th>
                            <th className="text-left py-3 px-3 font-medium text-muted-foreground">Description</th>
                            <th className="text-left py-3 px-3 font-medium text-muted-foreground">Marketo ID</th>
                            {listTab === "static_list" && <th className="py-3 px-3" />}
                          </tr>
                        </thead>
                        <tbody>
                          {visibleLists.map((list) => (
                            <tr key={list.id} className="border-b border-border/40 last:border-0 hover:bg-muted/30 transition-colors">
                              <td className="py-3 px-3 font-medium">{list.name}</td>
                              <td className="py-3 px-3 text-muted-foreground max-w-md truncate" title={list.description ?? ""}>
                                {list.description || "—"}
                              </td>
                              <td className="py-3 px-3">
                                <div className="flex items-center gap-1">
                                  <code className="text-xs bg-muted px-2 py-1 rounded font-mono">{list.marketoId}</code>
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                                    aria-label={`Copy Marketo id ${list.marketoId}`}
                                    onClick={() => handleCopyListId(list.marketoId)}>
                                    {copiedListId === list.marketoId
                                      ? <Check className="w-3.5 h-3.5 text-emerald-600" />
                                      : <Copy className="w-3.5 h-3.5" />}
                                  </Button>
                                </div>
                              </td>
                              {/* Static lists only: Marketo's list-members API
                                  doesn't apply to programs. */}
                              {listTab === "static_list" && (
                                <td className="py-3 px-3 text-right">
                                  <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs"
                                    disabled={importingListId !== null}
                                    title="Pull this list's members into contacts, then optionally save them as a campaign audience"
                                    onClick={() => handleImportList(list)}>
                                    {importingListId === list.marketoId
                                      ? <><Loader2 className="w-3 h-3 animate-spin" />Importing…</>
                                      : <><UserPlus className="w-3 h-3" />Import</>}
                                  </Button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground mt-3">
                    Showing {visibleLists.length} of {listTab === "static_list" ? staticListCount : programCount}.
                    Marketo&rsquo;s list API doesn&rsquo;t return member counts, so none are shown.
                  </p>

                  {importError && (
                    <div className="mt-4 flex items-center gap-2 text-sm text-red-600">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      {importError}
                    </div>
                  )}

                  {importResult && (
                    <div className="mt-4 rounded-md border border-border/60 bg-muted/30 p-4">
                      <p className="text-sm font-medium mb-1">
                        Imported &ldquo;{importResult.listName}&rdquo;
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {importResult.processed} member{importResult.processed !== 1 ? "s" : ""} on the list
                        {" · "}<span className="text-emerald-600 font-medium">{importResult.created} new</span>
                        {" · "}<span className="text-amber-600 font-medium">{importResult.updated} matched an existing contact</span>
                        {importResult.skipped > 0 && <> {" · "}{importResult.skipped} skipped</>}
                      </p>
                      {importResult.truncated && (
                        <p className="text-xs text-amber-600 mt-1">
                          Stopped at the per-run cap — run the import again to continue through the rest of the list.
                        </p>
                      )}
                      {savedAudience ? (
                        <p className="text-sm text-emerald-600 mt-3 flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4" />
                          Saved as the audience &ldquo;{savedAudience}&rdquo; — pick it in the campaign wizard under
                          &ldquo;Start from a saved audience&rdquo;.
                        </p>
                      ) : (
                        <div className="mt-3 flex items-center gap-3">
                          <Button size="sm" className="gap-2"
                            disabled={savingAudience || importResult.contactIds.length === 0}
                            onClick={() => handleSaveAudience(importResult)}>
                            {savingAudience ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Users className="w-3.5 h-3.5" />}
                            Save as campaign audience
                          </Button>
                          <span className="text-xs text-muted-foreground">
                            {importResult.contactIds.length} contact{importResult.contactIds.length !== 1 ? "s" : ""} on this list
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
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
                          <td className="py-3 px-3 font-medium">{log.objectType}</td>
                          <td className="py-3 px-3"><Badge variant="outline" className="text-xs">{log.syncType}</Badge></td>
                          <td className="py-3 px-3 text-right">{log.recordsProcessed}</td>
                          <td className="py-3 px-3 text-right text-emerald-600 font-medium">{log.recordsCreated}</td>
                          <td className="py-3 px-3 text-right text-amber-600 font-medium">{log.recordsUpdated}</td>
                          <td className="py-3 px-3"><SyncStatusBadge status={log.status} /></td>
                          <td className="py-3 px-3 text-xs text-muted-foreground">{format(new Date(log.startedAt), "MMM d, h:mm a")}</td>
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
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">Marketo Field</th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">Local Table</th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">Local Field</th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">Direction</th>
                        <th className="text-left py-3 px-3 font-medium text-muted-foreground">Active</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fieldMappings.map((mapping) => (
                        <tr key={mapping.id} className="border-b border-border/40 hover:bg-muted/30 transition-colors">
                          <td className="py-3 px-3"><code className="text-xs bg-muted px-2 py-1 rounded">{mapping.marketoField}</code></td>
                          <td className="py-3 px-3">{mapping.localTable}</td>
                          <td className="py-3 px-3"><code className="text-xs bg-muted px-2 py-1 rounded">{mapping.localField}</code></td>
                          <td className="py-3 px-3"><DirectionBadge direction={mapping.direction} /></td>
                          <td className="py-3 px-3">
                            <Switch checked={mapping.isActive} onCheckedChange={() => handleToggleMapping(mapping.id, mapping.isActive)} />
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
            <AlertDialogTitle>Disconnect Marketo?</AlertDialogTitle>
            <AlertDialogDescription>
              This will disconnect your Marketo instance and stop syncing data. You can reconnect anytime.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-3 justify-end">
            <AlertDialogCancel asChild>
              <Button variant="outline">Cancel</Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button variant="destructive" onClick={handleDisconnect}>Disconnect</Button>
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </SalesLayout>
  );
}
