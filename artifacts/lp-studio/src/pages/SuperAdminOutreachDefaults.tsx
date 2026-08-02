import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send, RefreshCw, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  DEFAULT_OUTREACH_SUBJECT,
  DEFAULT_OUTREACH_INTRO,
  buildOutreachEmail,
} from "@/lib/email-preview";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const ENDPOINT = `${BASE}/api/admin/lp/outreach-defaults`;

interface OutreachData {
  subject: string;
  intro: string;
}

const EMPTY: OutreachData = { subject: "", intro: "" };

function normalize(data: unknown): OutreachData {
  const d = (data ?? {}) as Record<string, unknown>;
  return {
    subject: typeof d.subject === "string" ? d.subject : "",
    intro: typeof d.intro === "string" ? d.intro : "",
  };
}

/**
 * Superadmin panel for the platform-wide outreach draft copy — the subject and
 * opening lines prefilled into the email a rep opens from Pages → Copy email
 * preview.
 *
 * This is the default-of-the-default. A workspace that sets its own copy in
 * Settings → Email → Sending always wins, so editing here only moves the
 * workspaces that left theirs blank. Blank here in turn falls back to the
 * built-in constants, which is why the fields show those as placeholders.
 */
export default function SuperAdminOutreachDefaults() {
  const { toast } = useToast();
  const [data, setData] = useState<OutreachData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(ENDPOINT, { credentials: "include" });
      if (!res.ok) throw new Error(String(res.status));
      setData(normalize(await res.json()));
    } catch {
      /* best-effort — panel starts empty; auth errors surface via the page guard */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(ENDPOINT, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ subject: data.subject, intro: data.intro }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Save failed");
      }
      setData(normalize(await res.json()));
      toast({
        title: "Outreach defaults saved",
        description: "Workspaces that haven't set their own copy will use this on their next draft.",
      });
    } catch (err) {
      toast({
        title: "Save failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Live preview against a representative contact/page so an operator can see
  // exactly what a rep's draft opens with — including how a token resolves.
  const preview = buildOutreachEmail({
    firstName: "Maya",
    pageTitle: "Northwind — Custom Proposal",
    url: "https://pages.example.com/p/a1b2c3",
    subjectTemplate: data.subject,
    introTemplate: data.intro,
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <Card className="p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold flex items-center gap-2">
              <Send className="w-4 h-4 text-primary" /> Outreach draft defaults
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Prefills the email a rep opens from <span className="font-medium text-foreground">Pages → Copy email preview</span>.
              A workspace that sets its own copy in Settings → Email → Sending overrides this, so
              editing here only moves workspaces that left theirs blank. Leave a field empty to use
              the built-in wording shown as the placeholder.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={saving} className="gap-2 shrink-0">
            <RefreshCw className="w-3.5 h-3.5" /> Reload
          </Button>
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm">Subject</Label>
          <Input
            value={data.subject}
            onChange={e => setData(d => ({ ...d, subject: e.target.value }))}
            placeholder={DEFAULT_OUTREACH_SUBJECT}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm">Opening lines</Label>
          <Textarea
            rows={4}
            value={data.intro}
            onChange={e => setData(d => ({ ...d, intro: e.target.value }))}
            placeholder={DEFAULT_OUTREACH_INTRO}
          />
          <p className="text-xs text-muted-foreground">
            Tokens: <code className="text-[11px]">{"{{first_name}}"}</code> ·{" "}
            <code className="text-[11px]">{"{{page_title}}"}</code>. The page link is appended
            automatically. Keep this plain — every workspace without its own copy sends this exact
            wording, so it should read neutral rather than clever.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Preview — a rep emailing Maya about "Northwind — Custom Proposal"
          </p>
          <p className="text-xs">
            <span className="text-muted-foreground">Subject: </span>
            <span className="font-medium text-foreground">{preview.subject}</span>
          </p>
          <pre className="text-xs text-foreground whitespace-pre-wrap font-sans leading-relaxed">{preview.body.trimEnd()}</pre>
        </div>

        <div className="flex justify-end">
          <Button variant="brand" onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </Button>
        </div>
      </Card>
    </div>
  );
}
