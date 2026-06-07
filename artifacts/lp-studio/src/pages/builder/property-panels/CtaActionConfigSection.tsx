import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { VideoPicker } from "@/components/VideoPicker";
import { ImagePicker } from "@/components/ImagePicker";
import type { CtaSuiteFields } from "@/lib/cta-modal";
import { CtaButtonModalConfigSection } from "./CtaButtonModalConfigSection";

interface Props {
  value: CtaSuiteFields;
  onChange: (next: CtaSuiteFields) => void;
}

/**
 * Shared editor for the full CTA-button action suite (action mode + per-action
 * destination + modal config). Reused by every CTA-bearing block panel. The
 * button LABEL is owned by the parent panel (labels differ across blocks).
 */
export function CtaActionConfigSection({ value, onChange }: Props) {
  const action = value.ctaAction ?? "url";
  const set = (patch: Partial<CtaSuiteFields>) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-[11px] text-muted-foreground">Button action</Label>
        <Select value={action} onValueChange={(v) => set({ ctaAction: v as CtaSuiteFields["ctaAction"] })}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="url" className="text-xs">Link to URL</SelectItem>
            <SelectItem value="chilipiper" className="text-xs">Chili Piper popup</SelectItem>
            <SelectItem value="modal-form" className="text-xs">Open form modal</SelectItem>
            <SelectItem value="modal-chilipiper" className="text-xs">Open email → Chili Piper modal</SelectItem>
            <SelectItem value="video-modal" className="text-xs">Open video modal</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {action === "url" && (
        <div>
          <Label className="text-[11px] text-muted-foreground">Destination URL</Label>
          <Input value={value.ctaUrl ?? ""} onChange={(e) => set({ ctaUrl: e.target.value })} placeholder="#" className="h-8 text-xs font-mono" />
        </div>
      )}

      {action === "chilipiper" && (
        <div>
          <Label className="text-[11px] text-muted-foreground">Chili Piper URL</Label>
          <Input value={value.chilipiperUrl ?? ""} onChange={(e) => set({ chilipiperUrl: e.target.value })} placeholder="https://yourcompany.chilipiper.com/router/your-router" className="h-8 text-xs font-mono" />
        </div>
      )}

      {action === "video-modal" && (
        <div className="space-y-2">
          <VideoPicker label="Video" value={value.videoUrl ?? ""} onChange={(v) => set({ videoUrl: v })} />
          <ImagePicker label="Video poster (optional)" value={value.videoPosterUrl ?? ""} onChange={(v) => set({ videoPosterUrl: v })} aiHint="video poster frame" />
        </div>
      )}

      {(action === "modal-form" || action === "modal-chilipiper") && (
        <CtaButtonModalConfigSection
          ctaAction={action}
          value={value}
          onChange={(cfg) => onChange({ ...value, ...cfg })}
        />
      )}
    </div>
  );
}
