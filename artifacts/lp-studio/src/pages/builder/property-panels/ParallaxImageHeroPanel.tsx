import type { ParallaxImageHeroBlockProps, CtaModalConfig, CtaMode } from "@/lib/block-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImagePicker } from "@/components/ImagePicker";
import { VideoPicker } from "@/components/VideoPicker";
import { Switch } from "@/components/ui/switch";
import { CtaButtonModalConfigSection } from "./CtaButtonModalConfigSection";

interface Props {
  props: ParallaxImageHeroBlockProps;
  onChange: (props: ParallaxImageHeroBlockProps) => void;
}

export function ParallaxImageHeroPanel({ props, onChange }: Props) {
  const u = (patch: Partial<ParallaxImageHeroBlockProps>) => onChange({ ...props, ...patch });

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Background image (also used as video poster)</div>
        <ImagePicker value={props.imageUrl} onChange={(url) => u({ imageUrl: url })} />
      </div>

      <div className="space-y-2">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Background video (optional)</div>
        <VideoPicker value={props.videoUrl ?? ""} onChange={(v) => u({ videoUrl: v || undefined })} />
        <p className="text-[10px] text-muted-foreground">When set, replaces the static image with a looping background video. The image above is used as the poster / reduced-motion fallback.</p>
        {props.videoUrl && (
          <div className="flex items-center justify-between pt-1">
            <Label className="text-[11px] text-muted-foreground">Autoplay video</Label>
            <Switch checked={props.videoAutoplay !== false} onCheckedChange={(v) => u({ videoAutoplay: v })} />
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Top corners</div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Eyebrow (top-left)</Label>
          <Input value={props.eyebrow ?? ""} onChange={(e) => u({ eyebrow: e.target.value })} className="h-8 text-xs" placeholder="● NOW AVAILABLE" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Reference label (top-right)</Label>
          <Input value={props.referenceLabel ?? ""} onChange={(e) => u({ referenceLabel: e.target.value })} className="h-8 text-xs" placeholder="01" />
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Headline</div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Headline</Label>
          <Input value={props.headline ?? ""} onChange={(e) => u({ headline: e.target.value })} className="h-8 text-xs" placeholder="Build something remarkable." />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Accent word (italic + colored)</Label>
          <Input value={props.headlineAccentWord ?? ""} onChange={(e) => u({ headlineAccentWord: e.target.value })} className="h-8 text-xs" placeholder="remarkable" />
          <div className="text-[10px] text-muted-foreground mt-1">Must appear exactly inside the headline.</div>
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Accent color</Label>
          <div className="flex gap-2 items-center">
            <input
              type="color"
              value={props.accentColor ?? "#C7E738"}
              onChange={(e) => u({ accentColor: e.target.value })}
              className="h-8 w-10 p-0 border rounded cursor-pointer"
            />
            <Input value={props.accentColor ?? ""} onChange={(e) => u({ accentColor: e.target.value })} className="h-8 text-xs font-mono" placeholder="#C7E738" />
          </div>
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Text color</Label>
          <div className="flex gap-2 items-center">
            <input
              type="color"
              value={props.textColor ?? "#FFFFFF"}
              onChange={(e) => u({ textColor: e.target.value })}
              className="h-8 w-10 p-0 border rounded cursor-pointer"
            />
            <Input value={props.textColor ?? ""} onChange={(e) => u({ textColor: e.target.value })} className="h-8 text-xs font-mono" placeholder="#FFFFFF" />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Call to action (bottom-left)</div>
        <div>
          <Label className="text-[11px] text-muted-foreground">CTA style</Label>
          <Select
            value={props.ctaStyle ?? "link"}
            onValueChange={(v) => u({ ctaStyle: v as "link" | "buttons" | "email-capture" })}
          >
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="link">Underlined link (default)</SelectItem>
              <SelectItem value="buttons">Pill button</SelectItem>
              <SelectItem value="email-capture">Inline email-capture pill</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-[10px] text-muted-foreground mt-1">Leave the CTA text empty to hide the link/button entirely.</p>
        </div>

        {(props.ctaStyle ?? "link") !== "email-capture" && (
          <div>
            <Label className="text-[11px] text-muted-foreground">CTA text</Label>
            <Input value={props.ctaText ?? ""} onChange={(e) => u({ ctaText: e.target.value })} className="h-8 text-xs" placeholder="Take a tour" />
          </div>
        )}

        {(props.ctaStyle ?? "link") === "email-capture" && (
          <>
            <div>
              <Label className="text-[11px] text-muted-foreground">Email input placeholder</Label>
              <Input value={props.emailCapturePlaceholder ?? ""} onChange={(e) => u({ emailCapturePlaceholder: e.target.value })} className="h-8 text-xs" placeholder="Email address" />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Submit button text</Label>
              <Input value={props.emailCaptureButtonText ?? ""} onChange={(e) => u({ emailCaptureButtonText: e.target.value })} className="h-8 text-xs" placeholder="Get Started" />
            </div>
          </>
        )}

        <div>
          <Label className="text-[11px] text-muted-foreground">
            {(props.ctaStyle ?? "link") === "email-capture" ? "On submit" : "CTA action"}
          </Label>
          {(props.ctaStyle ?? "link") === "email-capture" ? (
            <Select
              value={props.submitMode ?? "navigate"}
              onValueChange={(v) => u({ submitMode: v as "navigate" | "modal-form" | "modal-chilipiper" })}
            >
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="navigate">Navigate to URL (append ?email=…)</SelectItem>
                <SelectItem value="modal-form">Open modal form</SelectItem>
                <SelectItem value="modal-chilipiper">Open Chili Piper modal</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <Select
              value={props.ctaMode ?? "link"}
              onValueChange={(v) => u({ ctaMode: v as CtaMode })}
            >
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="link">Open URL</SelectItem>
                <SelectItem value="chilipiper">Open Chili Piper scheduler</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        <div>
          <Label className="text-[11px] text-muted-foreground">
            {(props.ctaStyle ?? "link") === "email-capture" && (props.submitMode ?? "navigate") !== "navigate" ? "Fallback URL" : "CTA URL"}
          </Label>
          <Input value={props.ctaUrl ?? ""} onChange={(e) => u({ ctaUrl: e.target.value })} className="h-8 text-xs" placeholder="#" />
        </div>

        {(props.ctaStyle ?? "link") === "email-capture" && (props.submitMode === "modal-form" || props.submitMode === "modal-chilipiper") && (
          <CtaButtonModalConfigSection
            ctaAction={props.submitMode}
            value={props as CtaModalConfig}
            onChange={(next) => onChange({ ...props, ...next })}
          />
        )}

        {(props.ctaStyle ?? "link") !== "link" && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[11px] text-muted-foreground">Button color</Label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={props.ctaButtonColor ?? props.accentColor ?? "#3b82f6"}
                  onChange={(e) => u({ ctaButtonColor: e.target.value })}
                  className="h-8 w-10 p-0 border rounded cursor-pointer"
                />
                <Input value={props.ctaButtonColor ?? ""} onChange={(e) => u({ ctaButtonColor: e.target.value })} className="h-8 text-xs font-mono" placeholder="accent" />
              </div>
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Button text color</Label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={props.ctaButtonTextColor ?? "#000000"}
                  onChange={(e) => u({ ctaButtonTextColor: e.target.value })}
                  className="h-8 w-10 p-0 border rounded cursor-pointer"
                />
                <Input value={props.ctaButtonTextColor ?? ""} onChange={(e) => u({ ctaButtonTextColor: e.target.value })} className="h-8 text-xs font-mono" placeholder="auto" />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Brand mark (bottom-right)</div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Brand mark text</Label>
          <Input value={props.brandMark ?? ""} onChange={(e) => u({ brandMark: e.target.value })} className="h-8 text-xs" placeholder="brand" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Brand mark logo (overrides text)</Label>
          <ImagePicker value={props.brandMarkLogoUrl ?? ""} onChange={(url) => u({ brandMarkLogoUrl: url })} />
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Effects</div>
        <div>
          <Label className="text-[11px] text-muted-foreground">
            Parallax strength: {Math.round((props.parallaxStrength ?? 0.35) * 100)}%
          </Label>
          <Slider
            min={0}
            max={80}
            step={5}
            value={[Math.round((props.parallaxStrength ?? 0.35) * 100)]}
            onValueChange={([v]) => u({ parallaxStrength: v / 100 })}
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">
            Image / video zoom: {Math.round((props.mediaScale ?? 1) * 100)}%
          </Label>
          <Slider
            min={100}
            max={200}
            step={5}
            value={[Math.round((props.mediaScale ?? 1) * 100)]}
            onValueChange={([v]) => u({ mediaScale: v / 100 })}
          />
          <p className="text-[10px] text-muted-foreground mt-1">
            100% = natural full-bleed fit (default — the image's own
            framing, no extra zoom). Higher values zoom in to crop closer
            on the subject.
          </p>
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">
            Overlay opacity: {props.overlayOpacity ?? 35}%
          </Label>
          <Slider
            min={0}
            max={100}
            step={5}
            value={[props.overlayOpacity ?? 35]}
            onValueChange={([v]) => u({ overlayOpacity: v })}
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Overlay color</Label>
          <div className="flex gap-2 items-center">
            <input
              type="color"
              value={props.overlayColor ?? "#000000"}
              onChange={(e) => u({ overlayColor: e.target.value })}
              className="h-8 w-10 p-0 border rounded cursor-pointer"
            />
            <Input value={props.overlayColor ?? ""} onChange={(e) => u({ overlayColor: e.target.value })} className="h-8 text-xs font-mono" placeholder="#000000" />
          </div>
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Section height</Label>
          <Select
            value={props.minHeight ?? "full"}
            onValueChange={(v) =>
              u({ minHeight: v as "full" | "large" | "medium" | "compact" | "small" | "slim" })
            }
          >
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="full">Full viewport (100vh)</SelectItem>
              <SelectItem value="large">Large (85vh)</SelectItem>
              <SelectItem value="medium">Medium (70vh)</SelectItem>
              <SelectItem value="compact">Compact (55vh)</SelectItem>
              <SelectItem value="small">Small (40vh)</SelectItem>
              <SelectItem value="slim">Slim strip (28vh)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-[10px] text-muted-foreground mt-1">
            Use Compact / Small / Slim when the parallax should sit inside a larger section rather than fill the screen.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Edge fade (blend into adjacent sections)
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Fade direction</Label>
          <Select
            value={props.edgeFade ?? "none"}
            onValueChange={(v) => u({ edgeFade: v as "none" | "top" | "bottom" | "both" })}
          >
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No fade</SelectItem>
              <SelectItem value="top">Fade in from top (blend into section above)</SelectItem>
              <SelectItem value="bottom">Fade out at bottom (blend into section below)</SelectItem>
              <SelectItem value="both">Fade both edges</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {(props.edgeFade ?? "none") !== "none" && (
          <>
            <div>
              <Label className="text-[11px] text-muted-foreground">Fade color (match adjacent section)</Label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={props.edgeFadeColor ?? "#0a0a0a"}
                  onChange={(e) => u({ edgeFadeColor: e.target.value })}
                  className="h-8 w-10 p-0 border rounded cursor-pointer"
                />
                <Input
                  value={props.edgeFadeColor ?? ""}
                  onChange={(e) => u({ edgeFadeColor: e.target.value })}
                  className="h-8 text-xs font-mono"
                  placeholder="#0a0a0a"
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                Pick the background color of the section above/below so the fade resolves invisibly into it.
              </p>
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">
                Fade size: {props.edgeFadeSize ?? 25}% of section
              </Label>
              <Slider
                min={0}
                max={60}
                step={5}
                value={[props.edgeFadeSize ?? 25]}
                onValueChange={([v]) => u({ edgeFadeSize: v })}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
