import type { RatingBadgesBlockProps } from "@/lib/block-types";
import { Input } from "@/components/ui/input";
import { AiTextField } from "@/components/AiTextField";
import { suggestCopy } from "@/lib/copy-api";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { FontSelect } from "@/components/FontSelect";
import { ColorField } from "./BlockSettingsPanel";
import { SectionBackgroundControl } from "./SectionBackgroundControl";
import { Plus, Trash2 } from "lucide-react";

interface Props {
  props: RatingBadgesBlockProps;
  onChange: (props: RatingBadgesBlockProps) => void;
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
      {children}
    </Label>
  );
}

export function RatingBadgesPanel({ props, onChange }: Props) {
  const badges = props.badges ?? [];
  const updateBadge = (i: number, patch: Partial<RatingBadgesBlockProps["badges"][number]>) =>
    onChange({ ...props, badges: badges.map((b, idx) => (idx === i ? { ...b, ...patch } : b)) });
  const addBadge = () =>
    onChange({ ...props, badges: [...badges, { platform: "New Platform", rating: 4.8, reviewCount: "100 reviews" }] });
  const removeBadge = (i: number) => onChange({ ...props, badges: badges.filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Heading>Content</Heading>
        <AiTextField
          type="input"
          placeholder="Eyebrow (e.g. Rated excellent across the web)"
          value={props.eyebrow ?? ""}
          onChange={(v) => onChange({ ...props, eyebrow: v })}
          onSuggest={() => suggestCopy("rating-badges", "eyebrow", props.eyebrow ?? "")}
          fieldLabel="Eyebrow"
        />
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground w-24 shrink-0">Max stars</Label>
          <Input
            type="number"
            min={1}
            max={10}
            value={props.ratingMax ?? 5}
            onChange={(e) => {
              const n = Number(e.target.value);
              onChange({ ...props, ratingMax: Number.isFinite(n) && n > 0 ? n : 5 });
            }}
            className="text-sm h-8"
          />
        </div>
      </div>

      <div className="space-y-3">
        <Heading>Colors</Heading>
        <SectionBackgroundControl
          backgroundStyle={props.backgroundStyle}
          bgColor={props.bgColor}
          defaultBgColor="#f8fafc"
          onChange={(patch) => onChange({ ...props, ...patch })}
        />
        <ColorField label="Text" value={props.textColor} onChange={(v) => onChange({ ...props, textColor: v })} />
        <ColorField label="Accent (featured / award)" value={props.accentColor} onChange={(v) => onChange({ ...props, accentColor: v })} />
      </div>

      <div className="space-y-3">
        <Heading>Fonts</Heading>
        <div>
          <Label className="text-xs text-muted-foreground mb-1.5 block">Score font</Label>
          <FontSelect value={props.headlineFont} onChange={(v) => onChange({ ...props, headlineFont: v })} />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1.5 block">Label font</Label>
          <FontSelect value={props.bodyFont} onChange={(v) => onChange({ ...props, bodyFont: v })} />
        </div>
      </div>

      <div className="space-y-3">
        <Heading>Badges</Heading>
        {badges.map((badge, i) => (
          <div key={i} className="space-y-2 rounded-lg border p-3">
            <div className="flex gap-2 items-center">
              <Input
                placeholder="Platform (e.g. G2)"
                value={badge.platform}
                onChange={(e) => updateBadge(i, { platform: e.target.value })}
                className="text-sm"
              />
              <Button
                size="icon"
                variant="ghost"
                className="text-muted-foreground hover:text-red-500 shrink-0"
                onClick={() => removeBadge(i)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex gap-2">
              <Input
                type="number"
                step={0.1}
                min={0}
                placeholder="Rating"
                value={badge.rating}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  updateBadge(i, { rating: Number.isFinite(n) ? n : 0 });
                }}
                className="text-sm w-24"
              />
              <Input
                placeholder="Review count (e.g. 842 reviews)"
                value={badge.reviewCount ?? ""}
                onChange={(e) => updateBadge(i, { reviewCount: e.target.value })}
                className="text-sm flex-1"
              />
            </div>
            <Input
              placeholder="Award pill (optional, e.g. Leader)"
              value={badge.award ?? ""}
              onChange={(e) => updateBadge(i, { award: e.target.value })}
              className="text-sm"
            />
            <div className="flex items-center justify-between">
              <Label className="text-xs text-slate-600 cursor-pointer">Featured (highlighted)</Label>
              <Switch checked={!!badge.featured} onCheckedChange={(v) => updateBadge(i, { featured: v })} />
            </div>
          </div>
        ))}
        <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs" onClick={addBadge}>
          <Plus className="w-3.5 h-3.5" /> Add Badge
        </Button>
      </div>
    </div>
  );
}
