import { describe, expect, it } from "vitest";
import {
  ROOM_TOKEN_TTL_MS,
  ROOM_UPLOAD_MAX_BYTES,
  extractRoomTasks,
  isEmailAllowed,
  normalizeDomain,
  asanaRequestTaskName,
  ASANA_REQUEST_KINDS,
  extractRoomChoices,
  normalizePracticeStage,
  parsePracticeCsv,
  roomPartnerName,
  ROOM_GOALS_AGREED_KEY,
  normalizeEmail,
  onboardingTeamStepKey,
  pageIsRoom,
  parseRoomComment,
  parseRoomContact,
  parseRoomWin,
  parseRoomRequest,
  parseRoomUpload,
  planTaskKey,
  safeRoomPath,
  sanitizeFileName,
  signRoomToken,
  verifyRoomToken,
} from "./partnerRoom";

describe("room token", () => {
  it("round-trips for the page it was signed for, with the address lower-cased", () => {
    const t = signRoomToken(42, "Levi@MB2Dental.com");
    expect(verifyRoomToken(t, 42)).toMatchObject({ pageId: 42, email: "levi@mb2dental.com" });
  });
  it("is refused for another page, after expiry, when tampered with, and when it is not a token", () => {
    const now = 1_800_000_000_000;
    const t = signRoomToken(42, "levi@mb2dental.com", now);
    expect(verifyRoomToken(t, 43, now)).toBeNull();
    expect(verifyRoomToken(t, 42, now + ROOM_TOKEN_TTL_MS + 1)).toBeNull();
    expect(verifyRoomToken(t, 42, now + ROOM_TOKEN_TTL_MS - 1)).not.toBeNull();
    const [body, sig] = t.split(".");
    const forged = Buffer.from(JSON.stringify({ pageId: 42, email: "attacker@evil.com", exp: now + 1e9 })).toString("base64url");
    expect(verifyRoomToken(`${forged}.${sig}`, 42, now)).toBeNull();
    expect(verifyRoomToken(`${body}.${sig.slice(0, -2)}xx`, 42, now)).toBeNull();
    for (const junk of [undefined, null, 7, "", "abc", ".", "a.", ".b"]) expect(verifyRoomToken(junk, 42, now)).toBeNull();
  });
});

describe("who may act", () => {
  it("normalizes addresses and domains, rejecting junk", () => {
    expect(normalizeEmail("  Levi@MB2Dental.com ")).toBe("levi@mb2dental.com");
    for (const bad of ["levi", "levi@", "@mb2.com", "a b@mb2.com", "levi@mb2", 5, null]) expect(normalizeEmail(bad)).toBeNull();
    expect(normalizeDomain("@MB2Dental.com ")).toBe("mb2dental.com");
    expect(normalizeDomain("https://mb2dental.com/about")).toBe("mb2dental.com");
    expect(normalizeDomain("mb2")).toBeNull();
  });
  it("allows by domain, lets an explicit member row win either way, and never allows a free-mail domain wholesale", () => {
    expect(isEmailAllowed("levi@mb2dental.com", ["mb2dental.com"], null)).toBe(true);
    expect(isEmailAllowed("levi@other.com", ["mb2dental.com"], null)).toBe(false);
    expect(isEmailAllowed("levi@sub.mb2dental.com", ["mb2dental.com"], null)).toBe(false);
    expect(isEmailAllowed("levi@other.com", ["mb2dental.com"], "allowed")).toBe(true);
    expect(isEmailAllowed("levi@mb2dental.com", ["mb2dental.com"], "denied")).toBe(false);
    expect(isEmailAllowed("levi@mb2dental.com", [], "requested")).toBe(false);
    expect(isEmailAllowed("someone@gmail.com", ["gmail.com"], null)).toBe(false);
    expect(isEmailAllowed("someone@gmail.com", [], "allowed")).toBe(true);
  });
});

