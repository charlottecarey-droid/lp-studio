import type { BenefitsGridBlockProps } from "@/lib/block-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { HEADLINE_SIZE_LABELS } from "@/lib/typography";
import { AiTextField } from "@/components/AiTextField";
import { suggestCopy } from "@/lib/copy-api";

interface Props {
  blockType: string;
  props: BenefitsGridBlockProps;
  onChange: (props: BenefitsGridBlockProps) => void;
  brandVoiceSet?: boolean;
}

export function BenefitsGridPanel({ blockType, props, onChange, brandVoiceSet }: Props) {
  const updateItem = (i: number, key: string, v: string) => {
    const items = props.items.map((item, idx) => idx === i ? { ...item, [key]: v } : item);
    onChange({ ...props, items });
  };
  const addItem = () => onChange({ ...props, items: [...props.items, { icon: "Zap", title: "New Benefit", description: "Description" }] });
  const removeItem = (i: number) => onChange({ ...props, items: props.items.filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Section Headline</Label>
        <AiTextField
          type="input"
          value={props.headline}
          onChange={v => onChange({ ...props, headline: v })}
          fieldLabel="Section Headline"
          brandVoiceSet={brandVoiceSet}
          onSuggest={() => suggestCopy(blockType, "headline", props.headline, {
            description: props.items.slice(0, 3).map(i => i.title).join(", "),
          })}
        />
      </div>
      <div>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Headline Size</Label>
        <Select
          value={props.headlineSize ?? "lg"}
          onValueChange={v => { if (v === "sm" || v === "md" || v === "lg" || v === "xl" || v === "2xl") onChange({ ...props, headlineSize: v }); }}
        >
          <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(HEADLINE_SIZE_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Columns</Label>
        <div className="flex gap-1.5">
          {([2, 3, 4, 5] as const).map(col => (
            <button
              key={col}
              onClick={() => onChange({ ...props, columns: col })}
              className={`flex-1 py-1.5 text-xs rounded-md border transition-colors ${
                props.columns === col
                  ? "border-emerald-600 bg-emerald-50 text-emerald-700 font-medium"
                  : "border-slate-200 text-slate-600 hover:border-slate-300"
              }`}
            >
              {col}
            </button>
          ))}
        </div>
      </div>
      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Benefits</Label>
      {props.items.map((item, i) => {
        const siblingTitles = props.items
          .filter((_, idx) => idx !== i)
          .slice(0, 4)
          .map(x => x.title)
          .join(" | ");
        const siblingSnippets = props.items
          .filter((_, idx) => idx !== i)
          .slice(0, 3)
          .map(x => `${x.title}: ${x.description.slice(0, 60)}`)
          .join(" | ");
        return (
          <div key={i} className="border rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-muted-foreground">Benefit {i + 1}</span>
              <Button size="icon" variant="ghost" className="w-6 h-6 text-muted-foreground hover:text-red-500" onClick={() => removeItem(i)}>
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
            <Select value={item.icon} onValueChange={v => updateItem(i, "icon", v)}>
              <SelectTrigger className="text-xs h-7"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["Zap", "ScanLine", "RefreshCcw", "HeadphonesIcon", "BarChart2", "DollarSign"].map(ic => (
                  <SelectItem key={ic} value={ic}>{ic}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <AiTextField
              type="input"
              value={item.title}
              onChange={v => updateItem(i, "title", v)}
              placeholder="Title"
              fieldLabel={`Benefit ${i + 1} Title`}
              className="text-xs h-7"
              brandVoiceSet={brandVoiceSet}
              onSuggest={() => suggestCopy(blockType, "title", item.title, {
                headline: props.headline,
                description: item.description,
                tagline: siblingTitles,
              })}
            />
            <AiTextField
              type="textarea"
              value={item.description}
              onChange={v => updateItem(i, "description", v)}
              placeholder="Description"
              rows={2}
              fieldLabel={`Benefit ${i + 1} Description`}
              className="text-xs resize-none"
              brandVoiceSet={brandVoiceSet}
              onSuggest={() => suggestCopy(blockType, "description", item.description, {
                headline: props.headline,
                title: item.title,
                tagline: siblingSnippets,
              })}
            />
          </div>
        );
      })}
      <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs" onClick={addItem}>
        <Plus className="w-3.5 h-3.5" /> Add Benefit
      </Button>
    </div>
  );
}
