import { useState, useEffect, useRef } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { EmailWYSIWYGEditor, type EmailEditorHandle } from "@/components/EmailWYSIWYGEditor";
import { Plus, ExternalLink } from "lucide-react";

const API_BASE = "/api";
const DANDY_BANNER_URL = "https://jrvgnqdxmitmktyazyuq.supabase.co/storage/v1/object/public/skin-images/dandy-email-banner.png";

interface SalesTemplate {
  id: number;
  name: string;
  subject: string;
  bodyHtml: string;
  bodyText: string | null;
  category: string | null;
  format: string;
  isActive: boolean;
}

const LABEL_CLS = "text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block";

interface FollowUpEmailSectionProps {
  enabled: boolean;
  templateId: number | null;
  onEnabledChange: (enabled: boolean) => void;
  onTemplateIdChange: (id: number | null) => void;
}

export function FollowUpEmailSection({
  enabled, templateId, onEnabledChange, onTemplateIdChange,
}: FollowUpEmailSectionProps) {
  const [templates, setTemplates] = useState<SalesTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const loadTemplates = () => {
    setLoading(true);
    fetch(`${API_BASE}/sales/templates`)
      .then(r => r.ok ? r.json() : [])
      .then((rows: SalesTemplate[]) => setTemplates(Array.isArray(rows) ? rows.filter(t => t.isActive !== false) : []))
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false));
  };
  useEffect(() => { loadTemplates(); }, []);

  // New template form state
  const [newName, setNewName] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const editorRef = useRef<EmailEditorHandle>(null);

  const handleCreate = async () => {
    const name = newName.trim();
    const subject = newSubject.trim();
    const bodyHtml = editorRef.current?.getHTML() ?? "";
    if (!name || !subject) {
      alert("Name and subject are required");
      return;
    }
    setCreating(true);
    try {
      const r = await fetch(`${API_BASE}/sales/templates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, subject, bodyHtml, format: "styled", category: "follow-up" }),
      });
      if (!r.ok) {
        const err = await r.text().catch(() => "");
        alert(`Failed to create template: ${err.slice(0, 200)}`);
        return;
      }
      const created = await r.json() as SalesTemplate;
      setTemplates(prev => [created, ...prev]);
      onTemplateIdChange(created.id);
      setModalOpen(false);
      setNewName("");
      setNewSubject("");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2.5 bg-muted/30">
        <div className="flex-1">
          <div className="text-sm font-medium">Follow-up email to submitter</div>
          <div className="text-xs text-muted-foreground">Auto-send a templated email to the person who filled out the form.</div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{enabled ? "On" : "Off"}</span>
          <Switch checked={enabled} onCheckedChange={onEnabledChange} />
        </div>
      </div>
      {enabled && (
        <div className="p-3 space-y-3">
          <div>
            <Label className={LABEL_CLS}>Email Template</Label>
            <div className="flex items-center gap-2">
              <Select
                value={templateId != null ? String(templateId) : ""}
                onValueChange={v => onTemplateIdChange(v ? Number(v) : null)}
              >
                <SelectTrigger className="text-sm flex-1">
                  <SelectValue placeholder={loading ? "Loading…" : "Select a template…"} />
                </SelectTrigger>
                <SelectContent>
                  {templates.length === 0 && (
                    <div className="px-2 py-2 text-xs text-muted-foreground">No templates yet — create one below.</div>
                  )}
                  {templates.map(t => (
                    <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" type="button" onClick={() => setModalOpen(true)} className="gap-1 shrink-0">
                <Plus className="w-3.5 h-3.5" /> New
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5">
              Merge variables like <code className="bg-muted px-1 rounded">{`{{first_name}}`}</code> are filled from the submitted form fields (label is normalised to lowercase with underscores). Templates are managed in{" "}
              <a href="/sales/outreach" target="_blank" rel="noopener noreferrer" className="underline inline-flex items-center gap-0.5">
                Sales → Outreach <ExternalLink className="w-2.5 h-2.5" />
              </a>.
            </p>
            {enabled && templateId == null && (
              <p className="text-[11px] text-amber-700 mt-1">Pick a template — without one, no follow-up will be sent.</p>
            )}
          </div>
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create follow-up template</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className={LABEL_CLS}>Template Name</Label>
              <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Demo request thank-you" className="text-sm" />
            </div>
            <div>
              <Label className={LABEL_CLS}>Subject</Label>
              <Input
                value={newSubject}
                onChange={e => setNewSubject(e.target.value)}
                placeholder={`Thanks for your interest, {{first_name}}!`}
                className="text-sm"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Use <code className="bg-muted px-1 rounded">{`{{field_name}}`}</code> to insert values from the form.
              </p>
            </div>
            <div>
              <Label className={LABEL_CLS}>Email Body</Label>
              <div className="border rounded-md">
                <EmailWYSIWYGEditor ref={editorRef} dandyBannerUrl={DANDY_BANNER_URL} initialContent="" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={creating}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating}>{creating ? "Creating…" : "Create template"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