describe("tasks from the page's hub-plan blocks", () => {
  const blocks = [
    { type: "hub-hero", props: {} },
    {
      type: "hub-plan",
      props: {
        lanes: [
          { title: "Ours", rows: [{ task: "Welcome kits shipped", status: "done" }] },
          {
            title: "Theirs",
            rows: [
              { key: "practice-roster", task: "Send your practice roster", customerAction: "upload" },
              { task: "Internal partnership announcement!", customerAction: "check" },
              { task: "Internal partnership announcement!", customerAction: "upload" },
              { task: "Something else", customerAction: "delete-everything" },
            ],
          },
        ],
      },
    },
  ];
  it("keeps only tasks the customer may act on, keyed by explicit key or a slug of the text; first of a duplicate key wins", () => {
    const tasks = extractRoomTasks(blocks);
    expect([...tasks.keys()]).toEqual(["practice-roster", "internal-partnership-announcement"]);
    expect(tasks.get("practice-roster")).toMatchObject({ action: "upload", title: "Send your practice roster" });
    expect(tasks.get("internal-partnership-announcement")?.action).toBe("check");
  });
  it("survives anything that is not a block list", () => {
    for (const junk of [null, undefined, "x", {}, [null, 3, { type: "hub-plan" }, { type: "hub-plan", props: { lanes: "no" } }]]) expect(extractRoomTasks(junk).size).toBe(0);
    expect(planTaskKey({ task: "  Regional leader kickoff — booked " })).toBe("regional-leader-kickoff-booked");
  });
});

