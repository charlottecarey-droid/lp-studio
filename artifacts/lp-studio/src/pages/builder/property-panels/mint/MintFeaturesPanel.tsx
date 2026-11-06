import {
  MINT_FEATURES_MAX_BARS, MINT_FEATURES_MAX_CHECKS, MINT_FEATURES_MAX_LINES, MINT_FEATURES_MAX_META, MINT_FEATURES_MAX_ROWS, MINT_FEATURES_MIN_ROWS,
  type MintFeatureBar, type MintFeatureCheck, type MintFeatureLine, type MintFeatureRow, type MintFeatureStat, type MintFeaturesBlockProps,
} from "@/blocks/BlockMintFeatures";
import type { CtaSourceProps } from "@/lib/cta/ctaSource";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImagePicker } from "@/components/ImagePicker";
import { AiTextField } from "@/components/AiTextField";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { suggestCopy } from "@/lib/copy-api";
import { AddButton, AnchorField, Field, ForestStyleSection, ItemHeader, PanelSection, TextField, moveItem } from "../forest/ForestPanelKit";

interface Props {
  props: MintFeaturesBlockProps;
  onChange: (props: MintFeaturesBlockProps) => void;
  ctaSource?: CtaSourceProps;
}

const VISUAL_LABEL: Record<MintFeatureRow["visual"], string> = {
  image: "Photo (5:4)",
  invoice: "Invoice card (per-location economics)",
  bars: "Bar chart card (metric by office)",
  scan: "Scan photo with ring + checklist",
};

