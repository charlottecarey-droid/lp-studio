import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

/**
 * SSR + contract test for the Partner Room workspace (room-workspace).
 *
 * Pins: the default props render on the neutral brand with no Dandy strings;
 * the cover shows both names and "Make a request"; only the landing module is
 * rendered at a time and a hidden module leaves the nav; hiding Requests also
 * removes "Make a request"; without a kickoff date nothing claims a day; the
 * day / phase / key helpers behave (the key rule is shared with the server).
 */
import { DEFAULT_BRAND } from "@/lib/brand-config";
import { BLOCK_REGISTRY } from "@/lib/block-types";
import {
  BlockRoomWorkspace,
  ROOM_WORKSPACE_DEFAULT_PROPS,
  phaseStates,
  resolveRoomStatus,
  rolloutDay,
  roomMilestoneKey,
  visibleModules,
  type RoomWorkspaceBlockProps,
} from "./BlockRoomWorkspace";

const BRAND = { ...DEFAULT_BRAND, brandName: "Northwind" };
const render = (props: Partial<RoomWorkspaceBlockProps> = {}) =>
  renderToStaticMarkup(createElement(BlockRoomWorkspace, { props: { ...structuredClone(ROOM_WORKSPACE_DEFAULT_PROPS), ...props }, brand: BRAND }));

