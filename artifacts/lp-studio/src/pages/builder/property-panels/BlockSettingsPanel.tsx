import type { BlockSettings } from "@/lib/block-types";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { BrandSwatches } from "@/components/BrandSwatches";
import { getBlockSettingsCapabilities, ALL_CAPS, type BlockSettingsCapabilities } from "@/lib/block-settings-capabilities";

interface Props {
  settings?: BlockSettings;
  onChange: (settings: BlockSettings) => void;
  /** Block type — drives which controls are shown. When omitted, every
   *  control is shown (backwards-compatible with callers that haven't
   *  threaded the type through yet). */
  blockType?: string;
  /**
   * Current value of `block.props.modalTheme` for blocks whose
   * capability map sets `modalTheme: true`. The panel stays agnostic
   * of block-specific prop shapes — the caller reads this off
   * `block.props` and writes it back via `onModalThemeChange`. Both
   * props must be provided to render the toggle.
   */
  modalTheme?: "light" | "dark";
  onModalThemeChange?: (v: "light" | "dark" | undefined) => void;
}

const SPACING_OPTIONS = [
  { value: "none", label: "None" },
  { value: "xs", label: "XS – 8px" },
  { value: "sm", label: "Small – 16px" },
  { value: "md", label: "Medium – 32px" },
  { value: "lg", label: "Large – 64px" },
  { value: "xl", label: "XL – 96px" },
];

const PADDING_X_OPTIONS = [
  { value: "none", label: "None" },
  { value: "sm", label: "Small – 16px" },
  { value: "md", label: "Medium – 40px" },
  { value: "lg", label: "Large – 80px" },
  { value: "xl", label: "XL – 120px" },
];

const MIN_HEIGHT_OPTIONS = [
  { value: "none", label: "None (auto)" },
  { value: "25", label: "25vh" },
  { value: "50", label: "50vh" },
  { value: "75", label: "75vh" },
  { value: "100", label: "100vh (full screen)" },
];

const TEXT_SCALE_OPTIONS = [
  { value: "75", label: "75% (Smallest)" },
  { value: "85", label: "85%" },
  { value: "90", label: "90%" },
  { value: "100", label: "100% (Normal)" },
  { value: "110", label: "110%" },
  { value: "125", label: "125%" },
  { value: "150", label: "150% (Largest)" },
];

function isValidHex(v: string) {
  return /^#[0-9a-fA-F]{6}$/.test(v);
}

export interface ColorFieldProps {
  label: string;
  value?: string;
  onChange: (v: string | undefined) => void;
}

