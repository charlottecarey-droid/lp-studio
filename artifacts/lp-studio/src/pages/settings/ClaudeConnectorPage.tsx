/**
 * Settings → Claude — connect LP Studio to your own Claude (any member).
 *
 * The connector is personal: each rep adds it to their Claude and approves
 * it as themselves, in the workspace they're in. This tab gives them the
 * link, the steps, a generator for a weekly-update scheduled task, and the
 * list of Claude connections they've approved (with Disconnect).
 * Server: artifacts/api-server/src/routes/mcp.ts.
 */
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Check, Copy, Unplug } from "lucide-react";
import { SettingsSectionHeader } from "@/pages/settings/SettingsUi";

interface Connection {
  id: string;
  clientName: string | null;
  scope: string;
  createdAt: string;
  lastUsedAt: string | null;
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

function CopyButton({ text, label = "Copy", testId }: { text: string; label?: string; testId?: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      data-testid={testId}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          /* clipboard blocked: the text is visible to copy by hand */
        }
      }}
    >
      {done ? <Check className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
      {done ? "Copied" : label}
    </Button>
  );
}

/** "Read only" / "Read + drafts" / "Read + drafts + page editing". */
function accessLabel(scope: string): string {
  const extras = [scope.includes("lpstudio:drafts") ? "drafts" : null, scope.includes("lpstudio:pages") ? "page editing" : null].filter(Boolean);
  return extras.length ? `Read + ${extras.join(" + ")}` : "Read only";
}

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "never");

