/**
 * Settings → Integrations → "Visitor identification" section.
 *
 * Manages the per-tenant webhook URLs that RB2B, Apollo, and Letterdrop POST
 * visitor/lead identification events to (api-server routes/webhooks.ts). Each
 * URL embeds a rotating secret (schema: tenantWebhookSecrets); this section is
 * the only UI for viewing, generating, rotating, and disabling them — before
 * it existed the secrets were visible once in a migration log line and then
 * only via SQL.
 *
 * Rotating or disabling invalidates the current URL immediately (the provider
 * dashboard keeps POSTing to a URL that now 404s), so both actions confirm
 * first. Endpoints are plan-gated with the Sales Console (402 → upgrade hint),
 * matching where the resulting signals surface.
 */
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/hooks/use-toast";
import { Check, CheckCircle2, Copy, Loader2, Lock, RefreshCw, Trash2, Webhook } from "lucide-react";

const API_BASE = "/api";

type Integration = "rb2b" | "apollo" | "letterdrop";

interface WebhookSecretEntry {
  integration: Integration;
  secret: string | null;
  createdAt: string | null;
}

const PROVIDERS: Array<{ key: Integration; name: string; description: string; accent: string }> = [
  {
    key: "rb2b",
    name: "RB2B",
    description: "Identifies LinkedIn users visiting your landing pages.",
    accent: "#0A66C2",
  },
  {
    key: "apollo",
    name: "Apollo",
    description: "Identifies companies (and sometimes people) visiting your pages via the Apollo website tracker.",
    accent: "#FBBF24",
  },
  {
    key: "letterdrop",
    name: "Letterdrop",
    description: "Sends leads who engaged with your LinkedIn content or visited your pages.",
    accent: "#7C3AED",
  },
];

function webhookUrl(integration: Integration, secret: string): string {
  return `${window.location.origin}/api/webhooks/${integration}/${secret}`;
}

