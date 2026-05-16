import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { CtaModalConfig } from "@/lib/block-types";

interface GlobalFormSummary {
  id: number;
  name: string;
}

interface Props {
  /** Currently selected ctaAction so the panel knows which fields to show. */
  ctaAction: "modal-form" | "modal-chilipiper";
  /** The CtaModalConfig fields plus the existing chilipiperUrl (passthrough). */
  value: CtaModalConfig;
  onChange: (next: CtaModalConfig) => void;
}

/**
 * Shared editor section for the per-button modal config (CtaModalConfig).
 * Mirrors EmailCaptureConfigSection but is meant to be embedded inside any
 * block panel that exposes a "modal-form" / "modal-chilipiper" ctaAction
 * (i.e. the regular CTA-button path, not the inline email-pill path).
 *
 * The parent panel owns the ctaAction <Select> so it can present the full
 * action-mode list (url / chilipiper / modal-form / modal-chilipiper) in a
 * single dropdown — this section only renders the modal-specific fields.
 */
export function CtaButtonModalConfigSection({ ctaAction, value, onChange }: Props) {
  const cfg = value;
  const formSource = cfg.modalFormSource ?? "simple";

  const set = (patch: Partial<CtaModalConfig>) => onChange({ ...cfg, ...patch });

  const [globalForms, setGlobalForms] = useState<GlobalFormSummary[]>([]);
  useEffect(() => {
    fetch("/api/lp/forms")
      .then(r => r.json())
      .then((data: GlobalFormSummary[]) => setGlobalForms(data))
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-3 border rounded-lg p-3 bg-slate-50/50">
      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
        Modal contents
      </Label>

      {ctaAction === "modal-chilipiper" && (
        <div>
          <Label className="text-[11px] font-medium mb-1.5 block">Chili Piper booking URL</Label>
          <Input
            value={cfg.modalChilipiperUrl ?? ""}
            onChange={(e) => set({ modalChilipiperUrl: e.target.value })}
            placeholder="https://meetdandy.chilipiper.com/router/your-router"
            className="h-9 text-xs font-mono"
          />
          <p className="text-[10px] text-muted-foreground mt-1">
            Visitor enters their email in the modal first, then is handed off to this Chili Piper router.
          </p>
        </div>
      )}

      {ctaAction === "modal-form" && (
        <>
          <div>
            <Label className="text-[11px] font-medium mb-1.5 block">Form source</Label>
            <Select value={formSource} onValueChange={(v) => set({ modalFormSource: v as "simple" | "linked" | "marketo" })}>
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
              <Label className="text-[11px] font-medium mb-1.5 block">Linked global form</Label>
              <Select
                value={cfg.modalFormId != null ? String(cfg.modalFormId) : "__none__"}
                onValueChange={(v) =>
                  set({ modalFormId: v === "__none__" ? undefined : Number(v) })
                }
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Select a form…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__" className="text-xs">— None selected —</SelectItem>
                  {globalForms.map((f) => (
                    <SelectItem key={f.id} value={String(f.id)} className="text-xs">
                      {f.name}{" "}
                      <span className="text-muted-foreground">(#{f.id})</span>
                    </SelectItem>
                  ))}
                  {cfg.modalFormId != null && !globalForms.some(f => f.id === cfg.modalFormId) && (
                    <SelectItem value={String(cfg.modalFormId)} className="text-xs">
                      Form #{cfg.modalFormId} (not found)
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground mt-1">
                Reuses any global form (Marketo, native, etc.). Manage forms in the{" "}
                <a href="/forms" target="_blank" rel="noopener noreferrer" className="underline">Forms library</a>.
                If the form has a Chili Piper handoff configured, the modal swaps to the scheduler iframe after submit.
              </p>
            </div>
          )}

          {formSource === "marketo" && (
            <div className="space-y-2">
              <div>
                <Label className="text-[11px] font-medium mb-1.5 block">Marketo base URL</Label>
                <Input
                  value={cfg.modalMarketoBaseUrl ?? ""}
                  onChange={(e) => set({ modalMarketoBaseUrl: e.target.value })}
                  placeholder="//app-XXX.marketo.com"
                  className="h-9 text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[11px] font-medium mb-1.5 block">Munchkin id</Label>
                  <Input
                    value={cfg.modalMarketoMunchkinId ?? ""}
                    onChange={(e) => set({ modalMarketoMunchkinId: e.target.value })}
                    placeholder="123-ABC-456"
                    className="h-9 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-[11px] font-medium mb-1.5 block">Form id</Label>
                  <Input
                    type="number"
                    value={cfg.modalMarketoFormId ?? ""}
                    onChange={(e) => set({ modalMarketoFormId: e.target.value === "" ? undefined : Number(e.target.value) })}
                    placeholder="1234"
                    className="h-9 text-xs"
                  />
                </div>
              </div>
              <div className="border-t border-slate-200 pt-2 mt-2 space-y-2">
                <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                  Chili Piper hand-off (after submit)
                </Label>
                <div>
                  <Label className="text-[11px] font-medium mb-1.5 block">Chili Piper URL</Label>
                  <Input
                    value={cfg.modalChiliPiperHandoffUrl ?? ""}
                    onChange={(e) => set({ modalChiliPiperHandoffUrl: e.target.value })}
                    placeholder="https://meetdandy.chilipiper.com/router/your-router"
                    className="h-9 text-xs font-mono"
                  />
                </div>
                <div>
                  <Label className="text-[11px] font-medium mb-1.5 block">Mode</Label>
                  <Select
                    value={cfg.modalChiliPiperHandoffMode ?? "modal"}
                    onValueChange={(v) => set({ modalChiliPiperHandoffMode: v as "modal" | "redirect" })}
                  >
                    <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="modal" className="text-xs">Modal (in-page iframe)</SelectItem>
                      <SelectItem value="redirect" className="text-xs">Redirect (open in new tab)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  After the visitor submits the Marketo form, they're handed off to this Chili Piper
                  router with their first/last name, email, phone, and company prefilled. Leave blank
                  to skip the hand-off.
                </p>
              </div>
            </div>
          )}

          {formSource === "simple" && (
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
