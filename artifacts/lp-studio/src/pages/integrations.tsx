import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CheckCircle2, XCircle, ExternalLink, TableProperties, Cloud, ClipboardCheck, Webhook, ChevronDown } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const MASKED = "••••••••";

interface SheetsConfig { sheetId: string; serviceAccountEmail: string; privateKey: string; tabName: string; }
interface SalesforceStatus { connected: boolean; status: string | null; orgId: string | null; instanceUrl: string | null; }
interface AsanaConfig { pat: string; workspaceId: string; projectId: string; defaultAssigneeGid: string; }
interface WebhookConfig { url: string; signingSecret: string; }

type TestResult = { ok: boolean; title?: string; error?: string };

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="relative inline-flex items-center cursor-pointer">
      <input type="checkbox" className="sr-only peer" checked={checked} onChange={e => onChange(e.target.checked)} />
      <div className="w-10 h-6 bg-muted rounded-full peer peer-checked:bg-primary transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-4 shadow-inner" />
    </label>
  );
}

function SaveRow({ saving, saved, onSave, testEl }: { saving: boolean; saved: boolean; onSave: () => void; testEl?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 pt-1">
      {testEl}
      <Button size="sm" className="gap-2 min-w-20" onClick={onSave} disabled={saving}>
        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? <CheckCircle2 className="w-3.5 h-3.5" /> : null}
        {saved ? "Saved!" : "Save"}
      </Button>
    </div>
  );
}

function TestBanner({ result }: { result: TestResult | null }) {
  if (!result) return null;
  return (
    <div className={`flex items-start gap-2 rounded-xl px-4 py-3 text-sm border ${result.ok ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-800"}`}>
      {result.ok ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-green-600" /> : <XCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />}
      <span>{result.ok ? (result.title ? `Connected — "${result.title}"` : "Connected successfully") : `Error: ${result.error}`}</span>
    </div>
  );
}

/** The numbered "how to set this up" note inside an open card. */
function SetupSteps({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground space-y-1 leading-relaxed">
      {children}
    </div>
  );
}

type CardKey = "sheets" | "salesforce" | "asana" | "webhook";

/**
 * One lead-delivery destination. Closed by default so the tab reads as a short
 * list — name, one line, and whether it's on; the setup form opens on click.
 */
function DeliveryCard({
  name, summary, icon, status, open, onToggleOpen, control, testId, children,
}: {
  name: string;
  summary: string;
  icon: React.ReactNode;
  status: "on" | "off" | "connected";
  open: boolean;
  onToggleOpen: () => void;
  /** The on/off switch, when the destination has one. */
  control?: React.ReactNode;
  testId?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card" data-testid={testId}>
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={onToggleOpen}
          aria-expanded={open}
          className="flex flex-1 min-w-0 items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
        >
          <span className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">{icon}</span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="font-medium text-sm">{name}</span>
              {status !== "off" && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="w-3 h-3" /> {status === "connected" ? "Connected" : "On"}
                </span>
              )}
            </span>
            <span className="block text-xs text-muted-foreground truncate">{summary}</span>
          </span>
          <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {control}
      </div>
      {open && <div className="border-t border-border px-4 py-4 space-y-4">{children}</div>}
    </div>
  );
}

