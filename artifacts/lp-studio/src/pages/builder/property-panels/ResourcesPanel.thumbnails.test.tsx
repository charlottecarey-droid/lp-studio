// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, render, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The Resources block gets the same "Thumbnails from your PDFs" card as the content hub:
 * only stored / *.pdf links without an image are offered, every result lands even when
 * the parent never re-renders, and a stored file that turns out not to be a PDF is
 * reported as skipped rather than as a failure.
 */
vi.mock("@/components/ImagePicker", () => ({ ImagePicker: () => null, uploadImage: vi.fn() }));
vi.mock("@/components/LibraryPicker", () => ({ LibraryButtons: () => null, SaveItemToLibraryButton: () => null }));
vi.mock("@/lib/pdf-thumbnail", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/pdf-thumbnail")>();
  return {
    ...actual,
    createPdfThumbnail: vi.fn(async (source: string) => {
      if (source.endsWith("/png")) throw new actual.NotAPdfError();
      return `/api/storage/objects/uploads/thumb-${source.split("/").pop()}`;
    }),
  };
});

// vitest runs without globals, so testing-library does not unmount between tests on its own.
afterEach(cleanup);

import ResourcesPanel from "./ResourcesPanel";
import type { ResourcesBlockProps } from "@/lib/block-types";

const item = (title: string, url: string, image = "") => ({ title, url, image, description: "", category: "PDF" });

describe("Resources block — generate PDF thumbnails", () => {
  it("offers stored PDFs without an image, applies all results, reports a non-PDF as skipped", async () => {
    const props = {
      headline: "Resources",
      items: [
        item("Pricing guide", "/api/storage/objects/uploads/pricing"),
        item("Already covered", "/api/storage/objects/uploads/covered", "/img/cover.jpg"),
        item("External article", "https://example.com/post"),
        item("Brochure", "https://cdn.example.com/brochure.pdf"),
        item("Actually a PNG", "/api/storage/objects/uploads/png"),
      ],
    } as unknown as ResourcesBlockProps;
    const onChange = vi.fn();
    render(createElement(ResourcesPanel, { props, onChange }));

    const button = document.querySelector("[data-generate-thumbnails]") as HTMLButtonElement;
    expect(button.textContent).toContain("Generate 3 thumbnails");
    fireEvent.click(button);

    await waitFor(() => expect(document.querySelector("[data-thumbnail-skipped]")).not.toBeNull());
    expect(onChange).toHaveBeenCalledTimes(2);
    const last = onChange.mock.calls.at(-1)![0] as ResourcesBlockProps;
    expect(last.items.map((it) => it.image)).toEqual([
      "/api/storage/objects/uploads/thumb-pricing",
      "/img/cover.jpg",
      "",
      "/api/storage/objects/uploads/thumb-brochure.pdf",
      "",
    ]);
    expect(document.querySelector("[data-thumbnail-failures]")).toBeNull();
    expect(document.querySelector("[data-thumbnail-skipped]")!.textContent).toContain("Actually a PNG");
  });
});
