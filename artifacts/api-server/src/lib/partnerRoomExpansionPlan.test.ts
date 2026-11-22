import { describe, expect, it } from "vitest";
import { DEFAULT_WORKSPACE_PLAN } from "../seeds/partnerLaunchRoomTemplate";
import { addWaveGroups, buildExpansionPlan, expansionReview, productLineGroup, type PlanGroup } from "./partnerRoomExpansionPlan";
import { roomStageInfo, setRoomStage } from "./partnerRoomStage";
import { extractRoomTasks } from "./partnerRoom";

const plan = () => JSON.parse(JSON.stringify(DEFAULT_WORKSPACE_PLAN)) as PlanGroup[];
const keys = (g: PlanGroup) => g.rows.map((r) => r.key);
const today = "2026-11-22";
// The launch is mostly done: the first two phases ticked, two steps of phase 3 ticked.
const ticked = ["practice-roster", "doctor-roster", "accounts-confirmed", "brand-guidelines", "exec-kickoff", "internal-announcement", "welcome-event", "regional-kickoff", "regional-1-1s"];

describe("expansion review", () => {
  it("lists only open steps, with the suggested keep or retire", () => {
    const open = expansionReview(plan(), ticked);
    expect(open.map((r) => r.key)).toEqual(["first-wave-scheduled", "lunch-and-learns", "first-live", "hub-walkthrough", "education-events", "next-wave", "roi-review", "case-study", "first-ebr", "transition"]);
    expect(open.find((r) => r.key === "case-study")).toMatchObject({ suggested: "keep", phase: "Review and plan ahead" });
    expect(open.find((r) => r.key === "lunch-and-learns")).toMatchObject({ suggested: "retire", why: "Now part of each wave" });
    expect(open.find((r) => r.key === "first-ebr")).toMatchObject({ suggested: "retire", why: "A launch step" });
  });

  it("keeps a step the team added by default", () => {
    const g = plan();
    g[0].rows.push({ key: "custom-1", task: "Sign the BAA", status: "not-started" });
    expect(expansionReview(g, []).find((r) => r.key === "custom-1")).toMatchObject({ suggested: "keep" });
  });
});

