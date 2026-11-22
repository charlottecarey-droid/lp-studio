import { describe, expect, it } from "vitest";
import { deflateRawSync } from "zlib";
import { collectDigest, digestDay, digestIsEmpty, digestRolloutDay, isDigestWindow, renderDigestEmail, renderDigestSlack, type DigestPracticeRow, type DigestState } from "./partnerRoomDigest";
import { readXlsx } from "./xlsxLite";
import { doctorCountFromUpload, practiceNameKey, practiceNamesFromUpload, reconcilePractices } from "./partnerRoomReconcile";

const NOW = new Date(Date.UTC(2026, 10, 16, 15)); // Monday 16 Nov 2026, 15:00 UTC
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

const blocks = [
  {
    type: "room-workspace",
    props: {
      partnerName: "MB2 Dental",
      kickoffDate: "2026-10-04",
      rolloutDays: 90,
      nextMilestoneLabel: "Business Review #2",
      nextMilestoneDate: "Dec 3",
      phases: [{ title: "Foundation", endDay: 30 }, { title: "Momentum", endDay: 60 }, { title: "Scale", endDay: 90 }],
      onboarding: { steps: [{ key: "onboard-logo", title: "Upload your logo", action: "upload" }, { key: "onboard-team", title: "Add your team", action: "team" }, { key: "hidden-step", title: "Hidden", action: "check", hidden: true }] },
      planGroups: [
        {
          title: "P1",
          rows: [
            { key: "kickoff", task: "Executive kickoff", status: "done" },
            { key: "practice-roster", task: "Upload your practice list", customerAction: "upload" },
            { key: "announce", task: "Internal announcement", customerAction: "check" },
            { key: "events", task: "Education events booked", status: "blocking", note: "Waiting on venue approval" },
            { key: "secret", task: "Hidden milestone", status: "blocking", hidden: true },
          ],
        },
      ],
      marketing: { groups: [{ title: "G", programs: [{ key: "mk-fixed", title: "Announcement" }, { key: "mk-event", title: "Welcome event", options: ["Dinner", "Not now"] }, { key: "mk-press", title: "Press release", options: ["Include", "Not now"] }] }] },
    },
  },
];

const state: DigestState = {
  tasks: [
    { key: "announce", at: daysAgo(2), by: "Levi" },
    { key: "onboard-logo", at: daysAgo(20), by: "Levi" },
  ],
  requests: [
    { subject: "Square graphic", status: "review", updatedAt: daysAgo(1), createdAt: daysAgo(3) },
    { subject: "Extra welcome kits", status: "done", updatedAt: daysAgo(4), createdAt: daysAgo(12) },
    { subject: "Old request", status: "done", updatedAt: daysAgo(30), createdAt: daysAgo(40) },
  ],
  choices: [{ key: "mk-event", value: "Dinner" }],
  wins: [
    { body: "First crown seated", headline: null, by: "J. Smith", likes: 3, createdAt: daysAgo(2) },
    { body: "Passed 1,000 cases", headline: "1,000 cases", by: "The team", likes: 12, createdAt: daysAgo(1) },
    { body: "Ancient win", headline: null, by: "X", likes: 99, createdAt: daysAgo(30) },
  ],
  practices: { total: 122, byStage: { live: 36, trained: 18 } },
};

