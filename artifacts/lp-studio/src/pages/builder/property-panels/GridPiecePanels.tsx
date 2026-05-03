import type {
  GridImageBlockProps,
  GridHeadlineSubBlockProps,
  GridParagraphBulletsBlockProps,
  GridHeadlineParagraphBlockProps,
  GridIconFeatureBlockProps,
  GridStatBlockProps,
  GridQuoteBlockProps,
  GridCtaTileBlockProps,
  GridLogoBlockProps,
  GridVideoBlockProps,
} from "@/lib/block-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ImagePicker } from "@/components/ImagePicker";
import { VideoPicker } from "@/components/VideoPicker";
import { Plus, Trash2 } from "lucide-react";

const PANEL = "p-4 space-y-3";

function AlignSelect({ value, onChange }: { value: "left" | "center" | "right"; onChange: (v: "left" | "center" | "right") => void }) {
  return (
    <div>
      <Label>Alignment</Label>
      <Select value={value} onValueChange={v => onChange(v as "left" | "center" | "right")}>
        <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="left">Left</SelectItem>
          <SelectItem value="center">Center</SelectItem>
          <SelectItem value="right">Right</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

export function GridImagePanel({ props, onChange }: { props: GridImageBlockProps; onChange: (p: GridImageBlockProps) => void }) {
  return (
    <div className={PANEL}>
      <ImagePicker label="Image" value={props.imageUrl} onChange={v => onChange({ ...props, imageUrl: v })} />
      <div>
        <Label>Alt text</Label>
        <Input className="mt-1.5" value={props.alt} onChange={e => onChange({ ...props, alt: e.target.value })} placeholder="Describe the image" />
      </div>
      <div>
        <Label>Link (optional)</Label>
        <Input className="mt-1.5" value={props.href ?? ""} onChange={e => onChange({ ...props, href: e.target.value })} placeholder="https://…" />
      </div>
      <div className="flex items-center justify-between">
        <Label>Rounded corners</Label>
        <Switch checked={props.rounded} onCheckedChange={v => onChange({ ...props, rounded: v })} />
      </div>
    </div>
  );
}

export function GridHeadlineSubPanel({ props, onChange }: { props: GridHeadlineSubBlockProps; onChange: (p: GridHeadlineSubBlockProps) => void }) {
  return (
    <div className={PANEL}>
      <div>
        <Label>Headline</Label>
        <Input className="mt-1.5" value={props.headline} onChange={e => onChange({ ...props, headline: e.target.value })} />
      </div>
      <div>
        <Label>Subheadline</Label>
        <Input className="mt-1.5" value={props.subheadline} onChange={e => onChange({ ...props, subheadline: e.target.value })} />
      </div>
      <AlignSelect value={props.align} onChange={v => onChange({ ...props, align: v })} />
    </div>
  );
}

export function GridParagraphBulletsPanel({ props, onChange }: { props: GridParagraphBulletsBlockProps; onChange: (p: GridParagraphBulletsBlockProps) => void }) {
  const update = (i: number, v: string) => onChange({ ...props, bullets: props.bullets.map((b: string, idx: number) => idx === i ? v : b) });
  const add = () => onChange({ ...props, bullets: [...props.bullets, "New bullet"] });
  const remove = (i: number) => onChange({ ...props, bullets: props.bullets.filter((_: string, idx: number) => idx !== i) });
  return (
    <div className={PANEL}>
      <div>
        <Label>Paragraph</Label>
        <Textarea className="mt-1.5" rows={3} value={props.paragraph} onChange={e => onChange({ ...props, paragraph: e.target.value })} />
      </div>
      <div>
        <Label>Bullets</Label>
        <div className="mt-1.5 space-y-1.5">
          {props.bullets.map((b: string, i: number) => (
            <div key={i} className="flex gap-1.5">
              <Input value={b} onChange={e => update(i, e.target.value)} />
              <Button type="button" size="icon" variant="ghost" onClick={() => remove(i)}><Trash2 className="w-3.5 h-3.5" /></Button>
            </div>
          ))}
          <Button type="button" size="sm" variant="outline" onClick={add} className="gap-1"><Plus className="w-3 h-3" />Add bullet</Button>
        </div>
      </div>
    </div>
  );
}

export function GridHeadlineParagraphPanel({ props, onChange }: { props: GridHeadlineParagraphBlockProps; onChange: (p: GridHeadlineParagraphBlockProps) => void }) {
  return (
    <div className={PANEL}>
      <div>
        <Label>Headline</Label>
        <Input className="mt-1.5" value={props.headline} onChange={e => onChange({ ...props, headline: e.target.value })} />
      </div>
      <div>
        <Label>Paragraph</Label>
        <Textarea className="mt-1.5" rows={4} value={props.paragraph} onChange={e => onChange({ ...props, paragraph: e.target.value })} />
      </div>
      <AlignSelect value={props.align} onChange={v => onChange({ ...props, align: v })} />
    </div>
  );
}

export function GridIconFeaturePanel({ props, onChange }: { props: GridIconFeatureBlockProps; onChange: (p: GridIconFeatureBlockProps) => void }) {
  return (
    <div className={PANEL}>
      <div>
        <Label>Icon (emoji or character)</Label>
        <Input className="mt-1.5" value={props.icon} onChange={e => onChange({ ...props, icon: e.target.value })} placeholder="✨" />
      </div>
      <div>
        <Label>Headline</Label>
        <Input className="mt-1.5" value={props.headline} onChange={e => onChange({ ...props, headline: e.target.value })} />
      </div>
      <div>
        <Label>Paragraph</Label>
        <Textarea className="mt-1.5" rows={3} value={props.paragraph} onChange={e => onChange({ ...props, paragraph: e.target.value })} />
      </div>
    </div>
  );
}

export function GridStatPanel({ props, onChange }: { props: GridStatBlockProps; onChange: (p: GridStatBlockProps) => void }) {
  return (
    <div className={PANEL}>
      <div>
        <Label>Value</Label>
        <Input className="mt-1.5" value={props.value} onChange={e => onChange({ ...props, value: e.target.value })} placeholder="92%" />
      </div>
      <div>
        <Label>Label</Label>
        <Input className="mt-1.5" value={props.label} onChange={e => onChange({ ...props, label: e.target.value })} />
      </div>
      <div>
        <Label>Caption (optional)</Label>
        <Input className="mt-1.5" value={props.caption ?? ""} onChange={e => onChange({ ...props, caption: e.target.value })} />
      </div>
    </div>
  );
}

export function GridQuotePanel({ props, onChange }: { props: GridQuoteBlockProps; onChange: (p: GridQuoteBlockProps) => void }) {
  return (
    <div className={PANEL}>
      <div>
        <Label>Quote</Label>
        <Textarea className="mt-1.5" rows={3} value={props.quote} onChange={e => onChange({ ...props, quote: e.target.value })} />
      </div>
      <div>
        <Label>Attribution</Label>
        <Input className="mt-1.5" value={props.attribution} onChange={e => onChange({ ...props, attribution: e.target.value })} />
      </div>
      <div>
        <Label>Role / company (optional)</Label>
        <Input className="mt-1.5" value={props.role ?? ""} onChange={e => onChange({ ...props, role: e.target.value })} />
      </div>
    </div>
  );
}

export function GridCtaTilePanel({ props, onChange }: { props: GridCtaTileBlockProps; onChange: (p: GridCtaTileBlockProps) => void }) {
  return (
    <div className={PANEL}>
      <div>
        <Label>Headline</Label>
        <Input className="mt-1.5" value={props.headline} onChange={e => onChange({ ...props, headline: e.target.value })} />
      </div>
      <div>
        <Label>Body</Label>
        <Textarea className="mt-1.5" rows={2} value={props.body} onChange={e => onChange({ ...props, body: e.target.value })} />
      </div>
      <div>
        <Label>Button label</Label>
        <Input className="mt-1.5" value={props.ctaText} onChange={e => onChange({ ...props, ctaText: e.target.value })} />
      </div>
      <div>
        <Label>Button URL</Label>
        <Input className="mt-1.5" value={props.ctaUrl} onChange={e => onChange({ ...props, ctaUrl: e.target.value })} placeholder="https://…" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>Background</Label>
          <Input className="mt-1.5" type="color" value={props.bgColor ?? "#003A30"} onChange={e => onChange({ ...props, bgColor: e.target.value })} />
        </div>
        <div>
          <Label>Text</Label>
          <Input className="mt-1.5" type="color" value={props.textColor ?? "#ffffff"} onChange={e => onChange({ ...props, textColor: e.target.value })} />
        </div>
      </div>
    </div>
  );
}

export function GridLogoPanel({ props, onChange }: { props: GridLogoBlockProps; onChange: (p: GridLogoBlockProps) => void }) {
  return (
    <div className={PANEL}>
      <ImagePicker label="Logo image" value={props.logoUrl} onChange={v => onChange({ ...props, logoUrl: v })} />
      <div>
        <Label>Alt text</Label>
        <Input className="mt-1.5" value={props.alt} onChange={e => onChange({ ...props, alt: e.target.value })} />
      </div>
      <div>
        <Label>Link (optional)</Label>
        <Input className="mt-1.5" value={props.href ?? ""} onChange={e => onChange({ ...props, href: e.target.value })} placeholder="https://…" />
      </div>
    </div>
  );
}

export function GridVideoPanel({ props, onChange }: { props: GridVideoBlockProps; onChange: (p: GridVideoBlockProps) => void }) {
  return (
    <div className={PANEL}>
      <VideoPicker label="Video" value={props.videoUrl} onChange={v => onChange({ ...props, videoUrl: v })} />
      <ImagePicker label="Poster image (optional)" value={props.posterUrl ?? ""} onChange={v => onChange({ ...props, posterUrl: v })} />
      <div>
        <Label>Caption (optional)</Label>
        <Input className="mt-1.5" value={props.caption ?? ""} onChange={e => onChange({ ...props, caption: e.target.value })} />
      </div>
    </div>
  );
}
