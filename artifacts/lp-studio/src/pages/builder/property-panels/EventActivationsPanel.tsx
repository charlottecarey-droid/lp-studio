import { useEffect, useState } from "react";
import { Plus, Trash2, ArrowUp, ArrowDown, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ImagePicker } from "@/components/ImagePicker";
import { VideoPicker } from "@/components/VideoPicker";
import { FocalPointPicker } from "@/components/FocalPointPicker";
import { ColorField } from "./BlockSettingsPanel";
import { SectionBackgroundControl } from "./SectionBackgroundControl";
import type {
  EventActivationsBlockProps,
  EventActivationItem,
} from "@/blocks/BlockEventActivations";

/* ----------------------------------------------------------------------------
 * Property panel for the "event-activations" full-page block (sponsored-event
 * presence page). Mirrors the block top-to-bottom: navbar, hero (split /
 * full-bleed / dark band), intro lockup, the activations list, the
 * book-a-meeting close (big CTA button OR embedded global/Marketo form), the
 * shared premium button styling (colors, drop shadow, shine — feature parity
 * with the Premium Events Page), and the footer line.
 * -------------------------------------------------------------------------- */

interface GlobalFormSummaryLite { id: number; name: string }

interface Props {
  props: EventActivationsBlockProps;
  onChange: (props: EventActivationsBlockProps) => void;
}

