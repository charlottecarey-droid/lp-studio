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
  roomAssetToHub,
  isDeclineOption,
  sortProgramsByDecision,
  resolveRoomProps,
  eventIcs,
  splitEvents,
  standardCheckpoints,
  goalValue,
  welcomeName,
  resolveRoomStatus,
  rolloutDay,
  roomMilestoneKey,
  roomNextUp,
  requestFormFor,
  isGiftStep,
  requestDetails,
  groupLaunch,
  assetReady,
  isRosterTask,
  logoScale,
  scheduleButtonLabel,
  coverLabel,
  roomHeadline,
  roomHeadlineDefault,
  safeHttpUrl,
  roomAssetIconKey,
  targetHasPassed,
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
    expect(html).toContain("Acme Group × Northwind Partnership Hub</");
    expect(render({ headline: "Welcome, {{account}}" })).toContain("Welcome, Acme Group</");
    expect(roomHeadline("", "Acme", "")).toBe("Acme Partnership Hub");
    expect(roomHeadlineDefault("Northwind")).toBe("{{account}} × Northwind Partnership Hub");
    expect((html.match(/<h1/g) ?? []).length).toBe(1);
    expect(html).toContain("data-room-request-button");
    expect((html.match(/data-room-nav="/g) ?? []).length).toBe(10); // the launch kit lives inside Launch & marketing
    expect(html).toContain('data-room-view="overview"');
    expect(html).not.toContain("Here is where the rollout stands.");
    expect(html).not.toContain("One shared plan"); // other modules are separate views
    expect(html).not.toMatch(/<img[^>]*src=""/);
  });
  it("claims no day or phase state without a kickoff date", () => {
    const html = render({ kickoffDate: "" });
    expect(html).not.toMatch(/Day \d/);
    expect(html).not.toContain("In progress");
    expect(html).toMatch(/>1<i>\/5<\/i>/); // one default milestone is done
  });
});