export function IntegrationsContent() {
  const [loading, setLoading] = useState(true);
  // Which destination's setup form is open (one at a time).
  const [openCard, setOpenCard] = useState<CardKey | null>(null);
  const toggleCard = (key: CardKey) => setOpenCard(prev => (prev === key ? null : key));

  // Google Sheets state
  const [sheets, setSheets] = useState({ enabled: false, config: { sheetId: "", serviceAccountEmail: "", privateKey: "", tabName: "Leads" } as SheetsConfig });
  const [sheetsSaving, setSheetsSaving] = useState(false);
  const [sheetsSaved, setSheetsSaved] = useState(false);
  const [sheetsTesting, setSheetsTesting] = useState(false);
  const [sheetsResult, setSheetsResult] = useState<TestResult | null>(null);

  // Salesforce state — now an OAuth connection (mirrors the sales console)
  // instead of per-tenant client_credentials config.
  const [sf, setSf] = useState<SalesforceStatus>({ connected: false, status: null, orgId: null, instanceUrl: null });
  const [sfConnecting, setSfConnecting] = useState(false);
  const [sfDisconnecting, setSfDisconnecting] = useState(false);
  const [sfBanner, setSfBanner] = useState<TestResult | null>(null);

  // Asana state (page-review workflow, task #108)
  const [asana, setAsana] = useState({ enabled: false, config: { pat: "", workspaceId: "", projectId: "", defaultAssigneeGid: "" } as AsanaConfig });
  const [asanaSaving, setAsanaSaving] = useState(false);
  const [asanaSaved, setAsanaSaved] = useState(false);
  const [asanaTesting, setAsanaTesting] = useState(false);
  const [asanaResult, setAsanaResult] = useState<TestResult | null>(null);

  // Webhook state (campaign link export, task #981)
  const [webhook, setWebhook] = useState({ enabled: false, config: { url: "", signingSecret: "" } as WebhookConfig });
  const [webhookSaving, setWebhookSaving] = useState(false);
  const [webhookSaved, setWebhookSaved] = useState(false);
  const [webhookTesting, setWebhookTesting] = useState(false);
  const [webhookResult, setWebhookResult] = useState<TestResult | null>(null);

  const { user } = useAuth();
  const isAdmin = !!user?.isAdmin;

  useEffect(() => {
    Promise.all([
      fetch("/api/lp/integrations/sheets").then(r => r.json()),
      fetch("/api/lp/integrations/salesforce").then(r => r.json()),
      fetch("/api/lp/integrations/asana").then(r => r.ok ? r.json() : { enabled: false, config: {} }).catch(() => ({ enabled: false, config: {} })),
      fetch("/api/lp/integrations/webhook").then(r => r.ok ? r.json() : { enabled: false, config: {} }).catch(() => ({ enabled: false, config: {} })),
    ]).then(([s, sf, a, w]) => {
      setSheets({ enabled: s.enabled ?? false, config: { sheetId: "", serviceAccountEmail: "", privateKey: "", tabName: "Leads", ...(s.config ?? {}) } });
      setSf({ connected: sf.connected ?? false, status: sf.status ?? null, orgId: sf.orgId ?? null, instanceUrl: sf.instanceUrl ?? null });
      setAsana({ enabled: a.enabled ?? false, config: { pat: "", workspaceId: "", projectId: "", defaultAssigneeGid: "", ...(a.config ?? {}) } });
      setWebhook({ enabled: w.enabled ?? false, config: { url: "", signingSecret: "", ...(w.config ?? {}) } });
    }).finally(() => setLoading(false));
  }, []);

  // Handle the Salesforce OAuth callback redirect (?salesforce=connected|error).
  // Show a banner, refresh the connection status, and strip the query param so a
  // refresh doesn't re-trigger the banner.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sfResult = params.get("salesforce");
    if (!sfResult) return;
    setOpenCard("salesforce");
    if (sfResult === "connected") {
      setSfBanner({ ok: true, title: "Salesforce" });
      fetch("/api/lp/integrations/salesforce")
        .then(r => r.json())
        .then(d => setSf({ connected: d.connected ?? false, status: d.status ?? null, orgId: d.orgId ?? null, instanceUrl: d.instanceUrl ?? null }))
        .catch(() => {});
    } else {
      setSfBanner({ ok: false, error: "Salesforce connection failed. Please try again." });
    }
    params.delete("salesforce");
    const qs = params.toString();
    window.history.replaceState({}, "", window.location.pathname + (qs ? `?${qs}` : ""));
  }, []);

  // Sheets handlers
  const updateSheets = (field: keyof SheetsConfig, value: string) => { setSheets(s => ({ ...s, config: { ...s.config, [field]: value } })); setSheetsSaved(false); setSheetsResult(null); };
  const saveSheets = async () => {
    setSheetsSaving(true);
    await fetch("/api/lp/integrations/sheets", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sheets) });
    setSheetsSaving(false); setSheetsSaved(true); setTimeout(() => setSheetsSaved(false), 3000);
  };
  const testSheets = async () => {
    setSheetsTesting(true); setSheetsResult(null);
    const res = await fetch("/api/lp/integrations/sheets/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ config: sheets.config }) });
    setSheetsResult(await res.json()); setSheetsTesting(false);
  };

  // Salesforce handlers — one-click OAuth (mirrors the sales console). Connect
  // fetches the auth URL and hands the browser off to Salesforce; the callback
  // bounces back to this page with ?salesforce=connected|error.
  const connectSf = async () => {
    setSfConnecting(true); setSfBanner(null);
    try {
      const res = await fetch("/api/lp/integrations/salesforce/auth-url");
      const data = await res.json();
      if (data.url) { window.location.href = data.url; return; }
      setSfBanner({ ok: false, error: data.error || "Failed to start Salesforce connection" });
    } catch {
      setSfBanner({ ok: false, error: "Failed to start Salesforce connection" });
    }
    setSfConnecting(false);
  };
  const disconnectSf = async () => {
    setSfDisconnecting(true); setSfBanner(null);
    try {
      await fetch("/api/lp/integrations/salesforce/disconnect", { method: "POST" });
      setSf({ connected: false, status: null, orgId: null, instanceUrl: null });
    } catch {
      setSfBanner({ ok: false, error: "Failed to disconnect" });
    }
    setSfDisconnecting(false);
  };

  // Asana handlers
  const updateAsana = (field: keyof AsanaConfig, value: string) => { setAsana(s => ({ ...s, config: { ...s.config, [field]: value } })); setAsanaSaved(false); setAsanaResult(null); };
  const saveAsana = async () => {
    setAsanaSaving(true);
    await fetch("/api/lp/integrations/asana", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(asana) });
    setAsanaSaving(false); setAsanaSaved(true); setTimeout(() => setAsanaSaved(false), 3000);
  };
  const testAsana = async () => {
    setAsanaTesting(true); setAsanaResult(null);
    const res = await fetch("/api/lp/integrations/asana/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ config: asana.config }) });
    setAsanaResult(await res.json()); setAsanaTesting(false);
  };

  // Webhook handlers
  const updateWebhook = (field: keyof WebhookConfig, value: string) => { setWebhook(s => ({ ...s, config: { ...s.config, [field]: value } })); setWebhookSaved(false); setWebhookResult(null); };
  const saveWebhook = async () => {
    setWebhookSaving(true); setWebhookResult(null);
    const res = await fetch("/api/lp/integrations/webhook", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(webhook) });
    setWebhookSaving(false);
    if (!res.ok) {
      // The backend rejects invalid URLs with 400 — never show a false "Saved!".
      const err = await res.json().catch(() => ({ error: "Failed to save webhook settings." }));
      setWebhookResult({ ok: false, error: err.error ?? "Failed to save webhook settings." });
      return;
    }
    setWebhookSaved(true); setTimeout(() => setWebhookSaved(false), 3000);
  };
  const testWebhook = async () => {
    setWebhookTesting(true); setWebhookResult(null);
    const res = await fetch("/api/lp/integrations/webhook/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ config: webhook.config }) });
    setWebhookResult(await res.json()); setWebhookTesting(false);
  };

  const sheetsReady = !!(sheets.config.sheetId && sheets.config.serviceAccountEmail && sheets.config.privateKey);
  const asanaReady = !!(asana.config.pat && asana.config.workspaceId && asana.config.projectId);
  const webhookReady = !!(webhook.config.url);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        <span className="text-sm">Loading…</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* ── Google Sheets ── */}
      <DeliveryCard
        name="Google Sheets"
        summary="Add a row for each new lead."
        icon={<TableProperties className="w-4 h-4 text-[#0F9D58]" />}
        status={sheets.enabled ? "on" : "off"}
        open={openCard === "sheets"}
        onToggleOpen={() => toggleCard("sheets")}
        control={<Toggle checked={sheets.enabled} onChange={v => { setSheets(s => ({ ...s, enabled: v })); setSheetsSaved(false); setOpenCard("sheets"); }} />}
      >
        <SetupSteps>
          <p>1. Create a service account in <a href="https://console.cloud.google.com/iam-admin/serviceaccounts" target="_blank" rel="noopener noreferrer" className="underline text-foreground inline-flex items-center gap-0.5">Google Cloud Console <ExternalLink className="w-2.5 h-2.5" /></a>, turn on the Google Sheets API, and download its JSON key.</p>
          <p>2. Share your sheet with the service account email as an Editor.</p>
          <p>3. Fill in the fields below.</p>
        </SetupSteps>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Sheet ID</Label>
          <Input value={sheets.config.sheetId} onChange={e => updateSheets("sheetId", e.target.value)} placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms" className="font-mono text-sm h-9" />
          <p className="text-[11px] text-muted-foreground">In the sheet's URL: .../spreadsheets/d/<strong>ID</strong>/edit</p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Service account email</Label>
          <Input value={sheets.config.serviceAccountEmail} onChange={e => updateSheets("serviceAccountEmail", e.target.value)} placeholder="my-bot@my-project.iam.gserviceaccount.com" className="font-mono text-sm h-9" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Private key</Label>
          <Textarea value={sheets.config.privateKey} onChange={e => updateSheets("privateKey", e.target.value)} placeholder={"-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"} className="font-mono text-[14px] sm:text-xs h-28 resize-none" />
          <p className="text-[11px] text-muted-foreground">The <code className="bg-muted px-1 rounded">private_key</code> value from the JSON key.</p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Tab name</Label>
          <Input value={sheets.config.tabName} onChange={e => updateSheets("tabName", e.target.value)} placeholder="Leads" className="text-sm h-9 max-w-48" />
        </div>
        <TestBanner result={sheetsResult} />
        <SaveRow saving={sheetsSaving} saved={sheetsSaved} onSave={saveSheets} testEl={
          <Button variant="outline" size="sm" className="gap-2" disabled={sheetsTesting || !sheetsReady} onClick={testSheets}>
            {sheetsTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            Test connection
          </Button>
        } />
      </DeliveryCard>

      {/* Marketo moved: the connection (credentials + endpoints) lives on the
          Marketo card in Settings → Integrations → Connections, which opens
          /sales/marketo. Form-lead sync follows that single connection;
          per-form field mappings stay in Forms → Lead routing. */}

      {/* ── Salesforce (one-click OAuth) ── */}
      <DeliveryCard
        name="Salesforce leads"
        summary="Create a Lead for each form submission."
        icon={<Cloud className="w-4 h-4 text-[#00A1E0]" />}
        status={sf.connected ? "connected" : "off"}
        open={openCard === "salesforce"}
        onToggleOpen={() => toggleCard("salesforce")}
      >
        <p className="text-xs text-muted-foreground">
          {sf.connected ? (
            <>Connected{sf.instanceUrl ? <> to <code className="bg-muted px-1 rounded">{sf.instanceUrl}</code></> : null}. </>
          ) : (
            <>Sign in to Salesforce and approve access. No API keys needed. </>
          )}
          Choose which fields to send on each form, under <a href="/forms" className="underline text-foreground">Forms → Lead routing</a>.
        </p>
        <TestBanner result={sfBanner} />
        <div className="flex items-center gap-3">
          {sf.connected ? (
            <Button variant="outline" size="sm" className="gap-2" disabled={sfDisconnecting} onClick={disconnectSf}>
              {sfDisconnecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              Disconnect
            </Button>
          ) : (
            <Button size="sm" className="gap-2" disabled={sfConnecting} onClick={connectSf}>
              {sfConnecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Cloud className="w-3.5 h-3.5" />}
              Connect Salesforce
            </Button>
          )}
        </div>
      </DeliveryCard>

      {/* ── Asana (page-review workflow) ── */}
      {isAdmin && (
        <DeliveryCard
          name="Asana"
          summary="Create a task when a page is submitted for review."
          icon={<ClipboardCheck className="w-4 h-4 text-[#F06A6A]" />}
          status={asana.enabled ? "on" : "off"}
          open={openCard === "asana"}
          onToggleOpen={() => toggleCard("asana")}
          testId="asana-integration-card"
          control={<Toggle checked={asana.enabled} onChange={v => { setAsana(s => ({ ...s, enabled: v })); setAsanaSaved(false); setOpenCard("asana"); }} />}
        >
          <SetupSteps>
            <p>1. In Asana, go to My Settings → Apps → Manage Developer Apps and create a Personal Access Token.</p>
            <p>2. Project ID: the long number in the project's URL after <code className="bg-muted px-1 rounded">/0/</code>.</p>
            <p>3. Workspace ID: in Admin Console → Settings.</p>
          </SetupSteps>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Personal Access Token</Label>
            <Input
              type={asana.config.pat === MASKED ? "text" : "password"}
              value={asana.config.pat}
              onChange={e => updateAsana("pat", e.target.value)}
              placeholder="0/abc123..."
              className="font-mono text-sm h-9"
              data-testid="asana-pat-input"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Workspace ID</Label>
              <Input value={asana.config.workspaceId} onChange={e => updateAsana("workspaceId", e.target.value)} placeholder="1199876543210" className="font-mono text-sm h-9" data-testid="asana-workspace-input" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Project ID</Label>
              <Input value={asana.config.projectId} onChange={e => updateAsana("projectId", e.target.value)} placeholder="1209876543210" className="font-mono text-sm h-9" data-testid="asana-project-input" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Assignee ID <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input value={asana.config.defaultAssigneeGid} onChange={e => updateAsana("defaultAssigneeGid", e.target.value)} placeholder="1188888888888" className="font-mono text-sm h-9" data-testid="asana-assignee-input" />
            </div>
          </div>
          <TestBanner result={asanaResult} />
          <SaveRow saving={asanaSaving} saved={asanaSaved} onSave={saveAsana} testEl={
            <Button variant="outline" size="sm" className="gap-2" disabled={asanaTesting || !asanaReady} onClick={testAsana} data-testid="asana-test-button">
              {asanaTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              Test connection
            </Button>
          } />
        </DeliveryCard>
      )}

      {/* ── Webhook (campaign link export) ── */}
      <DeliveryCard
        name="Webhook"
        summary="Send exported campaign links to your own endpoint."
        icon={<Webhook className="w-4 h-4 text-foreground" />}
        status={webhook.enabled ? "on" : "off"}
        open={openCard === "webhook"}
        onToggleOpen={() => toggleCard("webhook")}
        testId="webhook-integration-card"
        control={<Toggle checked={webhook.enabled} onChange={v => { setWebhook(s => ({ ...s, enabled: v })); setWebhookSaved(false); setOpenCard("webhook"); }} />}
      >
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Endpoint URL</Label>
          <Input
            value={webhook.config.url}
            onChange={e => updateWebhook("url", e.target.value)}
            placeholder="https://example.com/hooks/lp-studio"
            className="font-mono text-sm h-9"
            data-testid="webhook-url-input"
          />
          <p className="text-[11px] text-muted-foreground">Must be a public HTTPS address.</p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Signing secret <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <Input
            type={webhook.config.signingSecret === MASKED ? "text" : "password"}
            value={webhook.config.signingSecret}
            onChange={e => updateWebhook("signingSecret", e.target.value)}
            placeholder="whsec_..."
            className="font-mono text-sm h-9"
            data-testid="webhook-secret-input"
          />
          <p className="text-[11px] text-muted-foreground">Each request is signed in the <code className="bg-muted px-1 rounded">X-LPStudio-Signature</code> header (HMAC-SHA256).</p>
        </div>
        <TestBanner result={webhookResult} />
        <SaveRow saving={webhookSaving} saved={webhookSaved} onSave={saveWebhook} testEl={
          <Button variant="outline" size="sm" className="gap-2" disabled={webhookTesting || !webhookReady} onClick={testWebhook} data-testid="webhook-test-button">
            {webhookTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            Send test
          </Button>
        } />
      </DeliveryCard>
    </div>
  );
}

export default function IntegrationsPage() {
  return (
    <AppLayout>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground">Integrations</h1>
          <p className="text-sm text-muted-foreground mt-1">Connect LP Studio to external services. Leads are synced automatically after each form submission.</p>
        </div>
        <IntegrationsContent />
      </div>
    </AppLayout>
  );
}
