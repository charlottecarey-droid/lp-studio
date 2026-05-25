import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { extractAssetPaths } from "./assetRefs";

describe("extractAssetPaths — reference shapes", () => {
  it("finds <script type=module src=...> entrypoint", () => {
    const html = `<script type="module" crossorigin src="/assets/index-cF8OHOei.js"></script>`;
    expect(extractAssetPaths(html)).toEqual(["index-cF8OHOei.js"]);
  });

  it("finds <link rel=modulepreload href=...> chunks", () => {
    const html = `<link rel="modulepreload" crossorigin href="/assets/vendor-ui-BI93x8qG.js">`;
    expect(extractAssetPaths(html)).toEqual(["vendor-ui-BI93x8qG.js"]);
  });

  it("finds <link rel=stylesheet href=...>", () => {
    const html = `<link rel="stylesheet" crossorigin href="/assets/index-CfASPeAP.css">`;
    expect(extractAssetPaths(html)).toEqual(["index-CfASPeAP.css"]);
  });

  it("finds single-quoted attributes", () => {
    const html = `<script src='/assets/index-abc.js'></script>`;
    expect(extractAssetPaths(html)).toEqual(["index-abc.js"]);
  });

  it("finds unquoted (bare) attribute values", () => {
    const html = `<script src=/assets/index-abc.js></script>`;
    expect(extractAssetPaths(html)).toEqual(["index-abc.js"]);
  });

  it("finds CSS url(/assets/...) with no quotes", () => {
    const css = `@font-face { src: url(/assets/BagossStandard-Regular-DWIG9i3J.woff2) format("woff2"); }`;
    expect(extractAssetPaths(css)).toEqual([
      "BagossStandard-Regular-DWIG9i3J.woff2",
    ]);
  });

  it("finds CSS url('/assets/...') with single quotes", () => {
    const css = `background: url('/assets/bg-abc.png');`;
    expect(extractAssetPaths(css)).toEqual(["bg-abc.png"]);
  });

  it('finds CSS url("/assets/...") with double quotes', () => {
    const css = `background: url("/assets/bg-abc.png");`;
    expect(extractAssetPaths(css)).toEqual(["bg-abc.png"]);
  });

  it("finds all candidates in a srcset list", () => {
    // srcset is whitespace+comma separated. Each /assets/ ref after the
    // first is preceded by ", " (NOT a quote), so this exercises the
    // gap that the original regex missed.
    const html = `<img srcset="/assets/img-1x.png 1x, /assets/img-2x.png 2x" src="/assets/img-1x.png">`;
    expect(extractAssetPaths(html).sort()).toEqual(
      ["img-1x.png", "img-2x.png"].sort(),
    );
  });

  it("strips ?query and #hash from references", () => {
    const html =
      `<script src="/assets/index-abc.js?v=1"></script>` +
      `<link rel="preload" href="/assets/font-x.woff2#iefix">`;
    expect(extractAssetPaths(html).sort()).toEqual(
      ["font-x.woff2", "index-abc.js"].sort(),
    );
  });

  it("deduplicates repeated references", () => {
    const html =
      `<script src="/assets/index-abc.js"></script>` +
      `<link rel="modulepreload" href="/assets/index-abc.js">`;
    expect(extractAssetPaths(html)).toEqual(["index-abc.js"]);
  });

  it("returns [] for HTML with no /assets/ references", () => {
    const html = `<html><body><p>nothing here</p></body></html>`;
    expect(extractAssetPaths(html)).toEqual([]);
  });
});

describe("extractAssetPaths — bypass cases (must NOT match)", () => {
  it("does not match /assetsthing/ (different path prefix)", () => {
    const html = `<script src="/assetsthing/x.js"></script>`;
    expect(extractAssetPaths(html)).toEqual([]);
  });

  it("does not match cross-origin URLs that contain /assets/", () => {
    const html =
      `<script src="https://cdn.example.com/assets/x.js"></script>` +
      `<link href="//cdn.example.com/assets/x.css" rel="stylesheet">`;
    expect(extractAssetPaths(html)).toEqual([]);
  });

  it("does not match /assets/* literal in HTML comments", () => {
    // The real lp-studio index.html has this comment: "hashed /assets/*
    // filenames are picked up immediately". A regex that captured the
    // `*` would produce a phantom basename and fail the publish gate.
    const html = `<!-- deploy's hashed /assets/* filenames are picked up immediately -->`;
    expect(extractAssetPaths(html)).toEqual([]);
  });

  it("does not match prose mentioning /assets/...", () => {
    const html = `<p>Files live under the path/assets/foo directory.</p>`;
    expect(extractAssetPaths(html)).toEqual([]);
  });
});

describe("extractAssetPaths — real lp-studio build fixture", () => {
  // Snapshot of the current lp-studio production build's index.html.
  // Refresh with:
  //   cp artifacts/lp-studio/dist/public/index.html \
  //      artifacts/api-server/src/lib/__fixtures__/lp-studio-index.html
  const fixture = readFileSync(
    join(__dirname, "__fixtures__/lp-studio-index.html"),
    "utf-8",
  );

  // What a naive operator would do at the shell to enumerate references.
  // Matches `/assets/<name>` where the basename is bounded by anything
  // that can't appear in a Vite-hashed filename. This is intentionally
  // simple (and slightly over-permissive on the start side) — its job
  // is to be the ground-truth a human would compute by hand, not to be
  // the production extractor.
  function grepLikeReferences(html: string): Set<string> {
    const out = new Set<string>();
    const RE = /\/assets\/([A-Za-z0-9._-]+\.[A-Za-z0-9]+)(?=["'?# )<\s])/g;
    let m: RegExpExecArray | null;
    while ((m = RE.exec(html)) !== null) {
      out.add(m[1]);
    }
    return out;
  }

  it("extractor finds every reference grep finds", () => {
    const extracted = new Set(extractAssetPaths(fixture));
    const grepped = grepLikeReferences(fixture);
    const missed = [...grepped].filter((r) => !extracted.has(r));
    expect(missed).toEqual([]);
  });

  it("extractor finds the known load-bearing entrypoint + chunks", () => {
    // These are the references that, if missed, would break the page.
    // Hard-coded so the test is also a smoke test of the fixture itself
    // (if we ever refresh the fixture and these shapes disappear, that's
    // a signal that something material about the build output changed).
    const extracted = new Set(extractAssetPaths(fixture));
    for (const ref of [
      "index-cF8OHOei.js",
      "index-CfASPeAP.css",
      "vendor-ui-BI93x8qG.js",
      "vendor-charts-Cl_vRYoi.js",
      "vendor-editor-ZclGCwOj.js",
      "vendor-motion-DWU0KW_F.js",
      "MarketingApp-DGmcPOq9.js",
      "MarketingApp-D9sOtbLl.css",
    ]) {
      expect(extracted.has(ref), `missing ${ref}`).toBe(true);
    }
  });

  it("does not pick up the /assets/* literal from the comment in head", () => {
    const extracted = new Set(extractAssetPaths(fixture));
    expect([...extracted].some((r) => r.includes("*"))).toBe(false);
  });
});
