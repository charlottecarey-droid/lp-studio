import type { MintReadingBlockProps, MintReadingTile } from "@/blocks/BlockMintReading";
import type { CtaSourceProps } from "@/lib/cta/ctaSource";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImagePicker } from "@/components/ImagePicker";
import { AiTextField } from "@/components/AiTextField";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { suggestCopy } from "@/lib/copy-api";
import { AddButton, AnchorField, Field, ForestStyleSection, ItemHeader, PanelSection, TextField, moveItem } from "../forest/ForestPanelKit";

interface Props {
  props: MintReadingBlockProps;
  onChange: (props: MintReadingBlockProps) => void;
  ctaSource?: CtaSourceProps;
}

const MAX_TILES = 6;
const MIN_TILES = 2;

export function MintReadingPanel({ props, onChange }: Props) {
  const update = (patch: Partial<MintReadingBlockProps>) => onChange({ ...props, ...patch });
  const tiles = props.tiles ?? [];
  const setTiles = (next: MintReadingTile[]) => update({ tiles: next });
  const setTile = (i: number, patch: Partial<MintReadingTile>) => setTiles(tiles.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));

  return (
    <div className="space-y-3">
      <BlockRefreshButton
        blockType="mint-reading"
        fields={["headline", "subheadline"]}
        values={{ headline: props.headline ?? "", subheadline: props.subheadline ?? "" }}
        onApply={(u) => update(u)}
      />

      <PanelSection title="Copy" defaultOpen>
        <Field label="Headline">
          <AiTextField value={props.headline ?? ""} onChange={(v) => update({ headline: v })} rows={2} className="text-xs" fieldLabel="Headline"
            onSuggest={() => suggestCopy("mint-reading", "headline", props.headline ?? "", { subheadline: props.subheadline ?? "" })} />
        </Field>
        <TextField label="Supporting line (optional)" value={props.subheadline} onChange={(v) => update({ subheadline: v })} rows={2} />
        <Field label="Tiles per row (from 800px)">
          <Select value={String(props.columns === 2 ? 2 : 3)} onValueChange={(v) => update({ columns: v === "2" ? 2 : 3 })}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="2" className="text-xs">Two</SelectItem>
              <SelectItem value="3" className="text-xs">Three</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <AnchorField value={props.anchorId} onChange={(v) => update({ anchorId: v })} placeholder="reading" />
      </PanelSection>

      <PanelSection title={`Tiles (${tiles.length} of ${MAX_TILES})`} defaultOpen hint="The whole tile links on the live page; the photo sits on a mint stage until one is added">
        {tiles.map((t, i) => (
          <div key={i} className="rounded-md border bg-slate-50 p-2 space-y-1.5">
            <ItemHeader label={t.title || `Tile ${i + 1}`} index={i} total={tiles.length} onMove={(d) => setTiles(moveItem(tiles, i, d))} onRemove={tiles.length > MIN_TILES ? () => setTiles(tiles.filter((_, idx) => idx !== i)) : () => undefined} />
            <Field label="Kicker">
              <Input value={t.kicker ?? ""} onChange={(e) => setTile(i, { kicker: e.target.value })} placeholder="Customer story" className="h-7 text-xs" />
            </Field>
            <Field label="Title">
              <Textarea value={t.title} onChange={(e) => setTile(i, { title: e.target.value })} rows={2} className="text-xs" placeholder="How a 140-office group made consolidation stick." />
            </Field>
            <Field label="Excerpt">
              <Textarea value={t.body ?? ""} onChange={(e) => setTile(i, { body: e.target.value })} rows={3} className="text-xs" />
            </Field>
            <div className="grid grid-cols-2 gap-1.5">
              <Field label="Link text">
                <Input value={t.linkText ?? ""} onChange={(e) => setTile(i, { linkText: e.target.value })} placeholder="Read" className="h-7 text-xs" />
              </Field>
              <Field label="Link URL">
                <Input value={t.linkUrl ?? ""} onChange={(e) => setTile(i, { linkUrl: e.target.value })} placeholder="https:// or #section" className="h-7 text-xs font-mono" />
              </Field>
            </div>
            <Field label="Photo (16:10)">
              <ImagePicker value={t.imageUrl ?? ""} onChange={(v) => setTile(i, { imageUrl: v })} placeholder="Upload or paste image URL" />
            </Field>
            {t.imageUrl && (
              <Field label="Alt text">
                <Input value={t.imageAlt ?? ""} onChange={(e) => setTile(i, { imageAlt: e.target.value })} className="h-7 text-xs" />
              </Field>
            )}
          </div>
        ))}
        <AddButton label="Add tile" disabled={tiles.length >= MAX_TILES} onClick={() => setTiles([...tiles, { kicker: "Guide", title: "New resource", body: "", linkText: "Read", linkUrl: "#", imageUrl: "", imageAlt: "" }])} />
        {tiles.length <= MIN_TILES && <p className="text-[10px] text-muted-foreground">Keep at least {MIN_TILES} tiles.</p>}
      </PanelSection>

      <ForestStyleSection value={props} onChange={(p) => update(p)} defaultBg="#F5F5F3" hint="The pale grey band; white tiles sit on it" />
    </div>
  );
}
