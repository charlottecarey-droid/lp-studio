// Unit tests for the shared robots-meta resolution (task #494). Both the
// api-server prerender path and the lp-studio SPA viewer rely on these pure
// helpers, so the test matrix here pins the cross-process contract: a change
// that alters resolution breaks the published file AND the in-app preview in
// lock-step.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveRobotsMeta, robotsMetaContent } from "./robots.ts";

describe("resolveRobotsMeta — inherit vs override", () => {
  it("inherits both tenant defaults when page overrides are null", () => {
    const r = resolveRobotsMeta({
      pageAllowIndexing: null,
      pageAllowFollowing: null,
      tenantAllowIndexing: true,
      tenantAllowFollowing: false,
    });
    assert.deepEqual(r, {
      indexing: true,
      following: false,
      indexingSource: "tenant",
      followingSource: "tenant",
    });
  });

  it("inherits when page overrides are undefined", () => {
    const r = resolveRobotsMeta({
      pageAllowIndexing: undefined,
      pageAllowFollowing: undefined,
      tenantAllowIndexing: false,
      tenantAllowFollowing: true,
    });
    assert.equal(r.indexing, false);
    assert.equal(r.following, true);
    assert.equal(r.indexingSource, "tenant");
    assert.equal(r.followingSource, "tenant");
  });

  it("page override of false wins over a tenant default of true", () => {
    const r = resolveRobotsMeta({
      pageAllowIndexing: false,
      pageAllowFollowing: false,
      tenantAllowIndexing: true,
      tenantAllowFollowing: true,
    });
    assert.equal(r.indexing, false);
    assert.equal(r.following, false);
    assert.equal(r.indexingSource, "page");
    assert.equal(r.followingSource, "page");
  });

  it("page override of true wins over a tenant default of false", () => {
    const r = resolveRobotsMeta({
      pageAllowIndexing: true,
      pageAllowFollowing: true,
      tenantAllowIndexing: false,
      tenantAllowFollowing: false,
    });
    assert.equal(r.indexing, true);
    assert.equal(r.following, true);
    assert.equal(r.indexingSource, "page");
    assert.equal(r.followingSource, "page");
  });

  it("resolves each axis independently (page indexing, inherited following)", () => {
    const r = resolveRobotsMeta({
      pageAllowIndexing: false,
      pageAllowFollowing: null,
      tenantAllowIndexing: true,
      tenantAllowFollowing: true,
    });
    assert.equal(r.indexing, false);
    assert.equal(r.indexingSource, "page");
    assert.equal(r.following, true);
    assert.equal(r.followingSource, "tenant");
  });
});

describe("robotsMetaContent — directive string", () => {
  it("returns null when fully allowed (no redundant index,follow)", () => {
    assert.equal(robotsMetaContent({ indexing: true, following: true }), null);
  });

  it("emits noindex when only indexing is denied", () => {
    assert.equal(robotsMetaContent({ indexing: false, following: true }), "noindex");
  });

  it("emits nofollow when only following is denied", () => {
    assert.equal(robotsMetaContent({ indexing: true, following: false }), "nofollow");
  });

  it("emits noindex,nofollow when both are denied", () => {
    assert.equal(
      robotsMetaContent({ indexing: false, following: false }),
      "noindex,nofollow",
    );
  });
});

describe("end-to-end resolution → content matrix (spec test matrix)", () => {
  const content = (input: Parameters<typeof resolveRobotsMeta>[0]) =>
    robotsMetaContent(resolveRobotsMeta(input));

  it("tenant-off / page-inherit → noindex (following still allowed)", () => {
    assert.equal(
      content({
        pageAllowIndexing: null,
        pageAllowFollowing: null,
        tenantAllowIndexing: false,
        tenantAllowFollowing: true,
      }),
      "noindex",
    );
  });

  it("tenant-on / page-override-off → noindex", () => {
    assert.equal(
      content({
        pageAllowIndexing: false,
        pageAllowFollowing: null,
        tenantAllowIndexing: true,
        tenantAllowFollowing: true,
      }),
      "noindex",
    );
  });

  it("tenant-off / page-override-on → no tag", () => {
    assert.equal(
      content({
        pageAllowIndexing: true,
        pageAllowFollowing: true,
        tenantAllowIndexing: false,
        tenantAllowFollowing: false,
      }),
      null,
    );
  });

  it("both off (new-tenant ABM default) → noindex,nofollow", () => {
    assert.equal(
      content({
        pageAllowIndexing: null,
        pageAllowFollowing: null,
        tenantAllowIndexing: false,
        tenantAllowFollowing: false,
      }),
      "noindex,nofollow",
    );
  });

  it("existing-tenant migration default (both true) → no tag (zero HTML diff)", () => {
    assert.equal(
      content({
        pageAllowIndexing: null,
        pageAllowFollowing: null,
        tenantAllowIndexing: true,
        tenantAllowFollowing: true,
      }),
      null,
    );
  });
});