/** A compact nested list editor: header with move/remove, the fields for one item, an add button. */
function MiniList<T>({ label, items, max, onChange, render, blank, hint }: {
  label: string;
  items: T[];
  max: number;
  onChange: (next: T[]) => void;
  render: (item: T, patch: (p: Partial<T>) => void) => React.ReactNode;
  blank: () => T;
  hint?: string;
}) {
  const titleOf = (it: T, i: number) => {
    const o = it as Record<string, unknown>;
    return String(o.label ?? o.text ?? "") || `Item ${i + 1}`;
  };
  return (
    <Field label={`${label} (${items.length} of ${max})`}>
      <div className="space-y-1.5">
        {items.map((it, i) => (
          <div key={i} className="rounded border bg-white p-1.5 space-y-1">
            <ItemHeader label={titleOf(it, i)} index={i} total={items.length} onMove={(d) => onChange(moveItem(items, i, d))} onRemove={() => onChange(items.filter((_, idx) => idx !== i))} />
            {render(it, (patch) => onChange(items.map((x, idx) => (idx === i ? { ...x, ...patch } : x))))}
          </div>
        ))}
      </div>
      <div className="mt-1.5">
        <AddButton label="Add" disabled={items.length >= max} onClick={() => onChange([...items, blank()])} />
      </div>
      {hint && <p className="mt-1 text-[10px] text-muted-foreground leading-relaxed">{hint}</p>}
    </Field>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

const pct = (v: string, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) && v.trim() !== "" ? Math.max(0, Math.min(100, n)) : fallback;
};

export function MintFeaturesPanel({ props, onChange }: Props) {
  const update = (patch: Partial<MintFeaturesBlockProps>) => onChange({ ...props, ...patch });
  const rows = props.rows ?? [];
  const setRows = (next: MintFeatureRow[]) => update({ rows: next });
  const patchRow = (i: number, patch: Partial<MintFeatureRow>) => setRows(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const blankRow = (): MintFeatureRow => ({
    kicker: "New part",
    title: "What this part does.",
    body: "",
    metaStats: [],
    linkText: "",
    linkUrl: "#",
    visual: "image",
    imageUrl: "",
    imageAlt: "",
    imageFit: "cover",
  });

  return (
    <div className="space-y-3">
      <BlockRefreshButton
        blockType="mint-features"
        fields={["headline", "subheadline"]}
        values={{ headline: props.headline ?? "", subheadline: props.subheadline ?? "" }}
        onApply={(u) => update(u)}
      />

      <PanelSection title="Copy" defaultOpen hint="The header row: a lime-dot eyebrow with a muted suffix, the headline, and a quiet chevron link on the right">
        <div className="grid grid-cols-2 gap-1.5">
          <TextField label="Eyebrow" value={props.eyebrow} onChange={(v) => update({ eyebrow: v })} placeholder="The system" />
          <TextField label="Eyebrow suffix" value={props.eyebrowSuffix} onChange={(v) => update({ eyebrowSuffix: v })} placeholder="· Four parts" />
        </div>
        <Field label="Headline">
          <AiTextField value={props.headline ?? ""} onChange={(v) => update({ headline: v })} rows={2} className="text-xs" fieldLabel="Headline"
            onSuggest={() => suggestCopy("mint-features", "headline", props.headline ?? "", { subheadline: props.subheadline ?? "" })} />
        </Field>
        <Field label="Supporting line">
          <AiTextField value={props.subheadline ?? ""} onChange={(v) => update({ subheadline: v })} rows={2} className="text-xs" fieldLabel="Supporting line"
            onSuggest={() => suggestCopy("mint-features", "subheadline", props.subheadline ?? "", { headline: props.headline ?? "" })} />
        </Field>
        <div className="grid grid-cols-2 gap-1.5">
          <TextField label="Header link (blank = none)" value={props.headerLinkText} onChange={(v) => update({ headerLinkText: v })} placeholder="How it works" />
          <Field label="Header link URL">
            <Input value={props.headerLinkUrl ?? ""} onChange={(e) => update({ headerLinkUrl: e.target.value })} placeholder="#section or https://" className="h-8 text-xs font-mono" />
          </Field>
        </div>
        <AnchorField value={props.anchorId} onChange={(v) => update({ anchorId: v })} placeholder="system" />
      </PanelSection>

      <PanelSection title={`Feature rows (${rows.length} of ${MINT_FEATURES_MAX_ROWS})`} defaultOpen hint="Rows alternate visual-left / visual-right on wide screens; the visual stacks on top on phones">
        {rows.map((r, i) => (
          <div key={i} className="rounded-md border bg-slate-50 p-2 space-y-1.5">
            <ItemHeader label={r.kicker || r.title || `Row ${i + 1}`} index={i} total={rows.length} onMove={(d) => setRows(moveItem(rows, i, d))} onRemove={() => { if (rows.length > MINT_FEATURES_MIN_ROWS) setRows(rows.filter((_, idx) => idx !== i)); }} />
            <div className="grid grid-cols-[56px_minmax(0,1fr)] gap-1.5">
              <Input value={r.index ?? ""} onChange={(e) => patchRow(i, { index: e.target.value })} placeholder={String(i + 1).padStart(2, "0")} className="h-7 text-xs" title="Index in front of the kicker (blank = numbered by position)" />
              <Input value={r.kicker} onChange={(e) => patchRow(i, { kicker: e.target.value })} placeholder="Kicker (Adoption)" className="h-7 text-xs" />
            </div>
            <Input value={r.title} onChange={(e) => patchRow(i, { title: e.target.value })} placeholder="Title" className="h-7 text-xs" />
            <Textarea value={r.body} onChange={(e) => patchRow(i, { body: e.target.value })} placeholder="Paragraph" rows={3} className="text-xs" />
            <MiniList<MintFeatureStat>
              label="Numbers under the body"
              items={r.metaStats && r.metaStats.length > 0 ? r.metaStats : (r.statValue ? [{ value: r.statValue, label: r.statLabel ?? "" }] : [])}
              max={MINT_FEATURES_MAX_META}
              onChange={(v) => patchRow(i, { metaStats: v, statValue: "", statLabel: "" })}
              blank={() => ({ value: "70%", label: "of practices activate on training day" })}
              render={(st, patch) => (
                <div className="grid grid-cols-2 gap-1.5">
                  <Input value={st.value} onChange={(e) => patch({ value: e.target.value })} placeholder="Number (70%)" className="h-7 text-xs" />
                  <Input value={st.label} onChange={(e) => patch({ label: e.target.value })} placeholder="Caption" className="h-7 text-xs" />
                </div>
              )}
              hint="A two-cell grid under a hairline. Blank = no grid."
            />
            <div className="grid grid-cols-2 gap-1.5">
              <Input value={r.linkText ?? ""} onChange={(e) => patchRow(i, { linkText: e.target.value })} placeholder="Link text (blank = none)" className="h-7 text-xs" />
              <Input value={r.linkUrl ?? ""} onChange={(e) => patchRow(i, { linkUrl: e.target.value })} placeholder="#section or https://" className="h-7 text-xs font-mono" />
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <Field label="Visual">
                <Select value={r.visual} onValueChange={(v) => patchRow(i, { visual: v as MintFeatureRow["visual"] })}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(VISUAL_LABEL) as MintFeatureRow["visual"][]).map((k) => (
                      <SelectItem key={k} value={k} className="text-xs">{VISUAL_LABEL[k]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Side (wide screens)">
                <Select value={r.visualSide ?? "auto"} onValueChange={(v) => patchRow(i, { visualSide: v === "auto" ? undefined : (v as "left" | "right") })}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto" className="text-xs">Alternate</SelectItem>
                    <SelectItem value="left" className="text-xs">Visual left</SelectItem>
                    <SelectItem value="right" className="text-xs">Visual right</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>

            {(r.visual === "image" || r.visual === "scan") && (
              <>
                <Field label={r.visual === "scan" ? "Scan photo (4:3)" : "Photo (5:4)"}>
                  <ImagePicker value={r.imageUrl ?? ""} onChange={(v) => patchRow(i, { imageUrl: v })} placeholder="Upload or paste image URL" aiHint={r.title || r.kicker} />
                </Field>
                <Input value={r.imageAlt ?? ""} onChange={(e) => patchRow(i, { imageAlt: e.target.value })} placeholder="Alt text" className="h-7 text-xs" />
              </>
            )}
            {r.visual === "image" && (
              <Field label="Fit">
                <Select value={r.imageFit ?? "cover"} onValueChange={(v) => patchRow(i, { imageFit: v as "cover" | "contain" })}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cover" className="text-xs">Fill the frame (photo)</SelectItem>
                    <SelectItem value="contain" className="text-xs">Fit inside on a mint stage (product shot)</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            )}

            {(r.visual === "invoice" || r.visual === "bars") && (
              <div className="grid grid-cols-2 gap-1.5">
                <Input value={r.mockTitle ?? ""} onChange={(e) => patchRow(i, { mockTitle: e.target.value })} placeholder={r.visual === "invoice" ? "Per location" : "Remake rate by office"} className="h-7 text-xs" />
                <Input value={r.mockMeta ?? ""} onChange={(e) => patchRow(i, { mockMeta: e.target.value })} placeholder={r.visual === "invoice" ? "Month to month" : "Last 30 days"} className="h-7 text-xs" />
              </div>
            )}

            {r.visual === "invoice" && (
              <>
                <MiniList<MintFeatureLine>
                  label="Invoice lines"
                  items={r.lines ?? []}
                  max={MINT_FEATURES_MAX_LINES}
                  onChange={(v) => patchRow(i, { lines: v })}
                  blank={() => ({ label: "Line item", value: "Included", emphasis: true })}
                  render={(l, patch) => (
                    <>
                      <div className="grid grid-cols-2 gap-1.5">
                        <Input value={l.label} onChange={(e) => patch({ label: e.target.value })} placeholder="Label" className="h-7 text-xs" />
                        <Input value={l.value} onChange={(e) => patch({ value: e.target.value })} placeholder="$0" className="h-7 text-xs" />
                      </div>
                      <Toggle label="Green value" checked={!!l.emphasis} onChange={(v) => patch({ emphasis: v })} />
                    </>
                  )}
                  hint="Dashed hairlines between lines; green values read as included."
                />
                <TextField label="Small label over the total" value={r.mockFooterLabel} onChange={(v) => patchRow(i, { mockFooterLabel: v })} placeholder="Scanner CapEx avoided" />
                <div className="grid grid-cols-2 gap-1.5">
                  <Input value={r.mockTotal ?? ""} onChange={(e) => patchRow(i, { mockTotal: e.target.value })} placeholder="Total ($0)" className="h-7 text-xs" />
                  <Input value={r.mockPill ?? ""} onChange={(e) => patchRow(i, { mockPill: e.target.value })} placeholder="Pill (vs $40–75K)" className="h-7 text-xs" />
                </div>
              </>
            )}

            {r.visual === "bars" && (
              <>
                <MiniList<MintFeatureBar>
                  label="Bars"
                  items={r.bars ?? []}
                  max={MINT_FEATURES_MAX_BARS}
                  onChange={(v) => patchRow(i, { bars: v })}
                  blank={() => ({ label: "Office", value: "1.0%", pct: 20 })}
                  render={(b, patch) => (
                    <>
                      <div className="grid grid-cols-[minmax(0,1fr)_64px_56px] gap-1.5">
                        <Input value={b.label} onChange={(e) => patch({ label: e.target.value })} placeholder="Office" className="h-7 text-xs" />
                        <Input value={b.value} onChange={(e) => patch({ value: e.target.value })} placeholder="1.1%" className="h-7 text-xs" />
                        <Input type="number" min={0} max={100} value={b.pct} onChange={(e) => patch({ pct: pct(e.target.value, 0) })} placeholder="%" className="h-7 text-xs" title="Bar fill, 0–100" />
                      </div>
                      <Toggle label="Flag this office (warning colour)" checked={!!b.bad} onChange={(v) => patch({ bad: v })} />
                    </>
                  )}
                  hint="Label · shown value · bar fill (0–100)."
                />
                <div className="grid grid-cols-2 gap-1.5">
                  <Input value={r.mockFooterLabel ?? ""} onChange={(e) => patchRow(i, { mockFooterLabel: e.target.value })} placeholder="Footer (Network average 1.9%)" className="h-7 text-xs" />
                  <Input value={r.mockPill ?? ""} onChange={(e) => patchRow(i, { mockPill: e.target.value })} placeholder="Pill (1 office to coach)" className="h-7 text-xs" />
                </div>
              </>
            )}

            {r.visual === "scan" && (
              <>
                <Field label="Ring percentage (0–100)">
                  <Input type="number" min={0} max={100} value={r.ringPct ?? 98} onChange={(e) => patchRow(i, { ringPct: pct(e.target.value, 98) })} className="h-7 text-xs" />
                </Field>
                <MiniList<MintFeatureCheck>
                  label="Checklist"
                  items={r.checks ?? []}
                  max={MINT_FEATURES_MAX_CHECKS}
                  onChange={(v) => patchRow(i, { checks: v })}
                  blank={() => ({ text: "Check passed" })}
                  render={(c, patch) => (
                    <>
                      <Input value={c.text} onChange={(e) => patch({ text: e.target.value })} placeholder="Margins captured" className="h-7 text-xs" />
                      <Toggle label="Warning (amber dot)" checked={!!c.warn} onChange={(v) => patch({ warn: v })} />
                    </>
                  )}
                />
              </>
            )}
          </div>
        ))}
        <AddButton label="Add row" disabled={rows.length >= MINT_FEATURES_MAX_ROWS} onClick={() => setRows([...rows, blankRow()])} />
        {rows.length <= MINT_FEATURES_MIN_ROWS && <p className="text-[10px] text-muted-foreground leading-relaxed">Keep at least {MINT_FEATURES_MIN_ROWS} rows.</p>}
      </PanelSection>

      <ForestStyleSection value={props} onChange={(p) => update(p)} defaultBg="#FFFFFF" hint="White by default; the mock stages stay mint and soft lime on any surface" />
    </div>
  );
}
