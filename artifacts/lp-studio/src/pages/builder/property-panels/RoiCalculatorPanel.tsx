import { useState } from "react";
import { BG_OPTIONS } from "@/lib/bg-styles";
import type { RoiCalculatorBlockProps, RoiInputField, RoiOutputField } from "@/lib/block-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, ChevronDown, ChevronUp, GripVertical, Wand2 } from "lucide-react";
import { toVarName } from "@/lib/roi-formula";
import { ROI_PRESETS } from "@/lib/roi-presets";

interface Props {
  props: RoiCalculatorBlockProps;
  onChange: (props: RoiCalculatorBlockProps) => void;
}

function genVarId(label: string, existingIds: string[]): string {
  const base = toVarName(label) || "field";
  if (!existingIds.includes(base)) return base;
  let n = 2;
  while (existingIds.includes(`${base}${n}`)) n++;
  return `${base}${n}`;
}

function FieldRow({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function InputFieldEditor({
  field, index, total, allIds, onChange, onDelete, onMove,
}: {
  field: RoiInputField;
  index: number;
  total: number;
  allIds: string[];
  onChange: (f: RoiInputField) => void;
  onDelete: () => void;
  onMove: (dir: "up" | "down") => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div
        className="flex items-center gap-2 px-3 py-2 bg-muted/30 cursor-pointer hover:bg-muted/50"
        onClick={() => setOpen(o => !o)}
      >
        <GripVertical className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <span className="flex-1 text-xs font-medium truncate">{field.label || "(untitled)"}</span>
        <code className="text-[9px] text-muted-foreground bg-muted px-1 rounded">{field.id}</code>
        <div className="flex items-center gap-0.5">
          <button onClick={e => { e.stopPropagation(); onMove("up"); }} disabled={index === 0} className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30">
            <ChevronUp className="w-3 h-3" />
          </button>
          <button onClick={e => { e.stopPropagation(); onMove("down"); }} disabled={index === total - 1} className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30">
            <ChevronDown className="w-3 h-3" />
          </button>
          <button onClick={e => { e.stopPropagation(); onDelete(); }} className="p-0.5 text-muted-foreground hover:text-destructive">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
        {open ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
      </div>
      {open && (
        <div className="p-3 space-y-3 border-t border-border">
          <FieldRow label="Label">
            <Input value={field.label} onChange={e => onChange({ ...field, label: e.target.value })} className="h-7 text-xs" />
          </FieldRow>
          <FieldRow label="Variable ID" hint="Used in output formulas. Only letters, numbers, underscores.">
            <Input
              value={field.id}
              onChange={e => {
                const safe = e.target.value.replace(/[^a-zA-Z0-9_]/g, "").replace(/^(\d)/, "_$1");
                const isDuplicate = allIds.filter(id => id === safe).length > 1;
                if (!isDuplicate || safe === field.id) onChange({ ...field, id: safe });
              }}
              className="h-7 text-xs font-mono"
              placeholder="my_variable"
            />
          </FieldRow>
          <div className="grid grid-cols-2 gap-2">
            <FieldRow label="Default">
              <Input type="number" value={field.defaultValue} onChange={e => onChange({ ...field, defaultValue: parseFloat(e.target.value) || 0 })} className="h-7 text-xs" />
            </FieldRow>
            <FieldRow label="Input Type">
              <Select value={field.inputType} onValueChange={v => onChange({ ...field, inputType: v as RoiInputField["inputType"] })}>
                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="slider">Slider</SelectItem>
                </SelectContent>
              </Select>
            </FieldRow>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <FieldRow label="Min"><Input type="number" value={field.min} onChange={e => onChange({ ...field, min: parseFloat(e.target.value) || 0 })} className="h-7 text-xs" /></FieldRow>
            <FieldRow label="Max"><Input type="number" value={field.max} onChange={e => onChange({ ...field, max: parseFloat(e.target.value) || 100 })} className="h-7 text-xs" /></FieldRow>
            <FieldRow label="Step"><Input type="number" value={field.step} onChange={e => onChange({ ...field, step: parseFloat(e.target.value) || 1 })} className="h-7 text-xs" /></FieldRow>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <FieldRow label="Prefix"><Input value={field.prefix ?? ""} onChange={e => onChange({ ...field, prefix: e.target.value || undefined })} className="h-7 text-xs" placeholder="$" /></FieldRow>
            <FieldRow label="Suffix"><Input value={field.suffix ?? ""} onChange={e => onChange({ ...field, suffix: e.target.value || undefined })} className="h-7 text-xs" placeholder="%" /></FieldRow>
          </div>
        </div>
      )}
    </div>
  );
}

function OutputFieldEditor({
  field, index, total, inputIds, onChange, onDelete, onMove,
}: {
  field: RoiOutputField;
  index: number;
  total: number;
  inputIds: string[];
  onChange: (f: RoiOutputField) => void;
  onDelete: () => void;
  onMove: (dir: "up" | "down") => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div
        className="flex items-center gap-2 px-3 py-2 bg-muted/30 cursor-pointer hover:bg-muted/50"
        onClick={() => setOpen(o => !o)}
      >
        <GripVertical className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <span className="flex-1 text-xs font-medium truncate">{field.label || "(untitled)"}</span>
        {field.highlight && <span className="text-[9px] bg-primary/10 text-primary px-1 rounded">highlight</span>}
        <div className="flex items-center gap-0.5">
          <button onClick={e => { e.stopPropagation(); onMove("up"); }} disabled={index === 0} className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30">
            <ChevronUp className="w-3 h-3" />
          </button>
          <button onClick={e => { e.stopPropagation(); onMove("down"); }} disabled={index === total - 1} className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30">
            <ChevronDown className="w-3 h-3" />
          </button>
          <button onClick={e => { e.stopPropagation(); onDelete(); }} className="p-0.5 text-muted-foreground hover:text-destructive">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
        {open ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
      </div>
      {open && (
        <div className="p-3 space-y-3 border-t border-border">
          <FieldRow label="Label">
            <Input value={field.label} onChange={e => onChange({ ...field, label: e.target.value })} className="h-7 text-xs" />
          </FieldRow>
          <FieldRow label="Formula" hint={inputIds.length > 0 ? `Variables: ${inputIds.join(", ")}` : "No input fields defined yet."}>
            <Textarea
              value={field.formula}
              onChange={e => onChange({ ...field, formula: e.target.value })}
              rows={3}
              className="text-xs font-mono resize-none"
              placeholder="e.g. cases * rate * 12"
            />
          </FieldRow>
          <div className="grid grid-cols-2 gap-2">
            <FieldRow label="Format">
              <Select value={field.format} onValueChange={v => onChange({ ...field, format: v as RoiOutputField["format"] })}>
                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="currency">Currency ($)</SelectItem>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="percent">Percent (%)</SelectItem>
                </SelectContent>
              </Select>
            </FieldRow>
            <FieldRow label="Decimals">
              <Input type="number" min={0} max={4} value={field.decimals} onChange={e => onChange({ ...field, decimals: parseInt(e.target.value) || 0 })} className="h-7 text-xs" />
            </FieldRow>
          </div>
          <div className="flex items-center justify-between py-1">
            <Label className="text-xs text-foreground cursor-pointer">Highlight (featured result)</Label>
            <Switch checked={field.highlight ?? false} onCheckedChange={v => onChange({ ...field, highlight: v })} />
          </div>
        </div>
      )}
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-4 mb-2">{children}</p>;
}

export function RoiCalculatorPanel({ props, onChange }: Props) {
  const [presetOpen, setPresetOpen] = useState(false);
  const inputIds = props.inputFields.map(f => f.id);

  const updateInputField = (index: number, field: RoiInputField) => {
    const next = [...props.inputFields];
    next[index] = field;
    onChange({ ...props, inputFields: next });
  };

  const deleteInputField = (index: number) => {
    onChange({ ...props, inputFields: props.inputFields.filter((_, i) => i !== index) });
  };

  const moveInputField = (index: number, dir: "up" | "down") => {
    const next = [...props.inputFields];
    const swapIdx = dir === "up" ? index - 1 : index + 1;
    if (swapIdx < 0 || swapIdx >= next.length) return;
    [next[index], next[swapIdx]] = [next[swapIdx], next[index]];
    onChange({ ...props, inputFields: next });
  };

  const addInputField = () => {
    const label = "New Input";
    const id = genVarId(label, props.inputFields.map(f => f.id));
    const newField: RoiInputField = { id, label, defaultValue: 100, min: 0, max: 1000, step: 1, inputType: "number" };
    onChange({ ...props, inputFields: [...props.inputFields, newField] });
  };

  const updateOutputField = (index: number, field: RoiOutputField) => {
    const next = [...props.outputFields];
    next[index] = field;
    onChange({ ...props, outputFields: next });
  };

  const deleteOutputField = (index: number) => {
    onChange({ ...props, outputFields: props.outputFields.filter((_, i) => i !== index) });
  };

  const moveOutputField = (index: number, dir: "up" | "down") => {
    const next = [...props.outputFields];
    const swapIdx = dir === "up" ? index - 1 : index + 1;
    if (swapIdx < 0 || swapIdx >= next.length) return;
    [next[index], next[swapIdx]] = [next[swapIdx], next[index]];
    onChange({ ...props, outputFields: next });
  };

  const addOutputField = () => {
    const newField: RoiOutputField = { id: `out_${Date.now()}`, label: "New Output", formula: "0", format: "currency", decimals: 0, highlight: false };
    onChange({ ...props, outputFields: [...props.outputFields, newField] });
  };

  return (
    <div className="space-y-4">
      <Button variant="outline" size="sm" className="w-full gap-2 h-8 text-xs" onClick={() => setPresetOpen(true)}>
        <Wand2 className="w-3.5 h-3.5" /> Load Preset
      </Button>

      <Dialog open={presetOpen} onOpenChange={setPresetOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">Load a Preset Configuration</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            {ROI_PRESETS.map(preset => (
              <button
                key={preset.id}
                className="w-full text-left p-3 rounded-xl border border-border bg-background hover:border-primary/50 hover:bg-primary/5 transition-all"
                onClick={() => {
                  onChange({ ...props, ...preset.config });
                  setPresetOpen(false);
                }}
              >
                <p className="text-xs font-semibold text-foreground">{preset.name}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{preset.description}</p>
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setPresetOpen(false)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SectionHeading>Content</SectionHeading>

      <FieldRow label="Headline">
        <Input value={props.headline} onChange={e => onChange({ ...props, headline: e.target.value })} className="text-sm" />
      </FieldRow>

      <FieldRow label="Subheadline">
        <Textarea value={props.subheadline} onChange={e => onChange({ ...props, subheadline: e.target.value })} rows={2} className="text-sm resize-none" />
      </FieldRow>

      <FieldRow label="Results Panel Label">
        <Input value={props.resultsPanelLabel ?? "Your Results"} onChange={e => onChange({ ...props, resultsPanelLabel: e.target.value })} className="text-sm" />
      </FieldRow>

      <FieldRow label="Disclaimer (optional)">
        <Textarea value={props.disclaimer ?? ""} onChange={e => onChange({ ...props, disclaimer: e.target.value })} rows={2} className="text-xs resize-none" placeholder="Small print below results panel..." />
      </FieldRow>

      <SectionHeading>Appearance</SectionHeading>

      <FieldRow label="Background">
        <Select value={props.backgroundStyle ?? "white"} onValueChange={v => onChange({ ...props, backgroundStyle: v as RoiCalculatorBlockProps["backgroundStyle"] })}>
          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {BG_OPTIONS.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </FieldRow>

      <FieldRow label="Accent Color">
        <div className="flex items-center gap-2">
          <input type="color" value={props.accentColor ?? "#C7E738"} onChange={e => onChange({ ...props, accentColor: e.target.value })} className="w-8 h-8 rounded cursor-pointer border border-border" />
          <Input value={props.accentColor ?? "#C7E738"} onChange={e => onChange({ ...props, accentColor: e.target.value })} className="h-8 text-xs font-mono flex-1" />
        </div>
      </FieldRow>

      <SectionHeading>Input Fields</SectionHeading>

      <div className="space-y-2">
        {props.inputFields.map((field, i) => (
          <InputFieldEditor
            key={`${field.id}-${i}`}
            field={field}
            index={i}
            total={props.inputFields.length}
            allIds={inputIds}
            onChange={f => updateInputField(i, f)}
            onDelete={() => deleteInputField(i)}
            onMove={dir => moveInputField(i, dir)}
          />
        ))}
        <Button variant="outline" size="sm" className="w-full gap-1.5 h-8 text-xs" onClick={addInputField}>
          <Plus className="w-3.5 h-3.5" /> Add Input Field
        </Button>
      </div>

      <SectionHeading>Output / Results Fields</SectionHeading>

      {inputIds.length > 0 && (
        <div className="rounded-lg bg-muted/30 px-3 py-2 text-[10px] text-muted-foreground">
          Available variables in formulas: <span className="font-mono">{inputIds.join(", ")}</span>
        </div>
      )}

      <div className="space-y-2">
        {props.outputFields.map((field, i) => (
          <OutputFieldEditor
            key={`${field.id}-${i}`}
            field={field}
            index={i}
            total={props.outputFields.length}
            inputIds={inputIds}
            onChange={f => updateOutputField(i, f)}
            onDelete={() => deleteOutputField(i)}
            onMove={dir => moveOutputField(i, dir)}
          />
        ))}
        <Button variant="outline" size="sm" className="w-full gap-1.5 h-8 text-xs" onClick={addOutputField}>
          <Plus className="w-3.5 h-3.5" /> Add Output Field
        </Button>
      </div>

      <SectionHeading>CTA Button</SectionHeading>

      <div className="flex items-center justify-between">
        <Label className="text-xs text-foreground">Show CTA Button</Label>
        <Switch checked={props.ctaEnabled} onCheckedChange={v => onChange({ ...props, ctaEnabled: v })} />
      </div>

      {props.ctaEnabled && (
        <div className="space-y-3 pl-2 border-l-2 border-primary/20">
          <FieldRow label="Button Text">
            <Input value={props.ctaText} onChange={e => onChange({ ...props, ctaText: e.target.value })} className="text-sm" />
          </FieldRow>
          <FieldRow label="Action">
            <Select value={props.ctaAction ?? "url"} onValueChange={v => onChange({ ...props, ctaAction: v as "url" | "chilipiper" })}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="url">URL</SelectItem>
                <SelectItem value="chilipiper">Chili Piper</SelectItem>
              </SelectContent>
            </Select>
          </FieldRow>
          {(props.ctaAction ?? "url") === "url" ? (
            <FieldRow label="URL">
              <Input value={props.ctaUrl} onChange={e => onChange({ ...props, ctaUrl: e.target.value })} className="text-sm" placeholder="https://..." />
            </FieldRow>
          ) : (
            <FieldRow label="Chili Piper URL">
              <Input value={props.chilipiperUrl ?? ""} onChange={e => onChange({ ...props, chilipiperUrl: e.target.value })} className="text-sm" placeholder="https://..." />
            </FieldRow>
          )}
        </div>
      )}
    </div>
  );
}
