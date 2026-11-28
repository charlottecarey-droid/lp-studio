import { describe, expect, it } from "vitest";
import { buildReportEventPayload, parseReportEventMessage, reportAssetKey } from "./report-tracking";

describe("report tracking", () => {
  it("accepts known frame events and clamps values", () => {
    expect(parseReportEventMessage({ __lpReportEvent: { a: "page", v: 12.6, d: " 07|Central authority " } })).toEqual({ action: "page", value: 13, detail: "07|Central authority" });
    expect(parseReportEventMessage({ __lpReportEvent: { a: "assessment", v: 20, d: "Ready to pilot" } })?.value).toBe(20);
    expect(parseReportEventMessage({ __lpReportEvent: { a: "page", v: -5 } })).toEqual({ action: "page" });
  });

  it("rejects unknown actions, and view (the parent sends that)", () => {
    expect(parseReportEventMessage({ __lpReportEvent: { a: "hover" } })).toBeNull();
    expect(parseReportEventMessage({ __lpReportEvent: { a: "view" } })).toBeNull();
    expect(parseReportEventMessage({ __lpReportEvent: { a: "unlock" } })).toBeNull();
    expect(parseReportEventMessage({ __lpReportEvent: { a: "gate", d: "shown" } })).toEqual({ action: "gate", detail: "shown" });
    expect(parseReportEventMessage({ other: 1 })).toBeNull();
    expect(parseReportEventMessage(null)).toBeNull();
  });

  it("derives a stable key", () => {
    expect(reportAssetKey({ trackingKey: " cg-2027 ", title: "X" })).toBe("cg-2027");
    expect(reportAssetKey({ title: "The 2027 Consolidation Gap Report" })).toBe("the-2027-consolidation-gap-report");
    expect(reportAssetKey({ src: "/reports/consolidation-gap-2027/report.html" })).toBe("consolidation-gap-2027-report");
  });

  it("builds a report-kind payload only with a tracking context", () => {
    expect(buildReportEventPayload({}, { key: "k", title: "T" }, { action: "page", value: 3 })).toBeNull();
    expect(buildReportEventPayload({ pageId: 5, sessionId: "s", blockId: "b" }, { key: "k", title: "T" }, { action: "page", value: 3, detail: "01|Cover" })).toMatchObject({
      pageId: 5, sessionId: "s", blockId: "b", assetKey: "k", assetTitle: "T", assetKind: "report", action: "page", value: 3, detail: "01|Cover",
    });
  });
});
