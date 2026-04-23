import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type {
  EmailCaptureConfig,
  BlockSubmitMode,
  BlockModalFormSource,
} from "@/lib/block-types";

interface Props {
  value: EmailCaptureConfig | undefined;
  onChange: (next: EmailCaptureConfig) => void;
}

/**
 * Shared editor section for the EmailCaptureConfig — used by Scroll Assembly,
 * Horizontal Showcase, and Sticky Stack so they all configure the same global
 * form / Marketo / Chili Piper modal flow as BlockDandyProductHero.
 */
export function EmailCaptureConfigSection({ value, onChange }: Props) {
  const cfg: EmailCaptureConfig = value ?? {};
  const submitMode: BlockSubmitMode = cfg.submitMode ?? "navigate";
  const formSource: BlockModalFormSource = cfg.modalFormSource ?? "simple";

  const set = (patch: Partial<EmailCaptureConfig>) => onChange({ ...cfg, ...patch });

  return (
    <div className="space-y-3 border rounded-lg p-3 bg-slate-50/50">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold">Form &amp; modal</Label>
        <span className="text-[10px] text-slate-500 uppercase tracking-wide">Email passthrough</span>
      </div>
      <p className="text-[11px] text-slate-500 leading-snug">
        When a user submits an inline email pill in this block, the email is
        passed through to whichever modal opens (Chili Piper / Marketo / global
        form / simple), or appended as <code>?email=</code> on navigation.
      </p>

      <div>
        <Label className="text-xs font-medium mb-1.5 block">On submit</Label>
        <Select value={submitMode} onValueChange={(v) => set({ submitMode: v as BlockSubmitMode })}>
          <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="navigate" className="text-xs">Navigate (append ?email=…)</SelectItem>
            <SelectItem value="modal-form" className="text-xs">Open modal form</SelectItem>
            <SelectItem value="modal-chilipiper" className="text-xs">Open Chili Piper modal</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {submitMode === "modal-chilipiper" && (
        <div>
          <Label className="text-xs font-medium mb-1.5 block">Chili Piper booking URL</Label>
          <Input
            value={cfg.modalChilipiperUrl ?? ""}
            onChange={(e) => set({ modalChilipiperUrl: e.target.value })}
            placeholder="https://meetings.chilipiper.com/router/your-router"
            className="h-9 text-xs"
          />
          <p className="text-[10px] text-slate-500 mt-1">
            The user's email is appended as <code>?email=…</code> when the iframe loads.
          </p>
        </div>
      )}

      {submitMode === "modal-form" && (
        <>
          <div>
            <Label className="text-xs font-medium mb-1.5 block">Form source</Label>
            <Select value={formSource} onValueChange={(v) => set({ modalFormSource: v as BlockModalFormSource })}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="simple" className="text-xs">Simple (built-in fields)</SelectItem>
                <SelectItem value="linked" className="text-xs">Linked global form</SelectItem>
                <SelectItem value="marketo" className="text-xs">Marketo embed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formSource === "linked" && (
            <div>
              <Label className="text-xs font-medium mb-1.5 block">Linked global form id</Label>
              <Input
                type="number"
                value={cfg.modalFormId ?? ""}
                onChange={(e) => set({ modalFormId: e.target.value === "" ? undefined : Number(e.target.value) })}
                placeholder="123"
                className="h-9 text-xs"
              />
            </div>
          )}

          {formSource === "marketo" && (
            <div className="space-y-2">
              <div>
                <Label className="text-xs font-medium mb-1.5 block">Marketo base URL</Label>
                <Input
                  value={cfg.modalMarketoBaseUrl ?? ""}
                  onChange={(e) => set({ modalMarketoBaseUrl: e.target.value })}
                  placeholder="//app-XXX.marketo.com"
                  className="h-9 text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs font-medium mb-1.5 block">Munchkin id</Label>
                  <Input
                    value={cfg.modalMarketoMunchkinId ?? ""}
                    onChange={(e) => set({ modalMarketoMunchkinId: e.target.value })}
                    placeholder="123-ABC-456"
                    className="h-9 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium mb-1.5 block">Form id</Label>
                  <Input
                    type="number"
                    value={cfg.modalMarketoFormId ?? ""}
                    onChange={(e) => set({ modalMarketoFormId: e.target.value === "" ? undefined : Number(e.target.value) })}
                    placeholder="1234"
                    className="h-9 text-xs"
                  />
                </div>
              </div>
            </div>
          )}

          {formSource === "simple" && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input type="checkbox" checked={cfg.modalShowFirstName !== false} onChange={(e) => set({ modalShowFirstName: e.target.checked })} className="rounded" />
                  First name
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input type="checkbox" checked={cfg.modalShowLastName !== false} onChange={(e) => set({ modalShowLastName: e.target.checked })} className="rounded" />
                  Last name
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input type="checkbox" checked={cfg.modalShowPhone !== false} onChange={(e) => set({ modalShowPhone: e.target.checked })} className="rounded" />
                  Phone
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input type="checkbox" checked={cfg.modalShowCompany === true} onChange={(e) => set({ modalShowCompany: e.target.checked })} className="rounded" />
                  Company
                </label>
              </div>
            </div>
          )}

          <div className="space-y-2 pt-1">
            <Input value={cfg.modalHeadline ?? ""} onChange={(e) => set({ modalHeadline: e.target.value })} placeholder="Modal headline" className="h-8 text-xs" />
            <Input value={cfg.modalSubheadline ?? ""} onChange={(e) => set({ modalSubheadline: e.target.value })} placeholder="Modal subheadline" className="h-8 text-xs" />
            <div className="grid grid-cols-2 gap-2">
              <Input value={cfg.modalSubmitText ?? ""} onChange={(e) => set({ modalSubmitText: e.target.value })} placeholder="Submit text" className="h-8 text-xs" />
              <Input value={cfg.modalSuccessMessage ?? ""} onChange={(e) => set({ modalSuccessMessage: e.target.value })} placeholder="Success message" className="h-8 text-xs" />
            </div>
            <Textarea
              value={cfg.modalDisclaimer ?? ""}
              onChange={(e) => set({ modalDisclaimer: e.target.value })}
              placeholder="Fine-print disclaimer (optional)"
              rows={2}
              className="text-xs resize-none"
            />
          </div>
        </>
      )}
    </div>
  );
}
