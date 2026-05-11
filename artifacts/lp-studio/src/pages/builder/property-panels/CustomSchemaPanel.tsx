import type { CustomSchemaBlockProps, SchemaFieldDef, SchemaFieldValue } from "@/lib/block-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImagePicker } from "@/components/ImagePicker";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link2, Link2Off, ExternalLink, RotateCcw } from "lucide-react";
import { useCustomBlock } from "@/lib/custom-blocks-context";

/**
 * Auto-generated property panel for `custom-schema` blocks.
 *
 * Task #120: schema/template are owned by the source custom block; this
 * panel only lets editors fill in the per-instance `values`. Schema is
 * read live from CustomBlocksContext so panel changes track template-author
 * edits.
 *
 * Task #198 (truly global blocks): when an instance is linked to a master
 * custom block, fields without an explicit per-instance override "follow"
 * the master's shared values. The panel surfaces this as:
 *   - a Linked badge with "Edit master" + "Unlink" actions
 *   - per-field "Following master" hint with the master value as placeholder
 *   - per-field "Reset to master" button when the field is overridden
 */

interface Props {
  props: CustomSchemaBlockProps;
  onChange: (props: CustomSchemaBlockProps) => void;
}

export function CustomSchemaPanel({ props, onChange }: Props) {
  const source = useCustomBlock(props.customBlockId);
  const schema: SchemaFieldDef[] = source?.schema ?? props.schema ?? [];
  const sourceName = source?.name ?? props.customBlockName;
  const sharedValues = source?.sharedValues ?? props.sharedValues ?? {};
  const isLinked = props.customBlockId !== undefined;

  const setVal = (id: string, value: SchemaFieldValue) => {
    onChange({ ...props, values: { ...(props.values || {}), [id]: value } });
  };

  const resetField = (id: string) => {
    const next = { ...(props.values || {}) };
    delete next[id];
    onChange({ ...props, values: next });
  };

  const unlink = () => {
    if (!isLinked) return;
    if (!confirm(
      "Unlink this block from its master?\n\nThis copies the current content into this page only. Future master edits will no longer flow to this instance.",
    )) return;
    // Snapshot the currently-rendered values onto the instance so nothing
    // changes visually, then clear the master reference + the live source
    // schema/template (the snapshotted ones below stand in for them).
    const snapshot: Record<string, SchemaFieldValue> = {};
    for (const f of schema) {
      const ov = props.values?.[f.id];
      const sv = sharedValues[f.id];
      const dv = f.defaultValue;
      const fallback: SchemaFieldValue = f.type === "boolean" ? false : f.type === "number" ? 0 : "";
      snapshot[f.id] = ov !== undefined ? ov : (sv !== undefined ? sv : (dv !== undefined ? dv : fallback));
    }
    onChange({
      ...props,
      schema: source?.schema ?? props.schema ?? [],
      template: source?.template ?? props.template ?? "",
      values: snapshot,
      customBlockId: undefined,
      customBlockName: undefined,
      sharedValues: undefined,
    });
  };

  if (schema.length === 0) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        This custom block has no editable fields. Add a field to its schema on the Custom Blocks page.
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {isLinked && sourceName && (
        <div className="rounded-md border border-primary/20 bg-primary/5 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1 bg-primary/10 text-primary border-primary/20">
              <Link2 className="w-3 h-3" />
              Linked
            </Badge>
            <span className="text-xs font-medium text-foreground truncate flex-1">{sourceName}</span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-snug">
            Fields follow the master unless you override them here. Edit the master to update every linked instance.
          </p>
          <div className="flex gap-1.5">
            <Button asChild size="sm" variant="outline" className="h-7 text-xs gap-1 flex-1">
              <a href="/custom-blocks" target="_blank" rel="noreferrer">
                <ExternalLink className="w-3 h-3" /> Edit master
              </a>
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-muted-foreground" onClick={unlink}>
              <Link2Off className="w-3 h-3" /> Unlink
            </Button>
          </div>
        </div>
      )}
      {schema.map((f: SchemaFieldDef) => {
        const isOverridden = props.values?.[f.id] !== undefined;
        const masterVal = sharedValues[f.id];
        return (
          <SchemaFieldEditor
            key={f.id}
            field={f}
            value={props.values?.[f.id]}
            masterValue={masterVal}
            isLinked={isLinked}
            isOverridden={isOverridden}
            onChange={v => setVal(f.id, v)}
            onReset={() => resetField(f.id)}
          />
        );
      })}
    </div>
  );
}

