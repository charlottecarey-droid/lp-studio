import type { InviteStyleProps } from "@/lib/invite-theme";
import { ColorField } from "../BlockSettingsPanel";

export function InviteColorFields({ value, onChange }: { value: InviteStyleProps; onChange: (patch: Partial<InviteStyleProps>) => void }) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        <ColorField label="Surface" value={value.bgColor ?? ""} onChange={(v) => onChange({ bgColor: v || undefined })} />
        <ColorField label="Accent" value={value.accentColor ?? ""} onChange={(v) => onChange({ accentColor: v || undefined })} />
        <ColorField label="Text" value={value.textColor ?? ""} onChange={(v) => onChange({ textColor: v || undefined })} />
      </div>
      <p className="text-[10px] text-muted-foreground leading-relaxed">
        Blank = derived from the brand: the surface is the brand primary sunk toward black, the accent is the brand accent. Contrast is resolved automatically.
      </p>
    </div>
  );
}
