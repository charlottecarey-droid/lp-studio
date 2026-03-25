import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CheckCircle2, XCircle, ExternalLink, TableProperties } from "lucide-react";

interface SheetsConfig {
  sheetId: string;
  serviceAccountEmail: string;
  privateKey: string;
  tabName: string;
}

interface SheetsState {
  enabled: boolean;
  config: SheetsConfig;
}

const DEFAULT_CONFIG: SheetsConfig = {
  sheetId: "",
  serviceAccountEmail: "",
  privateKey: "",
  tabName: "Leads",
};

export default function IntegrationsPage() {
  const [sheets, setSheets] = useState<SheetsState>({ enabled: false, config: DEFAULT_CONFIG });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; title?: string; error?: string } | null>(null);

  useEffect(() => {
    fetch("/api/lp/integrations/sheets")
      .then(r => r.json())
      .then((data: SheetsState) => {
        setSheets({
          enabled: data.enabled ?? false,
          config: { ...DEFAULT_CONFIG, ...(data.config ?? {}) },
        });
      })
      .finally(() => setLoading(false));
  }, []);

  const update = (field: keyof SheetsConfig, value: string) => {
    setSheets(s => ({ ...s, config: { ...s.config, [field]: value } }));
    setSaved(false);
    setTestResult(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await fetch("/api/lp/integrations/sheets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sheets),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/lp/integrations/sheets/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: sheets.config }),
      });
      const data = await res.json() as { ok: boolean; title?: string; error?: string };
      setTestResult(data);
    } finally {
      setTesting(false);
    }
  };

  const isConfigured = sheets.config.sheetId && sheets.config.serviceAccountEmail && sheets.config.privateKey;

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

        {/* Google Sheets */}
        <div className="rounded-2xl border border-border bg-white shadow-sm overflow-hidden">
          <div className="flex items-center gap-4 px-6 py-5 border-b border-border">
            <div className="w-10 h-10 rounded-xl bg-[#0F9D58]/10 flex items-center justify-center shrink-0">
              <TableProperties className="w-5 h-5 text-[#0F9D58]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">Google Sheets</p>
              <p className="text-xs text-muted-foreground">Append a row to a spreadsheet for each new lead</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={sheets.enabled}
                onChange={e => { setSheets(s => ({ ...s, enabled: e.target.checked })); setSaved(false); }}
              />
              <div className="w-10 h-6 bg-muted rounded-full peer peer-checked:bg-primary transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-4 shadow-inner" />
            </label>
          </div>

          <div className="px-6 py-6 space-y-5">
            {/* Setup guide */}
            <div className="rounded-xl bg-muted/50 border border-border px-4 py-3 text-xs text-muted-foreground space-y-1.5 leading-relaxed">
              <p className="font-semibold text-foreground text-[11px] uppercase tracking-wide mb-2">Setup steps</p>
              <p>1. Create a <strong>Service Account</strong> in <a href="https://console.cloud.google.com/iam-admin/serviceaccounts" target="_blank" rel="noopener noreferrer" className="underline text-foreground inline-flex items-center gap-0.5">Google Cloud Console <ExternalLink className="w-2.5 h-2.5" /></a> and enable the <strong>Google Sheets API</strong>.</p>
              <p>2. Download the <strong>JSON key</strong> for the service account.</p>
              <p>3. <strong>Share your Google Sheet</strong> with the service account email (Editor access).</p>
              <p>4. Paste the Sheet ID (from the URL), service account email, and private key below.</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Sheet ID</Label>
              <Input
                value={sheets.config.sheetId}
                onChange={e => update("sheetId", e.target.value)}
                placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
                className="font-mono text-sm h-9"
              />
              <p className="text-[11px] text-muted-foreground">Found in the spreadsheet URL: .../spreadsheets/d/<strong>ID</strong>/edit</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Service Account Email</Label>
              <Input
                value={sheets.config.serviceAccountEmail}
                onChange={e => update("serviceAccountEmail", e.target.value)}
                placeholder="my-bot@my-project.iam.gserviceaccount.com"
                className="font-mono text-sm h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Private Key</Label>
              <Textarea
                value={sheets.config.privateKey}
                onChange={e => update("privateKey", e.target.value)}
                placeholder={"-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"}
                className="font-mono text-xs h-28 resize-none"
              />
              <p className="text-[11px] text-muted-foreground">Paste the <code className="bg-muted px-1 rounded">private_key</code> value from the downloaded JSON key file.</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Tab / Sheet name</Label>
              <Input
                value={sheets.config.tabName}
                onChange={e => update("tabName", e.target.value)}
                placeholder="Leads"
                className="text-sm h-9 max-w-48"
              />
              <p className="text-[11px] text-muted-foreground">The tab will be created automatically if it doesn't exist.</p>
            </div>

            {/* Test result */}
            {testResult && (
              <div className={`flex items-start gap-2 rounded-xl px-4 py-3 text-sm border ${testResult.ok ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-800"}`}>
                {testResult.ok
                  ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-green-600" />
                  : <XCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />}
                <span>{testResult.ok ? `Connected — spreadsheet: "${testResult.title}"` : `Error: ${testResult.error}`}</span>
              </div>
            )}

            <div className="flex items-center gap-3 pt-1">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                disabled={testing || !isConfigured}
                onClick={handleTest}
              >
                {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                Test connection
              </Button>
              <Button
                size="sm"
                className="gap-2 min-w-20"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? <CheckCircle2 className="w-3.5 h-3.5" /> : null}
                {saved ? "Saved!" : "Save"}
              </Button>
            </div>
          </div>
        </div>

        {/* More integrations placeholder */}
        <div className="rounded-2xl border border-dashed border-border px-6 py-8 text-center">
          <p className="text-sm font-medium text-muted-foreground">More integrations coming soon</p>
          <p className="text-xs text-muted-foreground/60 mt-1">HubSpot, Salesforce, Slack notifications, and more</p>
        </div>
      </div>
    </AppLayout>
  );
}
