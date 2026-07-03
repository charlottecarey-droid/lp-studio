// @vitest-environment jsdom
/**
 * sanitizeBlockTemplateHtml — the render sanitizer for schema-driven custom
 * block templates. Pins the July 2026 regression fix: the general-purpose
 * sanitizeHtml FORBIDs <style>, so every custom block rendered with ALL of
 * its CSS stripped (raw links, unstyled lists — "the block generator isn't
 * working") from the May 2026 hardening until this dedicated sanitizer.
 */
import { describe, expect, it } from "vitest";
import { sanitizeBlockTemplateHtml, sanitizeHtml } from "./sanitize";

const TEMPLATE = `<section class="blk-hero"><style>.blk-hero{padding:clamp(48px,8vw,96px) 24px;background:var(--brand-page-bg,#FDFCFA)}.blk-hero h2{font-size:clamp(28px,4.5vw,44px)}</style><h2>Making a Difference</h2><a href="/contact">Talk to us</a></section>`;

describe("sanitizeBlockTemplateHtml", () => {
  it("keeps the template's <style> (the whole point) including var() expressions", () => {
    const out = sanitizeBlockTemplateHtml(TEMPLATE);
    expect(out).toContain("<style>");
    expect(out).toContain("clamp(28px,4.5vw,44px)");
    expect(out).toContain("var(--brand-page-bg,#FDFCFA)");
  });

  it("documents the regression: the general sanitizer strips the same <style>", () => {
    const out = sanitizeHtml(TEMPLATE);
    expect(out).not.toContain("<style>");
    expect(out).not.toContain("clamp(");
  });

  it("still strips scripts, iframes, and event handlers", () => {
    const out = sanitizeBlockTemplateHtml(
      `<div><script>alert(1)</script><iframe src="https://x"></iframe><a href="#" onclick="x()">go</a><style>.a{color:red}</style></div>`,
    );
    expect(out).not.toContain("<script");
    expect(out).not.toContain("<iframe");
    expect(out).not.toContain("onclick");
    expect(out).toContain("<style>");
  });

  it("strips @import from style contents but leaves the rest of the CSS", () => {
    const out = sanitizeBlockTemplateHtml(
      `<div><style>@import url("https://evil.example/x.css");.blk{color:#111}</style></div>`,
    );
    expect(out).not.toContain("@import");
    expect(out).not.toContain("evil.example");
    expect(out).toContain(".blk{color:#111}");
  });

  it("keeps background <video> with its autoplay attrs", () => {
    const out = sanitizeBlockTemplateHtml(
      `<video autoplay muted loop playsinline poster="/p.jpg"><source src="/v.mp4" type="video/mp4" /></video>`,
    );
    expect(out).toContain("<video");
    expect(out).toContain("autoplay");
    expect(out).toContain("<source");
  });
});
