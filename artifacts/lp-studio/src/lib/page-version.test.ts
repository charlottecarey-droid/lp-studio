import { describe, expect, it } from "vitest";
import { PageChangedError, getPageVersion, pageChangedFrom, setPageVersion } from "./page-version";

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("builder stale-save guard (client)", () => {
  it("remembers the saved blocks' fingerprint per page, ignoring empty values", () => {
    setPageVersion(101, "abc");
    setPageVersion("101", "");
    setPageVersion(101, undefined);
    expect(getPageVersion("101")).toBe("abc");
    expect(getPageVersion(102)).toBeUndefined();
  });

  it("turns a 409 page_changed into PageChangedError with who and when", async () => {
    const err = await pageChangedFrom(json(409, { code: "page_changed", updatedAt: "2026-11-22T19:18:09.222Z", updatedBy: "Charlotte" }));
    expect(err).toBeInstanceOf(PageChangedError);
    expect(err?.updatedBy).toBe("Charlotte");
    expect(err?.updatedAt).toBe("2026-11-22T19:18:09.222Z");
  });

  it("leaves every other response alone (other 409s, successes, non-JSON)", async () => {
    expect(await pageChangedFrom(json(409, { code: "fact_flags_pending" }))).toBeNull();
    expect(await pageChangedFrom(json(200, { code: "page_changed" }))).toBeNull();
    expect(await pageChangedFrom(new Response("nope", { status: 409 }))).toBeNull();
    // The body is still readable afterwards (the Strict Facts gate reads it next).
    const res = json(409, { code: "fact_flags_pending" });
    await pageChangedFrom(res);
    expect(await res.json()).toEqual({ code: "fact_flags_pending" });
  });
});
