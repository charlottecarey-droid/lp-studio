// @vitest-environment jsdom
/**
 * Inline editing is a contentEditable, so the DOM — not React — owns the text
 * while the user types. That makes one thing critical: nothing may write to
 * `innerHTML`/`textContent` mid-edit. The seeding effect that places the caret
 * on entering edit mode used to also depend on `value`, so any parent
 * re-render that changed the prop (an autosave round-trip, a sibling field
 * commit, a canvas refresh) reseeded the element from the STALE prop and
 * collapsed the caret to the end — silently eating whatever had been typed
 * since. These tests pin the seed to the edit-mode transition only.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { InlineText } from "./InlineText";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

/** React 19 checks this flag to decide whether act() is legal. */
declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function mount(value: string, onUpdate: (v: string) => void) {
  act(() => root.render(<InlineText as="span" value={value} onUpdate={onUpdate} />));
}

function enterEditMode() {
  const span = container.querySelector("span");
  act(() => span?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
  return container.querySelector<HTMLElement>("[contenteditable]");
}

describe("InlineText — typing is not clobbered by parent re-renders", () => {
  it("seeds the editor with the current value on entering edit mode", () => {
    mount("New person", () => {});
    expect(enterEditMode()?.textContent).toBe("New person");
  });

  it("a value prop change MID-EDIT does not overwrite what the user typed", () => {
    mount("New person", () => {});
    const el = enterEditMode()!;

    // The user types a name (the browser mutates the DOM directly).
    el.textContent = "Maya Chen";

    // A parent re-render arrives with a different value — an autosave
    // round-trip, or a sibling field committing. The editor must keep the
    // user's in-flight text.
    act(() => root.render(<InlineText as="span" value="Somebody Else" onUpdate={() => {}} />));

    expect(container.querySelector("[contenteditable]")?.textContent).toBe("Maya Chen");
  });

  it("a re-render with the SAME value is equally harmless", () => {
    mount("New person", () => {});
    const el = enterEditMode()!;
    el.textContent = "Maya Chen";
    act(() => root.render(<InlineText as="span" value="New person" onUpdate={() => {}} />));
    expect(container.querySelector("[contenteditable]")?.textContent).toBe("Maya Chen");
  });

  it("re-entering edit mode picks up the latest value", () => {
    mount("New person", () => {});
    enterEditMode();
    // Blur out, then the parent supplies a new value, then edit again.
    // React delegates onBlur through the bubbling `focusout` event — a
    // synthetic `blur` would never reach the handler.
    const el = container.querySelector<HTMLElement>("[contenteditable]")!;
    act(() => el.dispatchEvent(new FocusEvent("focusout", { bubbles: true })));
    act(() => root.render(<InlineText as="span" value="Maya Chen" onUpdate={() => {}} />));
    expect(enterEditMode()?.textContent).toBe("Maya Chen");
  });
});
