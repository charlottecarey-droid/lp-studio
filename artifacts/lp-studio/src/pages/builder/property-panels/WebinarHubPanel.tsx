import { useState, useEffect, useRef } from "react";
import { Plus, Trash2, ChevronDown, ChevronRight, ArrowUp, ArrowDown, Upload, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ImagePicker } from "@/components/ImagePicker";
import { BrandSwatches } from "@/components/BrandSwatches";
import { FollowUpEmailSection } from "@/components/FollowUpEmailSection";
import { buildPdfUploadFormData } from "@/lib/pdf-upload";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type {
  WebinarHubBlockProps,
  WebinarStatus,
  WebinarCtaAction,
  WebinarSpeaker,
  WebinarAgendaItem,
  WebinarEmailStep,
  WebinarResource,
  WebinarFaq,
} from "@/lib/block-types";
import type { FormStep, FormField, FormFieldType } from "@/lib/block-types";

interface Props {
  props: WebinarHubBlockProps;
  onChange: (next: WebinarHubBlockProps) => void;
  /** Set once the page is saved. Enables the per-page follow-up email +
   *  campaign-enrollment controls, which persist to the page's form
   *  notification config (the Webinar Hub form posts without a formId). */
  pageId?: number;
}

/** Subset of the page form-notification config this panel reads/writes. The
 *  full payload has more fields (email recipients, webhook, etc.) which we
 *  preserve verbatim on save so we don't clobber the Forms-tab settings. */
interface PageNotificationConfig {
  sendFollowUpToSubmitter?: boolean;
  followUpTemplateId?: number | null;
  enrollCampaignId?: number | null;
  [k: string]: unknown;
}

const NOTIF_API_BASE = "/api";

