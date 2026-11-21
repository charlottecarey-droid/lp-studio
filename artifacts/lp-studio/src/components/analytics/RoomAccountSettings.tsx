import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useBrandConfig } from "@/components/BrandSwatches";
import { roomHeadlineDefault, type RoomTeamGroup } from "@/blocks/BlockRoomWorkspace";
import { RoomAccountFields, RoomTeamFields, type RoomAccountProps, type RoomTeamProps } from "./RoomAccountEditor";

type Saved = { patch?: Record<string, unknown>; error?: string };

/** Keep a draft of some settings, and save it to the hub. The same fields as the page builder, without opening it. */
function useDraft<T extends object>(pageId: number, stored: T, body: (draft: T) => Record<string, unknown>, onSaved: (patch: Record<string, unknown>) => void | Promise<void>) {
  const [draft, setDraft] = useState<T>(stored);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const key = JSON.stringify(stored);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setDraft(stored), [key]);
  const changed = JSON.stringify(draft) !== key;
  const save = async () => {
    setBusy(true);
    setErr("");
    setNote("");
    try {
      const r = await fetch(`/api/lp/partner-rooms/${pageId}/account`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body(draft)) });
      const j = (await r.json().catch(() => ({}))) as Saved;
      if (!r.ok || !j.patch) setErr(j.error ?? "Could not save");
      else {
        setNote("Saved");
        await onSaved(j.patch);
      }
    } catch {
      setErr("Could not save");
    } finally {
      setBusy(false);
    }
  };
  const bar = (
    <div className="flex flex-wrap items-center gap-2 pt-1">
      <Button size="sm" variant="brand" disabled={busy || !changed} onClick={save}>{busy ? "Saving…" : "Save"}</Button>
      {changed && !busy && <Button size="sm" variant="ghost" onClick={() => setDraft(stored)}>Undo changes</Button>}
      {note && !changed && <span className="text-sm text-muted-foreground">{note}</span>}
      {err && <span className="text-sm text-destructive">{err}</span>}
    </div>
  );
  return { draft, setDraft, bar };
}

/** Who the hub is for, how it opens, the logos, the "Schedule" button, the kickoff date and the cover. */
export function RoomAccountSettings({ pageId, account, team, onSaved }: { pageId: number; account: Partial<RoomAccountProps>; team: RoomTeamGroup[]; onSaved: (patch: Record<string, unknown>) => void | Promise<void> }) {
  const brand = useBrandConfig();
  const fallback = roomHeadlineDefault(brand?.brandName);
  // A headline left as the default is stored blank, so it keeps following the brand name.
  const { draft, setDraft, bar } = useDraft(pageId, account, (d) => ({ account: { ...d, headline: (d.headline ?? "").trim() === fallback ? "" : (d.headline ?? "") } }), onSaved);
  return (
    <section className="max-w-xl space-y-2.5" data-room-account-settings>
      <RoomAccountFields props={draft} update={(patch) => setDraft((d) => ({ ...d, ...patch }))} team={team} brandName={brand?.brandName} note="The social graphics, one-pager and media kit follow these logo sizes. After you save, they are remade when the marketing tab is next opened." />
      {bar}
    </section>
  );
}

/** The named people on both sides. */
export function RoomTeamSettings({ pageId, team, onSaved }: { pageId: number; team: RoomTeamProps; onSaved: (patch: Record<string, unknown>) => void | Promise<void> }) {
  const { draft, setDraft, bar } = useDraft(pageId, team, (d) => ({ team: d }), onSaved);
  return (
    <section className="max-w-xl space-y-2.5" data-room-team-settings>
      <RoomTeamFields props={draft} update={(patch) => setDraft((d) => ({ ...d, ...patch }))} pageId={pageId} />
      {bar}
    </section>
  );
}

/** What the folded "Team" row says while closed. */
export function teamHint(team: RoomTeamGroup[]): string {
  const parts = team.filter((g) => !g.hidden).map((g) => `${g.title || "Group"}: ${(g.members ?? []).filter((m) => !m.hidden).length}`);
  return parts.join(" · ") || "Nobody added yet";
}
