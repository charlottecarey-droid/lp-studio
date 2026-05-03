import type { CustomSchemaBlockProps, SchemaFieldDef, SchemaFieldValue } from "@/lib/block-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImagePicker } from "@/components/ImagePicker";
import { useCustomBlock } from "@/lib/custom-blocks-context";

/**
 * Auto-generated property panel for `custom-schema` blocks (task #120).
 *
 * The schema/template are owned by the source custom block; this panel only
 * lets editors fill in the per-instance `values`. Schema is read live from
 * CustomBlocksContext so panel changes track template-author edits.
 */

interface Props {
  props: CustomSchemaBlockProps;
  onChange: (props: CustomSchemaBlockProps) => void;
}

export function CustomSchemaPanel({ props, onChange }: Props) {
  const source = useCustomBlock(props.customBlockId);
  const schema: SchemaFieldDef[] = source?.schema ?? props.schema ?? [];
  const sourceName = source?.name ?? props.customBlockName;

  const setVal = (id: string, value: SchemaFieldValue) => {
    onChange({ ...props, values: { ...(props.values || {}), [id]: value } });
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
      {sourceName && (
        <div className="text-xs text-muted-foreground">
          Source: <span className="font-medium text-foreground">{sourceName}</span>
        </div>
      )}
      {schema.map((f: SchemaFieldDef) => (
        <SchemaFieldEditor key={f.id} field={f} value={props.values?.[f.id]} onChange={v => setVal(f.id, v)} />
      ))}
    </div>
  );
}

function isEmpty(field: SchemaFieldDef, v: SchemaFieldValue | undefined): boolean {
  if (v === undefined || v === null) return true;
  if (field.type === "boolean") return false;
  if (field.type === "number") return Number.isNaN(v) || v === "";
  return String(v).trim() === "";
}

function SchemaFieldEditor({ field, value, onChange }: { field: SchemaFieldDef; value: SchemaFieldValue | undefined; onChange: (v: SchemaFieldValue) => void }) {
  const v = value ?? field.defaultValue ?? (field.type === "boolean" ? false : field.type === "number" ? 0 : "");
  const showRequiredWarning = field.required && isEmpty(field, value);
  return (
    <div>
      <Label>
        {field.label}
        {field.required && <span className="text-red-500 ml-0.5">*</span>}
      </Label>
      <div className="mt-1.5">
        {field.type === "text" && (
          <Input value={String(v)} onChange={e => onChange(e.target.value)} placeholder={field.placeholder} />
        )}
        {field.type === "longText" && (
          <Textarea rows={4} value={String(v)} onChange={e => onChange(e.target.value)} placeholder={field.placeholder} />
        )}
        {field.type === "number" && (
          <Input type="number" value={String(v)} onChange={e => onChange(Number(e.target.value))} />
        )}
        {field.type === "color" && (
          <Input type="color" value={String(v) || "#000000"} onChange={e => onChange(e.target.value)} />
        )}
        {field.type === "url" && (
          <Input type="url" value={String(v)} onChange={e => onChange(e.target.value)} placeholder={field.placeholder || "https://…"} />
        )}
        {field.type === "image" && (
          <ImagePicker label="" value={String(v)} onChange={url => onChange(url)} />
        )}
        {field.type === "boolean" && (
          <Switch checked={Boolean(v)} onCheckedChange={c => onChange(c)} />
        )}
        {field.type === "select" && (
          <Select value={String(v)} onValueChange={val => onChange(val)}>
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
      {showRequiredWarning && <p className="text-xs text-red-600 mt-1">This field is required.</p>}
    </div>
  );
}
