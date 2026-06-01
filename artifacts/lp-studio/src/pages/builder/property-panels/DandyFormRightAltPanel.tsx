import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { Trash2, Plus, Link2, Link2Off } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandSwatches } from "@/components/BrandSwatches";
import { ImagePicker } from "@/components/ImagePicker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DandyFormRightAltBlockProps } from "@/lib/block-types";

interface GlobalFormSummary { id: number; name: string }
const API_BASE = "/api";

interface Props {
  props: DandyFormRightAltBlockProps;
  onChange: (p: DandyFormRightAltBlockProps) => void;
}

export function DandyFormRightAltPanel({ props: p, onChange }: Props) {
  const set = <K extends keyof DandyFormRightAltBlockProps>(k: K, v: DandyFormRightAltBlockProps[K]) =>
    onChange({ ...p, [k]: v });

  const setBullet = (i: number, v: string) => {
    const bullets = [...(p.bullets ?? [])];
    bullets[i] = v;
    onChange({ ...p, bullets });
  };
  const addBullet = () => onChange({ ...p, bullets: [...(p.bullets ?? []), ""] });
  const removeBullet = (i: number) => onChange({ ...p, bullets: (p.bullets ?? []).filter((_, idx) => idx !== i) });

  // Load global forms once for the picker.
  const [globalForms, setGlobalForms] = useState<GlobalFormSummary[]>([]);
  useEffect(() => {
    fetch(`${API_BASE}/lp/forms`).then(r => r.json()).then((data: GlobalFormSummary[]) => setGlobalForms(data)).catch(() => {});
  }, []);
  const linkedForm = globalForms.find(f => f.id === p.formId);

  const leftMode = p.leftMode ?? "bullets";
  const headlineLayout = p.headlineLayout ?? "default";

  return (
    <div className="space-y-4">
      <BlockRefreshButton
        blockType="dandy-form-right-alt"
        fields={["eyebrow", "headline", "subheadline"]}
        values={{ eyebrow: p.eyebrow ?? "", headline: p.headline, subheadline: p.subheadline ?? "" }}
        onApply={(u) => onChange({ ...p, ...u })}
      />
      <div className="space-y-1.5">
        <Label className="text-xs">Background Color</Label>
        <div className="flex gap-2 items-center">
          <input type="color" value={p.bgColor ?? "#FDFCFA"} onChange={e => set("bgColor", e.target.value)} className="w-9 h-8 rounded border cursor-pointer p-0.5" />
          <BrandSwatches className="ml-1" current={p.bgColor} onPick={hex => set("bgColor", hex)} />
          <Input value={p.bgColor ?? "#FDFCFA"} onChange={e => set("bgColor", e.target.value)} className="h-8 text-xs font-mono flex-1" />
        </div>
      </div>

      <div className="border-t pt-3 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Layout</p>
        <div className="space-y-1.5">
          <Label className="text-xs">Left side content</Label>
          <div className="flex gap-1">
            {(["bullets", "image"] as const).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => set("leftMode", m)}
                className={`flex-1 py-1.5 text-xs rounded border ${leftMode === m ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
              >
                {m === "bullets" ? "Bullet list" : "Image"}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Headline placement</Label>
          <div className="flex gap-1">
            {([
              ["default", "Above content"],
              ["centered-over-block", "Centered over block"],
            ] as const).map(([m, label]) => (
              <button
                key={m}
                type="button"
                onClick={() => set("headlineLayout", m)}
                className={`flex-1 py-1.5 text-xs rounded border ${headlineLayout === m ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">"Centered over block" lifts the headline above both columns.</p>
        </div>
      </div>

      {leftMode === "image" && (
        <div className="border-t pt-3 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Image</p>
          <ImagePicker
            value={p.imageUrl ?? ""}
            onChange={(v) => set("imageUrl", v || undefined)}
            placeholder="Upload or paste image URL"
          />
          <div className="space-y-1.5">
            <Label className="text-xs">Alt text</Label>
            <Input value={p.imageAlt ?? ""} onChange={e => set("imageAlt", e.target.value || undefined)} className="h-8 text-xs" placeholder="Brief description for accessibility" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Aspect ratio</Label>
            <Select
              value={p.imageAspect ?? "portrait"}
              onValueChange={(v) => set("imageAspect", v as DandyFormRightAltBlockProps["imageAspect"])}
            >
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="portrait" className="text-xs">Portrait 4:5</SelectItem>
                <SelectItem value="square" className="text-xs">Square 1:1</SelectItem>
                <SelectItem value="landscape" className="text-xs">Landscape 5:4</SelectItem>
                <SelectItem value="wide" className="text-xs">Wide 16:10</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center justify-between gap-2 text-xs">
            <span>Drop shadow</span>
            <input
              type="checkbox"
              checked={p.imageShadow ?? true}
              onChange={(e) => set("imageShadow", e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
          </label>
        </div>
      )}

      <div className="border-t pt-3 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Left Copy</p>
        <div className="space-y-1.5">
          <Label className="text-xs">Eyebrow</Label>
          <Input value={p.eyebrow ?? ""} onChange={e => set("eyebrow", e.target.value || undefined)} className="h-8 text-xs" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Headline</Label>
          <Input value={p.headline} onChange={e => set("headline", e.target.value)} className="h-8 text-xs" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Subheadline</Label>
          <Input value={p.subheadline ?? ""} onChange={e => set("subheadline", e.target.value || undefined)} className="h-8 text-xs" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Bullets</Label>
          {(p.bullets ?? []).map((b, i) => (
            <div key={i} className="flex gap-1 mb-1">
              <Input value={b} onChange={e => setBullet(i, e.target.value)} className="h-7 text-xs flex-1" />
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => removeBullet(i)}><Trash2 className="w-3 h-3" /></Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" className="w-full h-7 text-xs gap-1" onClick={addBullet}><Plus className="w-3 h-3" /> Add bullet</Button>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Trust Note</Label>
          <Input value={p.trustNote ?? ""} onChange={e => set("trustNote", e.target.value || undefined)} className="h-8 text-xs" placeholder="No spam. Unsubscribe anytime." />
        </div>
      </div>

      <div className="border-t pt-3 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Form Source</p>

        <div className="space-y-1.5">
          <Label className="text-xs">Global Form</Label>
          <p className="text-[11px] text-muted-foreground">
            Link to a globally-managed form. Fields and the Chili Piper handoff are defined in the Forms library.
          </p>
          <div className="flex gap-2">
            <Select
              value={p.formId != null ? String(p.formId) : "__local__"}
              onValueChange={v => set("formId", v === "__local__" ? undefined : parseInt(v, 10))}
            >
              <SelectTrigger className="h-8 text-xs flex-1">
                <SelectValue placeholder="Use built-in fields" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__local__" className="text-xs">
                  <span className="flex items-center gap-1.5"><Link2Off className="w-3 h-3" />Use built-in fields</span>
                </SelectItem>
                {globalForms.map(f => (
                  <SelectItem key={f.id} value={String(f.id)} className="text-xs">
                    <span className="flex items-center gap-1.5"><Link2 className="w-3 h-3" />{f.name}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <a href="/forms" target="_blank" rel="noopener noreferrer" className="shrink-0">
              <Button size="sm" variant="outline" type="button" className="h-8">Manage</Button>
            </a>
          </div>
          {linkedForm && (
            <p className="text-[11px] text-green-600 mt-1 flex items-center gap-1">
              <Link2 className="w-3 h-3" /> Linked to "{linkedForm.name}". Chili Piper handoff (if configured on the form) runs after submit.
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Form Mode</Label>
          <div className="flex gap-1">
            {(["native", "marketo"] as const).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => set("formMode", m)}
                disabled={p.formId != null && m === "marketo"}
                className={`flex-1 py-1.5 text-xs rounded border ${(p.formMode ?? "native") === m ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"} disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {m === "native" ? "Built-in form" : "Marketo embed"}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {p.formId != null
              ? "Linked global form takes precedence over Form Mode."
              : "Marketo embed loads your Marketo form directly in this card."}
          </p>
        </div>
        {p.formMode === "marketo" && (
          <div className="space-y-1.5 rounded-md border bg-muted/30 p-3">
            <div>
              <Label className="text-xs">Marketo Instance URL</Label>
              <Input value={p.marketoBaseUrl ?? ""} onChange={e => set("marketoBaseUrl", e.target.value || undefined)} placeholder="//app-XXX.marketo.com" className="h-8 text-xs font-mono" />
            </div>
            <div>
              <Label className="text-xs">Munchkin ID</Label>
              <Input value={p.marketoMunchkinId ?? ""} onChange={e => set("marketoMunchkinId", e.target.value || undefined)} placeholder="123-ABC-456" className="h-8 text-xs font-mono" />
            </div>
            <div>
              <Label className="text-xs">Form ID</Label>
              <Input type="number" value={p.marketoFormId ?? ""} onChange={e => set("marketoFormId", e.target.value ? Number(e.target.value) : undefined)} placeholder="1234" className="h-8 text-xs font-mono" />
            </div>
            <p className="text-[10px] text-muted-foreground">Find these in Marketo's "Embed Code" for your form.</p>
          </div>
        )}
      </div>

      <div className="border-t pt-3 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Form Card</p>
        <div className="space-y-1.5">
          <Label className="text-xs">Form Headline</Label>
          <Input value={p.formHeadline ?? ""} onChange={e => set("formHeadline", e.target.value || undefined)} className="h-8 text-xs" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Form Subheadline</Label>
          <Input value={p.formSubheadline ?? ""} onChange={e => set("formSubheadline", e.target.value || undefined)} className="h-8 text-xs" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Submit Button Text</Label>
          <Input value={p.submitText ?? ""} onChange={e => set("submitText", e.target.value || undefined)} className="h-8 text-xs" placeholder="Get a Free Demo" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Disclaimer</Label>
          <Input value={p.formDisclaimer ?? ""} onChange={e => set("formDisclaimer", e.target.value || undefined)} className="h-8 text-xs" placeholder="We'll never share your info." />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Success Message</Label>
          <Input value={p.successMessage ?? ""} onChange={e => set("successMessage", e.target.value || undefined)} className="h-8 text-xs" placeholder="Thanks! We'll be in touch shortly." />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Chili Piper URL (optional)</Label>
          <Input value={(p as any).chilipiperUrl ?? ""} onChange={e => onChange({ ...p, chilipiperUrl: e.target.value || undefined } as any)} className="h-8 text-xs font-mono" placeholder="https://yourcompany.chilipiper.com/..." />
          <p className="text-[11px] text-muted-foreground">If set, opens the scheduling modal after form submit.</p>
        </div>
      </div>
    </div>
  );
}
