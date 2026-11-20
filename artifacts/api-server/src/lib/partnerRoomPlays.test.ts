import { describe, expect, it } from "vitest";
import { activePlays, clusterPractices, milesBetween, playRequest, recommendPlays, type PlayInput, type PlayPractice } from "./partnerRoomPlays";

const now = new Date("2026-11-20T15:00:00Z");
let seq = 0;
const practice = (over: Partial<PlayPractice> = {}): PlayPractice => ({ id: ++seq, name: `Practice ${seq}`, stage: "not_started", city: "Charlotte", state: "NC", region: "NC", regionalManager: null, officeType: "General", mailable: true, trainingDay: null, kitSent: true, wave: null, lat: 35.22, lng: -80.84, ...over });
const input = (over: Partial<PlayInput> = {}): PlayInput => ({ customer: "Southeast", practices: [], day: 40, stage: "rollout", noDirectOutreach: false, trend: [], published: true, lastCustomerVisit: now, lastWin: now, openCustomerSteps: 0, waves: [], ...over });
const keys = (i: PlayInput) => recommendPlays(i, now).map((p) => p.key);
const find = (i: PlayInput, key: string) => recommendPlays(i, now).find((p) => p.key === key);
// Around Charlotte (close together) and far away.
const charlotte = (n: number, over: Partial<PlayPractice> = {}) => Array.from({ length: n }, (_, k) => practice({ lat: 35.2 + k * 0.02, lng: -80.8 - k * 0.02, ...over }));
const far = [
  practice({ city: "Boone", lat: 36.21, lng: -81.67 }), practice({ city: "Raleigh", lat: 35.87, lng: -78.62 }),
  practice({ city: "Orangeburg", state: "SC", lat: 33.5, lng: -80.86 }), practice({ city: "Charlottesville", state: "VA", lat: 38.07, lng: -78.49 }),
];

describe("where the practices are", () => {
  it("measures distance and groups practices close enough for one event", () => {
    expect(Math.round(milesBetween({ lat: 35.22, lng: -80.84 }, { lat: 35.87, lng: -78.62 }))).toBeGreaterThan(120);
    const clusters = clusterPractices([...charlotte(6), ...far]);
    expect(clusters).toHaveLength(1);
    expect(clusters[0]).toMatchObject({ city: "Charlotte, NC" });
    expect(clusters[0].practices).toHaveLength(6);
    expect(clusterPractices(charlotte(4))).toEqual([]);
  });

  it("recommends a roadshow where they cluster and direct mail for the ones spread out", () => {
    const i = input({ practices: [...charlotte(6), ...far] });
    const road = find(i, "roadshow-charlotte-nc")!;
    expect(road.title).toBe("Dandy After Hours roadshow in Charlotte, NC");
    expect(road.why).toContain("6 practices sit within about 25 miles");
    expect(road.action).toEqual({ kind: "request" });
    expect(road.practices).toHaveLength(6);
    expect(find(i, "direct-mail")!.title).toBe("Direct mail to 4 spread-out practices");
    // An account that restricts outreach gets the sanctioned route instead.
    const restricted = keys(input({ practices: [...charlotte(6), ...far], noDirectOutreach: true }));
    expect(restricted).toContain("ce-sponsorship");
    expect(restricted).not.toContain("direct-mail");
  });
});

describe("dated programs", () => {
  it("asks for welcome kits for mailable practices that haven't had one, never on a no-outreach account", () => {
    const list = [practice({ kitSent: false }), practice({ kitSent: false, mailable: false }), practice()];
    const kit = find(input({ practices: list, day: 20 }), "program-welcome-kits")!;
    expect(kit.title).toBe("Send welcome kits to 1 practice");
    expect(kit.action).toEqual({ kind: "kit", practiceIds: [list[0].id] });
    expect(kit.why).toContain("due by Day 15");
    expect(keys(input({ practices: list, day: 20, noDirectOutreach: true }))).not.toContain("program-welcome-kits");
    expect(keys(input({ practices: list, day: null }))).not.toContain("program-welcome-kits");
  });

  it("follows the playbook's calendar: mailer by Day 30, magalog by Day 60, training and case study once practices are live", () => {
    const list = [...charlotte(4, { stage: "live" }), ...charlotte(4)];
    expect(keys(input({ practices: list, day: 25 }))).toContain("program-video-mailer");
    expect(keys(input({ practices: list, day: 25 }))).not.toContain("program-magalog");
    expect(keys(input({ practices: list, day: 50 }))).toEqual(expect.arrayContaining(["program-magalog", "program-product-training"]));
    expect(keys(input({ practices: list, day: 50 }))).not.toContain("program-case-study");
    expect(find(input({ practices: list, day: 65 }), "program-case-study")!.why).toContain("4 of 8 practices are live (50%)");
    // Past the rollout the dated mailers stop; training and the case study carry on.
    const after = keys(input({ practices: list, day: 140, stage: "expansion" }));
    expect(after).toEqual(expect.arrayContaining(["program-product-training", "program-case-study"]));
    expect(after).not.toContain("program-magalog");
  });
});

