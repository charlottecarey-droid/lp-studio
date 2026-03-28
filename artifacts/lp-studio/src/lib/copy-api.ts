const API = "/api/lp/copy-generate";

export interface SegmentContext {
  id: string;
  name: string;
  description?: string;
  messagingAngle?: string;
  uniqueContext?: string;
  valueProps?: string[];
  personas?: { role: string; painPoints: string[] }[];
  challenges?: { title: string; desc: string }[];
}

export interface BriefContext {
  company: string;
  objective: string;
  valueProps: string[];
  toneGuidance: string;
  suggestedHeadline: string;
  segmentContext?: SegmentContext;
}

export async function suggestCopy(
  blockType: string,
  field: string,
  currentValue: string,
  siblingFields: Record<string, string> = {},
  count = 3,
): Promise<string[]> {
  const { getBriefContext } = await import("./brief-context");
  const briefContext = getBriefContext() ?? undefined;
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blockType, field, currentValue, siblingFields, count, briefContext }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Copy generation failed");
  }
  const data = await res.json() as { suggestions: string[] };
  return data.suggestions;
}

export type DsoBentoTile =
  | { type: "stat"; value: string; label: string; description: string }
  | { type: "photo"; imageUrl: string; caption: string }
  | { type: "feature"; headline: string; body: string }
  | { type: "quote"; quote: string; author: string };

export async function refreshBentoTiles(
  tileTypes: string[] = ["stat", "stat", "stat", "photo", "quote", "feature"],
): Promise<DsoBentoTile[]> {
  const { getBriefContext } = await import("./brief-context");
  const briefContext = getBriefContext() ?? undefined;
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blockType: "dso-bento-outcomes", action: "refresh-tiles", tileTypes, briefContext }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Tile generation failed");
  }
  const data = await res.json() as { tiles: DsoBentoTile[] };
  return data.tiles ?? [];
}

export async function refreshBlockCopy(
  blockType: string,
  fields: string[],
  currentValues: Record<string, string>,
): Promise<Record<string, string>> {
  const { getBriefContext } = await import("./brief-context");
  const briefContext = getBriefContext() ?? undefined;
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blockType, action: "refresh", fields, currentValues, briefContext }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Copy refresh failed");
  }
  const data = await res.json() as { updated: Record<string, string> };
  return data.updated;
}
