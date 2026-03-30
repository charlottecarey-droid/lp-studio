import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CheckCircle2, XCircle, ExternalLink, TableProperties, Zap, Cloud } from "lucide-react";

const MASKED = "••••••••";

interface SheetsConfig { sheetId: string; serviceAccountEmail: string; privateKey: string; tabName: string; }
interface MarketoConfig { munchkinId: string; clientId: string; clientSecret: string; }
interface SalesforceConfig { instanceUrl: string; clientId: string; clientSecret: string; }

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

export default function IntegrationsPage() {
  const [loading, setLoading] = useState(true);

  // Google Sheets state
  const [sheets, setSheets] = useState({ enabled: false, config: { sheetId: "", serviceAccountEmail: "", privateKey: "", tabName: "Leads" } as SheetsConfig });
  const [sheetsSaving, setSheetsSaving] = useState(false);
  const [sheetsSaved, setSheetsSaved] = useState(false);
  const [sheetsTesting, setSheetsTesting] = useState(false);
  const [sheetsResult, setSheetsResult] = useState<TestResult | null>(null);

  // Marketo state
  const [marketo, setMarketo] = useState({ enabled: false, config: { munchkinId: "", clientId: "", clientSecret: "" } as MarketoConfig });
  const [marketoSaving, setMarketoSaving] = useState(false);
  const [marketoSaved, setMarketoSaved] = useState(false);
  const [marketoTesting, setMarketoTesting] = useState(false);
  const [marketoResult, setMarketoResult] = useState<TestResult | null>(null);

  // Salesforce state
  const [sf, setSf] = useState({ enabled: false, config: { instanceUrl: "", clientId: "", clientSecret: "" } as SalesforceConfig });
  const [sfSaving, setSfSaving] = useState(false);
  const [sfSaved, setSfSaved] = useState(false);
  const [sfTesting, setSfTesting] = useState(false);
  const [sfResult, setSfResult] = useState<TestResult | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/lp/integrations/sheets").then(r => r.json()),
      fetch("/api/lp/integrations/marketo").then(r => r.json()),
      fetch("/api/lp/integrations/salesforce").then(r => r.json()),
    ]).then(([s, m, sf]) => {
      setSheets({ enabled: s.enabled ?? false, config: { sheetId: "", serviceAccountEmail: "", privateKey: "", tabName: "Leads", ...(s.config ?? {}) } });
      setMarketo({ enabled: m.enabled ?? false, config: { munchkinId: "", clientId: "", clientSecret: "", ...(m.config ?? {}) } });
      setSf({ enabled: sf.enabled ?? false, config: { instanceUrl: "", clientId: "", clientSecret: "", ...(sf.config ?? {}) } });
    }).finally(() => setLoading(false));
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

  // Marketo handlers
  const updateMarketo = (field: keyof MarketoConfig, value: string) => { setMarketo(s => ({ ...s, config: { ...s.config, [field]: value } })); setMarketoSaved(false); setMarketoResult(null); };
  const saveMarketo = async () => {
    setMarketoSaving(true);
    await fetch("/api/lp/integrations/marketo", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(marketo) });
    setMarketoSaving(false); setMarketoSaved(true); setTimeout(() => setMarketoSaved(false), 3000);
  };
  const testMarketo = async () => {
    setMarketoTesting(true); setMarketoResult(null);
    const res = await fetch("/api/lp/integrations/marketo/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ config: marketo.config }) });
    setMarketoResult(await res.json()); setMarketoTesting(false);
  };

  // Salesforce handlers
  const updateSf = (field: keyof SalesforceConfig, value: string) => { setSf(s => ({ ...s, config: { ...s.config, [field]: value } })); setSfSaved(false); setSfResult(null); };
  const saveSf = async () => {
    setSfSaving(true);
    await fetch("/api/lp/integrations/salesforce", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sf) });
    setSfSaving(false); setSfSaved(true); setTimeout(() => setSfSaved(false), 3000);
  };
  const testSf = async () => {
    setSfTesting(true); setSfResult(null);
    const res = await fetch("/api/lp/integrations/salesforce/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ config: sf.config }) });
    setSfResult(await res.json()); setSfTesting(false);
  };

  const sheetsReady = !!(sheets.config.sheetId && sheets.config.serviceAccountEmail && sheets.config.privateKey);
  const marketoReady = !!(marketo.config.munchkinId && marketo.config.clientId && marketo.config.clientSecret);
  const sfReady = !!(sf.config.instanceUrl && sf.config.clientId && sf.config.clientSecret);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          <span className="text-sm">Loading…</span>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-10">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Integrations</h1>
          <p className="text-sm text-muted-foreground mt-1">Connect LP Studio to external services. Leads are synced automatically after each form submission.</p>
        </div>

        {/* ── Google Sheets ── */}
        <div className="rounded-2xl border border-border bg-white shadow-sm overflow-hidden">
          <div className="flex items-center gap-4 px-6 py-5 border-b border-border">
            <div className="w-10 h-10 rounded-xl bg-[#0F9D58]/10 flex items-center justify-center shrink-0">
              <TableProperties className="w-5 h-5 text-[#0F9D58]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">Google Sheets</p>
              <p className="text-xs text-muted-foreground">Append a row to a spreadsheet for each new lead</p>
            </div>
            <Toggle checked={sheets.enabled} onChange={v => { setSheets(s => ({ ...s, enabled: v })); setSheetsSaved(false); }} />
          </div>
          <div className="px-6 py-6 space-y-5">
            <div className="rounded-xl bg-muted/50 border border-border px-4 py-3 text-xs text-muted-foreground space-y-1.5 leading-relaxed">
              <p className="font-semibold text-foreground text-[11px] uppercase tracking-wide mb-2">Setup steps</p>
              <p>1. Create a <strong>Service Account</strong> in <a href="https://console.cloud.google.com/iam-admin/serviceaccounts" target="_blank" rel="noopener noreferrer" className="underline text-foreground inline-flex items-center gap-0.5">Google Cloud Console <ExternalLink className="w-2.5 h-2.5" /></a> and enable the <strong>Google Sheets API</strong>.</p>
              <p>2. Download the <strong>JSON key</strong> for the service account.</p>
              <p>3. <strong>Share your Google Sheet</strong> with the service account email (Editor access).</p>
              <p>4. Paste the Sheet ID (from the URL), service account email, and private key below.</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Sheet ID</Label>
              <Input value={sheets.config.sheetId} onChange={e => updateSheets("sheetId", e.target.value)} placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms" className="font-mono text-sm h-9" />
              <p className="text-[11px] text-muted-foreground">Found in the spreadsheet URL: .../spreadsheets/d/<strong>ID</strong>/edit</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Service Account Email</Label>
              <Input value={sheets.config.serviceAccountEmail} onChange={e => updateSheets("serviceAccountEmail", e.target.value)} placeholder="my-bot@my-project.iam.gserviceaccount.com" className="font-mono text-sm h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Private Key</Label>
              <Textarea value={sheets.config.privateKey} onChange={e => updateSheets("privateKey", e.target.value)} placeholder={"-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"} className="font-mono text-xs h-28 resize-none" />
              <p className="text-[11px] text-muted-foreground">Paste the <code className="bg-muted px-1 rounded">private_key</code> value from the downloaded JSON key file.</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Tab / Sheet name</Label>
              <Input value={sheets.config.tabName} onChange={e => updateSheets("tabName", e.target.value)} placeholder="Leads" className="text-sm h-9 max-w-48" />
              <p className="text-[11px] text-muted-foreground">The tab will be created automatically if it doesn't exist.</p>
            </div>
            <TestBanner result={sheetsResult} />
            <SaveRow saving={sheetsSaving} saved={sheetsSaved} onSave={saveSheets} testEl={
              <Button variant="outline" size="sm" className="gap-2" disabled={sheetsTesting || !sheetsReady} onClick={testSheets}>
                {sheetsTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                Test connection
              </Button>
            } />
          </div>
        </div>

        {/* ── Marketo ── */}
        <div className="rounded-2xl border border-border bg-white shadow-sm overflow-hidden">
          <div className="flex items-center gap-4 px-6 py-5 border-b border-border">
            <div className="w-10 h-10 rounded-xl bg-[#5C4EE5]/10 flex items-center justify-center shrink-0">
              <Zap className="w-5 h-5 text-[#5C4EE5]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">Marketo</p>
              <p className="text-xs text-muted-foreground">Sync leads to Marketo as new contacts. Field mappings are configured per-form.</p>
            </div>
            <Toggle checked={marketo.enabled} onChange={v => { setMarketo(s => ({ ...s, enabled: v })); setMarketoSaved(false); }} />
          </div>
          <div className="px-6 py-6 space-y-5">
            <div className="rounded-xl bg-muted/50 border border-border px-4 py-3 text-xs text-muted-foreground space-y-1.5 leading-relaxed">
              <p className="font-semibold text-foreground text-[11px] uppercase tracking-wide mb-2">Setup steps</p>
              <p>1. In Marketo Admin, go to <strong>LaunchPoint</strong> → <strong>New Service</strong> → select <strong>Custom</strong> to create an API-only user.</p>
              <p>2. Under <strong>Admin → Web Services</strong>, find your <strong>Munchkin ID</strong> and the <strong>REST API</strong> client credentials.</p>
              <p>3. Paste them below. Field mappings (which form fields go to which Marketo fields) are set <a href="/forms" className="underline text-foreground">per-form in Forms → Notifications</a>.</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Munchkin ID</Label>
              <Input value={marketo.config.munchkinId} onChange={e => updateMarketo("munchkinId", e.target.value)} placeholder="123-ABC-456" className="font-mono text-sm h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Client ID</Label>
              <Input value={marketo.config.clientId} onChange={e => updateMarketo("clientId", e.target.value)} className="font-mono text-sm h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Client Secret</Label>
              <Input
                type={marketo.config.clientSecret === MASKED ? "text" : "password"}
                value={marketo.config.clientSecret}
                onChange={e => updateMarketo("clientSecret", e.target.value)}
                className="font-mono text-sm h-9"
              />
            </div>
            <TestBanner result={marketoResult} />
            <SaveRow saving={marketoSaving} saved={marketoSaved} onSave={saveMarketo} testEl={
              <Button variant="outline" size="sm" className="gap-2" disabled={marketoTesting || !marketoReady} onClick={testMarketo}>
                {marketoTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                Test connection
              </Button>
            } />
          </div>
        </div>

        {/* ── Salesforce ── */}
        <div className="rounded-2xl border border-border bg-white shadow-sm overflow-hidden">
          <div className="flex items-center gap-4 px-6 py-5 border-b border-border">
            <div className="w-10 h-10 rounded-xl bg-[#00A1E0]/10 flex items-center justify-center shrink-0">
              <Cloud className="w-5 h-5 text-[#00A1E0]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">Salesforce</p>
              <p className="text-xs text-muted-foreground">Create Lead records in Salesforce for each form submission. Field mappings are configured per-form.</p>
            </div>
            <Toggle checked={sf.enabled} onChange={v => { setSf(s => ({ ...s, enabled: v })); setSfSaved(false); }} />
          </div>
          <div className="px-6 py-6 space-y-5">
            <div className="rounded-xl bg-muted/50 border border-border px-4 py-3 text-xs text-muted-foreground space-y-1.5 leading-relaxed">
              <p className="font-semibold text-foreground text-[11px] uppercase tracking-wide mb-2">Setup steps</p>
              <p>1. In Salesforce Setup, go to <strong>App Manager → New Connected App</strong>. Enable OAuth, add the <code className="bg-muted px-1 rounded">client_credentials</code> flow, and select the <strong>Manage User Data via APIs</strong> scope.</p>
              <p>2. Copy the <strong>Consumer Key</strong> (Client ID) and <strong>Consumer Secret</strong> (Client Secret).</p>
              <p>3. Your <strong>Instance URL</strong> is the base of your Salesforce org URL (e.g. <code className="bg-muted px-1 rounded">https://yourorg.my.salesforce.com</code>).</p>
              <p>4. Field mappings (which form fields map to which Salesforce Lead fields) are set <a href="/forms" className="underline text-foreground">per-form in Forms → Notifications</a>.</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Instance URL</Label>
              <Input value={sf.config.instanceUrl} onChange={e => updateSf("instanceUrl", e.target.value)} placeholder="https://yourorg.my.salesforce.com" className="font-mono text-sm h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Client ID (Consumer Key)</Label>
              <Input value={sf.config.clientId} onChange={e => updateSf("clientId", e.target.value)} className="font-mono text-sm h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Client Secret (Consumer Secret)</Label>
              <Input
                type={sf.config.clientSecret === MASKED ? "text" : "password"}
                value={sf.config.clientSecret}
                onChange={e => updateSf("clientSecret", e.target.value)}
                className="font-mono text-sm h-9"
              />
            </div>
            <TestBanner result={sfResult} />
            <SaveRow saving={sfSaving} saved={sfSaved} onSave={saveSf} testEl={
              <Button variant="outline" size="sm" className="gap-2" disabled={sfTesting || !sfReady} onClick={testSf}>
                {sfTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                Test connection
              </Button>
            } />
          </div>
        </div>

        {/* More coming soon */}
        <div className="rounded-2xl border border-dashed border-border px-6 py-8 text-center">
          <p className="text-sm font-medium text-muted-foreground">More integrations coming soon</p>
          <p className="text-xs text-muted-foreground/60 mt-1">HubSpot, Slack notifications, and more</p>
        </div>
      </div>
    </AppLayout>
  );
}
