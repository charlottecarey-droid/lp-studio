/**
 * The fixture below is shaped from a real Groundbreak 2026 catalog response
 * (field names, nesting and the Procore-style "WHO IT'S FOR / OVERVIEW"
 * abstract are verbatim); ids and copy are trimmed. NO credentials here — the
 * widget token is user-supplied config, never committed.
 */
import { describe, expect, it, vi } from "vitest";
import {
  parseRainfocusEmbed,
  rainfocusHost,
  htmlToText,
  splitAbstract,
  mapRainfocusSession,
  mapRainfocusSessions,
  rainfocusVocabulary,
  fetchRainfocusCatalog,
} from "./rainfocus";

const EMBED = `
<script>
    window.widget = new Rainfocus.Widget({
     apiToken: 'AAAAbbbb0000CCCCdddd1111EEEEffff',
     widgetId: 'ZZZZyyyy9999XXXXwwww8888VVVVuuuu',
     env: 'prod'
      })
</script>`;

const SESSION = {
  title: "Advanced Budgeting for Owners",
  type: "Preconference Workshop",
  abstract:
    "WHO IT'S FOR:<br/>\n Executive Leadership (Financial Oversight), Project Manager<br/><br/>\n \nOVERVIEW:<br/>\n This session dives into the Budget tool &amp; SmartGrid.",
  length: 90.0,
  times: [
    {
      date: "2026-10-21", daySort: "20261021", startTime: "09:00", endTime: "10:30",
      startTimeFormatted: "09:00 AM", endTimeFormatted: "10:30 AM", room: "Room 7", dayName: "Wednesday",
    },
    {
      date: "2026-10-20", daySort: "20261020", startTime: "15:00", endTime: "16:30",
      startTimeFormatted: "03:00 PM", endTimeFormatted: "04:30 PM", room: "Room 4", dayName: "Tuesday",
    },
  ],
  participants: [
    { firstName: "Michael", lastName: "Jandro", fullName: "Michael Jandro", jobTitle: "Strategic Product Consultant", companyName: "Procore" },
    { firstName: "Nick", lastName: "Errigo", fullName: "", jobTitle: "", companyName: "" },
  ],
  attributevalues: [
    { attribute_id: "Role", attribute: "Role", value: "Executive", displayorder: 1 },
    { attribute_id: "Role", attribute: "Role", value: "Finance", displayorder: 2 },
    { attribute_id: "Role", attribute: "Role", value: "Executive", displayorder: 3 },
    { attribute_id: "Audience", attribute: "Audience", value: "Owners", displayorder: 1 },
    { attribute_id: "Topic", attribute: "Topic", value: "Cost Management", displayorder: 1 },
    { attribute_id: "BreakoutTrack", attribute: "BreakoutTrack", value: "Product Perspective", displayorder: 1 },
    { attribute_id: "ShowinCatalog", attribute: "ShowinCatalog", value: "Yes", displayorder: 1 },
  ],
};

