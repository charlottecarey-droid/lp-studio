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

/** What stands between the hub and the customer, in a few words. "" once nothing does. */
export function setupLine(live: boolean, setup: HubSetupState | null | undefined): string {
  if (!setup || setup.total === 0 || setup.state === "shared") return "";
  if (setup.state === "setup") return `${setup.left} setup ${setup.left === 1 ? "step" : "steps"} left`;
  return live ? "nobody invited yet" : "ready to publish";
}

/**
 * A hub's status as one line: whether the customer can open it, then what is
 * still to do. One line, so "Live" and "In setup" are never two labels that
 * seem to disagree.
 */
export function HubStatus({ live, setup, compact = false }: { live: boolean; setup: HubSetupState | null | undefined; /** In a table row: no dot, shorter draft wording. */ compact?: boolean }) {
  const rest = setupLine(live, setup);
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1.5" data-hub-status={`${live ? "live" : "draft"}-${setup?.state ?? "unknown"}`}>
      <span className={`inline-flex items-center gap-1.5 ${live ? "text-emerald-700" : "text-muted-foreground"}`}>
        {!compact && <span className={`h-2 w-2 rounded-full ${live ? "bg-emerald-500" : "bg-muted-foreground/40"}`} aria-hidden />}
        {live ? "Live" : compact ? "Draft" : "Draft (the customer can’t open it yet)"}
      </span>
      {rest && <span className={setup?.state === "setup" ? "font-medium text-amber-700" : "text-muted-foreground"}>· {rest}</span>}
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
  const [showDone, setShowDone] = useState(false);
  if (items.length === 0) return null;
  const row = (i: HubSetupItem) => (
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
  );
  const done = items.length - left.length;
  const state = hubSetupState(items).state;
  const heading = state === "setup" ? "Finish these before you share the hub" : state === "ready" ? "Ready to share" : "Shared with the customer";
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
        <div className="border-t bg-background">
          <ul className="divide-y">{(left.length ? left : items).map(row)}</ul>
          {left.length > 0 && done > 0 && (
            <div className="border-t">
              <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-muted-foreground hover:text-foreground" onClick={() => setShowDone((v) => !v)} aria-expanded={showDone} data-room-setup-done-toggle>
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white" aria-hidden><Check className="h-2.5 w-2.5" /></span>
                {done} done
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showDone ? "rotate-180" : ""}`} />
              </button>
              {showDone && <ul className="divide-y border-t">{items.filter((i) => i.done).map(row)}</ul>}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
