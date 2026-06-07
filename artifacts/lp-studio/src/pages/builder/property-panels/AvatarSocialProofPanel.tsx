import type { AvatarSocialProofBlockProps } from "@/lib/block-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ImagePicker } from "@/components/ImagePicker";
import { FontSelect } from "@/components/FontSelect";
import { ColorField } from "./BlockSettingsPanel";
import { Plus, Trash2 } from "lucide-react";

interface Props {
  props: AvatarSocialProofBlockProps;
  onChange: (props: AvatarSocialProofBlockProps) => void;
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
      {children}
    </Label>
  );
}

export function AvatarSocialProofPanel({ props, onChange }: Props) {
  const avatars = props.avatars ?? [];
  const updateAvatar = (i: number, patch: Partial<AvatarSocialProofBlockProps["avatars"][number]>) =>
    onChange({ ...props, avatars: avatars.map((a, idx) => (idx === i ? { ...a, ...patch } : a)) });
  const addAvatar = () => onChange({ ...props, avatars: [...avatars, { initials: "AB" }] });
  const removeAvatar = (i: number) => onChange({ ...props, avatars: avatars.filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Heading>Content</Heading>
        <div>
          <Label className="text-xs text-muted-foreground mb-1.5 block">Headline</Label>
          <Input
            placeholder="Join 12,000+ teams who switched"
            value={props.headline ?? ""}
            onChange={(e) => onChange({ ...props, headline: e.target.value })}
            className="text-sm"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1.5 block">Extra count chip (e.g. +2k)</Label>
          <Input
            placeholder="+2k"
            value={props.extraCountLabel ?? ""}
            onChange={(e) => onChange({ ...props, extraCountLabel: e.target.value })}
            className="text-sm"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Heading>Rating</Heading>
        <div className="flex gap-2">
          <Input
            type="number"
            step={0.1}
            min={0}
            placeholder="Rating (e.g. 4.9)"
            value={props.rating ?? ""}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === "") return onChange({ ...props, rating: undefined });
              const n = Number(raw);
              onChange({ ...props, rating: Number.isFinite(n) ? n : undefined });
            }}
            className="text-sm w-28"
          />
          <Input
            type="number"
            min={1}
            max={10}
            placeholder="Max"
            value={props.ratingMax ?? 5}
            onChange={(e) => {
              const n = Number(e.target.value);
              onChange({ ...props, ratingMax: Number.isFinite(n) && n > 0 ? n : 5 });
            }}
            className="text-sm w-20"
          />
        </div>
        <Input
          placeholder="Review summary (e.g. average from 2,400+ reviews)"
          value={props.reviewSummary ?? ""}
          onChange={(e) => onChange({ ...props, reviewSummary: e.target.value })}
          className="text-sm"
        />
      </div>

      <div className="space-y-2">
        <Heading>Testimonial (optional)</Heading>
        <Textarea
          placeholder="Quote"
          value={props.testimonialQuote ?? ""}
          onChange={(e) => onChange({ ...props, testimonialQuote: e.target.value })}
          className="text-sm"
          rows={3}
        />
        <Input
          placeholder="Author (e.g. Dr. Jane Smith, Bright Dental)"
          value={props.testimonialAuthor ?? ""}
          onChange={(e) => onChange({ ...props, testimonialAuthor: e.target.value })}
          className="text-sm"
        />
      </div>

      <div className="space-y-3">
        <Heading>Colors</Heading>
        <ColorField label="Background" value={props.bgColor} onChange={(v) => onChange({ ...props, bgColor: v })} />
        <ColorField label="Text" value={props.textColor} onChange={(v) => onChange({ ...props, textColor: v })} />
        <ColorField label="Accent (count chip)" value={props.accentColor} onChange={(v) => onChange({ ...props, accentColor: v })} />
      </div>

      <div className="space-y-3">
        <Heading>Fonts</Heading>
        <div>
          <Label className="text-xs text-muted-foreground mb-1.5 block">Headline font</Label>
          <FontSelect value={props.headlineFont} onChange={(v) => onChange({ ...props, headlineFont: v })} />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1.5 block">Body font</Label>
          <FontSelect value={props.bodyFont} onChange={(v) => onChange({ ...props, bodyFont: v })} />
        </div>
      </div>

      <div className="space-y-3">
        <Heading>Avatars</Heading>
        {avatars.map((avatar, i) => (
          <div key={i} className="space-y-2 rounded-lg border p-3">
            <div className="flex gap-2 items-center">
              <Input
                placeholder="Initials (e.g. AR)"
                value={avatar.initials ?? ""}
                onChange={(e) => updateAvatar(i, { initials: e.target.value })}
                className="text-sm"
                maxLength={3}
              />
              <Button
                size="icon"
                variant="ghost"
                className="text-muted-foreground hover:text-red-500 shrink-0"
                onClick={() => removeAvatar(i)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
            <ImagePicker
              label="Photo (optional — falls back to initials)"
              value={avatar.imageUrl ?? ""}
              onChange={(url) => updateAvatar(i, { imageUrl: url })}
              aiHint="customer headshot avatar"
            />
          </div>
        ))}
        <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs" onClick={addAvatar}>
          <Plus className="w-3.5 h-3.5" /> Add Avatar
        </Button>
      </div>
    </div>
  );
}
