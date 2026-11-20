import { describe, expect, it } from "vitest";
import { parsePracticeRow } from "./partnerRoom";
import { firstDateIn } from "./partnerRoomDates";

const now = new Date("2026-11-20T12:00:00Z");

describe("dates as reports write them", () => {
  it("reads the usual ways of writing one", () => {
    expect(firstDateIn("2026-11-04", now)).toBe("2026-11-04");
    expect(firstDateIn("11/4/2026", now)).toBe("2026-11-04");
    expect(firstDateIn("11/4/26", now)).toBe("2026-11-04");
    expect(firstDateIn("Nov 4, 2026", now)).toBe("2026-11-04");
    expect(firstDateIn("November 4th 2026", now)).toBe("2026-11-04");
    expect(firstDateIn("2026-11-04T15:00:00Z", now)).toBe("2026-11-04");
  });

  it("gives a date with no year the nearest one", () => {
    expect(firstDateIn("Nov 4", now)).toBe("2026-11-04");
    expect(firstDateIn("12/3", now)).toBe("2026-12-03");
    expect(firstDateIn("Jan 12", now)).toBe("2027-01-12");
    expect(firstDateIn("Aug 1", now)).toBe("2026-08-01");
  });

  it("takes the first of several, and nothing from text with no date", () => {
    expect(firstDateIn("11/4/2026; 11/18/2026", now)).toBe("2026-11-04");
    expect(firstDateIn("Session 2 on Dec 9, session 1 was 12/2/2026", now)).toBe("2026-12-09");
    expect(firstDateIn("2026-12-01, 2026-12-15", now)).toBe("2026-12-01");
    expect(firstDateIn("TBD", now)).toBeNull();
    expect(firstDateIn("2/30/2026", now)).toBeNull();
    expect(firstDateIn("", now)).toBeNull();
    expect(firstDateIn(null, now)).toBeNull();
  });
});

describe("a practice's training date from the sheet", () => {
  it("uses Training Date, and falls back to the first date in Training Dates", () => {
    expect(parsePracticeRow({ name: "A", "training date": "11/4/2026", "training dates": "12/1/2026; 12/8/2026" })!.trainingDate).toBe("11/4/2026");
    expect(parsePracticeRow({ name: "A", "training date": "", "training dates": "12/1/2026; 12/8/2026" })!.trainingDate).toBe("2026-12-01");
    expect(parsePracticeRow({ name: "A", "training dates": "to be scheduled" })!.trainingDate).toBeNull();
    expect(parsePracticeRow({ name: "A" })!.trainingDate).toBeNull();
  });
});
