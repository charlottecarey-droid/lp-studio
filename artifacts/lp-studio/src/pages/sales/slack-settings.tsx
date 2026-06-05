import { useState, useEffect } from "react";
import { format } from "date-fns";
import {
  Slack,
  RefreshCw,
  LogOut,
  Loader2,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Send,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
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
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SalesLayout } from "@/components/layout/sales-layout";
import { SalesPageHeader } from "@/components/sales/sales-page-header";

const API_BASE = "/api";

interface EventToggles {
  form_submit: boolean;
  hot_visit: boolean;
  ai_briefing: boolean;
}

interface SlackConnection {
  connected: boolean;
  configured: boolean;
  id?: number;
  teamId?: string;
  teamName?: string | null;
  defaultChannelId?: string | null;
  defaultChannelName?: string | null;
  eventToggles?: EventToggles;
  status?: string;
  lastError?: string | null;
  createdAt?: string;
}

interface SlackChannel {
  id: string;
  name: string;
  isPrivate: boolean;
}

const EVENT_META: { key: keyof EventToggles; label: string; description: string }[] = [
  { key: "form_submit", label: "New lead / form submission", description: "Post when a landing-page form is submitted." },
  { key: "hot_visit", label: "Hot visit", description: "Post when a known contact views a sales microsite." },
  { key: "ai_briefing", label: "AI Briefing run", description: "Post when an AI account briefing is generated." },
];

function ConnectionStatusBadge({ connected }: { connected: boolean }) {
  return connected ? (
    <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
      <CheckCircle2 className="w-3 h-3 mr-1" />
      Connected
    </Badge>
  ) : (
    <Badge className="bg-muted text-muted-foreground">
      <AlertTriangle className="w-3 h-3 mr-1" />
      Disconnected
    </Badge>
  );
}

