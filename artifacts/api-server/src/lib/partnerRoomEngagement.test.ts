import { describe, expect, it } from "vitest";
import { summarizeAssetEvents, type AssetEventRow } from "./partnerRoomEngagement";

const at = (min: number) => new Date(Date.UTC(2027, 0, 12, 12, min));
const ev = (p: Partial<AssetEventRow>): AssetEventRow => ({ assetKey: "one-pager", assetTitle: "Partnership one-pager", assetKind: "pdf", action: "view", value: null, sessionId: "s1", viewerEmail: null, viewerName: null, createdAt: at(0), ...p });

describe("asset engagement summary", () => {
  it("rolls events up per asset: opens, downloads, time, watch progress, people", () => {
    const out = summarizeAssetEvents([
      ev({ viewerEmail: "levi@mb2dental.com", viewerName: "Levi Stone", createdAt: at(1) }),
      ev({ action: "time", value: 120, viewerEmail: "levi@mb2dental.com", viewerName: "Levi Stone", createdAt: at(3) }),
      ev({ action: "open", viewerEmail: "dana@mb2dental.com", createdAt: at(5) }),
      ev({ action: "download", sessionId: "anon-1", createdAt: at(6) }),
      ev({ action: "view", sessionId: "anon-1", createdAt: at(7) }),
      ev({ assetKey: "video", assetTitle: "Lab tour", assetKind: "video", action: "progress", value: 50, sessionId: "s9", createdAt: at(2) }),
      ev({ assetKey: "video", assetTitle: "Lab tour", assetKind: "video", action: "progress", value: 75, sessionId: "s9", createdAt: at(4) }),
      ev({ assetKey: "video", assetTitle: "Lab tour", assetKind: "video", action: "view", sessionId: "s9", createdAt: at(1) }),
    ]);
    expect(out.map((a) => a.key)).toEqual(["one-pager", "video"]); // most used first
    expect(out[0]).toMatchObject({ views: 3, downloads: 1, seconds: 120, anonymous: 1 });
    expect(out[0].people).toEqual(["dana@mb2dental.com", "Levi Stone"]); // newest first, a name where known, each person once
    expect(out[0].lastAt).toBe(at(7).toISOString());
    expect(out[1]).toMatchObject({ views: 1, maxProgress: 75, people: [], anonymous: 1 });
  });
  it("caps a runaway time value and handles nothing at all", () => {
    expect(summarizeAssetEvents([ev({ action: "time", value: 999_999 })])[0].seconds).toBe(4 * 3600);
    expect(summarizeAssetEvents([])).toEqual([]);
  });
});