describe("weekly digest", () => {
  const d = collectDigest(blocks, state, NOW)!;
  it("collects progress, this week's completions, what waits on the customer, blockers and the top recent win", () => {
    expect(d).toMatchObject({ partnerName: "MB2 Dental", day: 44, totalDays: 90, phase: "Momentum", planDone: 2, planTotal: 4, practicesLive: 36, practicesTotal: 122, nextMilestone: "Business Review #2 · Dec 3", newRequests: 1 });
    // Small steps are counted, not listed: only named milestones, welcome kits and finished requests are spelled out.
    expect(d.doneThisWeek).toEqual(["Request completed: Extra welcome kits"]);
    expect(d.otherDone).toBe(1);
    expect(d.kind).toBe("rollout");
    expect(d.waitingOnCustomer).toEqual(["Add your team", "Upload your practice list"]);
    expect(d.blocking).toEqual(["Education events booked · Waiting on venue approval"]);
    expect(d.undecided).toEqual(["Press release"]);
    expect(d.reviewRequests).toEqual(["Square graphic"]);
    expect(d.topWin).toEqual({ text: "1,000 cases. Passed 1,000 cases", by: "The team" });
    // Team updates: this week's posts, most liked first. The 30-day-old one is not news.
    expect(d.updates).toEqual([{ text: "1,000 cases. Passed 1,000 cases", by: "The team" }, { text: "First crown seated", by: "J. Smith" }]);
    expect(d.updatesMore).toBe(0);
    expect(digestIsEmpty(d)).toBe(false);
  });
  it("the customer email carries what they can see and never the blockers; the Slack post carries the blockers", () => {
    const email = renderDigestEmail(d, { roomUrl: "https://partners.example.com/mb2", senderName: "Dandy", brandColor: "#003A30" });
    expect(email.subject).toBe("MB2 Dental × Dandy: weekly update · 36 of 122 practices live");
    expect(email.html).toContain("Rollout");
    expect(email.html).toContain("practices live");
    expect(email.html).toContain("30% of the way");
    expect(email.html).toContain("1 other step completed");
    // We already hold their 122 practices, so the practice list is not something we are waiting for.
    expect(email.html).not.toContain("Upload your practice list");
    expect(email.html).toContain("Add your team");
    expect(email.html).toContain("Open your Partner Hub");
    expect(email.html).toContain("Decide: Press release");
    expect(email.html).toContain("Review: Square graphic");
    expect(email.html).toContain("#003A30");
    expect(email.html).not.toContain("Waiting on venue approval");
    expect(email.html).not.toContain("Hidden milestone");
    const slack = renderDigestSlack(d, "https://partners.example.com/mb2");
    const body = JSON.stringify(slack.blocks);
    expect(body).toContain("Blocking (1)");
    expect(body).toContain("Waiting on venue approval");
    expect(body).toContain("Marketing decisions still open (1)");
  });
  it("escapes customer text in the email, is empty when nothing happened, and null for a page without a workspace", () => {
    const xss = collectDigest(blocks, { ...state, wins: [{ body: "<script>alert(1)</script>", headline: null, by: "<b>x</b>", likes: 1, createdAt: daysAgo(1) }] }, NOW)!;
    const html = renderDigestEmail(xss, { roomUrl: "https://x.test/r", senderName: "Dandy" }).html;
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    const quiet = collectDigest([{ type: "room-workspace", props: { partnerName: "Quiet Co" } }], { tasks: [], requests: [], choices: [], wins: [], practices: { total: 0, byStage: {} } }, NOW)!;
    expect(digestIsEmpty(quiet)).toBe(true);
    expect(collectDigest([{ type: "hub-plan", props: {} }], state, NOW)).toBeNull();
  });
  describe("it changes with the partnership", () => {
    const plan = [
      {
        type: "room-workspace",
        props: {
          partnerName: "Acme Group",
          planGroups: [{ title: "P", rows: [
            { key: "practice-roster", task: "Upload your practice list", customerAction: "upload" },
            { key: "doctor-roster", task: "Upload your doctor roster", customerAction: "upload" },
            { key: "accounts-confirmed", task: "Confirm your billing contact", customerAction: "check" },
            { key: "exec-kickoff", task: "Join the executive kickoff", customerAction: "check" },
            { key: "internal-announcement", task: "Send the partnership announcement", customerAction: "check" },
          ] }],
        },
      },
    ];
    const P = (name: string, stage: string, x: Partial<DigestPracticeRow> = {}): DigestPracticeRow => ({ name, region: null, stage, trainingDate: null, liveDate: null, lastOrderDay: null, tenthOrderDay: null, ordersAllTime: null, ordersLastMonth: null, ordersThisMonth: null, ...x });
    const base = { requests: [], choices: [], wins: [] };

    it("setup: names the big milestones and the welcome kits, counts the small steps, and leaves orders out", () => {
      const rows = [P("Oak Dental", "training_booked", { trainingDate: "2026-11-24", kitSentAt: daysAgo(2) }), P("Elm Dental", "not_started", { kitSentAt: daysAgo(2) }), P("Ash Dental", "not_started")];
      const s = collectDigest(plan, { ...base, tasks: [{ key: "practice-roster", at: daysAgo(3), by: "Dana" }, { key: "accounts-confirmed", at: daysAgo(1), by: "Dana" }], practices: { total: 3, byStage: { training_booked: 1, not_started: 2 }, rows } }, NOW)!;
      expect(s.kind).toBe("setup");
      expect(s.milestones.map((x) => [x.key, x.done])).toEqual([["practice-roster", true], ["doctor-roster", false], ["exec-kickoff", false], ["internal-announcement", false]]);
      expect(s.kits).toEqual({ sent: 2, total: 3, thisWeek: 2 });
      expect(s.doneThisWeek).toEqual(["Practice list uploaded", "Welcome kits sent to 2 practices"]);
      expect(s.otherDone).toBe(1);
      const email = renderDigestEmail(s, { roomUrl: "https://x.test/r", senderName: "Dandy" });
      expect(email.subject).toBe("Acme Group × Dandy: weekly update · 1 of 4 setup milestones done");
      expect(email.html).toContain("Getting set up");
      expect(email.html).toContain("Practice list uploaded");
      expect(email.html).toContain("Welcome kits sent to 2 of 3 practices");
      expect(email.html).toContain("Doctor roster uploaded · next");
      expect(email.html).toContain("First training: Oak Dental");
      expect(email.html).not.toContain("Confirm your billing contact");
      expect(email.html).not.toContain(">Rollout<");
      const slack = JSON.stringify(renderDigestSlack(s, "https://x.test/r").blocks);
      expect(slack).toContain("Getting set up* (1 of 4 milestones)");
      expect(slack).toContain("Next: Doctor roster uploaded, then Executive kickoff held");
      expect(slack).not.toContain("Orders");
    });

    it("rollout: leads with the numbers and what moved this week; orders go to Slack only", () => {
      const rows = [
        P("Oak Dental", "live", { liveDate: "2026-11-13", trainingDate: "11/10/2026", ordersAllTime: 12, ordersThisMonth: 7, ordersLastMonth: 5, lastOrderDay: "2026-11-14", tenthOrderDay: "2026-11-12" }),
        P("Elm Dental", "live", { liveDate: "2026-10-01", ordersAllTime: 0 }),
        P("Ash Dental", "trained", { trainingDate: "Nov 12, 2026", ordersAllTime: 3, ordersThisMonth: 0, ordersLastMonth: 3, lastOrderDay: "2026-10-01" }),
        P("Fir Dental", "training_booked", { trainingDate: "2026-11-20" }),
        P("Yew Dental", "not_started"),
      ];
      const r = collectDigest(plan, { ...base, tasks: [], practices: { total: 5, byStage: { live: 2, trained: 1, training_booked: 1, not_started: 1 }, rows, trend: [{ day: "2026-11-02", total: 4, byStage: { live: 1 } }, { day: "2026-11-15", total: 5, byStage: { live: 2, trained: 1 } }], byRegion: [{ region: "West", total: 3, live: 2, trained: 2 }, { region: "East", total: 2, live: 0, trained: 1 }] } }, NOW)!;
      expect(r.kind).toBe("rollout");
      expect(r.rollout).toMatchObject({ total: 5, live: 2, trained: 3, booked: 1, notStarted: 1, liveChange: 1, trainedChange: 2, addedChange: 1, wentLive: ["Oak Dental"], trainedThisWeek: ["Ash Dental", "Oak Dental"], upcoming: [{ name: "Fir Dental", day: "2026-11-20" }] });
      expect(r.orders).toEqual({ ordering: 2, thisMonth: 7, lastMonth: 8, liveNoOrders: ["Elm Dental"], lapsed: ["Ash Dental"], tenth: ["Oak Dental"], top: [{ name: "Oak Dental", orders: 7 }] });
      expect(digestIsEmpty(r)).toBe(false);
      const email = renderDigestEmail(r, { roomUrl: "https://x.test/r", senderName: "Dandy" });
      expect(email.subject).toBe("Acme Group × Dandy: weekly update · 2 of 5 practices live (+1 this week)");
      expect(email.html).toContain("Went live this week");
      expect(email.html).toContain("Fir Dental");
      expect(email.html).toContain("By region");
      expect(email.html).not.toContain("Getting set up");
      // What a practice orders is ours to see, not the customer's.
      expect(email.html).not.toMatch(/\borders?\b/i);
      const slack = JSON.stringify(renderDigestSlack(r, "https://x.test/r").blocks);
      expect(slack).toContain("*2 of 5* practices live (40%) (+1 this week)");
      expect(slack).toContain("*Orders* (team only)");
      expect(slack).toContain("7 orders so far this month (8 last month) · 2 practices ordering");
      expect(slack).toContain("Live but no order yet (1): Elm Dental");
      expect(slack).toContain("No order in 30+ days (1): Ash Dental");
    });

    it("expansion: says so, leads with orders, and stops talking about a rollout", () => {
      const rows = [
        P("Oak Dental", "live", { liveDate: "2026-11-13", ordersAllTime: 12, ordersThisMonth: 7, ordersLastMonth: 5, lastOrderDay: "2026-11-14" }),
        P("Elm Dental", "live", { liveDate: "2026-10-01", ordersAllTime: 0 }),
        P("Fir Dental", "training_booked", { trainingDate: "2026-11-20" }),
      ];
      const past = plan.map((b) => ({ ...b, props: { ...(b as { props: Record<string, unknown> }).props, stage: "expansion" } }));
      const e = collectDigest(past, { ...base, tasks: [], practices: { total: 3, byStage: { live: 2, training_booked: 1 }, rows, trend: [{ day: "2026-11-02", total: 3, byStage: { live: 1 } }, { day: "2026-11-15", total: 3, byStage: { live: 2 } }] } }, NOW)!;
      expect(e.kind).toBe("expansion");
      const text = ((renderDigestSlack(e, "https://x.test/r").blocks[1] as { text: { text: string } }).text.text);
      expect(text.startsWith("Expansion · 2 of 3 practices live (67%)")).toBe(true);
      // No day count, launch plan tally or rollout heading once the rollout is over.
      expect(text).not.toMatch(/Day \d+ of \d+/);
      expect(text).not.toContain("plan items done");
      expect(text).not.toContain("*Rollout*");
      expect(text).toContain("*Practices*");
      expect(text).toContain("1 still to bring on (1 being scheduled)");
      expect(text.indexOf("*Orders* (team only)")).toBeGreaterThan(-1);
      expect(text.indexOf("*Orders* (team only)")).toBeLessThan(text.indexOf("*Practices*"));
      expect(renderDigestEmail(e, { roomUrl: "https://x.test/r", senderName: "Dandy" }).html).not.toContain(">Rollout<");
    });

    it("expansion: a hub past its rollout is an expansion update even before anything changed this week", () => {
      const moved = [{ ...plan[0], props: { ...plan[0].props, stage: "expansion" } }];
      const e = collectDigest(moved, { ...base, tasks: [], practices: { total: 2, byStage: { live: 2 }, rows: [P("Oak Dental", "live"), P("Elm Dental", "live")] } }, NOW)!;
      expect(e.kind).toBe("expansion");
      expect(renderDigestEmail(e, { roomUrl: "https://x.test/r", senderName: "Dandy" }).html).not.toContain("Getting set up");
    });

    it("reads dates the way sources write them", () => {
      expect(digestDay("2026-11-12")).toBe("2026-11-12");
      expect(digestDay("2026-11-12T08:00:00Z")).toBe("2026-11-12");
      expect(digestDay("11/2/2026")).toBe("2026-11-02");
      expect(digestDay("1/5/26")).toBe("2026-01-05");
      expect(digestDay("Nov 12, 2026")).toBe("2026-11-12");
      expect(digestDay("soon")).toBeNull();
      expect(digestDay(null)).toBeNull();
    });
  });

  it("calls the section Team updates, and leaves it out when the only post is the hub's own welcome", () => {
    const welcome = { body: "This is your News Feed.", headline: "Welcome, MB2 Dental", by: "Dandy", likes: 0, createdAt: daysAgo(1), system: true };
    const only = collectDigest(blocks, { ...state, wins: [welcome] }, NOW)!;
    expect(only.updates).toEqual([]);
    expect(only.topWin).toBeNull();
    const email = renderDigestEmail(only, { roomUrl: "https://x.test/r", senderName: "Dandy" }).html;
    expect(email).not.toContain("Team updates");
    expect(email).not.toContain("Welcome, MB2 Dental");
    expect(JSON.stringify(renderDigestSlack(only, "https://x.test/r").blocks)).not.toContain("Team updates");
    // A hub whose only "news" is its welcome post, with nothing else going on, has nothing to send.
    const quietHub = collectDigest([{ type: "room-workspace", props: { partnerName: "Quiet Co" } }], { tasks: [], requests: [], choices: [], wins: [welcome], practices: { total: 0, byStage: {} } }, NOW)!;
    expect(digestIsEmpty(quietHub)).toBe(true);
    // With real posts: the section is there, by its new name, and the welcome post still is not.
    const withPosts = collectDigest(blocks, { ...state, wins: [...state.wins, welcome] }, NOW)!;
    const html = renderDigestEmail(withPosts, { roomUrl: "https://x.test/r", senderName: "Dandy" }).html;
    expect(html).toContain("Team updates");
    expect(html).not.toContain("Win of the week");
    expect(html).toContain("First crown seated");
    expect(html).not.toContain("Welcome, MB2 Dental");
    const slack = JSON.stringify(renderDigestSlack(withPosts, "https://x.test/r").blocks);
    expect(slack).toContain("*Team updates*");
    expect(slack).not.toContain("Win of the week");
  });

  it("counts the rollout day in UTC and only sends on Monday mornings (UTC afternoon)", () => {
    expect(digestRolloutDay("2026-10-04", NOW)).toBe(44);
    expect(digestRolloutDay("2026-12-01", NOW)).toBeNull();
    expect(digestRolloutDay("soon", NOW)).toBeNull();
    expect(isDigestWindow(NOW)).toBe(true);
    expect(isDigestWindow(new Date(Date.UTC(2026, 10, 16, 9)))).toBe(false);
    expect(isDigestWindow(new Date(Date.UTC(2026, 10, 17, 15)))).toBe(false);
  });
});

