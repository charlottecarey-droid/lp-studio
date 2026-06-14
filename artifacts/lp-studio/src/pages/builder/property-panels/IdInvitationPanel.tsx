import type { IdInvitationBlockProps, IdInvitationMeta } from "@/lib/block-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";
import { CtaButtonModalConfigSection } from "./CtaButtonModalConfigSection";
import { CtaActionConfigSection } from "./CtaActionConfigSection";
import { CtaSecondaryConfigSection } from "./CtaSecondaryConfigSection";
import { readPrimarySuite, writePrimarySuite, readSecondary, writeSecondary, type PrimaryKeyMap, type SecondaryKeyMap } from "@/lib/cta/ctaKeyMap";
import type { CtaSourceProps } from "@/lib/cta/ctaSource";

/** This block stores its CTAs under cta1* / cta2* names; map them to the canonical
 *  shape the shared sections operate on. Action values already match IdCtaAction. */
const ID_INVITATION_CTA_ACTIONS = ["url", "chilipiper", "modal-form", "modal-chilipiper", "video-modal"] as const;
const ID_INVITATION_PRIMARY_MAP: PrimaryKeyMap = {
  action: "cta1Action",
  url: "cta1Url",
  chilipiper: "cta1ChilipiperUrl",
  video: "cta1VideoUrl",
};
const ID_INVITATION_SECONDARY_MAP: SecondaryKeyMap = {
  text: "cta2Text",
  action: "cta2Action",
  url: "cta2Url",
  chilipiper: "cta2ChilipiperUrl",
  video: "cta2VideoUrl",
};

interface Props {
  props: IdInvitationBlockProps;
  onChange: (props: IdInvitationBlockProps) => void;
  /** CTA source indicator + inherit/override controls (Phase 2). */
  ctaSource?: CtaSourceProps;
}

export function IdInvitationPanel({ props, onChange, ctaSource }: Props) {
  const u = (patch: Partial<IdInvitationBlockProps>) => onChange({ ...props, ...patch });
  const meta = props.meta ?? [];
  const setMeta = (next: IdInvitationMeta[]) => u({ meta: next });
  const cta1Action = props.cta1Action ?? "url";
  const cta2Action = props.cta2Action ?? "url";
  const anyModal =
    cta1Action === "modal-form" || cta1Action === "modal-chilipiper" ||
    cta2Action === "modal-form" || cta2Action === "modal-chilipiper";

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Headline</div>
        <Input placeholder="Eyebrow" value={props.eyebrow ?? ""} onChange={(e) => u({ eyebrow: e.target.value })} className="h-8 text-xs" />
        <Input placeholder="Headline (use <em>)" value={props.headline ?? ""} onChange={(e) => u({ headline: e.target.value })} className="h-8 text-xs font-mono" />
        <Textarea placeholder="Blurb" value={props.blurb ?? ""} onChange={(e) => u({ blurb: e.target.value })} rows={3} className="text-xs" />
      </div>
      <div className="space-y-2">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">CTAs</div>
        <div className="border rounded-md p-3 space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Primary CTA</div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Button text</Label>
            <Input value={props.cta1Text ?? ""} onChange={(e) => u({ cta1Text: e.target.value })} className="h-8 text-xs" />
          </div>
          {/* Shared primary action suite (mapped to cta1* keys); single shared modal block below. */}
          <CtaActionConfigSection
            value={readPrimarySuite(props, ID_INVITATION_PRIMARY_MAP)}
            onChange={(v) => onChange(writePrimarySuite(props, v, ID_INVITATION_PRIMARY_MAP) as IdInvitationBlockProps)}
            allowedActions={ID_INVITATION_CTA_ACTIONS}
            hideModalConfig
            {...ctaSource}
          />
        </div>
        {/* Shared secondary section, mapped to this block's cta2* keys. */}
        <CtaSecondaryConfigSection
          value={readSecondary(props, ID_INVITATION_SECONDARY_MAP)}
          onChange={(v) => onChange(writeSecondary(props, v, ID_INVITATION_SECONDARY_MAP) as IdInvitationBlockProps)}
          allowedActions={ID_INVITATION_CTA_ACTIONS}
        />
        {anyModal && (
          <CtaButtonModalConfigSection
            ctaAction={
              (cta1Action === "modal-chilipiper" || cta2Action === "modal-chilipiper")
                ? "modal-chilipiper"
                : "modal-form"
            }
            value={props}
            onChange={(next) => onChange({ ...props, ...next })}
          />
        )}
      </div>
      <div className="space-y-2">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Meta row</div>
        {meta.map((m, i) => (
          <div key={i} className="border rounded-md p-2 space-y-2">
            <div className="flex justify-between items-center">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Item {i + 1}</div>
              <Button size="sm" variant="ghost" onClick={() => setMeta(meta.filter((_, idx) => idx !== i))}><X className="w-3 h-3" /></Button>
            </div>
            <Input placeholder="Heading (e.g. Q1)" value={m.heading ?? ""} onChange={(e) => setMeta(meta.map((mm, idx) => idx === i ? { ...mm, heading: e.target.value } : mm))} className="h-8 text-xs" />
            <Input placeholder="Text (e.g. Feb 12–13)" value={m.text ?? ""} onChange={(e) => setMeta(meta.map((mm, idx) => idx === i ? { ...mm, text: e.target.value } : mm))} className="h-8 text-xs" />
          </div>
        ))}
        <Button size="sm" variant="outline" onClick={() => setMeta([...meta, { heading: "", text: "" }])}>
          <Plus className="w-3 h-3 mr-1" /> Add meta item
        </Button>
      </div>
    </div>
  );
}
