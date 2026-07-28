import { describe, expect, it } from "vitest";
import {
  buildAgendaTokens,
  interpolateText,
  interpolateDeep,
  personalizeAgendaProps,
} from "./agenda-tokens";

const FACTS = {
  accountName: "Pacific Dental Alliance",
  eventName: "Groundbreak 2026",
  eventLocation: "Austin, TX",
  eventDates: "Oct 20–22, 2026",
};

describe("buildAgendaTokens", () => {
  it("accepts every spelling of the company token people actually type", () => {
    const v = buildAgendaTokens(FACTS);
    for (const k of ["company", "company_name", "account", "account_name", "customer"]) {
      expect(v[k]).toBe("Pacific Dental Alliance");
    }
  });

  it("omits tokens we have no value for rather than mapping them to empty", () => {
    const v = buildAgendaTokens({ accountName: "Acme" });
    expect(v.event_name).toBeUndefined();
    expect(v.company).toBe("Acme");
  });
});

describe("interpolateText", () => {
  const vars = buildAgendaTokens(FACTS);

  it("substitutes wherever the token appears, not just in known fields", () => {
    expect(interpolateText("Welcome, {{company_name}} — see you in {{event_location}}.", vars))
      .toBe("Welcome, Pacific Dental Alliance — see you in Austin, TX.");
  });

  it("is tolerant of spacing and case", () => {
    expect(interpolateText("{{ company_name }} / {{COMPANY}} / {{Company_Name}}", vars))
      .toBe("Pacific Dental Alliance / Pacific Dental Alliance / Pacific Dental Alliance");
  });

  it("replaces every occurrence, not only the first", () => {
    expect(interpolateText("{{company}} and {{company}}", vars))
      .toBe("Pacific Dental Alliance and Pacific Dental Alliance");
  });

  it("LEAVES UNKNOWN TOKENS INTACT — DTR resolves those at runtime", () => {
    expect(interpolateText("Searching for {{keyword}}", vars)).toBe("Searching for {{keyword}}");
    expect(interpolateText("{{utm_campaign}}", vars)).toBe("{{utm_campaign}}");
    // `city` belongs to DTR (the visitor's city) — we must not claim it even
    // though we know the event's location.
    expect(interpolateText("{{city}}", vars)).toBe("{{city}}");
  });

  it("leaves a typo visible instead of deleting the copy around it", () => {
    expect(interpolateText("Hi {{compnay}}, welcome", vars)).toBe("Hi {{compnay}}, welcome");
  });

  it("does NOT HTML-escape — these are React text props", () => {
    const v = buildAgendaTokens({ accountName: "Smith & Jones" });
    expect(interpolateText("{{company}}", v)).toBe("Smith & Jones");
  });

  it("reports what it replaced and what it couldn't", () => {
    const report = { replaced: 0, unknown: [] as string[] };
    interpolateText("{{company}} {{company}} {{keyword}} {{nope}}", vars, report);
    expect(report.replaced).toBe(2);
    expect(report.unknown).toEqual(["keyword", "nope"]);
  });

  it("leaves text with no tokens completely alone", () => {
    expect(interpolateText("Just some copy.", vars)).toBe("Just some copy.");
  });
});

describe("interpolateDeep", () => {
  const vars = buildAgendaTokens(FACTS);

  it("reaches nested objects and arrays — the whole point of the fix", () => {
    const props = {
      headline: "{{company_name}}, your agenda",
      teamHeading: "Your {{company}} team",
      days: [
        { label: "Day one", sessions: [{ title: "Kickoff with {{company_name}}", description: "For {{account}}." }] },
      ],
      resources: [{ title: "{{company}} guide" }],
    };
    const out = interpolateDeep(props, vars);
    expect(out.teamHeading).toBe("Your Pacific Dental Alliance team");
    expect(out.days[0].sessions[0].title).toBe("Kickoff with Pacific Dental Alliance");
    expect(out.days[0].sessions[0].description).toBe("For Pacific Dental Alliance.");
    expect(out.resources[0].title).toBe("Pacific Dental Alliance guide");
  });

  it("passes non-strings through untouched", () => {
    const out = interpolateDeep(
      { n: 42, b: true, nil: null, un: undefined, arr: [1, 2] },
      vars,
    );
    expect(out).toEqual({ n: 42, b: true, nil: null, un: undefined, arr: [1, 2] });
  });

  it("never rewrites object KEYS", () => {
    const out = interpolateDeep({ "{{company}}": "x" } as Record<string, string>, vars);
    expect(Object.keys(out)).toEqual(["{{company}}"]);
  });

  it("does not mutate the input", () => {
    const props = { headline: "{{company}}" };
    const out = interpolateDeep(props, vars);
    expect(props.headline).toBe("{{company}}");
    expect(out.headline).toBe("Pacific Dental Alliance");
  });
});

describe("personalizeAgendaProps", () => {
  it("substitutes a whole props object and reports on it", () => {
    const { props, report } = personalizeAgendaProps(
      { headline: "{{company_name}} agenda", note: "See you at {{event_name}}", stray: "{{keyword}}" },
      FACTS,
    );
    expect(props.headline).toBe("Pacific Dental Alliance agenda");
    expect(props.note).toBe("See you at Groundbreak 2026");
    expect(props.stray).toBe("{{keyword}}");
    expect(report.replaced).toBe(2);
    expect(report.unknown).toEqual(["keyword"]);
  });

  it("an account with no name doesn't blank the copy around the token", () => {
    const { props } = personalizeAgendaProps({ h: "Hello {{company}}!" }, { accountName: "" });
    // Empty substitution is legitimate here (the token IS known) but the rest
    // of the sentence must survive.
    expect(props.h).toBe("Hello !");
  });
});