describe("uploads", () => {
  const b64 = (buf: Buffer) => buf.toString("base64");
  const xlsx = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(64, 1)]);
  it("accepts a spreadsheet, takes the type from the extension, and strips any path from the name", () => {
    const r = parseRoomUpload("C:\\Users\\levi\\MB2 Roster.xlsx", `data:application/octet-stream;base64,${b64(xlsx)}`);
    expect(r).toMatchObject({ ok: true, fileName: "MB2 Roster.xlsx", contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    expect(parseRoomUpload("roster.csv", b64(Buffer.from("name,email\nA,a@b.com\n")))).toMatchObject({ ok: true, contentType: "text/csv" });
  });
  it("refuses unsupported types, contents that don't match the type, bad encoding, empty and oversized files", () => {
    expect(parseRoomUpload("run.exe", b64(xlsx)).ok).toBe(false);
    expect(parseRoomUpload("page.html", b64(Buffer.from("<script>")))).toMatchObject({ ok: false });
    expect(parseRoomUpload("roster.xlsx", b64(Buffer.from("MZ not a zip file")))).toMatchObject({ ok: false, error: "The file's contents don't match its type." });
    expect(parseRoomUpload("roster.pdf", b64(xlsx)).ok).toBe(false);
    expect(parseRoomUpload("roster.xlsx", "not base64!!")).toMatchObject({ ok: false, error: "Invalid file encoding" });
    expect(parseRoomUpload("roster.xlsx", "")).toMatchObject({ ok: false });
    const big = Buffer.concat([Buffer.from([0x50, 0x4b]), Buffer.alloc(ROOM_UPLOAD_MAX_BYTES)]);
    expect(parseRoomUpload("roster.xlsx", b64(big))).toMatchObject({ ok: false, error: "File too large. Maximum size is 7 MB." });
  });
  it("sanitizes names and return paths", () => {
    expect(sanitizeFileName("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFileName("")).toBe("upload");
    expect(safeRoomPath("/mb2-launch?rt=old#plan")).toBe("/mb2-launch");
    for (const bad of ["//evil.com/x", "https://evil.com", "mb2", "/a\\b", 5]) expect(safeRoomPath(bad)).toBeNull();
  });
});

describe("room-workspace pages + requests", () => {
  const blocks = [
    {
      type: "room-workspace",
      props: {
        planGroups: [
          { title: "Days 0–5", rows: [{ key: "practice-roster", task: "Roster shared", customerAction: "upload" }, { key: "team", task: "Team assigned" }] },
          { title: "Days 5–15", rows: [{ task: "Internal announcement", customerAction: "check" }] },
        ],
      },
    },
  ];
  it("reads customer tasks from a workspace block's plan and recognises the page as a room", () => {
    expect([...extractRoomTasks(blocks).keys()]).toEqual(["practice-roster", "internal-announcement"]);
    expect(pageIsRoom(blocks)).toBe(true);
    expect(pageIsRoom([{ type: "hub-plan", props: {} }])).toBe(false);
    expect(pageIsRoom(null)).toBe(false);
  });
  it("validates a request: needs a subject or details, unknown kinds become other, text is bounded", () => {
    expect(parseRoomRequest({ kind: "asset_change", subject: " Change to: one-pager ", details: "Add our CEO quote", assetKey: "one-pager" })).toEqual({
      ok: true,
      kind: "asset_change",
      subject: "Change to: one-pager",
      details: "Add our CEO quote",
      assetKey: "one-pager",
    });
    expect(parseRoomRequest({ kind: "drop tables", details: "Spanish version of the guide please" })).toMatchObject({ ok: true, kind: "other", subject: "Spanish version of the guide please", assetKey: null });
    expect(parseRoomRequest({ kind: "other", subject: "  ", details: "" })).toEqual({ ok: false, error: "Tell us what you need" });
    const long = parseRoomRequest({ subject: "x".repeat(500), details: "y".repeat(9000) });
    expect(long.ok && long.subject.length).toBe(160);
    expect(long.ok && long.details?.length).toBe(4000);
  });
});

describe("onboarding, choices, contacts, wins", () => {
  const blocks = [
    {
      type: "room-workspace",
      props: {
        onboarding: {
          steps: [
            { key: "onboard-logo", title: "Upload your logo", action: "upload" },
            { key: "onboard-team", title: "Add your team", action: "team" },
            { key: "onboard-gift", title: "Accept your welcome gift", action: "request" },
            { key: "bad", title: "Bad", action: "delete" },
          ],
        },
        planGroups: [{ title: "P", rows: [{ key: "onboard-logo", task: "duplicate key", customerAction: "check" }, { key: "next", task: "Next", customerAction: "check" }] }],
        marketing: {
          groups: [
            { title: "Standard", programs: [{ key: "mk-announcement", title: "Announcement" }, { key: "mk-event", title: "Welcome event", options: ["Dinner", "Onsite training", "Not now"] }] },
            { title: "Optional", programs: [{ key: "mk-press", title: "Press release", options: ["Include", " Not now "] }, { key: "mk-one", title: "One option", options: ["Only"] }] },
          ],
        },
      },
    },
  ];
  it("onboarding steps are tasks (upload stays upload, the rest are ticks) and win a key clash with the plan", () => {
    const tasks = extractRoomTasks(blocks);
    expect([...tasks.keys()]).toEqual(["onboard-logo", "onboard-team", "onboard-gift", "next"]);
    expect(tasks.get("onboard-logo")?.action).toBe("upload");
    expect(tasks.get("onboard-team")?.action).toBe("check");
    expect(onboardingTeamStepKey(blocks)).toBe("onboard-team");
    expect(onboardingTeamStepKey([{ type: "room-workspace", props: {} }])).toBeNull();
  });
  it("only programs with two or more options take a choice", () => {
    const choices = extractRoomChoices(blocks);
    // The announcement is saved here without choices: the customer is still asked (it used to be fixed on every hub).
    expect([...choices.keys()]).toEqual(["mk-announcement", "mk-event", "mk-press"]);
    expect(choices.get("mk-announcement")?.options).toEqual(["Include", "Not now"]);
    expect(choices.get("mk-press")?.options).toEqual(["Include", "Not now"]);
    expect(extractRoomChoices(null).size).toBe(0);
  });
  it("a step that needs a file is an upload, even on a hub saved when it was a tick", () => {
    const saved = [{ type: "room-workspace", props: { planGroups: [{ title: "P", rows: [{ key: "brand-guidelines", task: "Share your brand guidelines", customerAction: "check" }, { key: "exec-kickoff", task: "Join the kickoff", customerAction: "check" }] }] } }];
    const tasks = extractRoomTasks(saved);
    expect(tasks.get("brand-guidelines")?.action).toBe("upload");
    expect(tasks.get("exec-kickoff")?.action).toBe("check");
  });
  it("validates contacts, wins and comments", () => {
    expect(parseRoomContact({ name: " Dana Ruiz ", role: "Operations", email: "Dana@MB2Dental.com" })).toEqual({ ok: true, name: "Dana Ruiz", role: "Operations", email: "dana@mb2dental.com" });
    expect(parseRoomContact({ name: "Dana" })).toEqual({ ok: true, name: "Dana", role: null, email: null });
    expect(parseRoomContact({ name: "" }).ok).toBe(false);
    expect(parseRoomContact({ name: "Dana", email: "nope" })).toEqual({ ok: false, error: "That email doesn't look right" });
    expect(parseRoomWin({ body: "  First case seated  ", region: "North Texas" })).toEqual({ ok: true, body: "First case seated", headline: null, region: "North Texas" });
    expect(parseRoomWin({ body: " " }).ok).toBe(false);
    expect(parseRoomComment("  nice  ")).toBe("nice");
    expect(parseRoomComment("")).toBeNull();
    expect(parseRoomComment(5)).toBeNull();
  });
});

describe("practices, goals agreement, Asana naming", () => {
  it("reads a pasted practice list: quoted commas, tabs, loose headers and stage words", () => {
    const rows = parsePracticeCsv(['Practice Name,Region,Wave,Status,Training Date,Activated', '"Smile, Inc.",North Texas,1,LIVE,Nov 4,Nov 12', "Lakeside Family,Colorado,2,Training Booked,Dec 2,", ",Nowhere,1,live,,", "Cedar Park,,,,,"].join("\n"));
    expect(rows.map((r) => r.name)).toEqual(["Smile, Inc.", "Lakeside Family", "Cedar Park"]);
    expect(rows[0]).toMatchObject({ region: "North Texas", wave: "1", stage: "live", stageGiven: true, trainingDate: "Nov 4", liveDate: "Nov 12" });
    expect(rows[1]).toMatchObject({ stage: "training_booked", liveDate: null });
    expect(rows[2]).toMatchObject({ stage: "not_started", stageGiven: false, region: null });
    expect(parsePracticeCsv("name\tregion\nA Dental\tWest")).toEqual([expect.objectContaining({ name: "A Dental", region: "West" })]);
    expect(parsePracticeCsv("just one line")).toEqual([]);
    expect(parsePracticeCsv(42)).toEqual([]);
  });
  it("maps stage words, defaulting to not started", () => {
    expect(normalizePracticeStage("Activated")).toBe("live");
    expect(normalizePracticeStage("training-booked")).toBe("training_booked");
    expect(normalizePracticeStage("Training Complete")).toBe("trained");
    expect(normalizePracticeStage("???")).toBe("not_started");
  });
  it("a workspace with goals offers the goals-agreed task; the partner name comes from the block", () => {
    const blocks = [{ type: "room-workspace", props: { partnerName: " MB2 Dental ", goals: { items: [{ key: "g", title: "Live" }] } } }];
    expect(extractRoomTasks(blocks).get(ROOM_GOALS_AGREED_KEY)?.action).toBe("check");
    expect(extractRoomTasks([{ type: "room-workspace", props: {} }]).has(ROOM_GOALS_AGREED_KEY)).toBe(false);
    expect(roomPartnerName(blocks)).toBe("MB2 Dental");
    expect(roomPartnerName([])).toBe("");
  });
  it("names the Asana task Expansion Support - customer - request, and only marketing kinds go to Asana", () => {
    expect(asanaRequestTaskName("MB2 Dental", "Change to:  Partnership one-pager")).toBe("Expansion Support - MB2 Dental - Change to: Partnership one-pager");
    expect(asanaRequestTaskName("", "")).toBe("Expansion Support - Customer - Request");
    expect(ASANA_REQUEST_KINDS).toEqual(["asset_change", "marketing", "event"]);
  });
});