function SectionHeader({ label, open, onToggle }: { label: string; open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center justify-between py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border hover:text-foreground transition-colors"
    >
      {label}
      {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
    </button>
  );
}

function Field({ label, hint, children }: { label?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      {label && <Label className="text-xs">{label}</Label>}
      {children}
      {hint && <p className="text-[10px] text-muted-foreground leading-snug">{hint}</p>}
    </div>
  );
}

function ColorRow({ label, value, fallback, onChange }: { label: string; value: string | undefined; fallback: string; onChange: (v: string) => void }) {
  const v = (value && value.trim()) || fallback;
  return (
    <div className="flex items-center gap-1.5">
      <Input type="color" value={v} onChange={e => onChange(e.target.value)} className="h-6 w-7 p-0.5 cursor-pointer shrink-0 rounded" />
      <Label className="text-xs min-w-0 truncate shrink-0" style={{ maxWidth: "5rem" }}>{label}</Label>
      <Input value={value ?? ""} onChange={e => onChange(e.target.value)} placeholder={fallback} className="text-[11px] h-6 flex-1 font-mono min-w-0" />
      <BrandSwatches className="shrink-0 flex-nowrap" current={value} onPick={onChange} />
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-2 cursor-pointer py-0.5">
      <span className="text-xs">{label}</span>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="h-3.5 w-3.5 cursor-pointer" />
    </label>
  );
}

// Match the server-side cap in /lp/pdf/upload (50 MB) so we fail fast.
const MAX_PDF_BYTES = 50 * 1024 * 1024;

/** Upload a PDF to the shared /api/lp/pdf/upload endpoint and return the serve
 *  URL + cleaned-up filename (mirrors ResourcesPanel). */
async function uploadResourcePdf(file: File): Promise<{ url: string; title: string }> {
  const formData = await buildPdfUploadFormData(file);
  const res = await fetch("/api/lp/pdf/upload", { method: "POST", body: formData, credentials: "include" });
  const data = (await res.json().catch(() => ({}))) as { url?: string; title?: string; error?: string };
  if (!res.ok) throw new Error(data.error ?? "Upload failed");
  if (!data.url) throw new Error("Upload succeeded but no URL was returned");
  return { url: data.url, title: data.title ?? "" };
}

/** Inline "Upload PDF" button for a webinar resource card. Writes the serve URL
 *  into `url`, defaults `format` to "PDF", and pre-fills the title when it's
 *  still the placeholder. */
function PdfUploadButton({ resource, onPatch }: { resource: WebinarResource; onPatch: (patch: Partial<WebinarResource>) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resourceRef = useRef(resource);
  resourceRef.current = resource;

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type && file.type !== "application/pdf") {
      setError("Only PDF files are supported.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    if (file.size > MAX_PDF_BYTES) {
      setError("File too large. Maximum size is 50 MB.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const { url, title } = await uploadResourcePdf(file);
      const latest = resourceRef.current;
      const patch: Partial<WebinarResource> = { url };
      if (!latest.format) patch.format = "PDF";
      if (!latest.title || latest.title === "New resource") patch.title = title || file.name.replace(/\.pdf$/i, "");
      onPatch(patch);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const isPdf = typeof resource.url === "string" && /\.pdf(\?|$)/i.test(resource.url);
  return (
    <>
      <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={handleFile} />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 px-2 text-[11px] gap-1 shrink-0"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        title={isPdf ? "Replace uploaded PDF" : "Upload a PDF and link it here"}
      >
        {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : isPdf ? <FileText className="w-3 h-3" /> : <Upload className="w-3 h-3" />}
        {uploading ? "Uploading…" : isPdf ? "Replace" : "Upload PDF"}
      </Button>
      {error && <p className="text-[10px] text-red-500 mt-1">{error}</p>}
    </>
  );
}

const CTA_ACTIONS: { value: WebinarCtaAction; label: string }[] = [
  { value: "scroll-to-form", label: "Scroll to registration form" },
  { value: "url", label: "Link to URL" },
  { value: "open-form", label: "Open form in modal" },
  { value: "chilipiper", label: "Open Chili Piper scheduler" },
];

const FIELD_TYPES: FormFieldType[] = ["text", "email", "phone", "textarea", "select", "checkbox"];

function FormStepsEditor({
  steps,
  onChange,
}: {
  steps: FormStep[];
  onChange: (next: FormStep[]) => void;
}) {
  const updateStep = (si: number, patch: Partial<FormStep>) =>
    onChange(steps.map((s, i) => (i === si ? { ...s, ...patch } : s)));
  const addField = (si: number) => {
    const newField: FormField = { id: `field_${Date.now()}`, type: "text", label: "New field", placeholder: "", required: false };
    onChange(steps.map((s, i) => (i === si ? { ...s, fields: [...(s.fields ?? []), newField] } : s)));
  };
  const updateField = (si: number, fi: number, patch: Partial<FormField>) =>
    onChange(steps.map((s, i) => (i === si ? { ...s, fields: (s.fields ?? []).map((f, j) => (j === fi ? { ...f, ...patch } : f)) } : s)));
  const removeField = (si: number, fi: number) =>
    onChange(steps.map((s, i) => (i === si ? { ...s, fields: (s.fields ?? []).filter((_, j) => j !== fi) } : s)));

  return (
    <div className="space-y-2">
      {steps.map((step, si) => (
        <div key={si} className="rounded border border-border p-2 space-y-2">
          <Field label="Step title">
            <Input value={step.title ?? ""} onChange={e => updateStep(si, { title: e.target.value })} className="text-xs h-7" />
          </Field>
          <div className="space-y-2">
            {(step.fields ?? []).map((f, fi) => (
              <div key={fi} className="rounded border border-border/60 p-1.5 space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Input value={f.label ?? ""} onChange={e => updateField(si, fi, { label: e.target.value })} placeholder="Label" className="text-[11px] h-6 flex-1" />
                  <button type="button" onClick={() => removeField(si, fi)} className="text-muted-foreground hover:text-destructive shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex items-center gap-1.5">
                  <Input value={f.id ?? ""} onChange={e => updateField(si, fi, { id: e.target.value })} placeholder="field_id" className="text-[11px] h-6 flex-1 font-mono" />
                  <Select value={f.type} onValueChange={v => updateField(si, fi, { type: v as FormFieldType })}>
                    <SelectTrigger className="h-6 text-[11px] w-24 shrink-0"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FIELD_TYPES.map(t => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-1.5">
                  <Input value={f.placeholder ?? ""} onChange={e => updateField(si, fi, { placeholder: e.target.value })} placeholder="Placeholder" className="text-[11px] h-6 flex-1" />
                  <label className="flex items-center gap-1 text-[10px] shrink-0">
                    <input type="checkbox" checked={!!f.required} onChange={e => updateField(si, fi, { required: e.target.checked })} className="h-3 w-3" />
                    req
                  </label>
                </div>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" className="h-6 text-[11px] w-full" onClick={() => addField(si)}>
              <Plus className="w-3 h-3 mr-1" /> Add field
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

export function WebinarHubPanel({ props, onChange, pageId }: Props) {
  const p = props;
  const set = (patch: Partial<WebinarHubBlockProps>) => onChange({ ...p, ...patch });
  const [open, setOpen] = useState<Record<string, boolean>>({ content: true });
  const toggle = (k: string) => setOpen(o => ({ ...o, [k]: !o[k] }));

  // ── Page form-notification config (follow-up email + campaign enrollment) ──
  // The Webinar Hub registration form posts without a formId, so its delivery
  // settings live on the PAGE's notification row. We load them lazily and save
  // (debounced) whenever the editor flips a control.
  const [notif, setNotif] = useState<PageNotificationConfig | null>(null);
  useEffect(() => {
    if (pageId == null) return;
    let cancelled = false;
    fetch(`${NOTIF_API_BASE}/lp/pages/${pageId}/notifications`)
      .then(r => (r.ok ? r.json() : null))
      .then((data: PageNotificationConfig | null) => { if (!cancelled && data) setNotif(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [pageId]);

  const saveNotif = (patch: Partial<PageNotificationConfig>) => {
    if (pageId == null) return;
    const next = { ...(notif ?? {}), ...patch };
    setNotif(next);
    fetch(`${NOTIF_API_BASE}/lp/pages/${pageId}/notifications`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    }).catch(() => {});
  };

  // ── Collection helpers ─────────────────────────────────────────────────
  const navLinks = p.navLinks ?? [];
  const speakers = p.speakers ?? [];
  const agenda = p.agenda ?? [];
  const emailSequence = p.emailSequence ?? [];
  const resources = p.resources ?? [];
  const faqs = p.faqs ?? [];

  function moveItem<T>(list: T[], from: number, dir: -1 | 1): T[] {
    const to = from + dir;
    if (to < 0 || to >= list.length) return list;
    const next = [...list];
    [next[from], next[to]] = [next[to], next[from]];
    return next;
  }

  return (
    <div className="space-y-3 text-sm">
      {/* ── STATUS & BRAND ─────────────────────────────────────────────── */}
      <div>
        <SectionHeader label="Status & Brand" open={!!open.status} onToggle={() => toggle("status")} />
        {open.status && (
          <div className="space-y-2 pt-2">
            <Field label="Event status" hint="Drives default copy, the live broadcast section, and accent.">
              <Select value={p.status ?? "upcoming"} onValueChange={v => set({ status: v as WebinarStatus })}>
                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="upcoming" className="text-xs">Upcoming</SelectItem>
                  <SelectItem value="live" className="text-xs">Live now</SelectItem>
                  <SelectItem value="on-demand" className="text-xs">On demand</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Brand name" hint="Falls back to your workspace brand name when blank.">
              <Input value={p.brandName ?? ""} onChange={e => set({ brandName: e.target.value })} className="text-xs h-7" />
            </Field>
            <Field label="Logo">
              <ImagePicker value={p.logoUrl ?? ""} onChange={v => set({ logoUrl: v || undefined })} aiHint="Brand logo" />
            </Field>
            <ColorRow label="Accent" value={p.accentColor} fallback="#6366F1" onChange={v => set({ accentColor: v })} />
            <ColorRow label="Live accent" value={p.liveAccentColor} fallback="#E52E20" onChange={v => set({ liveAccentColor: v })} />
          </div>
        )}
      </div>

      {/* ── SECTION VISIBILITY ─────────────────────────────────────────── */}
      <div>
        <SectionHeader label="Sections" open={!!open.sections} onToggle={() => toggle("sections")} />
        {open.sections && (
          <div className="space-y-0.5 pt-2">
            <Toggle label="Top navigation" checked={p.showNav !== false} onChange={v => set({ showNav: v })} />
            <Toggle label="Hero" checked={p.showHero !== false} onChange={v => set({ showHero: v })} />
            <Toggle label="Registration form" checked={p.showForm !== false} onChange={v => set({ showForm: v })} />
            <Toggle label="Email sequence" checked={p.showWorkflow !== false} onChange={v => set({ showWorkflow: v })} />
            <Toggle label="Agenda" checked={p.showAgenda !== false} onChange={v => set({ showAgenda: v })} />
            <Toggle label="Featured video" checked={p.showVideo !== false} onChange={v => set({ showVideo: v })} />
            <Toggle label="Speakers" checked={p.showSpeakers !== false} onChange={v => set({ showSpeakers: v })} />
            <Toggle label="Resources" checked={p.showResources !== false} onChange={v => set({ showResources: v })} />
            <Toggle label="FAQ" checked={p.showFaq !== false} onChange={v => set({ showFaq: v })} />
            <Toggle label="Final CTA" checked={p.showFinalCta !== false} onChange={v => set({ showFinalCta: v })} />
            <Toggle label="Footer" checked={p.showFooter !== false} onChange={v => set({ showFooter: v })} />
          </div>
        )}
      </div>

      {/* ── HERO ───────────────────────────────────────────────────────── */}
      <div>
        <SectionHeader label="Hero" open={!!open.content} onToggle={() => toggle("content")} />
        {open.content && (
          <div className="space-y-2 pt-2">
            <Field label="Edition label">
              <Input value={p.editionLabel ?? ""} onChange={e => set({ editionLabel: e.target.value })} className="text-xs h-7" />
            </Field>
            <Field label="Title">
              <Textarea value={p.title ?? ""} onChange={e => set({ title: e.target.value })} className="text-xs min-h-[3rem]" />
            </Field>
            <Field label="Subtitle">
              <Textarea value={p.subtitle ?? ""} onChange={e => set({ subtitle: e.target.value })} className="text-xs min-h-[3.5rem]" />
            </Field>
            <div className="grid grid-cols-3 gap-1.5">
              <Field label="Date"><Input value={p.date ?? ""} onChange={e => set({ date: e.target.value })} className="text-[11px] h-7" /></Field>
              <Field label="Time"><Input value={p.time ?? ""} onChange={e => set({ time: e.target.value })} className="text-[11px] h-7" /></Field>
              <Field label="Timezone"><Input value={p.timezone ?? ""} onChange={e => set({ timezone: e.target.value })} className="text-[11px] h-7" /></Field>
            </div>
            <Field label="Registrations" hint="Social-proof count shown in the hero / final CTA.">
              <Input type="number" value={p.registrations ?? ""} onChange={e => set({ registrations: e.target.value === "" ? undefined : Number(e.target.value) })} className="text-xs h-7" />
            </Field>
            <Field label="Hero background image" hint="Optional. Adds an immersive cover behind the hero.">
              <ImagePicker value={p.heroBackgroundImageUrl ?? ""} onChange={v => set({ heroBackgroundImageUrl: v || undefined })} aiHint="Webinar hero background" />
            </Field>
            {p.heroBackgroundImageUrl && (
              <Field label={`Overlay darkness ${p.heroOverlayOpacity ?? 55}%`}>
                <input type="range" min={0} max={100} value={p.heroOverlayOpacity ?? 55} onChange={e => set({ heroOverlayOpacity: Number(e.target.value) })} className="w-full" />
              </Field>
            )}
            <Field label="Hero video poster" hint="Thumbnail for the hero video card.">
              <ImagePicker value={p.heroVideoPosterUrl ?? ""} onChange={v => set({ heroVideoPosterUrl: v || undefined })} aiHint="Webinar video thumbnail" />
            </Field>
          </div>
        )}
      </div>

      {/* ── REGISTRATION FORM ──────────────────────────────────────────── */}
      <div>
        <SectionHeader label="Registration form" open={!!open.form} onToggle={() => toggle("form")} />
        {open.form && (
          <div className="space-y-2 pt-2">
            <FormStepsEditor steps={p.formSteps ?? []} onChange={steps => set({ formSteps: steps })} />
            <Field label="Submit URL (optional)" hint="POST endpoint. Leave blank to capture leads in LP Studio.">
              <Input value={p.formSubmitUrl ?? ""} onChange={e => set({ formSubmitUrl: e.target.value })} className="text-[11px] h-7 font-mono" placeholder="https://…" />
            </Field>
            <Field label="Success message">
              <Input value={p.formSuccessMessage ?? ""} onChange={e => set({ formSuccessMessage: e.target.value })} className="text-xs h-7" />
            </Field>
          </div>
        )}
      </div>

      {/* ── PRIMARY CTA ────────────────────────────────────────────────── */}
      <div>
        <SectionHeader label="Primary CTA" open={!!open.primaryCta} onToggle={() => toggle("primaryCta")} />
        {open.primaryCta && (
          <div className="space-y-2 pt-2">
            <Field label="Button text" hint="Defaults from status (Register / Watch live / Watch on demand) when blank.">
              <Input value={p.primaryCtaText ?? ""} onChange={e => set({ primaryCtaText: e.target.value })} className="text-xs h-7" />
            </Field>
            <Field label="Action">
              <Select value={p.primaryCtaAction ?? "scroll-to-form"} onValueChange={v => set({ primaryCtaAction: v as WebinarCtaAction })}>
                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CTA_ACTIONS.map(a => <SelectItem key={a.value} value={a.value} className="text-xs">{a.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            {p.primaryCtaAction === "url" && (
              <Field label="URL"><Input value={p.primaryCtaUrl ?? ""} onChange={e => set({ primaryCtaUrl: e.target.value })} className="text-[11px] h-7 font-mono" placeholder="https://…" /></Field>
            )}
            {p.primaryCtaAction === "chilipiper" && (
              <Field label="Chili Piper URL"><Input value={p.primaryChilipiperUrl ?? ""} onChange={e => set({ primaryChilipiperUrl: e.target.value })} className="text-[11px] h-7 font-mono" placeholder="yourcompany.chilipiper.com/…" /></Field>
            )}
          </div>
        )}
      </div>

      {/* ── SECONDARY CTA ──────────────────────────────────────────────── */}
      <div>
        <SectionHeader label="Secondary CTA" open={!!open.secondaryCta} onToggle={() => toggle("secondaryCta")} />
        {open.secondaryCta && (
          <div className="space-y-2 pt-2">
            <Field label="Button text">
              <Input value={p.secondaryCtaText ?? ""} onChange={e => set({ secondaryCtaText: e.target.value })} className="text-xs h-7" placeholder="e.g. Talk to sales" />
            </Field>
            <Field label="Action">
              <Select value={p.secondaryCtaAction ?? "url"} onValueChange={v => set({ secondaryCtaAction: v as WebinarCtaAction })}>
                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CTA_ACTIONS.map(a => <SelectItem key={a.value} value={a.value} className="text-xs">{a.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            {p.secondaryCtaAction === "url" && (
              <Field label="URL"><Input value={p.secondaryCtaUrl ?? ""} onChange={e => set({ secondaryCtaUrl: e.target.value })} className="text-[11px] h-7 font-mono" placeholder="https://…" /></Field>
            )}
            {p.secondaryCtaAction === "chilipiper" && (
              <Field label="Chili Piper URL"><Input value={p.secondaryChilipiperUrl ?? ""} onChange={e => set({ secondaryChilipiperUrl: e.target.value })} className="text-[11px] h-7 font-mono" placeholder="yourcompany.chilipiper.com/…" /></Field>
            )}
            {p.secondaryCtaAction === "open-form" && (
              <div className="space-y-2 rounded border border-border p-2">
                <Field label="Modal headline"><Input value={p.secondaryFormHeadline ?? ""} onChange={e => set({ secondaryFormHeadline: e.target.value })} className="text-xs h-7" /></Field>
                <Field label="Modal subheadline"><Input value={p.secondaryFormSubheadline ?? ""} onChange={e => set({ secondaryFormSubheadline: e.target.value })} className="text-xs h-7" /></Field>
                <p className="text-[10px] text-muted-foreground">Collects name, email, phone and company.</p>
                <Field label="Success message"><Input value={p.secondaryFormSuccessMessage ?? ""} onChange={e => set({ secondaryFormSuccessMessage: e.target.value })} className="text-xs h-7" /></Field>
              </div>
            )}
            <div className="space-y-0.5 pt-1 border-t border-border">
              <p className="text-[10px] text-muted-foreground pt-1">Show the secondary button on:</p>
              <Toggle label="Top navigation" checked={!!p.secondaryCtaInNav} onChange={v => set({ secondaryCtaInNav: v })} />
              <Toggle label="Final CTA band" checked={!!p.secondaryCtaInFinalCta} onChange={v => set({ secondaryCtaInFinalCta: v })} />
              <Toggle label="Footer" checked={!!p.secondaryCtaInFooter} onChange={v => set({ secondaryCtaInFooter: v })} />
            </div>
          </div>
        )}
      </div>

      {/* ── NAV LINKS ──────────────────────────────────────────────────── */}
      <div>
        <SectionHeader label="Nav links" open={!!open.nav} onToggle={() => toggle("nav")} />
        {open.nav && (
          <div className="space-y-1.5 pt-2">
            {navLinks.map((link, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <Input value={link} onChange={e => set({ navLinks: navLinks.map((l, j) => (j === i ? e.target.value : l)) })} className="text-[11px] h-7 flex-1" />
                <button type="button" onClick={() => set({ navLinks: navLinks.filter((_, j) => j !== i) })} className="text-muted-foreground hover:text-destructive shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" className="h-6 text-[11px] w-full" onClick={() => set({ navLinks: [...navLinks, "New link"] })}>
              <Plus className="w-3 h-3 mr-1" /> Add link
            </Button>
          </div>
        )}
      </div>

      {/* ── EMAIL SEQUENCE ─────────────────────────────────────────────── */}
      <div>
        <SectionHeader label="Email sequence" open={!!open.workflow} onToggle={() => toggle("workflow")} />
        {open.workflow && (
          <div className="space-y-2 pt-2">
            <Field label="Eyebrow"><Input value={p.workflowEyebrow ?? ""} onChange={e => set({ workflowEyebrow: e.target.value })} className="text-xs h-7" /></Field>
            <Field label="Headline"><Input value={p.workflowHeadline ?? ""} onChange={e => set({ workflowHeadline: e.target.value })} className="text-xs h-7" /></Field>
            <Field label="Description"><Textarea value={p.workflowDescription ?? ""} onChange={e => set({ workflowDescription: e.target.value })} className="text-xs min-h-[3rem]" /></Field>
            {emailSequence.map((step, i) => (
              <div key={i} className="rounded border border-border p-2 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">Step {i + 1}</span>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => set({ emailSequence: moveItem(emailSequence, i, -1) })} className="text-muted-foreground hover:text-foreground"><ArrowUp className="w-3 h-3" /></button>
                    <button type="button" onClick={() => set({ emailSequence: moveItem(emailSequence, i, 1) })} className="text-muted-foreground hover:text-foreground"><ArrowDown className="w-3 h-3" /></button>
                    <button type="button" onClick={() => set({ emailSequence: emailSequence.filter((_, j) => j !== i) })} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
                <Input value={step.when ?? ""} onChange={e => set({ emailSequence: emailSequence.map((s, j) => (j === i ? { ...s, when: e.target.value } : s)) })} placeholder="When (e.g. 24 hours before)" className="text-[11px] h-6" />
                <Input value={step.label ?? ""} onChange={e => set({ emailSequence: emailSequence.map((s, j) => (j === i ? { ...s, label: e.target.value } : s)) })} placeholder="Label" className="text-[11px] h-6" />
                <Textarea value={step.desc ?? ""} onChange={e => set({ emailSequence: emailSequence.map((s, j) => (j === i ? { ...s, desc: e.target.value } : s)) })} placeholder="Description" className="text-[11px] min-h-[2.5rem]" />
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" className="h-6 text-[11px] w-full" onClick={() => set({ emailSequence: [...emailSequence, { when: "", label: "New step", desc: "" } as WebinarEmailStep] })}>
              <Plus className="w-3 h-3 mr-1" /> Add step
            </Button>

            {/* Live delivery — the visual sequence above is illustrative; these
                controls actually fire on registration. Persist to the page's
                form-notification config. */}
            <div className="pt-2 mt-1 border-t border-border">
              {pageId == null ? (
                <p className="text-[11px] text-muted-foreground">Save the page to configure the automatic follow-up email and campaign enrollment for registrations.</p>
              ) : (
                <FollowUpEmailSection
                  enabled={!!notif?.sendFollowUpToSubmitter}
                  templateId={notif?.followUpTemplateId ?? null}
                  onEnabledChange={v => saveNotif({ sendFollowUpToSubmitter: v })}
                  onTemplateIdChange={v => saveNotif({ followUpTemplateId: v })}
                  enrollCampaignId={notif?.enrollCampaignId ?? null}
                  onEnrollCampaignChange={v => saveNotif({ enrollCampaignId: v })}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── AGENDA ─────────────────────────────────────────────────────── */}
      <div>
        <SectionHeader label="Agenda" open={!!open.agenda} onToggle={() => toggle("agenda")} />
        {open.agenda && (
          <div className="space-y-2 pt-2">
            <Field label="Eyebrow"><Input value={p.agendaEyebrow ?? ""} onChange={e => set({ agendaEyebrow: e.target.value })} className="text-xs h-7" /></Field>
            <Field label="Headline"><Input value={p.agendaHeadline ?? ""} onChange={e => set({ agendaHeadline: e.target.value })} className="text-xs h-7" /></Field>
            {agenda.map((item, i) => (
              <div key={i} className="rounded border border-border p-2 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">Item {i + 1}</span>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => set({ agenda: moveItem(agenda, i, -1) })} className="text-muted-foreground hover:text-foreground"><ArrowUp className="w-3 h-3" /></button>
                    <button type="button" onClick={() => set({ agenda: moveItem(agenda, i, 1) })} className="text-muted-foreground hover:text-foreground"><ArrowDown className="w-3 h-3" /></button>
                    <button type="button" onClick={() => set({ agenda: agenda.filter((_, j) => j !== i) })} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <Input value={item.time ?? ""} onChange={e => set({ agenda: agenda.map((a, j) => (j === i ? { ...a, time: e.target.value } : a)) })} placeholder="00:00" className="text-[11px] h-6 w-16 shrink-0 font-mono" />
                  <Input value={item.title ?? ""} onChange={e => set({ agenda: agenda.map((a, j) => (j === i ? { ...a, title: e.target.value } : a)) })} placeholder="Title" className="text-[11px] h-6 flex-1" />
                </div>
                <Textarea value={item.desc ?? ""} onChange={e => set({ agenda: agenda.map((a, j) => (j === i ? { ...a, desc: e.target.value } : a)) })} placeholder="Description" className="text-[11px] min-h-[2.5rem]" />
                <Input value={item.speaker ?? ""} onChange={e => set({ agenda: agenda.map((a, j) => (j === i ? { ...a, speaker: e.target.value } : a)) })} placeholder="Speaker (optional)" className="text-[11px] h-6" />
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" className="h-6 text-[11px] w-full" onClick={() => set({ agenda: [...agenda, { time: "", title: "New item", desc: "" } as WebinarAgendaItem] })}>
              <Plus className="w-3 h-3 mr-1" /> Add agenda item
            </Button>
          </div>
        )}
      </div>

      {/* ── FEATURED VIDEO ─────────────────────────────────────────────── */}
      <div>
        <SectionHeader label="Featured video" open={!!open.video} onToggle={() => toggle("video")} />
        {open.video && (
          <div className="space-y-2 pt-2">
            <Field label="Eyebrow"><Input value={p.videoEyebrow ?? ""} onChange={e => set({ videoEyebrow: e.target.value })} className="text-xs h-7" /></Field>
            <Field label="Headline"><Input value={p.videoHeadline ?? ""} onChange={e => set({ videoHeadline: e.target.value })} className="text-xs h-7" /></Field>
            <Field label="Stream poster image" hint="Shown for live / on-demand sessions.">
              <ImagePicker value={p.featuredVideoPosterUrl ?? ""} onChange={v => set({ featuredVideoPosterUrl: v || undefined })} aiHint="Webinar stream poster" />
            </Field>
          </div>
        )}
      </div>

      {/* ── SPEAKERS ───────────────────────────────────────────────────── */}
      <div>
        <SectionHeader label="Speakers" open={!!open.speakers} onToggle={() => toggle("speakers")} />
        {open.speakers && (
          <div className="space-y-2 pt-2">
            <Field label="Eyebrow"><Input value={p.speakersEyebrow ?? ""} onChange={e => set({ speakersEyebrow: e.target.value })} className="text-xs h-7" /></Field>
            <Field label="Headline"><Input value={p.speakersHeadline ?? ""} onChange={e => set({ speakersHeadline: e.target.value })} className="text-xs h-7" /></Field>
            <Field label="Description"><Textarea value={p.speakersDescription ?? ""} onChange={e => set({ speakersDescription: e.target.value })} className="text-xs min-h-[2.5rem]" /></Field>
            {speakers.map((sp, i) => (
              <div key={i} className="rounded border border-border p-2 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">Speaker {i + 1}</span>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => set({ speakers: moveItem(speakers, i, -1) })} className="text-muted-foreground hover:text-foreground"><ArrowUp className="w-3 h-3" /></button>
                    <button type="button" onClick={() => set({ speakers: moveItem(speakers, i, 1) })} className="text-muted-foreground hover:text-foreground"><ArrowDown className="w-3 h-3" /></button>
                    <button type="button" onClick={() => set({ speakers: speakers.filter((_, j) => j !== i) })} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
                <ImagePicker value={sp.imageUrl ?? ""} onChange={v => set({ speakers: speakers.map((s, j) => (j === i ? { ...s, imageUrl: v || undefined } : s)) })} aiHint="Speaker headshot" />
                <Input value={sp.name ?? ""} onChange={e => set({ speakers: speakers.map((s, j) => (j === i ? { ...s, name: e.target.value } : s)) })} placeholder="Name" className="text-[11px] h-6" />
                <Input value={sp.role ?? ""} onChange={e => set({ speakers: speakers.map((s, j) => (j === i ? { ...s, role: e.target.value } : s)) })} placeholder="Role / title" className="text-[11px] h-6" />
                <Textarea value={sp.bio ?? ""} onChange={e => set({ speakers: speakers.map((s, j) => (j === i ? { ...s, bio: e.target.value } : s)) })} placeholder="Bio" className="text-[11px] min-h-[2.5rem]" />
                <Input value={sp.linkedinUrl ?? ""} onChange={e => set({ speakers: speakers.map((s, j) => (j === i ? { ...s, linkedinUrl: e.target.value } : s)) })} placeholder="LinkedIn URL (optional)" className="text-[11px] h-6 font-mono" />
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" className="h-6 text-[11px] w-full" onClick={() => set({ speakers: [...speakers, { name: "New speaker" } as WebinarSpeaker] })}>
              <Plus className="w-3 h-3 mr-1" /> Add speaker
            </Button>
          </div>
        )}
      </div>

      {/* ── RESOURCES ──────────────────────────────────────────────────── */}
      <div>
        <SectionHeader label="Resources" open={!!open.resources} onToggle={() => toggle("resources")} />
        {open.resources && (
          <div className="space-y-2 pt-2">
            <Field label="Eyebrow"><Input value={p.resourcesEyebrow ?? ""} onChange={e => set({ resourcesEyebrow: e.target.value })} className="text-xs h-7" /></Field>
            <Field label="Headline"><Input value={p.resourcesHeadline ?? ""} onChange={e => set({ resourcesHeadline: e.target.value })} className="text-xs h-7" /></Field>
            <Field label="Featured resource title (optional)"><Input value={p.featuredResourceTitle ?? ""} onChange={e => set({ featuredResourceTitle: e.target.value })} className="text-xs h-7" /></Field>
            {resources.map((r, i) => (
              <div key={i} className="rounded border border-border p-2 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">Resource {i + 1}</span>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => set({ resources: moveItem(resources, i, -1) })} className="text-muted-foreground hover:text-foreground"><ArrowUp className="w-3 h-3" /></button>
                    <button type="button" onClick={() => set({ resources: moveItem(resources, i, 1) })} className="text-muted-foreground hover:text-foreground"><ArrowDown className="w-3 h-3" /></button>
                    <button type="button" onClick={() => set({ resources: resources.filter((_, j) => j !== i) })} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <Input value={r.title ?? ""} onChange={e => set({ resources: resources.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })} placeholder="Title" className="text-[11px] h-6 flex-1" />
                  <Input value={r.format ?? ""} onChange={e => set({ resources: resources.map((x, j) => (j === i ? { ...x, format: e.target.value } : x)) })} placeholder="PDF" className="text-[11px] h-6 w-16 shrink-0" />
                </div>
                <Textarea value={r.desc ?? ""} onChange={e => set({ resources: resources.map((x, j) => (j === i ? { ...x, desc: e.target.value } : x)) })} placeholder="Description" className="text-[11px] min-h-[2.5rem]" />
                <Field label="Thumbnail" hint="Optional image shown above the card.">
                  <ImagePicker
                    value={r.imageUrl ?? ""}
                    onChange={url => set({ resources: resources.map((x, j) => (j === i ? { ...x, imageUrl: url || undefined } : x)) })}
                  />
                </Field>
                <Field label="Link / download URL" hint="Where the card links. Upload a PDF or paste any URL. Leave blank for a non-clickable card.">
                  <div className="flex gap-1.5 items-start">
                    <Input
                      value={r.url ?? ""}
                      onChange={e => set({ resources: resources.map((x, j) => (j === i ? { ...x, url: e.target.value || undefined } : x)) })}
                      placeholder="https://… or upload a PDF"
                      className="text-[11px] h-7 flex-1"
                    />
                    <PdfUploadButton
                      resource={r}
                      onPatch={patch => set({ resources: resources.map((x, j) => (j === i ? { ...x, ...patch } : x)) })}
                    />
                  </div>
                </Field>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" className="h-6 text-[11px] w-full" onClick={() => set({ resources: [...resources, { title: "New resource", format: "PDF", desc: "" } as WebinarResource] })}>
              <Plus className="w-3 h-3 mr-1" /> Add resource
            </Button>
          </div>
        )}
      </div>

      {/* ── FAQ ────────────────────────────────────────────────────────── */}
      <div>
        <SectionHeader label="FAQ" open={!!open.faq} onToggle={() => toggle("faq")} />
        {open.faq && (
          <div className="space-y-2 pt-2">
            <Field label="Eyebrow"><Input value={p.faqEyebrow ?? ""} onChange={e => set({ faqEyebrow: e.target.value })} className="text-xs h-7" /></Field>
            <Field label="Headline"><Input value={p.faqHeadline ?? ""} onChange={e => set({ faqHeadline: e.target.value })} className="text-xs h-7" /></Field>
            {faqs.map((f, i) => (
              <div key={i} className="rounded border border-border p-2 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">FAQ {i + 1}</span>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => set({ faqs: moveItem(faqs, i, -1) })} className="text-muted-foreground hover:text-foreground"><ArrowUp className="w-3 h-3" /></button>
                    <button type="button" onClick={() => set({ faqs: moveItem(faqs, i, 1) })} className="text-muted-foreground hover:text-foreground"><ArrowDown className="w-3 h-3" /></button>
                    <button type="button" onClick={() => set({ faqs: faqs.filter((_, j) => j !== i) })} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
                <Input value={f.q ?? ""} onChange={e => set({ faqs: faqs.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)) })} placeholder="Question" className="text-[11px] h-6" />
                <Textarea value={f.a ?? ""} onChange={e => set({ faqs: faqs.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)) })} placeholder="Answer" className="text-[11px] min-h-[2.5rem]" />
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" className="h-6 text-[11px] w-full" onClick={() => set({ faqs: [...faqs, { q: "New question", a: "" } as WebinarFaq] })}>
              <Plus className="w-3 h-3 mr-1" /> Add FAQ
            </Button>
          </div>
        )}
      </div>

      {/* ── FINAL CTA ──────────────────────────────────────────────────── */}
      <div>
        <SectionHeader label="Final CTA" open={!!open.finalCta} onToggle={() => toggle("finalCta")} />
        {open.finalCta && (
          <div className="space-y-2 pt-2">
            <Field label="Kicker"><Input value={p.finalCtaKicker ?? ""} onChange={e => set({ finalCtaKicker: e.target.value })} className="text-xs h-7" /></Field>
            <Field label="Headline"><Textarea value={p.finalCtaHeadline ?? ""} onChange={e => set({ finalCtaHeadline: e.target.value })} className="text-xs min-h-[3rem]" /></Field>
            <Field label="Subtitle"><Textarea value={p.finalCtaSubtitle ?? ""} onChange={e => set({ finalCtaSubtitle: e.target.value })} className="text-xs min-h-[2.5rem]" /></Field>
            <Field label="Background image" hint="Optional cover behind the final CTA band.">
              <ImagePicker value={p.finalCtaBackgroundImageUrl ?? ""} onChange={v => set({ finalCtaBackgroundImageUrl: v || undefined })} aiHint="Final CTA background" />
            </Field>
            {p.finalCtaBackgroundImageUrl && (
              <Field label={`Overlay darkness ${p.finalCtaOverlayOpacity ?? 55}%`}>
                <input type="range" min={0} max={100} value={p.finalCtaOverlayOpacity ?? 55} onChange={e => set({ finalCtaOverlayOpacity: Number(e.target.value) })} className="w-full" />
              </Field>
            )}
          </div>
        )}
      </div>

      {/* ── FOOTER ─────────────────────────────────────────────────────── */}
      <div>
        <SectionHeader label="Footer" open={!!open.footer} onToggle={() => toggle("footer")} />
        {open.footer && (
          <div className="space-y-2 pt-2">
            <Field label="Tagline"><Textarea value={p.footerTagline ?? ""} onChange={e => set({ footerTagline: e.target.value })} className="text-xs min-h-[2.5rem]" /></Field>
            <Field label="Copyright (optional)" hint="Defaults to the brand name + current year when blank.">
              <Input value={p.footerCopyright ?? ""} onChange={e => set({ footerCopyright: e.target.value })} className="text-xs h-7" />
            </Field>
          </div>
        )}
      </div>
    </div>
  );
}
