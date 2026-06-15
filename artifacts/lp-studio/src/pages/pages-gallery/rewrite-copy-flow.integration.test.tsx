// @vitest-environment jsdom
/**
 * Frontend end-to-end wiring for the "Rewrite copy with AI" one-click flow.
 *
 * This complements the route-level integration test
 * (api-server/.../generate-page.rewrite-source-page.integration.test.ts) which
 * proves the SERVER preserves structure + rewrites copy for a non-template
 * `sourcePageId`. Here we guard the CLIENT wiring that feeds that server branch:
 *
 *   gallery row action menu ("Rewrite copy with AI")
 *     -> parent sets `rewriteSource` and opens the create modal in AI mode
 *     -> modal composes a generation body with `sourcePageId` set and NO
 *        `templateId` (the exact contract the server's rewrite branch needs)
 *     -> on a successful generation the new page is saved and the user is taken
 *        to it (saveGeneratedPage -> onOpenGenerated).
 *
 * The real `PageActionsMenu` and `CreatePageModal` are mounted inside a small
 * harness that mirrors the exact prop wiring `pages-gallery.tsx` uses. The
 * streaming canvas (`GenerationLiveView`) is stubbed to simulate a successful
 * generation deterministically (it records the request body it was handed, then
 * fires the modal's save/open callbacks) — the SSE pipeline is not the unit
 * under test. The Radix Dialog chrome and a couple of heavy/networked children
 * are stubbed for the same reason; the modal's own rewrite logic runs for real.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import type { GenerationRequestBody, GenerationResult } from "@/lib/generationStream";

// ── Stub the streaming canvas ────────────────────────────────────────────────
// It records the body it received (so we can assert sourcePageId / no
// templateId) and, on mount, simulates a finished generation: save the page,
// then open it with the returned id — exactly what the real component does once
// the SSE stream resolves and the user confirms.
const liveViewState = vi.hoisted(() => ({
  lastBody: null as GenerationRequestBody | null,
}));
vi.mock("./GenerationLiveView", () => ({
  GenerationLiveView: ({
    body,
    onSave,
    onOpen,
  }: {
    body: GenerationRequestBody;
    onSave: (result: GenerationResult) => Promise<number>;
    onOpen: (pageId: number) => void;
  }) => {
    liveViewState.lastBody = body;
    return (
      <button
        type="button"
        data-testid="sim-generation-complete"
        onClick={async () => {
          const id = await onSave(SIM_RESULT);
          onOpen(id);
        }}
      >
        finish generation
      </button>
    );
  },
}));

// ── Lightweight Dialog chrome (Radix portal/focus-trap is not under test) ─────
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// ── Heavy / networked children unrelated to the rewrite wiring ────────────────
vi.mock("@/lib/generatorPresets", () => ({
  fetchGeneratorPresets: vi.fn(async () => []),
  resolveChipTemplate: vi.fn(() => null),
}));
vi.mock("@/components/generation/ScreenshotAttach", () => ({
  ScreenshotAttachZone: () => null,
  useScreenshotAttachment: () => ({ screenshot: null, reset: vi.fn() }),
}));
vi.mock("@/components/generation/StarterPromptChips", () => ({
  StarterPromptChips: () => null,
}));

import { PageActionsMenu } from "./page-actions-menu";
import { CreatePageModal } from "./create-page-modal";
import type { Page } from "./types";

// The (mocked) generation result: same blocks as the source page, copy
// rewritten. saveGeneratedPage persists this and returns the new page id.
const SIM_RESULT: GenerationResult = {
  title: "Existing Page (rewritten)",
  slug: "existing-page-rewritten",
  blocks: [
    { id: "hero-0", type: "hero", props: { headline: "Rewritten headline" } },
    { id: "features-1", type: "features", props: { heading: "Rewritten features" } },
  ] as unknown as GenerationResult["blocks"],
};

const NEW_PAGE_ID = 4242;
const SOURCE_PAGE_ID = 555;

function sourcePage(): Page {
  return {
    id: SOURCE_PAGE_ID,
    title: "Existing Page",
    slug: "existing-page",
    status: "draft",
    isTemplate: false,
  } as unknown as Page;
}

/**
 * Harness mirroring the relevant wiring in pages-gallery.tsx: the row action
 * menu's "Rewrite copy with AI" sets `rewriteSource` + opens the modal in AI
 * mode; the modal threads sourcePageId through `buildAiGenerateBody`, and on a
 * finished generation saves + opens the new page.
 */
