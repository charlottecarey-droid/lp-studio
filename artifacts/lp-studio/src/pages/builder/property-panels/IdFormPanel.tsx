import type { IdFormBlockProps, IdFormField } from "@/lib/block-types";

interface Props {
  props: IdFormBlockProps;
  onChange: (next: IdFormBlockProps) => void;
}

const FIELD_TYPES: { value: IdFormField["type"]; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "email", label: "Email" },
  { value: "tel", label: "Phone" },
  { value: "url", label: "URL" },
  { value: "textarea", label: "Long text" },
  { value: "select", label: "Dropdown" },
];

function Color({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string | undefined;
  placeholder: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-2 text-[11px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1.5">
        <input
          type="color"
          value={(value || placeholder).slice(0, 7)}
          onChange={(e) => onChange(e.target.value)}
          className="w-6 h-6 rounded border border-border bg-transparent cursor-pointer"
        />
        <input
          type="text"
          value={value || ""}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="w-20 text-[10px] font-mono px-1.5 py-1 rounded border border-border bg-transparent"
        />
      </span>
    </label>
  );
}

export function IdFormPanel({ props, onChange }: Props) {
  const u = (patch: Partial<IdFormBlockProps>) => onChange({ ...props, ...patch });
  const fields = props.fields ?? [];
  const meta = props.metaItems ?? [];

  const updateField = (i: number, patch: Partial<IdFormField>) => {
    const next = fields.map((f, idx) => (idx === i ? { ...f, ...patch } : f));
    u({ fields: next });
  };
  const addField = () =>
    u({
      fields: [
        ...fields,
        {
          name: `field-${fields.length + 1}`,
          label: "New field",
          type: "text",
          required: false,
          placeholder: "",
        },
      ],
    });
  const removeField = (i: number) => u({ fields: fields.filter((_, idx) => idx !== i) });
  const moveField = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= fields.length) return;
    const next = [...fields];
    [next[i], next[j]] = [next[j], next[i]];
    u({ fields: next });
  };

  return (
    <div className="space-y-5">
      {/* Copy */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Copy</div>
        <label className="block text-[11px] text-muted-foreground">
          Eyebrow
          <input
            type="text"
            value={props.eyebrow || ""}
            onChange={(e) => u({ eyebrow: e.target.value })}
            className="mt-1 w-full px-2 py-1.5 text-xs rounded border border-border bg-transparent"
          />
        </label>
        <label className="block text-[11px] text-muted-foreground">
          Headline (HTML, use &lt;em&gt; for accent)
          <textarea
            value={props.headline || ""}
            onChange={(e) => u({ headline: e.target.value })}
            rows={2}
            className="mt-1 w-full px-2 py-1.5 text-xs rounded border border-border bg-transparent"
          />
        </label>
        <label className="block text-[11px] text-muted-foreground">
          Subheadline
          <textarea
            value={props.subheadline || ""}
            onChange={(e) => u({ subheadline: e.target.value })}
            rows={2}
            className="mt-1 w-full px-2 py-1.5 text-xs rounded border border-border bg-transparent"
          />
        </label>
        <label className="block text-[11px] text-muted-foreground">
          Legal / fine print (HTML)
          <textarea
            value={props.legal || ""}
            onChange={(e) => u({ legal: e.target.value })}
            rows={2}
            className="mt-1 w-full px-2 py-1.5 text-xs rounded border border-border bg-transparent"
          />
        </label>
      </div>

      {/* Fields */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Fields</div>
          <button
            onClick={addField}
            className="text-[10px] uppercase tracking-wider px-2 py-1 rounded border border-border hover:bg-muted"
          >
            + Add field
          </button>
        </div>
        {fields.map((f, i) => (
          <div key={i} className="space-y-1.5 p-2 rounded border border-border">
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={f.label}
                onChange={(e) => updateField(i, { label: e.target.value })}
                placeholder="Label"
                className="flex-1 px-2 py-1 text-xs rounded border border-border bg-transparent"
              />
              <button
                onClick={() => moveField(i, -1)}
                disabled={i === 0}
                className="px-1.5 py-1 text-[10px] rounded border border-border disabled:opacity-30"
                title="Move up"
              >
                ↑
              </button>
              <button
                onClick={() => moveField(i, 1)}
                disabled={i === fields.length - 1}
                className="px-1.5 py-1 text-[10px] rounded border border-border disabled:opacity-30"
                title="Move down"
              >
                ↓
              </button>
              <button
                onClick={() => removeField(i)}
                className="px-1.5 py-1 text-[10px] rounded border border-border text-red-600"
                title="Delete"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <input
                type="text"
                value={f.name}
                onChange={(e) => updateField(i, { name: e.target.value })}
                placeholder="name (kebab)"
                className="px-2 py-1 text-[10px] font-mono rounded border border-border bg-transparent"
              />
              <select
                value={f.type}
                onChange={(e) => updateField(i, { type: e.target.value as IdFormField["type"] })}
                className="px-2 py-1 text-[10px] rounded border border-border bg-transparent"
              >
                {FIELD_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <input
              type="text"
              value={f.placeholder || ""}
              onChange={(e) => updateField(i, { placeholder: e.target.value })}
              placeholder="placeholder"
              className="w-full px-2 py-1 text-[10px] rounded border border-border bg-transparent"
            />
            {f.type === "select" && (
              <textarea
                value={(f.options || []).map((o) => o.label).join("\n")}
                onChange={(e) =>
                  updateField(i, {
                    options: e.target.value
                      .split("\n")
                      .map((l) => l.trim())
                      .filter(Boolean)
                      .map((l) => ({ label: l, value: l })),
                  })
                }
                placeholder="One option per line"
                rows={3}
                className="w-full px-2 py-1 text-[10px] rounded border border-border bg-transparent"
              />
            )}
            <div className="flex items-center gap-3 text-[10px]">
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!f.required}
                  onChange={(e) => updateField(i, { required: e.target.checked })}
                />
                Required
              </label>
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!f.fullWidth}
                  onChange={(e) => updateField(i, { fullWidth: e.target.checked })}
                />
                Full width
              </label>
            </div>
          </div>
        ))}
      </div>

      {/* Submission */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Submission</div>
        <label className="block text-[11px] text-muted-foreground">
          Submit button text
          <input
            type="text"
            value={props.submitText || ""}
            onChange={(e) => u({ submitText: e.target.value })}
            placeholder="Submit"
            className="mt-1 w-full px-2 py-1.5 text-xs rounded border border-border bg-transparent"
          />
        </label>
        <label className="block text-[11px] text-muted-foreground">
          Submit URL (POST JSON) — leave blank for demo
          <input
            type="url"
            value={props.submitUrl || ""}
            onChange={(e) => u({ submitUrl: e.target.value })}
            placeholder="https://…"
            className="mt-1 w-full px-2 py-1.5 text-xs font-mono rounded border border-border bg-transparent"
          />
        </label>
        <label className="block text-[11px] text-muted-foreground">
          Success headline
          <input
            type="text"
            value={props.successHeadline || ""}
            onChange={(e) => u({ successHeadline: e.target.value })}
            className="mt-1 w-full px-2 py-1.5 text-xs rounded border border-border bg-transparent"
          />
        </label>
        <label className="block text-[11px] text-muted-foreground">
          Success body (HTML)
          <textarea
            value={props.successBody || ""}
            onChange={(e) => u({ successBody: e.target.value })}
            rows={2}
            className="mt-1 w-full px-2 py-1.5 text-xs rounded border border-border bg-transparent"
          />
        </label>
      </div>

      {/* Meta items (sidebar) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Side meta items</div>
          <button
            onClick={() => u({ metaItems: [...meta, { label: "LABEL", value: "Value" }] })}
            className="text-[10px] uppercase tracking-wider px-2 py-1 rounded border border-border hover:bg-muted"
          >
            + Add
          </button>
        </div>
        {meta.map((m, i) => (
          <div key={i} className="flex items-center gap-1">
            <input
              type="text"
              value={m.label}
              onChange={(e) => {
                const next = meta.map((x, idx) => (idx === i ? { ...x, label: e.target.value } : x));
                u({ metaItems: next });
              }}
              placeholder="LABEL"
              className="w-24 px-2 py-1 text-[10px] font-mono rounded border border-border bg-transparent"
            />
            <input
              type="text"
              value={m.value}
              onChange={(e) => {
                const next = meta.map((x, idx) => (idx === i ? { ...x, value: e.target.value } : x));
                u({ metaItems: next });
              }}
              placeholder="Value (HTML)"
              className="flex-1 px-2 py-1 text-[10px] rounded border border-border bg-transparent"
            />
            <button
              onClick={() => u({ metaItems: meta.filter((_, idx) => idx !== i) })}
              className="px-1.5 py-1 text-[10px] rounded border border-border text-red-600"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* Colors */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Colors</div>
        <Color label="Background" value={props.backgroundColor} placeholder="#001814" onChange={(v) => u({ backgroundColor: v })} />
        <Color label="Accent" value={props.accent} placeholder="#C7E738" onChange={(v) => u({ accent: v })} />
        <Color label="Headline text" value={props.headlineColor} placeholder="#ffffff" onChange={(v) => u({ headlineColor: v })} />
        <Color label="Subheadline text" value={props.subheadlineColor} placeholder="#a8b0ae" onChange={(v) => u({ subheadlineColor: v })} />
        <div className="pt-1 text-[10px] uppercase tracking-wider text-muted-foreground">Form card</div>
        <Color label="Card background" value={props.surfaceColor} placeholder="#0a201d" onChange={(v) => u({ surfaceColor: v })} />
        <Color label="Card border" value={props.borderColor} placeholder="#1f3a36" onChange={(v) => u({ borderColor: v })} />
        <Color label="Label text" value={props.labelColor} placeholder="#8b9c98" onChange={(v) => u({ labelColor: v })} />
        <Color label="Input background" value={props.inputBg} placeholder="#06120f" onChange={(v) => u({ inputBg: v })} />
        <Color label="Input border" value={props.inputBorder} placeholder="#1e2e2b" onChange={(v) => u({ inputBorder: v })} />
        <Color label="Input text" value={props.inputText} placeholder="#ffffff" onChange={(v) => u({ inputText: v })} />
        <Color label="Button background" value={props.buttonBg} placeholder="#C7E738" onChange={(v) => u({ buttonBg: v })} />
        <Color label="Button text" value={props.buttonText} placeholder="#001814" onChange={(v) => u({ buttonText: v })} />
      </div>
    </div>
  );
}