/** A tiny .xlsx (zip) writer for the tests: deflated parts + a central directory. */
function zip(files: Record<string, string>): Buffer {
  const locals: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const raw = Buffer.from(text, "utf8");
    const data = deflateRawSync(raw);
    const n = Buffer.from(name, "utf8");
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(n.length, 26);
    locals.push(local, n, data);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0);
    c.writeUInt16LE(20, 6);
    c.writeUInt16LE(8, 10);
    c.writeUInt32LE(data.length, 20);
    c.writeUInt32LE(raw.length, 24);
    c.writeUInt16LE(n.length, 28);
    c.writeUInt32LE(offset, 42);
    central.push(c, n);
    offset += 30 + n.length + data.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

const sheetXml = (rows: (string | number)[][], shared: string[]) =>
  `<worksheet><sheetData>${rows
    .map((r, ri) => `<row r="${ri + 1}">${r.map((v, ci) => (typeof v === "number" ? `<c r="${String.fromCharCode(65 + ci)}${ri + 1}"><v>${v}</v></c>` : v === "" ? "" : `<c r="${String.fromCharCode(65 + ci)}${ri + 1}" t="s"><v>${shared.indexOf(v)}</v></c>`)).join("")}</row>`)
    .join("")}</sheetData></worksheet>`;