function Harness({
  buildAiGenerateBody,
  saveGeneratedPage,
  onOpenGenerated,
}: {
  buildAiGenerateBody: Props["buildAiGenerateBody"];
  saveGeneratedPage: Props["saveGeneratedPage"];
  onOpenGenerated: Props["onOpenGenerated"];
}) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [rewriteSource, setRewriteSource] = useState<{ id: number; title: string } | null>(null);
  const [initialPrompt, setInitialPrompt] = useState("");

  const handleRewriteCopy = (page: Page) => {
    setRewriteSource({ id: page.id, title: page.title });
    setInitialPrompt(`Rewrite the copy for "${page.title}" to be sharper, keeping the same layout.`);
    setShowCreateModal(true);
  };

  return (
    <>
      <PageActionsMenu
        page={sourcePage()}
        cloningPageId={null}
        onClone={vi.fn()}
        onRewriteCopy={() => handleRewriteCopy(sourcePage())}
        onAbTest={vi.fn()}
        onLinks={vi.fn()}
        onShare={vi.fn()}
        onDelete={vi.fn()}
        onTemplateSaved={vi.fn()}
      />
      <CreatePageModal
        open={showCreateModal}
        initialMode="ai"
        initialAiPrompt={initialPrompt}
        rewriteSource={rewriteSource}
        onClose={() => { setShowCreateModal(false); setRewriteSource(null); }}
        segments={[]}
        selectedSegmentId=""
        setSelectedSegmentId={vi.fn()}
        selectedSegment={null}
        selectedAudienceBucket={null}
        visibleApiTemplates={[]}
        tenantIndustry={null}
        onCreate={vi.fn(async () => {})}
        onAiGenerate={vi.fn(async () => {})}
        buildAiGenerateBody={buildAiGenerateBody}
        saveGeneratedPage={saveGeneratedPage}
        onOpenGenerated={onOpenGenerated}
        onOpenBriefModal={vi.fn()}
      />
    </>
  );
}

type Props = React.ComponentProps<typeof CreatePageModal>;

beforeEach(() => {
  liveViewState.lastBody = null;
  cleanup();
});

describe("Rewrite copy with AI — frontend one-click flow", () => {
  it("menu action -> modal sends sourcePageId (no templateId) -> saves & opens the new page", async () => {
    const buildAiGenerateBody = vi.fn(
      (
        prompt: string,
        templateId: number | null,
        referenceUrls: string[],
        replaceImagery: boolean,
        _screenshotDataUrl?: string,
        sourcePageId?: number | null,
      ): GenerationRequestBody => ({
        prompt,
        ...(templateId != null ? { templateId } : {}),
        ...(sourcePageId != null ? { sourcePageId } : {}),
        referenceUrls,
        replaceImagery,
      }),
    );
    const saveGeneratedPage = vi.fn(async (_result: GenerationResult, _prompt: string) => NEW_PAGE_ID);
    const onOpenGenerated = vi.fn();

    render(
      <Harness
        buildAiGenerateBody={buildAiGenerateBody}
        saveGeneratedPage={saveGeneratedPage}
        onOpenGenerated={onOpenGenerated}
      />,
    );

    // 1) Open the row action menu and click "Rewrite copy with AI".
    fireEvent.click(screen.getByTitle("More actions"));
    fireEvent.click(screen.getByText("Rewrite copy with AI"));

    // 2) The modal opens locked to the source page (rewriteSource banner).
    expect(await screen.findByText(/Rewriting: Existing Page/i)).toBeTruthy();

    // 3) Trigger generation.
    fireEvent.click(screen.getByText("Generate Page"));

    // 4) The body handed to the streaming canvas carries sourcePageId and NO
    //    templateId — the exact contract the server's rewrite branch consumes.
    expect(buildAiGenerateBody).toHaveBeenCalledTimes(1);
    const [, tplArg, , , , srcArg] = buildAiGenerateBody.mock.calls[0];
    expect(tplArg).toBeNull();
    expect(srcArg).toBe(SOURCE_PAGE_ID);

    await waitFor(() => expect(liveViewState.lastBody).not.toBeNull());
    expect(liveViewState.lastBody?.sourcePageId).toBe(SOURCE_PAGE_ID);
    expect(liveViewState.lastBody?.templateId).toBeUndefined();

    // 5) Simulate the generation finishing -> a new page is saved and opened.
    fireEvent.click(screen.getByTestId("sim-generation-complete"));

    await waitFor(() => expect(saveGeneratedPage).toHaveBeenCalledTimes(1));
    const savedResult = saveGeneratedPage.mock.calls[0][0];
    expect(savedResult.title).toBe("Existing Page (rewritten)");
    expect(savedResult.blocks.map((b) => (b as { type: string }).type)).toEqual(["hero", "features"]);

    await waitFor(() => expect(onOpenGenerated).toHaveBeenCalledWith(NEW_PAGE_ID));
  });
});
