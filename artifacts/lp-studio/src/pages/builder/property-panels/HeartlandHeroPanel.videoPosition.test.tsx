import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

/**
 * The co-brand hero's "Video position" control shows only for the
 * stacked-video layout (SSR smoke of the property panel).
 */
vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("@/components/BlockRefreshButton", () => ({ BlockRefreshButton: () => null }));
vi.mock("@/components/EmailCaptureModal", () => ({ EmailCaptureModal: () => null }));

import { PropertyPanel } from "./PropertyPanel";

function render(props: Record<string, unknown>): string {
  const block = { id: "b1", type: "dso-heartland-hero", props: { headline: "H", stats: [], ...props } };
  return renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client: new QueryClient() },
      createElement(PropertyPanel as never, { block, onChange: () => {}, onDelete: () => {} } as never),
    ),
  );
}

describe("co-brand hero panel — video position control", () => {
  it("shows Below/Above choices for the stacked-video layout", () => {
    const html = render({ layout: "stacked-video" });
    expect(html).toContain("Video position");
    expect(html).toContain("Below the headline");
    expect(html).toContain("Above the headline");
  });

  it("is hidden for the other layouts", () => {
    for (const layout of ["full-bleed", "split", "split-video", "centered"]) {
      expect(render({ layout }), layout).not.toContain("Video position");
    }
  });
});
