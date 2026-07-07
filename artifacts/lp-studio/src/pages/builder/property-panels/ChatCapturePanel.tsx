import { useState, useEffect } from "react";
import { Link2, Link2Off, X } from "lucide-react";
import type { ChatCaptureBlockProps } from "@/lib/block-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BrandSwatches } from "@/components/BrandSwatches";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

const API_BASE = "/api";

const LABEL_CLS = "text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block";

interface GlobalFormSummary {
  id: number;
  name: string;
}

interface Props {
  props: ChatCaptureBlockProps;
  onChange: (props: ChatCaptureBlockProps) => void;
}

export function ChatCapturePanel({ props, onChange }: Props) {
  const set = <K extends keyof ChatCaptureBlockProps>(k: K, v: ChatCaptureBlockProps[K]) =>
    onChange({ ...props, [k]: v });

  const [globalForms, setGlobalForms] = useState<GlobalFormSummary[]>([]);
  useEffect(() => {
    fetch(`${API_BASE}/lp/forms`).then(r => r.json()).then((data: GlobalFormSummary[]) => setGlobalForms(data)).catch(() => {});
  }, []);
  const linkedForm = globalForms.find(f => f.id === props.formId);

  // Edited as free text and committed on blur (like the select-options editor
  // in FormPanel) so typing blank lines doesn't fight the split/filter.
  const [questionsText, setQuestionsText] = useState(() => (props.qualifyingQuestions ?? []).join("\n"));
  useEffect(() => {
    setQuestionsText((props.qualifyingQuestions ?? []).join("\n"));
  }, [props.qualifyingQuestions]);

  return (
    <div className="space-y-4">
      <div>
        <Label className={LABEL_CLS}>Bot Name</Label>
        <Input value={props.botName} onChange={e => set("botName", e.target.value)} className="text-sm" placeholder="Assistant" />
      </div>
      <div>
        <Label className={LABEL_CLS}>Welcome Message</Label>
        <Textarea
          value={props.welcomeMessage}
          onChange={e => set("welcomeMessage", e.target.value)}
          className="text-sm"
          rows={2}
        />
        <p className="text-xs text-muted-foreground mt-1">First message shown when a visitor opens the chat.</p>
      </div>
      <div>
        <Label className={LABEL_CLS}>Launcher Label (optional)</Label>
        <Input
          value={props.launcherLabel ?? ""}
          onChange={e => set("launcherLabel", e.target.value)}
          className="text-sm"
          placeholder="Chat with us"
        />
        <p className="text-xs text-muted-foreground mt-1">Shown next to the launcher bubble. Leave empty for icon only.</p>
      </div>

      <div className="border-t pt-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Lead Details</p>
        <p className="text-xs text-muted-foreground mb-3">Email is always collected. Toggle which extra fields the bot works toward.</p>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className={LABEL_CLS + " !mb-0"}>Collect Name</Label>
            <Switch checked={!!props.collectName} onCheckedChange={v => set("collectName", v)} />
          </div>
          <div className="flex items-center justify-between">
            <Label className={LABEL_CLS + " !mb-0"}>Collect Company</Label>
            <Switch checked={!!props.collectCompany} onCheckedChange={v => set("collectCompany", v)} />
          </div>
          <div className="flex items-center justify-between">
            <Label className={LABEL_CLS + " !mb-0"}>Collect Phone</Label>
            <Switch checked={!!props.collectPhone} onCheckedChange={v => set("collectPhone", v)} />
          </div>
        </div>
      </div>

      <div>
        <Label className={LABEL_CLS}>Qualifying Questions (one per line)</Label>
        <Textarea
          value={questionsText}
          onChange={e => setQuestionsText(e.target.value)}
          onBlur={() => set("qualifyingQuestions", questionsText.split("\n").map(q => q.trim()).filter(Boolean))}
          rows={4}
          className="text-sm"
          placeholder={"What are you looking to solve?\nHow big is your team?"}
        />
        <p className="text-xs text-muted-foreground mt-1">The bot weaves these in to qualify the visitor, one per turn.</p>
      </div>

      <div>
        <Label className={LABEL_CLS}>Global Form</Label>
        <p className="text-xs text-muted-foreground mb-2">
          Captured leads submit with this form's notification and integration routing.
        </p>
        <div className="flex gap-2">
          <Select
            value={props.formId != null ? String(props.formId) : "__none__"}
            onValueChange={v => set("formId", v === "__none__" ? undefined : parseInt(v, 10))}
          >
            <SelectTrigger className="text-sm flex-1">
              <SelectValue placeholder="No linked form" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">
                <span className="flex items-center gap-1.5"><Link2Off className="w-3.5 h-3.5" />No linked form</span>
              </SelectItem>
              {globalForms.map(f => (
                <SelectItem key={f.id} value={String(f.id)}>
                  <span className="flex items-center gap-1.5"><Link2 className="w-3.5 h-3.5" />{f.name}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <a href="/forms" target="_blank" rel="noopener noreferrer" className="shrink-0">
            <Button size="sm" variant="outline" type="button">Manage</Button>
          </a>
        </div>
        {linkedForm && (
          <p className="text-xs text-green-600 mt-1.5 flex items-center gap-1">
            <Link2 className="w-3 h-3" /> Linked to "{linkedForm.name}" — notifications and integrations managed globally.
          </p>
        )}
      </div>

      <div>
        <Label className={LABEL_CLS}>Consent Text</Label>
        <Textarea
          value={props.consentText ?? ""}
          onChange={e => set("consentText", e.target.value)}
          className="text-sm"
          rows={2}
          placeholder="We'll only use your details to follow up about your inquiry."
        />
        <p className="text-xs text-muted-foreground mt-1">Small print shown at the bottom of the chat panel.</p>
      </div>
      <div>
        <Label className={LABEL_CLS}>Auto-open Delay (seconds)</Label>
        <Input
          type="number"
          min={0}
          value={props.autoOpenDelaySeconds ?? 0}
          onChange={e => set("autoOpenDelaySeconds", e.target.value ? Math.max(0, Number(e.target.value)) : 0)}
          className="text-sm"
        />
        <p className="text-xs text-muted-foreground mt-1">0 = never auto-open. Fires at most once per browser session.</p>
      </div>
      <div>
        <Label className={LABEL_CLS}>Position</Label>
        <Select
          value={props.position ?? "bottom-right"}
          onValueChange={v => set("position", v as NonNullable<ChatCaptureBlockProps["position"]>)}
        >
          <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="bottom-right">Bottom right</SelectItem>
            <SelectItem value="bottom-left">Bottom left</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className={LABEL_CLS}>Accent Color</Label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={props.accentColor || "#4f46e5"}
            onChange={e => set("accentColor", e.target.value)}
            className="w-8 h-8 rounded cursor-pointer border border-border p-0.5 bg-background shrink-0"
          />
          <Input
            value={props.accentColor ?? ""}
            onChange={e => set("accentColor", e.target.value || undefined)}
            placeholder="e.g. #4f46e5"
            className="h-8 text-xs font-mono flex-1"
            maxLength={7}
          />
          {props.accentColor && (
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive shrink-0" onClick={() => set("accentColor", undefined)}>
              <X className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
        <BrandSwatches className="mt-1.5" current={props.accentColor} onPick={hex => set("accentColor", hex)} />
        <p className="text-[10px] text-muted-foreground mt-1">Launcher and bubble color. Defaults to brand primary. Clear to reset.</p>
      </div>
    </div>
  );
}
