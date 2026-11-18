import { describe, expect, it } from "vitest";
import { addTeamPeople, cleanDomain, EMPTY_SETUP_FACTS, levelRank, mainEmailDomain, rankAccountContacts, roomCreatedSlackBlocks, roomSetupChecklist, nameFromEmail, unlistedPeople } from "./partnerRoomTeam";

describe("room people from the account", () => {
  it("works out the customer's email domain, never a free-mail one", () => {
    expect(cleanDomain("https://www.MB2Dental.com/about")).toBe("mb2dental.com");
    expect(cleanDomain("gmail.com")).toBeNull();
    expect(cleanDomain("not a domain")).toBeNull();
    expect(mainEmailDomain(["a@mb2dental.com", "b@mb2dental.com", "c@asu.edu", "d@gmail.com", "e@gmail.com", "f@gmail.com", null])).toBe("mb2dental.com");
    expect(mainEmailDomain(["x@gmail.com"])).toBeNull();
  });

  it("ranks contacts most senior first, one per address, only at the customer's domain", () => {
    const rows = [
      { firstName: "Mia", lastName: "Manager", title: "Regional Operations Manager", email: "mia@mb2dental.com", titleLevel: "Manager", status: "active" },
      { firstName: "Cal", lastName: "Chief", title: "Chief Operating Officer", email: "Cal@MB2Dental.com", titleLevel: "C Suite", status: "active" },
      { firstName: "Vi", lastName: "Vp", title: "Vice President, Payer Strategy", email: "vi@mb2dental.com", titleLevel: "C Suite", status: "active" },
      { firstName: "Dee", lastName: "Dir", title: "Director of Operations", email: "dee@mb2dental.com", titleLevel: "Director", status: "active" },
      { firstName: "Cal", lastName: "Again", title: "COO", email: "cal@mb2dental.com", titleLevel: "C Suite", status: "active" },
      { firstName: "Out", lastName: "Sider", title: "CEO and Founder", email: "out@asu.edu", titleLevel: "C Suite", status: "active" },
      { firstName: "Gone", lastName: "Person", title: "CEO", email: "gone@mb2dental.com", titleLevel: "C Suite", status: "inactive" },
      { firstName: "", lastName: "", title: "CEO", email: "noname@mb2dental.com", titleLevel: "C Suite", status: "active" },
    ];
    expect(rankAccountContacts(rows, "mb2dental.com").map((c) => c.name)).toEqual(["Cal Chief", "Vi Vp", "Dee Dir", "Mia Manager"]);
    expect(rankAccountContacts(rows, null).map((c) => c.name)).toContain("Out Sider");
    expect(levelRank("C Suite", "Vice President of Credentialing")).toBeGreaterThan(levelRank("C Suite", "CEO and Founder"));
  });
});

describe("the room's Team module", () => {
  const blocks = () => [
    { type: "hero", props: {} },
    {
      type: "room-workspace",
      props: {
        partnerName: "MB2 Dental",
        team: [
          { title: "Dandy", members: [{ name: "[Name]", role: "Account Manager" }] },
          { title: "[Partner name]", members: [{ name: "[Name]", role: "Executive Sponsor" }, { name: "Dana Ruiz", role: "COO", email: "dana@mb2.com" }] },
        ],
      },
    },
  ];
  const team = (b: unknown[] | null) => (b![1] as { props: { team: { members: { name: string; role?: string; email?: string }[] }[] } }).props.team;

  it("puts the customer's people on the customer's side, once, and drops the placeholders", () => {
    const next = addTeamPeople(blocks(), "partner", [{ name: "Dana R.", role: "Chief", email: "DANA@mb2.com" }, { name: "Kai Lee", role: "VP Ops", email: "Kai@mb2.com" }]);
    expect(team(next)[1].members).toEqual([{ name: "Dana Ruiz", role: "COO", email: "dana@mb2.com" }, { name: "Kai Lee", role: "VP Ops", email: "kai@mb2.com" }]);
    expect(team(next)[0].members).toHaveLength(1); // our side untouched
    expect(addTeamPeople(blocks(), "partner", [{ name: "dana ruiz" }])).toBeNull();
    expect(addTeamPeople([{ type: "hero" }], "partner", [{ name: "X" }])).toBeNull();
  });

  it("leads our side with the account owner and keeps the role placeholders", () => {
    const next = addTeamPeople(blocks(), "ours", [{ name: "Sam Rep", role: "Account owner", email: undefined }], { first: true, keepPlaceholders: true });
    expect(team(next)[0].members).toEqual([{ name: "Sam Rep", role: "Account owner" }, { name: "[Name]", role: "Account Manager" }]);
  });
});