describe("expansion plan", () => {
  it("keeps finished steps, carries kept ones without old dates, retires the rest, and adds the new groups", () => {
    const g = plan();
    g[4].rows.find((r) => r.key === "case-study")!.target = "2026-10-30";
    const out = buildExpansionPlan(g, { waves: [], productSummary: null, ticked, today, decisions: { "first-ebr": "keep" } });
    const titles = out.map((x) => x.title);
    expect(titles).toEqual(["Days 0–5 · Get set up", "Days 5–15 · Launch", "Days 15–30 · Align your regions", "Days 31–60 · Build momentum", "Days 61–90 · Review and plan ahead", "Still to finish", "Your remaining practices", "Product lines", "Ongoing"]);
    const still = out[5];
    expect(keys(still)).toEqual(["case-study", "first-ebr", "transition"]);
    expect(still.rows[0].target).toBeUndefined();
    // Retired: hidden and marked, still in the plan so the team can see them and ticks still line up.
    const phase3 = out[2];
    expect(phase3.rows.find((r) => r.key === "lunch-and-learns")).toMatchObject({ hidden: true, retired: true });
    expect(phase3.rows.find((r) => r.key === "regional-kickoff")).not.toHaveProperty("retired");
    expect(keys(out[6])).toEqual(["remaining-practices", "remaining-regionals", "remaining-training", "remaining-lunch"]);
    expect(out[8].rows.find((r) => r.key === "qbr")).toMatchObject({ target: "2027-02-20", status: "on-track" });
    expect(out[8].rows.find((r) => r.key === "qbr")).not.toHaveProperty("customerAction");
  });

  it("drops a launch phase emptied by carrying its steps forward", () => {
    const g: PlanGroup[] = [{ title: "Days 0–5", rows: [{ key: "a", task: "A" }] }];
    expect(buildExpansionPlan(g, { waves: [], productSummary: null, today }).map((x) => x.title)).toEqual(["Still to finish", "Your remaining practices", "Product lines", "Ongoing"]);
  });

  it("adds one group per wave still to come, with dates from the wave", () => {
    const waves = [
      { key: "1", name: "Wave 1", start: "2026-08-01", target: "2026-10-01" },
      { key: "Wave 2", name: "Wave 2", start: "2026-12-01", target: "2027-02-15" },
      { key: "North", name: "North", start: "", target: "" },
    ];
    const out = buildExpansionPlan([], { waves, productSummary: null, today });
    expect(out.map((x) => x.title)).toEqual(["Wave 2 · target Feb 15", "North", "Product lines", "Ongoing"]);
    expect(out[0].rows.map((r) => [r.key, r.target])).toEqual([["wave-2-practices", "2026-12-01"], ["wave-2-regionals", "2026-12-01"], ["wave-2-training", "2026-12-15"], ["wave-2-lunch", "2027-02-15"]]);
  });

  it("names the least-ordered product lines when there is order data", () => {
    const g = productLineGroup({ ordering: 50, lines: [{ line: "Simple restorative", practices: 50 }, { line: "Implant", practices: 6 }, { line: "Aligner", practices: 2 }, { line: "Full denture", practices: 30 }, { line: "Surgical guide", practices: 9 }, { line: "Other", practices: 0 }] });
    expect(keys(g)).toEqual(["xs-choose", "xs-train-aligner", "xs-train-implant", "xs-lunch"]);
    expect(g.rows[0].note).toBe("Today: 4% order aligner · 12% order implant");
    expect(g.rows[1].note).toBe("2 of 50 ordering practices send aligner cases today");
    expect(keys(productLineGroup(null))).toEqual(["xs-choose", "xs-train", "xs-lunch"]);
  });

  it("a wave added later gets its group before Product lines, once", () => {
    const out = buildExpansionPlan([], { waves: [], productSummary: null, today });
    const w = [{ key: "3", name: "Wave 3", start: "2027-01-10", target: "" }];
    const added = addWaveGroups(out, w, today);
    expect(added.map((x) => x.title)).toEqual(["Your remaining practices", "Wave 3", "Product lines", "Ongoing"]);
    expect(addWaveGroups(added, w, today)).toHaveLength(4);
  });
});

describe("the plan follows the stage", () => {
  const hub = (props: Record<string, unknown>) => [{ type: "room-workspace", props: { partnerName: "MB2", kickoffDate: "2026-08-01", planGroups: plan(), ...props } }];
  const props = (blocks: unknown[] | null) => (blocks![0] as { props: Record<string, unknown> }).props;
  const now = new Date(`${today}T15:00:00Z`);

  it("moving on swaps in the new plan and keeps the launch plan; moving back restores it", () => {
    const moved = setRoomStage(hub({}), { stage: "expansion", timelineView: "practices", waves: [] }, now, { ticked, decisions: { "case-study": "retire" } });
    expect(props(moved).rolloutPlanGroups).toEqual(plan());
    const groups = props(moved).planGroups as PlanGroup[];
    expect(groups.map((g) => g.title)).toContain("Product lines");
    expect(groups.flatMap((g) => g.rows).find((r) => r.key === "case-study")).toMatchObject({ retired: true });
    // A retired step is no longer something the customer is waiting on; the new steps are.
    const tasks = extractRoomTasks(moved);
    expect(tasks.has("case-study")).toBe(false);
    expect(tasks.has("practice-roster")).toBe(true);
    expect(tasks.has("remaining-practices")).toBe(true);
    expect(tasks.get("practice-list-update")).toMatchObject({ action: "upload" });
    expect(tasks.has("qbr")).toBe(false);
    // Editing waves while in expansion adds their groups and leaves the rest alone.
    const waves = [{ key: "2", name: "Wave 2", start: "", target: "2027-03-01" }];
    const later = setRoomStage(moved, { stage: "expansion", timelineView: "waves", waves }, now)!;
    expect((props(later).planGroups as PlanGroup[]).map((g) => g.title)).toContain("Wave 2 · target Mar 1");
    const back = setRoomStage(later, { stage: "rollout", timelineView: "waves", waves }, now)!;
    expect(props(back).planGroups).toEqual(plan());
    expect(props(back)).not.toHaveProperty("rolloutPlanGroups");
    expect(roomStageInfo(back, now)).toMatchObject({ stage: "rollout" });
  });
});