describe("room-workspace — registry + default render", () => {
  it("is registered as a full-page template with neutral defaults", () => {
    const def = BLOCK_REGISTRY.find((d) => d.type === "room-workspace");
    expect(def?.category).toBe("Full Page Templates");
    expect(JSON.stringify(def?.defaultProps())).not.toMatch(/dandy|mb2|dental|#003a30/i);
  });
  it("renders the cover with both names, a single h1, the module list and the overview", () => {
    const html = render();
    expect(html).toContain("Acme Group × Northwind");
    expect((html.match(/<h1/g) ?? []).length).toBe(1);
    expect(html).toContain("data-room-request-button");
    expect((html.match(/data-room-nav="/g) ?? []).length).toBe(7);
    expect(html).toContain('data-room-view="overview"');
    expect(html).toContain("Where things stand");
    expect(html).not.toContain("One shared plan"); // other modules are separate views
    expect(html).not.toMatch(/<img[^>]*src=""/);
  });
  it("claims no day or phase state without a kickoff date", () => {
    const html = render({ kickoffDate: "" });
    expect(html).not.toMatch(/Day \d/);
    expect(html).not.toContain("In progress");
    expect(html).toContain("1 of 5"); // one default milestone is done
  });
});

describe("room-workspace — modules can be hidden per account", () => {
  it("drops hidden modules from the nav; hiding Requests removes Make a request", () => {
    const html = render({ hiddenModules: ["requests", "team"] });
    expect((html.match(/data-room-nav="/g) ?? []).length).toBe(5);
    expect(html).not.toContain('data-room-nav="requests"');
    expect(html).not.toContain("data-room-request-button");
  });
  it("lands on the first visible module, and never hides everything", () => {
    expect(render({ hiddenModules: ["overview", "wins"] })).toContain('data-room-view="plan"');
    expect(visibleModules(["overview", "wins", "plan", "marketing", "kit", "requests", "team"]).map((m) => m.key)).toEqual(["overview"]);
    expect(visibleModules(undefined)).toHaveLength(7);
  });
  it("the action plan shows both owners, a checkpoint, and customer actions with no file link", () => {
    const html = render({ hiddenModules: ["overview", "wins"] });
    expect(html).toContain("Executive sponsor");
    expect(html).toContain("Account lead");
    expect(html).toContain("Checkpoint");
    expect(html).toContain('data-room-action="upload"');
    expect(html).toContain("Upload roster");
    expect(html).toContain('data-room-action="check"');
    expect(html).not.toContain("/api/storage");
  });
});

describe("room-workspace — helpers", () => {
  it("counts the rollout day from kickoff (kickoff = day 1) and ignores bad dates", () => {
    expect(rolloutDay("2026-10-03", new Date(2026, 9, 3))).toBe(1);
    expect(rolloutDay("2026-10-03", new Date(2026, 10, 13))).toBe(42);
    expect(rolloutDay("2026-10-03", new Date(2026, 9, 1))).toBeNull();
    for (const bad of ["", undefined, "Oct 3", "2026-13"]) expect(rolloutDay(bad, new Date())).toBeNull();
  });
  it("marks phases done / current / upcoming from the day", () => {
    const phases = [{ title: "A", endDay: 30 }, { title: "B", endDay: 60 }, { title: "C", endDay: 90 }];
    expect(phaseStates(phases, 42)).toEqual(["done", "current", "upcoming"]);
    expect(phaseStates(phases, 30)).toEqual(["current", "upcoming", "upcoming"]);
    expect(phaseStates(phases, 120)).toEqual(["done", "done", "done"]);
    expect(phaseStates(phases, null)).toEqual(["upcoming", "upcoming", "upcoming"]);
  });
  it("keys a milestone by its explicit key, else a slug of the task; unknown statuses read as not started", () => {
    expect(roomMilestoneKey({ key: "practice-roster", task: "x" })).toBe("practice-roster");
    expect(roomMilestoneKey({ task: "  Regional leader kickoff — booked " })).toBe("regional-leader-kickoff-booked");
    expect(resolveRoomStatus("blocking")).toBe("blocking");
    expect(resolveRoomStatus("nope")).toBe("not-started");
  });
});

const only = (key: string, extra: Partial<RoomWorkspaceBlockProps> = {}) =>
  render({ hiddenModules: (["overview", "wins", "plan", "marketing", "kit", "requests", "team"] as const).filter((k) => k !== key && k !== "requests") as never, ...extra });

describe("room-workspace — onboarding checklist", () => {
  it("shows on the overview with one row per step and the right control for each kind", () => {
    const html = render();
    expect(html).toContain("data-room-onboarding");
    expect((html.match(/data-room-step="upload"/g) ?? []).length).toBe(2);
    expect((html.match(/data-room-step="team"/g) ?? []).length).toBe(1);
    expect(html).toContain("0</b> of 3 done");
    expect(html).toContain('data-room-nav="overview"');
    expect(html).toContain("3 to set up");
  });
  it("goes away when hidden, and when the team has checked every step off; a hidden step doesn't count", () => {
    const base = structuredClone(ROOM_WORKSPACE_DEFAULT_PROPS.onboarding!);
    expect(render({ onboarding: { ...base, hidden: true } })).not.toContain("data-room-onboarding");
    expect(render({ onboarding: { ...base, steps: base.steps.map((x) => ({ ...x, done: true })) } })).not.toContain("data-room-onboarding");
    const html = render({ onboarding: { ...base, steps: base.steps.map((x, i) => ({ ...x, hidden: i === 0, done: i === 1 })) } });
    expect(html).toContain("1</b> of 2 done");
    expect(html).not.toContain("Upload your logo");
  });
});

describe("room-workspace — marketing plan, launch kit, hide anything", () => {
  it("marketing: fixed programs read as in plan, programs with options offer each choice", () => {
    const html = only("marketing");
    expect(html).toContain('data-room-view="marketing"');
    expect((html.match(/data-room-program="fixed"/g) ?? []).length).toBe(2);
    expect((html.match(/data-room-program="open"/g) ?? []).length).toBe(2);
    expect(html).toContain("In plan");
    expect(html).toContain(">Include<");
    expect(html).toContain(">Not now<");
  });
  it("launch kit: links come first, and actions are icon buttons with accessible names", () => {
    const html = only("kit", { links: [{ title: "Sign-up page", url: "https://example.com/signup" }], assets: [{ key: "a", kind: "pdf", title: "One-pager", fileUrl: "/files/one.pdf" }] });
    expect(html.indexOf("data-room-link")).toBeLessThan(html.indexOf("data-room-asset"));
    expect(html).toContain('aria-label="View One-pager"');
    expect(html).toContain('aria-label="Download One-pager"');
    expect(html).toContain('aria-label="Request changes to One-pager"');
    expect(html).not.toMatch(/>\s*Download\s*</);
  });
  it("any single item can be hidden: a milestone, a phase, an asset, a link, a person, a program", () => {
    const d = structuredClone(ROOM_WORKSPACE_DEFAULT_PROPS);
    d.planGroups![0].rows[0].hidden = true;
    d.planGroups![1].hidden = true;
    const plan = only("plan", { planGroups: d.planGroups });
    expect(plan).not.toContain("Executive kickoff and success metrics");
    expect(plan).not.toContain("First locations live");
    expect(plan).toContain("Location roster shared");
    const kit = only("kit", { links: [{ title: "Secret link", url: "https://example.com/x", hidden: true }], assets: [{ kind: "pdf", title: "Hidden asset", fileUrl: "/x.pdf", hidden: true }, { kind: "pdf", title: "Shown asset", fileUrl: "/y.pdf" }] });
    expect(kit).not.toContain("Secret link");
    expect(kit).not.toContain("Hidden asset");
    expect(kit).toContain("Shown asset");
    d.team![0].members[0].hidden = true;
    expect(only("team", { team: d.team })).not.toContain("Alex Morgan");
    d.marketing!.groups[1].programs[0].hidden = true;
    expect(only("marketing", { marketing: d.marketing })).not.toContain("Your own case study");
  });
  it("wins: the feed renders a composer and an empty state before anything is posted", () => {
    const html = only("wins");
    expect(html).toContain("data-room-win-compose");
    expect(html).toContain("No wins yet");
  });
});
