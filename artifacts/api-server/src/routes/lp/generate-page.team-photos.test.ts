/**
 * Task #1168 — deterministic team-photo reconciliation for `dso-meet-team`.
 *
 * Task #1158 has the AI copy each saved team member's headshot URL verbatim into
 * the block, but that relies on the model faithfully echoing the prompt's URLs.
 * `reconcileTeamMemberPhotos` is the post-generation pass that guarantees
 * correctness: every member's `photo` is forced to the saved `team_member` row's
 * value (matched by email/name) and any member with no saved match has its photo
 * cleared. These tests exercise the pure helper (no DB, no network).
 */
import { describe, it, expect } from "vitest";
import { reconcileTeamMemberPhotos, type TeamMember } from "./generate-page";

const team: TeamMember[] = [
  { name: "Jane Doe", role: "Account Lead", email: "jane@acme.com", photo: "/api/storage/jane.jpg" },
  { name: "John Smith", role: "Clinical Rep", email: "john@acme.com", photo: "/api/storage/john.jpg" },
];

function teamBlock(members: Array<Record<string, unknown>>) {
  return { type: "dso-meet-team", props: { headline: "Meet the team", members } };
}

describe("reconcileTeamMemberPhotos", () => {
  it("overwrites a model-swapped photo with the saved headshot (email match)", () => {
    const block = teamBlock([
      { name: "Jane Doe", role: "Account Lead", email: "jane@acme.com", photo: "/api/storage/random-dinner.jpg" },
    ]);
    reconcileTeamMemberPhotos([block], team);
    expect((block.props.members[0] as Record<string, unknown>).photo).toBe("/api/storage/jane.jpg");
  });

  it("fills a dropped photo from the saved row", () => {
    const block = teamBlock([
      { name: "John Smith", role: "Clinical Rep", email: "john@acme.com", photo: "" },
    ]);
    reconcileTeamMemberPhotos([block], team);
    expect((block.props.members[0] as Record<string, unknown>).photo).toBe("/api/storage/john.jpg");
  });

  it("matches by normalized name when email is missing/different", () => {
    const block = teamBlock([
      { name: "  jane   doe ", role: "Account Lead", email: "", photo: "/api/storage/wrong.jpg" },
    ]);
    reconcileTeamMemberPhotos([block], team);
    expect((block.props.members[0] as Record<string, unknown>).photo).toBe("/api/storage/jane.jpg");
  });

  it("prefers email over name when they point at different saved rows", () => {
    const block = teamBlock([
      { name: "John Smith", email: "jane@acme.com", photo: "/api/storage/x.jpg" },
    ]);
    reconcileTeamMemberPhotos([block], team);
    // Email (jane) wins over the name (John).
    expect((block.props.members[0] as Record<string, unknown>).photo).toBe("/api/storage/jane.jpg");
  });

  it("clears the photo for a member that matches no saved row (no fabricated/library images)", () => {
    const block = teamBlock([
      { name: "Made Up Person", role: "Ghost", email: "ghost@nowhere.com", photo: "/api/storage/lifestyle.jpg" },
    ]);
    reconcileTeamMemberPhotos([block], team);
    expect((block.props.members[0] as Record<string, unknown>).photo).toBe("");
  });

  it("clears every member photo when the tenant has no saved team members", () => {
    const block = teamBlock([
      { name: "Jane Doe", email: "jane@acme.com", photo: "/api/storage/jane.jpg" },
      { name: "John Smith", email: "john@acme.com", photo: "/api/storage/john.jpg" },
    ]);
    reconcileTeamMemberPhotos([block], []);
    expect((block.props.members[0] as Record<string, unknown>).photo).toBe("");
    expect((block.props.members[1] as Record<string, unknown>).photo).toBe("");
  });

  it("forces an empty photo when the matched saved row has no headshot", () => {
    const noPhotoTeam: TeamMember[] = [
      { name: "Jane Doe", role: "Account Lead", email: "jane@acme.com", photo: "" },
    ];
    const block = teamBlock([
      { name: "Jane Doe", email: "jane@acme.com", photo: "/api/storage/arbitrary.jpg" },
    ]);
    reconcileTeamMemberPhotos([block], noPhotoTeam);
    expect((block.props.members[0] as Record<string, unknown>).photo).toBe("");
  });

  it("leaves non team blocks untouched", () => {
    const hero = { type: "hero", props: { imageUrl: "/api/storage/hero.jpg" } };
    reconcileTeamMemberPhotos([hero], team);
    expect(hero.props.imageUrl).toBe("/api/storage/hero.jpg");
  });

  it("tolerates malformed blocks/members without throwing", () => {
    const blocks = [
      null,
      { type: "dso-meet-team" },
      { type: "dso-meet-team", props: {} },
      { type: "dso-meet-team", props: { members: "nope" } },
      { type: "dso-meet-team", props: { members: [null, 42, { name: "Jane Doe", email: "jane@acme.com", photo: "x" }] } },
    ] as unknown[];
    expect(() => reconcileTeamMemberPhotos(blocks, team)).not.toThrow();
    const members = (blocks[4] as { props: { members: Array<Record<string, unknown>> } }).props.members;
    expect(members[2].photo).toBe("/api/storage/jane.jpg");
  });
});