export function EventActivationsPanel({ props, onChange }: Props) {
  const set = <K extends keyof EventActivationsBlockProps>(k: K, v: EventActivationsBlockProps[K]) =>
    onChange({ ...props, [k]: v });

  const [forms, setForms] = useState<GlobalFormSummaryLite[]>([]);
  useEffect(() => {
    fetch("/api/lp/forms")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: GlobalFormSummaryLite[]) => {
        if (Array.isArray(data)) setForms(data);
      })
      .catch(() => {});
  }, []);

  const [openItem, setOpenItem] = useState<number | null>(0);

  const activations = props.activations ?? [];
  const setItem = (i: number, patch: Partial<EventActivationItem>) =>
    set("activations", activations.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));
  const addItem = () => {
    set("activations", [
      ...activations,
      {
        kicker: "Booth | All week",
        title: "New activation",
        body: "What's happening, when, and why it's worth a stop.",
        linkText: "Learn more",
        linkUrl: "#book",
      },
    ]);
    setOpenItem(activations.length);
  };
  const removeItem = (i: number) => {
    set("activations", activations.filter((_, idx) => idx !== i));
    setOpenItem(null);
  };
  const moveItem = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= activations.length) return;
    const next = [...activations];
    [next[i], next[j]] = [next[j], next[i]];
    set("activations", next);
    setOpenItem(j);
  };

  const navLinks = props.navLinks ?? [];
  const setNavLink = (i: number, patch: Partial<{ label: string; href: string }>) =>
    set("navLinks", navLinks.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const heroLayout = props.heroLayout ?? "split";

  return (
    <div className="space-y-5 p-4">
      {/* Navbar ---------------------------------------------------------- */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Navbar</Label>
          <Switch checked={props.showNav !== false} onCheckedChange={(v) => set("showNav", v)} />
        </div>
        {props.showNav !== false && (
          <div className="space-y-3">
            <ImagePicker
              label="Logo override (optional)"
              value={props.logoUrl ?? ""}
              onChange={(v) => set("logoUrl", v)}
              placeholder="Defaults to your brand logo"
            />
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Nav CTA label</Label>
                <Input
                  value={props.navCtaText ?? ""}
                  onChange={(e) => set("navCtaText", e.target.value)}
                  className="h-8 text-xs"
                  placeholder="Book a meeting"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Nav CTA URL or #anchor</Label>
                <Input
                  value={props.navCtaUrl ?? ""}
                  onChange={(e) => set("navCtaUrl", e.target.value)}
                  className="h-8 text-xs"
                  placeholder="#book"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Nav links (max 4 shown)</Label>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-xs gap-1 px-2"
                  onClick={() => set("navLinks", [...navLinks, { label: "New link", href: "#activations" }])}
                >
                  <Plus className="w-3 h-3" /> Add
                </Button>
              </div>
              {navLinks.map((l, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Input
                    value={l.label}
                    onChange={(e) => setNavLink(i, { label: e.target.value })}
                    className="h-7 text-xs flex-1"
                    placeholder="Label"
                  />
                  <Input
                    value={l.href}
                    onChange={(e) => setNavLink(i, { href: e.target.value })}
                    className="h-7 text-xs flex-1 font-mono"
                    placeholder="#anchor"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => set("navLinks", navLinks.filter((_, idx) => idx !== i))}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Hero ------------------------------------------------------------ */}
      <div className="space-y-3 border-t pt-4">
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Hero</Label>
        <div className="space-y-1.5">
          <Label className="text-xs">Layout</Label>
          <Select
            value={heroLayout}
            onValueChange={(v) => set("heroLayout", v as EventActivationsBlockProps["heroLayout"])}
          >
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="split">Split — copy left, image right</SelectItem>
              <SelectItem value="image-overlay">Full-bleed image</SelectItem>
              <SelectItem value="dark">Dark brand band (no image)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground">Layouts that need an image fall back to the dark band when none is set.</p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Badge (event + dates)</Label>
          <Input
            value={props.badgeText ?? ""}
            onChange={(e) => set("badgeText", e.target.value)}
            className="h-8 text-xs"
            placeholder="Summit 2026 • July 15 – 17, 2026"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Headline</Label>
          <Textarea
            value={props.headline ?? ""}
            onChange={(e) => set("headline", e.target.value)}
            rows={2}
            className="text-sm"
            placeholder="Visit us at"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Accent line (e.g. booth number)</Label>
          <Input
            value={props.headlineAccent ?? ""}
            onChange={(e) => set("headlineAccent", e.target.value)}
            className="h-8 text-xs"
            placeholder="Booth #21"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Supporting copy</Label>
          <Textarea
            value={props.heroBody ?? ""}
            onChange={(e) => set("heroBody", e.target.value)}
            rows={3}
            className="text-xs"
            placeholder="Three days, one booth, every conversation that matters…"
          />
        </div>
        <ImagePicker
          label="Hero image"
          value={props.heroImage ?? ""}
          onChange={(v) => set("heroImage", v)}
          placeholder="https://images.unsplash.com/…"
        />
        <div className="space-y-1.5">
          <Label className="text-xs">Image alt text</Label>
          <Input
            value={props.heroImageAlt ?? ""}
            onChange={(e) => set("heroImageAlt", e.target.value)}
            className="h-8 text-xs"
            placeholder="Host-city skyline at dusk"
          />
        </div>
        <FocalPointPicker
          label="Focal point"
          value={props.heroImageFocalPoint ?? "50% 50%"}
          onChange={(v) => set("heroImageFocalPoint", v)}
          previewUrl={props.heroImage ?? undefined}
        />
        <VideoPicker
          label="Video (optional)"
          value={props.heroVideoUrl ?? ""}
          onChange={(v) => set("heroVideoUrl", v || undefined)}
        />
        <p className="text-[11px] text-muted-foreground">Pick from your video library or paste a YouTube / Vimeo / Loom link. Split layout: plays in the media slot (the image becomes the poster). Full-bleed: an uploaded/.mp4 video becomes the looping background; other links get a "Watch the video" button.</p>
        {heroLayout === "image-overlay" && (
          <div className="grid grid-cols-2 gap-2">
            <ColorField
              label="Overlay color"
              value={props.overlayColor ?? "#000000"}
              onChange={(v) => set("overlayColor", v)}
            />
            <div className="space-y-1.5">
              <Label className="text-xs">Overlay opacity ({(props.backgroundOverlay ?? 0.45).toFixed(2)})</Label>
              <Slider
                min={0}
                max={1}
                step={0.05}
                value={[props.backgroundOverlay ?? 0.45]}
                onValueChange={(v) => set("backgroundOverlay", v[0])}
              />
            </div>
          </div>
        )}
        <div className="space-y-2 rounded-md border p-2.5">
          <SectionBackgroundControl
            backgroundStyle={props.heroBackgroundStyle}
            bgColor={props.heroBgColor}
            defaultBgColor="#ffffff"
            onChange={(patch) => onChange({ ...props, heroBackgroundStyle: patch.backgroundStyle, ...(patch.bgColor !== undefined ? { heroBgColor: patch.bgColor } : {}) })}
            label="Hero background"
          />
          <div className="grid grid-cols-2 gap-2">
            <ColorField
              label="Headline color"
              value={props.heroHeadlineColor}
              onChange={(v) => set("heroHeadlineColor", v)}
            />
            <ColorField
              label="Accent line color"
              value={props.heroAccentColor}
              onChange={(v) => set("heroAccentColor", v)}
            />
          </div>
          <p className="text-[11px] text-muted-foreground">Empty = automatic from your brand. Behind a full-bleed image the photo covers the background.</p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Headline size — {(props.headlineFontScale ?? 1).toFixed(2)}×</Label>
          <Slider
            min={0.6}
            max={1.8}
            step={0.05}
            value={[props.headlineFontScale ?? 1]}
            onValueChange={(v) => set("headlineFontScale", v[0])}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Hero button label</Label>
            <Input
              value={props.heroCtaText ?? ""}
              onChange={(e) => set("heroCtaText", e.target.value)}
              className="h-8 text-xs"
              placeholder="See what's happening"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Hero button URL or #anchor</Label>
            <Input
              value={props.heroCtaUrl ?? ""}
              onChange={(e) => set("heroCtaUrl", e.target.value)}
              className="h-8 text-xs"
              placeholder="#activations"
            />
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">Leave the hero button label empty to hide it.</p>
      </div>

      {/* Intro lockup ----------------------------------------------------- */}
      <div className="space-y-3 border-t pt-4">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Intro lockup</Label>
          <Switch
            checked={props.showIntroSection !== false}
            onCheckedChange={(v) => set("showIntroSection", v)}
          />
        </div>
        {props.showIntroSection !== false && (
          <div className="space-y-2">
            <Input
              value={props.introKicker ?? ""}
              onChange={(e) => set("introKicker", e.target.value)}
              className="h-8 text-xs"
              placeholder="At the show"
            />
            <Textarea
              value={props.introHeadline ?? ""}
              onChange={(e) => set("introHeadline", e.target.value)}
              rows={2}
              className="text-xs"
              placeholder="Everything we're hosting on the floor"
            />
            <Textarea
              value={props.introBody ?? ""}
              onChange={(e) => set("introBody", e.target.value)}
              rows={2}
              className="text-xs"
              placeholder="From breakout sessions to after-hours socials…"
            />
          </div>
        )}
      </div>

      {/* Activations ------------------------------------------------------ */}
      <div className="space-y-3 border-t pt-4">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Activations</Label>
          <Switch
            checked={props.showActivations !== false}
            onCheckedChange={(v) => set("showActivations", v)}
          />
        </div>
        {props.showActivations !== false && (
          <div className="space-y-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Section anchor id</Label>
              <Input
                value={props.activationsAnchorId ?? "activations"}
                onChange={(e) => set("activationsAnchorId", e.target.value)}
                className="h-8 text-xs font-mono"
                placeholder="activations"
              />
            </div>
            <div className="space-y-2 rounded-md border p-2.5">
              <SectionBackgroundControl
                backgroundStyle={props.activationsBackgroundStyle}
                bgColor={props.activationsBgColor}
                defaultBgColor="#f2f4f5"
                onChange={(patch) => onChange({ ...props, activationsBackgroundStyle: patch.backgroundStyle, ...(patch.bgColor !== undefined ? { activationsBgColor: patch.bgColor } : {}) })}
                label="Section background"
              />
              <div className="grid grid-cols-2 gap-2">
                <ColorField
                  label="Headline color"
                  value={props.introHeadlineColor}
                  onChange={(v) => set("introHeadlineColor", v)}
                />
                <ColorField
                  label="Card title color"
                  value={props.cardTitleColor}
                  onChange={(v) => set("cardTitleColor", v)}
                />
              </div>
              <ColorField
                label="Card background"
                value={props.cardBgColor}
                onChange={(v) => set("cardBgColor", v)}
              />
              <p className="text-[11px] text-muted-foreground">Empty = automatic (soft brand tint, white cards). Card text re-adjusts for dark card colors. Card background also applies to the booking form card.</p>
            </div>
            {activations.map((a, i) => {
              const open = openItem === i;
              return (
                <div key={i} className="rounded-md border">
                  <div className="flex items-center gap-1 p-2">
                    <button
                      type="button"
                      className="flex flex-1 items-center gap-1.5 text-left text-xs font-medium min-w-0"
                      onClick={() => setOpenItem(open ? null : i)}
                    >
                      {open ? <ChevronDown className="w-3.5 h-3.5 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0" />}
                      <span className="truncate">{a.title || `Activation ${i + 1}`}</span>
                    </button>
                    <Button size="icon" variant="ghost" className="h-6 w-6" disabled={i === 0} onClick={() => moveItem(i, -1)}>
                      <ArrowUp className="w-3 h-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6" disabled={i === activations.length - 1} onClick={() => moveItem(i, 1)}>
                      <ArrowDown className="w-3 h-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      onClick={() => removeItem(i)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                  {open && (
                    <div className="space-y-2 border-t p-2.5">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Kicker chip</Label>
                        <Input
                          value={a.kicker ?? ""}
                          onChange={(e) => setItem(i, { kicker: e.target.value })}
                          className="h-8 text-xs"
                          placeholder="Breakout session | Day 2 • 4:45 PM"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Title</Label>
                        <Input
                          value={a.title}
                          onChange={(e) => setItem(i, { title: e.target.value })}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Body</Label>
                        <Textarea
                          value={a.body ?? ""}
                          onChange={(e) => setItem(i, { body: e.target.value })}
                          rows={3}
                          className="text-xs"
                        />
                      </div>
                      <ImagePicker
                        label="Image (optional)"
                        value={a.imageUrl ?? ""}
                        onChange={(v) => setItem(i, { imageUrl: v })}
                        placeholder="https://images.unsplash.com/…"
                      />
                      <VideoPicker
                        label="Video (optional)"
                        value={a.videoUrl ?? ""}
                        onChange={(v) => setItem(i, { videoUrl: v || undefined })}
                      />
                      {a.videoUrl && (
                        <p className="text-[11px] text-muted-foreground">The video plays in this card's media slot; with an image set, the image is the poster behind a play button.</p>
                      )}
                      {a.imageUrl && (
                        <>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Image alt text</Label>
                            <Input
                              value={a.imageAlt ?? ""}
                              onChange={(e) => setItem(i, { imageAlt: e.target.value })}
                              className="h-8 text-xs"
                            />
                          </div>
                          <FocalPointPicker
                            label="Focal point"
                            value={a.imageFocalPoint ?? "50% 50%"}
                            onChange={(v) => setItem(i, { imageFocalPoint: v })}
                            previewUrl={a.imageUrl}
                          />
                        </>
                      )}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Link label</Label>
                          <Input
                            value={a.linkText ?? ""}
                            onChange={(e) => setItem(i, { linkText: e.target.value })}
                            className="h-8 text-xs"
                            placeholder="RSVP here"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Link URL or #anchor</Label>
                          <Input
                            value={a.linkUrl ?? ""}
                            onChange={(e) => setItem(i, { linkUrl: e.target.value })}
                            className="h-8 text-xs"
                            placeholder="#book"
                          />
                        </div>
                      </div>
                      <p className="text-[11px] text-muted-foreground">Leave the link label empty to hide the link.</p>
                    </div>
                  )}
                </div>
              );
            })}
            <Button size="sm" variant="outline" className="h-7 w-full text-xs gap-1" onClick={addItem}>
              <Plus className="w-3 h-3" /> Add activation
            </Button>
          </div>
        )}
      </div>

      {/* Booking close ---------------------------------------------------- */}
      <div className="space-y-3 border-t pt-4">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Book a meeting</Label>
          <Switch
            checked={props.showBookingSection !== false}
            onCheckedChange={(v) => set("showBookingSection", v)}
          />
        </div>
        {props.showBookingSection !== false && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Anchor id</Label>
                <Input
                  value={props.bookingAnchorId ?? "book"}
                  onChange={(e) => set("bookingAnchorId", e.target.value)}
                  className="h-8 text-xs font-mono"
                  placeholder="book"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Kicker</Label>
                <Input
                  value={props.bookingKicker ?? ""}
                  onChange={(e) => set("bookingKicker", e.target.value)}
                  className="h-8 text-xs"
                  placeholder="On-site meetings"
                />
              </div>
            </div>
            <Input
              value={props.bookingHeading ?? ""}
              onChange={(e) => set("bookingHeading", e.target.value)}
              className="h-8 text-xs"
              placeholder="Book a meeting at the show"
            />
            <Textarea
              value={props.bookingBody ?? ""}
              onChange={(e) => set("bookingBody", e.target.value)}
              rows={2}
              className="text-xs"
              placeholder="Grab 30 minutes with our team on the floor…"
            />
            <div className="space-y-2 rounded-md border p-2.5">
              <SectionBackgroundControl
                backgroundStyle={props.bookingBackgroundStyle}
                bgColor={props.bookingBgColor}
                defaultBgColor="#ffffff"
                onChange={(patch) => onChange({ ...props, bookingBackgroundStyle: patch.backgroundStyle, ...(patch.bgColor !== undefined ? { bookingBgColor: patch.bgColor } : {}) })}
                label="Section background"
              />
              <ColorField
                label="Headline color"
                value={props.bookingHeadlineColor}
                onChange={(v) => set("bookingHeadlineColor", v)}
              />
              <p className="text-[11px] text-muted-foreground">Empty = automatic. Text and the host lockup re-adjust for dark backgrounds.</p>
            </div>
            <div className="space-y-2 rounded-md border p-2.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Meeting host</Label>
                <Switch
                  checked={props.showBookingHost !== false}
                  onCheckedChange={(v) => set("showBookingHost", v)}
                />
              </div>
              {props.showBookingHost !== false && (
                <div className="space-y-2">
                  <ImagePicker
                    label="Headshot"
                    value={props.hostImageUrl ?? ""}
                    onChange={(v) => set("hostImageUrl", v)}
                    placeholder="https://…"
                  />
                  {props.hostImageUrl ? (
                    <FocalPointPicker
                      label="Focal point"
                      value={props.hostImageFocalPoint ?? "50% 50%"}
                      onChange={(v) => set("hostImageFocalPoint", v)}
                      previewUrl={props.hostImageUrl}
                    />
                  ) : (
                    <p className="text-[11px] text-muted-foreground">No photo? A name still shows an initials disc.</p>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Name</Label>
                      <Input
                        value={props.hostName ?? ""}
                        onChange={(e) => set("hostName", e.target.value)}
                        className="h-8 text-xs"
                        placeholder="Alex Morgan"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Title</Label>
                      <Input
                        value={props.hostTitle ?? ""}
                        onChange={(e) => set("hostTitle", e.target.value)}
                        className="h-8 text-xs"
                        placeholder="VP, Enterprise Partnerships"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Short bio</Label>
                    <Textarea
                      value={props.hostBio ?? ""}
                      onChange={(e) => set("hostBio", e.target.value)}
                      rows={2}
                      className="text-xs"
                      placeholder="A decade helping multi-location groups roll out new platforms…"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Booking action</Label>
              <Select
                value={props.bookingMode ?? "button"}
                onValueChange={(v) => set("bookingMode", v as "button" | "form")}
              >
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="button">Big button (scheduler link)</SelectItem>
                  <SelectItem value="form">Embedded form</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(props.bookingMode ?? "button") === "button" ? (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Button label</Label>
                  <Input
                    value={props.ctaText ?? ""}
                    onChange={(e) => set("ctaText", e.target.value)}
                    className="h-8 text-xs"
                    placeholder="Book a meeting onsite"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Button URL</Label>
                  <Input
                    value={props.ctaUrl ?? ""}
                    onChange={(e) => set("ctaUrl", e.target.value)}
                    className="h-8 text-xs"
                    placeholder="https://calendar.google.com/…"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Input
                  value={props.formHeading ?? ""}
                  onChange={(e) => set("formHeading", e.target.value)}
                  className="h-8 text-xs"
                  placeholder="Request a time"
                />
                <Textarea
                  value={props.formSubheading ?? ""}
                  onChange={(e) => set("formSubheading", e.target.value)}
                  rows={2}
                  className="text-xs"
                  placeholder="Tell us when you're free — we'll confirm within the day."
                />
                <div className="space-y-1.5">
                  <Label className="text-xs">Form source</Label>
                  <Select
                    value={props.formMode ?? "native"}
                    onValueChange={(v) => set("formMode", v as "native" | "marketo")}
                  >
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="native">Linked global form</SelectItem>
                      <SelectItem value="marketo">Embed Marketo form</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {(props.formMode ?? "native") === "native" ? (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Linked global form</Label>
                    <Select
                      value={props.formId != null ? String(props.formId) : "__none__"}
                      onValueChange={(v) => set("formId", v === "__none__" ? undefined : parseInt(v, 10))}
                    >
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Pick a form" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— None —</SelectItem>
                        {forms.map((f) => (
                          <SelectItem key={f.id} value={String(f.id)}>{f.name} (#{f.id})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-muted-foreground">Manage forms in <span className="underline">/forms</span>. Submissions inherit Marketo / notification config from the global form.</p>
                  </div>
                ) : (
                  <div className="space-y-2 rounded-md border border-dashed p-2.5">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Marketo instance URL</Label>
                      <Input
                        value={props.marketoBaseUrl ?? ""}
                        onChange={(e) => set("marketoBaseUrl", e.target.value)}
                        className="h-8 text-xs font-mono"
                        placeholder="//app-XXX.marketo.com"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Munchkin ID</Label>
                      <Input
                        value={props.marketoMunchkinId ?? ""}
                        onChange={(e) => set("marketoMunchkinId", e.target.value)}
                        className="h-8 text-xs font-mono"
                        placeholder="123-ABC-456"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Marketo form ID</Label>
                      <Input
                        type="number"
                        value={props.marketoFormId != null ? String(props.marketoFormId) : ""}
                        onChange={(e) => {
                          const n = parseInt(e.target.value, 10);
                          set("marketoFormId", Number.isFinite(n) ? n : undefined);
                        }}
                        className="h-8 text-xs font-mono"
                        placeholder="1234"
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground">Find these in Marketo under Form Embed Code (the `loadForm` call shows base URL, Munchkin ID, and form ID).</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Button styling ---------------------------------------------------- */}
      <div className="space-y-3 border-t pt-4">
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Button style</Label>
        <div className="space-y-2 border rounded-md p-3">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Button colors</p>
          <div className="grid grid-cols-2 gap-2">
            <ColorField
              label="Background"
              value={props.ctaBgColor}
              onChange={(v) => set("ctaBgColor", v)}
            />
            <ColorField
              label="Text"
              value={props.ctaTextColor}
              onChange={(v) => set("ctaTextColor", v)}
            />
            <ColorField
              label="Hover background"
              value={props.ctaHoverBgColor}
              onChange={(v) => set("ctaHoverBgColor", v)}
            />
            <ColorField
              label="Hover text"
              value={props.ctaHoverTextColor}
              onChange={(v) => set("ctaHoverTextColor", v)}
            />
          </div>
          <p className="text-[11px] text-muted-foreground">Applies to every button on the page (nav, hero, booking). Empty fields fall back to your brand colors.</p>
        </div>
        <div className="space-y-2 border rounded-md p-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Premium drop shadow</Label>
            <Switch
              checked={props.ctaDropShadow ?? false}
              onCheckedChange={(v) => set("ctaDropShadow", v)}
            />
          </div>
          <ColorField
            label="Shadow color"
            value={props.ctaDropShadowColor}
            onChange={(v) => set("ctaDropShadowColor", v)}
          />
          <div className="space-y-1.5">
            <Label className="text-xs">
              Shadow intensity — {((props.ctaDropShadowIntensity ?? 1) * 100).toFixed(0)}%
            </Label>
            <Slider
              min={0}
              max={2}
              step={0.05}
              value={[props.ctaDropShadowIntensity ?? 1]}
              onValueChange={(v) => set("ctaDropShadowIntensity", v[0])}
            />
            <p className="text-[11px] text-muted-foreground">100% = original look. 0 hides the shadow; up to 200% boosts it.</p>
          </div>
        </div>
        <div className="space-y-2 border rounded-md p-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Animated shine</Label>
            <Switch
              checked={props.ctaShine ?? false}
              onCheckedChange={(v) => set("ctaShine", v)}
            />
          </div>
          {(props.ctaShine ?? false) && (
            <>
              <ColorField
                label="Shine color"
                value={props.ctaShineColor}
                onChange={(v) => set("ctaShineColor", v)}
              />
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Shine intensity — {((props.ctaShineIntensity ?? 1) * 100).toFixed(0)}%
                </Label>
                <Slider
                  min={0}
                  max={1}
                  step={0.05}
                  value={[props.ctaShineIntensity ?? 1]}
                  onValueChange={(v) => set("ctaShineIntensity", v[0])}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Footer ------------------------------------------------------------ */}
      <div className="space-y-3 border-t pt-4">
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Footer line</Label>
        <Input
          value={props.footerText ?? ""}
          onChange={(e) => set("footerText", e.target.value)}
          className="h-8 text-xs"
          placeholder="© 2026 · See you at the show"
        />
        <p className="text-[11px] text-muted-foreground">Hidden when empty.</p>
      </div>
    </div>
  );
}
