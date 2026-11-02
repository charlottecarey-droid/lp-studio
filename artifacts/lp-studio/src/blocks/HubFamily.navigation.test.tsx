// @vitest-environment jsdom
/**
 * Content Hub — the family owns its navigation (Nov 2026 regression guard).
 *
 * On the Dandy Sleep home page, "I'm a patient" (hub-hero secondary button)
 * and "Open the patient library" (second hub-paths card) opened the DENTIST
 * hub on top of the patient hub. BlockRenderer handed both blocks the
 * viewer's `onCtaClick`, which opens the URL it is given in a NEW tab — and
 * it was given one URL per block: the hero's PRIMARY `ctaUrl` and the FIRST
 * path card's `ctaUrl`. The block then navigated the current tab to the right
 * place, so every secondary click spawned a `/dentists` tab as well.
 *
 * Rendered through the REAL BlockRenderer with a host `onCtaClick` spy:
 * each button must navigate itself (same tab, its own URL) and the host
 * handler must never fire for either block.
 */
import { createElement } from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ safeNavigate: vi.fn() }));
vi.mock("@/lib/safe-url", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/safe-url")>();
  return { ...actual, safeNavigate: nav.safeNavigate };
});

// The path cards reveal on scroll (framer-motion `whileInView`), which needs
// an IntersectionObserver jsdom does not ship.
class NoopIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() { return []; }
}
(globalThis as { IntersectionObserver?: unknown }).IntersectionObserver ??= NoopIntersectionObserver;

import { BlockRenderer } from "./BlockRenderer";
import { DEFAULT_BRAND } from "@/lib/brand-config";
import type { PageBlock } from "@/lib/block-types";

const hero: PageBlock = {
  id: "home-hub-hero-1",
  type: "hub-hero",
  props: {
    theme: "gallery",
    navLinks: [
      { label: "For dentists", url: "/dentists" },
      { label: "For patients", url: "/patients" },
    ],
    headline: "Better sleep, treated by your dentist.",
    ctaText: "I'm a dental professional",
    ctaAction: "url",
    ctaUrl: "/dentists",
    ctaSecondaryText: "I'm a patient",
    ctaSecondaryAction: "url",
    ctaSecondaryUrl: "/patients",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any,
} as PageBlock;

const paths: PageBlock = {
  id: "home-hub-paths-2",
  type: "hub-paths",
  props: {
    headline: "Who are you here for?",
    paths: [
      { title: "I'm a dental professional", ctaText: "Open the dentist library", ctaUrl: "/dentists" },
      { title: "I'm a patient", ctaText: "Open the patient library", ctaUrl: "/patients" },
    ],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any,
} as PageBlock;

function mount(block: PageBlock) {
  const onCtaClick = vi.fn();
  const utils = render(createElement(BlockRenderer, { block, brand: DEFAULT_BRAND, onCtaClick }));
  return { ...utils, onCtaClick };
}

function clickable(el: Element): HTMLElement {
  const target = el.closest("a,button");
  if (!target) throw new Error("no clickable ancestor");
  return target as HTMLElement;
}

beforeEach(() => nav.safeNavigate.mockReset());
afterEach(cleanup);

describe("hub-hero — the secondary button goes to ITS url, in this tab, and only there", () => {
  it("\"I'm a patient\" navigates to /patients and never reaches the host handler", () => {
    const { getByText, onCtaClick } = mount(hero);
    fireEvent.click(clickable(getByText("I'm a patient")));
    expect(nav.safeNavigate).toHaveBeenCalledTimes(1);
    expect(nav.safeNavigate).toHaveBeenCalledWith("/patients", "_self");
    expect(onCtaClick).not.toHaveBeenCalled();
  });

  it("the primary button navigates exactly once, to /dentists, in this tab", () => {
    const { getByText, onCtaClick } = mount(hero);
    fireEvent.click(clickable(getByText("I'm a dental professional")));
    expect(nav.safeNavigate).toHaveBeenCalledTimes(1);
    expect(nav.safeNavigate).toHaveBeenCalledWith("/dentists", "_self");
    expect(onCtaClick).not.toHaveBeenCalled();
  });
});

describe("hub-paths — each card goes to ITS hub, in this tab, and only there", () => {
  it("\"Open the patient library\" (second card) navigates to /patients, not the first card's hub", () => {
    const { container, onCtaClick } = mount(paths);
    const ctas = container.querySelectorAll<HTMLAnchorElement>("[data-hub-path-cta]");
    expect(ctas.length).toBe(2);
    expect(ctas[1].getAttribute("href")).toBe("/patients");
    expect(ctas[1].textContent).toContain("Open the patient library");
    fireEvent.click(ctas[1]);
    expect(nav.safeNavigate).toHaveBeenCalledTimes(1);
    expect(nav.safeNavigate).toHaveBeenCalledWith("/patients", "_self");
    expect(onCtaClick).not.toHaveBeenCalled();
  });

  it("the first card still navigates once, to /dentists", () => {
    const { container, onCtaClick } = mount(paths);
    fireEvent.click(container.querySelectorAll("[data-hub-path-cta]")[0]);
    expect(nav.safeNavigate).toHaveBeenCalledTimes(1);
    expect(nav.safeNavigate).toHaveBeenCalledWith("/dentists", "_self");
    expect(onCtaClick).not.toHaveBeenCalled();
  });
});
