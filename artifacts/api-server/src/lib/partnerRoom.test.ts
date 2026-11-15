import { describe, expect, it } from "vitest";
import {
  ROOM_TOKEN_TTL_MS,
  ROOM_UPLOAD_MAX_BYTES,
  extractRoomTasks,
  isEmailAllowed,
  normalizeDomain,
  normalizeEmail,
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
