import type { ReportReaderBlockProps } from "@/lib/block-types";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

interface Props {
  props: ReportReaderBlockProps;
  onChange: (props: ReportReaderBlockProps) => void;
}

const VIEWS: { value: ReportReaderBlockProps["view"]; label: string }[] = [
  { value: "auto", label: "Auto (magazine on desktop, scroll on mobile)" },
  { value: "magazine", label: "Magazine" },
  { value: "scroll", label: "Scroll" },
];

export function ReportReaderPanel({ props, onChange }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs font-medium text-muted-foreground mb-2 block">Report URL</Label>
        <Input
          value={props.src}
          onChange={(e) => onChange({ ...props, src: e.target.value })}
          placeholder="/reports/my-report/report.html"
        />
        <p className="text-xs text-muted-foreground mt-2">
          An HTML document where each page is a <code>&lt;section class="page"&gt;</code> designed at 816×1056px.
        </p>
      </div>
      <div>
        <Label className="text-xs font-medium text-muted-foreground mb-2 block">Title (toolbar)</Label>
        <Input value={props.title} onChange={(e) => onChange({ ...props, title: e.target.value })} placeholder="The 2027 Report" />
      </div>
      <div>
        <Label className="text-xs font-medium text-muted-foreground mb-2 block">PDF download URL</Label>
        <Input value={props.pdfUrl} onChange={(e) => onChange({ ...props, pdfUrl: e.target.value })} placeholder="/reports/my-report/report.pdf" />
      </div>
      <div>
        <Label className="text-xs font-medium text-muted-foreground mb-2 block">Default view</Label>
        <select
          className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
          value={props.view}
          onChange={(e) => onChange({ ...props, view: e.target.value as ReportReaderBlockProps["view"] })}
        >
          {VIEWS.map((v) => (
            <option key={v.value} value={v.value}>
              {v.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium text-muted-foreground">Let readers switch views</Label>
        <Switch checked={props.allowViewToggle} onCheckedChange={(v) => onChange({ ...props, allowViewToggle: v })} />
      </div>
    </div>
  );
}
