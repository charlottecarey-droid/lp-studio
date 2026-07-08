// @vitest-environment jsdom
/**
 * PageHint visibility contract: shows on first sight (stamping a first-seen
 * timestamp), hides permanently on manual dismiss, and SELF-RETIRES once the
 * first-seen timestamp is older than the expiry window — hints are onboarding
 * aids, not permanent chrome.
 */
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PageHint } from "./page-hint";

const DAY_MS = 86_400_000;

describe("PageHint", () => {
  beforeEach(() => localStorage.clear());
  afterEach(cleanup);

  it("shows on first sight and stamps a first-seen timestamp", () => {
    render(<PageHint id="t1" title="Hello" description="World" />);
    expect(screen.getByText("Hello")).toBeTruthy();
    expect(Number(localStorage.getItem("hint-first-seen-t1"))).toBeGreaterThan(0);
  });

  it("stays hidden after a manual dismiss", () => {
    render(<PageHint id="t2" title="Hello" description="World" />);
    fireEvent.click(screen.getByTitle("Dismiss"));
    expect(screen.queryByText("Hello")).toBeNull();
    expect(localStorage.getItem("hint-dismissed-t2")).toBe("1");
    cleanup();
    render(<PageHint id="t2" title="Hello" description="World" />);
    expect(screen.queryByText("Hello")).toBeNull();
  });

  it("still shows while the first-seen stamp is inside the expiry window", () => {
    localStorage.setItem("hint-first-seen-t3", String(Date.now() - 2 * DAY_MS));
    render(<PageHint id="t3" title="Hello" description="World" />);
    expect(screen.getByText("Hello")).toBeTruthy();
  });

  it("self-retires once first seen more than 7 days ago", () => {
    localStorage.setItem("hint-first-seen-t4", String(Date.now() - 8 * DAY_MS));
    render(<PageHint id="t4" title="Hello" description="World" />);
    expect(screen.queryByText("Hello")).toBeNull();
  });
});
