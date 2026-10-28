// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * In the builder, the "Change image" pill on a hub card must open its picker — not the
 * PDF. The pill stops propagation so the card's click guard never ran, and the browser
 * followed the card's href (Oct 2026). Now the pill prevents the default itself and editor
 * cards carry no href at all.
 */
vi.mock("@/components/ImagePicker", () => ({ ImagePicker: () => createElement("div", { "data-image-picker": "" }), uploadImage: vi.fn() }));
vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ user: null }) }));
afterEach(cleanup);

import { DEFAULT_BRAND } from "@/lib/brand-config";
import { resolveHubPalette } from "@/lib/hub-theme";
import { HubAssetCard, HubAssetRow } from "./HubAssetCard";
import type { HubAsset } from "./hub-assets";

const asset: HubAsset = { key: "guide", kind: "pdf", title: "Screening guide", fileUrl: "/api/storage/objects/uploads/guide", thumbnailUrl: "/api/storage/objects/uploads/cover" };
const palette = resolveHubPalette({}, DEFAULT_BRAND, "library");

for (const [name, Comp] of [["card", HubAssetCard], ["row", HubAssetRow]] as const) {
  describe(`Hub asset ${name} in the editor`, () => {
    it("the image pill opens the picker and nothing navigates", () => {
      const onOpen = vi.fn(() => true);
      const { container } = render(createElement(Comp, { asset, palette, onOpen, onTitleChange: () => {}, onThumbnailChange: () => {} }));
      const pill = container.querySelector("[data-inline-image]") as HTMLButtonElement;
      // The card's own link carries no href in the editor (the download pill keeps its own, guarded click).
      expect(container.querySelector("a[aria-label]")!.getAttribute("href")).toBeNull();
      expect(pill.closest("a")?.getAttribute("href") ?? null).toBeNull();
      expect(pill.getAttribute("data-inline-image")).toBe("change");
      const notPrevented = fireEvent.click(pill);
      expect(notPrevented).toBe(false); // default prevented → no navigation even inside an <a>
      expect(onOpen).not.toHaveBeenCalled();
      expect(document.querySelector("[data-image-picker]")).not.toBeNull();
    });
  });
}

describe("Hub asset card on the live page", () => {
  it("keeps a real href and opens the viewer on a plain click", () => {
    const onOpen = vi.fn(() => true);
    const { container } = render(createElement(HubAssetCard, { asset, palette, onOpen }));
    const a = container.querySelector("a[aria-label]") as HTMLAnchorElement;
    expect(a.getAttribute("href")).toBe("/api/storage/objects/uploads/guide");
    expect(fireEvent.click(a)).toBe(false);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
