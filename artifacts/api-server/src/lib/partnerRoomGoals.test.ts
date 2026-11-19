import { describe, expect, it } from "vitest";
import { parseRoomGoals, roomGoalsInfo, setRoomGoals } from "./partnerRoom";

const page = () => [
  { type: "hero", props: { headline: "x" } },
  {
    type: "room-workspace",
    props: {
      partnerName: "Acme Dental",
      hiddenModules: ["wins", "goals"],
      assets: [{ key: "one-pager", title: "One-pager" }],
      goals: {
        intro: "What success looks like for {{account}}",
        askAgreement: true,
        items: [
          { key: "lab-spend", title: "Share of lab spend", target: "40%", targetValue: 40, metric: "manual", current: "22%", currentValue: 22, status: "pending", owner: "Dana" },
          { key: "live", title: "Practices live", metric: "practices_live", targetValue: 30, current: "stale", status: "on-track" },
          { title: "" },
        ],
      },
    },
  },
];

describe("hub goals from the manage pop-up", () => {
  it("reads the stored goals, with the account-name variable left as typed", () => {
    const info = roomGoalsInfo(page());
    expect(info?.intro).toBe("What success looks like for {{account}}");
    expect(info?.askAgreement).toBe(true);
    expect(info?.moduleHidden).toBe(true);
    expect(info?.items.map((g) => g.key)).toEqual(["lab-spend", "live"]);
    expect(info?.items[0]).toMatchObject({ target: "40%", targetValue: 40, current: "22%", status: "pending", owner: "Dana" });
    // A counted goal never carries a typed value.
    expect(info?.items[1]).not.toHaveProperty("current");
  });

  it("is null for a page that is not a hub", () => {
    expect(roomGoalsInfo([{ type: "hero", props: {} }])).toBeNull();
    expect(setRoomGoals([{ type: "hero", props: {} }], { intro: "", askAgreement: false, moduleHidden: false, items: [] })).toBeNull();
  });

  it("refuses a goal with no name and more goals than a hub can hold", () => {
    expect(parseRoomGoals({ items: [{ title: "  " }] })).toEqual({ ok: false, error: "Every goal needs a name." });
    expect(parseRoomGoals({ items: Array.from({ length: 21 }, (_, i) => ({ title: `Goal ${i}` })) }).ok).toBe(false);
  });

  it("cleans what was sent: keys, numbers, unknown values", () => {
    const parsed = parseRoomGoals({
      intro: "  Hello  ",
      askAgreement: "yes",
      items: [
        { title: "Practices trained", metric: "nope", status: "nope", targetValue: "40", hidden: true, extra: "x" },
        { title: "Practices trained", key: "bad key!" },
      ],
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.goals.intro).toBe("Hello");
    expect(parsed.goals.askAgreement).toBe(false);
    expect(parsed.goals.items).toEqual([
      { key: "practices-trained", title: "Practices trained", metric: "manual", status: "on-track", hidden: true },
      { key: "practices-trained-2", title: "Practices trained", metric: "manual", status: "on-track" },
    ]);
  });

  it("saves goals and the section switch, and leaves the rest of the page alone", () => {
    const before = page();
    const parsed = parseRoomGoals({ intro: "New intro", askAgreement: false, moduleHidden: false, items: [{ key: "live", title: "Practices live", metric: "practices_live", targetValue: 50, status: "done" }] });
    if (!parsed.ok) throw new Error("expected ok");
    const next = setRoomGoals(before, parsed.goals) as { type: string; props: Record<string, unknown> }[];
    expect(next[0]).toBe(before[0]);
    expect(next[1].props.partnerName).toBe("Acme Dental");
    expect(next[1].props.assets).toEqual([{ key: "one-pager", title: "One-pager" }]);
    expect(next[1].props.hiddenModules).toEqual(["wins"]);
    expect(next[1].props.goals).toEqual({ intro: "New intro", askAgreement: false, items: [{ key: "live", title: "Practices live", targetValue: 50, metric: "practices_live", status: "done" }] });
    // Hiding it again adds the section back to the hidden list once.
    const hidden = setRoomGoals(next, { ...parsed.goals, moduleHidden: true }) as typeof next;
    expect(hidden[1].props.hiddenModules).toEqual(["wins", "goals"]);
    expect(roomGoalsInfo(hidden)?.moduleHidden).toBe(true);
  });
});