export default function SlackSettingsPage() {
  const [connection, setConnection] = useState<SlackConnection | null>(null);
  const [channels, setChannels] = useState<SlackChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [savingChannel, setSavingChannel] = useState(false);
  const [refreshingChannels, setRefreshingChannels] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  const [banner, setBanner] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    fetchStatus();
    // Surface a success banner after the OAuth round-trip redirect.
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("connected") === "1") {
      setBanner({ ok: true, message: "Slack workspace connected." });
    }
  }, []);

  async function fetchStatus() {
    try {
      setLoading(true);
      const connRes = await fetch(`${API_BASE}/sales/slack/connection`);
      if (connRes.ok) {
        const conn: SlackConnection = await connRes.json();
        setConnection(conn);
        if (conn.connected) {
          const chRes = await fetch(`${API_BASE}/sales/slack/channels`);
          if (chRes.ok) {
            const data = await chRes.json();
            setChannels(Array.isArray(data.channels) ? data.channels : []);
          }
        }
      } else {
        setConnection(null);
      }
    } catch (error) {
      console.error("Failed to fetch Slack settings:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleConnect() {
    setConnecting(true);
    setBanner(null);
    try {
      const res = await fetch(`${API_BASE}/sales/slack/auth-url`);
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
      } else {
        setBanner({ ok: false, message: data.error || "Failed to start Slack connection." });
        setConnecting(false);
      }
    } catch {
      setBanner({ ok: false, message: "Could not reach the server." });
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    try {
      await fetch(`${API_BASE}/sales/slack/disconnect`, { method: "POST" });
      setShowDisconnectDialog(false);
      setChannels([]);
      await fetchStatus();
    } catch (error) {
      console.error("Failed to disconnect:", error);
    }
  }

  async function handleRefreshChannels() {
    try {
      setRefreshingChannels(true);
      const res = await fetch(`${API_BASE}/sales/slack/channels?refresh=1`);
      if (res.ok) {
        const data = await res.json();
        setChannels(Array.isArray(data.channels) ? data.channels : []);
      }
    } catch (error) {
      console.error("Failed to refresh channels:", error);
    } finally {
      setRefreshingChannels(false);
    }
  }

  async function handleSelectChannel(channelId: string) {
    const channel = channels.find((c) => c.id === channelId);
    if (!channel) return;
    try {
      setSavingChannel(true);
      const res = await fetch(`${API_BASE}/sales/slack/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultChannelId: channel.id, defaultChannelName: channel.name }),
      });
      if (res.ok) await fetchStatus();
    } catch (error) {
      console.error("Failed to set channel:", error);
    } finally {
      setSavingChannel(false);
    }
  }

  async function handleToggleEvent(key: keyof EventToggles, value: boolean) {
    if (!connection?.eventToggles) return;
    const next = { ...connection.eventToggles, [key]: value };
    setConnection({ ...connection, eventToggles: next });
    try {
      await fetch(`${API_BASE}/sales/slack/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventToggles: { [key]: value } }),
      });
    } catch (error) {
      console.error("Failed to update event toggle:", error);
      await fetchStatus();
    }
  }

  async function handleTest(event: keyof EventToggles) {
    setBanner(null);
    try {
      setTesting(event);
      const res = await fetch(`${API_BASE}/sales/slack/test/${event}`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setBanner({ ok: true, message: "Test message sent to Slack." });
      } else {
        setBanner({ ok: false, message: data.error || "Failed to send test message." });
      }
    } catch {
      setBanner({ ok: false, message: "Could not reach the server." });
    } finally {
      setTesting(null);
    }
  }

  const isConnected = !!connection?.connected;
  const toggles = connection?.eventToggles ?? { form_submit: true, hot_visit: true, ai_briefing: true };

  if (loading) {
    return (
      <SalesLayout>
        <div className="space-y-6">
          <SalesPageHeader title="Slack" description="Post lead, hot-visit, and AI Briefing alerts to a Slack channel" />
          <div className="space-y-4">
            {[1, 2].map((i) => (
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
        <SalesPageHeader title="Slack" description="Post lead, hot-visit, and AI Briefing alerts to a Slack channel" />

        {banner && (
          <div className={`flex items-center gap-2 text-sm rounded-md border px-4 py-3 ${banner.ok ? "text-emerald-700 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10" : "text-red-700 dark:text-red-400 border-red-500/30 bg-red-500/10"}`}>
            {banner.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {banner.message}
          </div>
        )}

        {/* Connection Status Card */}
        <Card className="p-6 border border-border/40 bg-card/50 backdrop-blur-sm">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-4">
                <Slack className="w-5 h-5 text-[#4A154B] dark:text-purple-300" />
                <h2 className="text-lg font-semibold">Connection Status</h2>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Status:</span>
                  <ConnectionStatusBadge connected={isConnected} />
                </div>
                {isConnected && (
                  <>
                    {connection?.teamName && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Workspace:</span>
                        <code className="text-sm bg-muted px-2 py-1 rounded font-mono">{connection.teamName}</code>
                      </div>
                    )}
                    {connection?.createdAt && (
                      <div className="text-sm text-muted-foreground">
                        Connected {format(new Date(connection.createdAt), "MMM d, yyyy")}
                      </div>
                    )}
                    {connection?.lastError && (
                      <div className="flex items-center gap-2 text-red-600">
                        <AlertCircle className="w-4 h-4" />
                        <span className="text-sm">{connection.lastError}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
            {isConnected && (
              <Button variant="destructive" size="sm" onClick={() => setShowDisconnectDialog(true)} className="gap-2">
                <LogOut className="w-4 h-4" />
                Disconnect
              </Button>
            )}
          </div>
        </Card>

        {/* Connect Card (shown when not connected) */}
        {!isConnected && (
          <Card className="p-6 border border-border/40 bg-card/50 backdrop-blur-sm">
            <h2 className="text-lg font-semibold mb-1">Connect Slack</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Connect your Slack workspace to receive Block Kit alerts when a new lead comes in,
              a known contact views a microsite, or an AI Briefing is generated. You'll choose the
              destination channel during the Slack consent screen, and can change it below afterwards.
            </p>
            {connection && !connection.configured ? (
              <div className="flex items-center gap-2 text-sm text-amber-600">
                <AlertTriangle className="w-4 h-4" />
                Slack is not configured on this server yet. Add the Slack app credentials to enable connecting.
              </div>
            ) : (
              <Button onClick={handleConnect} disabled={connecting} className="gap-2 bg-[#4A154B] hover:bg-[#3a1039] text-white">
                {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Slack className="w-4 h-4" />}
                {connecting ? "Redirecting..." : "Add to Slack"}
              </Button>
            )}
          </Card>
        )}

        {isConnected && (
          <>
            {/* Channel Card */}
            <Card className="p-6 border border-border/40 bg-card/50 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Destination Channel</h2>
                <Button variant="outline" size="sm" onClick={handleRefreshChannels} disabled={refreshingChannels} className="gap-2">
                  {refreshingChannels ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  Refresh
                </Button>
              </div>
              <div className="space-y-2 max-w-md">
                <Label htmlFor="slack-channel">Channel</Label>
                <Select
                  value={connection?.defaultChannelId ?? undefined}
                  onValueChange={handleSelectChannel}
                  disabled={savingChannel || channels.length === 0}
                >
                  <SelectTrigger id="slack-channel">
                    <SelectValue placeholder={channels.length === 0 ? "No channels found — try Refresh" : "Select a channel"} />
                  </SelectTrigger>
                  <SelectContent>
                    {channels.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.isPrivate ? "🔒 " : "#"}{c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  The bot must be invited to private channels before it can post there.
                </p>
              </div>
            </Card>

            {/* Event Toggles Card */}
            <Card className="p-6 border border-border/40 bg-card/50 backdrop-blur-sm">
              <h2 className="text-lg font-semibold mb-4">Events</h2>
              <div className="space-y-4">
                {EVENT_META.map(({ key, label, description }, i) => (
                  <div key={key}>
                    {i > 0 && <Separator className="mb-4" />}
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{label}</p>
                        <p className="text-sm text-muted-foreground">{description}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => handleTest(key)}
                          disabled={testing === key || !connection?.defaultChannelId}
                        >
                          {testing === key ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                          Test
                        </Button>
                        <Switch checked={toggles[key] !== false} onCheckedChange={(v) => handleToggleEvent(key, v)} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </>
        )}
      </div>

      <AlertDialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Slack?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the stored Slack token and stops all alerts. You can reconnect at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDisconnect} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SalesLayout>
  );
}
