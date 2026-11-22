import type { InputHTMLAttributes } from "react";
import { Switch } from "@/components/ui/switch";

/**
 * An on/off setting, drawn as the app's switch. It takes what a tick box
 * takes (`checked`, `onChange` reading `e.target.checked`), so every on/off
 * setting in a hub's Settings looks and works the same way without each one
 * being rewritten.
 */
export function CheckSwitch({ checked, onChange, disabled, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "type"> & { onChange?: (e: { target: { checked: boolean } }) => void }) {
  const data = Object.fromEntries(Object.entries(rest).filter(([k]) => k.startsWith("data-") || k.startsWith("aria-")));
  return <Switch checked={!!checked} disabled={disabled} onCheckedChange={(v) => onChange?.({ target: { checked: v } })} className="shrink-0" {...data} />;
}