describe("who looks after them", () => {
  it("taps a regional with nothing live, runs L&L where one lags, and builds on the one ahead", () => {
    const list = [
      ...charlotte(5, { regionalManager: "Krystal" }),
      ...charlotte(1, { regionalManager: "Lillian", stage: "live" }), ...charlotte(5, { regionalManager: "Lillian" }),
      ...charlotte(8, { regionalManager: "Alease", stage: "live" }), ...charlotte(2, { regionalManager: "Alease" }),
      ...charlotte(6, { regionalManager: "Hollie", stage: "live" }), ...charlotte(1, { regionalManager: "Hollie" }),
    ];
    const got = keys(input({ practices: list }));
    expect(got).toEqual(expect.arrayContaining(["tap-krystal", "ll-lillian"]));
    expect(find(input({ practices: list }), "tap-krystal")!.title).toBe("Top-down tap: a 1:1 with Krystal");
    expect(find(input({ practices: list }), "ll-lillian")!.why).toContain("1 of 6 practices under Lillian are live (17%)");
    expect(got.some((k) => k.startsWith("groundswell-"))).toBe(true);
    expect(got).not.toContain("data-managers");
    expect(keys(input({ practices: charlotte(6) }))).toContain("data-managers");
  });
});

describe("when things stall", () => {
  it("chases trainings that never turned into live practices", () => {
    const list = [practice({ trainingDay: "2026-10-01" }), practice({ trainingDay: "2026-10-01", stage: "live" }), practice({ trainingDay: "2026-11-15" })];
    const p = find(input({ practices: list }), "stalled-trainings")!;
    expect(p.title).toBe("Chase 1 stalled training");
    expect(p.practices).toEqual([list[0].name]);
  });

  it("notices flat adoption, a customer who stopped looking, and progress nobody posted", () => {
    const list = [...charlotte(3, { stage: "live" }), ...charlotte(5)];
    const flat = find(input({ practices: list, trend: [{ day: "2026-10-01", live: 2 }, { day: "2026-10-20", live: 3 }, { day: "2026-11-19", live: 3 }] }), "flat-adoption")!;
    expect(flat.why).toContain("stayed at 3 for 31 days");
    expect(keys(input({ practices: list, trend: [{ day: "2026-11-01", live: 2 }, { day: "2026-11-15", live: 3 }] }))).not.toContain("flat-adoption");
    expect(find(input({ practices: list, lastCustomerVisit: new Date("2026-10-20T00:00:00Z") }), "quiet-customer")!.why).toContain("in 31 days");
    expect(keys(input({ practices: list, published: false, lastCustomerVisit: null }))).not.toContain("quiet-customer");
    const win = find(input({ practices: list, trend: [{ day: "2026-11-01", live: 1 }, { day: "2026-11-19", live: 3 }], lastWin: null }), "share-win")!;
    expect(win.title).toBe("Post a win: 2 more practices live");
  });

  it("plans the next wave, flags offices that can't go live, and missing addresses", () => {
    expect(keys(input({ practices: charlotte(5), stage: "expansion", waves: [{ name: "Wave 1", total: 10, live: 9, target: "2026-12-01" }, { name: "Wave 2", total: 12, live: 0, target: "" }] }))).toContain("next-wave-wave-2");
    expect(find(input({ practices: [...charlotte(6), ...charlotte(2, { officeType: "Pediatric" })] }), "rescope")!.title).toBe("Agree what to do with 2 pediatric or specialty offices");
    expect(keys(input({ practices: [...charlotte(4), ...charlotte(2, { lat: null, lng: null })] }))).toContain("data-addresses");
  });
});

describe("acting on a play", () => {
  it("stays quiet once requested or dismissed, until the wait is over", () => {
    const plays = recommendPlays(input({ practices: [...charlotte(6), ...far] }), now);
    const quiet = activePlays(plays, { "direct-mail": { state: "dismissed", until: "2026-12-20" }, "roadshow-charlotte-nc": { state: "requested", until: "2026-11-19" } }, now);
    expect(quiet.map((p) => p.key)).toContain("roadshow-charlotte-nc");
    expect(quiet.map((p) => p.key)).not.toContain("direct-mail");
    expect(activePlays(plays, null, now)).toHaveLength(plays.length);
  });

  it("ranks the urgent ones first and writes the request for marketing", () => {
    const list = [...charlotte(6), practice({ trainingDay: "2026-10-01" }), practice({ kitSent: false })];
    const plays = recommendPlays(input({ practices: list, day: 40 }), now);
    expect(plays[0].key).toBe("program-welcome-kits");
    expect(plays.map((p) => p.score)).toEqual([...plays.map((p) => p.score)].sort((a, b) => b - a));
    const req = playRequest("Southeast", plays.find((p) => p.key.startsWith("roadshow"))!, "Rae Rep", "2026-11-20", "https://partners.example.com/southeast");
    expect(req.subject).toBe("Dandy After Hours roadshow in Charlotte, NC (requested 2026-11-20)");
    expect(req.notes).toContain("Requested by: Rae Rep");
    expect(req.notes).toContain("Playbook play: Roadshows");
    expect(req.notes).toContain("Hub: https://partners.example.com/southeast");
  });
});
