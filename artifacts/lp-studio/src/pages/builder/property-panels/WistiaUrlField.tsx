import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  extractWistiaId,
  isWistiaShareLink,
  resolveWistiaShareLink,
  wistiaIframeUrl,
} from "@/lib/wistia";

/**
 * Wistia URL input with paste-time normalisation. Share short-links
 * (wistia.com/s/<token>) carry a token instead of the media id, so pasting
 * one triggers an oEmbed resolve and the field commits the canonical embed
 * URL in its place — the renderer then never depends on a network resolve.
 * Other Wistia link shapes pass through untouched (the renderer parses them
 * directly); anything unrecognisable gets a red hint.
 */
export function WistiaUrlField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string | undefined) => void;
}) {
  const [resolving, setResolving] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
    if (!value || extractWistiaId(value) || !isWistiaShareLink(value)) {
      setResolving(false);
      return;
    }
    setResolving(true);
    let cancelled = false;
    void resolveWistiaShareLink(value).then((id) => {
      if (cancelled) return;
      setResolving(false);
      if (id) onChange(wistiaIframeUrl(id));
      else setFailed(true);
    });
    return () => { cancelled = true; };
    // onChange comes from PropertyPanel's render closure — new identity every
    // render; keying the effect on it would loop the resolve.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const invalid = !!value && !extractWistiaId(value) && !isWistiaShareLink(value);

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">Wistia Video URL (optional)</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value || undefined)}
        placeholder="https://dandy.wistia.com/medias/…"
        className="h-8 text-xs"
      />
      {resolving ? (
        <p className="text-[11px] text-muted-foreground">Resolving Wistia share link…</p>
      ) : failed ? (
        <p className="text-[11px] text-red-500">
          Couldn't resolve this share link — open the video in Wistia and paste its media page URL
          (…/medias/…) instead.
        </p>
      ) : invalid ? (
        <p className="text-[11px] text-red-500">
          Doesn't look like a Wistia link — paste a share, media, or embed URL.
        </p>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          Paste any Wistia link. The image becomes a thumbnail with a play button; with no image,
          the player embeds directly.
        </p>
      )}
    </div>
  );
}
