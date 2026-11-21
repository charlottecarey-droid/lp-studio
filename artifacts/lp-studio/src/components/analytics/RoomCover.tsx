import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useBrandConfig } from "@/components/BrandSwatches";
import { roomHeadlineDefault } from "@/blocks/BlockRoomWorkspace";

/** The hub's cover as stored on the page. Mirrors the server's RoomCoverInput. */
export interface HubCover {
  headline: string;
  eyebrow: string;
  coverStyle: "fade" | "split" | "fullbleed" | "light";
  coverPhotoScrolls: boolean;
}

const STYLES: { id: HubCover["coverStyle"]; label: string }[] = [
  { id: "fade", label: "Fading photo" },
  { id: "split", label: "Photo card" },
  { id: "fullbleed", label: "Full-bleed" },
  { id: "light", label: "Light" },
];

/**
 * Cover settings in the team's pop-up: headline, the label above it and the
 * cover style. The photo itself is still changed in the page builder.
 */
export function RoomCoverSection({ pageId, cover, onSaved }: { pageId: number; cover: HubCover; onSaved: (cover: HubCover) => void | Promise<void> }) {
  const brand = useBrandConfig();
  const fallback = roomHeadlineDefault(brand?.brandName);
  const [draft, setDraft] = useState<HubCover>(cover);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  useEffect(() => setDraft(cover), [cover]);

  const shownHeadline = draft.headline.trim() ? draft.headline : fallback;
  const changed = JSON.stringify(draft) !== JSON.stringify(cover);

  const save = async () => {
    setBusy(true);
    setErr("");
    setNote("");
    try {
      // A headline left as the default is stored blank, so it keeps following the brand name.
      const body = { ...draft, headline: draft.headline.trim() === fallback ? "" : draft.headline };
      const r = await fetch(`/api/lp/partner-rooms/${pageId}/cover`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = (await r.json().catch(() => ({}))) as { cover?: HubCover; error?: string };
      if (!r.ok || !j.cover) setErr(j.error ?? "Could not save the cover");
      else {
        setNote("Saved");
        await onSaved(j.cover);
      }
    } catch {
      setErr("Could not save the cover");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-2" data-room-cover-settings>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1 text-xs sm:col-span-2">
          <span className="font-medium text-muted-foreground">Headline</span>
          <Input value={shownHeadline} onChange={(e) => setDraft({ ...draft, headline: e.target.value })} maxLength={160} />
        </label>
        <label className="block space-y-1 text-xs">
          <span className="font-medium text-muted-foreground">Small label above it</span>
          <Input value={draft.eyebrow} onChange={(e) => setDraft({ ...draft, eyebrow: e.target.value })} maxLength={80} />
        </label>
        <label className="block space-y-1 text-xs">
          <span className="font-medium text-muted-foreground">Style</span>
          <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={draft.coverStyle} onChange={(e) => setDraft({ ...draft, coverStyle: e.target.value as HubCover["coverStyle"] })}>
            {STYLES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>
      </div>
      {draft.coverStyle === "fade" && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={!draft.coverPhotoScrolls} onChange={(e) => setDraft({ ...draft, coverPhotoScrolls: !e.target.checked })} />
          Photo stays in place while the page scrolls
        </label>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="brand" disabled={busy || !changed} onClick={save}>Save</Button>
        <span className="text-xs text-muted-foreground">Change the photo in the page builder.</span>
        {note && <span className="text-sm text-muted-foreground">{note}</span>}
        {err && <span className="text-sm text-destructive">{err}</span>}
      </div>
    </section>
  );
}
