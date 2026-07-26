/**
 * makePortableHtml — pure-transform tests for the static HTML export.
 * Covers: script stripping (JSON-LD kept), preload-hint removal, and
 * absolutization of root-relative URLs in attributes, srcset, and CSS url().
 */
import { describe, it, expect } from "vitest";
import { makePortableHtml } from "./export-html";

const ORIGIN = "https://acme.lpstudio.ai";
const SOURCE = "https://acme.lpstudio.ai/spring-promo";

function portable(html: string): string {
  return makePortableHtml(html, ORIGIN, SOURCE);
}

describe("makePortableHtml", () => {
  it("strips app scripts but keeps JSON-LD structured data", () => {
    const html = `<!doctype html><html><head>
      <script type="module" crossorigin src="/assets/index-cF8OHOei.js"></script>
      <script>window.__X__ = 1;</script>
      <script type="application/ld+json">{"@type":"LocalBusiness"}</script>
      </head><body><div id="root">hi</div></body></html>`;
    const out = portable(html);
    expect(out).not.toContain("index-cF8OHOei.js");
    expect(out).not.toContain("window.__X__");
    expect(out).toContain('"@type":"LocalBusiness"');
  });

  it("removes modulepreload and script-preload link hints", () => {
    const html = `<!doctype html><head>
      <link rel="modulepreload" crossorigin href="/assets/vendor-abc.js">
      <link rel="preload" as="script" href="/assets/lazy.js">
      <link rel="stylesheet" crossorigin href="/assets/index-CfASPeAP.css">
      </head>`;
    const out = portable(html);
    expect(out).not.toContain("modulepreload");
    expect(out).not.toContain("lazy.js");
    // stylesheet survives AND gets absolutized
    expect(out).toContain(`href="${ORIGIN}/assets/index-CfASPeAP.css"`);
  });

  it("strips crossorigin/integrity from surviving <link> tags so styles load on foreign hosts", () => {
    const html = `<!doctype html><head>
      <link rel="stylesheet" crossorigin href="/assets/index-CfASPeAP.css">
      <link rel="stylesheet" crossorigin="" href="/assets/vendor.css">
      <link rel="stylesheet" crossorigin="anonymous" integrity="sha384-abc" href="/assets/theme.css">
      <link rel="icon" href="/favicon.svg">
      </head>`;
    const out = portable(html);
    expect(out).not.toContain("crossorigin");
    expect(out).not.toContain("integrity");
    expect(out).toContain(`href="${ORIGIN}/assets/index-CfASPeAP.css"`);
    expect(out).toContain(`href="${ORIGIN}/assets/vendor.css"`);
    expect(out).toContain(`href="${ORIGIN}/assets/theme.css"`);
    expect(out).toContain(`href="${ORIGIN}/favicon.svg"`);
  });

  it("absolutizes root-relative href/src but leaves protocol-relative and absolute URLs alone", () => {
    const html = `<!doctype html><body>
      <img src="/api/storage/serve/123.jpg">
      <a href="/spring-promo">home</a>
      <img src="//cdn.example.com/x.png">
      <img src="https://images.example.com/y.png">
      <link rel="icon" href='/lpstudio-favicon.svg'>
      </body>`;
    const out = portable(html);
    expect(out).toContain(`src="${ORIGIN}/api/storage/serve/123.jpg"`);
    expect(out).toContain(`href="${ORIGIN}/spring-promo"`);
    expect(out).toContain('src="//cdn.example.com/x.png"');
    expect(out).toContain('src="https://images.example.com/y.png"');
    expect(out).toContain(`href='${ORIGIN}/lpstudio-favicon.svg'`);
  });

  it("absolutizes every root-relative candidate in srcset", () => {
    const html = `<!doctype html><img srcset="/img/a.jpg 1x, /img/b.jpg 2x, https://c.dn/c.jpg 3x">`;
    const out = portable(html);
    expect(out).toContain(`srcset="${ORIGIN}/img/a.jpg 1x, ${ORIGIN}/img/b.jpg 2x, https://c.dn/c.jpg 3x"`);
  });

  it("absolutizes css url() in style attributes and <style> blocks", () => {
    const html = `<!doctype html><style>.hero{background-image:url(/assets/bg.webp)}</style>
      <div style="background-image:url('/api/storage/serve/h.jpg')"></div>`;
    const out = portable(html);
    expect(out).toContain(`url(${ORIGIN}/assets/bg.webp)`);
    expect(out).toContain(`url('${ORIGIN}/api/storage/serve/h.jpg')`);
  });

  it("inserts the provenance comment right after the doctype", () => {
    const out = portable(`<!DOCTYPE html><html></html>`);
    expect(out.indexOf("<!DOCTYPE html>")).toBe(0);
    const comment = out.indexOf("Static HTML export from LP Studio");
    expect(comment).toBeGreaterThan(0);
    expect(comment).toBeLessThan(out.indexOf("<html>"));
    expect(out).toContain(SOURCE);
  });

  it("prepends the comment when no doctype exists", () => {
    const out = portable(`<html><body></body></html>`);
    expect(out.startsWith("<!--")).toBe(true);
  });
});
