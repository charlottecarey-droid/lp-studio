import { describe, it, expect } from "vitest";
import { collectTeamPhotoUrls } from "./teamPhotoTagging";

describe("collectTeamPhotoUrls", () => {
  it("pulls every dso-meet-team member photo, deduped and trimmed", () => {
    const blocks = [
      { type: "dso-hero", props: { heroImageUrl: "/hero.jpg" } },
      {
        type: "dso-meet-team",
        props: {
          members: [
            { name: "A", role: "Rep", photo: "/rep-a.jpg" },
            { name: "B", role: "Rep", photo: " /rep-b.jpg " },
            { name: "C", role: "Rep" }, // no photo
            { name: "D", role: "Rep", photo: "/rep-a.jpg" }, // dup
          ],
        },
      },
    ];
    expect(collectTeamPhotoUrls(blocks).sort()).toEqual(["/rep-a.jpg", "/rep-b.jpg"]);
  });

  it("recurses into nested container children", () => {
    const blocks = [
      {
        type: "columns",
        children: [
          { type: "dso-meet-team", props: { members: [{ photo: "/nested.jpg" }] } },
        ],
      },
    ];
    expect(collectTeamPhotoUrls(blocks)).toEqual(["/nested.jpg"]);
  });

  it("ignores non-team blocks and hero images (so a hero photo is never reserved)", () => {
    const blocks = [
      { type: "dso-hero", props: { heroImageUrl: "/hero.jpg", photo: "/decoy.jpg" } },
      { type: "product-grid", props: { items: [{ photo: "/product.jpg" }] } },
    ];
    expect(collectTeamPhotoUrls(blocks)).toEqual([]);
  });

  it("is safe on malformed input", () => {
    expect(collectTeamPhotoUrls(null)).toEqual([]);
    expect(collectTeamPhotoUrls(undefined)).toEqual([]);
    expect(collectTeamPhotoUrls("nope")).toEqual([]);
    expect(collectTeamPhotoUrls([{ type: "dso-meet-team" }])).toEqual([]);
    expect(collectTeamPhotoUrls([{ type: "dso-meet-team", props: { members: "x" } }])).toEqual([]);
  });
});
