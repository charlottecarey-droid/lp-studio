// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { InlineColorPopover } from "./InlineColorPopover";

const RECENTS_KEY = "lp-studio:inline-color-recents";

// React's exact duplicate-key message ("Encountered two children with the same
// key, `%s`."). Match that specific phrasing rather than a loose "key" token so
// the assertion can't be tripped by unrelated console output.
function findDuplicateKeyWarning(
  ...spies: ReturnType<typeof vi.spyOn>[]
): string | undefined {
  return spies
    .flatMap((spy) => spy.mock.calls)
    .flat()
    .map(String)
    .find((msg) => msg.includes("the same key"));
}

/**
 * Render-level regression guard for the inline color picker's "Recent"
 * swatches. The pure-logic test in `InlineColorPopover.test.ts` proves
 * `dedupeRecents` collapses case-insensitive duplicates, but it can't catch a
 * regression in the *rendering* layer — e.g. if the component stopped deduping
 * before mapping to buttons, or generated colliding React keys. Duplicate keys
 * flood the console with warnings and can make swatches render the wrong color
 * or vanish entirely. This test mounts the real component with messy recents
 * and asserts exactly one button per distinct color with no React warnings.
 */
describe("InlineColorPopover render", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    window.localStorage.clear();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    cleanup();
  });

  it("renders one recent swatch per distinct color with no duplicate-key warnings", () => {
    // Repeated and mixed-case hexes — the kind of messy history that produced
    // the original duplicate-key bug.
    window.localStorage.setItem(
      RECENTS_KEY,
      JSON.stringify([
        "#ABCDEF",
        "#abcdef",
        "#123456",
        "#123456",
        "#FF0000",
      ]),
    );

    render(
      <InlineColorPopover open onOpenChange={() => {}} onPick={() => {}}>
        <span>trigger</span>
      </InlineColorPopover>,
    );

    // The popover content is portaled to <body>; the "Recent" group exposes one
    // button per distinct color, each titled with its hex value.
    const recentButtons = screen
      .getAllByRole("button")
      .filter((btn) => /^#[0-9a-fA-F]{6}$/.test(btn.getAttribute("title") ?? ""));

    const titles = recentButtons.map((btn) => btn.getAttribute("title"));
    expect(titles).toEqual(["#ABCDEF", "#123456", "#FF0000"]);

    // Exactly one button per distinct (case-insensitive) color.
    const distinctKeys = new Set(titles.map((t) => t?.toLowerCase()));
    expect(distinctKeys.size).toBe(titles.length);

    // React surfaces duplicate-key collisions via console.error; assert none.
    expect(findDuplicateKeyWarning(consoleErrorSpy, consoleWarnSpy)).toBeUndefined();
  });

  it("renders brand swatches without console warnings", () => {
    render(
      <InlineColorPopover
        open
        onOpenChange={() => {}}
        onPick={() => {}}
        brandSwatches={[
          { name: "Primary", value: "#101820" },
          { name: "Accent", value: "#F5C518" },
        ]}
      >
        <span>trigger</span>
      </InlineColorPopover>,
    );

    expect(screen.getByTitle("Primary")).toBeDefined();
    expect(screen.getByTitle("Accent")).toBeDefined();

    expect(findDuplicateKeyWarning(consoleErrorSpy, consoleWarnSpy)).toBeUndefined();
  });
});