describe("parseRainfocusEmbed", () => {
  it("pulls the three fields out of a pasted embed", () => {
    expect(parseRainfocusEmbed(EMBED)).toEqual({
      apiToken: "AAAAbbbb0000CCCCdddd1111EEEEffff",
      widgetId: "ZZZZyyyy9999XXXXwwww8888VVVVuuuu",
      env: "prod",
    });
  });

  it("tolerates the whole HTML document, and double quotes", () => {
    const doc = `<html><head></head><body><div id="rf-speakercatalog"></div>
      <script>window.widget = new Rainfocus.Widget({ "apiToken": "AAAAbbbb0000CCCCdddd1111EEEEffff", "widgetId": "ZZZZyyyy9999XXXXwwww8888VVVVuuuu" })</script></body></html>`;
    const out = parseRainfocusEmbed(doc);
    expect("error" in out).toBe(false);
    expect((out as { env: string }).env).toBe("prod");
  });

  it("defaults env to prod when the embed omits it", () => {
    const out = parseRainfocusEmbed(`apiToken: 'AAAAbbbb0000CCCCdddd1111EEEE', widgetId: 'ZZZZyyyy9999XXXXwwww8888'`);
    expect((out as { env: string }).env).toBe("prod");
  });

  it("explains itself when the snippet is wrong", () => {
    expect(parseRainfocusEmbed("<div>nope</div>")).toHaveProperty("error");
    expect(parseRainfocusEmbed("")).toHaveProperty("error");
  });

  it("rejects an id with punctuation rather than forwarding it into a header", () => {
    const bad = `apiToken: 'abc\ndef: evil', widgetId: 'ZZZZyyyy9999XXXXwwww8888'`;
    expect(parseRainfocusEmbed(bad)).toHaveProperty("error");
  });

  it("env is an ALLOWLIST — a pasted env can't redirect us to another host", () => {
    const evil = `apiToken: 'AAAAbbbb0000CCCCdddd1111EEEE', widgetId: 'ZZZZyyyy9999XXXX', env: 'evil.example.com'`;
    expect(parseRainfocusEmbed(evil)).toHaveProperty("error");
    expect(rainfocusHost("prod")).toBe("https://events.rainfocus.com");
    expect(rainfocusHost("evil.example.com")).toBeNull();
  });
});

describe("abstract handling", () => {
  it("turns the HTML fragment into readable text", () => {
    expect(htmlToText("A<br/>B&amp;C<br/><br/>D")).toBe("A\nB&C\n\nD");
  });

  it("uses OVERVIEW as the description and keeps the audience line out of it", () => {
    const { description, audienceLine } = splitAbstract(SESSION.abstract);
    expect(description).toBe("This session dives into the Budget tool & SmartGrid.");
    expect(description).not.toContain("WHO IT'S FOR");
    expect(audienceLine).toContain("Executive Leadership");
  });

  it("an unlabelled abstract is used verbatim", () => {
    expect(splitAbstract("Just a plain description.").description).toBe("Just a plain description.");
  });

  it("an empty abstract yields empty strings, not junk", () => {
    expect(splitAbstract("")).toEqual({ description: "", audienceLine: "" });
    expect(splitAbstract("<br/><br/>")).toEqual({ description: "", audienceLine: "" });
  });
});

describe("mapRainfocusSession", () => {
  const row = mapRainfocusSession(SESSION)!;

  it("maps the typed attributes onto our tags — no AI inference", () => {
    expect(row.tags).toEqual({
      roles: ["Executive", "Finance"], // deduped
      industries: ["Owners"],
      topics: ["Cost Management"],
    });
  });

  it("does not leak non-audience attributes into tags", () => {
    expect(JSON.stringify(row.tags)).not.toContain("Yes"); // ShowinCatalog
    expect(JSON.stringify(row.tags)).not.toContain("Product Perspective"); // that's the track
  });

  it("takes session type and track from the right places", () => {
    expect(row.sessionType).toBe("Preconference Workshop");
    expect(row.track).toBe("Product Perspective");
  });

  it("uses the EARLIEST scheduled time, with machine-readable date and 24h times", () => {
    // The fixture lists Oct 21 first; Oct 20 is the real slot.
    expect(row.day).toBe("2026-10-20");
    expect(row.startTime).toBe("15:00");
    expect(row.endTime).toBe("16:30");
    expect(row.room).toBe("Room 4");
  });

  it("folds job title and company into the one speaker title field", () => {
    expect(row.speakers?.[0]).toEqual({
      name: "Michael Jandro",
      title: "Strategic Product Consultant, Procore",
    });
  });

  it("falls back to first+last when fullName is blank, and omits an empty title", () => {
    expect(row.speakers?.[1]).toEqual({ name: "Nick Errigo" });
  });

  it("a session with no title is dropped rather than imported blank", () => {
    expect(mapRainfocusSession({ title: "   " })).toBeNull();
    expect(mapRainfocusSession({})).toBeNull();
  });

  it("survives a session with no times, speakers or attributes", () => {
    const bare = mapRainfocusSession({ title: "TBD" });
    expect(bare).toEqual({ title: "TBD" });
  });

  it("reports how many items were unusable", () => {
    const { rows, skipped } = mapRainfocusSessions([SESSION, {}, { title: "Second" }]);
    expect(rows).toHaveLength(2);
    expect(skipped).toBe(1);
  });

  it("summarises the vocabulary the import brought in", () => {
    const { rows } = mapRainfocusSessions([SESSION]);
    expect(rainfocusVocabulary(rows)).toEqual({
      roles: ["Executive", "Finance"],
      industries: ["Owners"],
      topics: ["Cost Management"],
    });
  });
});

