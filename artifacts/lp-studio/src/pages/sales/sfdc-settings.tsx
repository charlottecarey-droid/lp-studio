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
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

  // Fetch connection status
  useEffect(() => {
    fetchConnectionStatus();
  }, []);

  async function fetchConnectionStatus() {
    try {
      setLoading(true);
      const [connRes, logsRes, mappingsRes] = await Promise.all([
        fetch(`${API_BASE}/sales/sfdc/connection`),
        fetch(`${API_BASE}/sales/sfdc/sync/log`),
        fetch(`${API_BASE}/sales/sfdc/field-mappings`),
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

  if (loading) {
    return (
      <SalesLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Salesforce Settings</h1>
            <p className="text-muted-foreground mt-2">Manage your Salesforce connection and sync settings</p>
          </div>
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
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Salesforce Settings</h1>
          <p className="text-muted-foreground mt-2">Manage your Salesforce connection and sync settings</p>
        </div>

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
