import type {
  BentoShowcaseBlockProps,
  BentoShowcaseTile,
  BentoTileKind,
  BentoTileSize,
} from "@/lib/block-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BlockRefreshButton } from "@/components/BlockRefreshButton";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImagePicker } from "@/components/ImagePicker";
import { ColorField } from "./BlockSettingsPanel";
import {
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Image as ImageIcon,
  Hash,
  Quote,
  Sparkles,
} from "lucide-react";

interface Props {
  props: BentoShowcaseBlockProps;
  onChange: (props: BentoShowcaseBlockProps) => void;
}

const KIND_OPTIONS: Array<{
  value: BentoTileKind;
  label: string;
  hint: string;
  Icon: typeof ImageIcon;
}> = [
  { value: "image", label: "Image", hint: "Photo with optional caption overlay", Icon: ImageIcon },
  { value: "stat", label: "Stat", hint: "Big number with supporting label", Icon: Hash },
  { value: "quote", label: "Quote", hint: "Pull quote with author attribution", Icon: Quote },
  { value: "feature", label: "Feature", hint: "Icon + headline + description", Icon: Sparkles },
];

const SIZE_OPTIONS: Array<{ value: BentoTileSize; label: string; hint: string }> = [
  { value: "sm", label: "Small", hint: "2 cols × 1 row" },
  { value: "md", label: "Medium", hint: "2 cols × 2 rows" },
  { value: "lg", label: "Large", hint: "3 cols × 2 rows" },
  { value: "xl", label: "Extra Large", hint: "4 cols × 2 rows (full width)" },
];

const PRIMARY_LABEL: Record<BentoTileKind, string> = {
  image: "Image",
  stat: "Big number",
  quote: "Quote",
  feature: "Headline",
};
const SECONDARY_LABEL: Record<BentoTileKind, string> = {
  image: "Caption (overlay)",
  stat: "Label",
  quote: "Author name",
  feature: "Description",
};
const TERTIARY_LABEL: Record<BentoTileKind, string> = {
  image: "Eyebrow (overlay)",
  stat: "Sub-label",
  quote: "Author title",
  feature: "Eyebrow",
};

const BLANK_BY_KIND: Record<BentoTileKind, BentoShowcaseTile> = {
  image: {
    kind: "image",
    size: "lg",
    primary:
      "https://images.unsplash.com/photo-1551434678-e076c223a692?q=80&w=900&h=600&fit=crop",
    secondary: "Caption goes here",
    tertiary: "Eyebrow",
  },
  stat: {
    kind: "stat",
    size: "md",
    primary: "10×",
    secondary: "Faster than before",
    tertiary: "Across 1,000+ teams",
    bgColor: "#0A0A0A",
    textColor: "#FFFFFF",
  },
  quote: {
    kind: "quote",
    size: "lg",
    primary: "A short, punchy customer quote that earns trust.",
    secondary: "Jordan Reyes",
    tertiary: "Chief of Staff · Helio Robotics",
    bgColor: "#FFFFFF",
  },
  feature: {
    kind: "feature",
    size: "md",
    primary: "Feature headline",
    secondary: "One sentence about why it matters.",
    icon: "Sparkles",
    bgColor: "#FFFFFF",
  },
};

