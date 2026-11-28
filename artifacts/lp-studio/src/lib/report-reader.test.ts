import { describe, expect, it } from "vitest";
import { buildReportSrcDoc, isAllowedReportSrc } from "./report-reader";

const cfg = { title: "Report", pdfUrl: "/r/report.pdf", view: "auto" as const, allowViewToggle: true };

describe("isAllowedReportSrc", () => {
  it("accepts https and same-origin paths", () => {
    expect(isAllowedReportSrc("https://example.com/r.html")).toBe(true);
    expect(isAllowedReportSrc("/reports/x/report.html")).toBe(true);
  });
  it("rejects other schemes and protocol-relative URLs", () => {
    expect(isAllowedReportSrc("javascript:alert(1)")).toBe(false);
    expect(isAllowedReportSrc("data:text/html,hi")).toBe(false);
    expect(isAllowedReportSrc("//evil.example/r.html")).toBe(false);
    expect(isAllowedReportSrc("")).toBe(false);
  });
});

describe("buildReportSrcDoc", () => {
  it("returns empty for empty input", () => {
    expect(buildReportSrcDoc("  ", cfg)).toBe("");
  });

  it("injects viewer into an existing head and before </body>", () => {
    const out = buildReportSrcDoc('<html><head><title>x</title></head><body><section class="page">1</section></body></html>', cfg);
    expect(out.indexOf('<base target="_top">')).toBeGreaterThan(out.indexOf("<head>"));
    expect(out.indexOf("window.__RR=")).toBeLessThan(out.lastIndexOf("</body>"));
    expect(out).toContain('<section class="page">1</section>');
  });

  it("wraps a fragment in a document", () => {
    const out = buildReportSrcDoc('<section class="page">1</section>', cfg);
    expect(out.startsWith("<!DOCTYPE html>")).toBe(true);
    expect(out).toContain("window.__RR=");
  });

  it("drops unsafe PDF links and can't break out of the config script", () => {
    const out = buildReportSrcDoc("<p>x</p>", { ...cfg, pdfUrl: "javascript:alert(1)", title: "</script><script>alert(1)</script>" });
    expect(out).not.toContain("javascript:alert(1)");
    expect(out).not.toContain("</script><script>alert(1)");
  });

  it("normalises unknown views to auto", () => {
    const out = buildReportSrcDoc("<p>x</p>", { ...cfg, view: "weird" as never });
    expect(out).toContain('"view":"auto"');
  });
});
