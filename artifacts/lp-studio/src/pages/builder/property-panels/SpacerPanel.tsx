import type { SpacerBlockProps } from "@/lib/block-types";
import { Label } from "@/components/ui/label";

interface Props {
  props: SpacerBlockProps;
  onChange: (props: SpacerBlockProps) => void;
}

const PRESETS = [32, 64, 96, 128, 192];

export function SpacerPanel({ props, onChange }: Props) {
  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Height</Label>
          <span className="text-xs font-mono text-foreground bg-muted px-2 py-0.5 rounded">{props.height}px</span>
        </div>
        <input
          type="range"
          min={8}
          max={400}
          step={4}
          value={props.height}
          onChange={e => onChange({ ...props, height: Number(e.target.value) })}
          className="w-full accent-primary"
        />
        <div className="flex gap-2 mt-2 flex-wrap">
          {PRESETS.map(h => (
            <button
              key={h}
              onClick={() => onChange({ ...props, height: h })}
              className={`text-[11px] px-2 py-1 rounded border transition-colors ${
                props.height === h
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-border hover:border-primary/50 text-muted-foreground"
              }`}
            >
              {h}px
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Background Color</Label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={props.backgroundColor === "transparent" ? "#ffffff" : props.backgroundColor}
            onChange={e => onChange({ ...props, backgroundColor: e.target.value })}
            className="w-8 h-8 rounded border border-border cursor-pointer"
          />
          <button
            onClick={() => onChange({ ...props, backgroundColor: "transparent" })}
            className={`text-xs px-3 py-1.5 rounded border transition-colors ${
              props.backgroundColor === "transparent"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background border-border hover:border-primary/50 text-muted-foreground"
            }`}
          >
            Transparent
          </button>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground leading-relaxed">
        Use a Spacer to add breathing room between sections without adding any content. Transparent background inherits the page background.
      </p>
    </div>
  );
}