export function VisitorWebhooksSection() {
  const { toast } = useToast();
  const [entries, setEntries] = useState<Record<string, WebhookSecretEntry>>({});
  const [loading, setLoading] = useState(true);
  const [planLocked, setPlanLocked] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState<Integration | null>(null);
  const [copied, setCopied] = useState<Integration | null>(null);
  const [confirming, setConfirming] = useState<{ integration: Integration; action: "rotate" | "disable" } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/sales/webhook-secrets`);
        if (cancelled) return;
        if (res.status === 402) {
          setPlanLocked(true);
        } else if (res.ok) {
          const data = (await res.json()) as { secrets: WebhookSecretEntry[] };
          if (!cancelled) {
            setEntries(Object.fromEntries(data.secrets.map((s) => [s.integration, s])));
          }
        } else {
          setLoadError(true);
        }
      } catch {
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const copyUrl = async (integration: Integration, secret: string) => {
    try {
      await navigator.clipboard.writeText(webhookUrl(integration, secret));
      setCopied(integration);
      setTimeout(() => setCopied((c) => (c === integration ? null : c)), 2000);
    } catch {
      toast({ title: "Copy failed", description: "Select the URL and copy it manually.", variant: "destructive" });
    }
  };

  const rotate = async (integration: Integration) => {
    setBusy(integration);
    try {
      const res = await fetch(`${API_BASE}/sales/webhook-secrets/${integration}/rotate`, { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const row = (await res.json()) as WebhookSecretEntry;
      setEntries((prev) => ({ ...prev, [integration]: row }));
      const hadSecret = Boolean(entries[integration]?.secret);
      toast({
        title: hadSecret ? "Webhook URL rotated" : "Webhook URL generated",
        description: hadSecret
          ? "The old URL stopped working. Paste the new URL into the provider's dashboard."
          : "Copy the URL into the provider's webhook settings.",
      });
    } catch {
      toast({ title: "Something went wrong", description: "Could not update the webhook. Try again.", variant: "destructive" });
    } finally {
      setBusy(null);
      setConfirming(null);
    }
  };

  const disable = async (integration: Integration) => {
    setBusy(integration);
    try {
      const res = await fetch(`${API_BASE}/sales/webhook-secrets/${integration}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setEntries((prev) => ({ ...prev, [integration]: { integration, secret: null, createdAt: null } }));
      toast({ title: "Webhook disabled", description: "Its URL now returns 404; incoming events are ignored." });
    } catch {
      toast({ title: "Something went wrong", description: "Could not disable the webhook. Try again.", variant: "destructive" });
    } finally {
      setBusy(null);
      setConfirming(null);
    }
  };

  return (
    <section>
      <h2 className="text-lg font-semibold">Visitor identification</h2>
      <p className="text-sm text-muted-foreground mt-0.5 mb-4">
        De-anonymization providers POST visitor and lead events to a webhook URL unique to your
        workspace. Paste the URL into the provider's dashboard; identified visitors appear as
        signals in the Sales Console. Rotating a URL immediately invalidates the old one.
      </p>
      {planLocked ? (
        <Card className="p-4 border border-border/40 flex items-center gap-3">
          <Lock className="w-4 h-4 text-muted-foreground shrink-0" />
          <p className="text-sm text-muted-foreground">
            Visitor identification webhooks are part of the Sales Console, which isn't included in
            your current plan.
          </p>
        </Card>
      ) : loadError ? (
        <Card className="p-4 border border-border/40">
          <p className="text-sm text-muted-foreground">Couldn't load webhook settings. Refresh to try again.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {PROVIDERS.map((p) => {
            const entry = entries[p.key];
            const secret = entry?.secret ?? null;
            const isBusy = busy === p.key;
            return (
              <Card key={p.key} className="p-4 border border-border/40" data-testid={`webhook-card-${p.key}`}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${p.accent}1A` }}>
                    <Webhook className="w-5 h-5" style={{ color: p.accent }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold leading-tight">{p.name}</h3>
                      {loading ? (
                        <Skeleton className="h-5 w-20" />
                      ) : secret ? (
                        <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
                          <CheckCircle2 className="w-3 h-3 mr-1" /> Active
                        </Badge>
                      ) : (
                        <Badge className="bg-muted text-muted-foreground">Not set up</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>
                  </div>
                  {!loading && !secret && (
                    <Button
                      size="sm"
                      disabled={isBusy}
                      onClick={() => rotate(p.key)}
                      data-testid={`webhook-generate-${p.key}`}
                    >
                      {isBusy ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null}
                      Generate URL
                    </Button>
                  )}
                </div>
                {!loading && secret && (
                  <div className="mt-3 flex items-center gap-2">
                    <Input
                      readOnly
                      value={webhookUrl(p.key, secret)}
                      className="font-mono text-xs"
                      onFocus={(e) => e.currentTarget.select()}
                      data-testid={`webhook-url-${p.key}`}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyUrl(p.key, secret)}
                      data-testid={`webhook-copy-${p.key}`}
                    >
                      {copied === p.key ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isBusy}
                      onClick={() => setConfirming({ integration: p.key, action: "rotate" })}
                      data-testid={`webhook-rotate-${p.key}`}
                    >
                      <RefreshCw className="w-4 h-4 mr-1.5" /> Rotate
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isBusy}
                      className="text-destructive hover:text-destructive"
                      onClick={() => setConfirming({ integration: p.key, action: "disable" })}
                      data-testid={`webhook-disable-${p.key}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
      <ConfirmDialog
        open={confirming !== null}
        onOpenChange={(open) => { if (!open) setConfirming(null); }}
        title={confirming?.action === "disable" ? "Disable this webhook?" : "Rotate this webhook URL?"}
        description={
          confirming?.action === "disable"
            ? "The current URL stops working immediately and incoming events are ignored until you generate a new URL."
            : "The current URL stops working immediately. You must paste the new URL into the provider's dashboard or events will be lost."
        }
        confirmLabel={confirming?.action === "disable" ? "Disable" : "Rotate URL"}
        destructive={confirming?.action === "disable"}
        loading={busy !== null}
        onConfirm={() => {
          if (!confirming) return;
          if (confirming.action === "disable") void disable(confirming.integration);
          else void rotate(confirming.integration);
        }}
      />
    </section>
  );
}
