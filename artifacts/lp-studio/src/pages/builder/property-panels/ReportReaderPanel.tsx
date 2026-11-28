import type { ReportReaderBlockProps, ReportReaderCoverLetter } from "@/lib/block-types";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { PdfUploadButton } from "@/components/PdfUploadButton";

interface Props {
  props: ReportReaderBlockProps;
  onChange: (props: ReportReaderBlockProps) => void;
}

const VIEWS: { value: ReportReaderBlockProps["view"]; label: string }[] = [
  { value: "auto", label: "Auto (magazine on desktop, scroll on mobile)" },
  { value: "magazine", label: "Magazine" },
  { value: "scroll", label: "Scroll" },
];

const SOURCES: { value: NonNullable<ReportReaderBlockProps["source"]>; label: string }[] = [
  { value: "auto", label: "Auto (PDF if the URL ends in .pdf)" },
  { value: "html", label: "HTML report" },
  { value: "pdf", label: "PDF" },
];

const EMPTY_LETTER: ReportReaderCoverLetter = { enabled: false, eyebrow: "", greeting: "", body: "", signName: "", signTitle: "", signImage: "" };

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs font-medium text-muted-foreground mb-2 block">{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground mt-2">{hint}</p>}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

export function ReportReaderPanel({ props, onChange }: Props) {
  const letter = { ...EMPTY_LETTER, ...(props.coverLetter ?? {}) };
  const setLetter = (patch: Partial<ReportReaderCoverLetter>) => onChange({ ...props, coverLetter: { ...letter, ...patch } });

  return (
    <div className="space-y-4">
      <Field
        label="Report URL"
        hint={
          <>
            An HTML report (each page a <code>&lt;section class="page"&gt;</code> at 816×1056px) or any PDF. PDFs flip the same way;
            their links and bookmarks carry over.
          </>
        }
      >
        <Input value={props.src} onChange={(e) => onChange({ ...props, src: e.target.value })} placeholder="/reports/my-report/report.html or a PDF" />
        <div className="mt-2">
          <PdfUploadButton
            label="Upload a PDF"
            onUploaded={(r) => onChange({ ...props, src: r.url, source: "pdf", title: props.title || r.title })}
          />
        </div>
      </Field>
      <Field label="Report type">
        <select
          className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
          value={props.source ?? "auto"}
          onChange={(e) => onChange({ ...props, source: e.target.value as ReportReaderBlockProps["source"] })}
        >
          {SOURCES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </Field>
      <Field label="Title (toolbar)">
        <Input value={props.title} onChange={(e) => onChange({ ...props, title: e.target.value })} placeholder="The 2027 Report" />
      </Field>
      <Field label="PDF download URL" hint="Blank for a PDF report downloads the PDF itself.">
        <Input value={props.pdfUrl} onChange={(e) => onChange({ ...props, pdfUrl: e.target.value })} placeholder="/reports/my-report/report.pdf" />
      </Field>
      <Field label="Default view">
        <select
          className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
          value={props.view}
          onChange={(e) => onChange({ ...props, view: e.target.value as ReportReaderBlockProps["view"] })}
        >
          {VIEWS.map((v) => (
            <option key={v.value} value={v.value}>{v.label}</option>
          ))}
        </select>
      </Field>
      <div className="space-y-3 rounded-md border p-3">
        <p className="text-xs font-semibold text-foreground">Toolbar</p>
        <Toggle label="Let readers switch views" checked={props.allowViewToggle} onChange={(v) => onChange({ ...props, allowViewToggle: v })} />
        <Toggle label="Contents menu" checked={props.showContents !== false} onChange={(v) => onChange({ ...props, showContents: v })} />
        <Toggle label="Share a page (copies a link like #report-p7)" checked={props.allowShare !== false} onChange={(v) => onChange({ ...props, allowShare: v })} />
        <Toggle label="Full-screen reading" checked={props.allowFullscreen !== false} onChange={(v) => onChange({ ...props, allowFullscreen: v })} />
      </div>

      <div className="space-y-3 rounded-md border p-3">
        <Toggle label="Personal cover letter (page 2)" checked={!!letter.enabled} onChange={(v) => setLetter({ enabled: v })} />
        {letter.enabled && (
          <>
            <p className="text-xs text-muted-foreground">
              Use page variables like <code>{"{{company}}"}</code> or <code>{"{{first_name}}"}</code>. If a variable has no value for a visitor, the letter is
              skipped for them, so nobody sees a blank name.
            </p>
            <Field label="Eyebrow">
              <Input value={letter.eyebrow} onChange={(e) => setLetter({ eyebrow: e.target.value })} placeholder="Prepared for {{company}}" />
            </Field>
            <Field label="Greeting">
              <Input value={letter.greeting} onChange={(e) => setLetter({ greeting: e.target.value })} placeholder="{{first_name}}, this one's for {{company}}." />
            </Field>
            <Field label="Letter" hint="Blank line between paragraphs.">
              <Textarea rows={7} value={letter.body} onChange={(e) => setLetter({ body: e.target.value })} />
            </Field>
            <Field label="Signed by">
              <Input value={letter.signName} onChange={(e) => setLetter({ signName: e.target.value })} placeholder="Name" />
            </Field>
            <Field label="Their title">
              <Input value={letter.signTitle} onChange={(e) => setLetter({ signTitle: e.target.value })} placeholder="Enterprise Partnerships, Dandy" />
            </Field>
            <Field label="Headshot URL (optional)">
              <Input value={letter.signImage} onChange={(e) => setLetter({ signImage: e.target.value })} placeholder="https://…" />
            </Field>
          </>
        )}
      </div>

      <Field label="Analytics key" hint="Page-level reading shows in Analytics → Resources. Blank uses the title; set it to keep counts stable if you rename the report.">
        <Input value={props.trackingKey ?? ""} onChange={(e) => onChange({ ...props, trackingKey: e.target.value })} placeholder="consolidation-gap-2027" />
      </Field>
    </div>
  );
}