describe("room-workspace — modules can be hidden per account", () => {
  it("drops hidden modules from the nav; hiding Requests removes Make a request", () => {
    const html = render({ hiddenModules: ["requests", "team"] });
    expect((html.match(/data-room-nav="/g) ?? []).length).toBe(8);
    expect(html).not.toContain('data-room-nav="requests"');
    expect(html).not.toContain("data-room-request-button");
  });
  it("lands on the first visible module, and never hides everything", () => {
    expect(render({ hiddenModules: ["overview", "practices", "wins", "goals"] })).toContain('data-room-view="plan"');
    expect(visibleModules(["overview", "wins", "goals", "plan", "practices", "marketing", "kit", "calendar", "meetings", "requests", "team"]).map((m) => m.key)).toEqual(["overview"]);
    expect(visibleModules(undefined)).toHaveLength(10);
    // Scorecard sits right under Overview, and a hub can set its own order.
    expect(visibleModules(undefined).map((m) => m.key).slice(0, 3)).toEqual(["overview", "practices", "wins"]);
    expect(visibleModules(["wins"], ["team", "plan"]).map((m) => m.key).slice(0, 4)).toEqual(["team", "plan", "overview", "practices"]);
    expect(render({ moduleOrder: ["plan"] as never })).toContain('data-room-view="plan"');
    // One entry for the launch kit and the marketing plan together: it stays while either is shown.
    expect(visibleModules(undefined).map((m) => m.key)).not.toContain("kit");
    expect(visibleModules(["marketing"]).map((m) => m.key)).toContain("marketing");
    expect(visibleModules(["marketing", "kit"]).map((m) => m.key)).not.toContain("marketing");
  });
  it("the action plan shows both owners, a checkpoint, and customer actions with no file link", () => {
    const html = render({ hiddenModules: ["overview", "practices", "wins", "goals"] });
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
    expect(attention).toMatch(/<\/svg>\s*(Add|Review)<\/button>/);
    expect(html).toContain('data-room-nav="overview"');
    expect(html).toMatch(/Overview<em[^>]*>2<\/em>/);
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
    expect(html).toContain('aria-label="Included: '); // a standard program is ticked green and can't be un-ticked
    expect(html).toContain('title="Add to the plan"'); // an optional one has a grey tick to add it
    expect(html).not.toContain('title="Not now"'); // saying no lives inside the opened row
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
    expect(html).not.toContain("Live from this room");
    expect(html).toContain("Insights, Nov 14");
    expect(html).toContain("Needs attention");
    expect(html).not.toContain("Hidden goal");
    expect(html).toMatch(/Goals<em[^>]*>1<\/em>/);
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
    expect(html).toContain(">Scorecard<");
    expect(html).toContain("data-room-practice-summary");
    // One tile per stage, each a button that filters the list.
    for (const tile of ["all", "not_started", "scheduling", "training_booked", "trained", "live"]) expect(html).toContain(`data-room-tile="${tile}"`);
    expect(html).not.toContain("data-room-scorecard-check"); // the Salesforce call-out is for the team's own view
    expect(html).toContain("loaded yet");
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
    expect(html).toMatch(/<h2[^>]*>Calendar<\/h2>/);
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
  it("launch-kit files open in the tracked viewer: PDFs, images, videos, and links that point at one", () => {
    expect(roomAssetToHub({ kind: "pdf", title: "One-pager", fileUrl: "/api/storage/public/uploads/a.pdf" })).toMatchObject({ kind: "pdf", fileUrl: "/api/storage/public/uploads/a.pdf" });
    expect(roomAssetToHub({ kind: "video", title: "Lab tour", videoUrl: "https://www.youtube.com/watch?v=abc12345678" })).toMatchObject({ kind: "video", videoUrl: "https://www.youtube.com/watch?v=abc12345678" });
    expect(roomAssetToHub({ kind: "link", title: "Tour", externalUrl: "https://vimeo.com/123456789" }).kind).toBe("video");
    expect(roomAssetToHub({ kind: "link", title: "Sign-up page", externalUrl: "https://partners.example.com/mb2" })).toMatchObject({ kind: "link", externalUrl: "https://partners.example.com/mb2" });
    expect(roomAssetToHub({ kind: "file", title: "Roster template", fileUrl: "/files/template.xlsx" }).kind).toBe("link");
    const html = render({ hiddenModules: ["overview", "wins", "goals", "plan", "practices", "marketing"], assets: [{ key: "tour", kind: "video", title: "Lab tour", videoUrl: "https://www.youtube.com/watch?v=abc12345678" }] });
    expect(html).toContain('aria-label="Play Lab tour"');
    expect(html).toContain("data-room-open");
  });
  it("text is click-to-edit in the builder only, and never inside a link or button", () => {
    const live = render();
    expect(live).not.toContain("data-room-edit");
    const editing = renderToStaticMarkup(createElement(BlockRoomWorkspace, { props: { ...structuredClone(ROOM_WORKSPACE_DEFAULT_PROPS), hiddenModules: ["overview", "practices", "wins", "goals"] }, brand: BRAND, onFieldChange: () => {} }));
    expect(editing).toContain('data-room-edit="task"');
        expect(editing).not.toMatch(/<(a|button)\b[^>]*>(?:(?!<\/\1>).)*data-room-edit/s);
  });
  it("the account name is a variable: one template reads right for any customer, and edits still reach the stored props", () => {
    const base = structuredClone(ROOM_WORKSPACE_DEFAULT_PROPS);
    const raw = { ...base, partnerName: "MB2 Dental", partnerShort: "MB2", eyebrow: "Partner Hub for [Partner]", kitIntro: "Made for {{account}}.", hiddenModules: ["overview", "practices", "wins", "goals"] as never };
    const html = renderToStaticMarkup(createElement(BlockRoomWorkspace, { props: raw, brand: BRAND }));
    expect(html).toContain("Partner Hub for MB2");
    expect(html).toContain("MB2 Dental × Northwind Partner Hub");
    expect(html).not.toContain("[Partner]");
    const { props, rawOf } = resolveRoomProps(raw);
    expect(props.kitIntro).toBe("Made for MB2 Dental.");
    expect(rawOf.get(props)).toBe(raw); // an edit on screen patches the stored object
    expect(raw.kitIntro).toBe("Made for {{account}}.");
    // No name yet: the placeholders stay visible so nobody ships "[Partner]" unnoticed as a blank.
    const blank = { ...raw, partnerName: "[Partner name]" };
    expect(resolveRoomProps(blank).props).toBe(blank);
  });
  it("marketing programs: yes/no is a thumbs up or down, and declined programs sort to the end", () => {
    expect(isDeclineOption("Not now")).toBe(true);
    expect(isDeclineOption(" skip ")).toBe(true);
    expect(isDeclineOption("Include")).toBe(false);
    expect(isDeclineOption("Dinner")).toBe(false);
    const programs = [{ key: "a", title: "A", options: ["Include", "Not now"] }, { key: "b", title: "B", options: ["Include", "Not now"] }, { key: "c", title: "C" }];
    const choices = { a: { value: "Not now" }, b: { value: "Include" } };
    expect(sortProgramsByDecision(programs, choices).map((p) => p.key)).toEqual(["b", "c", "a"]);
    expect(sortProgramsByDecision(programs, {}).map((p) => p.key)).toEqual(["a", "b", "c"]);
    const html = only("marketing", { marketing: { groups: [{ title: "G", programs: [{ key: "a", title: "Lunch & Learn", options: ["Include", "Not now"] }, { key: "e", title: "Welcome event", options: ["Dinner", "Onsite training", "Not now"] }] }] } });
    // One tick per program, grey until it is in the plan; a row opens for details, and choices with several ways to say yes sit inside.
    expect((html.match(/data-room-tick="off"/g) ?? []).length).toBe(2);
    expect(html).not.toContain("data-room-thumb");
    expect((html.match(/data-room-program-more/g) ?? []).length).toBe(2);
    expect(html).not.toContain("data-room-program-details"); // closed until opened
    // A standard program is ticked and can't be un-ticked.
    const fixed = only("marketing", { marketing: { groups: [{ title: "G", programs: [{ key: "ann", title: "Partnership announcement" }] }] } });
    expect(fixed).toContain('data-room-tick="on"');
    expect(fixed).toMatch(/data-room-tick="on"|disabled=""/);
  });
  it("cover styles: photo card by default, full-bleed puts the photo behind the cover, light is pale", () => {
    const img = "/api/storage/objects/uploads/cover";
    expect(render({ heroImageUrl: img })).toContain('data-room-cover="fade"');
    expect(render({ heroImageUrl: img, coverStyle: "split" })).toContain('class="prw-photo"');
    const fb = render({ heroImageUrl: img, coverStyle: "fullbleed", nextMilestoneLabel: "Business review" });
    expect(fb).toContain('data-room-cover="fullbleed"');
    expect(fb).toContain("background-image:url(/api/storage/objects/uploads/cover)");
    expect(fb).not.toContain('class="prw-photo"');
    expect(fb).not.toContain("Next up");
    const fd = render({ heroImageUrl: img, coverStyle: "fade" });
    expect(fd).toContain('data-room-cover="fade"');
    expect(fd).toContain("data-room-cover-fade");
    expect(fd).toContain('class="prw-cover fd fx"'); // photo stays put by default
    expect(render({ heroImageUrl: img, coverStyle: "fade", coverPhotoScrolls: true })).toContain('class="prw-cover fd"');
    expect(fd).not.toContain('class="prw-photo"');
    expect(render({ coverStyle: "fade" })).not.toContain("data-room-cover-fade"); // no photo, plain cover
    // Nothing typed: the cover shows the first plan item still open, and moves on once it is done.
    const plan = [{ title: "Phase", rows: [{ task: "Kickoff held", status: "done" as const }, { task: "Announce the partnership", target: "2026-12-03" }, { task: "Later thing" }] }];
    const auto = render({ heroImageUrl: img, planGroups: plan });
    expect(auto).not.toContain("Next up");
    expect(roomNextUp("", "", [{ task: "A", done: true }])).toBeNull();
    expect(roomNextUp(" Typed ", "2026-01-02", [{ task: "A", done: false }])).toEqual({ label: "Typed", date: "2026-01-02" });
    const lt = render({ heroImageUrl: img, coverStyle: "light", partnerLogoUrl: "/logo-white.png", partnerLogoOriginal: true });
    expect(lt).toContain('data-room-cover="light"');
    expect(lt).not.toContain("/logo-white.png"); // kept in its own colours, a white logo would vanish on the pale cover
    // By default the customer's logo is recoloured for the cover: white on a dark one, dark on the pale one.
    expect(render({ partnerLogoUrl: "/logo.png" })).toContain("filter:brightness(0) invert(1)");
    expect(render({ partnerLogoUrl: "/logo.png", coverStyle: "light" })).toMatch(/src="\/logo\.png"[^>]*filter:brightness\(0\)"/);
    expect(render({ partnerLogoUrl: "/logo.png", partnerLogoOriginal: true })).not.toContain("filter:brightness");
    expect(render({ coverStyle: "nope" as never })).toContain('data-room-cover="fade"');
  });
  it("overdue: a target date that has passed, read with or without a year; other wording is never a date", () => {
    const now = new Date(2026, 10, 16); // Nov 16, 2026
    expect(targetHasPassed("2026-11-15", now)).toBe(true);
    expect(targetHasPassed("2026-11-16", now)).toBe(false); // due today is not overdue
    expect(targetHasPassed("Oct 6", now)).toBe(true);
    expect(targetHasPassed("Dec 3", now)).toBe(false);
    expect(targetHasPassed("Jan 2", now)).toBe(false); // next January, not last
    expect(targetHasPassed("Jan 2, 2026", now)).toBe(true);
    expect(targetHasPassed("Day 30", now)).toBe(false);
    expect(targetHasPassed("", now)).toBe(false);
    // The Overdue card is not on the page at all when nothing is overdue.
    expect(only("overview", { planGroups: [{ title: "P", rows: [{ task: "Later", status: "on-track" }] }] })).not.toContain("data-room-blocked");
    expect(only("overview", { planGroups: [{ title: "P", rows: [{ task: "Stuck", status: "blocking" }] }] })).toContain(">Overdue<");
  });
  it("launch kit: each item gets an icon that fits it, a chosen one wins, and the file-type tag is still available", () => {
    expect(roomAssetIconKey({ kind: "pdf", title: "Partnership one-pager" })).toBe("document");
    expect(roomAssetIconKey({ kind: "text", title: "Announcement email" })).toBe("email");
    expect(roomAssetIconKey({ kind: "text", title: "Social post, version 1" })).toBe("social");
    expect(roomAssetIconKey({ kind: "pdf", title: "Practice Welcome Guide" })).toBe("guide");
    expect(roomAssetIconKey({ kind: "link", title: "Dandy logos" })).toBe("brand");
    expect(roomAssetIconKey({ kind: "link", title: "Sign-up page" })).toBe("link");
    expect(roomAssetIconKey({ kind: "pdf", title: "One-pager", icon: "slides" })).toBe("slides");
    expect(roomAssetIconKey({ kind: "pdf", title: "One-pager", icon: "nope" })).toBe("document");
    expect(roomAssetIconKey({ kind: "pdf", title: "One-pager", icon: "tag" })).toBeNull();
    const html = only("kit", { assets: [{ kind: "text", title: "Announcement email", body: "Hi" }, { kind: "pdf", title: "Old style", fileUrl: "/api/storage/objects/uploads/x", icon: "tag" }] });
    expect(html).toContain('data-room-asset-icon="email"');
    expect(html).toContain(">PDF<");
  });
  it("outstanding: one list of everything open, with open meeting actions in it; Our Team is the team tab", () => {
    const content = {
      partnerName: "MB2 Dental",
      meetings: { items: [{ key: "m1", date: "2026-11-10", title: "Weekly sync", actions: [{ text: "Approve the venue", owner: "MB2 Operations" }, { text: "Already handled", done: true }] }] },
      marketing: { groups: [{ title: "G", programs: [{ key: "ll", title: "Lunch & Learn", options: ["Include", "Not now"] }] }] },
      planGroups: [{ title: "P", rows: [{ task: "Upload your practice list", customerAction: "upload" as const }, { task: "Kits shipped", status: "blocking" as const, ourOwner: "Marketing", partnerOwner: "—" }, { task: "Quiet item", status: "on-track" as const }] }],
    };
    // With only this module shown, the list is on screen: open meeting actions are in it, finished ones are not.
    const html = render({ ...content, hiddenModules: ["overview", "wins", "goals", "plan", "practices", "marketing", "kit", "calendar", "meetings", "team"] as never });
    expect(html).toContain('data-room-view="requests"');
    expect(html).toContain(">Outstanding<");
    expect(html).toContain("Approve the venue");
    expect(html).toContain('data-room-outstanding-item="Meeting"');
    expect(html).not.toContain("Already handled");
    expect(html).not.toContain("Upload your practice list"); // the plan is hidden for this account, so its items have nowhere to be done
    // With the other modules shown, the tab counts what is the customer's across all of them: the upload, the decision, the meeting action
    // (the overdue item is ours, the on-track one isn't outstanding).
    const full = render({ ...content, hiddenModules: ["overview", "wins", "goals", "practices", "kit", "calendar", "team"] as never });
    expect(full).toMatch(/Outstanding<em[^>]*>3<\/em>/);
    expect(render()).toContain(">Our Team<");
  });
  it("top bar: logos can be sized, and a Schedule button books a rep's calendar", () => {
    expect(logoScale(undefined)).toBe(1);
    expect(logoScale(180)).toBe(1.8);
    expect(logoScale(10)).toBe(0.5);
    expect(logoScale(9000)).toBe(3);
    const big = render({ partnerLogoUrl: "/logo.png", partnerLogoScale: 200, brandLogoScale: 150 });
    expect(big).toMatch(/data-room-partner-logo[^>]*|style="height:44px"/);
    expect(big).toContain("height:44px");
    expect(big).toContain("--blogo:1.5");
    expect(render()).not.toContain("data-room-schedule");
    const sched = render({ scheduleUrl: "https://calendly.com/rae-rep/30", scheduleLabel: "" });
    expect(sched).toContain('data-room-schedule');
    expect(sched).toContain('href="https://calendly.com/rae-rep/30"');
    expect(sched).toMatch(/<\/svg> Schedule<\/a>/);
    expect(scheduleButtonLabel("Schedule a meeting")).toBe("Schedule");
    expect(scheduleButtonLabel(" Book time ")).toBe("Book time");
    // Only a real web address becomes a link.
    expect(safeHttpUrl("javascript:alert(1)")).toBe("");
    expect(safeHttpUrl(" https://x.example/a ")).toBe("https://x.example/a");
    expect(render({ scheduleUrl: "javascript:alert(1)" })).not.toContain("data-room-schedule");
  });
  it("our team: a person with a booking link, an email and a phone gets a button for each", () => {
    const html = render({ hiddenModules: ["overview", "wins", "goals", "plan", "practices", "marketing", "kit", "calendar", "meetings", "requests"] as never, team: [{ title: "Dandy", members: [{ name: "Rae Rep", role: "AE", email: "rae@vendor.com", phone: "(555) 010-2000", bookingUrl: "https://calendly.com/rae" }, { name: "No Contact", role: "AM", bookingUrl: "not a link", phone: "x" }] }] });
    expect(html).toContain('href="https://calendly.com/rae"');
    expect(html).toContain('href="mailto:rae@vendor.com"');
    expect(html).toContain('href="tel:5550102000"');
    expect((html.match(/data-room-member-book/g) ?? []).length).toBe(1);
    expect((html.match(/data-room-member-call/g) ?? []).length).toBe(1);
  });
  it("the roster template is offered on the practice list and doctor roster uploads only", () => {
    expect(isRosterTask("practice-roster")).toBe(true);
    expect(isRosterTask("doctor-roster")).toBe(true);
    expect(isRosterTask("onboard-logo")).toBe(false);
    expect(isRosterTask("brand-guidelines")).toBe(false);
  });
  it("the action plan is plain text for everyone: no menus in the rows, and no edit buttons for a customer", () => {
    const html = render({ hiddenModules: ["overview", "wins", "goals", "practices", "marketing", "kit", "calendar", "meetings", "requests", "team"] as never, planGroups: [{ title: "P", rows: [{ task: "Upload your practice list", key: "practice-roster", customerAction: "upload", ourOwner: "AE", partnerOwner: "Operations Lead" }] }] });
    expect(html).toContain('data-room-view="plan"');
    expect(html).not.toContain("<select");
    expect(html).not.toContain("data-room-edit-row"); // the pencil is for the account team on the live page
    expect(html).not.toContain("data-room-row-editor");
    expect(html).toContain("Operations Lead");
  });
  it("launch & marketing: one module with links, decisions, what is ready, what is in progress and what is saved for later", () => {
    const assets = [
      { kind: "pdf" as const, title: "One-pager", fileUrl: "/api/storage/objects/uploads/x" },
      { kind: "pdf" as const, title: "Welcome guide" }, // no file yet
      { kind: "link" as const, title: "Brand guidelines", externalUrl: "https://x.example/brand" },
      { kind: "text" as const, title: "Announcement email", body: "Hi" },
    ];
    const programs = [
      { key: "ann", title: "Partnership announcement" },
      { key: "ll", title: "Lunch & Learn", options: ["Include", "Not now"] },
      { key: "tour", title: "Lab tour", options: ["Include", "Not now"] },
      { key: "pr", title: "Press release", options: ["Include", "Not now"] },
    ];
    expect(assetReady(assets[0])).toBe(true);
    expect(assetReady(assets[1])).toBe(false);
    const g = groupLaunch(assets, programs, { ll: { value: "Include" }, tour: { value: "Not now" } });
    // Links to brand folders sit with the materials, after the files and copy; they are not "Important links".
    expect(g.ready.map((a) => a.title)).toEqual(["One-pager", "Announcement email", "Brand guidelines"]);
    expect(g.preparing.map((a) => a.title)).toEqual(["Welcome guide"]);
    expect(g.toDecide.map((p) => p.title)).toEqual(["Press release"]);
    expect(g.inProgress.map((p) => p.title)).toEqual(["Partnership announcement", "Lunch & Learn"]);
    expect(g.later.map((p) => p.title)).toEqual(["Lab tour"]);
    // On the page (nothing decided yet): the sections appear in that order, under one tab.
    const html = render({ hiddenModules: ["overview", "wins", "goals", "plan", "practices", "calendar", "meetings", "requests", "team"] as never, assets, links: [{ title: "Sign-up page", url: "https://x.example/signup" }], marketing: { groups: [{ title: "G", programs }] } });
    expect(html).toContain(">Launch &amp; marketing<");
    expect(html).not.toContain('data-room-nav="kit"');
    const order = ["links", "decide", "ready", "progress"].map((k) => html.indexOf(`data-room-launch="${k}"`));
    expect(order.every((at) => at > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(html).not.toContain('data-room-launch="later"'); // nothing has been declined
    expect(html).toContain("Important links");
    expect(html).toContain("Ready for launch");
    expect(html.indexOf("Brand guidelines")).toBeGreaterThan(html.indexOf('data-room-launch="ready"'));
    expect(html.indexOf("Brand guidelines")).toBeGreaterThan(html.indexOf("Announcement email"));
    // With the marketing plan hidden for an account, the same tab still carries the kit.
    const kitOnly = render({ hiddenModules: ["overview", "wins", "goals", "plan", "practices", "marketing", "calendar", "meetings", "requests", "team"] as never, assets });
    expect(kitOnly).toContain('data-room-launch="ready"');
    expect(kitOnly).not.toContain('data-room-launch="decide"');
  });
  it("a hub that asks for an email shows a stranger the cover and one question, and nothing else", () => {
    // What the server sends a stranger: the cover only, marked as gated.
    const html = render({ requireEmail: true, gated: true, partnerName: "MB2 Dental", title: "launch plan", lede: "The plan we run together." } as never);
    expect(html).toContain("data-room-gate");
    expect(html).toMatch(/<h1[^>]*>MB2 Dental × Northwind Partnership Hub<\/h1>/);
    expect(html).not.toContain("The plan we run together.");
    expect(coverLabel("Northwind Partner Hub", "Northwind")).toBe("Partner Hub");
    expect(coverLabel("Partner Hub", "Northwind")).toBe("Partner Hub");
    expect(coverLabel("Northwind", "Northwind")).toBe("Northwind");
    expect(html).toContain("data-room-gate-card");
    expect(html).not.toContain("data-room-nav="); // no tabs
    expect(html).not.toContain("data-room-request-button"); // no Make a request
    expect(html).toContain("data-room-signin-button"); // the corner button signs you in
    expect(html).not.toContain("plan items complete"); // no progress
    // Even if the whole hub reached the page (an unrecognised reviewer's preview), nothing under the cover is rendered.
    const full = render({ requireEmail: true, planGroups: [{ title: "P", rows: [{ task: "Secret milestone" }] }], team: [{ title: "Us", members: [{ name: "Rae Rep", email: "rae@vendor.com" }] }] });
    expect(full).toContain("data-room-gate-card");
    expect(full).not.toContain("Secret milestone");
    expect(full).not.toContain("rae@vendor.com");
    // A hub that doesn't ask is unchanged.
    expect(render()).not.toContain("data-room-gate");
  });
  it("requests: one general form for everything, and a shipping address only for the welcome gift", () => {
    const gift = requestFormFor("shipping");
    expect(gift.title).toBe("Where should we send it?");
    expect(gift.fields.filter((f) => f.required).map((f) => f.key)).toEqual(["recipient", "street", "city", "state", "zip"]);
    const general = requestFormFor();
    expect(general.fields.map((f) => f.key)).toEqual(["details", "by"]);
    expect(requestDetails(general, { details: " New postcard for Texas ", by: "Dec 1" })).toBe("New postcard for Texas\nNeeded by: Dec 1");
    expect(requestDetails(general, { details: "A question" })).toBe("A question");
    // Only the welcome-gift setup step asks for an address: a question about a mailer or a kit does not.
    expect(isGiftStep({ key: "onboard-gift", title: "Accept your welcome kit" })).toBe(true);
    expect(isGiftStep({ title: "Accept your welcome gift" })).toBe(true);
    expect(isGiftStep({ title: "Question about: Video mailer and lab-credit offer" })).toBe(false);
    expect(isGiftStep({ title: "Add your team" })).toBe(false);
    // The answers become the request's details, one line each, blanks left out.
    expect(requestDetails(gift, { recipient: "Dana Ruiz", street: "100 Main St", suite: " ", city: "Dallas", state: "TX", zip: "75201" })).toBe("Recipient name: Dana Ruiz\nStreet address: 100 Main St\nCity: Dallas\nState: TX\nZIP code: 75201");
  });
  it("add your team: says how many people are already listed instead of asking to add them again", () => {
    const steps = { onboarding: { steps: [{ key: "onboard-team", title: "Add your team", description: "Who we should work with on your side.", action: "team" as const }] } };
    const withPeople = only("overview", { ...steps, team: [{ title: "Us", members: [{ name: "Rae Rep" }] }, { title: "Them", members: [{ name: "Dana Ruiz", role: "COO" }, { name: "Kai Lee" }, { name: "[Name]", role: "Sponsor" }] }] });
    expect(withPeople).toContain("2 people are already listed");
    expect(withPeople).toContain('data-room-team-step="review"');
    const empty = only("overview", { ...steps, team: [{ title: "Us", members: [] }, { title: "Them", members: [{ name: "[Name]", role: "Sponsor" }] }] });
    expect(empty).toContain("Who we should work with on your side.");
    expect(empty).toContain('data-room-team-step="add"');
    // The invite button is for the account team on the live hub: a visitor's page has none.
    expect(render()).not.toContain("data-room-invite");
  });
});
