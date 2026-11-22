import { describe, expect, it } from "vitest";
import { cleanPlanGroups, csvRows, mergeImportedPlan, parsePlanRows, planCsv, roomPlanInfo, setRoomPlan, targetFrom, type PlanGroup } from "./partnerRoomPlan";

describe("mutual action plan: spreadsheet", () => {
  it("the template reads back in as the same plan (round trip)", () => {
    const parsed = parsePlanRows(csvRows(planCsv(null)));
    expect(parsed.error).toBeUndefined();
    expect(parsed.warnings).toEqual([]);
    expect(parsed.groups.map((g) => g.title)).toEqual(["Days 0–15 · Get set up", "Days 15–30 · Launch"]);
    expect(parsed.groups[0].checkpoint).toBe("Practice list in · kickoff held");
    expect(parsed.groups[0].rows[0]).toMatchObject({ task: "Upload your practice list", target: "Week 1", ourOwner: "Account manager", partnerOwner: "Operations lead", status: "not-started", customerAction: "upload" });
    expect(parsed.groups[0].rows[1].customerAction).toBe("check");
    expect(parsed.groups[1].rows[1].customerAction).toBeUndefined();
  });

  it("a hub's own plan exports and comes back the same", () => {
    const plan: PlanGroup[] = [{ title: "Wave 1", checkpoint: "All trained", rows: [{ task: "Book training, with \"quotes\", commas", target: "2026-12-15", status: "done", customerAction: "check", note: "Line one\nline two" }] }];
    const back = parsePlanRows(csvRows(planCsv(plan))).groups;
    expect(back).toEqual([{ title: "Wave 1", checkpoint: "All trained", rows: [{ task: "Book training, with \"quotes\", commas", target: "2026-12-15", status: "done", customerAction: "check", note: "Line one\nline two" }] }]);
  });

  it("formula-like cells are neutralised in the export", () => {
    expect(planCsv([{ title: "P", rows: [{ task: "=HYPERLINK(\"x\")" }] }])).toContain("'=HYPERLINK");
  });

  it("accepts other column names, a title row, blank phases that continue the one above, and tabs", () => {
    const rows = csvRows("Acme MAP,,,\nStage\tTask\tDue\tDandy owner\tDSO owner\tStatus\nKickoff\tAgree goals\t12/15/2026\tSam\tPat\tIn progress\n\tShare roster\t46000\t\t\tblocked\n");
    const p = parsePlanRows(rows);
    expect(p.error).toBeUndefined();
    expect(p.groups).toEqual([{ title: "Kickoff", rows: [
      { task: "Agree goals", status: "on-track", target: "2026-12-15", ourOwner: "Sam", partnerOwner: "Pat" },
      { task: "Share roster", status: "blocking", target: "2025-12-09" },
    ] }]);
  });

  it("says what it couldn't use, and refuses a sheet with no steps", () => {
    const p = parsePlanRows(csvRows("Phase,Step,Status,Customer can\nA,One,Maybe,Sing\nA,,Done,\n"));
    expect(p.steps).toBe(1);
    expect(p.groups[0].rows[0]).toMatchObject({ status: "not-started" });
    expect(p.warnings).toEqual([
      "Row 2: status “Maybe” not recognised, set to Not started.",
      "Row 2: “Sing” under Customer can not recognised, set to View only.",
      "Row 3: no step, skipped.",
    ]);
    expect(parsePlanRows(csvRows("Name,Date\nx,y\n")).error).toMatch(/No Step column/);
    expect(parsePlanRows(csvRows("Step\n")).error).toMatch(/No steps/);
  });

  it("reads dates: ISO and US kept as ISO, Excel day numbers converted, words kept", () => {
    expect(targetFrom("2026-01-05")).toBe("2026-01-05");
    expect(targetFrom("1/5/26")).toBe("2026-01-05");
    expect(targetFrom("2/30/2026")).toBe("2/30/2026");
    expect(targetFrom("46027")).toBe("2026-01-05");
    expect(targetFrom("Week 2")).toBe("Week 2");
  });
});

describe("mutual action plan: bringing an import in", () => {
  const current: PlanGroup[] = [
    { title: "Setup", rows: [{ key: "practice-roster", task: "Upload your practice list", status: "done" }, { task: "Join the kickoff", status: "on-track" }] },
  ];
  const imported: PlanGroup[] = [
    { title: "Setup", checkpoint: "Ready", rows: [{ task: "upload your PRACTICE list", status: "on-track" }, { task: "Agree goals", status: "not-started" }] },
    { title: "Launch", rows: [{ task: "Announce", status: "not-started" }] },
  ];

  it("replace: the plan becomes the file, and a step with the same name keeps its key (so ticks and uploads stay)", () => {
    const out = mergeImportedPlan(current, imported, "replace");
    expect(out.map((g) => g.title)).toEqual(["Setup", "Launch"]);
    expect(out[0].rows.map((r) => [r.task, r.key])).toEqual([["upload your PRACTICE list", "practice-roster"], ["Agree goals", "agree-goals"]]);
    expect(out[0].checkpoint).toBe("Ready");
  });

  it("add: new steps join the phase of the same name or a new phase; steps already there aren't doubled", () => {
    const out = mergeImportedPlan(current, imported, "add");
    expect(out[0].rows.map((r) => r.task)).toEqual(["Upload your practice list", "Join the kickoff", "Agree goals"]);
    expect(out[1]).toMatchObject({ title: "Launch", rows: [{ task: "Announce", key: "announce" }] });
  });

  it("every step ends up with a key that is unique on the plan", () => {
    const out = mergeImportedPlan([], [{ title: "A", rows: [{ task: "Call" }, { task: "Call!" }] }, { title: "B", rows: [{ task: "call" }] }], "replace");
    expect(out.flatMap((g) => g.rows.map((r) => r.key))).toEqual(["call", "call-2", "call-3"]);
  });
});

describe("mutual action plan: on the page", () => {
  it("cleans what's sent: drops empty steps, keeps known fields, caps sizes", () => {
    const g = cleanPlanGroups([{ title: "", rows: [{ task: " " }, { task: "Do it", status: "weird", customerAction: "dance", hidden: true, extra: 1, note: "x".repeat(2000) }] }, "junk"]);
    expect(g).toEqual([{ title: "Action plan", rows: [{ task: "Do it", status: "not-started", hidden: true, note: "x".repeat(1000) }] }]);
  });

  it("saves only the plan, leaving the rest of the page alone", () => {
    const blocks = [{ type: "hero" }, { type: "room-workspace", props: { partnerName: "Acme", stage: "expansion", planGroups: [], rolloutPlanGroups: [{ title: "Old", rows: [] }] } }];
    const next = setRoomPlan(blocks, [{ title: "New", rows: [{ task: "Go" }] }])!;
    expect(next[0]).toBe(blocks[0]);
    expect((next[1] as { props: Record<string, unknown> }).props).toMatchObject({ partnerName: "Acme", rolloutPlanGroups: [{ title: "Old", rows: [] }], planGroups: [{ title: "New", rows: [{ task: "Go" }] }] });
    expect(roomPlanInfo(next)).toEqual({ groups: [{ title: "New", rows: [{ task: "Go", status: "not-started" }] }], expansion: true });
    expect(setRoomPlan([{ type: "hero" }], [])).toBeNull();
  });
});
