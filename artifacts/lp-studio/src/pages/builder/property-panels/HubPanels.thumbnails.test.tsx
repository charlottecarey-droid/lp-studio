// @vitest-environment jsdom
import { createElement } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

/**
 * "Generate thumbnails" must land every rendered thumbnail on its resource — even when the
 * parent has not re-rendered the panel between results (the builder's props are stale for
 * the duration of the async loop). Oct 2026: six thumbnails rendered and uploaded into the
 * media library, but each result spread the click-time props and undid the previous one,
 * so none stuck. Failures are named, with the reason, instead of a bare count.
 */
vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("@/components/BlockRefreshButton", () => ({ BlockRefreshButton: () => null }));
vi.mock("@/components/AiTextField", () => ({ AiTextField: ({ value }: { value: string }) => createElement("textarea", { defaultValue: value }) }));
vi.mock("@/components/VideoPicker", () => ({ VideoPicker: () => null }));
vi.mock("@/components/ImagePicker", () => ({ ImagePicker: () => null, uploadImage: vi.fn() }));
vi.mock("@/lib/pdf-thumbnail", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/pdf-thumbnail")>();
  return {
    ...actual,
    createPdfThumbnail: vi.fn(async (source: string) => {
      if (source.endsWith("/broken")) throw new Error("Could not fetch the PDF (500)");
      return `/api/storage/objects/uploads/thumb-${source.split("/").pop()}`;
    }),
  };
});

import { HubLibraryPanel } from "./HubPanels";
import type { HubLibraryBlockProps } from "@/blocks/BlockHubLibrary";

const pdf = (key: string, title: string) => ({ key, kind: "pdf" as const, title, fileUrl: `/api/storage/objects/uploads/${key}` });

describe("Hub library — generate PDF thumbnails", () => {
  it("applies every thumbnail even when the parent never re-renders, and names the one that failed", async () => {
    const props: HubLibraryBlockProps = {
      sections: [
        { title: "Posters", items: [pdf("coffee", "Poster — Coffee"), pdf("tired", "Poster — Tired")] },
        { title: "Print", items: [pdf("broken", "Sleep apnea trifold"), pdf("checklist", "Sleep apnea checklist")] },
      ],
    } as HubLibraryBlockProps;
    const onChange = vi.fn(); // never feeds new props back: the stale-closure case
    render(createElement(HubLibraryPanel, { props, onChange, onApplyStyleToAll: () => {} }));

    const button = document.querySelector("[data-generate-thumbnails]") as HTMLButtonElement;
    expect(button.textContent).toContain("Generate 4 thumbnails");
    expect(document.querySelector("[data-pdf-thumbnails]")!.textContent).toContain("4 PDFs have no cover image yet");
    fireEvent.click(button);

    await waitFor(() => expect(document.querySelector("[data-thumbnail-failures]")).not.toBeNull());
    expect(onChange).toHaveBeenCalledTimes(3);
    const last = onChange.mock.calls.at(-1)![0] as HubLibraryBlockProps;
    const thumbs = last.sections!.flatMap((s) => s.items!.map((it) => it.thumbnailUrl ?? ""));
    expect(thumbs).toEqual(["/api/storage/objects/uploads/thumb-coffee", "/api/storage/objects/uploads/thumb-tired", "", "/api/storage/objects/uploads/thumb-checklist"]);

    const failures = document.querySelector("[data-thumbnail-failures]")!.textContent ?? "";
    expect(failures).toContain("One PDF could not be rendered");
    expect(failures).toContain("Sleep apnea trifold");
    expect(failures).toContain("Could not fetch the PDF (500)");
    expect(failures).not.toContain("Poster — Coffee");
    expect(document.querySelector("[data-thumbnail-done]")!.textContent).toContain("Added 3 thumbnails");
    expect(screen.queryByText(/Skipped/)).toBeNull();
  });
});