export function buildScheduledPrompt(opts: { ownPrompt: string; channel: string; day: string; time: string }): string {
  const bare = opts.channel.trim().replace(/^#+/, "");
  const channel = `#${bare || "your-channel"}`;
  const own = opts.ownPrompt.trim();
  return [
    `Every ${opts.day} at ${opts.time || "8:00 AM"}, write my weekly update for the last 7 days.`,
    "",
    "Use LP Studio: call weekly_summary first for my accounts' engagement, page and microsite visits, and Partner Hub activity. Include links back to LP Studio.",
    "Also use my other connected tools (Salesforce, Attention, Slack and anything else connected) for deal movement, calls and conversations from the same week.",
    "",
    own ? `Write it like this:\n${own}` : "Write it as a short update: highlights, accounts heating up, what customers engaged with, and next steps.",
    "",
    `When it's done, post it to ${channel} in Slack.`,
  ].join("\n");
}

export function ClaudeConnectorContent() {
  const { toast } = useToast();
  const [mcpUrl, setMcpUrl] = useState("");
  const [connections, setConnections] = useState<Connection[] | null>(null);
  const [ownPrompt, setOwnPrompt] = useState("");
  const [channel, setChannel] = useState("");
  const [day, setDay] = useState("Monday");
  const [time, setTime] = useState("8:00 AM");

  const load = async () => {
    try {
      const res = await fetch("/api/claude-connector/connections");
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { mcpUrl: string; connections: Connection[] };
      setMcpUrl(data.mcpUrl);
      setConnections(data.connections);
    } catch {
      setMcpUrl(`${window.location.origin}/api/mcp`);
      setConnections([]);
    }
  };
  useEffect(() => {
    void load();
  }, []);

  const scheduled = useMemo(() => buildScheduledPrompt({ ownPrompt, channel, day, time }), [ownPrompt, channel, day, time]);

  async function disconnect(id: string) {
    const res = await fetch(`/api/claude-connector/connections/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (res.ok) {
      toast({ title: "Disconnected", description: "That Claude can no longer reach LP Studio." });
      void load();
    } else {
      toast({ title: "Couldn't disconnect", description: "Try again.", variant: "destructive" });
    }
  }

  return (
    <div className="space-y-8" data-testid="settings-claude">
      <section>
        <SettingsSectionHeader
          title="Use LP Studio in Claude"
          description="Let your own Claude read your LP Studio accounts, page engagement and Partner Hubs, and create drafts for you. If you allow it, Claude can also edit pages and publish them when you say so. It acts as you, in this workspace, and never sends anything."
        />
        <Card className="p-4 mt-3 space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground">Connector link</Label>
            <div className="flex gap-2 mt-1">
              <Input readOnly value={mcpUrl} className="font-mono text-xs" data-testid="claude-mcp-url" onFocus={(e) => e.currentTarget.select()} />
              <CopyButton text={mcpUrl} testId="claude-mcp-url-copy" />
            </div>
          </div>
          <ol className="text-sm space-y-2 list-decimal pl-5">
            <li>
              In Claude, open <strong>Settings → Connectors</strong> and choose <strong>Add custom connector</strong>.
            </li>
            <li>Name it “LP Studio”, paste the link above, and add it.</li>
            <li>
              Click <strong>Connect</strong>. LP Studio asks you to sign in and approve. Choose whether Claude may create drafts and edit pages. Already connected? Disconnect and connect again to turn on page editing.
            </li>
            <li>Try it in a chat: “What happened on my accounts in LP Studio this week?”</li>
          </ol>
          <p className="text-xs text-muted-foreground">
            If your company uses Claude for Teams or Enterprise, an admin may need to allow the connector first. Claude's menu names can change a little over time.
          </p>
        </Card>
      </section>

      <section>
        <SettingsSectionHeader
          title="Weekly update, posted to Slack"
          description="Build the prompt for a weekly scheduled task in Claude. Paste your own update prompt to keep your format."
        />
        <Card className="p-4 mt-3 space-y-4">
          <div>
            <Label htmlFor="claude-own-prompt" className="text-xs text-muted-foreground">
              Your update prompt (optional)
            </Label>
            <Textarea
              id="claude-own-prompt"
              value={ownPrompt}
              onChange={(e) => setOwnPrompt(e.target.value)}
              placeholder="Paste the prompt you use for your weekly update…"
              rows={4}
              className="mt-1"
              data-testid="claude-own-prompt"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label htmlFor="claude-channel" className="text-xs text-muted-foreground">
                Slack channel
              </Label>
              <Input id="claude-channel" value={channel} onChange={(e) => setChannel(e.target.value)} placeholder="#my-weekly-updates" className="mt-1" data-testid="claude-channel" />
            </div>
            <div>
              <Label htmlFor="claude-day" className="text-xs text-muted-foreground">
                Day
              </Label>
              <select
                id="claude-day"
                value={day}
                onChange={(e) => setDay(e.target.value)}
                className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {DAYS.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="claude-time" className="text-xs text-muted-foreground">
                Time
              </Label>
              <Input id="claude-time" value={time} onChange={(e) => setTime(e.target.value)} className="mt-1" />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Scheduled task prompt</Label>
              <CopyButton text={scheduled} label="Copy prompt" testId="claude-scheduled-copy" />
            </div>
            <pre className="mt-1 whitespace-pre-wrap rounded-md bg-muted p-3 text-xs" data-testid="claude-scheduled-prompt">
              {scheduled}
            </pre>
          </div>
          <p className="text-xs text-muted-foreground">
            In Claude, create a scheduled task, paste this prompt, and set it to repeat weekly. Your Slack, Salesforce and other connectors need to be connected in Claude too.
          </p>
        </Card>
      </section>

      <section>
        <SettingsSectionHeader title="Your Claude connections" description="Every Claude you've approved in this workspace. Disconnect one to cut its access right away." />
        <div className="mt-3 space-y-2">
          {connections === null ? (
            <Skeleton className="h-14 w-full" />
          ) : connections.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-testid="claude-no-connections">
              None yet.
            </p>
          ) : (
            connections.map((c) => (
              <Card key={c.id} className="px-4 py-3 flex items-center gap-3" data-testid="claude-connection">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{c.clientName || "Claude"}</div>
                  <div className="text-xs text-muted-foreground">
                    {accessLabel(c.scope)} · connected {fmt(c.createdAt)} · last used {fmt(c.lastUsedAt)}
                  </div>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => void disconnect(c.id)}>
                  <Unplug className="w-3.5 h-3.5 mr-1" /> Disconnect
                </Button>
              </Card>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
