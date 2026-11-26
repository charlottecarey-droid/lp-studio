/**
 * /connect/claude?request=… — the consent screen Claude sends a rep to when
 * they connect LP Studio. AuthGate signs them in first (and brings them back
 * here). Approving mints a one-time code and sends the browser back to
 * Claude. Server: routes/mcp.ts (/api/oauth/requests/:id[/decision]).
 */
import { useEffect, useState } from "react";
import { useSearch } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, FilePen, FilePlus2, ShieldCheck } from "lucide-react";

interface RequestInfo {
  clientName: string;
  redirectHost: string;
  canAskForDrafts: boolean;
  canAskForPages?: boolean;
  user: { name: string; email: string };
  workspace: { id: number; name: string } | null;
}

export default function ClaudeConnectPage() {
  const search = useSearch();
  const requestId = new URLSearchParams(search).get("request") ?? "";
  const [info, setInfo] = useState<RequestInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [allowDrafts, setAllowDrafts] = useState(true);
  const [allowPages, setAllowPages] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!requestId) {
      setError("This link is missing its connection request. Start again from Claude.");
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/api/oauth/requests/${encodeURIComponent(requestId)}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error((data as { error?: string }).error || "This connection request has expired. Start again from Claude.");
        setInfo(data as RequestInfo);
        setAllowDrafts((data as RequestInfo).canAskForDrafts);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    })();
  }, [requestId]);

  async function decide(approve: boolean) {
    setBusy(true);
    try {
      const res = await fetch(`/api/oauth/requests/${encodeURIComponent(requestId)}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approve, allowDrafts, allowPages }),
      });
      const data = (await res.json().catch(() => ({}))) as { redirectUrl?: string; error?: string };
      if (!res.ok || !data.redirectUrl) throw new Error(data.error || "Couldn't finish connecting. Start again from Claude.");
      window.location.assign(data.redirectUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md p-6 space-y-5" data-testid="claude-consent">
        {error ? (
          <>
            <h1 className="text-lg font-semibold">Couldn't connect Claude</h1>
            <p className="text-sm text-muted-foreground" data-testid="claude-consent-error">
              {error}
            </p>
          </>
        ) : !info ? (
          <div className="space-y-3">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : !info.workspace ? (
          <>
            <h1 className="text-lg font-semibold">Join a workspace first</h1>
            <p className="text-sm text-muted-foreground">You need to be a member of an LP Studio workspace to connect Claude.</p>
          </>
        ) : (
          <>
            <div>
              <h1 className="text-lg font-semibold">Connect {info.clientName} to LP Studio?</h1>
              <p className="text-sm text-muted-foreground mt-1">
                It will act as <strong>{info.user.name || info.user.email}</strong> in the <strong>{info.workspace.name || "current"}</strong> workspace. To use a different workspace, switch to it first, then connect again from Claude.
              </p>
            </div>
            <ul className="space-y-3 text-sm">
              <li className="flex gap-2">
                <BookOpen className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
                <span>Read your accounts, contacts, engagement signals, pages and Partner Hubs: the same things you can see in LP Studio.</span>
              </li>
              {info.canAskForDrafts && (
                <li className="flex gap-2">
                  <FilePlus2 className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
                  <div className="space-y-2">
                    <span>Create drafts: microsites, Partner Hubs and email drafts. Nothing gets published or sent. You review drafts in LP Studio.</span>
                    <div className="flex items-center gap-2">
                      <Checkbox id="allow-drafts" checked={allowDrafts} onCheckedChange={(v) => setAllowDrafts(v === true)} data-testid="claude-allow-drafts" />
                      <Label htmlFor="allow-drafts" className="text-sm font-normal">
                        Allow drafts
                      </Label>
                    </div>
                  </div>
                </li>
              )}
              {info.canAskForPages && (
                <li className="flex gap-2">
                  <FilePen className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
                  <div className="space-y-2">
                    <span>
                      Edit pages: create, duplicate and change pages, restore earlier versions, and publish or unpublish when you say so. Changes to a live page show up on the live page. Every change is saved in the page's version history.
                    </span>
                    <div className="flex items-center gap-2">
                      <Checkbox id="allow-pages" checked={allowPages} onCheckedChange={(v) => setAllowPages(v === true)} data-testid="claude-allow-pages" />
                      <Label htmlFor="allow-pages" className="text-sm font-normal">
                        Allow page editing
                      </Label>
                    </div>
                  </div>
                </li>
              )}
              <li className="flex gap-2">
                <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
                <span>You can disconnect any time in Settings → Claude.</span>
              </li>
            </ul>
            <p className="text-xs text-muted-foreground">You'll be sent back to {info.redirectHost}.</p>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" disabled={busy} onClick={() => void decide(false)} data-testid="claude-consent-deny">
                Cancel
              </Button>
              <Button type="button" variant="brand" disabled={busy} onClick={() => void decide(true)} data-testid="claude-consent-approve">
                Connect
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
