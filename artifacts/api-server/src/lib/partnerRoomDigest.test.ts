import { describe, expect, it } from "vitest";
import { deflateRawSync } from "zlib";
import { collectDigest, digestIsEmpty, digestRolloutDay, isDigestWindow, renderDigestEmail, renderDigestSlack, type DigestState } from "./partnerRoomDigest";
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
    expect(d.doneThisWeek).toEqual(["Internal announcement", "Request completed: Extra welcome kits"]);
    expect(d.waitingOnCustomer).toEqual(["Add your team", "Upload your practice list"]);
    expect(d.blocking).toEqual(["Education events booked · Waiting on venue approval"]);
    expect(d.undecided).toEqual(["Press release"]);
    expect(d.reviewRequests).toEqual(["Square graphic"]);
    expect(d.topWin).toEqual({ text: "1,000 cases. Passed 1,000 cases", by: "The team" });
    expect(digestIsEmpty(d)).toBe(false);
  });
  it("the customer email carries what they can see and never the blockers; the Slack post carries the blockers", () => {
    const email = renderDigestEmail(d, { roomUrl: "https://partners.example.com/mb2", senderName: "Dandy", brandColor: "#003A30" });
    expect(email.subject).toBe("MB2 Dental × Dandy: weekly update (4 waiting on you)");
    expect(email.html).toContain("Done this week");
    expect(email.html).toContain("Upload your practice list");
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
