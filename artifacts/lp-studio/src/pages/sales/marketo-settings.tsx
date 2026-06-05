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
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
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
      const [connRes, logsRes, mappingsRes] = await Promise.all([
        fetch(`${API_BASE}/sales/marketo/connection`),
        fetch(`${API_BASE}/sales/marketo/sync/log`),
        fetch(`${API_BASE}/sales/marketo/field-mappings`),
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

  async function handleSyncObject(object: "leads" | "lists" | "programs") {
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
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {([
                      { key: "leads", label: "Import Leads", icon: Download },
                      { key: "lists", label: "Refresh Lists", icon: RefreshCw },
                      { key: "programs", label: "Refresh Programs", icon: RefreshCw },
                    ] as const).map(({ key, label, icon: Icon }) => (
                      <Button key={key} variant="outline" size="sm" onClick={() => handleSyncObject(key)}
                        disabled={syncing === key} className="gap-2">
                        {syncing === key ? <Loader2 className="w-3 h-3 animate-spin" /> : <Icon className="w-3 h-3" />}
                        {label}
                      </Button>
                    ))}
                  </div>
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
