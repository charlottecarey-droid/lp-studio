import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";

/** One thing to do before the hub goes to the customer. Mirrors the server's HubSetupItem. */
export interface HubSetupItem {
  key: string;
  title: string;
  why: string;
  done: boolean;
  where: "account" | "team" | "kit" | "notify" | "publish" | "invite";
}

/** Where a hub stands on the way to the customer. Mirrors the server's hubSetupState. */
export type HubSetupState = { state: "setup" | "ready" | "shared"; left: number; total: number };
export function hubSetupState(items: Pick<HubSetupItem, "done" | "where">[]): HubSetupState {
  const left = items.filter((i) => !i.done);
  const prepLeft = left.filter((i) => i.where !== "publish" && i.where !== "invite").length;
  return { state: prepLeft ? "setup" : left.length ? "ready" : "shared", left: prepLeft || left.length, total: items.length };
}

/** The hub's status as a small label: "In setup · 3 to go", "Ready to share", or nothing once it is shared. */
export function SetupStatus({ setup, className = "" }: { setup: HubSetupState | null | undefined; className?: string }) {
  if (!setup || setup.total === 0 || setup.state === "shared") return null;
  const inSetup = setup.state === "setup";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${inSetup ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"} ${className}`} data-hub-setup-status={setup.state}>
      {inSetup ? `In setup · ${setup.left} to go` : "Ready to share"}
    </span>
  );
}

/** What the button beside a step says. */
export function setupAction(where: HubSetupItem["where"], marketingName: string): string {
  return where === "account" ? "Open Account" : where === "team" ? "Open Team" : where === "kit" ? `Open ${marketingName}` : where === "notify" ? "Link channel" : where === "publish" ? "Publish" : "Invite";
}

/**
 * Before the hub is shared: what has been done and what is left, each step
 * with a button that goes to where it is done. Open while anything is left;
 * once everything is done it folds to one quiet line.
 */
export function RoomSetupChecklist({ items, marketingName, onGo, busy }: { items: HubSetupItem[]; marketingName: string; onGo: (item: HubSetupItem) => void; /** The step being worked on (publishing). */ busy?: string | null }) {
  const left = items.filter((i) => !i.done);
  const [open, setOpen] = useState(left.length > 0);
  if (items.length === 0) return null;
  const done = items.length - left.length;
  const state = hubSetupState(items).state;
  const heading = state === "setup" ? "In setup: finish these before you share the hub" : state === "ready" ? "Ready to share" : "Shared with the customer";
  const sub = state === "setup" ? `${done} of ${items.length} done · ${left.length} to go` : state === "ready" ? `The hub is set up. ${left.map((i) => i.title).join(" and ")} to put it in front of the customer.` : `All ${items.length} setup steps are done`;
  return (
    <section className={`rounded-md border ${state === "setup" ? "border-amber-200 bg-amber-50/40" : state === "ready" ? "border-emerald-200 bg-emerald-50/40" : ""}`} data-room-setup={state}>
      <button type="button" className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="min-w-0">
          <span className="block text-sm font-semibold">{heading}</span>
          <span className="block text-xs text-muted-foreground">{sub}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-muted sm:block" aria-hidden>
            <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${(done / items.length) * 100}%` }} />
          </span>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>
      {open && (
        <ul className="divide-y border-t bg-background">
          {items.map((i) => (
            <li key={i.key} className="flex items-center gap-3 px-3 py-2" data-room-setup-step={i.key} data-done={i.done ? "1" : "0"}>
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${i.done ? "border-emerald-500 bg-emerald-500 text-white" : "border-muted-foreground/40"}`} aria-hidden>
                {i.done && <Check className="h-3 w-3" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block text-sm ${i.done ? "text-muted-foreground" : "font-medium"}`}>{i.title}</span>
                {!i.done && <span className="block text-xs text-muted-foreground">{i.why}</span>}
              </span>
              <Button size="sm" variant={i.done ? "ghost" : "outline"} className={`h-8 shrink-0 ${i.done ? "text-muted-foreground" : ""}`} disabled={busy === i.key || (i.done && i.where === "publish")} onClick={() => onGo(i)}>
                {busy === i.key ? "Working…" : i.done ? (i.where === "publish" ? "Live" : "Change") : setupAction(i.where, marketingName)}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