function isEmpty(field: SchemaFieldDef, v: SchemaFieldValue | undefined): boolean {
  if (v === undefined || v === null) return true;
  if (field.type === "boolean") return false;
  if (field.type === "number") return Number.isNaN(v) || v === "";
  return String(v).trim() === "";
}

function SchemaFieldEditor({
  field,
  value,
  masterValue,
  isLinked,
  isOverridden,
  onChange,
  onReset,
}: {
  field: SchemaFieldDef;
  value: SchemaFieldValue | undefined;
  masterValue: SchemaFieldValue | undefined;
  isLinked: boolean;
  isOverridden: boolean;
  onChange: (v: SchemaFieldValue) => void;
  onReset: () => void;
}) {
  // Effective value the renderer would use. Override > master > default > zero.
  const effective: SchemaFieldValue =
    value !== undefined
      ? value
      : (masterValue !== undefined
          ? masterValue
          : (field.defaultValue !== undefined
              ? field.defaultValue
              : (field.type === "boolean" ? false : field.type === "number" ? 0 : "")));
  const showRequiredWarning = field.required && isEmpty(field, isOverridden ? value : masterValue);
  const masterPlaceholder = isLinked && !isOverridden && masterValue !== undefined && masterValue !== ""
    ? `Master: ${String(masterValue).slice(0, 60)}`
    : field.placeholder;

  return (
    <div>
      <div className="flex items-center gap-2">
        <Label className="flex-1">
          {field.label}
          {field.required && <span className="text-red-500 ml-0.5">*</span>}
        </Label>
        {isLinked && isOverridden && (
          <Badge variant="outline" className="text-[10px] py-0 h-4 gap-1 text-amber-700 border-amber-300 bg-amber-50">
            Overridden
          </Badge>
        )}
        {isLinked && isOverridden && (
          <button
            type="button"
            onClick={onReset}
            className="text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5"
            title="Reset to master value"
          >
            <RotateCcw className="w-2.5 h-2.5" /> Reset
          </button>
        )}
      </div>
      <div className="mt-1.5">
        {field.type === "text" && (
          <Input value={String(effective)} onChange={e => onChange(e.target.value)} placeholder={masterPlaceholder} />
        )}
        {field.type === "longText" && (
          <Textarea rows={4} value={String(effective)} onChange={e => onChange(e.target.value)} placeholder={masterPlaceholder} />
        )}
        {field.type === "number" && (
          <Input type="number" value={String(effective)} onChange={e => onChange(Number(e.target.value))} />
        )}
        {field.type === "color" && (
          <Input type="color" value={String(effective) || "#000000"} onChange={e => onChange(e.target.value)} />
        )}
        {field.type === "url" && (
          <Input type="url" value={String(effective)} onChange={e => onChange(e.target.value)} placeholder={masterPlaceholder || "https://…"} />
        )}
        {field.type === "image" && (
          <ImagePicker label="" value={String(effective)} onChange={url => onChange(url)} />
        )}
        {field.type === "boolean" && (
          <Switch checked={Boolean(effective)} onCheckedChange={c => onChange(c)} />
        )}
        {field.type === "select" && (
          <Select value={String(effective)} onValueChange={val => onChange(val)}>
            <SelectTrigger><SelectValue placeholder="Choose…" /></SelectTrigger>
            <SelectContent>
              {(field.options ?? []).map((opt: string) => (
                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      {field.helpText && <p className="text-xs text-muted-foreground mt-1">{field.helpText}</p>}
      {isLinked && !isOverridden && (
        <p className="text-[10px] text-muted-foreground/80 mt-1 inline-flex items-center gap-1">
          <Link2 className="w-2.5 h-2.5" /> Following master
        </p>
      )}
      {showRequiredWarning && <p className="text-xs text-red-600 mt-1">This field is required.</p>}
    </div>
  );
}
