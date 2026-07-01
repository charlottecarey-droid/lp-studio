import type { AboutTeamBlockProps, AboutTeamMember } from "@/lib/block-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AiTextField } from "@/components/AiTextField";
import { suggestCopy } from "@/lib/copy-api";
import { ImagePicker } from "@/components/ImagePicker";
import { FontSelect } from "@/components/FontSelect";
import { ColorField } from "./BlockSettingsPanel";
import { SectionBackgroundControl } from "./SectionBackgroundControl";
import { Plus, Trash2 } from "lucide-react";

interface Props {
  props: AboutTeamBlockProps;
  onChange: (props: AboutTeamBlockProps) => void;
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
      {children}
    </Label>
  );
}

const SHAPE_OPTIONS: { value: "circle" | "rounded" | "square"; label: string }[] = [
  { value: "circle", label: "Circle" },
  { value: "rounded", label: "Rounded" },
  { value: "square", label: "Square" },
];

export function AboutTeamPanel({ props, onChange }: Props) {
  const members = props.members ?? [];
  const avatarSize = typeof props.avatarSize === "number" ? props.avatarSize : 72;
  const cornerRadius =
    typeof props.cornerRadius === "number" ? props.cornerRadius : 24;

  const updateMember = (i: number, patch: Partial<AboutTeamMember>) =>
    onChange({
      ...props,
      members: members.map((m, idx) => (idx === i ? { ...m, ...patch } : m)),
    });
  const addMember = () =>
    onChange({
      ...props,
      members: [...members, { name: "New Person", role: "Role" }],
    });
  const removeMember = (i: number) =>
    onChange({ ...props, members: members.filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <Heading>Header</Heading>
        <div className="flex items-center justify-between border rounded-lg p-3 bg-slate-50">
          <Label className="text-xs text-slate-600 cursor-pointer">Show header</Label>
          <Switch
            checked={props.showHeader ?? members.length > 1}
            onCheckedChange={(v) => onChange({ ...props, showHeader: v })}
          />
        </div>
        <AiTextField
          type="input"
          placeholder="Eyebrow (e.g. Our team)"
          value={props.eyebrow ?? ""}
          onChange={(v) => onChange({ ...props, eyebrow: v })}
          onSuggest={() => suggestCopy("about-team", "eyebrow", props.eyebrow ?? "")}
          fieldLabel="Eyebrow"
        />
        <AiTextField
          type="input"
          placeholder="Headline"
          value={props.headline ?? ""}
          onChange={(v) => onChange({ ...props, headline: v })}
          onSuggest={() => suggestCopy("about-team", "headline", props.headline ?? "")}
          fieldLabel="Headline"
        />
        <AiTextField
          type="textarea"
          placeholder="Subheadline"
          value={props.subheadline ?? ""}
          onChange={(v) => onChange({ ...props, subheadline: v })}
          onSuggest={() =>
            suggestCopy("about-team", "subheadline", props.subheadline ?? "")
          }
          fieldLabel="Subheadline"
        />
      </div>

      <div className="space-y-3">
        <Heading>Photo shape &amp; size</Heading>
        <div>
          <Label className="text-xs text-muted-foreground mb-1.5 block">
            Main portrait shape
          </Label>
          <Select
            value={props.mainImageShape ?? "rounded"}
            onValueChange={(v) =>
              onChange({ ...props, mainImageShape: v as AboutTeamBlockProps["mainImageShape"] })
            }
          >
            <SelectTrigger className="text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SHAPE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1.5 block">
            Roster avatar shape
          </Label>
          <Select
            value={props.avatarShape ?? "circle"}
            onValueChange={(v) =>
              onChange({ ...props, avatarShape: v as AboutTeamBlockProps["avatarShape"] })
            }
          >
            <SelectTrigger className="text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SHAPE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1.5 flex items-center justify-between">
            <span>Roster avatar size</span>
            <span className="text-slate-400">{avatarSize}px</span>
          </Label>
          <Slider
            min={48}
            max={120}
            step={4}
            value={[avatarSize]}
            onValueChange={([v]) => onChange({ ...props, avatarSize: v })}
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1.5 flex items-center justify-between">
            <span>Corner radius (rounded shapes)</span>
            <span className="text-slate-400">{cornerRadius}px</span>
          </Label>
          <Slider
            min={0}
            max={48}
            step={2}
            value={[cornerRadius]}
            onValueChange={([v]) => onChange({ ...props, cornerRadius: v })}
          />
        </div>
      </div>

      <div className="space-y-3">
        <Heading>Colors (defaults to brand)</Heading>
        <SectionBackgroundControl
          backgroundStyle={props.backgroundStyle}
          bgColor={props.bgColor}
          defaultBgColor="#ffffff"
          onChange={(patch) => onChange({ ...props, ...patch })}
        />
        <ColorField
          label="Text"
          value={props.textColor}
          onChange={(v) => onChange({ ...props, textColor: v })}
        />
        <ColorField
          label="Accent"
          value={props.accentColor}
          onChange={(v) => onChange({ ...props, accentColor: v })}
        />
      </div>

      <div className="space-y-3">
        <Heading>Fonts (defaults to brand)</Heading>
        <div>
          <Label className="text-xs text-muted-foreground mb-1.5 block">Name / headline font</Label>
          <FontSelect
            value={props.headlineFont}
            onChange={(v) => onChange({ ...props, headlineFont: v })}
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1.5 block">Body font</Label>
          <FontSelect
            value={props.bodyFont}
            onChange={(v) => onChange({ ...props, bodyFont: v })}
          />
        </div>
      </div>

      <div className="space-y-3">
        <Heading>People</Heading>
        {members.map((m, i) => (
          <div key={i} className="space-y-2 rounded-lg border p-3">
            <div className="flex gap-2 items-center">
              <Input
                placeholder="Name"
                value={m.name ?? ""}
                onChange={(e) => updateMember(i, { name: e.target.value })}
                className="text-sm"
              />
              <Button
                size="icon"
                variant="ghost"
                className="text-muted-foreground hover:text-red-500 shrink-0"
                onClick={() => removeMember(i)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
            <Input
              placeholder="Role (e.g. Founder & CEO)"
              value={m.role ?? ""}
              onChange={(e) => updateMember(i, { role: e.target.value })}
              className="text-sm"
            />
            <ImagePicker
              label="Photo (upload a real headshot)"
              value={m.photo ?? ""}
              onChange={(url) => updateMember(i, { photo: url })}
              allowAiGenerate={false}
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="Location"
                value={m.location ?? ""}
                onChange={(e) => updateMember(i, { location: e.target.value })}
                className="text-sm"
              />
              <Input
                placeholder="Focus"
                value={m.focus ?? ""}
                onChange={(e) => updateMember(i, { focus: e.target.value })}
                className="text-sm"
              />
            </div>
            <Textarea
              placeholder="Short bio"
              value={m.bio ?? ""}
              onChange={(e) => updateMember(i, { bio: e.target.value })}
              className="text-sm min-h-[72px]"
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="LinkedIn URL"
                value={m.linkedinUrl ?? ""}
                onChange={(e) => updateMember(i, { linkedinUrl: e.target.value })}
                className="text-sm"
              />
              <Input
                placeholder="Email"
                value={m.email ?? ""}
                onChange={(e) => updateMember(i, { email: e.target.value })}
                className="text-sm"
              />
            </div>
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-1.5 text-xs"
          onClick={addMember}
        >
          <Plus className="w-3.5 h-3.5" /> Add Person
        </Button>
      </div>
    </div>
  );
}
