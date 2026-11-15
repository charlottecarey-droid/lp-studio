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
  eventIcs,
  splitEvents,
  standardCheckpoints,
  goalValue,
  welcomeName,
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
    expect((html.match(/data-room-nav="/g) ?? []).length).toBe(11);
    expect(html).toContain('data-room-view="overview"');
    expect(html).toContain("Here is where the rollout stands.");
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
    expect((html.match(/data-room-nav="/g) ?? []).length).toBe(9);
    expect(html).not.toContain('data-room-nav="requests"');
    expect(html).not.toContain("data-room-request-button");
  });
  it("lands on the first visible module, and never hides everything", () => {
    expect(render({ hiddenModules: ["overview", "wins", "goals"] })).toContain('data-room-view="plan"');
    expect(visibleModules(["overview", "wins", "goals", "plan", "practices", "marketing", "kit", "calendar", "meetings", "requests", "team"]).map((m) => m.key)).toEqual(["overview"]);
    expect(visibleModules(undefined)).toHaveLength(11);
  });
  it("the action plan shows both owners, a checkpoint, and customer actions with no file link", () => {
    const html = render({ hiddenModules: ["overview", "wins", "goals"] });
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
  render({ hiddenModules: (["overview", "wins", "goals", "plan", "practices", "marketing", "kit", "requests", "team"] as const).filter((k) => k !== key && k !== "requests") as never, ...extra });

describe("room-workspace — setup items on the home screen", () => {
  it("has no separate checklist: setup items sit in Needs your attention with one-word buttons", () => {
    const html = render();
    expect(html).not.toContain("data-room-onboarding");
    const attention = html.slice(html.indexOf("data-room-attention"));
    expect((attention.match(/data-room-step="upload"/g) ?? []).length).toBe(1);
    expect((attention.match(/data-room-step="team"/g) ?? []).length).toBe(1);
    expect(attention).toMatch(/<\/svg>\s*Upload<\/button>/);
    expect(attention).toMatch(/<\/svg>\s*Add<\/button>/);
    expect(html).toContain('data-room-nav="overview"');
    expect(html).toContain("2 to set up");
    // No visitor is known during SSR: the headline greets the account.
    expect(html).toContain("Welcome, Acme Group!");
  });
  it("setup items leave when hidden or done; the welcome headline stays", () => {
    const base = structuredClone(ROOM_WORKSPACE_DEFAULT_PROPS.onboarding!);
    const hidden = render({ onboarding: { ...base, hidden: true } });
    expect(hidden).not.toContain("data-room-step=");
    expect(hidden).toContain("data-room-welcome");
    expect(render({ onboarding: { ...base, steps: base.steps.map((x) => ({ ...x, done: true })) } })).not.toContain("data-room-step=");
    const three = [...base.steps, { key: "extra", title: "Extra step", action: "check" as const }];
    const html = render({ onboarding: { ...base, steps: three.map((x, i) => ({ ...x, hidden: i === 0, done: i === 1 })) } });
    expect((html.match(/data-room-step=/g) ?? []).length).toBe(1);
    expect(html).toContain("Extra step");
    expect(html).not.toContain("Upload your logo");
    expect(render({ onboarding: { ...base, title: "Let's get going" } })).toContain("Let&#x27;s get going");
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

describe("room-workspace — goals and practices", () => {
  it("goals: counted goals read live from the room, typed goals show their source, and the customer is asked to agree", () => {
    const html = only("goals", {
      goals: {
        askAgreement: true,
        items: [
          { key: "g1", title: "Locations live", target: "40 by Day 90", targetValue: 40, metric: "practices_live" },
          { key: "g2", title: "Share of spend", target: "35%", targetValue: 35, metric: "manual", current: "22%", currentValue: 22, source: "Insights, Nov 14", status: "pending" },
          { key: "g3", title: "Hidden goal", hidden: true },
        ],
      },
    });
    expect(html).toContain('data-room-goals-agreement="open"');
    expect((html.match(/data-room-goal="auto"/g) ?? []).length).toBe(1);
    expect((html.match(/data-room-goal="manual"/g) ?? []).length).toBe(1);
    expect(html).toContain("Live from this room");
    expect(html).toContain("Insights, Nov 14");
    expect(html).toContain("Needs attention");
    expect(html).not.toContain("Hidden goal");
    expect(html).toContain("to agree");
  });
  it("goalValue counts from the room for automatic metrics and uses the typed number otherwise", () => {
    const ctx = { byStage: { live: 18, trained: 6, scheduling: 4 }, planDone: 11 };
    expect(goalValue({ key: "a", title: "", metric: "practices_live" }, ctx)).toBe(18);
    expect(goalValue({ key: "a", title: "", metric: "practices_trained" }, ctx)).toBe(24);
    expect(goalValue({ key: "a", title: "", metric: "plan_complete" }, ctx)).toBe(11);
    expect(goalValue({ key: "a", title: "", metric: "manual", currentValue: 22 }, ctx)).toBe(22);
    expect(goalValue({ key: "a", title: "" }, ctx)).toBeNull();
  });
  it("practices: uses the customer's word for a location and shows an empty state before the list is loaded", () => {
    const html = only("practices", { locationsNoun: "practices" });
    expect(html).toContain('data-room-nav="practices"');
    expect(html).toContain(">Practices<");
    expect(html).toContain("data-room-practice-summary");
    expect(html).toContain("will appear here once the list is loaded");
  });
});

describe("room-workspace — welcome banner and needs your attention", () => {
  it("greets by first name when known, reads first.last addresses, and falls back to the account name", () => {
    expect(welcomeName({ email: "levi@mb2dental.com", name: "Levi Ennis" }, "MB2 Dental")).toBe("Levi");
    expect(welcomeName({ email: "x@y.com", name: "dana ruiz" }, "MB2 Dental")).toBe("Dana");
    expect(welcomeName({ email: "sam.rivera@roomco.com", name: null }, "MB2 Dental")).toBe("Sam");
    expect(welcomeName({ email: "ldavis@roomco.com", name: null }, "MB2 Dental")).toBe("MB2 Dental");
    expect(welcomeName({ email: "ops@roomco.com", name: "Operations Team" }, "MB2 Dental")).toBe("Operations");
    expect(welcomeName(null, "MB2 Dental")).toBe("MB2 Dental");
    expect(welcomeName(null, "")).toBe("there");
  });
  it("upload milestones can be completed straight from Needs your attention", () => {
    const html = render();
    const attention = html.slice(html.indexOf("Needs your attention"));
    expect(attention).toContain('data-room-action="upload"');
    expect(attention).toContain("Upload roster");
  });
  it("calendar: lists dated visible events by month with add-to-calendar, and leaves hidden or undated ones out", () => {
    const html = render({
      hiddenModules: ["overview", "wins", "goals", "plan", "practices", "marketing", "kit"],
      calendar: { intro: "All dates.", events: [
        { key: "b", date: "2027-02-11", title: "Day 30 checkpoint", kind: "meeting" },
        { key: "a", date: "2027-01-12", time: "2:00 pm CT", title: "Executive kickoff", kind: "milestone" },
        { key: "h", date: "2027-01-20", title: "Internal prep", hidden: true },
        { key: "n", date: "TBD", title: "Undated thing" },
      ] },
    });
    expect(html).toContain("What’s scheduled");
    expect(html.indexOf("January 2027")).toBeGreaterThan(-1);
    expect(html.indexOf("January 2027")).toBeLessThan(html.indexOf("February 2027"));
    expect(html).toContain("Add Executive kickoff to your calendar");
    expect(html).toContain("2:00 pm CT");
    expect(html).not.toContain("Internal prep");
    expect(html).not.toContain("Undated thing");
    expect(render({ hiddenModules: ["overview", "wins", "goals", "plan", "practices", "marketing", "kit"] })).toContain("Nothing is scheduled yet.");
    expect(visibleModules(["calendar", "meetings"]).map((m) => m.key)).not.toContain("calendar");
  });
  it("meetings: newest first, the latest one open with decisions and action items; hidden ones stay out", () => {
    const html = render({
      hiddenModules: ["overview", "wins", "goals", "plan", "practices", "marketing", "kit", "calendar"],
      meetings: { items: [
        { key: "m1", date: "2027-01-12", title: "Executive kickoff", attendees: "Levi, Dana", decisions: ["Old decision"], actions: [] },
        { key: "m2", date: "2027-01-26", title: "Weekly sync", summary: "Wave one is set.", decisions: ["Start with Texas"], actions: [{ text: "Send the roster", owner: "Levi", due: "Feb 2" }, { text: "Book trainers", done: true }], notesUrl: "https://example.com/notes" },
        { key: "m3", date: "2027-02-01", title: "Internal debrief", hidden: true },
      ] },
    });
    expect(html.indexOf("Weekly sync")).toBeLessThan(html.indexOf("Executive kickoff"));
    expect(html).toContain("Start with Texas");
    expect(html).toContain("Send the roster");
    expect(html).toContain("1 open action");
    expect(html).toContain("Notes for Weekly sync");
    expect(html).not.toContain("Old decision"); // only the latest starts open
    expect(html).not.toContain("Internal debrief");
  });
  it("splitEvents, standardCheckpoints and eventIcs behave", () => {
    const ev = [{ key: "a", date: "2027-01-10", title: "A" }, { key: "b", date: "2027-01-20", title: "B" }, { key: "c", date: "2027-01-05", title: "C" }];
    const split = splitEvents(ev, "2027-01-10");
    expect(split.upcoming.map((e) => e.key)).toEqual(["a", "b"]); // today counts as upcoming
    expect(split.past.map((e) => e.key)).toEqual(["c"]);
    expect(standardCheckpoints("")).toEqual([]);
    expect(standardCheckpoints("2027-01-12").map((e) => e.date)).toEqual(["2027-01-12", "2027-02-11", "2027-03-13", "2027-04-12"]);
    const ics = eventIcs({ key: "a", date: "2027-12-31", time: "9 am", title: "Review, final" }, "Room");
    expect(ics).toContain("DTSTART;VALUE=DATE:20271231");
    expect(ics).toContain("DTEND;VALUE=DATE:20280101");
    expect(ics).toContain(String.raw`SUMMARY:Review\, final`);
  });
});
