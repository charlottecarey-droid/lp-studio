/** @vitest-environment jsdom */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";

// Portaled sheets outlive each render unless explicitly cleaned up.
afterEach(cleanup);
import { MediaLibraryDrawer } from "./MediaLibraryDrawer";

/**
 * Keep-open picking mode (the panel ImagePicker's "try images on the live
 * canvas" flow). Pins the contract:
 *   - selecting fires onSelect but does NOT close the drawer,
 *   - the tile matching activeUrl is labeled "Current",
 *   - the full-width Done button closes,
 *   - scrolling OUTSIDE the drawer closes; scrolling inside does not,
 *   - default mode (no keepOpenOnSelect) still selects-and-closes.
 */

const ITEMS = [
  { id: 1, url: "https://cdn.example.com/one.png", title: "Image One", tags: [], createdAt: "2026-07-01" },
  { id: 2, url: "https://cdn.example.com/two.png", title: "Image Two", tags: [], createdAt: "2026-07-02" },
];

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const json = (body: unknown) => ({ ok: true, json: async () => body }) as Response;
    if (url.includes("/lp/media/images")) {
      return json({ items: ITEMS, tagCounts: [], total: ITEMS.length, page: 1, totalPages: 1 });
    }
    return json({});
  }));
});

describe("MediaLibraryDrawer — keep-open picking mode", () => {
  it("keeps the drawer open across selections and marks the current image", async () => {
    const onSelect = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <MediaLibraryDrawer
        open
        onOpenChange={onOpenChange}
        onSelect={onSelect}
        keepOpenOnSelect
        activeUrl="https://cdn.example.com/one.png"
      />,
    );
    await waitFor(() => expect(screen.getAllByText("Image One").length).toBeGreaterThan(0));

    // The applied image is labeled.
    expect(screen.getByText("Current")).toBeTruthy();

    // Selecting another image applies it without closing.
    fireEvent.click(screen.getAllByAltText("Image Two")[0]);
    expect(onSelect).toHaveBeenCalledWith("https://cdn.example.com/two.png");
    expect(onOpenChange).not.toHaveBeenCalled();

    // The big Done button closes.
    fireEvent.click(screen.getByText(/Done — keep this image/));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("closes on an outside scroll but not on scrolls inside the drawer", async () => {
    const onOpenChange = vi.fn();
    render(
      <MediaLibraryDrawer open onOpenChange={onOpenChange} onSelect={vi.fn()} keepOpenOnSelect />,
    );
    await waitFor(() => expect(screen.getAllByText("Image One").length).toBeGreaterThan(0));

    // A scroll INSIDE the sheet (the image grid's container) is ignored.
    const inside = screen.getAllByText("Image One")[0];
    fireEvent.scroll(inside);
    expect(onOpenChange).not.toHaveBeenCalled();

    // A scroll anywhere else (property panel, canvas, the page) closes.
    fireEvent.scroll(document.body);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("default mode still selects-and-closes", async () => {
    const onSelect = vi.fn();
    const onOpenChange = vi.fn();
    render(<MediaLibraryDrawer open onOpenChange={onOpenChange} onSelect={onSelect} />);
    await waitFor(() => expect(screen.getAllByText("Image One").length).toBeGreaterThan(0));
    expect(screen.queryByText(/Done — keep this image/)).toBeNull();

    fireEvent.click(screen.getAllByAltText("Image One")[0]);
    expect(onSelect).toHaveBeenCalledWith("https://cdn.example.com/one.png");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
