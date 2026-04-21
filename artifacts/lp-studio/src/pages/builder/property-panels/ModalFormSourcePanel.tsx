import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
const API_BASE = "/api";

type GlobalFormSummary = { id: number; name: string };

export interface ModalFormSourceProps {
  modalFormSource?: "simple" | "linked" | "marketo";
  modalFormId?: number;
  modalMarketoBaseUrl?: string;
  modalMarketoMunchkinId?: string;
  modalMarketoFormId?: number;
}

interface Props {
  value: ModalFormSourceProps;
  onChange: (next: ModalFormSourceProps) => void;
}

export function ModalFormSourcePanel({ value, onChange }: Props) {
  const [globalForms, setGlobalForms] = useState<GlobalFormSummary[]>([]);
  const source = value.modalFormSource ?? "simple";

  useEffect(() => {
    if (source !== "linked") return;
    fetch(`${API_BASE}/lp/forms`)
      .then(r => r.ok ? r.json() : [])
      .then((data: GlobalFormSummary[]) => setGlobalForms(Array.isArray(data) ? data : []))
      .catch(() => setGlobalForms([]));
  }, [source]);

  const set = <K extends keyof ModalFormSourceProps>(k: K, v: ModalFormSourceProps[K]) =>
    onChange({ ...value, [k]: v });

  return (
    <div className="space-y-2 pb-2 mb-2 border-b border-dashed">
      <Label className="text-xs">Form source</Label>
      <Select
        value={source}
        onValueChange={v => set("modalFormSource", v as ModalFormSourceProps["modalFormSource"])}
      >
        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="simple" className="text-xs">Simple (built-in fields)</SelectItem>
          <SelectItem value="linked" className="text-xs">Linked global form</SelectItem>
          <SelectItem value="marketo" className="text-xs">Marketo embed</SelectItem>
        </SelectContent>
      </Select>
      <p className="text-[10px] text-muted-foreground">
        {source === "linked" && "Renders a real form from your Forms library — full field types, validation, and notifications."}
        {source === "marketo" && "Embeds a Marketo form. Email is pre-filled from the CTA pill."}
        {source === "simple" && "Lightweight email/name capture using the toggles below."}
      </p>

      {source === "linked" && (
        <div className="space-y-1.5">
          <Label className="text-xs">Linked form</Label>
          <Select
            value={value.modalFormId != null ? String(value.modalFormId) : "__none__"}
            onValueChange={v => set("modalFormId", v === "__none__" ? undefined : parseInt(v, 10))}
          >
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Pick a form…" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__" className="text-xs">— Pick a form —</SelectItem>
              {globalForms.map(f => (
                <SelectItem key={f.id} value={String(f.id)} className="text-xs">{f.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <a href="/forms" target="_blank" rel="noopener noreferrer" className="text-[10px] text-muted-foreground underline">
            Manage forms →
          </a>
        </div>
      )}

      {source === "marketo" && (
        <div className="space-y-1.5 rounded-md border bg-background p-2">
          <div>
            <Label className="text-xs">Marketo Instance URL</Label>
            <Input
              value={value.modalMarketoBaseUrl ?? ""}
              onChange={e => set("modalMarketoBaseUrl", e.target.value || undefined)}
              placeholder="//app-XXX.marketo.com"
              className="h-8 text-xs font-mono"
            />
          </div>
          <div>
            <Label className="text-xs">Munchkin ID</Label>
            <Input
              value={value.modalMarketoMunchkinId ?? ""}
              onChange={e => set("modalMarketoMunchkinId", e.target.value || undefined)}
              placeholder="123-ABC-456"
              className="h-8 text-xs font-mono"
            />
          </div>
          <div>
            <Label className="text-xs">Form ID</Label>
            <Input
              type="number"
              value={value.modalMarketoFormId ?? ""}
              onChange={e => set("modalMarketoFormId", e.target.value ? Number(e.target.value) : undefined)}
              placeholder="1234"
              className="h-8 text-xs font-mono"
            />
          </div>
        </div>
      )}
    </div>
  );
}