describe("fetchRainfocusCatalog", () => {
  const creds = { apiToken: "tok", widgetId: "wid", env: "prod" };
  const ok = (items: unknown[], total: number) =>
    ({ json: async () => ({ responseCode: "0", totalSearchItems: total, sectionList: [{ items }] }) }) as Response;

  it("sends the token as a header, form-encoded, to the env's host", async () => {
    const spy = vi.fn(async () => ok([SESSION], 1));
    await fetchRainfocusCatalog(creds, "session", spy as unknown as typeof fetch);
    const [url, init] = spy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://events.rainfocus.com/api/search");
    expect((init.headers as Record<string, string>).rfApiProfileId).toBe("tok");
    expect((init.headers as Record<string, string>).rfWidgetId).toBe("wid");
    expect(String(init.body)).toContain("type=session");
  });

  it("TREATS HTTP 200 + a non-zero responseCode AS A FAILURE", async () => {
    // The trap this API sets: a refusal arrives as 200 OK.
    const denied = { json: async () => ({ responseCode: "124", responseMessage: "Access to API endpoint session denied." }) } as Response;
    const out = await fetchRainfocusCatalog(creds, "session", (async () => denied) as unknown as typeof fetch);
    expect(out).toHaveProperty("error");
    expect((out as { error: string }).error).toContain("denied");
  });

  it("follows pagination until the catalog is complete", async () => {
    const page = (n: number) => Array.from({ length: n }, (_, i) => ({ title: `S${i}` }));
    let call = 0;
    const spy = vi.fn(async () => { call += 1; return ok(page(call === 1 ? 100 : 68), 168); });
    const out = await fetchRainfocusCatalog(creds, "session", spy as unknown as typeof fetch);
    expect("error" in out).toBe(false);
    expect((out as { items: unknown[] }).items).toHaveLength(168);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("HANDLES THE SHAPE CHANGE BETWEEN PAGES (regression)", async () => {
    // Verified live: page 1 is sectioned, every later page is FLAT with no
    // sectionList. Reading only `sectionList` made page 2 look empty and
    // truncated a 168-session catalog to 50.
    const sectioned = { json: async () => ({ responseCode: "0", totalSearchItems: 120, sectionList: [{ items: Array.from({ length: 50 }, (_, i) => ({ title: `A${i}` })) }] }) } as Response;
    const flat = (n: number) => ({ json: async () => ({ responseCode: "0", total: 120, numItems: n, items: Array.from({ length: n }, (_, i) => ({ title: `B${i}` })) }) }) as Response;
    const pages = [sectioned, flat(50), flat(20)];
    let i = 0;
    const out = await fetchRainfocusCatalog(creds, "session", (async () => pages[i++]) as unknown as typeof fetch);
    expect("error" in out).toBe(false);
    expect((out as { items: unknown[] }).items).toHaveLength(120);
  });

  it("advances the offset by what it HAS, not by the page size it asked for", async () => {
    // The server caps pages at 50 however much you request, so offsetting by
    // the requested size would skip records.
    const calls: string[] = [];
    const flat = (n: number) => ({ json: async () => ({ responseCode: "0", total: 60, items: Array.from({ length: n }, (_, j) => ({ title: `S${j}` })) }) }) as Response;
    const pages = [flat(50), flat(10)];
    let i = 0;
    await fetchRainfocusCatalog(creds, "session", (async (_u: string, init: RequestInit) => {
      calls.push(String(init.body));
      return pages[i++];
    }) as unknown as typeof fetch);
    expect(calls[0]).toContain("from=0");
    expect(calls[1]).toContain("from=50");
  });

  it("an empty page ends the walk instead of looping", async () => {
    const flat = (n: number) => ({ json: async () => ({ responseCode: "0", total: 999, items: Array.from({ length: n }, () => ({ title: "x" })) }) }) as Response;
    const pages = [flat(50), flat(0)];
    let i = 0;
    const out = await fetchRainfocusCatalog(creds, "session", (async () => pages[Math.min(i++, 1)]) as unknown as typeof fetch);
    expect((out as { items: unknown[] }).items).toHaveLength(50);
  });

  it("a network failure is an error, not an empty catalog", async () => {
    const out = await fetchRainfocusCatalog(creds, "session", (async () => { throw new Error("dns"); }) as unknown as typeof fetch);
    expect(out).toHaveProperty("error");
  });
});

/* ── speakers, sponsors, event details ──────────────────────────────────── */

import { pickFeaturedSpeakers, mapRainfocusSponsors, deriveEventDetails } from "./rainfocus";

describe("speakers", () => {
  const withPhoto = {
    fullName: "Tony Leopold", jobTitle: "CTO", companyName: "United Rentals",
    bio: "Leads technology.", photoURL: "https://x/tony.jpg", "Speaker-Photo-Published": "Published",
  };
  const noPhoto = { firstName: "Nick", lastName: "Errigo", jobTitle: "Consultant", companyName: "Procore" };
  const placeholder = {
    fullName: "Jane Doe", photoURL: "https://x/No%20Headshot-Stone%20Shovel.jpg",
    "Speaker-Photo-Published": "Published",
  };
  const unpublishedPhoto = { fullName: "Sam Ray", photoURL: "https://x/sam.jpg", "Speaker-Photo-Published": "No" };

  it("folds job title and company into one line", () => {
    expect(pickFeaturedSpeakers([withPhoto])[0]).toMatchObject({
      name: "Tony Leopold", title: "CTO, United Rentals", imageUrl: "https://x/tony.jpg",
    });
  });

  it("ignores the RainFocus 'no headshot' placeholder — initials beat a grey block", () => {
    expect(pickFeaturedSpeakers([placeholder])[0].imageUrl).toBeUndefined();
  });

  it("ignores an unpublished photo", () => {
    expect(pickFeaturedSpeakers([unpublishedPhoto])[0].imageUrl).toBeUndefined();
  });

  it("RANKS by prominence and CAPS — a 137-person catalog is not a keynote section", () => {
    const many = [noPhoto, noPhoto, withPhoto, noPhoto];
    const out = pickFeaturedSpeakers(many, 2);
    expect(out).toHaveLength(2);
    expect(out[0].name).toBe("Tony Leopold"); // has photo + bio
  });

  it("drops entries with no usable name", () => {
    expect(pickFeaturedSpeakers([{ firstName: "", lastName: "" }, withPhoto])).toHaveLength(1);
  });
});

describe("sponsors", () => {
  it("maps name, tier and link", () => {
    const out = mapRainfocusSponsors([
      { name: "Platinum Co", externalLink: "https://p.example", attributevalues: [{ attribute_id: "ExhibitorType", value: "Platinum", displayorder: 1 }] },
      { name: "" },
    ]);
    expect(out).toEqual([{ name: "Platinum Co", tier: "Platinum", url: "https://p.example" }]);
  });
});

describe("deriveEventDetails", () => {
  it("derives the name and the real date span from the sessions themselves", () => {
    const s = (date: string, room: string) => ({
      eventName: "Groundbreak 2026", times: [{ date, daySort: date.replace(/-/g, ""), room }],
    });
    const out = deriveEventDetails([s("2026-10-21", "Room 4"), s("2026-10-20", "Room 4"), s("2026-10-22", "Hall")]);
    expect(out).toMatchObject({ eventName: "Groundbreak 2026", startDate: "2026-10-20", endDate: "2026-10-22" });
    expect(out.venues[0]).toBe("Room 4"); // most frequent first
  });

  it("survives sessions with no times", () => {
    expect(deriveEventDetails([{ eventName: "X" }])).toMatchObject({ eventName: "X", startDate: "", endDate: "" });
  });
});

/* ── title cleaning ─────────────────────────────────────────────────────── */

import { cleanSessionTitle } from "./rainfocus";

describe("cleanSessionTitle", () => {
  it("strips a trailing OFFERING marker", () => {
    expect(cleanSessionTitle("Building a Flexible WBS OFFERING 2")).toBe("Building a Flexible WBS");
    expect(cleanSessionTitle("Master the Timeline OFFERING 3")).toBe("Master the Timeline");
    expect(cleanSessionTitle("Every Team, Every Asset Offering 2")).toBe("Every Team, Every Asset");
  });

  it("handles the punctuation people wrap it in", () => {
    for (const t of [
      "Advanced Budgeting (Offering 2)",
      "Advanced Budgeting - Offering 2",
      "Advanced Budgeting: Offering 2",
      "Advanced Budgeting [OFFERING 2]",
      "Advanced Budgeting offering #2",
    ]) {
      expect(cleanSessionTitle(t)).toBe("Advanced Budgeting");
    }
  });

  it("leaves a title that merely CONTAINS the word alone", () => {
    expect(cleanSessionTitle("What Your Offering Says About You"))
      .toBe("What Your Offering Says About You");
    expect(cleanSessionTitle("Offering 2 Ways to Scale")).toBe("Offering 2 Ways to Scale");
  });

  it("does NOT strip a legitimate 'Session N' title", () => {
    // `session` was deliberately left out of the pattern.
    expect(cleanSessionTitle("Breakout Session 2")).toBe("Breakout Session 2");
  });

  it("never returns an empty or stub title", () => {
    expect(cleanSessionTitle("OFFERING 2")).toBe("OFFERING 2");
  });

  it("leaves ordinary titles untouched", () => {
    expect(cleanSessionTitle("Construction Suicide Prevention Competency Certification"))
      .toBe("Construction Suicide Prevention Competency Certification");
  });
});

describe("mapRainfocusSessions — offering collisions", () => {
  const at = (title: string, date: string, startTime: string) => ({
    title, times: [{ date, daySort: date.replace(/-/g, ""), startTime, endTime: "10:00" }],
  });

  it("cleans titles when the offerings are in different slots (the normal case)", () => {
    const { rows } = mapRainfocusSessions([
      at("Advanced Budgeting OFFERING 2", "2026-10-20", "09:00"),
      at("Advanced Budgeting OFFERING 3", "2026-10-21", "09:00"),
    ]);
    expect(rows.map((r) => r.title)).toEqual(["Advanced Budgeting", "Advanced Budgeting"]);
    expect(rows[0].day).not.toBe(rows[1].day);
  });

  it("KEEPS the marker when cleaning would merge two sessions in the SAME slot", () => {
    // The stored key is (title, day, startTime): cleaning both would collapse
    // them into one row and silently lose a session.
    const { rows } = mapRainfocusSessions([
      at("Advanced Budgeting OFFERING 2", "2026-10-20", "09:00"),
      at("Advanced Budgeting OFFERING 3", "2026-10-20", "09:00"),
    ]);
    expect(rows.map((r) => r.title)).toEqual([
      "Advanced Budgeting OFFERING 2",
      "Advanced Budgeting OFFERING 3",
    ]);
  });
});