function TileEditor({
  tile,
  index,
  total,
  onChange,
  onMove,
  onRemove,
}: {
  tile: BentoShowcaseTile;
  index: number;
  total: number;
  onChange: (patch: Partial<BentoShowcaseTile>) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  const KindIcon = KIND_OPTIONS.find(o => o.value === tile.kind)?.Icon ?? Sparkles;
  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground flex-1">
          <KindIcon className="w-3.5 h-3.5" />
          <span>Tile {index + 1}</span>
          <span className="opacity-60">· {tile.kind}</span>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          disabled={index === 0}
          onClick={() => onMove(-1)}
          title="Move up"
        >
          <ChevronUp className="w-3.5 h-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          disabled={index === total - 1}
          onClick={() => onMove(1)}
          title="Move down"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-destructive hover:text-destructive"
          onClick={onRemove}
          title="Delete tile"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-[11px] text-muted-foreground">Type</Label>
          <Select
            value={tile.kind}
            onValueChange={v => onChange({ kind: v as BentoTileKind })}
          >
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {KIND_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value} className="text-xs">
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Size</Label>
          <Select
            value={tile.size}
            onValueChange={v => onChange({ size: v as BentoTileSize })}
          >
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SIZE_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value} className="text-xs">
                  {o.label} <span className="opacity-60 ml-1">{o.hint}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {tile.kind === "image" ? (
        <div>
          <Label className="text-[11px] text-muted-foreground">{PRIMARY_LABEL[tile.kind]}</Label>
          <ImagePicker
            value={tile.primary}
            onChange={v => onChange({ primary: v })}
            placeholder="Upload or paste image URL"
          />
          <Input
            value={tile.imageAlt ?? ""}
            onChange={e => onChange({ imageAlt: e.target.value })}
            placeholder="Alt text (for accessibility)"
            className="h-8 text-xs mt-2"
          />
          <Input
            value={tile.imageFocal ?? ""}
            onChange={e => onChange({ imageFocal: e.target.value })}
            placeholder='Focal point e.g. "50% 30%"'
            className="h-8 text-xs mt-2"
          />
        </div>
      ) : tile.kind === "quote" ? (
        <div>
          <Label className="text-[11px] text-muted-foreground">{PRIMARY_LABEL[tile.kind]}</Label>
          <Textarea
            value={tile.primary}
            onChange={e => onChange({ primary: e.target.value })}
            rows={3}
            className="text-xs"
          />
        </div>
      ) : (
        <div>
          <Label className="text-[11px] text-muted-foreground">{PRIMARY_LABEL[tile.kind]}</Label>
          <Input
            value={tile.primary}
            onChange={e => onChange({ primary: e.target.value })}
            className="h-8 text-xs"
          />
        </div>
      )}

      <div>
        <Label className="text-[11px] text-muted-foreground">{SECONDARY_LABEL[tile.kind]}</Label>
        <Input
          value={tile.secondary ?? ""}
          onChange={e => onChange({ secondary: e.target.value })}
          placeholder="Leave blank to hide"
          className="h-8 text-xs"
        />
      </div>
      <div>
        <Label className="text-[11px] text-muted-foreground">{TERTIARY_LABEL[tile.kind]}</Label>
        <Input
          value={tile.tertiary ?? ""}
          onChange={e => onChange({ tertiary: e.target.value })}
          placeholder="Leave blank to hide"
          className="h-8 text-xs"
        />
      </div>

      {tile.kind === "feature" && (
        <div>
          <Label className="text-[11px] text-muted-foreground">Icon (Lucide name)</Label>
          <Input
            value={tile.icon ?? ""}
            onChange={e => onChange({ icon: e.target.value })}
            placeholder="e.g. Zap, BarChart2, Sparkles"
            className="h-8 text-xs"
          />
          <p className="text-[10px] text-muted-foreground mt-1">
            Browse names at lucide.dev/icons. Defaults to Sparkles.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <ColorField
          label="Background"
          value={tile.bgColor ?? ""}
          onChange={v => onChange({ bgColor: v || undefined })}
        />
        <ColorField
          label="Text"
          value={tile.textColor ?? ""}
          onChange={v => onChange({ textColor: v || undefined })}
        />
      </div>
    </div>
  );
}

export function BentoShowcasePanel({ props, onChange }: Props) {
  const tiles = props.tiles ?? [];

  const updateTile = (i: number, patch: Partial<BentoShowcaseTile>) => {
    const next = tiles.map((t, idx) => {
      if (idx !== i) return t;
      // When the kind changes, merge with sensible defaults for the new kind
      // so tiles never end up with missing required props (e.g. an image
      // tile with no image URL renders a broken tile).
      if (patch.kind && patch.kind !== t.kind) {
        const blank = BLANK_BY_KIND[patch.kind];
        return { ...blank, size: t.size, ...patch } as BentoShowcaseTile;
      }
      return { ...t, ...patch } as BentoShowcaseTile;
    });
    onChange({ ...props, tiles: next });
  };

  const moveTile = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= tiles.length) return;
    const next = tiles.slice();
    const [moved] = next.splice(i, 1);
    next.splice(j, 0, moved);
    onChange({ ...props, tiles: next });
  };

  const removeTile = (i: number) => {
    onChange({ ...props, tiles: tiles.filter((_, idx) => idx !== i) });
  };

  const addTile = (kind: BentoTileKind) => {
    onChange({ ...props, tiles: [...tiles, { ...BLANK_BY_KIND[kind] }] });
  };

  return (
    <div className="space-y-5">
      <BlockRefreshButton
        blockType="bento-showcase"
        fields={["eyebrow", "headline", "subheadline"]}
        values={{ eyebrow: props.eyebrow ?? "", headline: props.headline ?? "", subheadline: props.subheadline ?? "" }}
        onApply={(u) => onChange({ ...props, ...u })}
      />
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Section header
        </div>
        <p className="text-[11px] text-muted-foreground -mt-2">
          Leave any field blank to hide it — perfect for tile-only variants.
        </p>
        <div>
          <Label className="text-[11px] text-muted-foreground">Eyebrow</Label>
          <Input
            value={props.eyebrow ?? ""}
            onChange={e => onChange({ ...props, eyebrow: e.target.value })}
            placeholder="WHAT YOU GET"
            className="h-8 text-xs"
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Headline</Label>
          <Textarea
            value={props.headline ?? ""}
            onChange={e => onChange({ ...props, headline: e.target.value })}
            rows={2}
            className="text-xs"
            placeholder="A toolkit, not a tool."
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Subheadline</Label>
          <Textarea
            value={props.subheadline ?? ""}
            onChange={e => onChange({ ...props, subheadline: e.target.value })}
            rows={2}
            className="text-xs"
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Section colors
        </div>
        <div className="grid grid-cols-3 gap-2">
          <ColorField
            label="Background"
            value={props.bgColor ?? ""}
            onChange={v => onChange({ ...props, bgColor: v || undefined })}
          />
          <ColorField
            label="Text"
            value={props.textColor ?? ""}
            onChange={v => onChange({ ...props, textColor: v || undefined })}
          />
          <ColorField
            label="Accent"
            value={props.accentColor ?? ""}
            onChange={v => onChange({ ...props, accentColor: v || undefined })}
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Tiles ({tiles.length})
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Mix any types and sizes. Try a single XL tile, or two LG tiles
              side by side, for a magazine-style variant.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {tiles.map((tile, i) => (
            <TileEditor
              key={i}
              tile={tile}
              index={i}
              total={tiles.length}
              onChange={patch => updateTile(i, patch)}
              onMove={dir => moveTile(i, dir)}
              onRemove={() => removeTile(i)}
            />
          ))}
          {tiles.length === 0 && (
            <p className="text-xs text-muted-foreground italic px-2">
              No tiles yet — add one below.
            </p>
          )}
        </div>

        <div className="rounded-lg border border-dashed border-border p-3 space-y-2">
          <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Plus className="w-3 h-3" /> Add a tile
          </Label>
          <div className="flex flex-col gap-1.5">
            {KIND_OPTIONS.map(opt => (
              <Button
                key={opt.value}
                variant="outline"
                size="sm"
                className="h-auto w-full py-2 px-3 flex flex-col items-start gap-0.5 text-left whitespace-normal"
                onClick={() => addTile(opt.value)}
              >
                <span className="text-xs font-medium flex items-center gap-1.5">
                  <opt.Icon className="w-3 h-3" />
                  {opt.label}
                </span>
                <span className="text-[10px] text-muted-foreground font-normal leading-tight break-words">
                  {opt.hint}
                </span>
              </Button>
            ))}
          </div>
        </div>

        <p className="text-[10px] text-muted-foreground leading-relaxed">
          Tip: the grid is 6 columns wide. Sizes use 2 / 2 / 3 / 4 columns
          (sm/md/lg/xl) and most tiles are 2 rows tall. Two LG tiles
          (3 + 3) fill one row — great for an image + quote variant.
        </p>
      </div>
    </div>
  );
}
