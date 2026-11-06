import { MINT_ROUTER_MAX_BULLETS, MINT_ROUTER_MAX_CARDS, MINT_ROUTER_MAX_PANEL_STATS, type MintRouterBlockProps, type MintRouterCard, type MintRouterStat } from "@/blocks/BlockMintRouter";
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
  props: MintRouterBlockProps;
  onChange: (props: MintRouterBlockProps) => void;
  ctaSource?: CtaSourceProps;
}

const EMPTY_CARD: MintRouterCard = {
  stage: "Somewhere in between",
  quote: "We are not sure where we sit.",
  body: "",
  linkText: "Talk it through",
  linkUrl: "#",
  optionText: "somewhere in between",
  panelTitle: "Start with a working session.",
  panelBody: "",
  panelBullets: [],
  imageUrl: "",
  imageAlt: "",
  panelStats: [],
};

export function MintRouterPanel({ props, onChange }: Props) {
  const update = (patch: Partial<MintRouterBlockProps>) => onChange({ ...props, ...patch });
  const cards = props.cards ?? [];
  const setCards = (next: MintRouterCard[]) => update({ cards: next });
  const patchCard = (i: number, patch: Partial<MintRouterCard>) => setCards(cards.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const layout = props.layout === "rows" ? "rows" : props.layout === "picker" ? "picker" : "cross";
  const picker = layout === "picker";
  const active = Math.max(0, Math.min(cards.length - 1, props.pickerActive ?? 0));

  return (
    <div className="space-y-3">
      <BlockRefreshButton
        blockType="mint-router"
        fields={["headline", "subheadline"]}
        values={{ headline: props.headline ?? "", subheadline: props.subheadline ?? "" }}
        onApply={(u) => update(u)}
      />

      <PanelSection title="Layout" defaultOpen>
        <Field label="Layout">
          <Select value={layout} onValueChange={(v) => update({ layout: v as MintRouterBlockProps["layout"] })}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="cross" className="text-xs">Cross (2×2 with hairlines)</SelectItem>
              <SelectItem value="rows" className="text-xs">Rows (bordered card list)</SelectItem>
              <SelectItem value="picker" className="text-xs">Picker (sentence + dropdown + panel)</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        {picker && (
          <>
            <TextField label="Sentence in front of the dropdown" value={props.pickerLead} onChange={(v) => update({ pickerLead: v })} placeholder="Our lab strategy today is" />
            <Field label="Starting point shown first (and in the builder)">
              <Select value={String(active)} onValueChange={(v) => update({ pickerActive: Number(v) })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {cards.map((c, i) => (
                    <SelectItem key={i} value={String(i)} className="text-xs">{String(i + 1).padStart(2, "0")} · {c.optionText || c.stage || `Starting point ${i + 1}`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </>
        )}
      </PanelSection>

      <PanelSection title="Copy" defaultOpen hint={picker ? "The picker shows the sentence instead of the headline; these still feed the dropdown's label." : "The header row: a lime-dot eyebrow with a muted suffix, the headline, and a quiet chevron link on the right"}>
        {!picker && (
          <div className="grid grid-cols-2 gap-1.5">
            <TextField label="Eyebrow (blank = none)" value={props.eyebrow} onChange={(v) => update({ eyebrow: v })} placeholder="Starting points" />
            <TextField label="Eyebrow suffix" value={props.eyebrowSuffix} onChange={(v) => update({ eyebrowSuffix: v })} placeholder="· Four stages" />
          </div>
        )}
        <Field label="Headline">
          <AiTextField value={props.headline ?? ""} onChange={(v) => update({ headline: v })} rows={2} className="text-xs" fieldLabel="Headline"
            onSuggest={() => suggestCopy("mint-router", "headline", props.headline ?? "", { subheadline: props.subheadline ?? "" })} />
        </Field>
        {!picker && (
          <>
            <Field label="Supporting line (optional)">
              <AiTextField value={props.subheadline ?? ""} onChange={(v) => update({ subheadline: v })} rows={2} className="text-xs" fieldLabel="Supporting line"
                onSuggest={() => suggestCopy("mint-router", "subheadline", props.subheadline ?? "", { headline: props.headline ?? "" })} />
            </Field>
            <div className="grid grid-cols-2 gap-1.5">
              <TextField label="Header link (blank = none)" value={props.headerLinkText} onChange={(v) => update({ headerLinkText: v })} placeholder="How it works" />
              <Field label="Header link URL">
                <Input value={props.headerLinkUrl ?? ""} onChange={(e) => update({ headerLinkUrl: e.target.value })} placeholder="#section or https://" className="h-8 text-xs font-mono" />
              </Field>
            </div>
          </>
        )}
        <AnchorField value={props.anchorId} onChange={(v) => update({ anchorId: v })} placeholder="start" />
      </PanelSection>

      <PanelSection title={`Starting points (${cards.length} of ${MINT_ROUTER_MAX_CARDS})`} hint={picker ? "Each starting point is one dropdown option with its own panel." : "Type the quote without quote marks; the page draws them. The cross shows the first four."} defaultOpen>
        {cards.map((c, i) => {
          const bullets = c.panelBullets ?? [];
          const stats = c.panelStats ?? [];
          return (
            <div key={i} className="rounded-md border bg-slate-50 p-2 space-y-1.5">
              <ItemHeader label={c.stage || c.linkText || `Starting point ${i + 1}`} index={i} total={cards.length} onMove={(d) => setCards(moveItem(cards, i, d))} onRemove={() => setCards(cards.filter((_, idx) => idx !== i))} />
              <Field label="Stage label (uppercase)">
                <Input value={c.stage} onChange={(e) => patchCard(i, { stage: e.target.value })} placeholder="No strategy yet" className="h-7 text-xs" />
              </Field>
              <Field label={picker ? "Quote (cross / rows layouts)" : "Quote (no quote marks)"}>
                <Textarea value={c.quote} onChange={(e) => patchCard(i, { quote: e.target.value })} rows={2} className="text-xs" placeholder="Doctors pick their own labs." />
              </Field>
              {!picker && (
                <Field label={layout === "rows" ? "Description" : "Description (rows layout only)"}>
                  <Textarea value={c.body ?? ""} onChange={(e) => patchCard(i, { body: e.target.value })} rows={2} className="text-xs" placeholder="You have never priced the category as one line." />
                </Field>
              )}
              <div className="grid grid-cols-2 gap-1.5">
                <Field label="Link label"><Input value={c.linkText ?? ""} onChange={(e) => patchCard(i, { linkText: e.target.value })} placeholder="Your first lab strategy" className="h-7 text-xs" /></Field>
                <Field label="Link URL"><Input value={c.linkUrl ?? ""} onChange={(e) => patchCard(i, { linkUrl: e.target.value })} placeholder="#section or https://" className="h-7 text-xs font-mono" /></Field>
              </div>

              {picker && (
                <div className="rounded border bg-white p-1.5 space-y-1.5">
                  <Field label="Dropdown option (completes the sentence)">
                    <Input value={c.optionText ?? ""} onChange={(e) => patchCard(i, { optionText: e.target.value })} placeholder="doctors picking their own labs" className="h-7 text-xs" />
                  </Field>
                  <Field label="Panel title">
                    <Textarea value={c.panelTitle ?? ""} onChange={(e) => patchCard(i, { panelTitle: e.target.value })} rows={2} className="text-xs" placeholder="A plan, a scanner in every office and a dashboard from day one." />
                  </Field>
                  <Field label="Panel paragraph">
                    <Textarea value={c.panelBody ?? ""} onChange={(e) => patchCard(i, { panelBody: e.target.value })} rows={3} className="text-xs" placeholder="Lab strategy in a box…" />
                  </Field>
                  <Field label={`Bullets (${bullets.length} of ${MINT_ROUTER_MAX_BULLETS})`}>
                    <div className="space-y-1.5">
                      {bullets.map((b, j) => (
                        <div key={j} className="rounded border bg-white p-1.5 space-y-1">
                          <ItemHeader label={b || `Bullet ${j + 1}`} index={j} total={bullets.length} onMove={(d) => patchCard(i, { panelBullets: moveItem(bullets, j, d) })} onRemove={() => patchCard(i, { panelBullets: bullets.filter((_, k) => k !== j) })} />
                          <Input value={b} onChange={(e) => patchCard(i, { panelBullets: bullets.map((x, k) => (k === j ? e.target.value : x)) })} placeholder="Month-to-month terms, no scanner CapEx" className="h-7 text-xs" />
                        </div>
                      ))}
                    </div>
                    <div className="mt-1.5">
                      <AddButton label="Add bullet" disabled={bullets.length >= MINT_ROUTER_MAX_BULLETS} onClick={() => patchCard(i, { panelBullets: [...bullets, "New point"] })} />
                    </div>
                  </Field>
                  <Field label="Side image (16:10)">
                    <ImagePicker value={c.imageUrl ?? ""} onChange={(v) => patchCard(i, { imageUrl: v })} placeholder="Upload or paste image URL" aiHint={c.panelTitle || c.stage} />
                  </Field>
                  <Input value={c.imageAlt ?? ""} onChange={(e) => patchCard(i, { imageAlt: e.target.value })} placeholder="Alt text" className="h-7 text-xs" />
                  <Field label={`Stat tiles (${stats.length} of ${MINT_ROUTER_MAX_PANEL_STATS})`}>
                    <div className="space-y-1.5">
                      {stats.map((st, j) => (
                        <div key={j} className="rounded border bg-white p-1.5 space-y-1">
                          <ItemHeader label={st.value || `Stat ${j + 1}`} index={j} total={stats.length} onMove={(d) => patchCard(i, { panelStats: moveItem(stats, j, d) })} onRemove={() => patchCard(i, { panelStats: stats.filter((_, k) => k !== j) })} />
                          <div className="grid grid-cols-2 gap-1.5">
                            <Input value={st.value} onChange={(e) => patchCard(i, { panelStats: stats.map((x, k) => (k === j ? { ...x, value: e.target.value } : x)) })} placeholder="$0" className="h-7 text-xs" />
                            <Input value={st.label} onChange={(e) => patchCard(i, { panelStats: stats.map((x, k) => (k === j ? { ...x, label: e.target.value } : x)) })} placeholder="scanner CapEx per location" className="h-7 text-xs" />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-1.5">
                      <AddButton label="Add stat" disabled={stats.length >= MINT_ROUTER_MAX_PANEL_STATS} onClick={() => patchCard(i, { panelStats: [...stats, { value: "90", label: "days to your first executive review" } satisfies MintRouterStat] })} />
                    </div>
                  </Field>
                </div>
              )}
            </div>
          );
        })}
        <AddButton label="Add starting point" disabled={cards.length >= MINT_ROUTER_MAX_CARDS} onClick={() => setCards([...cards, { ...EMPTY_CARD }])} />
      </PanelSection>

      <ForestStyleSection value={props} onChange={(p) => update(p)} defaultBg="#FFFFFF" hint="A white band; the hairlines, the hover tint and the picker's grey side follow the surface" />
    </div>
  );
}