describe("the setup checklist for a new room", () => {
  it("ticks what was done automatically and lists the rest for the team", () => {
    const bare = roomSetupChecklist(EMPTY_SETUP_FACTS);
    expect(bare.filter((i) => i.done)).toHaveLength(2); // the draft exists, and it asks for an email before showing anything
    expect(bare.map((i) => i.text).join("\n")).toMatch(/Connect your calendar[\s\S]*Slack channel[\s\S]*invite the customer's team/);
    const full = roomSetupChecklist({ standardFiles: 2, teamFilled: 8, contacts: 79, domain: "mb2dental.com", practicesLinked: true, ownerNamed: true });
    expect(full.filter((i) => i.done).map((i) => i.text)).toEqual([
      "Draft Partner Hub created with 2 standard guides",
      "Customer team filled in from the account (8 people). Check it is the right group",
      "Customer email domain set to mb2dental.com",
      "Practice list linked to the locations sheet",
      "Asks for a work email before showing anything (invited people go straight in)",
    ]);
    expect(full[full.length - 1].text).toContain("79 contacts on the account");
  });

  it("writes a Slack message with the link and both lists, and can't be broken by a name", () => {
    const text = JSON.stringify(roomCreatedSlackBlocks("Smile <!channel> *Brands*", { edit: "https://ws.example.com/builder/9", room: "https://rooms.example.com/smile-room" }, EMPTY_SETUP_FACTS));
    expect(text).not.toContain("<!channel>");
    expect(text).toContain("<https://ws.example.com/builder/9|Open it in LP Studio>");
    expect(text).toContain("*Your setup checklist*");
    expect(text).toContain("◻️ Connect your calendar");
    expect(JSON.stringify(roomCreatedSlackBlocks("X", { edit: "", room: "" }, EMPTY_SETUP_FACTS, { test: true }))).toContain("Test run");
  });
});

describe("people in the hub who are on no list", () => {
  it("reads a name from an address, and gives the address back when it can't", () => {
    expect(nameFromEmail("dana.ruiz@customer.com")).toBe("Dana Ruiz");
    expect(nameFromEmail("KIM_lee@customer.com")).toBe("Kim Lee");
    expect(nameFromEmail("ops@customer.com")).toBe("Ops");
    expect(nameFromEmail("d.r@customer.com")).toBe("d.r@customer.com");
    expect(nameFromEmail("a1b2c3@customer.com")).toBe("a1b2c3@customer.com");
  });
  it("lists invited people once, leaving out anyone already shown and our own team", () => {
    const got = unlistedPeople(
      [{ email: "Dana.Ruiz@customer.com" }, { email: "listed@customer.com" }, { email: "dana.ruiz@customer.com" }, { email: "rep@us.com" }, { email: "kim@customer.com", name: " Kim Lee " }, { email: "" }],
      ["LISTED@customer.com", null],
      ["rep@us.com"],
    );
    expect(got).toEqual([
      { email: "dana.ruiz@customer.com", name: "Dana Ruiz" },
      { email: "kim@customer.com", name: "Kim Lee" },
    ]);
  });
});