function workbook(sheets: { name: string; rows: (string | number)[][] }[]): Buffer {
  const shared = [...new Set(sheets.flatMap((s) => s.rows.flat()).filter((v): v is string => typeof v === "string" && v !== ""))];
  const files: Record<string, string> = {
    "xl/workbook.xml": `<workbook><sheets>${sheets.map((s, i) => `<sheet name="${s.name}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`,
    "xl/sharedStrings.xml": `<sst>${shared.map((s) => `<si><t>${s.replace(/&/g, "&amp;")}</t></si>`).join("")}</sst>`,
    "docProps/app.xml": "<ignored/>",
  };
  sheets.forEach((s, i) => (files[`xl/worksheets/sheet${i + 1}.xml`] = sheetXml(s.rows, shared)));
  return zip(files);
}

describe("reading an uploaded roster and comparing it", () => {
  const buf = workbook([
    { name: "Welcome", rows: [["Name"], ["Not a practice"]] },
    { name: "Practice Roster", rows: [["Practice Roster"], ["SFDC ID", "Practice name", "City"], ["", "EXAMPLE — 101 · Main Street Dental", "Phoenix"], ["", "Smile & Co Dental, P.C.", "Dallas"], ["", "Lakeside Family Dentistry", "Austin"], ["", "Brand New Dental", "Denver"], ["", "smile and co dental pc", "Dallas"]] },
    { name: "Doctors", rows: [["Doctor", "Practice"], ["Dr. Patel", "Smile & Co"], ["Dr. Lee", "Lakeside"]] },
  ]);
  it("reads every sheet of an .xlsx: shared strings, sparse cells and numbers", () => {
    const sheets = readXlsx(workbook([{ name: "S", rows: [["A", "", "C"], ["x", 42, ""]] }]));
    expect(sheets).toEqual([{ name: "S", rows: [["A", "", "C"], ["x", "42"]] }]);
    expect(() => readXlsx(Buffer.from("definitely not a zip"))).toThrow();
  });
  it("finds the practice column on the right sheet, skips the example row, and counts doctors", () => {
    const names = practiceNamesFromUpload("roster.xlsx", buf)!;
    expect(names.sheet).toBe("Practice Roster");
    expect(names.names).toEqual(["Smile & Co Dental, P.C.", "Lakeside Family Dentistry", "Brand New Dental", "smile and co dental pc"]);
    expect(doctorCountFromUpload("roster.xlsx", buf)).toEqual({ count: 2, sheet: "Doctors" });
    expect(practiceNamesFromUpload("list.csv", Buffer.from('Practice Name,City\n"Smile, Inc.",Dallas\nLakeside,Austin\n'))?.names).toEqual(["Smile, Inc.", "Lakeside"]);
    expect(practiceNamesFromUpload("list.csv", Buffer.from("foo,bar\n1,2\n"))).toBeNull();
    expect(() => practiceNamesFromUpload("photo.png", Buffer.from("x"))).toThrow();
  });
  it("matches names loosely, dedupes the customer's list, and reports both gaps", () => {
    expect(practiceNameKey("Smile & Co Dental, P.C.")).toBe(practiceNameKey("smile and co dental pc"));
    const r = reconcilePractices(practiceNamesFromUpload("roster.xlsx", buf)!.names, ["Smile and Co Dental PC", "Lakeside Family Dentistry", "Closed Practice LLC"]);
    expect(r).toEqual({ uploaded: 3, inRoom: 3, matched: 2, missingFromRoom: ["Brand New Dental"], notOnUpload: ["Closed Practice LLC"] });
  });
});