export function ColorField({ label, value, onChange }: ColorFieldProps) {
  const hex = value && isValidHex(value) ? value : "";
  return (
    <div>
      <Label className="text-xs text-muted-foreground mb-1.5 block">{label}</Label>
      <div className="flex items-center gap-2">
        <div className="relative shrink-0">
          <input
            type="color"
            value={hex || "#ffffff"}
            onChange={(e) => onChange(e.target.value)}
            className="w-8 h-8 rounded cursor-pointer border border-border p-0.5 bg-background"
          />
        </div>
        <Input
          value={value ?? ""}
          onChange={(e) => {
            const v = e.target.value.trim();
            onChange(v === "" ? undefined : v);
          }}
          placeholder="e.g. #1a1a1a"
          className="h-8 text-xs font-mono flex-1"
          maxLength={7}
        />
        {value && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive shrink-0"
            onClick={() => onChange(undefined)}
            title="Clear"
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
      <BrandSwatches className="mt-1.5" current={hex} onPick={(h) => onChange(h)} />
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{children}</p>
  );
}

export function BlockSettingsPanel({ settings, onChange, blockType, modalTheme, onModalThemeChange }: Props) {
  const s = settings ?? {};
  const set = <K extends keyof BlockSettings>(k: K, v: BlockSettings[K]) =>
    onChange({ ...s, [k]: v });

  const caps: BlockSettingsCapabilities = blockType
    ? getBlockSettingsCapabilities(blockType)
    : ALL_CAPS;

  // Decide whether each grouped section should render at all. Avoids
  // showing a section heading with no controls underneath it.
  const showColors = caps.bgColor || caps.textColors || caps.cardBgColor;
  const showLayout = caps.spacing || caps.paddingX || caps.minHeight;
  // The modal-theme toggle requires both the capability flag AND a
  // caller-provided onChange (otherwise we'd render a dead control).
  const showModalTheme = caps.modalTheme && typeof onModalThemeChange === "function";

  return (
    <div className="space-y-5">
      {showModalTheme && (
        <section className="space-y-2">
          <SectionHeading>Modal Theme</SectionHeading>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Shell color for CTA modal openers on this block
            </Label>
            <div className="flex gap-2">
              {([
                ["light", "Light"],
                ["dark", "Dark"],
              ] as const).map(([v, lbl]) => {
                const current = modalTheme ?? "light";
                const active = current === v;
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => onModalThemeChange?.(v)}
                    className={`flex-1 py-1.5 text-xs rounded border ${active ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
                  >
                    {lbl}
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-muted-foreground">
              Use <span className="font-medium">Dark</span> on cinematic / dark sections so the modal blends in; <span className="font-medium">Light</span> elsewhere.
            </p>
          </div>
          <Separator />
        </section>
      )}

      {caps.anchorId && (
        <section className="space-y-2">
          <SectionHeading>Navigation</SectionHeading>
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Anchor ID</Label>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground font-mono shrink-0">#</span>
              <Input
                value={s.anchorId ?? ""}
                onChange={e => set("anchorId", e.target.value.replace(/[^a-z0-9-_]/gi, "").toLowerCase() || undefined)}
                placeholder="contact-form"
                className="h-8 text-xs font-mono flex-1"
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5">
              Link nav buttons here using <span className="font-mono">#{s.anchorId || "your-id"}</span> as the URL.
            </p>
          </div>
        </section>
      )}

      {showColors && (
        <section className="space-y-3">
          <Separator />
          <SectionHeading>Colors</SectionHeading>
          {caps.bgColor && (
            <ColorField
              label="Background"
              value={s.bgColor}
              onChange={(v) => onChange({ ...s, bgColor: v })}
            />
          )}
          {caps.textColors && (
            <>
              <ColorField
                label="Headline color"
                value={s.headlineColor}
                onChange={(v) => onChange({ ...s, headlineColor: v })}
              />
              <ColorField
                label="Body text color"
                value={s.bodyColor}
                onChange={(v) => onChange({ ...s, bodyColor: v })}
              />
              <ColorField
                label="All text (global)"
                value={s.textColor}
                onChange={(v) => onChange({ ...s, textColor: v })}
              />
            </>
          )}
          {caps.cardBgColor && (
            <ColorField
              label="Card Background"
              value={s.cardBgColor}
              onChange={(v) => onChange({ ...s, cardBgColor: v })}
            />
          )}
        </section>
      )}

      {caps.textScale && (
        <section className="space-y-2">
          <Separator />
          <SectionHeading>Text Size</SectionHeading>
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Scale</Label>
            <Select
              value={s.textScale ?? "100"}
              onValueChange={v => set("textScale", v as BlockSettings["textScale"])}
            >
              <SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TEXT_SCALE_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </section>
      )}

      {showLayout && (
        <section className="space-y-3">
          <Separator />
          <SectionHeading>Block Layout</SectionHeading>
          {caps.spacing && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Space Above</Label>
                <Select
                  value={s.spacingTop ?? ""}
                  onValueChange={v => set("spacingTop", v as BlockSettings["spacingTop"])}
                >
                  <SelectTrigger className="text-xs h-8"><SelectValue placeholder="Default" /></SelectTrigger>
                  <SelectContent>
                    {SPACING_OPTIONS.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Space Below</Label>
                <Select
                  value={s.spacingBottom ?? ""}
                  onValueChange={v => set("spacingBottom", v as BlockSettings["spacingBottom"])}
                >
                  <SelectTrigger className="text-xs h-8"><SelectValue placeholder="Default" /></SelectTrigger>
                  <SelectContent>
                    {SPACING_OPTIONS.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          {caps.paddingX && (
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Side Padding</Label>
              <Select
                value={s.paddingX ?? "none"}
                onValueChange={v => set("paddingX", v as BlockSettings["paddingX"])}
              >
                <SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PADDING_X_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {caps.minHeight && (
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Min Height</Label>
              <Select
                value={s.minHeight ?? "none"}
                onValueChange={v => set("minHeight", v as BlockSettings["minHeight"])}
              >
                <SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MIN_HEIGHT_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </section>
      )}

      {caps.animation && (
        <section className="space-y-2">
          <Separator />
          <SectionHeading>Block Animation</SectionHeading>
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Entrance Style</Label>
            <Select
              value={s.animationStyle ?? "fade-up"}
              onValueChange={v => set("animationStyle", v as BlockSettings["animationStyle"])}
            >
              <SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="fade-up">Fade Up (default)</SelectItem>
                <SelectItem value="fade-in">Fade In</SelectItem>
                <SelectItem value="slide-left">Slide from Left</SelectItem>
                <SelectItem value="slide-right">Slide from Right</SelectItem>
                <SelectItem value="scale-in">Scale In</SelectItem>
                <SelectItem value="none">None (instant)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </section>
      )}

      {caps.bgImage && (
        <section className="space-y-3">
          <Separator />
          <SectionHeading>Background Image</SectionHeading>
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Image URL</Label>
            <Input
              value={s.bgImageUrl ?? ""}
              onChange={e => set("bgImageUrl", e.target.value || undefined)}
              placeholder="https://..."
              className="h-8 text-xs font-mono"
            />
          </div>

          {s.bgImageUrl && (
            <>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">
                  Opacity — {s.bgImageOpacity ?? 100}%
                </Label>
                <input
                  type="range"
                  min={5}
                  max={100}
                  step={5}
                  value={s.bgImageOpacity ?? 100}
                  onChange={e => set("bgImageOpacity", Number(e.target.value))}
                  className="w-full accent-[var(--brand-primary)]"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-foreground">Parallax Scroll</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Subtle depth effect on scroll</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={s.bgImageParallax ?? false}
                  onClick={() => set("bgImageParallax", !(s.bgImageParallax ?? false))}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${s.bgImageParallax ? "bg-[var(--brand-primary)]" : "bg-slate-200"}`}
                >
                  <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform ${s.bgImageParallax ? "translate-x-4" : "translate-x-0"}`} />
                </button>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}
