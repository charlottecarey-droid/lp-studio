import { useState } from "react";
import { Trash2, Plus, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AiTextField } from "@/components/AiTextField";
import { LibraryPicker } from "@/components/LibraryPicker";
import { suggestCopy } from "@/lib/copy-api";
import type { PageBlock, CtaMode } from "@/lib/block-types";
import { BG_OPTIONS, type BackgroundStyle } from "@/lib/bg-styles";

interface DsoMeetTeamPanelProps {
  block: PageBlock & { type: "dso-meet-team" };
  onChange: (block: PageBlock) => void;
  brandVoiceSet?: boolean;
}

export function DsoMeetTeamPanel({ block, onChange, brandVoiceSet }: DsoMeetTeamPanelProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const p = block.props;
  const members = p.members ?? [];

  const updateMember = (i: number, patch: Partial<typeof members[0]>) => {
    const next = members.map((m, idx) => idx === i ? { ...m, ...patch } : m);
    onChange({ ...block, props: { ...p, members: next } });
  };
  const addMember = () => onChange({ ...block, props: { ...p, members: [...members, { name: "", role: "", email: "", calendlyUrl: "" }] } });
  const removeMember = (i: number) => onChange({ ...block, props: { ...p, members: members.filter((_, idx) => idx !== i) } });

  const handleLibrarySelect = (items: Record<string, unknown>[]) => {
    const newMembers = items.map(c => ({
      name: String(c.name ?? ""),
      role: String(c.role ?? ""),
      email: String(c.email ?? ""),
      calendlyUrl: String(c.calendlyUrl ?? ""),
      photo: c.photo ? String(c.photo) : undefined,
    }));
    onChange({ ...block, props: { ...p, members: [...members, ...newMembers] } });
  };

  return (
    <div className="space-y-4 p-4">
      <div className="space-y-1.5">
        <Label className="text-xs">Eyebrow</Label>
        <AiTextField type="input" value={p.eyebrow ?? ""} onChange={v => onChange({ ...block, props: { ...p, eyebrow: v } })} fieldLabel="Eyebrow" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "eyebrow", p.eyebrow ?? "", { headline: p.headline ?? "" })} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Headline</Label>
        <AiTextField type="input" value={p.headline ?? ""} onChange={v => onChange({ ...block, props: { ...p, headline: v } })} fieldLabel="Headline" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "headline", p.headline ?? "", { eyebrow: p.eyebrow ?? "" })} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Subheadline</Label>
        <AiTextField type="textarea" rows={2} value={p.subheadline ?? ""} onChange={v => onChange({ ...block, props: { ...p, subheadline: v } })} fieldLabel="Subheadline" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "subheadline", p.subheadline ?? "", { headline: p.headline ?? "" })} />
      </div>
      <div className="border-t pt-3 space-y-1.5">
        <Label className="text-xs">Section CTA Text</Label>
        <AiTextField type="input" value={p.ctaText ?? ""} onChange={v => onChange({ ...block, props: { ...p, ctaText: v || undefined } })} placeholder="Book a Meeting" fieldLabel="CTA" brandVoiceSet={brandVoiceSet} onSuggest={() => suggestCopy(block.type, "ctaText", p.ctaText ?? "", { headline: p.headline ?? "" })} />
      </div>
      <div className="space-y-1.5"><Label className="text-xs">Section CTA URL</Label><Input value={p.ctaUrl ?? ""} onChange={e => onChange({ ...block, props: { ...p, ctaUrl: e.target.value || undefined } })} placeholder="https://..." className="h-8 text-xs" /></div>
      <div className="space-y-1.5"><Label className="text-xs">Section CTA Mode</Label><Select value={p.ctaMode ?? "link"} onValueChange={v => onChange({ ...block, props: { ...p, ctaMode: v as CtaMode } })}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="link" className="text-xs">Link / Redirect</SelectItem><SelectItem value="chilipiper" className="text-xs">Chili Piper (popup)</SelectItem></SelectContent></Select></div>
      <div className="space-y-1.5"><Label className="text-xs">Section CTA Style</Label><Select value={p.ctaVariant ?? "primary"} onValueChange={v => onChange({ ...block, props: { ...p, ctaVariant: v as "primary" | "secondary" | "link" } })}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="primary" className="text-xs">Primary</SelectItem><SelectItem value="secondary" className="text-xs">Outline</SelectItem><SelectItem value="link" className="text-xs">Link →</SelectItem></SelectContent></Select></div>
      <div className="space-y-1.5"><Label className="text-xs">Background</Label><Select value={p.backgroundStyle ?? "dark"} onValueChange={v => onChange({ ...block, props: { ...p, backgroundStyle: v as BackgroundStyle } })}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent>{BG_OPTIONS.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent></Select></div>

      <div className="border-t pt-3">
        <div className="flex items-center justify-between mb-2">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Team Members</Label>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={() => setPickerOpen(true)} className="h-7 text-xs gap-1">
              <BookOpen className="w-3 h-3" /> Browse
            </Button>
            <Button variant="ghost" size="sm" onClick={addMember} className="h-7 text-xs gap-1">
              <Plus className="w-3 h-3" /> Add
            </Button>
          </div>
        </div>
        <div className="space-y-3">
          {members.map((m, i) => (
            <div key={i} className="border rounded-lg p-3 space-y-2 bg-slate-50">
              <div className="flex items-center justify-between"><span className="text-xs font-medium text-slate-500">Member {i + 1}</span><button onClick={() => removeMember(i)} className="text-slate-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button></div>
              <Input value={m.name} onChange={e => updateMember(i, { name: e.target.value })} placeholder="Name" className="h-8 text-xs" />
              <Input value={m.role} onChange={e => updateMember(i, { role: e.target.value })} placeholder="Role / Title" className="h-8 text-xs" />
              <Input value={m.email ?? ""} onChange={e => updateMember(i, { email: e.target.value })} placeholder="email@meetdandy.com" className="h-8 text-xs" />
              <Input value={m.photo ?? ""} onChange={e => updateMember(i, { photo: e.target.value })} placeholder="Photo URL (optional)" className="h-8 text-xs" />
              <Input value={m.calendlyUrl ?? ""} onChange={e => updateMember(i, { calendlyUrl: e.target.value })} placeholder="Calendly / booking URL" className="h-8 text-xs" />
            </div>
          ))}
        </div>
      </div>

      <LibraryPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        type="team_member"
        title="Sales Reps Library"
        onSelect={handleLibrarySelect}
        renderPreview={item => {
          const c = item.content as { role?: string; email?: string };
          return (
            <div className="text-xs text-muted-foreground">
              {c.role && <span className="font-medium text-foreground/70">{c.role}</span>}
              {c.role && c.email && <span className="mx-1">·</span>}
              {c.email && <span>{c.email}</span>}
            </div>
          );
        }}
      />
    </div>
  );
}
